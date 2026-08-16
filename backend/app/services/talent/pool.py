"""Talent pool entry logic.

Centralizes the rule "a rejected candidate enters the talent pool": whenever an
application is rejected at any stage, the candidate is parked in the pool
(provided they have no live pipeline) with metadata about where/why they were
rejected, and a stage-specific tag is auto-applied for filtering.
"""
from __future__ import annotations

from datetime import datetime, timezone

from sqlalchemy.orm import Session

from ... import models
from ...core.audit import write_audit

# Maps the stage a candidate was rejected at to the auto-applied tag name.
STAGE_REJECT_TAG = {
    "SCREENING": "初筛淘汰",
    "FIRST_INTERVIEW": "一面淘汰",
    "SECOND_INTERVIEW": "二面淘汰",
    "FINAL_REVIEW": "终面淘汰",
}


def _ensure_stage_tag(db: Session, stage: str | None):
    """Find-or-create the reject tag for a stage; return its id or None."""
    if not stage or stage not in STAGE_REJECT_TAG:
        return None
    name = STAGE_REJECT_TAG[stage]
    tag = db.query(models.Tag).filter(models.Tag.name == name).first()
    if tag is None:
        tag = models.Tag(name=name, color="#e2553f", enabled=True)
        db.add(tag)
        db.flush()
    return tag.id


def _attach_tag(db: Session, candidate_id, tag_id) -> None:
    exists = db.query(models.CandidateTag).filter_by(candidate_id=candidate_id, tag_id=tag_id).first()
    if not exists:
        db.add(models.CandidateTag(candidate_id=candidate_id, tag_id=tag_id))


def enter_talent_pool(db: Session, candidate, from_stage: str, reason: str, user) -> None:
    """Mark a rejected candidate as a talent-pool member (does NOT commit).

    Skips entry when the candidate still has a live pipeline (ACTIVE/ON_HOLD/
    HIRED) so someone rejected for one job but hired elsewhere is not parked.
    """
    # Flush pending changes first: SessionLocal runs with autoflush=False, so the
    # just-rejected application's new status must be pushed to the DB before the
    # live-pipeline check below, otherwise we'd wrongly skip pool entry.
    db.flush()
    has_live = (
        db.query(models.Application)
        .filter(
            models.Application.candidate_id == candidate.id,
            models.Application.status.in_(["ACTIVE", "ON_HOLD", "HIRED"]),
        )
        .first()
    )
    if has_live:
        return

    candidate.in_talent_pool = True
    candidate.pool_entered_at = datetime.now(timezone.utc)
    candidate.pool_entered_from_stage = from_stage
    candidate.pool_reject_reason = (reason or "").strip() or None
    candidate.pool_entered_by_id = getattr(user, "id", None)

    tag_id = _ensure_stage_tag(db, from_stage)
    if tag_id is not None:
        _attach_tag(db, candidate.id, tag_id)

    write_audit(
        db,
        actor=user,
        action="TALENT_POOL_ENTER",
        entity_type="Candidate",
        entity_id=candidate.id,
        after={"from_stage": from_stage, "reason": candidate.pool_reject_reason},
    )


def leave_talent_pool(db: Session, candidate) -> None:
    """Clear pool membership without deleting the candidate (e.g. on re-activation)."""
    candidate.in_talent_pool = False
    candidate.pool_entered_at = None
    candidate.pool_entered_from_stage = None
    candidate.pool_reject_reason = None
    candidate.pool_entered_by_id = None
