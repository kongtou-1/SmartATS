"""FastAPI application entrypoint for the HR ATS MVP backend."""
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import text
from sqlalchemy.exc import OperationalError, ProgrammingError

from .core.config import CORS_ORIGINS
from .services.database import Base, engine
from .core.audit import AuditMiddleware
from . import models  # noqa: F401  (register models on Base.metadata)
from .api import admin_api_router, user_api_router
from .seed import seed_if_empty


@asynccontextmanager
async def lifespan(app: FastAPI):
    Base.metadata.create_all(bind=engine)
    # Idempotent schema upgrade for existing dev DBs: create_all does not alter
    # existing tables, so add any missing columns. Each ALTER runs in its own
    # transaction so a single failure (e.g. a type mismatch) cannot roll back
    # the others.
    _job_alters = [
        "ALTER TABLE jobs ADD COLUMN IF NOT EXISTS category_code VARCHAR(64)",
        "ALTER TABLE jobs ADD COLUMN IF NOT EXISTS headcount INTEGER DEFAULT 1",
        "ALTER TABLE jobs ADD COLUMN IF NOT EXISTS salary_negotiable BOOLEAN DEFAULT FALSE",
        "ALTER TABLE jobs ADD COLUMN IF NOT EXISTS salary_min_k INTEGER",
        "ALTER TABLE jobs ADD COLUMN IF NOT EXISTS salary_max_k INTEGER",
        "ALTER TABLE jobs ADD COLUMN IF NOT EXISTS department VARCHAR(128) DEFAULT ''",
        "ALTER TABLE jobs ADD COLUMN IF NOT EXISTS experience_req VARCHAR(32)",
        "ALTER TABLE jobs ADD COLUMN IF NOT EXISTS education_req VARCHAR(32)",
        "ALTER TABLE jobs ADD COLUMN IF NOT EXISTS urgency VARCHAR(32) DEFAULT 'MEDIUM'",
        "ALTER TABLE job_categories ADD COLUMN IF NOT EXISTS owner_id UUID",
        "ALTER TABLE admin_accounts ADD COLUMN IF NOT EXISTS title VARCHAR(128) DEFAULT ''",
        "ALTER TABLE interviews ADD COLUMN IF NOT EXISTS reminder_sent BOOLEAN DEFAULT FALSE",
        # 账号隔离表软删除列 + 通知多态类型列
        "ALTER TABLE candidate_accounts ADD COLUMN IF NOT EXISTS delete_at TIMESTAMPTZ",
        "ALTER TABLE admin_accounts ADD COLUMN IF NOT EXISTS delete_at TIMESTAMPTZ",
        # Talent pool (人才库) columns on the candidates table.
        "ALTER TABLE candidates ADD COLUMN IF NOT EXISTS delete_at TIMESTAMPTZ",
        "ALTER TABLE candidates ADD COLUMN IF NOT EXISTS in_talent_pool BOOLEAN DEFAULT FALSE",
        "ALTER TABLE candidates ADD COLUMN IF NOT EXISTS pool_entered_at TIMESTAMPTZ",
        "ALTER TABLE candidates ADD COLUMN IF NOT EXISTS pool_entered_from_stage VARCHAR(32)",
        "ALTER TABLE candidates ADD COLUMN IF NOT EXISTS pool_reject_reason TEXT",
        "ALTER TABLE candidates ADD COLUMN IF NOT EXISTS pool_entered_by_id UUID",
        "CREATE INDEX IF NOT EXISTS ix_candidates_in_talent_pool ON candidates(in_talent_pool)",
        "CREATE INDEX IF NOT EXISTS ix_candidates_delete_at ON candidates(delete_at)",
        "ALTER TABLE notifications ADD COLUMN IF NOT EXISTS user_type VARCHAR(32) DEFAULT 'CANDIDATE'",
        # 邮箱唯一性改为「仅在未删除行之间唯一」，软删除后邮箱可被新账号复用。
        # create_all 已按 ORM 建好 uq_*_email_active，这里只负责清掉旧库里的全表唯一索引。
        "CREATE UNIQUE INDEX IF NOT EXISTS uq_candidate_accounts_email_active "
        "ON candidate_accounts (email) WHERE delete_at IS NULL",
        "CREATE UNIQUE INDEX IF NOT EXISTS uq_admin_accounts_email_active "
        "ON admin_accounts (email) WHERE delete_at IS NULL",
        "DROP INDEX IF EXISTS ix_candidate_accounts_email",
        "DROP INDEX IF EXISTS ix_admin_accounts_email",
    ]
    for stmt in _job_alters:
        try:
            with engine.begin() as conn:
                conn.execute(text(stmt))
        except (OperationalError, ProgrammingError):
            pass  # column already present
    seed_if_empty()
    _backfill_talent_pool()
    yield


def _backfill_talent_pool() -> None:
    """Idempotently mark already-rejected candidates as talent-pool members.

    Runs once at startup so seed/legacy data (candidates with a REJECTED
    application and no live pipeline) shows up in the rejected-only pool.
    """
    from datetime import datetime, timezone

    from .services.database import SessionLocal

    db = SessionLocal()
    try:
        rejected = (
            db.query(models.Application.candidate_id)
            .filter(models.Application.status == "REJECTED")
            .distinct()
            .all()
        )
        for (cid,) in rejected:
            c = db.get(models.Candidate, cid)
            if c is None or c.delete_at is not None or c.in_talent_pool:
                continue
            has_live = (
                db.query(models.Application)
                .filter(
                    models.Application.candidate_id == cid,
                    models.Application.status.in_(["ACTIVE", "ON_HOLD", "HIRED"]),
                )
                .first()
            )
            if has_live:
                continue
            hist = (
                db.query(models.ApplicationStageHistory)
                .join(
                    models.Application,
                    models.Application.id == models.ApplicationStageHistory.application_id,
                )
                .filter(
                    models.Application.candidate_id == cid,
                    models.ApplicationStageHistory.to_stage == "REJECTED",
                )
                .order_by(models.ApplicationStageHistory.created_at.desc())
                .first()
            )
            c.in_talent_pool = True
            c.pool_entered_from_stage = hist.from_stage if hist else None
            c.pool_reject_reason = hist.reason if hist else None
            c.pool_entered_at = datetime.now(timezone.utc)
        db.commit()
    finally:
        db.close()
    # Ensure the object-storage bucket exists (no-op for local fallback).
    try:
        from .storage import storage

        storage.ensure_bucket()
    except Exception as exc:  # pragma: no cover - depends on live MinIO
        import logging

        logging.getLogger("hr.startup").warning("MinIO bucket init skipped: %s", exc)


app = FastAPI(title="HR ATS MVP Backend", version="1.0.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
app.add_middleware(AuditMiddleware)

app.include_router(user_api_router)
app.include_router(admin_api_router)


@app.get("/api/v1/health")
def health():
    return {"status": "ok"}
