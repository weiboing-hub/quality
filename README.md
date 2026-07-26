# DataMirror 数据清洗对比工作台

一个面向数据治理顾问的可运行 Demo，用“客户主数据治理”场景展示：

- 数据质量画像与清洗前后评分
- 严格、均衡、智能三套规则方案 A/B/C 对比
- 企业名称、电话、地址、统一信用代码标准化
- 字段级变化、命中规则与风险等级追溯
- 低置信度结果人工确认或驳回
- 自定义 CSV 上传与清洗结果导出

项目不依赖外部数据库，启动后直接包含演示数据，适合方案演示和二次开发。

## 界面与流程

```text
上传 CSV → 选择清洗方案 → 查看质量提升 → 查看字段变化
       → 人工复核高风险记录 → 导出清洗结果
```

前端采用 React 企业工作台交互风格，后端提供独立 REST API 和 Swagger 文档。

## 技术栈

- 前端：React 19、TypeScript、Vite
- 后端：FastAPI、Pydantic
- 测试：Pytest
- 部署：Docker Compose、Nginx

## 一键启动

需要安装 Docker Desktop：

```bash
docker compose up --build
```

启动完成后访问：

- 工作台：<http://localhost:5173>
- API 文档：<http://localhost:8000/docs>
- 健康检查：<http://localhost:8000/api/health>

## 本地开发

### 1. 启动后端

```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```

### 2. 启动前端

新开一个终端：

```bash
cd frontend
npm install
npm run dev
```

浏览器访问 <http://localhost:5173>。Vite 会将 `/api` 请求代理到本地 8000 端口。

## CSV 上传格式

可以直接使用 [sample-data/customers.csv](sample-data/customers.csv)。CSV 至少需要以下字段：

| 字段 | 含义 | 必填列 |
|---|---|---|
| `id` | 业务主键；为空时自动生成 | 否 |
| `source` | 数据来源 | 否 |
| `customer_name` | 客户名称 | 是 |
| `phone` | 联系电话 | 是 |
| `address` | 地址 | 是 |
| `credit_code` | 统一社会信用代码 | 是 |

文件编码建议使用 UTF-8 或 UTF-8 with BOM。

## 三套清洗方案

| 方案 | 处理策略 | 适用场景 |
|---|---|---|
| 严格方案 A | 只处理空白、电话和信用代码格式 | 对误修改零容忍 |
| 均衡方案 B | 增加企业名称与行政区划标准化 | 日常数据治理批次 |
| 智能方案 C | 增加企业别名推断，并进入人工复核 | 主数据合并与探索 |

每一次字段修改都会返回原值、新值、规则编号、规则名称和风险级别。

## 主要 API

| 方法 | 路径 | 作用 |
|---|---|---|
| GET | `/api/dashboard?profile=balanced` | 质量指标与批次统计 |
| GET | `/api/records?profile=balanced` | 字段级前后对比 |
| GET | `/api/rules?profile=balanced` | 规则及命中数量 |
| POST | `/api/datasets/upload` | 上传 CSV 原始内容 |
| POST | `/api/reviews/{record_id}` | 提交人工复核结果 |
| GET | `/api/export.csv?profile=balanced` | 导出清洗后数据 |
| POST | `/api/reset` | 恢复内置演示数据 |

## 测试

```bash
cd backend
pytest -q

cd ../frontend
npm run build
```

## 后续可扩展方向

- MySQL/PostgreSQL/Oracle 数据源连接
- 规则可视化编排与版本管理
- 数据集版本、任务历史和回滚
- 基于 Polars/DuckDB 的百万级数据处理
- 重复数据聚类及主记录合并
- RBAC、项目空间与完整审计日志

> 这是数据治理交互原型，不应直接作为生产清洗引擎使用。接入真实生产数据前，应补充权限、脱敏、持久化、并发任务和数据备份能力。
