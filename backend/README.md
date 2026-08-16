# HR 招聘系统 MVP — 后端 (FastAPI)

实现 `hr_ats_agent_mvp_v1.md` 的招聘闭环后端，API 契约与 `frontend/*/src/types` 完全一致。
前端把 `.env` 里的 `VITE_USE_MOCK` 改为 `false` 即可切换到本后端。

## 技术栈与运行方案（v2）

- **FastAPI + Uvicorn**，挂载在 `/api/v1`，默认端口 `8111`（约定）。
- **PostgreSQL 16** 主库，由 `../infra/docker-compose.yml` 统一管理（同目录还含 Redis 7、MinIO）。
- **MinIO** 对象存储简历（桶 `hr-resumes`）；可通过 `STORAGE_BACKEND=local` 回退到本地磁盘。
- **Redis 7** 作为 **Celery** 的 broker / result backend：
  - 简历解析（`parse_resume`）、岗位匹配评分（`analyze_application`）、邮件（`send_email`）均为**异步任务**，请求不再阻塞。
- AI Agent 默认**启发式**实现（PDF/DOCX 解析 + 关键词评分），零外部 API key；预留 `llm` 适配位。
- 邮件**仅日志 + 落库**（`email_logs` 表），作为 Celery 异步任务执行，不真实发送 SMTP。

## 快速开始

```bash
# 0) 起全部中间件（PostgreSQL + Redis + MinIO），见 ../infra
cd ../infra && docker compose up -d && cd ../backend

# 1) 虚拟环境 + 依赖
python -m venv .venv
source .venv/bin/activate          # Windows: .venv\Scripts\activate
pip install -r requirements.txt

# 2) 配置：核对 backend/.env（DATABASE_URL / REDIS_URL / MINIO_* 需与 infra/.env 一致）
#    backend 已通过 python-dotenv 自动加载 .env，无需再内联变量。

# 3) 运行后端 API
uvicorn app.main:app --reload --port 8111

# 4) 运行 Celery worker（另开一个终端）
#    Linux/macOS:
celery -A app.workers.celery_app worker -l info
#    Windows（prefork 不稳，用 solo 池）:
celery -A app.workers.celery_app worker -l info --pool=solo

# 5) 验证
curl http://localhost:8111/api/v1/health
```

> 端口约定：前端 5173/5177、后端 8111、PostgreSQL 5432、Redis 6380（容器内 6379，因本机 6379 被占用）、MinIO 9000/9001（Console 9001）。
> 免 Docker 冒烟：仍可用 `DATABASE_URL=sqlite:///./hr.db STORAGE_BACKEND=local` 跑（无异步任务能力，仅同步兜底，不推荐用于开发）。

启动时会自动建表并写入演示数据：

| 角色 | 邮箱 | 密码 |
|---|---|---|
| 超级管理员 | admin@demo.com | demo1234 |
| HR | hr@demo.com | demo1234 |
| 面试官 | interviewer@demo.com | demo1234 |
| 求职者 | candidate@demo.com | demo1234 |

预置岗位：前端工程师(招聘中)、后端工程师 Python(招聘中)、产品设计师(草稿)。

## 与前端联调

两个前端各自 `npm install && npm run dev`（求职者 5173 / 管理端 5177）。
把 `frontend/*/.env` 中 `VITE_USE_MOCK` 设为 `false`，Vite 代理 `/api` → `http://localhost:8111`。（**改 `.env` 或 `vite.config.*` 后必须重启 dev server 才生效。**）

## 已实现端点（§16）

- `POST /auth/register` · `POST /auth/login` · `GET /auth/me`
- 求职者：`GET/PUT /candidate/profile` · `GET/POST /candidate/resume`
- 公开岗位：`GET /jobs` · `GET /jobs/{id}`
- 投递：`POST /applications` · `GET /applications/my` · `GET /applications/{id}` · `POST /applications/{id}/withdraw`
- 管理岗位：`POST/GET /admin/jobs` · `GET/PUT /admin/jobs/{id}` · `POST .../publish` · `POST .../close`
- 管理候选人：`GET /admin/applications` · `GET /admin/applications/{id}` · `POST .../transition` · `POST .../next-stage` · `POST .../hold` · `POST .../resume` · `POST .../reject` · `GET/POST .../agent-result` · `POST .../agent-rerun`（流程动作均要求填写原因，详情返回真实阶段历史）
- 面试：`POST/GET /admin/interviews` · `PUT /admin/interviews/{id}` · `POST .../cancel` · `GET /interviewer/interviews` · `POST /interviewer/interviews/{id}/feedback`
- 后台用户：`GET/POST /admin/users` · `PUT /admin/users/{id}`
- 面试官下拉：`GET /admin/interviewers`（HR/超管可用，仅返回面试官；安排面试时前端取此列表）

## V2 功能与升级

V2 已加入人才库、候选人标签/来源/负责人/备注、组合搜索、批量操作、Excel
导入导出、面试日历与 ICS、通知中心、Offer 审批/PDF/响应、招聘报表以及完整写操作审计。

岗位现分为实习、社会招聘和校园招聘三类。求职者的「立即申请」使用岗位专属多步向导，
支持基本信息、多段教育/实习/工作/项目经历、语言、证书和自我评价的服务端自动保存。投递时必须
明确选择一份 PDF/DOC/DOCX 简历（最大 10MB），简历在 `PENDING` 解析状态也可提交。投递成功后会
固化资料和岗位类型快照；证件号用独立 Fernet 密钥加密，API 及审计中只出现脱敏值。

升级已有数据库时先执行迁移（生产环境不要依赖 `create_all`）：

```bash
cd backend
alembic upgrade head
```

新增后台任务需要同时运行 Celery worker；Offer 到期处理还需要运行 beat：

```bash
celery -A app.workers.celery_app worker -l info --pool=solo
celery -A app.workers.celery_app beat -l info
```

邮件仍按既定边界模拟发送，`email_logs.delivery_status` 固定为 `SIMULATED`。
模拟 Offer 邮件会写入可直接打开的候选人门户一次性响应地址；按部署环境设置
`CANDIDATE_PORTAL_URL`（本地默认 `http://localhost:5173`）。

管理端新增的实际操作入口包括：人才配置（渠道/标签）、人才库完整组合筛选与分页、
按当前筛选异步导出、日历手工不可用时段、未来七天空闲推荐和日历事件跳转。

> 邮件（md §11）：投递成功 `APPLICATION_RECEIVED`、面试邀请 `INTERVIEW_INVITE` 在相应动作触发；另已接入**面试取消** `INTERVIEW_CANCEL`（取消 SCHEDULED 面试时）与**最终结果通知** `FINAL_RESULT`（推进到 HIRED 或 REJECTED 时）。均仅日志 + 落库 `email_logs`，不真实发送。

## 切换真实 LLM（可选）

设置 `AGENT_PROVIDER=llm` 并实现 `app/agents/llm.py` 中的 `ResumeParserLLM` / `MatcherLLM`（配置 `LLM_API_KEY`）。其余代码无需改动。
