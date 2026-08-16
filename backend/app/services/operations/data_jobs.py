"""Asynchronous data import/export job operations."""
from uuid import UUID

from fastapi import Depends, File, HTTPException, Query, Response, UploadFile
from sqlalchemy.orm import Session

from ... import models
from ...core.audit import write_audit
from ..database import get_db
from ...core.permissions import require_roles
from ..documents.excel_io import build_template
from ...storage import storage
from ...workers.data_tasks import process_data_job



def template(_=Depends(require_roles("SUPER_ADMIN", "HR"))):
    return Response(content=build_template(), media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", headers={"Content-Disposition": 'attachment; filename="talent-import-template.xlsx"'})


async def import_talents(file: UploadFile = File(...), user=Depends(require_roles("SUPER_ADMIN", "HR")), db: Session = Depends(get_db)):
    raw = await file.read()
    if not raw or len(raw) > 20 * 1024 * 1024: raise HTTPException(400, "文件为空或超过 20MB")
    if not (file.filename or "").lower().endswith(".xlsx"): raise HTTPException(400, "仅支持 .xlsx")
    row = models.DataJob(kind="IMPORT", status="PENDING", created_by=user.id, input_key=storage.save_file(f"data-jobs/{file.filename}", raw), summary={})
    db.add(row); db.flush(); write_audit(db, actor=user, action="DATA_IMPORT_START", entity_type="DataJob", entity_id=row.id); db.commit(); process_data_job.delay(str(row.id)); return {"id": row.id, "status": row.status}


def export_talents(
    name: str = "", phone: str = "", skills: list[str] = Query(default=[]), tag_ids: list[str] = Query(default=[]),
    source_channel_id: UUID | None = None, owner_id: UUID | None = None, job_id: UUID | None = None,
    stage: str = "", min_years: int | None = None, max_years: int | None = None,
    user=Depends(require_roles("SUPER_ADMIN", "HR")), db: Session = Depends(get_db),
):
    from ..talent.talents import apply_talent_filters, normalize_tag_ids
    normalized_tags = [str(x) for x in normalize_tag_ids(tag_ids)]
    apply_talent_filters(db, db.query(models.Candidate), name=name, phone=phone, skills=skills, tag_ids=normalized_tags, source_channel_id=source_channel_id, owner_id=owner_id, job_id=job_id, stage=stage, min_years=min_years, max_years=max_years)
    filters = {"name": name, "phone": phone, "skills": skills, "tag_ids": normalized_tags, "source_channel_id": str(source_channel_id) if source_channel_id else "", "owner_id": str(owner_id) if owner_id else "", "job_id": str(job_id) if job_id else "", "stage": stage, "min_years": min_years, "max_years": max_years}
    row = models.DataJob(kind="EXPORT", status="PENDING", created_by=user.id, summary={"filters": filters}); db.add(row); db.flush(); write_audit(db, actor=user, action="DATA_EXPORT_START", entity_type="DataJob", entity_id=row.id, after=row.summary); db.commit(); process_data_job.delay(str(row.id)); return {"id": row.id, "status": row.status}


def get_job(job_id: UUID, user=Depends(require_roles("SUPER_ADMIN", "HR")), db: Session = Depends(get_db)):
    row = db.get(models.DataJob, job_id)
    if not row or (user.role != "SUPER_ADMIN" and row.created_by != user.id): raise HTTPException(404, "任务不存在")
    return row


def download(job_id: UUID, user=Depends(require_roles("SUPER_ADMIN", "HR")), db: Session = Depends(get_db)):
    row = db.get(models.DataJob, job_id)
    if not row or not row.output_key or (user.role != "SUPER_ADMIN" and row.created_by != user.id): raise HTTPException(404, "结果文件不存在")
    return Response(content=storage.read_file(row.output_key), media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", headers={"Content-Disposition": f'attachment; filename="data-job-{job_id}.xlsx"'})

