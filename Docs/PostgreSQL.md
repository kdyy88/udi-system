User: 该项目原本是poc验证阶段产物，现已完成验证，需改造为生产级产品，poc时的弊端需要修改：
1. 首次进入时，加载历史记录过慢，有时容易超时；
2. 好像后端每次只能执行一个任务，多任务请求时会超时，如何提高并发量？
3.前端需要采用bwip-js实时渲染，因为多次请求对后端造成压力，真正下载时，才同步到后端及历史记录中

GitHub Copilot: Research codebase for production improvements

Read [](file:///home/administrator/udi-system/backend/app/api/labels.py)

Read [](file:///home/administrator/udi-system/backend/app/services/barcode_gen.py)

Read [](file:///home/administrator/udi-system/backend/app/services/gs1_engine.py)

Read [](file:///home/administrator/udi-system/backend/app/db/models.py)

Read [](file:///home/administrator/udi-system/backend/app/db/session.py)

Read [](file:///home/administrator/udi-system/backend/app/core/config.py)

Read [](file:///home/administrator/udi-system/backend/main.py)

Read [](file:///home/administrator/udi-system/backend/app/main.py)

Read [](file:///home/administrator/udi-system/docker-compose.yml)

Read [](file:///home/administrator/udi-system/docker-compose.prod.yml)

Read [](file:///home/administrator/udi-system/backend/Dockerfile)

Read [](file:///home/administrator/udi-system/frontend/hooks/useLabelHistory.ts)

Read [](file:///home/administrator/udi-system/frontend/hooks/useLabels.ts)

Read [](file:///home/administrator/udi-system/frontend/hooks/useUdiGenerator.ts)

Read [](file:///home/administrator/udi-system/frontend/features/labels/api/routes.ts)

Read [](file:///home/administrator/udi-system/frontend/features/labels/preview/useLabelPreviewOrchestrator.ts)

Read [](file:///home/administrator/udi-system/frontend/components/labels/BarcodePreview.tsx)

Read [](file:///home/administrator/udi-system/frontend/components/labels/LabelForm.tsx)

Read [](file:///home/administrator/udi-system/frontend/components/labels/LabelHistorySection.tsx)

Read [](file:///home/administrator/udi-system/frontend/lib/api.ts)

Read [](file:///home/administrator/udi-system/frontend/features/labels/preview/barcode-svg.ts)

Read [](file:///home/administrator/udi-system/frontend/features/labels/preview/export.ts)

Read [](file:///home/administrator/udi-system/frontend/features/labels/preview/payload.ts)

Read [](file:///home/administrator/udi-system/backend/requirements.txt)

Read [](file:///home/administrator/udi-system/frontend/package.json)

Read [](file:///home/administrator/udi-system/COMPONENT_ARCHITECTURE.md)

Read [](file:///home/administrator/.vscode-server-insiders/data/User/workspaceStorage/06f0455b4cbaa6d7d4207da9dd908703/GitHub.copilot-chat/chat-session-resources/069d24c2-cb1a-48c5-b921-d7ed900eec29/toolu_01QLNNvpSs5oBUWtDkiNyHwr__vscode-1773420320879/content.txt)

研究完成。在起草完整方案之前，有几个关键架构决策需要确认： 

Asked 4 questions (数据库, 后端并发, 历史缓存, 下载触发)

收到，根据研究结果和您的决策，以下是完整改造方案：

---

## Plan: POC → 生产级产品改造

**TL;DR**：四条核心主轴——①数据库从 SQLite 迁移至 PostgreSQL（解决并发写冲突）；②後端异步化 + Gunicorn 多 worker（提升吞吐）；③前端全量采用 bwip-js 实时渲染，仅在导出时触发后端存储；④用 TanStack Query (React Query v5) 替换裸 axios，实现历史记录本地缓存与智能刷新。

---

### 一、数据库迁移：SQLite → PostgreSQL

**目标**：消除多 worker 写冲突，支持连接池与异步驱动。

**步骤**

1. **postgres 服务加入 Compose**
   - docker-compose.yml 与 docker-compose.prod.yml 添加 `postgres:16-alpine` service，设置 `POSTGRES_DB/USER/PASSWORD`，挂载数据卷
   - backend service 增加 `depends_on: postgres` 与 `DATABASE_URL` 环境变量

2. **SQLAlchemy 切换异步引擎**
   - requirements.txt：添加 `asyncpg`、`sqlalchemy[asyncio]`，移除 `aiosqlite`（若有）
   - session.py：用 `create_async_engine(DATABASE_URL, pool_size=10, max_overflow=20, pool_pre_ping=True)` 替换同步 engine；`AsyncSession` 替换 `Session`；依赖注入改为 `async_generator`
   - config.py：`DATABASE_URL` 从环境变量读取，默认 `postgresql+asyncpg://...`

3. **模型层新增复合索引**
   - models.py：添加复合索引 `Index('ix_lh_user_created', 'user_id', 'created_at')` 和 `Index('ix_lh_user_id_desc', 'user_id', 'id')` — 解决排序分页扫描慢的问题

4. **Alembic 初始化迁移**
   - 初始化 `alembic`，生成首个 migration，`docker-compose` 启动前 entrypoint 执行 `alembic upgrade head`
   - Dockerfile entrypoint 改为先迁移再启动服务

---

### 二、后端并发提升

**目标**：全链路异步 + 多进程 worker，消除事件循环阻塞。

**步骤**

5. **所有路由改为 async，DB 调用改为 await**
   - labels.py：所有 `db.execute()` 改为 `await db.execute()`，`db.add/commit/refresh` 改为 await 对应异步方法
   - 历史查询使用 `select func.count()` + `scalars()` 合并为单次可复用的子查询，或使用 keyset 分页避免 COUNT 开销

6. **Ghostscript 调用卸载到线程池**
   - barcode_gen.py：将 `treepoem.generate_barcode()` 包装进 `await asyncio.get_event_loop().run_in_executor(None, _sync_render, ...)` — 不阻塞事件循环（因前端改为 bwip-js 后此项调用极少，保留用于导出时后端存储）
   - 推荐开源方案对比：`anyio.to_thread.run_sync`（anyio，FastAPI 原生集成，**推荐**）vs `loop.run_in_executor`（标准库）

7. **Gunicorn + uvicorn workers**
   - Dockerfile CMD 改为：`gunicorn main:app -k uvicorn.workers.UvicornWorker --workers 4 --bind 0.0.0.0:8000 --timeout 120`
   - requirements.txt 添加 `gunicorn`
   - docker-compose.prod.yml 移除 `--workers` 参数（由 Gunicorn 统一管理），worker 数量做成环境变量 `$WORKERS`

8. **历史列表接口优化**
   - labels.py `GET /history`：剥离大字段（`datamatrix_base64`、`gs1_128_base64`），在 SELECT 中用 `with_only_columns`，不加载这两列（当前 schema 已屏蔽，但 query 仍全列拉取，需显式排除）
   - 可选：为 history list 响应添加 HTTP `Cache-Control: private, max-age=30` header，减少前端重复请求

---

### 三、前端 bwip-js 实时渲染

**目标**：Preview 完全在浏览器渲染，导出时才调后端保存，零预览网络请求。

**步骤**

9. **移除 `/preview` 和 `/preview-svg` 调用**
   - useLabelPreviewOrchestrator.ts：删除对 `POST /preview`、`POST /preview-svg` 的调用；改为在本地用 bwip-js 生成 DataMatrix 和 GS1-128 SVG
   - 依赖 barcode-svg.ts 中已有的 `createNormalizedGs1Svg()` 作为 GS1-128 路径；参照同样方式为 DataMatrix 添加 `createDataMatrixSvg()` 函数（bwip-js 支持 `datamatrix` 符码）

10. **LabelForm / UdiForm 实时渲染**
    - UdiForm.tsx：表单字段变更时，在客户端计算 GS1 字符串 + 用 bwip-js 渲染预览，无需往返后端
    - BarcodePreview.tsx：接收 bwip-js 产生的 SVG 字符串，直接 `dangerouslySetInnerHTML` 渲染，不再等待异步请求

11. **导出时触发后端保存 (`POST /generate`)**
    - export.ts：在导出函数（PNG/SVG/PDF）执行前，调用 `POST /api/v1/labels/generate` 将当前 UDI 数据同步到后端，后端完成存储并返回 `id` 后再执行本地导出
    - 如果用户反复调整预览多次，每次 export 都视为一条新记录写入历史（或：加一个 debounce + 去重检查 `full_string` 防止重复写入）

12. **新 `/generate` 接口瘦身**
    - labels.py `POST /generate`：移除 BackgroundTask 条码渲染逻辑；仅存储 metadata 字段，`datamatrix_base64` 和 `gs1_128_base64` 字段可设为可选（导出时前端传入 base64，或后端按需异步渲染存储）
    - 最简路径：接口接收 UDI 参数，写入数据库，返回 `{id, created_at}`，条码图像不再存 DB（节省大量存储）

---

### 四、前端历史缓存：TanStack Query

**目标**：首次加载快、翻页缓存命中、删除后智能刷新、不丢失过滤上下文。

**步骤**

13. **安装 TanStack Query v5**
    - package.json：添加 `@tanstack/react-query`、`@tanstack/react-query-devtools`
    - layout.tsx：添加 `QueryClientProvider` 包裹全局布局，`staleTime: 30_000`

14. **重写 `useLabelHistory` hook**
    - useLabelHistory.ts：用 `useQuery({ queryKey: ['history', page, filters], queryFn: fetchHistory, staleTime: 30000, placeholderData: keepPreviousData })` 替换手动 state + axios；翻页时显示上一页数据直到新数据到达（不闪烁）
    - 删除操作改用 `useMutation` + `queryClient.invalidateQueries(['history'])`，保留当前 `page` 和 `filters` 不重置

15. **prefetch 第一页**
    - layout.tsx 或 history 页路由：进入页面时 `queryClient.prefetchQuery` 预加载第 1 页数据，用户看到历史记录时已命中缓存

---

### 验证

| 项目 | 验证方式 |
|---|---|
| PostgreSQL 连接 | `docker-compose up` 后 `docker exec backend python -c "from app.db.session import engine; print(engine.url)"` |
| 并发压测 | `hey -n 200 -c 20 http://localhost:8000/api/v1/labels/history?user_id=1` — 确认无 timeout |
| bwip-js 渲染 | 打开 Preview Dialog，F12 Network 面板确认无 `/preview` 请求 |
| 导出触发存储 | 导出 PNG 后查看历史列表，确认新增一条记录 |
| 翻页缓存 | 翻到第2页后点第1页，Network 面板无新请求（命中缓存）|
| Alembic 迁移 | `alembic upgrade head` 无 error，表结构含新复合索引 |

---

**Decisions**
- 数据库：SQLite → PostgreSQL（用户确认）
- 并发卸载：`anyio.to_thread.run_sync`（FastAPI 原生，比 `run_in_executor` 更简洁）
- 前端缓存：TanStack Query v5（成熟度与 DX 均优于 SWR，Next.js 13+ App Router 兼容）
- 存储触发：仅在点击"导出"时写入后端及历史（用户确认）
- 条码存储：`datamatrix_base64`/`gs1_128_base64` 两列可以废弃，节省 DB 存储（需二次确认）

> **注**：最后一点"条码图像是否继续存入数据库"影响历史记录详情页的展示逻辑——如果历史详情需要回显原始条码图像，需要保留（或改为前端从 metadata 重新渲染）。请确认后方可实施。

User: 历史详情需要回显原始条码图像

GitHub Copilot: Asked a question (历史条码回显)

确认。更新方案中的最后一条决策，计划现已完整：

---

**更新：条码图像存储策略**

- `datamatrix_base64` 和 `gs1_128_base64` 两列**废弃并从 schema 移除**（Alembic migration 中 `DROP COLUMN`）
- 历史详情页改为：从后端获取记录的 metadata（`full_string`、`gtin`、`batch_no`、`expiry_date`、`serial_no`）→ 前端 bwip-js 客户端重渲染，效果与原始完全一致
- `GET /history/{id}` 接口同步移除 lazy re-render 逻辑（labels.py 第252行的空字段检查 + Ghostscript 按需调用），接口变为纯 DB 查询，极快

---

**Decisions（最终完整版）**
- 数据库：SQLite → PostgreSQL ✅
- 并发卸载：`anyio.to_thread.run_sync`（导出时后端极少量 Ghostscript 调用用此卸载）✅
- 前端缓存：TanStack Query v5 ✅
- 存储触发：仅在点击"导出 PNG/SVG/PDF"时写入后端及历史 ✅
- 条码图像：**不存储 base64**，历史详情由前端从 metadata 重渲染 ✅

方案已完整定稿，可交付实施。

User: Start implementation

GitHub Copilot: Created 9 todos

First, let me read all critical files in parallel to understand the current state:    

Read [](file:///home/administrator/udi-system/backend/app/db/session.py)

Read [](file:///home/administrator/udi-system/backend/app/db/models.py)

Read [](file:///home/administrator/udi-system/backend/app/core/config.py)

Read [](file:///home/administrator/udi-system/backend/requirements.txt)

Read [](file:///home/administrator/udi-system/backend/app/api/labels.py)

Read [](file:///home/administrator/udi-system/backend/app/api/auth.py)

Read [](file:///home/administrator/udi-system/backend/app/main.py)

Read [](file:///home/administrator/udi-system/backend/main.py)

Read [](file:///home/administrator/udi-system/backend/app/schemas/label.py)

Read [](file:///home/administrator/udi-system/backend/app/services/barcode_gen.py)

Read [](file:///home/administrator/udi-system/docker-compose.yml)

Read [](file:///home/administrator/udi-system/docker-compose.prod.yml)

Read [](file:///home/administrator/udi-system/backend/Dockerfile)

Read [](file:///home/administrator/udi-system/frontend/hooks/useLabelHistory.ts)

Read [](file:///home/administrator/udi-system/frontend/hooks/useLabels.ts)

Read [](file:///home/administrator/udi-system/frontend/hooks/useUdiGenerator.ts)

Read [](file:///home/administrator/udi-system/frontend/features/labels/preview/useLabelPreviewOrchestrator.ts)

Read [](file:///home/administrator/udi-system/frontend/features/labels/preview/barcode-svg.ts)

Read [](file:///home/administrator/udi-system/frontend/features/labels/preview/export.ts)

Read [](file:///home/administrator/udi-system/frontend/features/labels/preview/payload.ts)

Read [](file:///home/administrator/udi-system/frontend/components/labels/PreviewDialog.tsx)

Read [](file:///home/administrator/udi-system/frontend/components/labels/LabelHistorySection.tsx)

Read [](file:///home/administrator/udi-system/frontend/app/layout.tsx)

Read [](file:///home/administrator/udi-system/frontend/lib/api.ts)

Read [](file:///home/administrator/udi-system/frontend/app/labels/page.tsx)

Read [](file:///home/administrator/udi-system/frontend/features/labels/api/routes.ts)

Read [](file:///home/administrator/udi-system/frontend/types/udi.ts)

Read [](file:///home/administrator/udi-system/backend/app/services/auth_service.py)

Read [](file:///home/administrator/udi-system/frontend/app/page.tsx)

Read [](file:///home/administrator/udi-system/frontend/app/history/page.tsx)

Read [](file:///home/administrator/udi-system/frontend/components/labels/LabelForm.tsx)

Read [](file:///home/administrator/udi-system/frontend/lib/preview-templates.ts)

Read [](file:///home/administrator/udi-system/frontend/components/labels/PreviewTemplateCanvas.tsx)

Read [](file:///home/administrator/udi-system/frontend/lib/auth.ts)

Read [](file:///home/administrator/udi-system/frontend/lib/dateUtils.ts)

Read [](file:///home/administrator/udi-system/backend/app/services/gs1_engine.py)

Read [](file:///home/administrator/udi-system/frontend/components/labels/BarcodePreview.tsx)

Read [](file:///home/administrator/udi-system/frontend/package.json)

Read [](file:///home/administrator/udi-system/backend/pyproject.toml)

Read [](file:///home/administrator/udi-system/frontend/components/shared/DataTable.tsx)

I now have a complete picture of the codebase. Let me begin implementation. I'll work through all changes systematically. 

Starting: *PostgreSQL + Async DB setup* (1/9)

**Phase 1: Backend — DB, config, models, schemas** 

Replacing 7 lines with 11 lines in [](file:///home/administrator/udi-system/backend/requirements.txt)


```

```


Replacing 17 lines with 21 lines in [](file:///home/administrator/udi-system/backend/pyproject.toml)


```

```
Now update config, session, models, and schemas simultaneously: 

Replacing 17 lines with 20 lines in [](file:///home/administrator/udi-system/backend/app/core/config.py)


```

```


Replacing 63 lines with 31 lines in [](file:///home/administrator/udi-system/backend/app/db/session.py)


```

```


Replacing 38 lines with 41 lines in [](file:///home/administrator/udi-system/backend/app/db/models.py)


```

```
Now update label.py — strip barcode fields, simplify `LabelGenerateResponse` and `LabelHistoryDetailResponse`: 

Replacing 114 lines with 96 lines in [](file:///home/administrator/udi-system/backend/app/schemas/label.py)


```

```
Now update auth_service.py, auth.py, labels.py, and main.py in parallel:  

Replacing 74 lines with 76 lines in [](file:///home/administrator/udi-system/backend/app/services/auth_service.py), [](file:///home/administrator/udi-system/backend/app/api/auth.py)


```

```

```

```
Now rewrite the main labels API and app startup:  

Replacing 31 lines with 233 lines in [](file:///home/administrator/udi-system/backend/app/api/labels.py)


```

```


Replacing 41 lines with 51 lines in [](file:///home/administrator/udi-system/backend/app/main.py)


```

```


Starting: *Alembic migrations init* (2/9)

**Phase 2: Alembic setup**  

Created [](file:///home/administrator/udi-system/backend/alembic.ini)

Created [](file:///home/administrator/udi-system/backend/alembic/env.py)

Continue to iterate?
[object Object]

Made changes.

User: @agent Continue: "Continue to iterate?"

GitHub Copilot: Created [](file:///home/administrator/udi-system/backend/alembic/script.py.mako)

Created [](file:///home/administrator/udi-system/backend/alembic/versions/0001_initial_schema.py)

Starting: *Gunicorn + Docker Compose update* (4/9)

**Phase 3: Gunicorn, entrypoint, Docker Compose**  

Created [](file:///home/administrator/udi-system/backend/entrypoint.sh)

Replacing 21 lines with 24 lines in [](file:///home/administrator/udi-system/backend/Dockerfile)


```

```


Replacing 23 lines with 50 lines in [](file:///home/administrator/udi-system/docker-compose.yml)


```

```


Replacing 28 lines with 47 lines in [](file:///home/administrator/udi-system/docker-compose.prod.yml)


```

```
Backend is done. Now **Phase 4: Frontend** — install TanStack Query: 

Starting: *Install TanStack Query frontend* (5/9)

Ran terminal command:  cd /home/administrator/udi-system/frontend && pnpm add @tanstack/react-query@^5 @tanstack/react-query-devtools@^5

Now add all frontend files in parallel — providers, types, GS1 lib, and updated hooks:   

Created [](file:///home/administrator/udi-system/frontend/app/providers.tsx)

Replacing 36 lines with 39 lines in [](file:///home/administrator/udi-system/frontend/app/layout.tsx)


```

```


Replacing 69 lines with 73 lines in [](file:///home/administrator/udi-system/frontend/types/udi.ts)


```

```
Now create the frontend GS1 builder utility and add DataMatrix to barcode-svg:   

Created [](file:///home/administrator/udi-system/frontend/lib/gs1.ts)

Replacing 72 lines with 95 lines in [](file:///home/administrator/udi-system/frontend/features/labels/preview/barcode-svg.ts)


```

```


Starting: *bwip-js full client render* (6/9)

Rewrite the preview orchestrator (pure bwip-js, synchronous) and create the backend-save helper:    

Replacing 107 lines with 52 lines in [](file:///home/administrator/udi-system/frontend/features/labels/preview/useLabelPreviewOrchestrator.ts)


```

```


Created [](file:///home/administrator/udi-system/frontend/features/labels/preview/save.ts)

Starting: *Export triggers backend save* (7/9)

Rewrite useLabels.ts (local state, no API) and useLabelHistory.ts (TanStack Query):    

Replacing 74 lines with 80 lines in [](file:///home/administrator/udi-system/frontend/hooks/useLabels.ts)


```

```


Replacing 86 lines with 110 lines in [](file:///home/administrator/udi-system/frontend/hooks/useLabelHistory.ts)


```

```


Starting: *History detail bwip-js re-render* (9/9)

Now rewrite PreviewDialog.tsx, page.tsx, and page.tsx:   

Replacing 34 lines with 215 lines in [](file:///home/administrator/udi-system/frontend/components/labels/PreviewDialog.tsx)


```

```
Now update `LabelHistorySection` to remove the `loadingReviewId` prop and simplify delete:  

Replacing 56 lines with 53 lines in [](file:///home/administrator/udi-system/frontend/components/labels/LabelHistorySection.tsx)


```

```


Replacing 138 lines with 99 lines in [](file:///home/administrator/udi-system/frontend/app/page.tsx)


```

```
Update `LabelForm` to accept sync handler (no longer async):  

Replacing 11 lines with 11 lines in [](file:///home/administrator/udi-system/frontend/components/labels/LabelForm.tsx)


```

```
Now rewrite page.tsx — TanStack Query + `PreviewDialog`:    

Replacing 26 lines with 115 lines in [](file:///home/administrator/udi-system/frontend/app/history/page.tsx)


```

```
Let me verify the history page was replaced correctly — the old component had complex content after the imports:   

Read [](file:///home/administrator/udi-system/frontend/app/history/page.tsx)

The file has duplicate content — need to remove the old component that's still appended:    

Replacing 146 lines with 2 lines in [](file:///home/administrator/udi-system/frontend/app/history/page.tsx)


```

```
Now verify PreviewDialog.tsx is fully replaced (the `replace_string_in_file` only replaced the imports section):    

Read [](file:///home/administrator/udi-system/frontend/components/labels/PreviewDialog.tsx#1-1), lines 1 to 31

Read [](file:///home/administrator/udi-system/frontend/components/labels/PreviewDialog.tsx#160-160), lines 160 to 396

Remove the stale old component body from PreviewDialog.tsx:     

Replacing 17 lines with 2 lines in [](file:///home/administrator/udi-system/frontend/components/labels/PreviewDialog.tsx)


```

```


Read [](file:///home/administrator/udi-system/frontend/components/labels/PreviewDialog.tsx#210-210), lines 210 to 381

Replacing 166 lines with 2 lines in [](file:///home/administrator/udi-system/frontend/components/labels/PreviewDialog.tsx)


```

```
Now run TypeScript type-check to catch any remaining issues:     

Ran terminal command:  cd /home/administrator/udi-system/frontend && pnpm exec tsc --noEmit 2>&1 | head -80

Fix PreviewTemplateCanvas.tsx — the PNG type imports reference removed types:   

Replacing 11 lines with 17 lines in [](file:///home/administrator/udi-system/frontend/components/labels/PreviewTemplateCanvas.tsx)


```

```


Ran terminal command:  cd /home/administrator/udi-system/frontend && pnpm exec tsc --noEmit 2>&1 | head -80

TypeScript passes cleanly. Now verify the backend Python for import errors:     

Ran terminal command:  cd /home/administrator/udi-system/backend && pip install sqlalchemy[asyncio] asyncpg alembic gunicorn anyio -q 2>&1 | tail -5 && python -c "from app.api.labels import router; from app.api.auth import router as ar; from app.main import app; print('Backend imports OK')" 2>&1
Completed with input:  cd /home/administrator/udi-system/backend && pip install sqlalchemy[asyncio] asyncpg alembic gunicorn anyio -q 2>&1 | tail -5 && python -c "from app.api.labels import router; from app.api.auth import router as ar; from app.main import app; print('Backend imports OK')" 2>&1

Ran terminal command:  cd /home/administrator/udi-system/backend && uv sync -q 2>&1 | tail -5 && uv run python -c "from app.api.labels import router; from app.api.auth import router as ar; from app.main import app; print('Backend imports OK')" 2>&1
Completed with input:  cd /home/administrator/udi-system/backend && uv sync -q 2>&1 | tail -5 && uv run python -c "from app.api.labels import router; from app.api.auth import router as ar; from app.main import app; print('Backend imports OK')" 2>&1

Continue to iterate?
[object Object]

Made changes.

User: @agent Continue: "Continue to iterate?"

GitHub Copilot: Read [](file:///home/administrator/udi-system/backend/app/api/labels.py#220-220), lines 220 to 280

The file has old content appended (the original file's remaining body after the old import section). The `replace_string_in_file` replaced only the imports/preamble. Need to truncate the old tail:     

Read [](file:///home/administrator/udi-system/backend/app/api/labels.py#230-230), lines 230 to 530

The old body is still appended. Let me check the full line count and truncate cleanly:     

Ran terminal command:  head -235 /home/administrator/udi-system/backend/app/api/labels.py > /tmp/labels_clean.py && mv /tmp/labels_clean.py /home/administrator/udi-system/backend/app/api/labels.py && echo "Done - $(wc -l < /home/administrator/udi-system/backend/app/api/labels.py) lines"

Ran terminal command:  cd /home/administrator/udi-system/backend && uv run python -c "from app.api.labels import router; from app.api.auth import router as ar; from app.main import app; print('Backend imports OK')" 2>&1

Now create the missing Alembic `env.py` file (required for migrations to work):    

Read [](file:///home/administrator/udi-system/backend/alembic)

Read [](file:///home/administrator/udi-system/backend/alembic/env.py)

Alembic env.py already exists and is correctly configured for async. Let me do a final TypeScript and backend check, then verify the end-to-end import chain:    

Ran terminal command:  cd /home/administrator/udi-system/frontend && pnpm exec tsc --noEmit 2>&1

Zero errors on both sides. Let me also verify the `api/router.py` and v1 health endpoint still work (they import from session.py):     

Ran terminal command:  cd /home/administrator/udi-system/backend && uv run python -c "
from app.api.router import api_router
from app.api.v1.health import router as health
from app.db.models import User, LabelHistory
from app.db.session import Base, engine, AsyncSessionLocal, get_db
print('All modules OK')
print('Tables:', list(Base.metadata.tables.keys()))
" 2>&1

Completed: *History detail bwip-js re-render* (9/9)

All 9 tasks complete, zero TypeScript errors, backend imports clean. Here's a summary of everything done:

---

## 完成情况

### 问题1：历史记录加载慢/超时
- **useLabelHistory.ts** → 整体重写为 TanStack Query v5 (`useQuery`)：翻页时保留上一页数据（`keepPreviousData`）、30s 本地缓存命中无网络请求、删除后 `invalidateQueries` 智能刷新不丢失过滤上下文
- **models.py** → 新增复合索引 `(user_id, created_at)` 和 `(user_id, id)`，解决大数据量分页扫描慢
- **labels.py** → 历史列表不再全列拉取（去除大字段），纯元数据查询极快

### 问题2：后端并发量低/超时
- **SQLite → PostgreSQL**：docker-compose.yml / docker-compose.prod.yml 新增 `postgres:16-alpine` 服务；彻底消除多 worker 写冲突
- **全链路异步化**：session.py 切换为 `create_async_engine` + `AsyncSession`；labels.py、auth.py、auth_service.py 所有 DB 调用改为 `await`；main.py 改用 `lifespan` context manager
- **Gunicorn + uvicorn workers**：Dockerfile 改为通过 `entrypoint.sh` 启动，在容器启动时先执行 `alembic upgrade head` 再起 Gunicorn，生产默认4 worker
- **Alembic 迁移**：`alembic/versions/0001_initial_schema.py` 含完整 schema + 所有索引；env.py 已配置异步驱动

### 问题3：前端 bwip-js 实时渲染，导出时才同步后端
- **useLabelPreviewOrchestrator.ts** → 完全重写为 `useBwipPreview`：同步调用 bwip-js，无任何网络请求，预览立即可见
- **barcode-svg.ts** → 新增 `createDataMatrixSvg()`，DataMatrix 和 GS1-128 均由前端渲染
- **useLabels.ts** → 表单提交改为纯本地 GS1 计算（`lib/gs1.ts`），立即打开预览弹窗，无后端调用
- **PreviewDialog.tsx** → 点击"PNG/SVG/PDF"下载时才调 `POST /generate` 保存到后端历史；历史查看(`kind: 'history'`)不触发保存
- **历史详情回显** → 历史记录行含 `hri` 字段，点"查看"后 bwip-js 在对话框内实时重渲染，无需额外 API 请求
- **`datamatrix_base64`/`gs1_128_base64`** 两列已从模型和 schema 中彻底移除，节省大量存储

User: 把这次更新整理成文档，供学习，记录，review及作为后续开发依据，并输出到docs文件夹

GitHub Copilot: Read [](file:///home/administrator/udi-system/Docs)

Read [](file:///home/administrator/udi-system/Docs/%E6%9B%B4%E6%96%B0%E6%97%A5%E5%BF%97v1.2.md)

Read [](file:///home/administrator/udi-system/Docs/%E6%9B%B4%E6%96%B0%E6%97%A5%E5%BF%97v1.0.md)

Read [](file:///home/administrator/udi-system/Docs/SOURCE_MAP.md)

Summarized conversation historyNow I have a clear picture of the documentation style. Let me create the v2.0 changelog covering the full POC→Production upgrade. 

Created [](file:///home/administrator/udi-system/Docs/%E6%9B%B4%E6%96%B0%E6%97%A5%E5%BF%97v2.0.md)

Optimizing tool selection...文档已创建：更新日志v2.0.md

文档结构与已有 v1.0/v1.2 风格一致，涵盖：

- **架构决策记录（ADR）**：5 项关键决策的选型理由（PostgreSQL、Gunicorn、TanStack Query、export-only 保存、GS1 同构）
- **14 个变更详情**：每项含动机、涉及文件、v1.x vs v2.0 对比
- **新增文件一览** / **删除废弃项一览**
- **v2.0 起生效的约定**（含 GS1 同构维护约定、数据库迁移约定）
- **更新版核心调用链**：4 条链路（生成预览/导出/历史查询/历史预览）均以文字流程图说明
- **部署说明** / **环境变量** / **验证记录**
- **下阶段建议（v2.1 方向）**

Made changes.

User: 我没有使用过PostgreSQL，我该如何开始并对接？

GitHub Copilot: Research PostgreSQL setup

Read [](file:///home/administrator/udi-system/docker-compose.yml)

Read [](file:///home/administrator/udi-system/docker-compose.prod.yml)

Read [](file:///home/administrator/udi-system/backend/app/core/config.py)

Read [](file:///home/administrator/udi-system/backend/app/db/session.py)

Read [](file:///home/administrator/udi-system/backend/alembic.ini)

Read [](file:///home/administrator/udi-system/backend/alembic/env.py)

Read [](file:///home/administrator/udi-system/backend/alembic/versions/0001_initial_schema.py)

Read [](file:///home/administrator/udi-system/backend/entrypoint.sh)

Read [](file:///home/administrator/udi-system/backend/requirements.txt)

Read [](file:///home/administrator/.vscode-server-insiders/data/User/workspaceStorage/06f0455b4cbaa6d7d4207da9dd908703/GitHub.copilot-chat/chat-session-resources/069d24c2-cb1a-48c5-b921-d7ed900eec29/toolu_01SouCoVvJfEzmppuqd5o8vZ__vscode-1773420321016/content.txt)

好消息：你的项目配置已经完备，不需要手动安装 PostgreSQL。以下是针对你项目的具体操作指南。

---

## 路径一：Docker Compose（推荐，最快）

你的 docker-compose.yml 里已经声明了 `postgres:16-alpine` 服务，账号密码全部预设好了。

**直接启动全栈：**
```bash
cd /home/administrator/udi-system
docker-compose up -d
```

启动后会自动：
1. 拉取 `postgres:16` 镜像并启动容器
2. 创建数据库 `gs1udi`、用户 `gs1user`
3. 后端容器运行 `alembic upgrade head` → 建表、建索引
4. 后端和前端正常启动

**验证 PostgreSQL 是否正常运行：**
```bash
docker-compose exec postgres psql -U gs1user -d gs1udi -c "\dt"
```
应该看到 `users` 和 `label_history` 两张表。

---

## 路径二：本机直接跑后端（不用 Docker）

如果你希望只用 Docker 跑 PostgreSQL，后端用 `uv run` 本地启动：

**1. 单独启动 PostgreSQL 容器（暴露 5432 端口）：**
```bash
docker-compose up -d postgres
```

**2. 修改 `DATABASE_URL` 指向本机：**

config.py 里的默认值 host 是 `postgres`（容器内网名），本机访问要改成 `localhost`：

```bash
# 启动后端时通过环境变量覆盖
cd backend
DATABASE_URL="postgresql+asyncpg://gs1user:gs1pass@localhost:5432/gs1udi" uv run alembic upgrade head
DATABASE_URL="postgresql+asyncpg://gs1user:gs1pass@localhost:5432/gs1udi" uv run uvicorn main:app --reload --port 8000
```

---

## 路径三：GUI 工具连接（便于学习/查看数据）

推荐用 **DBeaver**（免费）或 **TablePlus**（Mac/Windows）连接到本地 PostgreSQL。

连接参数：

| 字段 | 值 |
|------|----|
| Host | `localhost` |
| Port | `5432` |
| Database | `gs1udi` |
| Username | `gs1user` |
| Password | `gs1pass` |

---

## Alembic 迁移常用命令

这是你与 PostgreSQL 打交道最高频的操作：

```bash
cd backend

# 查看当前迁移状态（数据库跑到第几版）
uv run alembic current

# 执行所有未运行的迁移（升级到最新）
uv run alembic upgrade head

# 回滚最近一次迁移
uv run alembic downgrade -1

# 修改了 models.py 后，自动生成新的迁移文件
uv run alembic revision --autogenerate -m "add xxx column"
```

生成的迁移文件会出现在 versions 目录，**提交前一定要检查内容是否正确**，自动生成不总是完美的。

---

## 你需要知道的 PostgreSQL vs SQLite 差异

| 方面 | SQLite（原来） | PostgreSQL（现在） |
|------|---------------|-------------------|
| 启动方式 | 一个文件，无需服务 | 需要运行服务（或容器） |
| 并发写 | 有行级写锁，多进程容易 `database is locked` | 无此问题，支持高并发 |
| 字段类型 | 宽松（一切皆文本） | 严格，`now()` 是服务端函数 |
| JSON 支持 | 有限 | 原生 `jsonb` 类型 |
| 备份 | 拷贝文件 | `pg_dump` 命令 |
| 数据持久化（Docker） | 挂载 `.db` 文件 | 挂载 `postgres_dev_data` 命名卷 |

---

## 最简上手路径总结

```
docker-compose up -d
↓
docker-compose exec postgres psql -U gs1user -d gs1udi -c "\dt"
↓ 看到两张表 → 一切正常
↓
打开浏览器 http://localhost:3000 → 正常使用
```

如果想进入 psql 交互式终端查数据：
```bash
docker-compose exec postgres psql -U gs1user -d gs1udi
# 常用命令：
# \dt        — 列出所有表
# \d users   — 查看表结构
# SELECT * FROM label_history LIMIT 5;
# \q         — 退出
```