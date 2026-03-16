# GS1 UDI System

GS1 UDI 标签生成系统。**当前版本：v3.6**

本项目面向医疗器械 / 医药场景下的 GS1 UDI 标签生成、模板管理与历史追溯需求，提供从单条录入、批量导入、条码预览到批次留痕的一体化工作流。系统支持用户自定义标签模板、管理员维护系统默认模板，并通过历史台账与批次详情实现已生成标签的查询、复看与重新下载。

核心能力包括：

- **单标签生成**：录入 DI / PI 后实时预览并保存历史记录
- **批量打码**：解析 Excel，前端校验 GS1 关键字段，批量生成并导出 ZIP
- **模板体系**：支持系统默认模板、自定义模板、系统模板覆写与隐藏控制
- **历史追溯**：支持标签级与批次级历史查询、分页查看、重下载
- **前后端一致校验**：GS1 规则在前后端保持同构，降低预览与入库结果不一致风险

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
│   │   ├── api/
│   │   │   ├── auth.py           # 登录接口（含 role 字段）
│   │   │   ├── batches.py        # 批量生成、批次列表/详情/删除
│   │   │   ├── helpers.py        # API 公共 helper（日志 / 权限 / owned-record 查询）
│   │   │   ├── labels.py         # 单标签生成、历史查询/删除
│   │   │   ├── router.py         # 聚合所有子路由
│   │   │   ├── system.py         # 系统配置（隐藏模板 / 画布覆写）
│   │   │   ├── templates.py      # 用户模板 CRUD
│   │   │   └── v1/health.py      # 健康检查
│   │   ├── db/
│   │   │   ├── models.py         # ORM：User / LabelBatch / LabelHistory / LabelTemplate / SystemConfig
│   │   │   └── session.py        # async engine + get_db()
│   │   ├── schemas/              # Pydantic 请求/响应模型
│   │   └── services/             # gs1_engine.py / auth_service.py
│   ├── alembic/versions/
│   │   ├── 0001_initial_schema.py
│   │   ├── 0002_add_label_batch.py
│   │   ├── 0003_add_label_template.py
│   │   ├── 0004_add_system_config.py
│   │   └── 0005_add_batch_template_snapshot.py
│   └── main.py
├── frontend/
│   ├── app/
│   │   ├── (auth)/login/         # 登录页
│   │   ├── batch/                # 批量打码页
│   │   ├── editor/               # 新建模板编辑器（支持 ?seed=sys-xxx）
│   │   ├── editor/[id]/          # 编辑已有模板
│   │   ├── history/              # 历史台账页
│   │   ├── history/batch/[id]/   # 批次详情页
│   │   ├── templates/            # 标签模板管理页
│   │   └── page.tsx              # 主页（单标签生成）
│   ├── components/
│   │   ├── editor/               # Canvas / ElementToolbar / PropertiesPanel / TemplateGallery
│   │   ├── labels/               # PreviewDialog / LabelForm / HistoryTabs 等
│   │   ├── shared/               # Navbar / DataTable / Footer
│   │   └── ui/                   # shadcn/ui 基础组件
│   ├── features/labels/preview/  # bwip-js 渲染 / 导出 / 保存
│   ├── hooks/
│   │   ├── useHiddenSystemTemplates.ts
│   │   ├── useLabelHistory.ts
│   │   ├── useLabelTemplates.ts
│   │   ├── useLabels.ts
│   │   ├── useBatchUpload.ts
│   │   ├── useRequireAuth.ts
│   │   └── useSystemTemplateOverrides.ts
│   ├── lib/
│   │   ├── api.ts / auth.ts / gs1.ts / gs1Utils.ts
│   │   ├── svgTemplates.ts       # renderCustomSvg（CanvasDefinition → SVG 字符串）
│   │   ├── systemTemplates.ts    # 三套出厂系统模板 + applyOverrides()
│   │   └── batchExporter.ts / excelParser.ts / dateUtils.ts
│   ├── stores/
│   │   └── canvasStore.ts        # Zustand + zundo（画布状态 + 撤销/重做）
│   └── types/
│       ├── template.ts           # CanvasDefinition / CanvasElement 等类型
│       ├── udi.ts                # AuthUser（含 role）/ LoginResponse / LabelHistoryItem 等
│       └── batch.ts
├── Docs/
│   ├── SOURCE_MAP.md
│   └── 更新日志v3.6.md
├── .vscode/tasks.json            # 一键启动任务
├── docker-compose.yml
└── docker-compose.prod.yml
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
| POST | `/api/v1/auth/login` | 登录（响应含 `role` 字段） |
| POST | `/api/v1/labels/generate` | 生成标签并入库（导出时触发） |
| GET  | `/api/v1/labels/history` | 历史查询，支持 `gtin`、`batch_no`、cursor 分页 |
| DELETE | `/api/v1/labels/history/{id}` | 删除历史记录 |
| POST | `/api/v1/batches/generate` | 批量生成：单事务写 LabelBatch + LabelHistory，并保存模板快照（最多 500 行） |
| GET  | `/api/v1/batches` | 批次列表，游标分页 |
| GET  | `/api/v1/batches/{id}` | 批次详情 + 标签游标分页 |
| DELETE | `/api/v1/batches/{id}` | 删除批次（CASCADE 删除所有子记录） |
| GET/POST | `/api/v1/templates` | 用户模板列表 / 创建 |
| GET/PUT/DELETE | `/api/v1/templates/{id}` | 用户模板详情 / 更新 / 删除 |
| GET  | `/api/v1/system/hidden-templates` | 被隐藏的系统模板 ID 列表（公开） |
| PUT  | `/api/v1/system/hidden-templates?user_id=N` | 更新隐藏列表（管理员） |
| GET  | `/api/v1/system/template-overrides` | 系统模板画布覆写映射（公开） |
| PUT  | `/api/v1/system/template-override/{sys_id}?user_id=N` | 管理员保存系统模板画布覆写 |
| DELETE | `/api/v1/system/template-override/{sys_id}?user_id=N` | 管理员恢复系统模板出厂默认 |
| GET  | `/api/v1/health` | 健康检查 |

---

## 关键设计说明

- **条码预览**：完全在浏览器端由 bwip-js 同步渲染，零网络请求，无延迟
- **后端保存时机**：仅用户点击"导出"按钮时触发 `POST /generate`，预览不入库
- **GS1 逻辑同构**：`lib/gs1.ts`（前端）与 `gs1_engine.py`（后端）保持相同实现，修改时须同步更新
- **批量导出**：纯客户端 SVG 合成（`barcode-svg.ts` → `svgTemplates.ts` → JSZip），无服务端渲染，无 DOM 依赖；上传页提供所见即所得预览（渲染路径与导出完全一致）
- **批次重下载**：批量生成时把 `template_definition` 快照持久化到 `label_batch`，历史详情页重新下载 ZIP 会复用原批次模板
- **历史统一**：首页与历史台账页共享 `<HistoryTabs>` 组件，双 Tab 展示批次总览与全部明细
- **历史缓存**：TanStack Query，staleTime 30 秒，翻页不闪烁
- **数据库迁移**：新增表/列必须通过 `alembic/versions/` 迁移文件操作，不可直接改 `models.py` 后重启
- **认证守卫**：前端页面统一通过 `useRequireAuth()` 读取本地登录态与退出登录逻辑，`AuthUser` 单一类型来源为 `types/udi.ts`
- **系统模板**：三套硬编码出厂默认（`lib/systemTemplates.ts`），管理员可在编辑器中直接编辑本体，覆写持久化至 `system_config` 表（JSONB），通过 `applyOverrides()` 合并后对所有用户生效
- **角色权限**：`User.role`（`operator` / `admin`），登录响应含 `role`，前端 `isAdmin(user)` 控制 UI 可见性

---

## 注意事项

使用 `docker-compose up -d` 全量启动后，`node_modules` 和 `.venv` 会由容器以 root 创建。  
切换为本机启动前，需先删除这两个目录：

```bash
sudo rm -rf backend/.venv frontend/node_modules
```

之后再运行 VS Code 任务，依赖会以当前用户权限重新安装。

---

## 线上部署

生产环境使用 `docker-compose.prod.yml`，三个服务（PostgreSQL / Backend / Frontend）全部容器化，镜像由本地 Dockerfile 构建。

### 1. 准备环境变量

在项目根目录创建 `.env` 文件（**不要提交到 Git**）：

```env
# 数据库
POSTGRES_DB=gs1udi
POSTGRES_USER=gs1user
POSTGRES_PASSWORD=your_strong_password

# 后端
CORS_ORIGINS=https://your-domain.com,https://www.your-domain.com
WORKERS=4

# 端口映射（宿主机端口，供 Nginx 等反向代理访问）
BACKEND_PORT=18000
FRONTEND_PORT=3001
```

### 2. 构建镜像并启动

```bash
# 首次部署 / 代码更新后重建镜像
docker compose -f docker-compose.prod.yml up -d --build

# 仅重启（不重建）
docker compose -f docker-compose.prod.yml up -d
```

启动顺序由 `depends_on` + healthcheck 自动保证：PostgreSQL 就绪 → Backend 启动（Alembic 迁移 → Gunicorn 4 workers）→ Frontend 启动。

### 3. 验证

```bash
# 后端健康检查
curl http://localhost:18000/api/v1/health

# 查看日志
docker compose -f docker-compose.prod.yml logs -f backend
docker compose -f docker-compose.prod.yml logs -f frontend
```

### 4. Nginx 反向代理（推荐）

```nginx
server {
    listen 80;
    server_name your-domain.com;

    # 前端
    location / {
        proxy_pass http://127.0.0.1:3001;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }

    # 后端 API
    location /api/ {
        proxy_pass http://127.0.0.1:18000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        client_max_body_size 10m;
    }
}
```

> HTTPS：使用 `certbot --nginx -d your-domain.com` 自动签发 Let's Encrypt 证书。

### 5. 更新部署

```bash
git pull
docker compose -f docker-compose.prod.yml up -d --build
```

Alembic 迁移在 Backend 容器启动时由 `entrypoint.sh` 自动执行，无需手动操作。

### 6. 停止 / 清理

```bash
# 停止但保留数据卷
docker compose -f docker-compose.prod.yml down

# 停止并删除数据库数据（危险）
docker compose -f docker-compose.prod.yml down -v
```

---

## 源码导读

- [Docs/SOURCE_MAP.md](Docs/SOURCE_MAP.md) — 调用链速查
- [Docs/更新日志v3.6.md](Docs/更新日志v3.6.md) — v3.6 模板管理、管理员权限、系统模板覆写
- [Docs/更新日志v3.0.md](Docs/更新日志v3.0.md) — v3.0 批量打码架构与变更详情
- [Docs/更新日志v2.0.md](Docs/更新日志v2.0.md) — v2.0 架构决策与变更详情
