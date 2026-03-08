# GS1 UDI System（新手学习版）

本项目是一个 **GS1 UDI 标签生成系统**，技术栈：

- 前端：Next.js 16 + shadcn/ui
- 后端：FastAPI + SQLAlchemy
- 数据库：SQLite（POC）
- 条码引擎：treepoem（BWIPP / Ghostscript）

本文档按“从 0 到能跑、从能跑到能懂”的顺序整理，适合新手学习。

---

## 1. 你将学到什么

通过这个项目你可以掌握：

1. 如何搭建一个前后端分离项目（Next + FastAPI）
2. 如何实现简单登录与登录态保护
3. 如何把业务逻辑做成服务层（GS1 算法、条码生成）
4. 如何把记录落库并做筛选 + 分页
5. 如何在前端做“实时预览 + 模板切换 + 多格式下载（PNG/SVG/PDF）”

---

## 2. 项目结构（你先看懂这个）

```text
gs1-udi-system/
├── backend/                  # FastAPI 后端
│   ├── app/
│   │   ├── api/              # 路由层（接口）
│   │   ├── db/               # 数据库会话与模型
│   │   ├── schemas/          # 请求/响应模型
│   │   └── services/         # 业务逻辑（GS1、条码、认证）
│   ├── data/                 # SQLite 文件目录
│   └── main.py               # 后端入口
├── frontend/                 # Next.js 前端
│   ├── app/                  # 页面（登录页、主页、历史页）
│   ├── components/           # UI组件和业务组件
│   ├── lib/                  # API封装、登录态、模板配置
│   └── types/                # TypeScript 类型
└── README.md
```

一条重要原则：

- `api` 只负责收参/返回
- `services` 负责核心计算
- `db/models` 负责落库结构
- 前端页面负责交互，算法交给后端

---

## 3. 环境准备

> 你当前在 Linux / WSL 场景，推荐以下命令。

### 3.1 后端依赖

```bash
cd backend
uv sync
```

### 3.2 Ghostscript（treepoem 必需）

```bash
which gs && gs --version
```

若没有：

```bash
sudo apt-get update
sudo apt-get install -y ghostscript
```

### 3.3 前端依赖

```bash
cd ../frontend
pnpm install
```

---

## 4. 启动项目（最小步骤）

开两个终端。

### 终端 A：后端

```bash
cd backend
uv run uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

### 终端 B：前端

```bash
cd frontend
pnpm dev
```

打开浏览器：

- 前端：<http://localhost:3000>
- 后端文档：<http://127.0.0.1:8000/docs>

---

## 5. 功能分阶段理解（核心学习路径）

## 阶段 1：基础架构

- 完成前后端脚手架
- 打通 CORS（前端 3000 调后端 8000）
- 后端健康检查接口

你学到：工程最小可运行闭环。

## 阶段 2：GS1 核心逻辑（The Brains）

### 2.1 GTIN-14 校验位

- 采用 GS1 Mod-10 算法
- 先算前 13 位，再对比第 14 位

### 2.2 AI 拼接 + FNC1

- 固定长度 AI：`01`、`17`
- 可变长度 AI：`10`、`21`
- 可变长度后若还有后续字段，需要加 `\x1d`（FNC1 分隔符）

### 2.3 条码生成

- DataMatrix（2D）
- GS1-128（1D）
- 最终转 base64 给前端直接展示

你学到：把“标准规则”写成可复用函数。

## 阶段 3：持久化 + API

- `POST /auth/login`：用户名密码校验
- `POST /labels/generate`：生成并入库
- `GET /labels/history`：历史查询 + 筛选 + 分页

数据库保存：

- 用户ID
- GTIN
- 批号、有效期、序列号
- 完整 GS1 字符串
- 创建时间

你学到：业务链路“算 -> 存 -> 取”。

## 阶段 4：前端业务界面

- 登录页（未登录不能进主页）
- 表单录入 DI/PI
- Dialog 实时预览
- 历史表格 + 筛选 + 翻页
- Toast 状态反馈

你学到：完整业务 UI 闭环。

## 阶段 5：模板与下载能力

- 预览支持多模板（紧凑/双码/明细）
- 导出支持：透明 PNG / SVG / PDF
- 模板已抽象为独立配置

你学到：把“写死逻辑”升级成“配置驱动”。

---

## 6. 当前接口速查

### 认证

- `POST /api/v1/auth/login`

示例：

```json
{
	"username": "demo",
	"password": "demo123"
}
```

默认演示账号：

- `demo / demo123`
- `admin / admin123456`

错误账号返回 `401`。

### 预览（不入库）

- `POST /api/v1/labels/preview`

返回包含：

- `datamatrix_base64`
- `gs1_128_base64`
- `hri`
- `gs1_element_string`

### 生成并入库

- `POST /api/v1/labels/generate`

### 历史查询

- `GET /api/v1/labels/history`
- 支持参数：`gtin`、`batch_no`、`page`、`page_size`

---

## 7. 前端模板系统（你要重点看）

模板配置在：

- `frontend/lib/preview-templates.ts`

模板渲染在：

- `frontend/components/labels/PreviewTemplateCanvas.tsx`

页面只负责：

1. 读模板配置
2. 切换模板状态
3. 调导出函数

这就是“配置驱动”的核心思想。

---

## 8. 常见问题（新手高频）

### Q1：为什么条码生成失败？

先检查：

1. `gs` 是否安装
2. GTIN-14 是否合法（14位且校验位正确）
3. `expiry` 是否是 `YYMMDD`

### Q2：前端显示登录态异常？

- 本项目登录态存本地 `localStorage`
- 可先退出登录再重新登录

### Q3：为什么测试脚本报 `httpx` 缺失？

- 你运行的是 `fastapi.testclient`，需要 `httpx`
- 当前项目已用 `curl` 做接口验证，不影响主流程

---

## 9. 你接下来可以做什么（练手建议）

建议按这个顺序继续：

1. 给 `history` 增加“按时间范围筛选”
2. 增加模板“自定义尺寸/字体/边距”
3. 引入 Alembic 做数据库迁移
4. 把登录从本地会话升级为 JWT
5. 增加单元测试（GS1 算法、API、导出功能）

---

## 10. 一句话总结

你现在有了一个可运行、可登录、可生成、可入库、可筛选分页、可模板切换、可多格式下载的 GS1 UDI POC 系统。

---

## 11. 源码导读地图

如果你想按“从入口到调用链”快速读懂代码，请看：

- [SOURCE_MAP.md](SOURCE_MAP.md)

---

## 12. Ubuntu 线上 Docker 部署（3000 已被占用场景）

你服务器上已有项目占用 `3000`，本项目默认使用：

- 前端：`3001`
- 后端：`18000`

相关文件：

- [docker-compose.prod.yml](docker-compose.prod.yml)
- [.env.prod.example](.env.prod.example)
- [backend/Dockerfile](backend/Dockerfile)
- [frontend/Dockerfile](frontend/Dockerfile)

### 12.1 服务器准备

```bash
sudo apt-get update
sudo apt-get install -y docker.io docker-compose-plugin
sudo systemctl enable docker
sudo systemctl start docker
```

### 12.2 上传项目并进入目录

```bash
cd /path/to/gs1-udi-system
```

### 12.3 配置生产环境变量

```bash
cp .env.prod.example .env.prod
```

编辑 `.env.prod`，最少改这个值：

```env
NEXT_PUBLIC_API_BASE_URL=http://你的服务器公网IP:18000
```

> 如果你有域名，也可以填域名地址。

### 12.4 构建并启动

```bash
docker compose --env-file .env.prod -f docker-compose.prod.yml up -d --build
```

### 12.5 查看状态与日志

```bash
docker compose -f docker-compose.prod.yml ps
docker compose -f docker-compose.prod.yml logs -f
```

### 12.6 验证

- 前端：`http://你的服务器IP:3001`
- 后端健康检查：`http://你的服务器IP:18000/api/v1/health`

---

### 12.7 常用运维命令

重启：

```bash
docker compose -f docker-compose.prod.yml restart
```

停止：

```bash
docker compose -f docker-compose.prod.yml down
```

更新代码后重新部署：

```bash
git pull
docker compose --env-file .env.prod -f docker-compose.prod.yml up -d --build
```
