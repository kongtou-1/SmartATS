# 招聘淘汰流程 & 人才库路由——调查报告

> 范围：后端 FastAPI（`D:/py_work/hr_system/backend`）+ 前端管理台（`D:/py_work/hr_system/frontend/admin-web`）
> 阶段机：`APPLIED(已投递) → SCREENING(简历初筛) → SCREENING_PASSED(初筛通过) → FIRST_INTERVIEW(专业初试) → SECOND_INTERVIEW(技术复试) → FINAL_REVIEW(HR终面) → HIRED(已入职)`
> 申请状态枚举（见 `app/models/recruitment.py:57`）：`ACTIVE | ON_HOLD | HIRED | REJECTED | WITHDRAWN`

---

## 0. 核心结论（先说重点）

1. **"人才库"不是独立表，也不存在"转入人才库"的后端逻辑。** 它就是 `Candidate` 表本身（`app/models/identity.py:77-113`），表里**没有任何"是否在人才库"/"是否被淘汰"/"淘汰原因"的字段**。`list_talents` 直接 `db.query(models.Candidate)` 查询全部候选人（`app/services/talent/talents.py:164-178`，过滤器见 `apply_talent_filters` 第40-62行）。也就是说：**任何投过简历的人都在"人才库"里，包括已入职(ACTIVE/HIRED)和仍然活跃的候选人。** 没有成员标志位。

2. **唯一的"打标签"动作发生在前端初筛工作台**。后端只提供 `add_candidate_tag`（追加标签、不覆盖已有标签，见 `app/services/talent/talents.py:214-227`），且**不承担任何阶段流转或状态变更**。打"初筛淘汰"标签是前端 `ScreeningWorkbenchPage.tsx` 主动调两次接口完成的（见 §3）。

3. **所有 reject 路径最终都调用 `_reject_application`，统一把 `current_stage="REJECTED" , status="REJECTED"`**。除了初筛工作台会"顺手"打标签外，**面试阶段淘汰、批量淘汰、Offer 拒绝，都不会打任何标签，也没有"转入人才库"动作**。因此这些候选人虽然"在人才库里"（因为人人都在），但**没有任何标签、没有结构化"在某阶段被淘汰"标记**（只有 `ApplicationStageHistory` 里的 from→to + reason 记录）。

4. **不一致点**：只有"初筛淘汰"会被打专用标签；面试阶段淘汰 / Offer 拒绝 / 批量淘汰都不打标签。想从人才库里区分"谁是被哪个阶段淘汰的"，后端只能靠 `ApplicationStageHistory`（reason 文本 + from_stage），不可靠、不可筛选。

5. **不存在"面试爽约/缺勤(no-show)"的任何处理**（grep `no_show|noshow|爽约|缺勤|未到场|absent` 全部无匹配）。

---

## 1. 后端所有"淘汰/拒绝"发生点（每个点的阶段 & 是否转人才库/打标签）

### 1.1 通用拒绝核心：`_reject_application`  —— ALL 阶段可用，不打标签、不转库
`app/services/recruitment/applications.py:423-437`
```python
def _reject_application(db, app, user, reason):
    _enforce_interview_feedback(db, app, "reject")          # 面试阶段淘汰要求已提交面评
    if app.status not in {"ACTIVE", "ON_HOLD"}:
        raise HTTPException(400, "该申请已结束")
    _record_stage(db, app, "REJECTED", user, reason.strip())  # 写历史（含 reason）
    app.current_stage = "REJECTED"
    app.status = "REJECTED"
    db.commit()
    # ...发送"未录用"通知邮件
```
- 入口接口：`POST /admin/applications/{application_id}/reject`（`app/api/admin/applications.py:15` 注册） → `reject_application`（第411-420行）。
- 可作用于任意 `ACTIVE/ON_HOLD` 阶段。
- **转人才库？否。打标签？否。** 仅改状态 + 写历史 + 发邮件。

### 1.2 面试阶段淘汰（初/复/终面）：`confirm_feedback`
`app/services/recruitment/interviews.py:258-334`
- ADOPT + 面试官建议 FAIL → `_reject_application`（第300-302行）
- HR 直接选 REJECT 模式 → `_reject_application`（第311-313行）
- 这两种都发生在 `FIRST_INTERVIEW / SECOND_INTERVIEW / FINAL_REVIEW` 阶段。
- **转人才库？否。打标签？否。**
- 门禁：`_enforce_interview_feedback`（`applications.py:263-272`）——面试阶段拒绝必须先有 `InterviewFeedback` 提交，否则 400。

### 1.3 批量拒绝：`bulk_actions` REJECT
`app/services/recruitment/bulk_actions.py:45-48`
```python
elif payload.action == "REJECT":
    if not payload.reason.strip(): raise ValueError("拒绝原因不能为空")
    if app.status not in {"ACTIVE", "ON_HOLD"}: raise ValueError("该申请已结束")
    _record_stage(db, app, "REJECTED", user, payload.reason)
    app.current_stage = "REJECTED"; app.status = "REJECTED"
```
- 入口：`POST /admin/bulk-actions`（`app/api/admin/bulk_actions.py:9`）。
- 可批量作用于任意阶段。
- **转人才库？否。打标签？否。**

### 1.4 Offer 拒绝（终面后）：`offers.respond` DECLINE
`app/services/recruitment/offers.py:126-143`
```python
else:  # decision != ACCEPT
    offer.status = "DECLINED"; app.current_stage = "REJECTED"; app.status = "REJECTED"
    db.add(ApplicationStageHistory(application_id=app.id, from_stage="FINAL_REVIEW",
            to_stage="REJECTED", changed_by=..., reason=reason or "候选人拒绝 Offer"))
```
- 由候选人点击 Offer 响应链接触发（非管理员主动淘汰）。
- **转人才库？否。打标签？否。** 只写历史 + 改状态。

### 1.5 候选人主动撤回：`withdraw_application`（NOT 淘汰）
`app/services/recruitment/applications.py:151-162`
```python
_record_stage(db, app, "WITHDRAWN", user, "候选人主动撤回申请")
app.current_stage = "WITHDRAWN"; app.status = "WITHDRAWN"
```
- 这是 `WITHDRAWN`，**不是 `REJECTED`**，不进"被淘汰"语义，也不在人才库"可筛选的淘汰标签"里。但 `VALID_STAGES` 包含 `WITHDRAWN`（`talents.py:17`），所以撤回者仍出现在人才库列表中。

### 汇总表
| 淘汰点 | 文件:行 | 适用阶段 | 转人才库 | 打标签 |
|---|---|---|---|---|
| `_reject_application`（/reject 接口） | applications.py:423-437 | 任意 | 否（人人都在库） | 否 |
| `confirm_feedback` ADOPT+FAIL | interviews.py:300-302 | 初/复/终面 | 否 | 否 |
| `confirm_feedback` REJECT 模式 | interviews.py:311-313 | 初/复/终面 | 否 | 否 |
| `bulk_actions` REJECT | bulk_actions.py:45-48 | 任意 | 否 | 否 |
| `offers.respond` DECLINE | offers.py:140-142 | FINAL_REVIEW | 否 | 否 |
| `withdraw_application` | applications.py:151-162 | 任意 | 否（且非 REJECTED） | 否 |
| 初筛工作台前端打"初筛淘汰"标签 | 见 §3 | SCREENING | 否（仅打标签） | **是（仅此处）** |

---

## 2. 各项专项核对

### 2.1 初筛淘汰（SCREENING）
- 后端没有"初筛淘汰专用"逻辑。`/reject` 接口到达 SCREENING 阶段时，走的仍是通用 `_reject_application`（applications.py:423-437），**不打标签**。
- 真正"打初筛淘汰标签"的是前端（见 §3）。
- 因此：初筛淘汰的"标签"完全依赖前端两次调用成功；若标签接口失败，候选人仍会被 reject，但无标签（前端 `catch` 吞掉异常，`ScreeningWorkbenchPage.tsx:136-138`）。

### 2.2 面试阶段（FIRST/SECOND/FINAL）淘汰
- 全部经 `confirm_feedback` → `_reject_application`（interviews.py:300-302 / 311-313）。
- **无任何标签、无"转库"动作。** 这就是与初筛最大的不一致：初筛会打"初筛淘汰"标签，面试淘汰没有任何标签。

### 2.3 "汇总人才库" vs "已入职" 结果
- "已入职"只能源于 Offer 接受：`offers.respond` ACCEPT 置 `HIRED`（offers.py:137-139）。
- 没有任何"批量汇总转入人才库/不转入"的代码路径（grep `人才库|转人才|talent.*transfer` 仅命中一个 Excel 导出 sheet 标题 `excel_io.py:55`，非逻辑）。
- 结论：人才库 = 全部候选人，与是否入职/淘汰无关，**没有"汇总"区分逻辑**。

---

## 3. 初筛工作台（ScreeningWorkbench）后端逻辑核实

**结论：没有专属后端逻辑，完全是前端编排（两次接口调用）。**

后端相关：
- 标签追加：`add_candidate_tag`（`app/services/talent/talents.py:214-227`）—— docstring 明确写 "used by screening reject"，**仅追加标签，不覆盖已有标签，不碰阶段/状态**。
- 路由：`POST /admin/talents/{candidate_id}/tags`（`app/api/admin/talents.py:13`）。
- 通用 reject 路由：`POST /admin/applications/{application_id}/reject`（`app/api/admin/applications.py:15`）。

前端编排（`frontend/admin-web/src/pages/ScreeningWorkbenchPage.tsx`）：
- 43-57 行 `useEffect`：拉取（不存在则创建）名为 `初筛淘汰`、颜色 `#e2553f` 的标签，拿到 `failTagId`。
- 123-152 行 `decide(outcome)`：当 `outcome === 'rejected'`：
  - 第132行 `await api.adminReject(id, '初筛未通过')` → 调 `/admin/applications/{id}/reject`
  - 第133-139行 `if (failTagId) await api.adminAddCandidateTag(candidateId, failTagId)` → 调 `/admin/talents/{id}/tags`
  - 第136-138行：标签追加失败 **try/catch 吞掉，不阻断淘汰**。
- 接口定义：`adminReject` / `adminAddCandidateTag`（`frontend/admin-web/src/lib/api.ts:205-216`）。

**即用户记忆"淘汰自动打初筛淘汰标签并转人才库"——部分正确：确实自动打标签，但"转人才库"是错觉（人人都在库）；且标签与 reject 是两个独立调用，标签失败不影响 reject。**

---

## 4. 哪些面试阶段淘汰"不进人才库"？

- 严格说：所有候选人（含面试淘汰、Offer 拒绝、批量淘汰、撤回）都"在人才库列表里"，因为列表 = 全部 `Candidate`。
- **但没有任何结构化标记表明"这些是被面试淘汰的"**：
  - 面试淘汰（interviews.py:300-302 / 311-313）：**无标签、无专用状态字段**。
  - Offer 拒绝（offers.py:140-142）：**无标签**。
  - 批量淘汰（bulk_actions.py:45-48）：**无标签**。
- 唯一的语义区分只能从 `ApplicationStageHistory`（from_stage=FIRST_INTERVIEW/...→to_stage=REJECTED, reason）反查，但该字段是自由文本、不可作为筛选维度（人才库 `list_talents` 的 `stage` 过滤只看 `Application.current_stage`，见 `talents.py:40-62` 与 `:167`）。
- **面试爽约/缺勤：系统中完全不存在该处理**（无任何 no-show 逻辑），故也不存在对应的淘汰/入库路径。

---

## 5. 是否有"为什么被拒 + 在哪个阶段"的结构化字段？

**有，且是唯一的权威来源：`ApplicationStageHistory`。**
- 模型：`app/models/recruitment.py:67-78`
  - `from_stage` (String32, nullable)
  - `to_stage` (String32, nullable)
  - `changed_by` (UUID)
  - `reason` (Text, nullable)
- 写入点：每次 reject/withdraw/advance/hold 都经 `_record_stage`（applications.py:48-65），reject 时 `to_stage="REJECTED"`、reason=拒绝原因。
- 前台暴露：`app/utils/presenters.py`
  - `_history_action`（24-35行）：`to_stage=="REJECTED"` → action="REJECT"。
  - `_stage_history`（38-65行）：admin 视图带 `reason=row.reason or ""`、`changed_by`、`changed_by_name`，即 **reject 的"原因+阶段"对人才库成员可见**（在申请详情的历史里）。
- **结论**：淘汰原因+阶段**不是只存在标签里**——`ApplicationStageHistory.reason` 是结构化记录（优于标签）。但 `Candidate` 表本身无此字段，人才库列表页不可按"被拒阶段/原因"直接筛选，只能进申请详情看历史。标签只是"初筛淘汰"这一种人工标记，覆盖不全。

---

## 6. 测试覆盖（tmp/smoke_*.py / test 文件）

- **`tmp/smoke_*.py` 不存在**（Glob 全仓无匹配）。
- 现有后端测试覆盖：
  - `backend/tests/test_feedback_flow.py:152-168`（`test_4_hr_custom_reject`）：在 `SECOND_INTERVIEW` 经 `confirm_feedback` REJECT 模式拒绝，断言 `status == "REJECTED"`。**无人才库/标签断言。**
  - `backend/tests/test_v2.py:145-151`（`test_public_offer_decline_rejects_application_and_invalidates_token`）：Offer DECLINE 后断言 `status == "REJECTED"`、`current_stage == "REJECTED"`。**无标签/入库断言。**
  - `backend/tests/e2e_full_loop.py:129-131`：拒绝 AppB → `REJECTED`。
  - `test_workflow.py`、`test_application_profile.py`、`test_architecture.py`：无 reject/人才库覆盖。
- **缺口**：没有任何测试验证"淘汰后是否打标签 / 是否出现在人才库 / 人才库列表过滤逻辑"，也没有覆盖"初筛淘汰标签自动追加"这条前端编排链路。

---

## 7. 建议修复方向（供后续实现规划）

1. 在 `Candidate` 或 `Application` 上增加结构化"是否在人才库 / 淘汰阶段 / 淘汰原因"字段，或至少让 `list_talents` 可按 `ApplicationStageHistory` 反查被拒阶段来筛选（目前 `stage` 过滤只看 `current_stage`）。
2. 把"打初筛淘汰标签"从前端两次调用下沉到后端 `_reject_application`，按来源阶段自动决定标签，消除"前端标签失败但淘汰成功"的不一致。
3. 面试阶段淘汰、Offer 拒绝、批量淘汰补打相应标签（如"面试淘汰""拒Offer"），与初筛保持一致，或统一用阶段历史而非标签标识。
4. 明确人才库语义：是否应包含 ACTIVE/HIRED/已撤回者？如需"仅被淘汰"，应在查询层排除非 REJECTED 阶段，而非默认全量。
5. 增加测试：reject→出现在人才库、reject→标签断言、人才库按被拒阶段筛选。
