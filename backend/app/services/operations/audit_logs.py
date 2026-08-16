"""Audit-log query and export operations."""
from datetime import datetime
from uuid import UUID

from fastapi import Depends, Query, Response
from sqlalchemy.orm import Session

from ... import models
from ..database import get_db
from ...core.permissions import require_roles
from ..documents.excel_io import build_table



def list_audit_logs(actor_id: UUID | None = None, action: str = "", entity_type: str = "", request_id: str = "", start: datetime | None = None, end: datetime | None = None, page: int = Query(1, ge=1), page_size: int = Query(50, ge=1, le=200), _=Depends(require_roles("SUPER_ADMIN")), db: Session = Depends(get_db)):
    q = db.query(models.AuditLog)
    if actor_id: q = q.filter_by(actor_id=actor_id)
    if action: q = q.filter(models.AuditLog.action.contains(action))
    if entity_type: q = q.filter_by(entity_type=entity_type)
    if request_id: q = q.filter_by(request_id=request_id)
    if start: q = q.filter(models.AuditLog.created_at >= start)
    if end: q = q.filter(models.AuditLog.created_at < end)
    total = q.count(); rows = q.order_by(models.AuditLog.created_at.desc()).offset((page-1)*page_size).limit(page_size).all()
    return {"items": rows, "page": page, "page_size": page_size, "total": total}


def export_audit_logs(start: datetime | None = None, end: datetime | None = None, _=Depends(require_roles("SUPER_ADMIN")), db: Session = Depends(get_db)):
    q = db.query(models.AuditLog)
    if start: q = q.filter(models.AuditLog.created_at >= start)
    if end: q = q.filter(models.AuditLog.created_at < end)
    rows = [[r.created_at, r.actor_type, str(r.actor_id or ""), r.action, r.entity_type, r.entity_id, r.request_id, r.ip_address, str(r.after_data)] for r in q.order_by(models.AuditLog.created_at.desc()).limit(10000)]
    raw = build_table("操作审计", ["时间","操作者类型","操作者ID","动作","实体类型","实体ID","请求号","IP","脱敏结果"], rows)
    return Response(content=raw, media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", headers={"Content-Disposition": 'attachment; filename="audit-logs.xlsx"'})

