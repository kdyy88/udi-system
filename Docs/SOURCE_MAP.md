# 源码导读地图（GS1 UDI System）

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
  - 挂载 CORS + GZip；注册总路由。
  - 启动时：`create_all()` 兜底建表；`ENABLE_AUTH=true` 时 seed 默认用户；初始化 Redis。
  - `ENABLE_AUTH=false` 时跳过 users 表创建与 seed，仅初始化业务表。
  - **正式 schema 演进仍以 Alembic 为准**。
- [backend/entrypoint.sh](backend/entrypoint.sh)
  - 容器启动入口：先执行 `alembic upgrade head`，再启动 Gunicorn（4 workers）。

### 前端入口

- [frontend/app/layout.tsx](frontend/app/layout.tsx)
  - 全局布局；挂载 `<Navbar>`（仅在 `ENABLE_AUTH=true` 时显示用户菜单）；用 `<Providers>` 包裹全应用。
- [frontend/app/providers.tsx](frontend/app/providers.tsx)
  - TanStack Query 的 `QueryClientProvider`（staleTime 30s）。
- [frontend/proxy.ts](frontend/proxy.ts)（v3.9 新增）
  - Next.js 16 Proxy（原 `middleware.ts`）。`ENABLE_AUTH=false` 时将 `/login`、`/register` 等 auth 页面重定向到 `/`。
- [frontend/app/page.tsx](frontend/app/page.tsx)
  - 主业务页：表单录入 → 本地 GS1 计算 → 打开预览弹窗 → `<HistoryTabs>`（批次总览 + 全部明细）。
- [frontend/app/batch/page.tsx](frontend/app/batch/page.tsx)
  - 批量打码页：Excel 上传 → 客户端解析与校验 → 模板选择与弹窗预览 → 保存后端 → SVG ZIP 下载（6 阶段状态机）。
- [frontend/app/history/page.tsx](frontend/app/history/page.tsx)
  - 历史台账页：复用 `<PageHeader>` + `<HistoryTabs>`。
- [frontend/app/history/batch/[id]/page.tsx](frontend/app/history/batch/[id]/page.tsx)
  - 批次详情页：分页展示批次内所有标签 + "重新下载 ZIP" 按钮。
- [frontend/app/(auth)/login/page.tsx](frontend/app/(auth)/login/page.tsx)
  - 登录页；含"注册新账号"和"忘记密码"跳转链接。
- [frontend/app/(auth)/register/page.tsx](frontend/app/(auth)/register/page.tsx)（v3.8 新增）
  - 邮箱 + 用户名 + 密码注册；成功后展示"请查收验证邮件"提示。
- [frontend/app/(auth)/verify-email/page.tsx](frontend/app/(auth)/verify-email/page.tsx)（v3.8 新增）
  - 读取 URL `?token=` 自动调用 `/auth/verify` 完成账号激活。
- [frontend/app/(auth)/forgot-password/page.tsx](frontend/app/(auth)/forgot-password/page.tsx)（v3.8 新增）
  - 输入邮箱触发密码重置邮件。
- [frontend/app/(auth)/reset-password/page.tsx](frontend/app/(auth)/reset-password/page.tsx)（v3.8 新增）
  - 读取 URL `?token=` + 输入新密码完成重置。
- [frontend/app/editor/page.tsx](frontend/app/editor/page.tsx)（v3.5 新增，v4.0 更新）
  - 新建模板编辑器；支持 `?seed=sys-xxx` 预加载系统模板画布；管理员“更新系统模板”+“另存为个人模板”双按钮。
  - v4.0：缩放滑块控制 `displayScale`（替代旧版 CSS transform zoom）。
- [frontend/app/editor/[id]/page.tsx](frontend/app/editor/[id]/page.tsx)（v3.5 新增）
  - 编辑已有模板。
- [frontend/app/templates/page.tsx](frontend/app/templates/page.tsx)（v3.6 新增）
  - 模板管理页。

---

## 2) 后端分层地图（按职责）

### 认证抽象层（Core — v3.9 新增）

- [backend/app/core/auth_deps.py](backend/app/core/auth_deps.py)
  - **认证解耦的核心**。定义 `CurrentUser` frozen dataclass（`id`/`username`/`role`/`email`）和 `ANONYMOUS_USER` 哨兵。
  - 导出 `get_current_user` / `get_current_admin` — FastAPI `Depends()` 可调用对象。
  - `ENABLE_AUTH=true`：委托 `fastapi_users_config` 解析 JWT Cookie。
  - `ENABLE_AUTH=false`：直接返回 `ANONYMOUS_USER`，不导入 fastapi-users。
  - **所有 API 端点必须从这里导入，禁止直接引用 `fastapi_users_config`**。

### 路由层（API）

- [backend/app/api/router.py](backend/app/api/router.py)
  - 聚合所有子路由；auth 路由仅在 `ENABLE_AUTH=true` 时注册。
- [backend/app/api/helpers.py](backend/app/api/helpers.py)
  - 路由公共 helper：`log_request_timing()`、`get_owned_record_or_404(owner_id: str)`、`require_admin()`（委托 `get_current_admin`）、`to_label_history_response()`。
- [backend/app/api/auth.py](backend/app/api/auth.py)（v3.8 重写，仅 ENABLE_AUTH=true 加载）
  - 挂载全套 fastapi-users 路由 + 兼容旧前端的 `POST /auth/login`（JSON 格式）。
- [backend/app/api/labels.py](backend/app/api/labels.py)
  - 生成、历史查询（cursor 分页）、历史明细、删除。
  - 所有端点使用 `Depends(get_current_user)` → `CurrentUser`。
- [backend/app/api/batches.py](backend/app/api/batches.py)
  - 批量接口，使用 `Depends(get_current_user)` → `CurrentUser`。
- [backend/app/api/templates.py](backend/app/api/templates.py)
  - 模板 CRUD，使用 `Depends(get_current_user)` → `CurrentUser`。
- [backend/app/api/system.py](backend/app/api/system.py)
  - 系统配置（隐藏模板 / 画布覆写），写操作使用 `Depends(get_current_admin)` → `CurrentUser`。

### 数据模型层（DB）

- [backend/app/db/session.py](backend/app/db/session.py)
  - async engine（asyncpg / PostgreSQL）、`AsyncSessionLocal`、`get_db()` 依赖注入。
- [backend/app/db/models.py](backend/app/db/models.py)（v3.9 更新）
  - `User` 类条件定义：`ENABLE_AUTH=true` 时继承 `SQLAlchemyBaseUserTable`；`false` 时 `User = None`。
  - 业务表 `LabelBatch` / `LabelHistory` / `LabelTemplate` 使用 `owner_id: str`（String(128)，默认 `"anonymous"`），不与 `users` 表建 FK。
  - `SystemConfig`：全局配置键值存储（JSONB）。
- [backend/app/db/user_manager.py](backend/app/db/user_manager.py)（v3.8 新增）
  - 自定义 `UserManager`：SHA-256 旧密码向 bcrypt 懒迁移；注册后自动触发验证邮件。
- [backend/app/db/fastapi_users_config.py](backend/app/db/fastapi_users_config.py)（v3.8 新增）
  - `CookieTransport`（`udi_auth`，HttpOnly）+ `JWTStrategy`（7 天）。
  - 导出 `current_active_user`、`current_admin_user`（**API 层通过 `auth_deps.py` 间接使用**）。
- [backend/app/db/redis.py](backend/app/db/redis.py)（v3.8 新增）
  - 异步 Redis 连接池；Redis 不可达时优雅降级。
- [backend/alembic/](backend/alembic/)
  - `0001` 初始全量建表；`0002` 新增 `label_batch`；`0003` 创建 `label_template`；`0004` 创建 `system_config`；`0005` `template_definition` 快照；`0006` User 认证字段（v3.8）；**`0007` 认证解耦：`user_id` → `owner_id`（v3.9）**。

### 数据校验层（Schema）

- [backend/app/schemas/label.py](backend/app/schemas/label.py)
  - 请求/响应模型。响应使用 `owner_id: str`。
- [backend/app/schemas/batch.py](backend/app/schemas/batch.py)
  - 批量请求/响应。响应使用 `owner_id: str`。
- [backend/app/schemas/template.py](backend/app/schemas/template.py)
  - 模板 CRUD 模型。响应使用 `owner_id: str`。

### 业务层（Service）

- [backend/app/services/gs1_engine.py](backend/app/services/gs1_engine.py)
  - GTIN-14 校验位、AI 拼接、FNC1、HRI。**权威实现**，须与前端 `lib/gs1.ts` 同步。
- [backend/app/services/auth_service.py](backend/app/services/auth_service.py)
  - `seed_default_users()`：仅 `ENABLE_AUTH=true` 时调用，创建 demo + admin 用户。
- [backend/app/services/email_service.py](backend/app/services/email_service.py)（v3.8 新增）
  - Resend 邮件发送（验证 / 重置）。`RESEND_API_KEY` 为空时开发模式（日志输出链接）。

### 配置层

- [backend/app/core/config.py](backend/app/core/config.py)
  - `Settings` frozen dataclass。关键字段：`ENABLE_AUTH`（bool，默认 `true`）、`DATABASE_URL`、`JWT_SECRET`、`RESEND_API_KEY`、`RESEND_FROM_EMAIL`、`FRONTEND_URL`、`COOKIE_SECURE`。
  - 集成 `python-dotenv`：自动从项目根目录 `.env` 加载。

---

## 3) 前端分层地图（按职责）

### 页面层

- [frontend/app/page.tsx](frontend/app/page.tsx) — 主页：表单 → 预览 → 历史
- [frontend/app/batch/page.tsx](frontend/app/batch/page.tsx) — 批量打码
- [frontend/app/history/page.tsx](frontend/app/history/page.tsx) — 历史台账
- [frontend/app/history/batch/[id]/page.tsx](frontend/app/history/batch/[id]/page.tsx) — 批次详情
- [frontend/app/(auth)/](frontend/app/(auth)/) — 登录 / 注册 / 验证 / 忘记密码 / 重置密码
- [frontend/app/editor/](frontend/app/editor/) — 模板编辑器（新建 + 编辑）
- [frontend/app/templates/page.tsx](frontend/app/templates/page.tsx) — 模板管理

### Hook 层

- [frontend/hooks/useLabels.ts](frontend/hooks/useLabels.ts) — 同步预览 GS1
- [frontend/hooks/useLabelHistory.ts](frontend/hooks/useLabelHistory.ts) — 历史查询（cursor 分页、TanStack Query）
- [frontend/hooks/useLabelBatches.ts](frontend/hooks/useLabelBatches.ts) — 批次列表
- [frontend/hooks/useBatchUpload.ts](frontend/hooks/useBatchUpload.ts) — 批量上传状态机
- [frontend/hooks/useRequireAuth.ts](frontend/hooks/useRequireAuth.ts) — 认证守卫（`ENABLE_AUTH=false` 时 no-op）
- [frontend/hooks/useLabelTemplates.ts](frontend/hooks/useLabelTemplates.ts) — 模板 CRUD hooks
- [frontend/hooks/useHiddenSystemTemplates.ts](frontend/hooks/useHiddenSystemTemplates.ts) — 隐藏列表
- [frontend/hooks/useSystemTemplateOverrides.ts](frontend/hooks/useSystemTemplateOverrides.ts) — 画布覆写

### 组件层

- [frontend/components/shared/Navbar.tsx](frontend/components/shared/Navbar.tsx) — 全局导航栏；用户菜单仅在 `ENABLE_AUTH && authUser` 时显示
- [frontend/components/labels/HistoryTabs.tsx](frontend/components/labels/HistoryTabs.tsx) — 双 Tab 历史（批次 + 明细）
- [frontend/components/labels/LabelForm.tsx](frontend/components/labels/LabelForm.tsx) — 标签录入表单
- [frontend/components/labels/PreviewDialog.tsx](frontend/components/labels/PreviewDialog.tsx) — 条码预览 + 导出
  - 统一 SVG 渲染：无论是否选了模板，均调用 `renderCustomSvg()`，默认回落 `sys-compact`。预览与导出 SVG 完全一致。
  - `kind === "local"`：导出才保存后端；`kind === "history"`：只预览不重复保存
- [frontend/components/shared/DataTable.tsx](frontend/components/shared/DataTable.tsx) — 历史表格（cursor 分页）
- [frontend/components/editor/](frontend/components/editor/) — Canvas / ElementToolbar / PropertiesPanel / TemplateGallery / TemplatePreviewDialog
  - `Canvas.tsx`（v4.0 重写）：`displayScale` 替代 CSS `transform:scale`。布局坐标乘以 `displayScale` 写入 DOM，`onDragStop`/`onResizeStop` 除以写回 Store。选中框物理 1px，react-selecto 框选。
- [frontend/components/ui/](frontend/components/ui/) — shadcn/ui 基础组件

### Feature 层（`features/labels/preview/`）

- `useLabelPreviewOrchestrator.ts` — `useBwipPreview(hri)` 同步渲染 4 路 SVG
- `barcode-svg.ts` — bwip-js 包装（DataMatrix / GS1-128）
- `save.ts` — `saveLabelToBackend()` → `POST /generate`
- `export.ts` — PNG / SVG / PDF 下载

### 状态管理层

- [frontend/stores/canvasStore.ts](frontend/stores/canvasStore.ts) — Zustand + zundo，画布状态 + 撤销/重做

### 配置与工具层

- [frontend/lib/gs1.ts](frontend/lib/gs1.ts) — 前端 GS1 同构工具（**须与后端 `gs1_engine.py` 同步**）
- [frontend/lib/gs1Utils.ts](frontend/lib/gs1Utils.ts) — GS1 AI 字符串解析工具
- [frontend/lib/excelParser.ts](frontend/lib/excelParser.ts) — SheetJS 解析 Excel + 客户端校验
- [frontend/lib/svgTemplates.ts](frontend/lib/svgTemplates.ts) — `renderCustomSvg(input, canvas)` SVG 合成
- [frontend/lib/batchExporter.ts](frontend/lib/batchExporter.ts) — 批量 SVG → JSZip 下载
- [frontend/lib/api.ts](frontend/lib/api.ts) — Axios 实例（`withCredentials: true`，401 拦截；`ENABLE_AUTH=false` 时禁用 401 重定向）
- [frontend/lib/auth.ts](frontend/lib/auth.ts) — 认证状态管理；`ENABLE_AUTH=false` 时返回 `MOCK_USER`（eagerly cached，无闪烁）
- [frontend/lib/systemTemplates.ts](frontend/lib/systemTemplates.ts) — 三套出厂系统模板 + `applyOverrides()`

### 类型层

- [frontend/types/udi.ts](frontend/types/udi.ts) — `AuthUser`（`user_id: string`）/ `LoginResponse` / `LabelHistoryItem`（`owner_id: string`）
- [frontend/types/batch.ts](frontend/types/batch.ts) — `LabelBatchSummary`（`owner_id: string`）/ `ParsedRow` / `BatchPhase`
- [frontend/types/template.ts](frontend/types/template.ts) — `CanvasDefinition` / `CanvasElement` / `LabelTemplateRecord`（`owner_id: string`）

---

## 4) 核心调用链

### A. 认证链路（ENABLE_AUTH=true 时）

```
前端 login/page.tsx
  → POST /api/v1/auth/login  (JSON {username, password})
  → backend/api/auth.py → user_manager.py:
      UserManager.authenticate()：先按邮箱查找，再按用户名查找；SHA-256 旧密码懒迁移到 bcrypt
  → 成功：JWTStrategy.write_token() → CookieTransport 写入 HTTP-only Cookie "udi_auth"
  → 返回 {user_id, username, email, role} → 前端写入 localStorage

session 重建（刷新页面）
  → lib/auth.ts: initSession()
  → GET /api/v1/auth/users/me  （Cookie 自动携带）
  → 成功 → 刷新 localStorage；失败 → clearAuthUser()

Cookie 过期
  → 任何 API 返回 401 → api.ts 拦截器 → clearAuthUser() + redirect("/login")
```

### A'. 纯工具模式（ENABLE_AUTH=false 时）

```
所有 API 端点
  → Depends(get_current_user)  [auth_deps.py]
  → 直接返回 ANONYMOUS_USER(id="anonymous", role="admin")
  → 无 Cookie 交互，无 /auth/* 路由注册

前端
  → lib/auth.ts: authUserCache 预设 MOCK_USER（无闪烁）
  → useRequireAuth(): checkingAuth = false
  → proxy.ts: /login /register 等路径重定向到 /
  → Navbar: 不显示用户菜单
```

### B. 生成 + 预览链路（无网络，同步）

```
用户填写 DI/PI → LabelForm.onSubmit()
  → useLabels.handlePreviewLocally(formData)
      → lib/gs1.ts  buildHri() + buildGs1ElementString()
  → PreviewDialog → useBwipPreview(hri) → bwip-js SVG
```

### C. 导出（唯一触发后端写入的时机）

```
用户点击"导出"
  → if (kind === "local")
      → save.ts: saveLabelToBackend()  [POST /generate]
          → backend: get_current_user → owner_id = current_user.id
      → invalidateHistory()
  → export.ts: exportPreviewNode(format)
```

### D. 历史查询（cursor 分页 + 缓存）

```
进入页面 / 翻页
  → useLabelHistory useQuery → GET /api/v1/labels/history?cursor=...
      → backend: WHERE owner_id=? ORDER BY id DESC LIMIT N
      → 返回 items + next_cursor
  → DataTable 渲染；staleTime 30s 防闪烁
```

### E. 批量打码

```
Excel 上传 → excelParser 解析 + 校验 → 模板选择
  → POST /api/v1/batches/generate  [单事务]
      → backend: LabelBatch + 批量 LabelHistory（gs1_engine 权威重算 HRI）
  → batchExporter: fetchAllBatchLabels() → renderCustomSvg() → JSZip → .zip
```

### F. 批次历史

```
历史页"批次总览" Tab → useLabelBatches → GET /api/v1/batches
批次详情 → GET /api/v1/batches/{id}
重新下载 → exportBatchToZip（复用 template_definition 快照）
```

### G. 模板编辑器

```
新建 → /editor → canvasStore → POST /api/v1/templates
编辑 → /editor/[id] → GET → canvasStore.loadCanvas → PUT
选模板 → TemplateGallery → onSelect → renderCustomSvg → SVG 导出
```

---

## 5) 新手阅读顺序

1. **认证抽象**：[backend/app/core/auth_deps.py](backend/app/core/auth_deps.py)（理解 Core & Shell 分界）
2. **后端入口**：[backend/app/main.py](backend/app/main.py)
3. **GS1 算法**：[backend/app/services/gs1_engine.py](backend/app/services/gs1_engine.py) + [frontend/lib/gs1.ts](frontend/lib/gs1.ts)
4. **后端接口**：[backend/app/api/labels.py](backend/app/api/labels.py)
5. **前端预览**：[frontend/features/labels/preview/](frontend/features/labels/preview/)
6. **模板类型**：[frontend/types/template.ts](frontend/types/template.ts) → [frontend/stores/canvasStore.ts](frontend/stores/canvasStore.ts)
7. **批量打码**：[frontend/lib/excelParser.ts](frontend/lib/excelParser.ts) → [frontend/lib/svgTemplates.ts](frontend/lib/svgTemplates.ts) → [backend/app/api/batches.py](backend/app/api/batches.py)

---

## 6) 你改需求时，通常改哪里

| 需求 | 改这里 |
|------|--------|
| 改 GS1 规则 | `backend/services/gs1_engine.py` **+** `frontend/lib/gs1.ts`（须同步） |
| 改批量导出 SVG 渲染 | `frontend/lib/svgTemplates.ts`（`renderCustomSvg`） |
| 改导出格式（PNG/SVG/PDF） | `frontend/features/labels/preview/export.ts` |
| 改 Excel 解析规则 | `frontend/lib/excelParser.ts` |
| 改历史筛选 | `backend/api/labels.py` + `frontend/hooks/useLabelHistory.ts` |
| 改历史页 UI | `frontend/components/labels/HistoryTabs.tsx` |
| 改批次 API | `backend/api/batches.py` + `backend/schemas/batch.py` |
| 改数据库表结构 | `backend/db/models.py` **+** 新增 Alembic 迁移（不可跳过） |
| 改认证开关行为 | `backend/core/auth_deps.py` + `frontend/lib/auth.ts` + `frontend/proxy.ts` |
| 改认证策略（Cookie / JWT） | `backend/db/fastapi_users_config.py` |
| 改默认用户 | `backend/services/auth_service.py` |
| 改邮件模板 | `backend/services/email_service.py` |
| 改 Redis 限流 | `backend/db/redis.py` |
| 改环境变量 | `.env` + `.env.example` + `docker-compose.yml` |
| 改模板编辑器画布 | `frontend/stores/canvasStore.ts` + `frontend/components/editor/Canvas.tsx` |
| 改模板属性面板 | `frontend/components/editor/PropertiesPanel.tsx` |
| 改模板类型定义 | `frontend/types/template.ts`（同步更新 `canvasStore.ts` 工厂函数） |
| 改模板 API | `backend/api/templates.py` + `backend/schemas/template.py` |
| 改系统配置 | `backend/api/system.py` |
| 改系统模板出厂默认 | `frontend/lib/systemTemplates.ts` |

---

## 7) 一句话记忆

**核心引擎**：输入 DI/PI → 前端 GS1 计算 + bwip-js SVG 渲染 → 导出时后端保存元数据（`owner_id`） → cursor 分页历史。

**批量打码**：Excel → 客户端校验 → 后端单事务写批次（权威 HRI）→ 客户端 `renderCustomSvg` → JSZip。

**模板系统**：react-rnd 画布 + Zustand → GS1 AI 绑定 → PostgreSQL JSONB 持久化 → 驱动 SVG 导出。

**认证外壳**（可插拔）：`ENABLE_AUTH=true` → fastapi-users JWT Cookie + 邮箱注册验证；`ENABLE_AUTH=false` → 全部返回 `ANONYMOUS_USER`，零认证依赖。
