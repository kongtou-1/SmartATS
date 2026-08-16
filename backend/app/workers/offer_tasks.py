from datetime import datetime, timezone

from .. import models
from ..core.audit import write_audit
from ..services.database import SessionLocal
from .celery_app import celery_app


@celery_app.task(name="offers.expire")
def expire_offers():
    with SessionLocal() as db:
        rows = db.query(models.Offer).filter(models.Offer.status == "SENT", models.Offer.expires_at <= datetime.now(timezone.utc)).all()
        for offer in rows:
            offer.status = "EXPIRED"
            app = db.get(models.Application, offer.application_id)
            if app and app.status == "ACTIVE":
                app.status = "REJECTED"; app.current_stage = "REJECTED"
                db.add(models.ApplicationStageHistory(application_id=app.id, from_stage="FINAL_REVIEW", to_stage="REJECTED", reason="Offer 已过期"))
            write_audit(db, actor_type="SYSTEM", action="OFFER_EXPIRE", entity_type="Offer", entity_id=offer.id)
        db.commit()
        return len(rows)
