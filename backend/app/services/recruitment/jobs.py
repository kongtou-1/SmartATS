"""Jobs: public browsing + HR/admin management."""
from fastapi import Depends, HTTPException, Query, status
from sqlalchemy import func
from sqlalchemy.orm import Session

from ..database import get_db
from ...core.permissions import get_current_user, require_roles
from ...models import Application, Job, JobCategory, AdminAccount
from ...schemas import JobInput, JobOut, JobWithStats



def _inject_category_names(jobs, db) -> list[JobOut]:
    """Attach category_name to JobOut objects (router-side, no relationship)."""
    cat_map = {c.code: c.name for c in db.query(JobCategory.code, JobCategory.name).all()}
    out = []
    for j in jobs:
        o = JobOut.model_validate(j)
        o.category_name = cat_map.get(j.category_code)
        out.append(o)
    return out


# ---------- Public ----------
def list_job_locations(db: Session = Depends(get_db)):
    rows = (
        db.query(Job.location)
        .filter(Job.status == "PUBLISHED", Job.location != "")
        .distinct()
        .all()
    )
    return sorted({r[0] for r in rows})


def list_published_jobs(
    search: str = Query(default=""),
    category_code: str = Query(default=""),
    category_codes: list[str] = Query(default=[]),
    location: str = Query(default=""),
    locations: list[str] = Query(default=[]),
    job_type: str = Query(default=""),
    job_types: list[str] = Query(default=[]),
    db: Session = Depends(get_db),
):
    q = db.query(Job).filter(Job.status == "PUBLISHED")
    if search:
        like = f"%{search}%"
        q = q.filter((Job.title.ilike(like)) | (Job.location.ilike(like)))

    codes = [c for c in (category_codes or []) if c]
    if category_code and category_code not in codes:
        codes.append(category_code)
    if codes:
        q = q.filter(Job.category_code.in_(codes))

    locs = [l for l in (locations or []) if l]
    if location and location not in locs:
        locs.append(location)
    if locs:
        q = q.filter(Job.location.in_(locs))

    types = [t for t in (job_types or []) if t]
    if job_type and job_type not in types:
        types.append(job_type)
    valid_types = {"INTERN", "SOCIAL", "CAMPUS"}
    if types:
        invalid = set(types) - valid_types
        if invalid:
            raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="岗位类型无效")
        q = q.filter(Job.job_type.in_(types))

    jobs = q.order_by(Job.published_at.desc()).all()
    return _inject_category_names(jobs, db)


def get_published_job(job_id: str, db: Session = Depends(get_db)):
    job = db.get(Job, _as_uuid(job_id))
    if job is None or job.status != "PUBLISHED":
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="岗位不存在")
    return _inject_category_names([job], db)[0]


# ---------- Admin ----------
def _category_map(db: Session) -> dict:
    return {c.code: c.name for c in db.query(JobCategory.code, JobCategory.name).all()}


def _to_with_stats(job: Job, db: Session, cat_map: dict | None = None) -> JobWithStats:
    """Build a JobWithStats: inject category name + aggregate pipeline counts."""
    if cat_map is None:
        cat_map = _category_map(db)
    counts = {
        stage: n
        for stage, n in db.query(Application.current_stage, func.count())
        .filter(Application.job_id == job.id)
        .group_by(Application.current_stage)
        .all()
    }
    out = JobWithStats.model_validate(job)
    out.category_name = cat_map.get(job.category_code)
    out.applications_total = sum(counts.values())
    out.stage_counts = counts
    return out


def list_jobs(_: AdminAccount = Depends(require_roles("SUPER_ADMIN", "HR")), db: Session = Depends(get_db)):
    jobs = db.query(Job).order_by(Job.created_at.desc()).all()
    cat_map = _category_map(db)
    return [_to_with_stats(j, db, cat_map) for j in jobs]


def create_job(
    payload: JobInput,
    user: AdminAccount = Depends(require_roles("SUPER_ADMIN", "HR")),
    db: Session = Depends(get_db),
):
    job = Job(
        title=payload.title,
        location=payload.location,
        description=payload.description,
        requirements=payload.requirements,
        category_code=payload.category_code,
        job_type=payload.job_type,
        headcount=payload.headcount,
        salary_negotiable=payload.salary_negotiable,
        salary_min_k=payload.salary_min_k,
        salary_max_k=payload.salary_max_k,
        department=payload.department,
        experience_req=payload.experience_req,
        education_req=payload.education_req,
        urgency=payload.urgency,
        status="DRAFT",
        created_by=user.id,
    )
    db.add(job)
    db.commit()
    db.refresh(job)
    return _to_with_stats(job, db)


def get_job(job_id: str, _: AdminAccount = Depends(require_roles("SUPER_ADMIN", "HR")), db: Session = Depends(get_db)):
    job = db.get(Job, _as_uuid(job_id))
    if job is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="岗位不存在")
    return _to_with_stats(job, db)


def update_job(
    job_id: str,
    payload: JobInput,
    _: AdminAccount = Depends(require_roles("SUPER_ADMIN", "HR")),
    db: Session = Depends(get_db),
):
    job = db.get(Job, _as_uuid(job_id))
    if job is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="岗位不存在")
    job.title = payload.title
    job.location = payload.location
    job.description = payload.description
    job.requirements = payload.requirements
    job.category_code = payload.category_code
    job.job_type = payload.job_type
    job.headcount = payload.headcount
    job.salary_negotiable = payload.salary_negotiable
    job.salary_min_k = payload.salary_min_k
    job.salary_max_k = payload.salary_max_k
    job.department = payload.department
    job.experience_req = payload.experience_req
    job.education_req = payload.education_req
    job.urgency = payload.urgency
    db.commit()
    db.refresh(job)
    return _to_with_stats(job, db)


def publish_job(job_id: str, _: AdminAccount = Depends(require_roles("SUPER_ADMIN", "HR")), db: Session = Depends(get_db)):
    job = db.get(Job, _as_uuid(job_id))
    if job is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="岗位不存在")
    from datetime import datetime, timezone

    job.status = "PUBLISHED"
    job.published_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(job)
    return _to_with_stats(job, db)


def close_job(job_id: str, _: AdminAccount = Depends(require_roles("SUPER_ADMIN", "HR")), db: Session = Depends(get_db)):
    job = db.get(Job, _as_uuid(job_id))
    if job is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="岗位不存在")
    job.status = "CLOSED"
    db.commit()
    db.refresh(job)
    return _to_with_stats(job, db)


def _as_uuid(value):
    import uuid

    if isinstance(value, uuid.UUID):
        return value
    try:
        return uuid.UUID(str(value))
    except Exception:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="无效的 ID")

