# 源码导读地图（GS1 UDI System）

> **最后更新：v3.1（2026-03-14）**
> 本文档反映当前架构。v1.x 的生成链路（后端 barcode_gen + base64）已废弃，v2.x 无批量功能，v3.0 引入批量打码，v3.1 精简组件结构，请以本文档为准。

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
  - 全局布局；挂载 `<Navbar>`（所有页面共享导航栏）；用 `<Providers>` 包裹全应用。
- [frontend/app/providers.tsx](frontend/app/providers.tsx)
  - TanStack Query 的 `QueryClientProvider`（staleTime 30s）。
- [frontend/app/page.tsx](frontend/app/page.tsx)
  - 主业务页：表单录入 → 本地 GS1 计算 → 打开预览弹窗 → `<HistoryTabs>`（批次总览 + 全部明细）。
- [frontend/app/batch/page.tsx](frontend/app/batch/page.tsx)
  - 批量打码页：Excel 上传 → 解析预览 → 模板选取 → 所见即所得样式预览 → 保存后端 → SVG ZIP 下载（6 阶段状态机）。
- [frontend/app/history/page.tsx](frontend/app/history/page.tsx)
  - 历史台账页：页头 + `<HistoryTabs>`，与首页共享同一组件。
- [frontend/app/history/batch/[id]/page.tsx](frontend/app/history/batch/[id]/page.tsx)
  - 批次详情页：分页展示批次内所有标签 + "重新下载 ZIP" 按钮。
- [frontend/app/(auth)/login/page.tsx](frontend/app/(auth)/login/page.tsx)
  - 登录页。

---

## 2) 后端分层地图（按职责）

### 路由层（API）

- [backend/app/api/router.py](backend/app/api/router.py)
  - 聚合所有子路由（auth / labels / batches）。
- [backend/app/api/auth.py](backend/app/api/auth.py)
  - 登录接口：用户名密码校验（async）。
- [backend/app/api/labels.py](backend/app/api/labels.py)
  - 生成（保存元数据，同时自动创建 `source="form"` 的单条 LabelBatch）、历史查询（cursor 分页）、历史明细、删除。
- [backend/app/api/batches.py](backend/app/api/batches.py)
  - 批量接口：`POST /generate`（单事务建批+批量写 label_history）、`GET /batches`（游标分页列表）、`GET /batches/{id}`（详情+标签分页）、`DELETE /batches/{id}`（级联删除）。

### 数据模型层（DB）

- [backend/app/db/session.py](backend/app/db/session.py)
  - async engine（asyncpg / PostgreSQL）、`AsyncSessionLocal`、`get_db()` 依赖注入。
- [backend/app/db/models.py](backend/app/db/models.py)
  - 表结构：`User`、`LabelBatch`（批次主表）、`LabelHistory`（含 `batch_id` FK + CASCADE）。
- [backend/alembic/](backend/alembic/)
  - 数据库迁移文件；`0001_initial_schema.py` 初始全量建表；`0002_add_label_batch.py` 新增 `label_batch` 表与 `label_history.batch_id` 列。

### 数据校验层（Schema）

- [backend/app/schemas/label.py](backend/app/schemas/label.py)
  - 请求/响应模型（生成、历史分页、历史明细）。
  - `LabelHistoryResponse` 含 `batch_id` 可空字段。
- [backend/app/schemas/batch.py](backend/app/schemas/batch.py)
  - 批量接口的请求/响应模型：`BatchCreateRequest`（最多 500 行）、`BatchCreateResponse`、`LabelBatchSummary`、`LabelBatchListResponse`、`LabelBatchDetailResponse`。

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
  - 表单录入 → `handlePreviewLocally`（同步）→ 打开 PreviewDialog；`<HistoryTabs>` 双 Tab 历史区。
- [frontend/app/batch/page.tsx](frontend/app/batch/page.tsx)
  - 批量打码页面：拖拽上传 Excel → 解析预览 → 模板选择 → 所见即所得样式预览（`SampleLabelPreview`，与导出 SVG 同一渲染路径）→ 保存并生成 SVG ZIP。
- [frontend/app/history/page.tsx](frontend/app/history/page.tsx)
  - 历史台账：页头 + `<HistoryTabs>`（精简薄包装，约 50 行）。
- [frontend/app/history/batch/[id]/page.tsx](frontend/app/history/batch/[id]/page.tsx)
  - 批次详情页：展示元信息 + 分页标签列表 + 重新下载 ZIP 按鈕。
- [frontend/app/(auth)/login/page.tsx](frontend/app/(auth)/login/page.tsx)
  - 登录流程与错误提示。

### Hook 层

- [frontend/hooks/useLabels.ts](frontend/hooks/useLabels.ts)
  - `handlePreviewLocally(formData)` — 同步构建 GS1，设置 `previewSource`，无网络请求。
- [frontend/hooks/useLabelHistory.ts](frontend/hooks/useLabelHistory.ts)
  - 基于 TanStack Query 的历史列表管理（cursor 分页、30s 缓存、删除后精确失效）。
- [frontend/hooks/useLabelBatches.ts](frontend/hooks/useLabelBatches.ts)
  - 基于 TanStack Query 的批次列表管理（cursor 分页）；供历史页“批次总览” Tab 使用。
- [frontend/hooks/useBatchUpload.ts](frontend/hooks/useBatchUpload.ts)
  - 批量上传状态机（6 阶段）：`idle → parsing → validated → saving → generating → done | error`。
  - 调用 `parseExcelFile` 解析、`api.post` 保存、`exportBatchToZip` 生成 SVG ZIP。

### 组件层
- [frontend/components/shared/Navbar.tsx](frontend/components/shared/Navbar.tsx)
  - 全局导航栏（标签生成 / 批量打码 / 历史台账）；挂载于 `layout.tsx`。
- [frontend/components/labels/HistoryTabs.tsx](frontend/components/labels/HistoryTabs.tsx)
  - 自包含双 Tab 历史组件：批次总览（`BatchListTable` + `useLabelBatches`）| 全部明细（`DataTable` + `useLabelHistory` + 筛选）。
  - 内含 `PreviewDialog`；同时挂载于首页（表单下方）和历史台账页，两处完全一致。
- [frontend/components/labels/LabelForm.tsx](frontend/components/labels/LabelForm.tsx)
  - 标签录入表单；提交行含"批量上传"快跳链接（`href="/batch"`）与"生成"按钮并排。
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
- [frontend/lib/excelParser.ts](frontend/lib/excelParser.ts)
  - SheetJS 解析 Excel 文件；自动检测表头（中英文均可）；每行客户端校验 GTIN-14 Mod-10；最多 500 行。
- [frontend/lib/svgTemplates.ts](frontend/lib/svgTemplates.ts)
  - 纯 SVG 字符串模板函数（`renderCompactSvg` / `renderDualSvg` / `renderDetailSvg`）。
  - 无任何 DOM/React 依赖；布局与 `PreviewTemplateCanvas.tsx` 保持一致。
- [frontend/lib/batchExporter.ts](frontend/lib/batchExporter.ts)
  - 批量导出函数 `exportBatchToZip`：`barcode-svg.ts` → `svgTemplates.ts` → JSZip（纯矢量 SVG）。
  - `fetchAllBatchLabels`：分页拉取批次内所有标签记录。
- [frontend/lib/api.ts](frontend/lib/api.ts)
  - Axios 实例。
- [frontend/lib/auth.ts](frontend/lib/auth.ts)
  - 登录态存取（localStorage）。
- [frontend/lib/preview-templates.ts](frontend/lib/preview-templates.ts)
  - 模板元配置；`TemplateKey = "compact" | "dual" | "detail"`。
- [frontend/features/labels/api/routes.ts](frontend/features/labels/api/routes.ts)
  - API 路径常量：`LABELS_API_ROUTES` + `BATCHES_API_ROUTES`。
- [frontend/types/udi.ts](frontend/types/udi.ts)
  - 前端类型定义（`LabelHistoryItem` 含 `batch_id` 可空字段）。
- [frontend/types/batch.ts](frontend/types/batch.ts)
  - 批量相关类型：`BatchTemplate`（即 `TemplateKey` 别名）、`ParsedRow`、`BatchPhase`、`LabelBatchSummary` 等。

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

### E. 批量打码链路

```
用户拖拽 / 选择 Excel 文件
  → useBatchUpload.handleFileSelect(file)
      → lib/excelParser.ts: parseExcelFile()            [客户端, SheetJS]
          → 检测表头 → 逐行读取 → GTIN-14 Mod-10 校验
          → 返回 ParsedRow[]（含 validationError 字段）
      → phase: "validated"（展示预览表格）

用户点击"保存并生成"
  → useBatchUpload.startGenerate(template)
      → POST /api/v1/batches/generate                   [单事务]
          → batches.py: 创建 LabelBatch + 批量写 LabelHistory
              → gs1_engine.py 权威重算 HRI（不信任客户端）
      → lib/batchExporter.ts: exportBatchToZip()        [客户端, 纯 SVG]
          → fetchAllBatchLabels() 分页拉取权威 HRI
          → 逐条: barcode-svg.ts 生成 3 路 SVG 条码
                  → svgTemplates.ts 拼合标签 SVG
          → JSZip 打包 → file-saver 下载 .zip
      → phase: "done"
```

### F. 批次历史查询链路

```
历史页"批次总览" Tab
  → useLabelBatches useQuery
      → GET /api/v1/batches?user_id=...&cursor=...
      → 展示 BatchListTable（游标分页）
  → 点击"详情" → 跳转 /history/batch/{id}

批次详情页
  → GET /api/v1/batches/{id}?user_id=...
  → 展示分页标签表格
  → 点击"重新下载 ZIP" → exportBatchToZip()  [同批量打码链路 E]
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
6. 看批量打码（v3.0 新增）：
   - [frontend/lib/excelParser.ts](frontend/lib/excelParser.ts)
   - [frontend/lib/svgTemplates.ts](frontend/lib/svgTemplates.ts)
   - [frontend/lib/batchExporter.ts](frontend/lib/batchExporter.ts)
   - [backend/app/api/batches.py](backend/app/api/batches.py)

---

## 6) 你改需求时，通常改哪里

| 需求 | 改这里 |
|------|--------|
| 改 GS1 规则（AI、FNC1、校验逻辑） | `backend/app/services/gs1_engine.py` **+** `frontend/lib/gs1.ts`（须同步） |
| 改标签模板样式（单标签预览） | `frontend/lib/preview-templates.ts` + `PreviewTemplateCanvas.tsx` |
| 改批量导出 SVG 布局 | `frontend/lib/svgTemplates.ts`（**同时**对齐 `PreviewTemplateCanvas.tsx`） |
| 改导出格式逻辑（PNG/SVG/PDF） | `frontend/features/labels/preview/export.ts` |
| 改批量上传 Excel 解析规则 | `frontend/lib/excelParser.ts` |
| 改历史筛选条件 | `backend/app/api/labels.py` + `frontend/hooks/useLabelHistory.ts` |
| 改历史页双 Tab 展示 / 批次列表样式 | `frontend/components/labels/HistoryTabs.tsx` |
| 改批次相关 API | `backend/app/api/batches.py` + `backend/app/schemas/batch.py` |
| 改数据库表结构 | `backend/app/db/models.py` **+** 新增 Alembic 迁移文件（不可跳过迁移） |
| 改默认用户 / 认证逻辑 | `backend/app/services/auth_service.py` |

---

## 7) 一句话记忆

这个项目的核心就是：

**单标签**：登录 → 输入 DI/PI → **前端** GS1 计算 + bwip-js 渲染 → 用户导出时保存元数据到后端 → PostgreSQL 持久化 → cursor 分页查询历史 → 前端重渲染预览。

**批量打码**：上传 Excel → 客户端 Mod-10 校验 → 单事务写 LabelBatch + LabelHistory（后端权威重算 HRI）→ 客户端 bwip-js + svgTemplates 纯 SVG 合图 → JSZip 打包下载 → 批次历史台账。
