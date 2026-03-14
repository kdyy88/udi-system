# GS1 UDI System

GS1 UDI 标签生成系统。**当前版本：v3.1**

- 前端：Next.js 16 + shadcn/ui + TanStack Query
- 后端：FastAPI + SQLAlchemy 2.0（全链路 async）
- 数据库：PostgreSQL 16（Alembic 迁移管理）
- 条码引擎：bwip-js（浏览器端渲染，纯矢量 SVG）

---

## 项目结构

```text
udi-system/
├── backend/
│   ├── app/
│   │   ├── api/          # 路由层
│   │   ├── db/           # 数据库会话与模型
│   │   ├── schemas/      # 请求/响应模型
│   │   └── services/     # 业务逻辑（GS1、认证）
│   ├── alembic/          # 数据库迁移文件
│   └── main.py
├── frontend/
│   ├── app/              # 页面（登录、主页、批量打码、历史台账）
│   ├── components/       # UI 与业务组件（含 HistoryTabs）
│   ├── features/         # 预览、导出、保存逻辑
│   ├── hooks/            # useLabels、useLabelHistory、useBatchUpload 等
│   ├── lib/              # API 封装、GS1 工具、Excel 解析、SVG 模板
│   └── types/
├── .vscode/tasks.json    # 一键启动任务
└── docker-compose.yml
```

---

## 本地开发启动

**推荐方式：数据库用 Docker，前后端在本机直接运行。**

### 前置条件

| 工具 | 用途 |
|------|------|
| Docker | 运行 PostgreSQL |
| Python 3.12 + uv | 运行后端 |
| Node.js + pnpm | 运行前端 |

### VS Code 任务（最快）

按 `Ctrl+Shift+B`，可选择：

| 任务 | 说明 |
|------|------|
| **Dev: Start All** | 依次启动全部三个服务 |
| **DB: Start Postgres** | 仅启动 PostgreSQL 容器 |
| **Backend: Dev Server** | 安装依赖 + 跑迁移 + 启动 uvicorn |
| **Frontend: Dev Server** | 安装依赖 + 启动 Next.js |
| **DB: Stop Postgres** | 停止数据库容器 |

### 手动启动（三个终端）

**终端 1 — 数据库**
```bash
docker-compose up -d postgres
```

**终端 2 — 后端**
```bash
cd backend
uv sync
DATABASE_URL=postgresql+asyncpg://gs1user:gs1pass@localhost:5432/gs1udi uv run alembic upgrade head
DATABASE_URL=postgresql+asyncpg://gs1user:gs1pass@localhost:5432/gs1udi uv run uvicorn main:app --reload --port 8000
```

**终端 3 — 前端**
```bash
cd frontend
pnpm install && pnpm dev
```

### 访问地址

- 前端：<http://localhost:3000>
- 后端 API 文档：<http://localhost:8000/docs>

---

## 默认账号

| 账号 | 密码 |
|------|------|
| demo | demo123 |
| admin | admin123456 |

---

## 核心接口

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/api/v1/auth/login` | 登录 |
| POST | `/api/v1/labels/generate` | 生成标签并入库（导出时触发） |
| GET  | `/api/v1/labels/history` | 历史查询，支持 `gtin`、`batch_no`、cursor 分页 |
| DELETE | `/api/v1/labels/history/{id}` | 删除历史记录 |
| POST | `/api/v1/batches/generate` | 批量生成：单事务写 LabelBatch + LabelHistory（最多 500 行） |
| GET  | `/api/v1/batches` | 批次列表，游标分页 |
| GET  | `/api/v1/batches/{id}` | 批次详情 + 标签游标分页 |
| DELETE | `/api/v1/batches/{id}` | 删除批次（CASCADE 删除所有子记录） |
| GET  | `/api/v1/health` | 健康检查 |

---

## 关键设计说明

- **条码预览**：完全在浏览器端由 bwip-js 同步渲染，零网络请求，无延迟
- **后端保存时机**：仅用户点击"导出"按钮时触发 `POST /generate`，预览不入库
- **GS1 逻辑同构**：`lib/gs1.ts`（前端）与 `gs1_engine.py`（后端）保持相同实现，修改时须同步更新
- **批量导出**：纯客户端 SVG 合成（`barcode-svg.ts` → `svgTemplates.ts` → JSZip），无服务端渲染，无 DOM 依赖；上传页提供所见即所得预览（渲染路径与导出完全一致）
- **历史统一**：首页与历史台账页共享 `<HistoryTabs>` 组件，双 Tab 展示批次总览与全部明细
- **历史缓存**：TanStack Query，staleTime 30 秒，翻页不闪烁
- **数据库迁移**：新增表/列必须通过 `alembic/versions/` 迁移文件操作，不可直接改 `models.py` 后重启

---

## 注意事项

使用 `docker-compose up -d` 全量启动后，`node_modules` 和 `.venv` 会由容器以 root 创建。  
切换为本机启动前，需先删除这两个目录：

```bash
sudo rm -rf backend/.venv frontend/node_modules
```

之后再运行 VS Code 任务，依赖会以当前用户权限重新安装。

---

## 源码导读

- [Docs/SOURCE_MAP.md](Docs/SOURCE_MAP.md) — 调用链速查
- [Docs/更新日志v3.0.md](Docs/更新日志v3.0.md) — v3.0 批量打码架构与变更详情
- [Docs/更新日志v2.0.md](Docs/更新日志v2.0.md) — v2.0 架构决策与变更详情
