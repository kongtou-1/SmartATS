"""Candidate structured profile and resume upload."""
from __future__ import annotations

import re
from datetime import datetime, timezone
from pathlib import Path

from fastapi import Depends, File, HTTPException, UploadFile, status
from sqlalchemy.orm import Session

from ...core.audit import write_audit
from ..database import get_db
from ...core.identity import encrypt_identity_number, identity_mask
from ...core.permissions import get_current_candidate, get_current_candidate_account
from ...models import Candidate, Resume, CandidateAccount
from ...schemas import ProfileIn, ProfileOut, ResumeOut
from ...storage import storage
from .talents import normalize_email, normalize_phone

MAX_RESUME_BYTES = 10 * 1024 * 1024
ALLOWED_RESUME_EXTENSIONS = {".pdf", ".doc", ".docx"}
EDUCATION_TYPES = {"FULL_TIME", "PART_TIME", "OTHER"}
DEGREES = {"ASSOCIATE", "BACHELOR", "MASTER", "DOCTOR", "OTHER_POST_SECONDARY"}
IDENTITY_TYPES = {"CN_ID", "PASSPORT", "HK_MACAO_TAIWAN", "OTHER"}
MONTH_PATTERN = re.compile(r"^\d{4}-(0[1-9]|1[0-2])$")


def build_profile(candidate: Candidate) -> ProfileOut:
    return ProfileOut(
        name=candidate.name, phone=candidate.phone, contact_email=candidate.contact_email,
        identity_type=candidate.identity_type, identity_number_masked=identity_mask(candidate.identity_number_last4),
        identity_number_set=bool(candidate.identity_number_encrypted), preferred_locations=candidate.preferred_locations or [],
        education=candidate.education or [], internships=candidate.internships or [],
        work_experiences=candidate.work_experiences or [], projects=candidate.projects or [],
        languages=candidate.languages or [], certificates=candidate.certificates or [],
        self_evaluation=candidate.self_evaluation, profile_version=candidate.profile_version,
        profile_saved_at=candidate.profile_saved_at,
    )


def _validate_month_range(item: dict, label: str, *, current_allowed: bool = False):
    start, end, current = item.get("start", ""), item.get("end", ""), bool(item.get("current"))
    if not MONTH_PATTERN.fullmatch(start): raise HTTPException(400, f"{label}开始时间必须为 YYYY-MM")
    if current_allowed and current:
        if end: raise HTTPException(400, f"{label}选择至今后结束时间必须为空")
        return
    if not MONTH_PATTERN.fullmatch(end): raise HTTPException(400, f"{label}结束时间必须为 YYYY-MM")
    if end < start: raise HTTPException(400, f"{label}结束时间不得早于开始时间")


def validate_profile_for_application(candidate: Candidate) -> dict:
    profile = build_profile(candidate).model_dump(mode="json")
    required = {"姓名": candidate.name, "手机号": candidate.phone, "邮箱": candidate.contact_email,
                "证件类型": candidate.identity_type, "证件号码": candidate.identity_number_encrypted}
    missing = [name for name, value in required.items() if not str(value or "").strip()]
    if missing: raise HTTPException(400, f"请完善必填资料：{'、'.join(missing)}")
    if len(normalize_phone(candidate.phone)) < 7: raise HTTPException(400, "手机号格式无效")
    if not re.fullmatch(r"[^@\s]+@[^@\s]+\.[^@\s]+", candidate.contact_email): raise HTTPException(400, "邮箱格式无效")
    if candidate.identity_type not in IDENTITY_TYPES: raise HTTPException(400, "证件类型无效")
    if not candidate.preferred_locations: raise HTTPException(400, "请至少填写一个期望工作地点")
    education = candidate.education or []
    if not education: raise HTTPException(400, "请至少填写一段高中以上教育经历")
    for index, item in enumerate(education, start=1):
        missing_fields = [label for key, label in [("school","学校"),("education_type","学历类型"),("degree","学历"),("college","学院"),("major","专业")] if not str(item.get(key, "")).strip()]
        if missing_fields: raise HTTPException(400, f"第 {index} 段教育经历缺少：{'、'.join(missing_fields)}")
        if item.get("education_type") not in EDUCATION_TYPES: raise HTTPException(400, f"第 {index} 段教育经历学历类型无效")
        if item.get("degree") not in DEGREES: raise HTTPException(400, f"第 {index} 段教育经历学历无效")
        _validate_month_range(item, f"第 {index} 段教育经历")
    for section, label, required_keys in [
        (candidate.internships or [], "实习经历", [("company","单位"),("title","名称"),("description","描述")]),
        (candidate.work_experiences or [], "工作经历", [("company","单位"),("title","职位"),("description","描述")]),
    ]:
        for index, item in enumerate(section, start=1):
            missing_fields=[v for k,v in required_keys if not str(item.get(k,"")).strip()]
            if missing_fields: raise HTTPException(400, f"第 {index} 段{label}缺少：{'、'.join(missing_fields)}")
            _validate_month_range(item, f"第 {index} 段{label}", current_allowed=True)
    for index, item in enumerate(candidate.projects or [], start=1):
        missing_fields=[v for k,v in [("name","名称"),("role","角色"),("description","描述")] if not str(item.get(k,"")).strip()]
        if missing_fields: raise HTTPException(400, f"第 {index} 段项目经历缺少：{'、'.join(missing_fields)}")
        _validate_month_range(item, f"第 {index} 段项目经历", current_allowed=True)
    for index, item in enumerate(candidate.languages or [], start=1):
        missing_fields = [v for k, v in [("language", "语种"), ("proficiency", "熟练度")] if not str(item.get(k, "")).strip()]
        if missing_fields: raise HTTPException(400, f"第 {index} 条语言能力缺少：{'、'.join(missing_fields)}")
    for index, item in enumerate(candidate.certificates or [], start=1):
        missing_fields = [v for k, v in [("name", "名称"), ("issuer", "颁发机构"), ("obtained_at", "取得时间")] if not str(item.get(k, "")).strip()]
        if missing_fields: raise HTTPException(400, f"第 {index} 条证书缺少：{'、'.join(missing_fields)}")
        if not MONTH_PATTERN.fullmatch(str(item.get("obtained_at", ""))):
            raise HTTPException(400, f"第 {index} 条证书取得时间必须为 YYYY-MM")
    profile["identity_number_masked"] = identity_mask(candidate.identity_number_last4)
    profile.pop("identity_number_set", None)
    return profile


def get_profile(user: CandidateAccount = Depends(get_current_candidate_account), db: Session = Depends(get_db)):
    return build_profile(get_current_candidate(user, db))


def update_profile(payload: ProfileIn, user: CandidateAccount = Depends(get_current_candidate_account), db: Session = Depends(get_db)):
    candidate = get_current_candidate(user, db)
    before = build_profile(candidate).model_dump(mode="json")
    candidate.name = payload.name.strip(); candidate.phone = payload.phone.strip(); candidate.normalized_phone = normalize_phone(payload.phone)
    candidate.contact_email = payload.contact_email.strip(); candidate.normalized_email = normalize_email(payload.contact_email)
    candidate.identity_type = payload.identity_type
    if payload.identity_number is not None:
        raw = re.sub(r"\s", "", payload.identity_number)
        if raw:
            if len(raw) < 4 or len(raw) > 64: raise HTTPException(400, "证件号码长度无效")
            candidate.identity_number_encrypted = encrypt_identity_number(raw); candidate.identity_number_last4 = raw[-4:]
    candidate.preferred_locations = [v.strip() for v in payload.preferred_locations if v.strip()]
    for attr in ("education", "internships", "work_experiences", "projects", "languages", "certificates"):
        setattr(candidate, attr, [item.model_dump() for item in getattr(payload, attr)])
    candidate.self_evaluation = payload.self_evaluation.strip(); candidate.profile_version += 1; candidate.profile_saved_at = datetime.now(timezone.utc)
    if candidate.name: user.name = candidate.name
    after = build_profile(candidate).model_dump(mode="json")
    write_audit(db, actor=user, action="CANDIDATE_PROFILE_SAVE", entity_type="Candidate", entity_id=candidate.id, before=before, after=after)
    db.commit(); db.refresh(candidate)
    return build_profile(candidate)


def get_resume(user: CandidateAccount = Depends(get_current_candidate_account), db: Session = Depends(get_db)):
    candidate = get_current_candidate(user, db)
    resume = db.query(Resume).filter_by(candidate_id=candidate.id).order_by(Resume.created_at.desc()).first()
    return ResumeOut.model_validate(resume) if resume else None


def upload_resume(file: UploadFile = File(...), user: CandidateAccount = Depends(get_current_candidate_account), db: Session = Depends(get_db)):
    candidate = get_current_candidate(user, db); filename = file.filename or "resume.pdf"; extension = Path(filename).suffix.lower()
    if extension not in ALLOWED_RESUME_EXTENSIONS: raise HTTPException(400, "仅支持 PDF、DOC、DOCX 简历")
    raw = file.file.read(MAX_RESUME_BYTES + 1)
    if not raw: raise HTTPException(400, "文件为空")
    if len(raw) > MAX_RESUME_BYTES: raise HTTPException(400, "简历文件不能超过 10MB")
    signatures = {".pdf": raw.startswith(b"%PDF"), ".doc": raw.startswith(b"\xd0\xcf\x11\xe0"), ".docx": raw.startswith(b"PK")}
    if not signatures[extension]: raise HTTPException(400, "文件内容与扩展名不匹配")
    storage_key = storage.save_file(filename, raw)
    resume = Resume(candidate_id=candidate.id, file_name=filename, storage_key=storage_key, parse_status="PENDING", parsed_data=None)
    db.add(resume); db.flush(); write_audit(db, actor=user, action="RESUME_UPLOAD", entity_type="Resume", entity_id=resume.id, after={"file_name": filename, "size": len(raw)}); db.commit(); db.refresh(resume)
    from ...workers.resume_tasks import parse_resume_task
    try:
        parse_resume_task.delay(str(resume.id), candidate.name)
    except Exception as exc:  # 异步解析失败不应阻断同步上传响应
        import logging

        logging.getLogger(__name__).warning("简历解析任务入队失败（不影响上传）: %s", exc)
    return ResumeOut.model_validate(resume)

