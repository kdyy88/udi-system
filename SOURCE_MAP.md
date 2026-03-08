# 源码导读地图（GS1 UDI System）

这份文档帮助你快速建立“代码全景图”：

- 先看哪里（入口）
- 每层做什么（职责）
- 一次业务请求是怎么走的（调用链）

---

## 1) 先从入口看

## 后端入口

- [backend/main.py](backend/main.py)
  - 启动 `uvicorn` 的入口。
- [backend/app/main.py](backend/app/main.py)
  - 创建 FastAPI 应用。
  - 挂载 CORS。
  - 注册总路由。
  - 启动时初始化数据库与默认用户。

## 前端入口

- [frontend/app/layout.tsx](frontend/app/layout.tsx)
  - 全局布局，挂载 Toast。
- [frontend/app/page.tsx](frontend/app/page.tsx)
  - 主业务页：录入、生成、预览、筛选、分页。
- [frontend/app/(auth)/login/page.tsx](frontend/app/(auth)/login/page.tsx)
  - 登录页。

---

## 2) 后端分层地图（按职责）

## 路由层（API）

- [backend/app/api/router.py](backend/app/api/router.py)
  - 聚合所有子路由。
- [backend/app/api/auth.py](backend/app/api/auth.py)
  - 登录接口：用户名密码校验。
- [backend/app/api/labels.py](backend/app/api/labels.py)
  - 预览、生成、历史查询（筛选+分页）。

## 数据模型层（DB）

- [backend/app/db/session.py](backend/app/db/session.py)
  - SQLAlchemy 引擎、会话、依赖注入 `get_db()`。
- [backend/app/db/models.py](backend/app/db/models.py)
  - 表结构：`User`、`LabelHistory`。

## 数据校验层（Schema）

- [backend/app/schemas/label.py](backend/app/schemas/label.py)
  - 请求/响应模型（登录、预览、生成、历史分页）。

## 业务层（Service）

- [backend/app/services/gs1_engine.py](backend/app/services/gs1_engine.py)
  - GTIN-14 校验位、AI 拼接、FNC1、HRI。
- [backend/app/services/barcode_gen.py](backend/app/services/barcode_gen.py)
  - DataMatrix / GS1-128 图像生成与 Base64 转换。
- [backend/app/services/auth_service.py](backend/app/services/auth_service.py)
  - 密码哈希/校验、默认用户初始化。

---

## 3) 前端分层地图（按职责）

## 页面层

- [frontend/app/page.tsx](frontend/app/page.tsx)
  - 表单提交 → 调接口 → 打开预览弹窗。
  - 历史查询筛选分页。
- [frontend/app/history/page.tsx](frontend/app/history/page.tsx)
  - 历史列表专页与回看预览。
- [frontend/app/(auth)/login/page.tsx](frontend/app/(auth)/login/page.tsx)
  - 登录流程与错误提示。

## 组件层

- [frontend/components/shared/DataTable.tsx](frontend/components/shared/DataTable.tsx)
  - 历史表格与翻页按钮。
- [frontend/components/labels/PreviewTemplateCanvas.tsx](frontend/components/labels/PreviewTemplateCanvas.tsx)
  - 预览模板画布渲染（紧凑/双码/明细）。
- [frontend/components/ui](frontend/components/ui)
  - 基础 UI 组件（Button/Input/Dialog/DatePicker/Toaster）。

## 配置与工具层

- [frontend/lib/api.ts](frontend/lib/api.ts)
  - Axios 实例。
- [frontend/lib/auth.ts](frontend/lib/auth.ts)
  - 登录态存取（localStorage）。
- [frontend/lib/preview-templates.ts](frontend/lib/preview-templates.ts)
  - 模板元配置（独立配置）。
- [frontend/types/udi.ts](frontend/types/udi.ts)
  - 前端类型定义。

---

## 4) 核心调用链（你最该理解的三条）

## A. 登录链路

1. 前端 [frontend/app/(auth)/login/page.tsx](frontend/app/(auth)/login/page.tsx) 提交用户名密码。
2. 调 `POST /api/v1/auth/login`。
3. 后端 [backend/app/api/auth.py](backend/app/api/auth.py) 调用 [backend/app/services/auth_service.py](backend/app/services/auth_service.py) 校验密码。
4. 成功后返回 `user_id`，前端写入 [frontend/lib/auth.ts](frontend/lib/auth.ts)。

## B. 生成链路（最重要）

1. 前端 [frontend/app/page.tsx](frontend/app/page.tsx) 提交 DI/PI。
2. 调 `POST /api/v1/labels/generate`。
3. 后端 [backend/app/api/labels.py](backend/app/api/labels.py) 调：
   - [backend/app/services/gs1_engine.py](backend/app/services/gs1_engine.py)（GS1 字符串）
   - [backend/app/services/barcode_gen.py](backend/app/services/barcode_gen.py)（DataMatrix + GS1-128）
4. 保存到 [backend/app/db/models.py](backend/app/db/models.py) 的 `LabelHistory`。
5. 返回两种条码 Base64，前端弹窗预览并可下载。

## C. 历史链路（筛选+分页）

1. 前端 [frontend/app/page.tsx](frontend/app/page.tsx) 或 [frontend/app/history/page.tsx](frontend/app/history/page.tsx) 调 `GET /api/v1/labels/history`。
2. 传 `gtin`、`batch_no`、`page`、`page_size`。
3. 后端 [backend/app/api/labels.py](backend/app/api/labels.py) 构建条件查询 + 总数统计 + offset/limit。
4. 前端 [frontend/components/shared/DataTable.tsx](frontend/components/shared/DataTable.tsx) 渲染表格和翻页。

---

## 5) 新手阅读顺序（建议按这个来）

1. 看入口：
   - [backend/app/main.py](backend/app/main.py)
   - [frontend/app/page.tsx](frontend/app/page.tsx)
2. 看接口：
   - [backend/app/api/auth.py](backend/app/api/auth.py)
   - [backend/app/api/labels.py](backend/app/api/labels.py)
3. 看核心算法：
   - [backend/app/services/gs1_engine.py](backend/app/services/gs1_engine.py)
4. 看条码输出：
   - [backend/app/services/barcode_gen.py](backend/app/services/barcode_gen.py)
5. 看前端模板系统：
   - [frontend/lib/preview-templates.ts](frontend/lib/preview-templates.ts)
   - [frontend/components/labels/PreviewTemplateCanvas.tsx](frontend/components/labels/PreviewTemplateCanvas.tsx)

---

## 6) 你改需求时，通常改哪里

- 改 GS1 规则：
  - [backend/app/services/gs1_engine.py](backend/app/services/gs1_engine.py)
- 改标签模板样式：
  - [frontend/lib/preview-templates.ts](frontend/lib/preview-templates.ts)
  - [frontend/components/labels/PreviewTemplateCanvas.tsx](frontend/components/labels/PreviewTemplateCanvas.tsx)
- 改下载格式逻辑：
  - [frontend/app/page.tsx](frontend/app/page.tsx)
- 改历史筛选条件：
  - [backend/app/api/labels.py](backend/app/api/labels.py)
  - [frontend/app/page.tsx](frontend/app/page.tsx)
  - [frontend/app/history/page.tsx](frontend/app/history/page.tsx)

---

## 7) 一句话记忆

这个项目的核心就是：

登录 -> 输入 DI/PI -> GS1 计算 -> 双条码生成 -> 入库 -> 列表分页查询 -> 模板化预览与下载。
