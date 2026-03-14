# 源码导读地图（GS1 UDI System）

> **最后更新：v3.6（2026-03-14）**
> 本文档反映当前架构。v1.x 的生成链路（后端 barcode_gen + base64）已废弃，v2.x 无批量功能，v3.0 引入批量打码，v3.1 精简组件结构，v3.5 引入可视化模板编辑器（拖拽画布 + 模板库），v3.6 补全模板管理页、单标签模板预览、GS1-128 6:1 比例约束、管理员直接编辑系统模板及若干 Bug 修复，请以本文档为准。

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
  - 批量打码页：Excel 上传 → 解析预览 → **从模板库选取自定义模板**（`TemplateGallery mode="select"`）→ 所见即所得样式预览 → 保存后端 → SVG ZIP 下载（6 阶段状态机）。
- [frontend/app/history/page.tsx](frontend/app/history/page.tsx)
  - 历史台账页：页头 + `<HistoryTabs>`，与首页共享同一组件。
- [frontend/app/history/batch/[id]/page.tsx](frontend/app/history/batch/[id]/page.tsx)
  - 批次详情页：分页展示批次内所有标签 + "重新下载 ZIP" 按钮。
- [frontend/app/(auth)/login/page.tsx](frontend/app/(auth)/login/page.tsx)
  - 登录页。
- [frontend/app/editor/page.tsx](frontend/app/editor/page.tsx)（v3.5 新增，v3.6 扩展）
  - 新建模板编辑器（`/editor`），zoom 滑块（0.3–2.0）。
  - v3.6：支持 `?seed=sys-xxx` 预加载系统模板画布。管理员访问时进入直接编辑模式，顶栏呈现“更新系统模板”（主） + “另存为个人模板”（次）双按钒。
- [frontend/app/editor/[id]/page.tsx](frontend/app/editor/[id]/page.tsx)（v3.5 新增）
  - 编辑已有模板（`/editor/[id]`）：从 API 加载画布数据；保存调用 `useUpdateTemplate`。
- [frontend/app/templates/page.tsx](frontend/app/templates/page.tsx)（v3.6 新增）
  - 模板管理页（`/templates`）：`TemplateGallery mode="manage"`；传入 `isAdmin={isAdmin(authUser)}`。

---

## 2) 后端分层地图（按职责）

### 路由层（API）

- [backend/app/api/router.py](backend/app/api/router.py)
  - 聚合所有子路由（auth / labels / batches / templates）。
- [backend/app/api/auth.py](backend/app/api/auth.py)
  - 登录接口：用户名密码校验（async）；响应包含 `role` 字段。
- [backend/app/api/system.py](backend/app/api/system.py)（v3.6 新增）
  - 系统配置端点（`/system` 前缀）：
    - `GET/PUT /system/hidden-templates`：读取/更新被隐藏的系统模板 ID 列表。
    - `GET /system/template-overrides`：公开，返回所有画布覆写映射。
    - `PUT/DELETE /system/template-override/{sys_id}`：管理员保存覆写 / 恢复出厂默认。
  - 所有写操作校验 `User.role == "admin"`（非管理员 → 403）。
- [backend/app/api/labels.py](backend/app/api/labels.py)
  - 生成（保存元数据，同时自动创建 `source="form"` 的单条 LabelBatch）、历史查询（cursor 分页）、历史明细、删除。
- [backend/app/api/batches.py](backend/app/api/batches.py)
  - 批量接口：`POST /generate`（单事务建批+批量写 label_history）、`GET /batches`（游标分页列表）、`GET /batches/{id}`（详情+标签分页）、`DELETE /batches/{id}`（级联删除）。
- [backend/app/api/templates.py](backend/app/api/templates.py)（v3.5 新增）
  - 模板 CRUD：`GET/POST /api/v1/templates?user_id=…`、`GET/PUT/DELETE /api/v1/templates/{id}?user_id=…`。
  - 所有操作通过 `user_id` query 参数校验归属（非本人 → 403）。

### 数据模型层（DB）

- [backend/app/db/session.py](backend/app/db/session.py)
  - async engine（asyncpg / PostgreSQL）、`AsyncSessionLocal`、`get_db()` 依赖注入。
- [backend/app/db/models.py](backend/app/db/models.py)
  - 表结构：`User`（含 `role` 列）、`LabelBatch`、`LabelHistory`（含 `batch_id` FK + CASCADE）、`LabelTemplate`（v3.5，含 `canvas_json JSONB`）、`SystemConfig`（v3.6，`key VARCHAR(100) UNIQUE` + `value JSONB`）。
- [backend/alembic/](backend/alembic/)
  - `0001` 初始全量建表；`0002` 新增 `label_batch`；`0003` 创建 `label_template`（v3.5）；`0004` 创建 `system_config` 并种入初始行（v3.6）。

### 数据校验层（Schema）

- [backend/app/schemas/label.py](backend/app/schemas/label.py)
  - 请求/响应模型（生成、历史分页、历史明细）。
  - `LabelHistoryResponse` 含 `batch_id` 可空字段。
- [backend/app/schemas/batch.py](backend/app/schemas/batch.py)
  - 批量接口的请求/响应模型：`BatchCreateRequest`（最多 500 行）、`BatchCreateResponse`、`LabelBatchSummary`、`LabelBatchListResponse`、`LabelBatchDetailResponse`。
- [backend/app/schemas/template.py](backend/app/schemas/template.py)（v3.5 新增）
  - `TemplateCreate`、`TemplateUpdate`、`TemplateRead`、`TemplateListResponse`。

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
  - 调用 `parseExcelFile` 解析、`api.post` 保存、`exportBatchToZip` 生成 SVG ZIP。- [frontend/hooks/useLabelTemplates.ts](frontend/hooks/useLabelTemplates.ts)（v3.5 新增）
  - 基于 TanStack Query 的模板 CRUD：`useListTemplates`、`useGetTemplate`、`useCreateTemplate`、`useUpdateTemplate`、`useDeleteTemplate`。
- [frontend/hooks/useHiddenSystemTemplates.ts](frontend/hooks/useHiddenSystemTemplates.ts)（v3.6 新增）
  - `useHiddenSystemTemplates()` 查询隐藏列表；`useSetHiddenSystemTemplates(userId)` Mutation。
- [frontend/hooks/useSystemTemplateOverrides.ts](frontend/hooks/useSystemTemplateOverrides.ts)（v3.6 新增）
  - `useSystemTemplateOverrides()` 查询画布覆写；`useSaveSystemTemplateOverride(userId)` / `useDeleteSystemTemplateOverride(userId)` Mutation。
### 组件层
- [frontend/components/shared/Navbar.tsx](frontend/components/shared/Navbar.tsx)
  - 全局导航栏（标签生成 / 批量打码 / 历史台账 / 模板编辑器）；挂载于 `layout.tsx`。
- [frontend/components/labels/HistoryTabs.tsx](frontend/components/labels/HistoryTabs.tsx)
  - 自包含双 Tab 历史组件：批次总览（`BatchListTable` + `useLabelBatches`）| 全部明细（`DataTable` + `useLabelHistory` + 筛选）。
  - 内含 `PreviewDialog`；同时挂载于首页（表单下方）和历史台账页，两处完全一致。
- [frontend/components/labels/LabelForm.tsx](frontend/components/labels/LabelForm.tsx)
  - 标签录入表单；提交行含"批量上传"快跳链接（`href="/batch"`）与"生成"按钮并排。
- [frontend/components/labels/PreviewDialog.tsx](frontend/components/labels/PreviewDialog.tsx)
  - 用 `useBwipPreview` 同步渲染条码；导出时调用 `saveLabelToBackend`。
  - `kind === "local"`：导出才保存后端；`kind === "history"`：只预览不重复保存。
  - v3.6：模板下拉选择器，选中模板时调用 `renderCustomSvg` 实时渲染；SVG 格式直接下载原始字符串。使用 `effectiveSystemTemplates`（`applyOverrides()` 合并）确保和管理员修改保持一致。
- [frontend/components/shared/DataTable.tsx](frontend/components/shared/DataTable.tsx)
  - 历史表格与翻页按钮（cursor 分页，hasPrev / hasNext 控制）。
- [frontend/components/labels/PreviewTemplateCanvas.tsx](frontend/components/labels/PreviewTemplateCanvas.tsx)
  - 标签预览画布（v3.5 简化：移除旧模板 key，固定 DataMatrix + AI 文字布局，props 为 `{ preview, expiryDisplay }`）。
- [frontend/components/editor/Canvas.tsx](frontend/components/editor/Canvas.tsx)（v3.5 新增）
  - react-rnd 拖拽缩放白板；外层 CSS `transform:scale(zoom)` 缩放，内层 `widthPx×heightPx`；`BarcodeElement` 仅渲染占位 div（编辑器路径不调用 bwip-js）。
- [frontend/components/editor/ElementToolbar.tsx](frontend/components/editor/ElementToolbar.tsx)（v3.5 新增）
  - 左侧边栏：画布尺寸 mm 输入、添加元素按钮、撤销/重做/删除。
- [frontend/components/editor/PropertiesPanel.tsx](frontend/components/editor/PropertiesPanel.tsx)（v3.5 新增）
  - 右侧属性面板：位置/尺寸（mm 显示）、类型专属属性面板、GS1 AI 字段绑定下拉选择器。
- [frontend/components/editor/TemplateGallery.tsx](frontend/components/editor/TemplateGallery.tsx)（v3.5 新增，v3.6 重写）
  - 模板卡片网格；`mode="manage"` 显示编辑/删除操作；`mode="select"` 调用 `onSelect(definition, id)` 回调。
  - v3.6 重写：两分区（系统默认 / 我的模板）；`isAdmin` prop 控制管理员按钒（编辑/恢复出厂/隐藏切换）；`applyOverrides()` 展现最新系统模板。
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

### 状态管理层（v3.5 新增）

- [frontend/stores/canvasStore.ts](frontend/stores/canvasStore.ts)（v3.5 新增，v3.6 扩展）
  - Zustand + zundo temporal 中间件；`partialize` 仅追踪 `elements/widthPx/heightPx`；undo/redo 上限 50 步。
  - `updateElement(id, patch: Record<string, unknown>)`；工厂函数 `makeBarcode` / `makeText` / `makeRect`。
  - v3.6 扩展：`GS1_128_ASPECT_RATIO = 6`、`DATAMATRIX_ASPECT_RATIO = 1`、`barcodeAspectRatio(type)` 统一辅助函数；`makeBarcode` 对 GS1-128 默认 240×40px。

### 配置与工具层

- [frontend/lib/gs1.ts](frontend/lib/gs1.ts)
  - 前端 GS1 同构工具库（镜像 `gs1_engine.py`）。
  - 含 `validateGtin14()`、`buildHri()`、`buildGs1ElementString()`、`calculateGs1CheckDigit()`。
  - **修改时须同步更新后端 `gs1_engine.py`**。
- [frontend/lib/gs1Utils.ts](frontend/lib/gs1Utils.ts)（v3.5 新增）
  - GS1 AI 字符串工具：`findAiText(hri, ai)`、`findAiValue(hri, ai)`、`escapeXml(s)`。
  - 被 `svgTemplates.ts`、`batchExporter.ts`、`PreviewTemplateCanvas.tsx` 等共同引用。
- [frontend/lib/excelParser.ts](frontend/lib/excelParser.ts)
  - SheetJS 解析 Excel 文件；自动检测表头（中英文均可）；每行客户端校验 GTIN-14 Mod-10；最多 500 行。
- [frontend/lib/svgTemplates.ts](frontend/lib/svgTemplates.ts)（v3.5 重写，v3.6 修复）
  - 旧三函数（`renderCompactSvg` / `renderDualSvg` / `renderDetailSvg`）已删除。
  - 新导出 `renderCustomSvg(input, canvas: CanvasDefinition): string`：遍历 `canvas.elements`，按类型分发渲染（barcode → bwip-js SVG；text → 解析 fieldBinding 填入 AI 值；rect → `<rect>`）。
  - v3.6 修复：`embedSvg` 改用嵌套 `<svg>` + `preserveAspectRatio="none"`，条码完全填满元素框，不留白边。
- [frontend/lib/batchExporter.ts](frontend/lib/batchExporter.ts)
  - 批量导出 `exportBatchToZip(options: BatchExportOptions)`：`templateDefinition: CanvasDefinition` 替代旧 `template: TemplateKey`。
  - `fetchAllBatchLabels`：分页拉取批次内所有标签记录。
- [frontend/lib/api.ts](frontend/lib/api.ts)
  - Axios 实例。
- [frontend/lib/auth.ts](frontend/lib/auth.ts)
  - 登录态存取（localStorage）；`AuthUser` 含 `role: string`；`isAdmin(user)` 工具函数。
- [frontend/lib/systemTemplates.ts](frontend/lib/systemTemplates.ts)（v3.6 新增）
  - 三套硬编码出厂系统模板（紧凑型/标准型/双码型），ID 前缀 `"sys-"`。
  - `applyOverrides(overrides)`：将 DB 覆写合并至硬编码默认，返回新数组，不改变原始常量。
  - 被 `TemplateGallery`、`PreviewDialog`、`editor/page.tsx` 共同引用。
- [frontend/lib/preview-templates.ts](frontend/lib/preview-templates.ts)（v3.5 废弃为空壳）
  - 已缩减为 `export type TemplateKey = never;`，仅保留兼容性存根，勿再引用。
- [frontend/features/labels/api/routes.ts](frontend/features/labels/api/routes.ts)
  - API 路径常量：`LABELS_API_ROUTES` + `BATCHES_API_ROUTES` + `TEMPLATE_ROUTES`（v3.5 新增）。
- [frontend/types/udi.ts](frontend/types/udi.ts)
  - 前端类型定义（`LabelHistoryItem` 含 `batch_id` 可空字段）。
- [frontend/types/batch.ts](frontend/types/batch.ts)
  - 批量相关类型：`BatchTemplate = CanvasDefinition`（v3.5 起，不再是 `TemplateKey` 字符串别名）、`ParsedRow`、`BatchPhase`、`LabelBatchSummary` 等。
- [frontend/types/template.ts](frontend/types/template.ts)（v3.5 新增）
  - 模板类型系统单一真实来源：`GS1AiField`、`BarcodeElement`、`TextElement`、`RectElement`、`CanvasElement`（判别联合）、`CanvasDefinition`、`LabelTemplateRecord`。
  - 常量 `MM_TO_PX = 3.7795275591` 及 `mmToPx` / `pxToMm` / `recordToDefinition` 工具函数。

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

### G. 模板编辑器链路（v3.5 新增）

```
新建模板 → /editor
  → ElementToolbar：添加元素 → canvasStore.addElement()
               画布尺寸 mm 输入 → canvasStore.setDimensions()
               撤销/重做       → canvasStore.temporal.undo()/.redo()
  → Canvas（react-rnd）：
      拖拽结束 → onDragStop  → canvasStore.updateElement(id, {x, y})
      缩放结束 → onResizeStop → canvasStore.updateElement(id, {w, h, x, y})
  → PropertiesPanel：字段绑定下拉 → canvasStore.updateElement(id, {fieldBinding: ai})
  → 用户点击"保存"
      → useCreateTemplate.mutate({ name, canvas_json: elements, canvas_width_px, canvas_height_px })
          → POST /api/v1/templates?user_id=...
          → 成功 → router.push("/editor/{id}")

编辑模板 → /editor/[id]
  → useGetTemplate(id, userId) → GET /api/v1/templates/{id}?user_id=...
  → recordToDefinition(tmpl) → canvasStore.loadCanvas(def)
  → 编辑流程同上
  → 保存 → useUpdateTemplate.mutate({ id, ... }) → PUT /api/v1/templates/{id}?user_id=...

批量打码页选模板 → TemplateGallery mode="select"
  → useListTemplates(userId) → GET /api/v1/templates?user_id=...
  → 点击卡片 → onSelect(recordToDefinition(record), record)
      → setSelectedTemplate(def: CanvasDefinition)
  → 用户点击"保存并生成" → startGenerate(selectedTemplate)
      → exportBatchToZip({ templateDefinition: def, ... })
          → 逐条: renderCustomSvg(labelInput, def)  [svgTemplates.ts]
          → JSZip 打包 → file-saver 下载 .zip
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
5. 看前端模板类型系统（v3.5 新增）：
   - [frontend/types/template.ts](frontend/types/template.ts)
   - [frontend/stores/canvasStore.ts](frontend/stores/canvasStore.ts)
   - [frontend/components/editor/Canvas.tsx](frontend/components/editor/Canvas.tsx)
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
| 改单标签预览布局 | `frontend/components/labels/PreviewTemplateCanvas.tsx` |
| 改批量导出 SVG 渲染逻辑 | `frontend/lib/svgTemplates.ts`（`renderCustomSvg`） |
| 改导出格式逻辑（PNG/SVG/PDF） | `frontend/features/labels/preview/export.ts` |
| 改批量上传 Excel 解析规则 | `frontend/lib/excelParser.ts` |
| 改历史筛选条件 | `backend/app/api/labels.py` + `frontend/hooks/useLabelHistory.ts` |
| 改历史页双 Tab 展示 / 批次列表样式 | `frontend/components/labels/HistoryTabs.tsx` |
| 改批次相关 API | `backend/app/api/batches.py` + `backend/app/schemas/batch.py` |
| 改数据库表结构 | `backend/app/db/models.py` **+** 新增 Alembic 迁移文件（不可跳过迁移）<br>执行迁移：`cd backend && DATABASE_URL="postgresql+asyncpg://gs1user:gs1pass@localhost:5432/gs1udi" .venv/bin/alembic upgrade head` |
| 改默认用户 / 认证逻辑 | `backend/app/services/auth_service.py` |
| 改模板编辑器画布行为（拖拽/缩放/缩放比） | `frontend/stores/canvasStore.ts` + `frontend/components/editor/Canvas.tsx` |
| 改模板编辑器属性面板 / 字段绑定选项 | `frontend/components/editor/PropertiesPanel.tsx` |
| 改模板元素类型定义 | `frontend/types/template.ts`（**同时**更新 `canvasStore.ts` 工厂函数） |
| 改模板后端接口 | `backend/app/api/templates.py` + `backend/app/schemas/template.py` |
| 改系统配置（隐藏模板 / 画布覆写） | `backend/app/api/system.py` |
| 改系统模板出厂默认画布 | `frontend/lib/systemTemplates.ts` |
| 改 GS1 AI 字符串解析工具 | `frontend/lib/gs1Utils.ts` |

---

## 7) 一句话记忆

这个项目的核心就是：

**单标签**：登录 → 输入 DI/PI → **前端** GS1 计算 + bwip-js 渲染 → 用户导出时保存元数据到后端 → PostgreSQL 持久化 → cursor 分页查询历史 → 前端重渲染预览。

**批量打码**：上传 Excel → 客户端 Mod-10 校验 → 单事务写 LabelBatch + LabelHistory（后端权威重算 HRI）→ 客户端 bwip-js + `renderCustomSvg(CanvasDefinition)` 纯 SVG 合图 → JSZip 打包下载 → 批次历史台账。

**模板编辑器（v3.5）**：拖拽画布（react-rnd）+ Zustand/zundo 状态管理 → GS1 AI 字段绑定 → POST/PUT `/api/v1/templates` 持久化 PostgreSQL JSONB → 批量打码页从模板库选取并驱动 `renderCustomSvg` SVG 导出。
