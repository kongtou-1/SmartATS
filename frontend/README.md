# HR 招聘系统 · 前端 (MVP V1)

基于 [hr_ats_agent_mvp_v1.md](../hr_ats_agent_mvp_v1.md) 的 MVP 前端，技术栈 **React + TypeScript + Vite**。
按规格拆分为两套前端：求职者端 `candidate-web` 与管理端 `admin-web`（管理端同时供 HR / 面试官 / 超级管理员复用，按角色做路由与权限控制）。

## 目录

```
frontend/
├── candidate-web/   求职者端（12 个页面）
├── admin-web/       管理端（18 个页面，面试官复用）
├── eslint.config.js 统一 ESLint 规则
└── package.json     格式化、检查和两端构建入口
```

## 求职者端 candidate-web

| 页面       | 路由                                   | 说明                                             |
| ---------- | -------------------------------------- | ------------------------------------------------ |
| 岗位列表   | `/`                                    | 浏览招聘中岗位、关键词搜索                       |
| 岗位详情   | `/jobs/:id`                            | 查看 JD、立即申请                                |
| 登录       | `/login`                               | 邮箱 + 密码                                      |
| 注册       | `/register`                            | 邮箱 + 密码                                      |
| 我的简历   | `/resume`                              | 维护一份当前简历（PDF/DOCX）、查看解析结果       |
| 我的申请   | `/applications`                        | 投递记录、当前进度                               |
| 申请详情   | `/applications/:id`                    | 进度时间线 + 面试信息（不展示 AI 分数/内部备注） |
| 结构化投递 | `/jobs/:id/apply`                      | 分步填写资料、上传简历并提交申请                 |
| 我的 Offer | `/offers`                              | 查看候选人的 Offer                               |
| Offer 回复 | `/offer-response/:token`               | 通过一次性链接接受或拒绝 Offer                   |
| 招聘动态   | `/announcements`、`/announcements/:id` | 查看招聘公告与动态                               |

## 管理端 admin-web

| 页面         | 路由                           | 角色                                                                                 |
| ------------ | ------------------------------ | ------------------------------------------------------------------------------------ |
| 登录         | `/login`                       | 全部后台角色                                                                         |
| 岗位列表     | `/jobs`                        | HR / 超级管理员                                                                      |
| 岗位编辑     | `/jobs/new`、`/jobs/:id/edit`  | HR / 超级管理员                                                                      |
| 候选人列表   | `/candidates`                  | HR / 超级管理员                                                                      |
| 候选人详情   | `/candidates/:id`              | HR / 超级管理员（最核心页面：资料/简历/AI 结果/阶段/面试/面评 + 推进/拒绝/安排面试） |
| 面试列表     | `/interviews`                  | 全部后台角色                                                                         |
| 面试详情     | `/interviews/:id`              | 全部后台角色（面试官可填写面评）                                                     |
| 后台用户     | `/users`                       | 仅超级管理员                                                                         |
| 人才库与配置 | `/talents`、`/talent-settings` | HR / 超级管理员                                                                      |
| 招聘日历     | `/calendar`                    | 全部后台角色                                                                         |
| Offer 管理   | `/offers`                      | HR / 超级管理员                                                                      |
| 招聘报表     | `/reports`                     | HR / 超级管理员                                                                      |
| 通知         | `/notifications`               | 全部后台角色                                                                         |
| 审计日志     | `/audit`                       | 仅超级管理员                                                                         |
| 岗位方向     | `/job-categories`              | HR / 超级管理员                                                                      |
| 招聘动态管理 | `/announcements`               | HR / 超级管理员                                                                      |

角色权限矩阵严格参照规格 §14 在路由层（`RequireRole`）与按钮层实现。

## 运行

两个应用各自独立安装与启动：

```bash
# 求职者端
cd frontend/candidate-web
npm install
npm run dev      # http://localhost:5173

# 管理端
cd frontend/admin-web
npm install
npm run dev      # http://localhost:5177
```

生产构建：`npm run build`（产物在 `dist/`），可由 Nginx 托管。

## 工程检查

前端根目录统一维护 ESLint、Prettier 和两端检查命令：

```bash
cd frontend
npm install
npm run format       # 格式化两端源码
npm run lint         # ESLint 检查
npm run typecheck    # 两端 TypeScript 检查
npm run check        # format:check + lint + typecheck
npm run build        # 两端生产构建
```

复杂业务按 `src/features/<domain>` 组织；页面负责路由数据加载和流程编排，领域目录负责表单、展示组件、校验、Hook 与专属样式。Mock 后端的存储和迁移逻辑集中在各应用的 `src/lib/mockDb.ts`。

## 数据来源：Mock 模式 vs 真实后端

两份应用都内置一个 **localStorage 模拟后端**（`src/lib/mock.ts`），完整复刻规格 §16 的 API 契约，
默认开启（`VITE_USE_MOCK=true`）。这样在后端尚未就绪时，整套 MVP 招聘闭环即可在浏览器中跑通演示。

切换到真实 FastAPI 后端：

1. 将各自 `.env` 中的 `VITE_USE_MOCK` 改为 `false`（已默认 `false`）；
2. 确保后端在 `http://localhost:8111` 提供 `/api/v1`；Vite 开发服务器已配置 `/api` 代理转发到该地址。
   也可显式设置 `VITE_API_BASE=http://localhost:8111/api/v1` 关闭代理、直连后端。
3. 改完 `.env` 后**重启 Vite 开发服务器**（`npm run dev` 才会重新读取环境变量）。

> 注意：Mock 模式数据按应用源（端口）隔离存储。在浏览器中分别打开 5173 / 5177 演示时，
> 求职者投递的数据不会跨端口同步到管理端——这是模拟数据的限制，接入真实后端后即天然打通。

## 演示账号（Mock 模式）

| 角色       | 邮箱                 | 密码     |
| ---------- | -------------------- | -------- |
| 求职者     | candidate@demo.com   | demo1234 |
| HR         | hr@demo.com          | demo1234 |
| 面试官     | interviewer@demo.com | demo1234 |
| 超级管理员 | admin@demo.com       | demo1234 |

管理端 Mock 已预置岗位、候选人、AI 匹配结果、面试与面评，登录即可直接体验。

## 已实现的 MVP 闭环

求职者注册 → 查看岗位 → 上传简历 → 投递 → AI 自动匹配评分；
HR 查看候选人/AI 结果 → 推进阶段 / 拒绝 → 安排面试 → 面试官填写面评 → 给出最终结果，
候选人端同步查看进度与面试信息。完全符合规格“无需人工改库即可跑通”的目标。

## 已补齐的交互缺口（真实后端模式下）

- **求职者「撤回申请」**：在「申请详情」页，状态为 ACTIVE 且处于可撤回阶段（APPLIED/SCREENING/FIRST_INTERVIEW/SECOND_INTERVIEW/FINAL_REVIEW）时可撤回；「我的申请」列表内也提供撤回入口（不影响已录用/已拒绝/已取消的申请）。
- **HR「取消面试」**：在「面试详情」页，状态为 SCHEDULED 且当前用户为 HR / 超级管理员时，可取消面试，候选人将收到（模拟落库）取消通知邮件。
- **面试官下拉改用 `/admin/interviewers`**：管理端安排面试时拉取面试官列表，HR 角色也能正常加载（不再依赖仅超管可见的 `/admin/users`）。

## 邮件（模拟）

后端 `email/sender.py` 仅**记录日志 + 落库**（`email_logs` 表），不发真实 SMTP。覆盖 4 类：
`APPLICATION_RECEIVED`（投递成功）、`INTERVIEW_INVITE`（面试邀请）、`INTERVIEW_CANCEL`（取消面试）、`FINAL_RESULT`（最终结果：录用/拒信）。
