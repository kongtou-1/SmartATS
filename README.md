# HR System · 招聘 / ATS 全栈系统

> **Open-source Recruiting & ATS Full-stack System** — 覆盖「求职者投递 → 筛选 → 面试 → Offer → 录用」的完整招聘闭环。

一个基于 FastAPI + React 的全栈招聘管理系统（ATS），内置可插拔的 AI Agent 层、四角色权限模型，以及岗位 / 候选人 / 人才库 / 面试 / Offer / 报表的全流程管理能力。

---

## 核心特性 / Features

- **🤖 可插拔 AI Agent 层 / Pluggable AI Agent Layer** — 简历解析与岗位契合度评分通过统一接口 `app/agents/` 抽象，默认启发式引擎开箱即用，并预留 LLM 接入点。详见 [AI 能力（规划中）](#ai-能力规划中--ai-capabilities-roadmap)。
- **四角色权限 / 4-role RBAC** — 求职者 Candidate、HR、面试官 Interviewer、超级管理员 Super Admin，权限矩阵在后端 `app/core/permissions.py` 与前端 `RequireRole` 实现。
- **岗位与候选人全流程 / Full Pipeline** — 岗位发布 → 投递 → 阶段流转（APPLIED → SCREENING → … → HIRED）→ 批量操作。
- **人才库 / Talent Pool** — 拒绝候选人可一键进入人才库，支持标签、来源、负责人管理，后续可重新激活。
- **面试与 Offer 管理 / Interview & Offer** — 面试安排、面评、Offer 审批与 PDF 生成、一次性接受/拒绝链接、ICS 日历订阅。
- **报表与审计 / Reports & Audit** — 招聘漏斗报表、操作审计日志。
- **Docker 一键中间件 / One-command Infra** — `infra/docker-compose.yml` 起 Postgres / Redis / MinIO / Adminer。

---

## 技术栈 / Tech Stack

| 层 / Layer | 技术 / Stack |
|---|---|
| 前端 / Frontend | React + TypeScript + Vite（`candidate-web` 5173 / `admin-web` 5177） |
| 后端 / Backend | FastAPI + SQLAlchemy 2.x + Pydantic v2 + Celery + MinIO |
| 数据 / Data | PostgreSQL（SQLite 兜底）+ Redis（Celery broker） |
| 部署 / Infra | Docker Compose |

---

## AI 能力（规划中）/ AI Capabilities (Roadmap)

系统从设计之初就把「AI 招聘」作为核心，但 **当前版本尚未接入任何正式大模型 / LLM，AI 为规则式启发式实现**。

- **默认：启发式引擎 / Heuristic Engine** — `app/agents/heuristic.py`
  - 简历解析：基于 `pdfminer` / `python-docx` 抽取文本，正则提取邮箱/手机号，关键词字典识别技能。零外部依赖，开箱即用。
  - 岗位匹配：将 JD 任职要求分词，与简历文本做关键词重叠率评分（`score = 50 + hit_rate*50`），输出 strengths / gaps / recommendation。
- **已预留：LLM 适配接口 / LLM Adapter Stub** — `app/agents/llm.py`
  - 通过配置 `AGENT_PROVIDER=llm` 即可切换到真实大模型；当前该接口为占位实现（`NotImplementedError`），**尚未接入正式 AI 服务 / not yet wired to a real LLM**。
- **路线 / Roadmap** — 后续将接入正式大模型（如 GPT / Claude / Gemini），实现更精准的语义化简历解析与智能人岗匹配，并保留启发式引擎作为无密钥降级方案。

> ⚠️ 诚实说明：仓库内 `招聘管理后台/` 是一份 AI Studio 导出的实验性原型（含 `@google/genai` 依赖但未真实调用），**不属于本系统、未纳入本仓库**。

---

## 快速开始 / Quick Start

### 后端 / Backend

```bash
cd backend
python -m venv .venv && source .venv/bin/activate   # Windows: .venv\Scripts\activate
pip install -r requirements.txt
cp .env.example .env                                # AGENT_PROVIDER=heuristic by default
uvicorn app.main:app --port 8111 --no-reload       # API at http://localhost:8111/api/v1
```

### 前端 / Frontend

```bash
# 管理端 Admin web (port 5177)
cd frontend/admin-web && npm install && npm run dev

# 求职者端 Candidate web (port 5173)
cd frontend/candidate-web && npm install && npm run dev
```

前端支持 `VITE_USE_MOCK` 本地 Mock 模式（无后端也可演示）；设为 `false` 即连接 `http://localhost:8111/api/v1`。

---

## 项目结构 / Project Structure

```
hr_system/
├── backend/                 # FastAPI 后端：auth / jobs / candidates / interviews / offers / talents / reports / audit
│   └── app/agents/          # AI 层：heuristic.py（默认） + llm.py（预留接入点）
├── frontend/
│   ├── admin-web/           # 管理端 React 应用
│   └── candidate-web/       # 求职者端 React 应用
├── infra/                   # docker-compose：Postgres / Redis / MinIO / Adminer
└── README.md
```

---

## 部署 / Deployment

中间件（数据库、缓存、对象存储）通过 Docker Compose 启动：

```bash
cd infra && docker compose up -d
```

后端 `.env` 中的 `DATABASE_URL` / `REDIS_URL` / `MINIO_*` 需与 `infra/.env` 对齐。

---

## 说明 / Notes & License

- 当前 AI 能力为启发式引擎，**未接入正式大模型**，相关 LLM 接口为规划中的占位实现。
- `招聘管理后台/` 为未集成的实验性原型，**不包含在仓库内**（已在 `.gitignore` 排除）。
- License：Apache License 2.0（仓库根目录 `LICENSE`）。
