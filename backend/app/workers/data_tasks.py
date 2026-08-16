from __future__ import annotations

from .. import models
from ..core.audit import write_audit
from ..services.database import SessionLocal
from ..services.documents.excel_io import build_export, build_import_result, parse_import
from ..storage import storage
from .celery_app import celery_app


def split_values(value): return [v.strip() for v in str(value or "").replace("，", ",").split(",") if v.strip()]


@celery_app.task(name="data_jobs.process")
def process_data_job(job_id: str):
    from ..services.talent.talents import apply_talent_filters, normalize_email, normalize_phone
    import uuid
    with SessionLocal() as db:
        job = db.get(models.DataJob, uuid.UUID(job_id))
        if not job: return
        job.status = "RUNNING"; db.commit()
        try:
            if job.kind == "IMPORT":
                rows = parse_import(storage.read_file(job.input_key)); created = updated = skipped = 0; errors = []
                for item in rows:
                    try:
                        with db.begin_nested():
                            name, phone, email = str(item["姓名"] or "").strip(), str(item["手机号"] or "").strip(), str(item["邮箱"] or "").strip()
                            if not name or not (phone or email): raise ValueError("姓名及手机号/邮箱为必填")
                            np, ne = normalize_phone(phone), normalize_email(email)
                            c = db.query(models.Candidate).filter_by(normalized_phone=np).first() if np else None
                            if not c and ne: c = db.query(models.Candidate).filter_by(normalized_email=ne).first()
                            is_new = c is None
                            if not c: c = models.Candidate(name=name, phone=phone, normalized_phone=np, contact_email=email, normalized_email=ne); db.add(c); db.flush()
                            for attr, header in [("name", "姓名"), ("phone", "手机号"), ("contact_email", "邮箱"), ("city", "城市")]:
                                if item[header] not in (None, ""): setattr(c, attr, str(item[header]).strip())
                            c.normalized_phone, c.normalized_email = normalize_phone(c.phone), normalize_email(c.contact_email)
                            if item["工作年限"] not in (None, ""): c.years_experience = max(0, int(item["工作年限"]))
                            source = db.query(models.SourceChannel).filter_by(code=str(item["来源编码"] or "UNKNOWN").strip().upper()).first()
                            if source: c.source_channel_id = source.id
                            owner = db.query(models.AdminAccount).filter_by(email=str(item["负责人邮箱"] or "").strip()).filter(models.AdminAccount.delete_at.is_(None)).first()
                            if owner and owner.role in {"HR", "SUPER_ADMIN"} and owner.status == "ACTIVE": c.owner_id = owner.id
                            existing_skills = {s.normalized_name for s in db.query(models.CandidateSkill).filter_by(candidate_id=c.id)}
                            for skill in split_values(item["技能"]):
                                if skill.lower() not in existing_skills: db.add(models.CandidateSkill(candidate_id=c.id, name=skill, normalized_name=skill.lower()))
                            for tag_name in split_values(item["标签"]):
                                tag = db.query(models.Tag).filter_by(name=tag_name).first()
                                if not tag: tag = models.Tag(name=tag_name); db.add(tag); db.flush()
                                if not db.query(models.CandidateTag).filter_by(candidate_id=c.id, tag_id=tag.id).first(): db.add(models.CandidateTag(candidate_id=c.id, tag_id=tag.id))
                            if str(item["备注"] or "").strip(): db.add(models.CandidateNote(candidate_id=c.id, author_id=job.created_by, content=str(item["备注"]).strip()))
                            db.flush()
                        if is_new: created += 1
                        else: updated += 1
                    except Exception as exc:
                        skipped += 1; errors.append({"row": item["_row"], "error": str(exc)})
                job.summary = {"created": created, "updated": updated, "skipped": skipped, "errors": errors[:200]}
                if errors: job.output_key = storage.save_file(f"data-jobs/import-errors-{job.id}.xlsx", build_import_result(errors))
            else:
                filters = job.summary.get("filters", {})
                q = apply_talent_filters(db, db.query(models.Candidate), **filters)
                rows = []
                for c in q.order_by(models.Candidate.updated_at.desc()).all():
                    skills = ",".join(s.name for s in db.query(models.CandidateSkill).filter_by(candidate_id=c.id))
                    tags = ",".join(t.name for t in db.query(models.Tag).join(models.CandidateTag, models.CandidateTag.tag_id == models.Tag.id).filter(models.CandidateTag.candidate_id == c.id))
                    source = db.get(models.SourceChannel, c.source_channel_id) if c.source_channel_id else None; owner = db.get(models.AdminAccount, c.owner_id) if c.owner_id else None
                    app = db.query(models.Application).filter_by(candidate_id=c.id).order_by(models.Application.applied_at.desc()).first(); job_title = ""
                    if app:
                        j = db.get(models.Job, app.job_id); job_title = j.title if j else ""
                    rows.append([c.name, c.phone, c.contact_email, c.city, c.years_experience, skills, tags, source.code if source else "UNKNOWN", owner.email if owner else "", "", job_title, app.current_stage if app else "", c.created_at])
                job.output_key = storage.save_file(f"data-jobs/talents-{job.id}.xlsx", build_export(rows)); job.summary = {"exported": len(rows), "filters": filters}
            job.status = "COMPLETED"; write_audit(db, actor_type="SYSTEM", action=f"DATA_{job.kind}_COMPLETE", entity_type="DataJob", entity_id=job.id, after=job.summary); db.commit()
        except Exception as exc:
            job.status = "FAILED"; job.error_message = str(exc); db.commit(); raise
