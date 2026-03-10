# Backend (FastAPI)

## 阶段 1 完成项

- FastAPI 项目初始化
- SQLite + SQLAlchemy 基础连接
- `treepoem` 运行依赖说明（Ghostscript）
- CORS 允许前端 `http://localhost:3000`

## 依赖安装

```bash
uv sync
```

## Ghostscript 检查（WSL Ubuntu）

```bash
which gs && gs --version
```

若未安装：

```bash
sudo apt-get update
sudo apt-get install -y ghostscript
```

## 启动服务

```bash
uv run uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

## 语法检查（uv）

```bash
uv run python -m compileall .
```

## 健康检查

- `GET /api/v1/health`

## 阶段 2：GS1 预览接口

- `POST /api/v1/labels/preview`

请求示例：

```json
{
	"di": "09506000134352",
	"production_date": "16/01/01",
	"lot": "LOT202603",
	"expiry": "28/02/29",
	"serial": "SN0001"
}
```

返回包含：

- `hri`（带 AI 括号可读串）
- `gs1_element_string`（含 `\x1d` 分隔）
- `datamatrix_base64`（可直接前端渲染）

## 阶段 3：持久化与查询

### 1) 模拟登录（POC）

- `POST /api/v1/auth/login`

```json
{
	"username": "demo",
	"password": "demo123"
}
```

返回 `user_id`，用于后续生成接口。

默认账号（启动时自动创建）：

- `demo / demo123`
- `admin / admin123456`

用户名或密码错误时返回 `401`。

### 2) 生成并入库

- `POST /api/v1/labels/generate`

```json
{
	"user_id": 1,
	"di": "09506000134352",
	"production_date": "16/01/01",
	"lot": "LOT202603",
	"expiry": "28/02/29",
	"serial": "SN0001"
}
```

返回内容包含：`history_id`、`created_at`、`datamatrix_base64`。

### 3) 历史查询

- `GET /api/v1/labels/history`
- 支持筛选参数：`gtin`、`batch_no`
