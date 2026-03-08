# 前端组件化架构

## 概览
`page.tsx` 已完全重构为组件化架构，核心逻辑提取到 hooks 和可复用组件中，便于后续扩展和复用。

## 目录结构

```
frontend/
├── lib/
│   ├── dateUtils.ts           # 日期转换工具函数
│   ├── auth.ts                 # 认证工具
│   └── api.ts                  # API 请求工具
├── hooks/
│   ├── useLabels.ts            # 标签生成逻辑 hook
│   ├── useLabelHistory.ts      # 标签历史管理 hook
│   └── useUdiGenerator.ts      # 现有 hook
├── components/
│   ├── labels/
│   │   ├── LabelForm.tsx              # 标签录入表单
│   │   ├── LabelHistoryFilter.tsx     # 历史记录筛选器
│   │   ├── LabelHistorySection.tsx    # 历史记录完整区域
│   │   ├── PreviewDialog.tsx          # 预览对话框
│   │   ├── PageHeader.tsx             # 页面头部
│   │   └── PreviewTemplateCanvas.tsx  # 预览模板（现有）
│   └── shared/
│       └── DataTable.tsx              # 数据表格
└── app/
    ├── page.tsx                # 已简化的主页
    └── history/
        └── page.tsx            # 历史页（需补充 onDelete）
```

## 核心 Hooks

### `useLabels`
**功能**: 管理标签生成相关状态和逻辑

**返回值**:
```typescript
{
  preview: LabelGenerateResponse | LabelPreviewResponse | null,
  setPreview: (preview) => void,
  loadingGenerate: boolean,
  dialogOpen: boolean,
  setDialogOpen: (open) => void,
  handleGenerate: (formData, authUser) => Promise<boolean>
}
```

**使用示例**:
```tsx
const { preview, dialogOpen, setDialogOpen, handleGenerate, loadingGenerate } = useLabels();

const success = await handleGenerate(formData, authUser);
if (success) {
  // 重新获取历史记录
}
```

### `useLabelHistory`
**功能**: 管理历史记录获取、删除、分页

**返回值**:
```typescript
{
  historyRows: LabelHistoryItem[],
  loadingHistory: boolean,
  loadingReviewId: number | null,
  setLoadingReviewId: (id) => void,
  page: number,
  pageSize: number,
  total: number,
  fetchHistory: (targetPage, filterGtin, filterBatchNo) => Promise<void>,
  handleDelete: (id, onSuccess) => Promise<void>
}
```

**使用示例**:
```tsx
const { historyRows, fetchHistory, handleDelete } = useLabelHistory();

// 获取历史记录
await fetchHistory(1, "09506000134352", "");

// 删除记录
await handleDelete(recordId, () => {
  // 删除后的回调
  fetchHistory(1);
});
```

## 核心组件

### `LabelForm`
**Props**:
```typescript
{
  onSubmit: (data) => Promise<boolean>,
  isLoading?: boolean
}
```

**使用示例**:
```tsx
<LabelForm 
  onSubmit={handleFormSubmit} 
  isLoading={loadingGenerate} 
/>
```

### `LabelHistorySection`
**Props**:
```typescript
{
  rows: LabelHistoryItem[],
  loading: boolean,
  loadingReviewId: number | null,
  page: number,
  pageSize: number,
  total: number,
  onSearch: (gtin, batchNo) => void,
  onReview: (row) => void,
  onDelete: (id, onSuccess) => void,
  onPrev: () => void,
  onNext: () => void
}
```

### `PreviewDialog`
**Props**:
```typescript
{
  open: boolean,
  onOpenChange: (open) => void,
  preview: LabelGenerateResponse | LabelPreviewResponse | null,
  lot: string,
  expiryDate: string
}
```

### `PageHeader`
**Props**:
```typescript
{
  authUser: AuthUser | null
}
```

## 日期工具函数

### `toYymmdd(value: string): string | undefined`
将 `YYYY-MM-DD` 格式转换为 `YYMMDD`

**示例**:
```typescript
toYymmdd("2028-02-29") // "280229"
```

### `toDisplayDate(yymmdd?: string | null): string`
将 `YYMMDD` 格式转换为显示格式 `20YY-MM-DD`

**示例**:
```typescript
toDisplayDate("280229") // "2028-02-29"
```

## 主页面简化后的流程

```tsx
export default function Home() {
  // 1. 初始化认证状态
  // 2. 初始化 hooks
  const { preview, dialogOpen, setDialogOpen, handleGenerate, loadingGenerate } = useLabels();
  const { historyRows, fetchHistory, handleDelete, ... } = useLabelHistory();
  
  // 3. 管理本地状态（过滤条件、当前更新选项等）
  const [filterGtin, setFilterGtin] = useState("");
  const [filterBatchNo, setFilterBatchNo] = useState("");
  const [expiryDate, setExpiryDate] = useState("2028-02-29");
  
  // 4. 定义处理器
  const handleFormSubmit = async (formData) => { ... };
  const handleReview = async (row) => { ... };
  const handleSearch = (gtin, batchNo) => { ... };
  
  // 5. 使用组件组合 UI
  return (
    <main>
      <PageHeader authUser={authUser} />
      <LabelForm onSubmit={handleFormSubmit} isLoading={loadingGenerate} />
      <LabelHistorySection {...historyProps} />
      <PreviewDialog {...previewProps} />
    </main>
  );
}
```

## 复用性设计

### 如何在其他页面复用

#### 示例 1: 创建报表页面
```tsx
// pages/report.tsx
import { useLabelHistory } from "@/hooks/useLabelHistory";
import { LabelHistoryFilter } from "@/components/labels/LabelHistoryFilter";
import { DataTable } from "@/components/shared/DataTable";

export default function ReportPage() {
  const { historyRows, fetchHistory, page, pageSize, total, ... } = useLabelHistory();
  
  useEffect(() => {
    fetchHistory(1);
  }, []);
  
  return (
    <div>
      <LabelHistoryFilter onSearch={(g, b) => fetchHistory(1, g, b)} />
      <DataTable rows={historyRows} ... />
    </div>
  );
}
```

#### 示例 2: 创建批量生成功能
```tsx
// pages/batch-generate.tsx
import { useLabels } from "@/hooks/useLabels";

export default function BatchGeneratePage() {
  const { handleGenerate, preview, setDialogOpen } = useLabels();
  
  const handleBatchSubmit = async (formDataArray) => {
    for (const formData of formDataArray) {
      await handleGenerate(formData, authUser);
    }
  };
  
  return (
    // ...
  );
}
```

## 添加新功能的步骤

1. **添加状态管理**: 如需新增全局逻辑，创建新 hook
2. **创建组件**: 为新功能创建组件，传入数据和回调
3. **在主页面组合**: 在 `page.tsx` 中使用新组件
4. **集成**: 连接 hooks 和组件

## 优势

✅ **高内聚、低耦合**: 每个组件职责单一
✅ **易于测试**: 组件和 hooks 独立可测试
✅ **易于复用**: 可在多个页面使用同一逻辑
✅ **易于维护**: 逻辑集中在 hooks，UI 在组件
✅ **易于扩展**: 新功能只需添加新 hook 或组件
