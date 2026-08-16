"""Seed demo data so the MVP closed loop is usable immediately.

Runs automatically on startup and is idempotent per entity. Accounts are seeded into
the two isolated tables: management demo users go to `admin_accounts`, job seekers to
`candidate_accounts`. Mirrors the demo accounts / jobs from the frontend mock so
`VITE_USE_MOCK=false` works out of the box.
"""
from datetime import datetime, timedelta, timezone
import random

from .services.database import SessionLocal
from .core.security import hash_password
from . import models


_DEMO_PASSWORD = "demo1234"

# Reports demo seed: ~540 applications covering 5 channels & 6 funnel stages.
# Distribution mirrors the funnel screenshot: 540 / 198 / 82 / 28 / 14 / 11.
_REPORT_SEED_BUCKETS = (
    ["APPLIED"]         * 342
  + ["SCREENING"]       * 116
  + ["FIRST_INTERVIEW"] *  54
  + ["SECOND_INTERVIEW"]*  14
  + ["OFFERS_SENT"]     *   3
  + ["HIRED"]           *  11
)
assert len(_REPORT_SEED_BUCKETS) == 540

_REPORT_SEED_CHANNELS = [
    ("BOSS",        "BOSS直聘",    260),
    ("REFERRAL",    "员工内推",    120),
    ("AGENCY",      "猎头机构",     75),
    ("CAREER_SITE", "官网招聘",     55),
    ("CAMPUS",      "校园宣讲",     30),
]


def seed_if_empty() -> None:
    db = SessionLocal()
    try:
        # Source channels: per-code ensure (idempotent — adds BOSS without
        # touching already-seeded channels on existing dev DBs).
        desired_channels = [
            ("UNKNOWN", "未知"),
            ("CAREER_SITE", "官网"),
            ("REFERRAL", "内推"),
            ("JOB_BOARD", "招聘网站"),
            ("AGENCY", "猎头"),
            ("CAMPUS", "校园"),
            ("OTHER", "其他"),
            ("BOSS", "BOSS直聘"),
        ]
        existing_channels = {c.code: c for c in db.query(models.SourceChannel).all()}
        for idx, (code, name) in enumerate(desired_channels):
            if code not in existing_channels:
                db.add(models.SourceChannel(code=code, name=name, sort_order=idx))
        db.commit()
        src_by_code = {c.code: c for c in db.query(models.SourceChannel).all()}

        now = datetime.now(timezone.utc)

        def ensure_admin(email: str, name: str, role: str, title: str = "") -> models.AdminAccount:
            """Idempotently create a management-end account (`admin_accounts`)."""
            user = db.query(models.AdminAccount).filter(models.AdminAccount.email == email).first()
            if user is None:
                user = models.AdminAccount(
                    email=email,
                    password_hash=hash_password(_DEMO_PASSWORD),
                    name=name,
                    role=role,
                    title=title,
                    status="ACTIVE",
                )
                db.add(user)
                db.commit()
                db.refresh(user)
            return user

        def ensure_candidate_account(email: str, name: str) -> models.CandidateAccount:
            """Idempotently create a C-end account (`candidate_accounts`)."""
            user = db.query(models.CandidateAccount).filter(models.CandidateAccount.email == email).first()
            if user is None:
                user = models.CandidateAccount(
                    email=email,
                    password_hash=hash_password(_DEMO_PASSWORD),
                    name=name,
                    status="ACTIVE",
                )
                db.add(user)
                db.commit()
                db.refresh(user)
            return user

        # Direction owners (used as category owners)
        owner_zhangchen = ensure_admin("zhangchen@demo.com", "张晨", "DIRECTION_OWNER", "技术委员会主席 / 技术VP")
        owner_heyue = ensure_admin("heyue@demo.com", "何悦", "DIRECTION_OWNER", "用户运营与增长总监")
        owner_liwei = ensure_admin("liwei@demo.com", "李维", "DIRECTION_OWNER", "服务端架构师")
        owner_zhoubo = ensure_admin("zhoubo@demo.com", "周博", "DIRECTION_OWNER", "AI工程化负责人")
        owner_songzixuan = ensure_admin("songzixuan@demo.com", "宋子轩", "DIRECTION_OWNER", "移动端技术组长")

        # Job directions / categories — seed independently so existing dev DBs
        # (that already have users) still gain the configurable direction list.
        if db.query(models.JobCategory).count() == 0:
            categories = [
                models.JobCategory(code="RND", name="研发", sort_order=1, owner_id=owner_zhangchen.id),
                models.JobCategory(code="OPS", name="运营", sort_order=2, owner_id=owner_heyue.id),
                models.JobCategory(code="PRODUCT", name="产品", sort_order=3),
                models.JobCategory(code="MARKET", name="市场", sort_order=4),
                models.JobCategory(code="FUNCTION", name="职能", sort_order=5),
                models.JobCategory(code="RND_FE", name="前端", parent_code="RND", sort_order=1, owner_id=owner_zhangchen.id),
                models.JobCategory(code="RND_BE", name="后端", parent_code="RND", sort_order=2, owner_id=owner_liwei.id),
                models.JobCategory(code="RND_AI", name="算法与AI", parent_code="RND", sort_order=3, owner_id=owner_zhoubo.id),
                models.JobCategory(code="RND_MOBILE", name="移动端与跨端", parent_code="RND", sort_order=4, owner_id=owner_songzixuan.id),
            ]
            db.add_all(categories)
            db.commit()

        # Recruitment announcements / dynamics — seed independently when empty.
        if db.query(models.Announcement).count() == 0:
            db.add(models.Announcement(
                type="DYNAMIC",
                title="2026 春季校招正式启动",
                content="本轮校招覆盖研发、产品、运营等多个方向，欢迎投递！",
                status="PUBLISHED",
                pinned=True,
                published_at=now,
            ))
            db.commit()

        # Core demo users
        admin = ensure_admin("admin@demo.com", "超级管理员", "SUPER_ADMIN")
        hr = ensure_admin("hr@demo.com", "示例 HR", "HR")
        interviewer = ensure_admin("interviewer@demo.com", "示例面试官", "INTERVIEWER")
        candidate_user = ensure_candidate_account("candidate@demo.com", "示例求职者")

        # Candidate profile
        candidate = db.query(models.Candidate).filter(models.Candidate.user_id == candidate_user.id).first()
        if candidate is None:
            db.add(models.Candidate(
                user_id=candidate_user.id, name="示例求职者", phone="13800000000",
                normalized_phone="13800000000", contact_email=candidate_user.email,
                normalized_email=candidate_user.email.lower(), city="深圳"
            ))
            db.commit()

        # Demo jobs
        if db.query(models.Job).count() == 0:
            j1 = models.Job(
                title="前端工程师",
                location="深圳",
                description="负责公司核心产品 Web 前端开发，参与组件库建设与性能优化。",
                requirements="1. 熟练掌握 React/Vue 等主流框架；\n2. 熟悉 TypeScript；\n3. 理解前端工程化与构建工具；\n4. 3 年以上相关经验。",
                category_code="RND_FE",
                job_type="SOCIAL",
                headcount=3,
                salary_negotiable=False,
                salary_min_k=18,
                salary_max_k=30,
                status="PUBLISHED",
                created_by=hr.id,
                published_at=now,
            )
            j2 = models.Job(
                title="后端工程师 (Python)",
                location="上海",
                description="负责招聘系统后端服务开发，基于 FastAPI 构建高可用 API。",
                requirements="1. 精通 Python；\n2. 熟悉 FastAPI / SQLAlchemy；\n3. 熟悉 PostgreSQL；\n4. 有 AI 集成经验者优先。",
                category_code="RND_BE",
                job_type="CAMPUS",
                headcount=5,
                salary_negotiable=False,
                salary_min_k=15,
                salary_max_k=25,
                status="PUBLISHED",
                created_by=hr.id,
                published_at=now,
            )
            j3 = models.Job(
                title="产品设计师",
                location="北京",
                description="负责产品交互与视觉设计。",
                requirements="1. 熟练使用 Figma；\n2. 有 B 端产品设计经验。",
                category_code="PRODUCT",
                job_type="INTERN",
                headcount=1,
                salary_negotiable=True,
                salary_min_k=None,
                salary_max_k=None,
                status="DRAFT",
                created_by=hr.id,
            )
            j4 = models.Job(
                title="算法工程师 (推荐/搜索)",
                location="深圳",
                description="负责推荐与搜索算法研发，构建大规模机器学习排序与召回系统。",
                requirements="1. 扎实的机器学习基础；\n2. 熟悉 PyTorch / TensorFlow；\n3. 有推荐/搜索/NLP 落地经验。",
                category_code="RND_AI",
                job_type="SOCIAL",
                headcount=2,
                salary_negotiable=False,
                salary_min_k=30,
                salary_max_k=55,
                status="PUBLISHED",
                created_by=hr.id,
                published_at=now,
            )
            j5 = models.Job(
                title="跨端开发工程师 (Flutter/RN)",
                location="北京",
                description="负责移动端与跨端业务开发，基于 Flutter / React Native 构建高性能应用。",
                requirements="1. 熟悉 Dart 或 TypeScript；\n2. 有跨端框架实战经验。",
                category_code="RND_MOBILE",
                job_type="SOCIAL",
                headcount=2,
                salary_negotiable=False,
                salary_min_k=20,
                salary_max_k=38,
                status="PUBLISHED",
                created_by=hr.id,
                published_at=now,
            )
            db.add_all([j1, j2, j3, j4, j5])
            db.commit()

        # ---- Report demo seed: ~540 applications across 5 channels / 6 stages ----
        if db.query(models.Application).count() == 0:
            rng = random.Random(20260815)  # deterministic across re-runs

            # 1) Candidates + resumes (60 each, supports 540 applications with reuse)
            candidates = []
            for i in range(60):
                u = models.CandidateAccount(
                    email=f"cand{i}@demo.com",
                    password_hash=hash_password(_DEMO_PASSWORD),
                    name=f"候选人 {i + 1}",
                    status="ACTIVE",
                )
                db.add(u); db.flush()
                phone = f"139{10000000 + i:08d}"
                c = models.Candidate(
                    user_id=u.id,
                    name=u.name,
                    phone=phone,
                    normalized_phone=phone,
                    contact_email=u.email,
                    normalized_email=u.email.lower(),
                    city=rng.choice(["深圳", "上海", "北京", "杭州"]),
                )
                db.add(c); db.flush()
                r = models.Resume(
                    candidate_id=c.id,
                    file_name=f"{u.name}_简历.pdf",
                    storage_key=f"mock/{u.name}.pdf",
                    parse_status="DONE",
                    parsed_data={"name": u.name, "email": u.email, "phone": phone, "skills": ["React", "Python"]},
                )
                db.add(r); db.flush()
                candidates.append((c, r))

            # 2) 540 channel codes, shuffled
            flat_channels: list[str] = []
            for code, _, n in _REPORT_SEED_CHANNELS:
                flat_channels += [code] * n
            rng.shuffle(flat_channels)

            # 3) 540 target stages, shuffled — distribution matches screenshot
            stage_dist = list(_REPORT_SEED_BUCKETS)
            rng.shuffle(stage_dist)

            jobs = db.query(models.Job).filter(models.Job.status == "PUBLISHED").all()
            interviewer = db.query(models.AdminAccount).filter_by(email="interviewer@demo.com").first()
            seed_now = datetime.now(timezone.utc)

            # 4) Applications
            applications: list[tuple[models.Application, str]] = []
            for i in range(540):
                cand, resume = candidates[i % len(candidates)]
                job = rng.choice(jobs)
                src_code = flat_channels[i]
                src_name = next(n for c, n, _ in _REPORT_SEED_CHANNELS if c == src_code)
                tgt = stage_dist[i]
                applied_at = seed_now - timedelta(days=rng.randint(0, 180), hours=rng.randint(0, 23))
                ch_row = src_by_code.get(src_code)
                # current_stage mirrors the deepest reached stage in real data;
                # OFFERS_SENT maps to FINAL_REVIEW (existing enum) since OFFER isn't a current_stage.
                if tgt == "HIRED":
                    cur_stage = "HIRED"; status = "HIRED"
                elif tgt == "OFFERS_SENT":
                    cur_stage = "FINAL_REVIEW"; status = "ACTIVE"
                else:
                    cur_stage = tgt; status = "ACTIVE"
                app = models.Application(
                    candidate_id=cand.id,
                    job_id=job.id,
                    resume_id=resume.id,
                    owner_id=hr.id,
                    source_channel_id=ch_row.id if ch_row else None,
                    source_code_snapshot=src_code,
                    source_name_snapshot=src_name,
                    current_stage=cur_stage,
                    status=status,
                    ai_score=rng.randint(60, 99),
                    applied_at=applied_at,
                )
                db.add(app); applications.append((app, tgt))
            db.flush()

            # 5) Stage history (cumulative up to deepest reached stage) + Offers + Interviews
            # Note: OFFERS_SENT is not a real current_stage, so for those target apps we
            # write history through FINAL_REVIEW and the funnel derives OFFERS_SENT from the Offer table.
            for app, tgt in applications:
                cur = app.applied_at
                # APPLIED is always written (every application starts here).
                db.add(models.ApplicationStageHistory(
                    application_id=app.id,
                    from_stage=None,
                    to_stage="APPLIED",
                    changed_by=hr.id,
                    reason="seed",
                    created_at=cur,
                ))
                if tgt == "APPLIED":
                    continue  # deepest reached stage = APPLIED; no further history
                hist_target = "FINAL_REVIEW" if tgt == "OFFERS_SENT" else tgt
                rest_seq = ["SCREENING", "SCREENING_PASSED", "FIRST_INTERVIEW", "SECOND_INTERVIEW", "FINAL_REVIEW", "HIRED"]
                for stage in rest_seq:
                    cur = cur + timedelta(hours=rng.randint(24, 96))
                    db.add(models.ApplicationStageHistory(
                        application_id=app.id,
                        from_stage=rest_seq[rest_seq.index(stage) - 1],
                        to_stage=stage,
                        changed_by=hr.id,
                        reason="seed",
                        created_at=cur,
                    ))
                    if stage == hist_target:
                        break

                # OFFERS_SENT / HIRED -> create Offer row(s)
                if tgt in ("OFFERS_SENT", "HIRED"):
                    offer_status = "ACCEPTED" if tgt == "HIRED" else rng.choice(["SENT", "DECLINED", "EXPIRED"])
                    db.add(models.Offer(
                        application_id=app.id,
                        candidate_id=app.candidate_id,
                        job_id=app.job_id,
                        status=offer_status,
                        salary_description=f"{rng.randint(15, 40)}K · {rng.randint(12, 16)}薪",
                        work_location="深圳",
                        expected_start_date=seed_now + timedelta(days=30),
                        expires_at=seed_now + timedelta(days=14),
                        created_by=hr.id,
                    ))

                # Interviews: anyone past FIRST_INTERVIEW has a FIRST round;
                # anyone past SECOND_INTERVIEW/.../HIRED also has a SECOND round.
                if tgt in ("FIRST_INTERVIEW", "SECOND_INTERVIEW", "OFFERS_SENT", "HIRED"):
                    rounds = ["FIRST"]
                    if tgt in ("SECOND_INTERVIEW", "OFFERS_SENT", "HIRED"):
                        rounds.append("SECOND")
                    for r in rounds:
                        iv = models.Interview(
                            application_id=app.id,
                            interviewer_id=interviewer.id,
                            round_type=r,
                            scheduled_at=app.applied_at + timedelta(days=rng.randint(5, 14)),
                            duration_minutes=60,
                            method="视频面试",
                            meeting_url=f"https://meet/{app.id}",
                            status="COMPLETED",
                            created_by=hr.id,
                        )
                        db.add(iv)
                        db.flush()  # 取得 iv.id 以便关联面评
                        db.add(models.InterviewFeedback(
                            interview_id=iv.id,
                            interviewer_id=interviewer.id,
                            professional_score=rng.randint(3, 5),
                            project_score=rng.randint(3, 5),
                            communication_score=rng.randint(3, 5),
                            strengths="种子数据：基础扎实，沟通顺畅",
                            weaknesses="种子数据：相关经验略浅",
                            summary="种子数据自动生成面评",
                            recommendation=rng.choice(["PASS", "PASS", "HOLD", "FAIL"]),
                        ))
            db.commit()
    finally:
        db.close()
