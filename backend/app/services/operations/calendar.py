"""Calendar availability and subscription operations."""
from __future__ import annotations

import hashlib
import secrets
from datetime import datetime, timedelta, timezone
from uuid import UUID

from fastapi import Depends, File, HTTPException, Response, UploadFile
from sqlalchemy.orm import Session

from ... import models
from ...core.audit import write_audit
from ..database import get_db
from ...core.permissions import require_roles
from ...schemas import BusyBlockIn



def utc(value):
    if value.tzinfo is None: return value.replace(tzinfo=timezone.utc)
    return value.astimezone(timezone.utc)


def conflicts(db, interviewer_id, start, end, exclude_interview_id=None):
    for row in db.query(models.Interview).filter_by(interviewer_id=interviewer_id, status="SCHEDULED"):
        if exclude_interview_id and row.id == exclude_interview_id: continue
        rs, re = utc(row.scheduled_at), utc(row.scheduled_at) + timedelta(minutes=row.duration_minutes)
        if start < re and end > rs: return True
    return db.query(models.CalendarBusyBlock).filter(
        models.CalendarBusyBlock.interviewer_id == interviewer_id,
        models.CalendarBusyBlock.starts_at < end,
        models.CalendarBusyBlock.ends_at > start,
    ).first() is not None


def events(start: datetime, end: datetime, interviewer_id: UUID | None = None, user=Depends(require_roles("SUPER_ADMIN", "HR", "INTERVIEWER")), db: Session = Depends(get_db)):
    if user.role == "INTERVIEWER": interviewer_id = user.id
    q = db.query(models.Interview).filter(models.Interview.scheduled_at < end, models.Interview.scheduled_at >= start)
    if interviewer_id: q = q.filter(models.Interview.interviewer_id == interviewer_id)
    output = []
    for row in q.all():
        app = db.get(models.Application, row.application_id); cand = db.get(models.Candidate, app.candidate_id) if app else None
        output.append({"id": str(row.id), "type": "INTERVIEW", "title": f"{cand.name if cand else ''} - {row.round_type}", "start": row.scheduled_at, "end": utc(row.scheduled_at) + timedelta(minutes=row.duration_minutes), "status": row.status, "interviewer_id": row.interviewer_id})
    bq = db.query(models.CalendarBusyBlock).filter(models.CalendarBusyBlock.starts_at < end, models.CalendarBusyBlock.ends_at > start)
    if interviewer_id: bq = bq.filter(models.CalendarBusyBlock.interviewer_id == interviewer_id)
    output += [{"id": str(r.id), "type": "BUSY", "source": r.source, "title": r.title, "start": r.starts_at, "end": r.ends_at, "interviewer_id": r.interviewer_id} for r in bq.all()]
    return output


def add_busy(payload: BusyBlockIn, user=Depends(require_roles("SUPER_ADMIN", "HR", "INTERVIEWER")), db: Session = Depends(get_db)):
    if user.role == "INTERVIEWER" and payload.interviewer_id != user.id: raise HTTPException(403, "只能维护自己的忙碌时间")
    if utc(payload.ends_at) <= utc(payload.starts_at): raise HTTPException(400, "结束时间必须晚于开始时间")
    row = models.CalendarBusyBlock(**payload.model_dump(), source="MANUAL", created_by=user.id); db.add(row); db.flush(); write_audit(db, actor=user, action="CALENDAR_BUSY_CREATE", entity_type="CalendarBusyBlock", entity_id=row.id, after=payload.model_dump()); db.commit(); db.refresh(row); return row


def delete_busy(block_id: UUID, user=Depends(require_roles("SUPER_ADMIN", "HR", "INTERVIEWER")), db: Session = Depends(get_db)):
    row = db.get(models.CalendarBusyBlock, block_id)
    if not row or row.source != "MANUAL": raise HTTPException(404, "手工忙碌时段不存在")
    if user.role == "INTERVIEWER" and row.interviewer_id != user.id: raise HTTPException(403, "只能删除自己的忙碌时间")
    write_audit(db, actor=user, action="CALENDAR_BUSY_DELETE", entity_type="CalendarBusyBlock", entity_id=row.id, before={"title": row.title, "starts_at": row.starts_at, "ends_at": row.ends_at})
    db.delete(row); db.commit()
    return Response(status_code=204)


def availability(interviewer_id: UUID, start: datetime, end: datetime, duration_minutes: int = 60, _=Depends(require_roles("SUPER_ADMIN", "HR")), db: Session = Depends(get_db)):
    if duration_minutes < 15 or duration_minutes > 240 or utc(end) <= utc(start): raise HTTPException(400, "查询范围无效")
    slots = []; cursor = utc(start).replace(minute=(utc(start).minute // 30) * 30, second=0, microsecond=0)
    if cursor < utc(start): cursor += timedelta(minutes=30)
    while cursor + timedelta(minutes=duration_minutes) <= utc(end):
        slot_end = cursor + timedelta(minutes=duration_minutes)
        local_hour = (cursor + timedelta(hours=8)).hour
        if 9 <= local_hour < 18 and not conflicts(db, interviewer_id, cursor, slot_end): slots.append({"start": cursor, "end": slot_end})
        cursor += timedelta(minutes=30)
    return {"interviewer_id": interviewer_id, "slots": slots}


async def import_ics(interviewer_id: UUID, file: UploadFile = File(...), user=Depends(require_roles("SUPER_ADMIN", "HR", "INTERVIEWER")), db: Session = Depends(get_db)):
    if user.role == "INTERVIEWER" and interviewer_id != user.id: raise HTTPException(403, "只能导入自己的日历")
    from icalendar import Calendar
    raw = await file.read(); calendar = Calendar.from_ical(raw); count = 0
    for component in calendar.walk("VEVENT"):
        start, end = component.decoded("DTSTART"), component.decoded("DTEND")
        if not isinstance(start, datetime) or not isinstance(end, datetime): continue
        uid = str(component.get("UID", ""))
        existing = db.query(models.CalendarBusyBlock).filter_by(interviewer_id=interviewer_id, source="ICS", external_uid=uid).first()
        if not existing:
            db.add(models.CalendarBusyBlock(interviewer_id=interviewer_id, source="ICS", external_uid=uid, title=str(component.get("SUMMARY", "忙碌")), starts_at=utc(start), ends_at=utc(end), created_by=user.id)); count += 1
    write_audit(db, actor=user, action="ICS_IMPORT", entity_type="CalendarBusyBlock", entity_id=str(interviewer_id), after={"count": count}); db.commit(); return {"imported": count}


def create_subscription(user=Depends(require_roles("SUPER_ADMIN", "HR", "INTERVIEWER")), db: Session = Depends(get_db)):
    raw = secrets.token_urlsafe(32); digest = hashlib.sha256(raw.encode()).hexdigest()
    row = db.query(models.CalendarSubscription).filter_by(user_id=user.id).first()
    if not row: row = models.CalendarSubscription(user_id=user.id, token_hash=digest); db.add(row)
    else: row.token_hash = digest; row.revoked_at = None
    db.commit(); return {"feed_url": f"/api/v1/calendar/feed/{raw}"}


def revoke_subscription(user=Depends(require_roles("SUPER_ADMIN", "HR", "INTERVIEWER")), db: Session = Depends(get_db)):
    row = db.query(models.CalendarSubscription).filter_by(user_id=user.id).first()
    if row: row.revoked_at = datetime.now(timezone.utc); db.commit()
    return Response(status_code=204)


def calendar_feed(token: str, db: Session = Depends(get_db)):
    digest = hashlib.sha256(token.encode()).hexdigest(); sub = db.query(models.CalendarSubscription).filter_by(token_hash=digest, revoked_at=None).first()
    if not sub: raise HTTPException(404, "订阅不存在或已撤销")
    from icalendar import Calendar, Event
    cal = Calendar(); cal.add("prodid", "-//HR ATS V2//CN"); cal.add("version", "2.0")
    for row in db.query(models.Interview).filter_by(interviewer_id=sub.user_id, status="SCHEDULED"):
        event = Event(); event.add("uid", str(row.id)); event.add("summary", f"面试 {row.round_type}"); event.add("dtstart", utc(row.scheduled_at)); event.add("dtend", utc(row.scheduled_at) + timedelta(minutes=row.duration_minutes)); cal.add_component(event)
    return Response(content=cal.to_ical(), media_type="text/calendar")

