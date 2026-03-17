# 前端组件架构

## 概览

当前前端已从“单页堆逻辑”演进为**页面编排 + hooks 负责状态/数据 + 组件负责展示/交互**的结构。
文档只保留当前仍在使用的模块，已删除旧版中失效的组件、过时的 Hook 返回值，以及与现状不符的示例代码。

核心设计原则：

- 页面只做编排，不承载复杂业务细节
- 远程数据统一通过 TanStack Query 管理
- 认证状态通过外部 store 统一分发，避免页面各自维护 session
- 预览、历史、批量、模板四条主流程相互解耦，但复用同一套 GS1 / 模板 / 导出基础设施

---

## 当前目录结构

```text
frontend/
├── app/
│   ├── page.tsx                         # 首页：录入 + 本地预览 + 历史总览
│   ├── history/page.tsx                 # 独立历史页
│   ├── history/batch/[id]/page.tsx      # 批次详情与重新导出
│   ├── batch/                           # 批量上传流程页
│   ├── editor/                          # 模板编辑器
│   └── templates/                       # 模板管理页
├── components/
│   ├── labels/
│   │   ├── LabelForm.tsx                # 单标签录入表单
│   │   ├── HistoryTabs.tsx              # 历史总览：批次列表 + 全部明细
│   │   ├── PreviewDialog.tsx            # 预览、保存、导出入口
│   │   ├── PreviewTemplateCanvas.tsx    # 模板预览画布
│   │   ├── BarcodePreview.tsx           # 条码预览组件
│   │   └── PageHeader.tsx               # 通用页头
│   └── shared/
│       ├── DataTable.tsx                # 明细表格
│       ├── Navbar.tsx                   # 顶部导航
│       └── Footer.tsx                   # 页脚
├── hooks/
│   ├── useLabels.ts                     # 本地预览构建
│   ├── useLabelHistory.ts               # 单标签历史游标分页
│   ├── useLabelBatches.ts               # 批次列表游标分页
│   ├── useBatchUpload.ts                # 批量上传状态机
│   ├── useLabelTemplates.ts             # 模板分页 / CRUD
│   ├── useSystemTemplateOverrides.ts    # 系统模板覆盖配置
│   ├── useHiddenSystemTemplates.ts      # 系统模板隐藏状态
│   └── useRequireAuth.ts                # 路由级认证守卫
├── lib/
│   ├── auth.ts                          # 认证缓存与 session 恢复
│   ├── api.ts                           # Axios 请求封装
│   ├── batchExporter.ts                 # 批量 SVG ZIP 导出
│   ├── dateUtils.ts                     # 日期转换
│   ├── gs1.ts / gs1Utils.ts             # GS1 编码与解析
│   ├── svgTemplates.ts                  # SVG 模板渲染
│   ├── preview-templates.ts             # 预置模板定义
│   └── systemTemplates.ts               # 系统模板元数据
└── types/
    ├── udi.ts
    ├── batch.ts
    └── template.ts
```

---

## 页面分层

### 1. 首页 `app/page.tsx`

职责：

- 使用 `useRequireAuth()` 统一处理登录态
- 使用 `useLabels()` 完成本地预览数据构建
- 使用 `HistoryTabs` 复用历史区域
- 使用 `PreviewDialog` 承接预览、保存和导出

特点：

- 首页不直接拼接 GS1，也不直接请求历史接口
- 录入成功后只更新本地预览状态，由弹窗负责后续保存动作
- 历史数据与表单完全隔离，避免页面状态耦合

### 2. 历史页 `app/history/page.tsx`

职责：

- 仅负责认证校验与渲染 `HistoryTabs`
- 与首页复用同一套历史交互逻辑

特点：

- 页面本身非常薄，确保历史功能只有一个维护入口

### 3. 批次详情页 `app/history/batch/[id]/page.tsx`

职责：

- 拉取单个批次详情
- 以降序显示批次内标签记录
- 提供上一页 / 首页 / 下一页导航
- 支持重新导出整个批次 ZIP

特点：

- 页面分页方向已与历史列表统一为“最新优先”
- 导出路径与页面展示解耦：页面降序，导出仍显式按升序拉取，保证文件顺序稳定

---

## 核心 Hooks

### `useRequireAuth()`

职责：

- 从 `auth.ts` 订阅用户与 session 状态
- 首次进入页面时恢复 session
- 在认证模式下统一处理跳转登录

返回值：

```ts
{
  authUser,
  checkingAuth,
  logout,
}
```

设计要点：

- 不在 effect 中做多余状态镜像
- 使用外部 store，避免多页面各自维护登录状态
- 工具模式下直接返回匿名用户，不产生额外闪烁

### `useLabels()`

职责：

- 校验 DI / PI 基础输入
- 本地构造 HRI 与 GS1 element string
- 生成 `previewSource`
- 打开预览弹窗

返回值：

```ts
{
  previewSource,
  setPreviewSource,
  dialogOpen,
  setDialogOpen,
  handlePreviewLocally,
}
```

说明：

- 当前版本已不再由该 Hook 直接负责“生成并保存到后端”
- 单标签流程改为“先本地预览，后在弹窗里按需保存/导出”，交互更顺滑

### `useLabelHistory()`

职责：

- 管理单标签历史的游标分页
- 管理 GTIN / 批号筛选
- 删除单条历史记录
- 复用第一页 `total`，减少后续分页重复计数

返回值：

```ts
{
  historyRows,
  loadingHistory,
  total,
  hasPrev,
  hasNext,
  filterGtin,
  filterBatchNo,
  handleSearch,
  handleDelete,
  invalidateHistory,
  goToPrevPage,
  goToNextPage,
}
```

### `useLabelBatches(authUser)`

职责：

- 管理批次总览分页
- 保持与 `useLabelHistory()` 一致的游标分页体验
- 缓存第一页总数，减少重复 `COUNT(*)`

返回值：

```ts
{
  batchItems,
  loadingBatches,
  total,
  hasPrev,
  hasNext,
  goToNextPage,
  goToPrevPage,
  resetPagination,
  refetch,
}
```

### `useBatchUpload()`

职责：

- 驱动 Excel 批量上传状态机
- 解析文件、校验数据、落库、生成 ZIP、反馈进度

状态阶段：

```text
idle → parsing → validated → saving → generating → done | error
```

设计要点：

- 以状态机方式组织批量流程，避免页面散落大量布尔状态
- 导出阶段直接复用 `batchExporter.ts`

### `useLabelTemplates()`

职责：

- 负责模板列表分页
- 支持按需加载全部模板
- 负责模板 CRUD

设计要点：

- 已从一次性全量拉取改为 `useInfiniteQuery`
- 预览弹窗仅在打开时加载模板数据，降低首页初始负担

---

## 核心组件

### `HistoryTabs`

职责：

- 统一承载“批次总览”和“全部明细”两个 tab
- 组合 `useLabelHistory()` 与 `useLabelBatches()`
- 处理预览回看、删除、筛选、分页等动作

这是当前历史功能的主编排组件。

### `PreviewDialog`

职责：

- 展示单标签预览
- 延迟拉取模板与系统覆盖配置
- 对本地预览执行一次性保存
- 导出 SVG / PNG 等格式

当前约束：

- 针对同一份本地预览，保存逻辑具备幂等保护，避免多格式导出造成重复写历史

### `DataTable`

职责：

- 渲染单标签历史记录表
- 承接回看、删除、分页按钮

说明：

- 它是纯展示组件，分页状态仍由 hook 提供

### `PreviewTemplateCanvas`

职责：

- 根据 `CanvasDefinition` 渲染预览画布
- 为编辑器、预览弹窗、导出链路提供统一视觉基线

---

## 数据流

### 1. 单标签预览流

```text
LabelForm
  → useLabels.handlePreviewLocally()
  → previewSource
  → PreviewDialog
  → 按需保存到后端 / 导出文件
```

### 2. 单标签历史流

```text
HistoryTabs
  → useLabelHistory()
  → /api/v1/labels/history
  → DataTable
  → PreviewDialog（回看历史记录）
```

### 3. 批次流

```text
批量上传页
  → useBatchUpload()
  → /api/v1/batches/generate
  → iterateBatchLabels()
  → exportBatchToZip()
```

### 4. 模板流

```text
模板页 / 预览弹窗
  → useLabelTemplates()
  → /api/v1/templates
  → TemplateGallery / PreviewDialog
```

---

## 当前约定

### 1. 分页约定

- 列表页统一使用游标分页
- 默认按最新记录优先展示
- `next_cursor` 通过“多取一条”判断是否存在下一页
- 第一页返回 `total`，后续分页可为空，由前端沿用第一页缓存值

### 2. 导出约定

- 页面展示顺序与导出顺序可以不同
- 批次详情页展示按降序
- 批量 ZIP 导出显式按升序拉取，保证用户拿到稳定文件序列

### 3. 认证约定

- 页面不直接操作 Cookie 或 Token
- 所有登录态恢复统一经过 `auth.ts` + `useRequireAuth()`
- 非认证模式仍保持页面 API 一致性

### 4. 模板约定

- 自定义模板统一使用 `CanvasDefinition`
- 系统模板的显示、隐藏、覆盖配置通过独立 hooks 管理
- 重型模板数据按需拉取，不在首页首屏预加载

---

## 已移除的失效内容

以下内容已不再作为当前架构描述的一部分：

- 不存在的组件：`LabelHistoryFilter.tsx`、`LabelHistorySection.tsx`
- 已失效的 Hook 返回值：`page`、`pageSize`、`fetchHistory()` 等旧分页接口
- 已不符合现状的“主页自行拼装历史逻辑”示例
- 已不准确的 `useLabels()` “直接生成并持久化”描述
- 已废弃的 `useUdiGenerator.ts` 引用

---

## 维护建议

- 新功能优先新增 Hook 或独立编排组件，不要把业务逻辑直接堆回页面
- 同类列表尽量复用同一分页语义：游标、第一页 total、上一页/下一页
- 导出、预览、渲染尽量复用同一份模板与条码底层能力，避免出现“页面能看、导出不一致”
- 文档更新应以实际代码为准，删除历史阶段性设计，避免架构文档再次过期
