# 源码导读地图（GS1 UDI System）

> **最后更新：v2.0（2026-03-15）**
> 本文档反映当前架构。v1.x 的生成链路（后端 barcode_gen + base64）已废弃，请以本文档为准。

这份文档帮助你快速建立"代码全景图"：

- 先看哪里（入口）
- 每层做什么（职责）
- 一次业务请求是怎么走的（调用链）

---

## 1) 先从入口看

### 后端入口

- [backend/main.py](backend/main.py)
  - 启动 uvicorn 的脚本入口（本地开发用）。
- [backend/app/main.py](backend/app/main.py)
  - 创建 FastAPI 应用（`lifespan` 管理启动/关闭）。
  - 挂载 CORS；注册总路由。
  - 启动时运行 Alembic 建表 + 初始化默认用户。
  - 关闭时清理连接池（`engine.dispose()`）。
- [backend/entrypoint.sh](backend/entrypoint.sh)
  - 容器启动入口：先执行 `alembic upgrade head`，再启动 Gunicorn（4 workers）。

### 前端入口

- [frontend/app/layout.tsx](frontend/app/layout.tsx)
  - 全局布局；用 `<Providers>` 包裹全应用（含 TanStack Query 的 QueryClientProvider）。
- [frontend/app/providers.tsx](frontend/app/providers.tsx)
  - TanStack Query 的 `QueryClientProvider`（staleTime 30s）。
- [frontend/app/page.tsx](frontend/app/page.tsx)
  - 主业务页：表单录入 → 本地 GS1 计算 → 打开预览弹窗 → 历史列表。
- [frontend/app/(auth)/login/page.tsx](frontend/app/(auth)/login/page.tsx)
  - 登录页。

---

## 2) 后端分层地图（按职责）

### 路由层（API）

- [backend/app/api/router.py](backend/app/api/router.py)
  - 聚合所有子路由。
- [backend/app/api/auth.py](backend/app/api/auth.py)
  - 登录接口：用户名密码校验（async）。
- [backend/app/api/labels.py](backend/app/api/labels.py)
  - 生成（保存元数据）、历史查询（cursor 分页）、历史明细、删除。
  - **注意**：v2.0 起 `/preview`、`/preview-svg` 接口已删除。

### 数据模型层（DB）

- [backend/app/db/session.py](backend/app/db/session.py)
  - async engine（asyncpg / PostgreSQL）、`AsyncSessionLocal`、`get_db()` 依赖注入。
- [backend/app/db/models.py](backend/app/db/models.py)
  - 表结构：`User`、`LabelHistory`（无 base64 列，含复合索引）。
- [backend/alembic/](backend/alembic/)
  - 数据库迁移文件；`0001_initial_schema.py` 为初始全量建表。

### 数据校验层（Schema）

- [backend/app/schemas/label.py](backend/app/schemas/label.py)
  - 请求/响应模型（生成、历史分页、历史明细）。
  - v2.0 后不含任何 base64 / SVG 字段。

### 业务层（Service）

- [backend/app/services/gs1_engine.py](backend/app/services/gs1_engine.py)
  - GTIN-14 校验位、AI 拼接、FNC1、HRI。
  - **权威实现**：与前端 `lib/gs1.ts` 保持同构，修改时须同步。
- [backend/app/services/barcode_gen.py](backend/app/services/barcode_gen.py)
  - DataMatrix / GS1-128 图像生成（treepoem/Ghostscript）。
  - **v2.0 起不再被 API 层调用**；模块保留供独立工具使用。
- [backend/app/services/auth_service.py](backend/app/services/auth_service.py)
  - 密码哈希/校验、默认用户初始化（async）。

---

## 3) 前端分层地图（按职责）

### 页面层

- [frontend/app/page.tsx](frontend/app/page.tsx)
  - 表单录入 → `handlePreviewLocally`（同步）→ 打开 PreviewDialog；历史列表。
- [frontend/app/history/page.tsx](frontend/app/history/page.tsx)
  - 历史列表专页；预览即时通过 bwip-js 渲染，无网络请求。
- [frontend/app/(auth)/login/page.tsx](frontend/app/(auth)/login/page.tsx)
  - 登录流程与错误提示。

### Hook 层

- [frontend/hooks/useLabels.ts](frontend/hooks/useLabels.ts)
  - `handlePreviewLocally(formData)` — 同步构建 GS1，设置 `previewSource`，无网络请求。
- [frontend/hooks/useLabelHistory.ts](frontend/hooks/useLabelHistory.ts)
  - 基于 TanStack Query 的历史列表管理（cursor 分页、30s 缓存、删除后精确失效）。

### 组件层

- [frontend/components/labels/PreviewDialog.tsx](frontend/components/labels/PreviewDialog.tsx)
  - 用 `useBwipPreview` 同步渲染条码；导出时调用 `saveLabelToBackend`。
  - `kind === "local"`：导出才保存后端；`kind === "history"`：只预览不重复保存。
- [frontend/components/shared/DataTable.tsx](frontend/components/shared/DataTable.tsx)
  - 历史表格与翻页按钮（cursor 分页，hasPrev / hasNext 控制）。
- [frontend/components/labels/PreviewTemplateCanvas.tsx](frontend/components/labels/PreviewTemplateCanvas.tsx)
  - 预览模板画布渲染（紧凑/双码/明细），渲染入参为 SVG 字符串。
- [frontend/components/ui](frontend/components/ui)
  - 基础 UI 组件（Button/Input/Dialog/DatePicker/Toaster）。

### Feature 层（`features/labels/preview/`）

- [frontend/features/labels/preview/useLabelPreviewOrchestrator.ts](frontend/features/labels/preview/useLabelPreviewOrchestrator.ts)
  - `useBwipPreview(hri)` — 同步 `useMemo`，调用 bwip-js 生成 4 路 SVG，含错误捕获。
- [frontend/features/labels/preview/barcode-svg.ts](frontend/features/labels/preview/barcode-svg.ts)
  - `createDataMatrixSvg(hri)` / `createNormalizedGs1Svg(hri)` — bwip-js 包装函数。
- [frontend/features/labels/preview/save.ts](frontend/features/labels/preview/save.ts)
  - `saveLabelToBackend(preview, userId)` — 调用 `POST /generate`，唯一的后端写入触发点。
- [frontend/features/labels/preview/export.ts](frontend/features/labels/preview/export.ts)
  - `exportPreviewNode(node, template, format)` — PNG / SVG / PDF 下载。

### 配置与工具层

- [frontend/lib/gs1.ts](frontend/lib/gs1.ts)
  - 前端 GS1 同构工具库（镜像 `gs1_engine.py`）。
  - 含 `validateGtin14()`、`buildHri()`、`buildGs1ElementString()`、`calculateGs1CheckDigit()`。
  - **修改时须同步更新后端 `gs1_engine.py`**。
- [frontend/lib/api.ts](frontend/lib/api.ts)
  - Axios 实例。
- [frontend/lib/auth.ts](frontend/lib/auth.ts)
  - 登录态存取（localStorage）。
- [frontend/lib/preview-templates.ts](frontend/lib/preview-templates.ts)
  - 模板元配置（独立配置）。
- [frontend/types/udi.ts](frontend/types/udi.ts)
  - 前端类型定义（`PreviewSource`、`LocalPreviewData`、`LabelSaveResponse` 等）。

---

## 4) 核心调用链（四条）

### A. 登录链路

```
前端 login/page.tsx
  → POST /api/v1/auth/login
  → backend/api/auth.py → auth_service.py（校验密码）
  → 返回 user_id，写入 lib/auth.ts（localStorage）
```

### B. 生成 + 预览链路（无网络，同步）

```
用户填写 DI/PI → LabelForm.onSubmit()
  → useLabels.handlePreviewLocally(formData)        [同步]
      → lib/gs1.ts  buildHri() + buildGs1ElementString()
      → setPreviewSource({ kind: "local", data: LocalPreviewData })
  → PreviewDialog 弹出
  → useBwipPreview(hri)                              [同步, bwip-js]
      → createDataMatrixSvg() + createNormalizedGs1Svg()
  → PreviewTemplateCanvas 渲染 SVG
```

### C. 导出（唯一触发后端写入的时机）

```
用户点击"导出 PNG/SVG/PDF"
  → PreviewDialog.handleDownload(format)
  → if (previewSource.kind === "local")
      → save.ts: saveLabelToBackend(data, userId)   [POST /api/v1/labels/generate]
          → backend labels.py: 仅保存元数据，无条码渲染
      → onSaved?.() → useLabelHistory.invalidateHistory()
  → export.ts: exportPreviewNode(node, template, format)
```

### D. 历史查询链路（cursor 分页 + 缓存）

```
进入页面 / 翻页 / 筛选
  → useLabelHistory useQuery
      queryKey: ["label-history", userId, cursor, gtin, batchNo]
      → 缓存未过期 (staleTime 30s)：直接返回，0 网络请求
      → 否则：GET /api/v1/labels/history?cursor=...
          → backend: WHERE user_id=? [AND id < cursor] ORDER BY id DESC LIMIT N
          → 返回 items + next_cursor（null 表示末页）
  → DataTable 渲染；翻页时 keepPreviousData 防白屏

用户点击"查看"
  → setPreviewSource({ kind: "history", data: LabelHistoryItem })  [同步]
  → PreviewDialog 弹出 → useBwipPreview(item.hri)  [同步, bwip-js]
  → 立即渲染，无 loading
```

---

## 5) 新手阅读顺序（建议按这个来）

1. 看后端入口：
   - [backend/app/main.py](backend/app/main.py)
2. 看核心 GS1 算法（前后端均有）：
   - [backend/app/services/gs1_engine.py](backend/app/services/gs1_engine.py)
   - [frontend/lib/gs1.ts](frontend/lib/gs1.ts)
3. 看后端接口：
   - [backend/app/api/labels.py](backend/app/api/labels.py)
4. 看前端预览渲染：
   - [frontend/features/labels/preview/useLabelPreviewOrchestrator.ts](frontend/features/labels/preview/useLabelPreviewOrchestrator.ts)
   - [frontend/features/labels/preview/barcode-svg.ts](frontend/features/labels/preview/barcode-svg.ts)
5. 看前端模板系统：
   - [frontend/lib/preview-templates.ts](frontend/lib/preview-templates.ts)
   - [frontend/components/labels/PreviewTemplateCanvas.tsx](frontend/components/labels/PreviewTemplateCanvas.tsx)

---

## 6) 你改需求时，通常改哪里

| 需求 | 改这里 |
|------|--------|
| 改 GS1 规则（AI、FNC1、校验逻辑） | `backend/app/services/gs1_engine.py` **+** `frontend/lib/gs1.ts`（须同步） |
| 改标签模板样式 | `frontend/lib/preview-templates.ts` + `PreviewTemplateCanvas.tsx` |
| 改导出格式逻辑（PNG/SVG/PDF） | `frontend/features/labels/preview/export.ts` |
| 改历史筛选条件 | `backend/app/api/labels.py` + `frontend/hooks/useLabelHistory.ts` |
| 改数据库表结构 | `backend/app/db/models.py` **+** 新增 Alembic 迁移文件（不可跳过迁移） |
| 改默认用户 / 认证逻辑 | `backend/app/services/auth_service.py` |

---

## 7) 一句话记忆

这个项目的核心就是：

登录 → 输入 DI/PI → **前端** GS1 计算 + bwip-js 渲染 → 用户导出时保存元数据到后端 → PostgreSQL 持久化 → cursor 分页查询历史 → 前端重渲染预览。
