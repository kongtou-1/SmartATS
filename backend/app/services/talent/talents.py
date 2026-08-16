"""Talent pool management services."""
from __future__ import annotations

import re
from datetime import datetime, timezone
from uuid import UUID

from fastapi import Depends, HTTPException, Query, status
from sqlalchemy import func
from sqlalchemy.orm import Session

from ... import models
from ...core.audit import write_audit
from ..database import get_db
from ...core.permissions import require_roles
from ...schemas import (
    NoteIn,
    PageOut,
    SourceChannelIn,
    TagIn,
    TalentIn,
    TalentMergeIn,
    TalentOut,
    TalentReactivateIn,
    CandidateTagAssignIn,
)
from ...utils.presenters import build_application_out

VALID_STAGES = {"APPLIED", "SCREENING", "SCREENING_PASSED", "FIRST_INTERVIEW", "SECOND_INTERVIEW", "FINAL_REVIEW", "HIRED", "REJECTED", "WITHDRAWN"}
SORT_COLUMNS = {"name": models.Candidate.name, "years_experience": models.Candidate.years_experience, "created_at": models.Candidate.created_at, "updated_at": models.Candidate.updated_at}


def normalize_phone(value: str) -> str:
    digits = re.sub(r"\D", "", value or "")
    if digits.startswith("86") and len(digits) == 13:
        digits = digits[2:]
    return digits


def normalize_email(value: str) -> str:
    return (value or "").strip().lower()


def normalize_tag_ids(values: list[str]) -> list[UUID]:
    parts = {part.strip() for value in values for part in value.replace("，", ",").split(",") if part.strip()}
    try:
        return [UUID(part) for part in parts]
    except ValueError as exc:
        raise HTTPException(422, "标签参数格式无效") from exc


def apply_talent_filters(db: Session, q, *, name="", phone="", skills=None, tag_ids=None, source_channel_id=None, owner_id=None, job_id=None, stage="", reject_stage="", min_years=None, max_years=None, scope="all"):
    # Scope controls which candidates are visible:
    #   pool    -> in the talent pool (rejected, parked) and not archived
    #   all     -> every non-archived candidate (CRM directory)
    #   archived-> soft-deleted candidates only (recoverable)
    if scope == "archived":
        q = q.filter(models.Candidate.delete_at.isnot(None))
    else:
        q = q.filter(models.Candidate.delete_at.is_(None))
        if scope == "pool":
            q = q.filter(models.Candidate.in_talent_pool == True)  # noqa: E712
    if reject_stage:
        q = q.filter(models.Candidate.pool_entered_from_stage == reject_stage)
    if min_years is not None and max_years is not None and int(min_years) > int(max_years):
        raise HTTPException(400, "最少工作年限不能大于最多工作年限")
    if stage and stage not in VALID_STAGES:
        raise HTTPException(422, "招聘阶段无效")
    if name: q = q.filter(models.Candidate.name.ilike(f"%{name.strip()}%"))
    if phone: q = q.filter(models.Candidate.normalized_phone.contains(normalize_phone(phone)))
    if source_channel_id: q = q.filter(models.Candidate.source_channel_id == UUID(str(source_channel_id)))
    if owner_id: q = q.filter(models.Candidate.owner_id == UUID(str(owner_id)))
    if min_years is not None: q = q.filter(models.Candidate.years_experience >= int(min_years))
    if max_years is not None: q = q.filter(models.Candidate.years_experience <= int(max_years))
    skill_terms = {part.strip().lower() for value in (skills or []) for part in value.replace("，", ",").split(",") if part.strip()}
    for skill in skill_terms:
        q = q.filter(models.Candidate.id.in_(db.query(models.CandidateSkill.candidate_id).filter(models.CandidateSkill.normalized_name == skill)))
    normalized_tags = normalize_tag_ids(tag_ids or [])
    for tag_id in normalized_tags:
        q = q.filter(models.Candidate.id.in_(db.query(models.CandidateTag.candidate_id).filter(models.CandidateTag.tag_id == tag_id)))
    if job_id or stage:
        app_q = db.query(models.Application.candidate_id)
        if job_id: app_q = app_q.filter(models.Application.job_id == UUID(str(job_id)))
        if stage: app_q = app_q.filter(models.Application.current_stage == stage)
        q = q.filter(models.Candidate.id.in_(app_q))
    return q


def _validate_owner(db: Session, owner_id):
    if not owner_id:
        return
    owner = db.get(models.AdminAccount, owner_id)
    if not owner or owner.delete_at is not None or owner.role not in {"HR", "SUPER_ADMIN"} or owner.status != "ACTIVE":
        raise HTTPException(400, "负责人必须是启用状态的 HR 或超级管理员")


def _set_relations(db: Session, candidate, skills: list[str], tag_ids: list[UUID]):
    normalized = {s.strip().lower(): s.strip() for s in skills if s.strip()}
    current = {s.normalized_name: s for s in db.query(models.CandidateSkill).filter_by(candidate_id=candidate.id)}
    for key, row in list(current.items()):
        if key not in normalized:
            db.delete(row)
    for key, display in normalized.items():
        if key not in current:
            db.add(models.CandidateSkill(candidate_id=candidate.id, name=display, normalized_name=key))
    valid_tags = {t.id for t in db.query(models.Tag).filter(models.Tag.id.in_(tag_ids), models.Tag.enabled.is_(True)).all()} if tag_ids else set()
    db.query(models.CandidateTag).filter_by(candidate_id=candidate.id).delete(synchronize_session=False)
    for tag_id in valid_tags:
        db.add(models.CandidateTag(candidate_id=candidate.id, tag_id=tag_id))


def build_talent(db: Session, c) -> TalentOut:
    owner = db.get(models.AdminAccount, c.owner_id) if c.owner_id else None
    source = db.get(models.SourceChannel, c.source_channel_id) if c.source_channel_id else None
    skills = [s.name for s in db.query(models.CandidateSkill).filter_by(candidate_id=c.id).order_by(models.CandidateSkill.name)]
    tag_rows = (db.query(models.Tag).join(models.CandidateTag, models.CandidateTag.tag_id == models.Tag.id)
                .filter(models.CandidateTag.candidate_id == c.id).all())
    app = db.query(models.Application).filter_by(candidate_id=c.id).order_by(models.Application.applied_at.desc()).first()
    latest = None
    if app:
        job = db.get(models.Job, app.job_id)
        latest = {"id": str(app.id), "job_id": str(app.job_id), "job_title": job.title if job else "", "stage": app.current_stage, "status": app.status}
    return TalentOut(
        id=c.id, user_id=c.user_id, name=c.name, phone=c.phone, contact_email=c.contact_email,
        city=c.city, years_experience=c.years_experience, owner_id=c.owner_id,
        owner_name=owner.name if owner else "", source_channel_id=c.source_channel_id,
        source_name=source.name if source else "", skills=skills,
        tags=[{"id": str(t.id), "name": t.name, "color": t.color} for t in tag_rows],
        latest_application=latest,
        in_talent_pool=c.in_talent_pool, pool_entered_at=c.pool_entered_at,
        pool_entered_from_stage=c.pool_entered_from_stage, pool_reject_reason=c.pool_reject_reason,
        pool_entered_by_id=c.pool_entered_by_id,
        created_at=c.created_at, updated_at=c.updated_at,
    )


def build_talents_bulk(db: Session, rows: list) -> list[TalentOut]:
    """Bulk counterpart of build_talent that prefetches all relations in a handful
    of queries instead of N+1. Used by list_talents for the paged result set."""
    if not rows:
        return []
    ids = [c.id for c in rows]
    owner_ids = {c.owner_id for c in rows if c.owner_id}
    source_ids = {c.source_channel_id for c in rows if c.source_channel_id}
    owners_map = {a.id: a.name for a in db.query(models.AdminAccount).filter(models.AdminAccount.id.in_(owner_ids)).all()} if owner_ids else {}
    sources_map = {s.id: s.name for s in db.query(models.SourceChannel).filter(models.SourceChannel.id.in_(source_ids)).all()} if source_ids else {}

    skills_rows = db.query(models.CandidateSkill).filter(models.CandidateSkill.candidate_id.in_(ids)).order_by(models.CandidateSkill.name).all()
    skills_map: dict = {}
    for s in skills_rows:
        skills_map.setdefault(s.candidate_id, []).append(s.name)

    tag_join = (
        db.query(models.CandidateTag.candidate_id, models.Tag)
        .join(models.Tag, models.Tag.id == models.CandidateTag.tag_id)
        .filter(models.CandidateTag.candidate_id.in_(ids))
        .all()
    )
    tags_map: dict = {}
    for candidate_id, t in tag_join:
        tags_map.setdefault(candidate_id, []).append({"id": str(t.id), "name": t.name, "color": t.color})

    apps = db.query(models.Application).filter(models.Application.candidate_id.in_(ids)).all()
    apps_by_candidate: dict = {}
    for a in apps:
        existing = apps_by_candidate.get(a.candidate_id)
        if existing is None or a.applied_at > existing.applied_at:
            apps_by_candidate[a.candidate_id] = a
    job_ids = {a.job_id for a in apps_by_candidate.values() if a.job_id}
    jobs_map = {j.id: j.title for j in db.query(models.Job).filter(models.Job.id.in_(job_ids)).all()} if job_ids else {}

    out = []
    for c in rows:
        latest = None
        app = apps_by_candidate.get(c.id)
        if app:
            job = jobs_map.get(app.job_id)
            latest = {"id": str(app.id), "job_id": str(app.job_id), "job_title": job if job is not None else "", "stage": app.current_stage, "status": app.status}
        out.append(TalentOut(
            id=c.id, user_id=c.user_id, name=c.name, phone=c.phone, contact_email=c.contact_email,
            city=c.city, years_experience=c.years_experience, owner_id=c.owner_id,
            owner_name=owners_map.get(c.owner_id, "") if c.owner_id else "",
            source_channel_id=c.source_channel_id,
            source_name=sources_map.get(c.source_channel_id, "") if c.source_channel_id else "",
            skills=skills_map.get(c.id, []),
            tags=tags_map.get(c.id, []),
            latest_application=latest,
            in_talent_pool=c.in_talent_pool, pool_entered_at=c.pool_entered_at,
            pool_entered_from_stage=c.pool_entered_from_stage, pool_reject_reason=c.pool_reject_reason,
            pool_entered_by_id=c.pool_entered_by_id,
            created_at=c.created_at, updated_at=c.updated_at,
        ))
    return out


def list_talents(
    name: str = "", phone: str = "", skills: list[str] = Query(default=[]),
    tag_ids: list[str] = Query(default=[]), source_channel_id: UUID | None = None,
    owner_id: UUID | None = None, job_id: UUID | None = None, stage: str = "",
    reject_stage: str = "", min_years: int | None = None, max_years: int | None = None,
    scope: str = "all",
    page: int = Query(1, ge=1), page_size: int = Query(20, ge=1, le=100),
    sort: str = "updated_at", order: str = "desc",
    _=Depends(require_roles("SUPER_ADMIN", "HR")), db: Session = Depends(get_db),
):
    q = apply_talent_filters(db, db.query(models.Candidate), name=name, phone=phone, skills=skills, tag_ids=tag_ids, source_channel_id=source_channel_id, owner_id=owner_id, job_id=job_id, stage=stage, reject_stage=reject_stage, min_years=min_years, max_years=max_years, scope=scope)
    total = q.with_entities(func.count(models.Candidate.id)).scalar() or 0
    sort_col = SORT_COLUMNS.get(sort, models.Candidate.updated_at)
    q = q.order_by(sort_col.asc() if order == "asc" else sort_col.desc())
    rows = q.offset((page - 1) * page_size).limit(page_size).all()
    return PageOut(items=build_talents_bulk(db, rows), page=page, page_size=page_size, total=total)


def create_talent(payload: TalentIn, user=Depends(require_roles("SUPER_ADMIN", "HR")), db: Session = Depends(get_db)):
    _validate_owner(db, payload.owner_id)
    c = models.Candidate(
        user_id=None, name=payload.name.strip(), phone=payload.phone.strip(), normalized_phone=normalize_phone(payload.phone),
        contact_email=payload.contact_email.strip(), normalized_email=normalize_email(payload.contact_email), city=payload.city.strip(),
        years_experience=payload.years_experience, owner_id=payload.owner_id, source_channel_id=payload.source_channel_id,
    )
    db.add(c); db.flush(); _set_relations(db, c, payload.skills, payload.tag_ids)
    write_audit(db, actor=user, action="TALENT_CREATE", entity_type="Candidate", entity_id=c.id, after=payload.model_dump())
    db.commit(); db.refresh(c)
    return build_talent(db, c)


def get_talent(candidate_id: UUID, _=Depends(require_roles("SUPER_ADMIN", "HR")), db: Session = Depends(get_db)):
    c = db.get(models.Candidate, candidate_id)
    if not c or c.delete_at is not None: raise HTTPException(404, "人才不存在")
    return build_talent(db, c)


def update_talent(candidate_id: UUID, payload: TalentIn, user=Depends(require_roles("SUPER_ADMIN", "HR")), db: Session = Depends(get_db)):
    c = db.get(models.Candidate, candidate_id)
    if not c or c.delete_at is not None: raise HTTPException(404, "人才不存在")
    _validate_owner(db, payload.owner_id)
    before = build_talent(db, c).model_dump(mode="json")
    for k in ("name", "phone", "contact_email", "city", "years_experience", "owner_id", "source_channel_id"):
        setattr(c, k, getattr(payload, k))
    c.normalized_phone = normalize_phone(payload.phone); c.normalized_email = normalize_email(payload.contact_email)
    _set_relations(db, c, payload.skills, payload.tag_ids)
    write_audit(db, actor=user, action="TALENT_UPDATE", entity_type="Candidate", entity_id=c.id, before=before, after=payload.model_dump())
    db.commit(); db.refresh(c)
    return build_talent(db, c)


def delete_talent(candidate_id: UUID, user=Depends(require_roles("SUPER_ADMIN", "HR")), db: Session = Depends(get_db)):
    """Soft-delete a talent (移出人才库/归档). Recoverable via restore_talent."""
    c = db.get(models.Candidate, candidate_id)
    if not c or c.delete_at is not None: raise HTTPException(404, "人才不存在")
    c.delete_at = datetime.now(timezone.utc)
    write_audit(db, actor=user, action="TALENT_DELETE", entity_type="Candidate", entity_id=c.id, after={})
    db.commit()
    return {"id": str(c.id), "deleted": True}


def restore_talent(candidate_id: UUID, user=Depends(require_roles("SUPER_ADMIN", "HR")), db: Session = Depends(get_db)):
    """Undo a soft-delete; bring the candidate back as a pool member."""
    c = db.get(models.Candidate, candidate_id)
    if not c: raise HTTPException(404, "人才不存在")
    if c.delete_at is None: raise HTTPException(400, "该人才未被移出，无需恢复")
    c.delete_at = None
    if not c.in_talent_pool:
        c.in_talent_pool = True
        c.pool_entered_at = datetime.now(timezone.utc)
    write_audit(db, actor=user, action="TALENT_RESTORE", entity_type="Candidate", entity_id=c.id, after={})
    db.commit(); db.refresh(c)
    return build_talent(db, c)


def reactivate_talent(candidate_id: UUID, payload: TalentReactivateIn, user=Depends(require_roles("SUPER_ADMIN", "HR")), db: Session = Depends(get_db)):
    """Re-engage a parked talent: start a fresh APPLIED application for a job."""
    c = db.get(models.Candidate, candidate_id)
    if not c or c.delete_at is not None: raise HTTPException(404, "人才不存在")
    job = db.get(models.Job, payload.job_id)
    if not job: raise HTTPException(404, "岗位不存在")
    dup = db.query(models.Application).filter_by(candidate_id=c.id, job_id=job.id, status="ACTIVE").first()
    if dup: raise HTTPException(409, "该候选人已在此岗位的招聘流程中")
    last_app = db.query(models.Application).filter_by(candidate_id=c.id).order_by(models.Application.applied_at.desc()).first()
    resume_id = last_app.resume_id if last_app else None
    if not resume_id: raise HTTPException(400, "该人才暂无简历，无法重新激活")

    app = models.Application(
        candidate_id=c.id, job_id=job.id, resume_id=resume_id,
        current_stage="APPLIED", status="ACTIVE",
        owner_id=c.owner_id, source_channel_id=c.source_channel_id,
        job_type_snapshot=job.job_type,
    )
    db.add(app); db.flush()
    db.add(models.ApplicationStageHistory(
        application_id=app.id, from_stage=None, to_stage="APPLIED",
        changed_by=user.id, reason=payload.note or "从人才库重新激活投递",
    ))
    from ..talent.pool import leave_talent_pool

    leave_talent_pool(db, c)
    c.delete_at = None  # revive if previously archived
    write_audit(db, actor=user, action="TALENT_REACTIVATE", entity_type="Application", entity_id=app.id,
                after={"candidate_id": str(c.id), "job_id": str(job.id)})
    db.commit(); db.refresh(app)
    return build_application_out(db, app)


def add_candidate_tag(candidate_id: UUID, payload: CandidateTagAssignIn, user=Depends(require_roles("SUPER_ADMIN", "HR")), db: Session = Depends(get_db)):
    """Append a tag to a candidate WITHOUT wiping existing tags (used by screening reject)."""
    c = db.get(models.Candidate, candidate_id)
    if not c:
        raise HTTPException(404, "人才不存在")
    tag = db.get(models.Tag, payload.tag_id)
    if not tag:
        raise HTTPException(404, "标签不存在")
    exists = db.query(models.CandidateTag).filter_by(candidate_id=candidate_id, tag_id=payload.tag_id).first()
    if not exists:
        db.add(models.CandidateTag(candidate_id=candidate_id, tag_id=payload.tag_id))
        write_audit(db, actor=user, action="TALENT_TAG_ADD", entity_type="CandidateTag", entity_id=candidate_id, after={"tag_id": str(payload.tag_id)})
        db.commit()
    return build_talent(db, c)


def add_note(candidate_id: UUID, payload: NoteIn, user=Depends(require_roles("SUPER_ADMIN", "HR")), db: Session = Depends(get_db)):
    if not db.get(models.Candidate, candidate_id): raise HTTPException(404, "人才不存在")
    note = models.CandidateNote(candidate_id=candidate_id, author_id=user.id, content=payload.content.strip())
    db.add(note); db.flush(); write_audit(db, actor=user, action="TALENT_NOTE_ADD", entity_type="CandidateNote", entity_id=note.id, after={"candidate_id": str(candidate_id)})
    db.commit(); db.refresh(note)
    return {"id": note.id, "content": note.content, "author_id": note.author_id, "created_at": note.created_at}


def list_notes(candidate_id: UUID, _=Depends(require_roles("SUPER_ADMIN", "HR")), db: Session = Depends(get_db)):
    rows = db.query(models.CandidateNote).filter_by(candidate_id=candidate_id).order_by(models.CandidateNote.created_at.desc()).all()
    author_ids = {r.author_id for r in rows if r.author_id}
    authors = {a.id: a.name for a in db.query(models.AdminAccount).filter(models.AdminAccount.id.in_(author_ids)).all()} if author_ids else {}
    return [{"id": r.id, "content": r.content, "author_id": r.author_id, "author_name": authors.get(r.author_id, ""), "created_at": r.created_at} for r in rows]


def merge_talent(candidate_id: UUID, payload: TalentMergeIn, user=Depends(require_roles("SUPER_ADMIN", "HR")), db: Session = Depends(get_db)):
    target, source = db.get(models.Candidate, candidate_id), db.get(models.Candidate, payload.source_candidate_id)
    if not target or not source or target.id == source.id: raise HTTPException(400, "合并对象无效")
    if target.user_id and source.user_id: raise HTTPException(409, "两个已绑定账号的人才不能合并")
    if not target.user_id: target.user_id = source.user_id
    for row in db.query(models.Resume).filter_by(candidate_id=source.id): row.candidate_id = target.id
    for row in db.query(models.Application).filter_by(candidate_id=source.id): row.candidate_id = target.id
    for row in db.query(models.CandidateNote).filter_by(candidate_id=source.id): row.candidate_id = target.id
    for row in db.query(models.CandidateCommunication).filter_by(candidate_id=source.id): row.candidate_id = target.id
    skills = {s.normalized_name: s.name for s in db.query(models.CandidateSkill).filter(models.CandidateSkill.candidate_id.in_([target.id, source.id]))}
    tag_ids = [r.tag_id for r in db.query(models.CandidateTag).filter(models.CandidateTag.candidate_id.in_([target.id, source.id]))]
    db.query(models.CandidateSkill).filter(models.CandidateSkill.candidate_id.in_([target.id, source.id])).delete(synchronize_session=False)
    db.query(models.CandidateTag).filter(models.CandidateTag.candidate_id.in_([target.id, source.id])).delete(synchronize_session=False)
    _set_relations(db, target, list(skills.values()), tag_ids)
    db.delete(source); write_audit(db, actor=user, action="TALENT_MERGE", entity_type="Candidate", entity_id=target.id, after={"merged_source_id": str(source.id)})
    db.commit(); db.refresh(target)
    return build_talent(db, target)


def list_channels(_=Depends(require_roles("SUPER_ADMIN", "HR")), db: Session = Depends(get_db)):
    return db.query(models.SourceChannel).order_by(models.SourceChannel.sort_order, models.SourceChannel.name).all()


def create_channel(payload: SourceChannelIn, user=Depends(require_roles("SUPER_ADMIN")), db: Session = Depends(get_db)):
    row = models.SourceChannel(**payload.model_dump()); db.add(row); db.flush(); write_audit(db, actor=user, action="SOURCE_CREATE", entity_type="SourceChannel", entity_id=row.id, after=payload.model_dump()); db.commit(); db.refresh(row); return row


def update_channel(channel_id: UUID, payload: SourceChannelIn, user=Depends(require_roles("SUPER_ADMIN")), db: Session = Depends(get_db)):
    row = db.get(models.SourceChannel, channel_id)
    if not row: raise HTTPException(404, "渠道不存在")
    for k, v in payload.model_dump().items(): setattr(row, k, v)
    write_audit(db, actor=user, action="SOURCE_UPDATE", entity_type="SourceChannel", entity_id=row.id, after=payload.model_dump()); db.commit(); db.refresh(row); return row


def list_tags(_=Depends(require_roles("SUPER_ADMIN", "HR")), db: Session = Depends(get_db)):
    return db.query(models.Tag).order_by(models.Tag.name).all()


def list_talent_owners(_=Depends(require_roles("SUPER_ADMIN", "HR")), db: Session = Depends(get_db)):
    return (
        db.query(models.AdminAccount)
        .filter(
            models.AdminAccount.role.in_(["HR", "SUPER_ADMIN"]),
            models.AdminAccount.status == "ACTIVE",
            models.AdminAccount.delete_at.is_(None),
        )
        .order_by(models.AdminAccount.name)
        .all()
    )


def create_tag(payload: TagIn, user=Depends(require_roles("SUPER_ADMIN", "HR")), db: Session = Depends(get_db)):
    row = models.Tag(**payload.model_dump()); db.add(row); db.flush(); write_audit(db, actor=user, action="TAG_CREATE", entity_type="Tag", entity_id=row.id, after=payload.model_dump()); db.commit(); db.refresh(row); return row


def update_tag(tag_id: UUID, payload: TagIn, user=Depends(require_roles("SUPER_ADMIN", "HR")), db: Session = Depends(get_db)):
    row = db.get(models.Tag, tag_id)
    if not row: raise HTTPException(404, "标签不存在")
    for k, v in payload.model_dump().items(): setattr(row, k, v)
    write_audit(db, actor=user, action="TAG_UPDATE", entity_type="Tag", entity_id=row.id, after=payload.model_dump()); db.commit(); db.refresh(row); return row

