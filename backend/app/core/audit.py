"""Append-only audit helpers and request middleware."""
from __future__ import annotations

import hashlib
import uuid
from contextvars import ContextVar
from typing import Any

from fastapi import Request
from starlette.middleware.base import BaseHTTPMiddleware

from ..services.database import SessionLocal
from .security import decode_access_token
from .. import models

request_context: ContextVar[dict[str, str]] = ContextVar("audit_request", default={})
SENSITIVE = {"password", "password_hash", "token", "token_hash", "salary", "salary_description", "phone", "email", "identity"}


def _mask(value: Any) -> Any:
    if value in (None, ""):
        return value
    raw = str(value)
    return f"***{hashlib.sha256(raw.encode()).hexdigest()[:10]}"


def sanitize(value: Any) -> Any:
    if isinstance(value, dict):
        return {k: (_mask(v) if any(s in k.lower() for s in SENSITIVE) else sanitize(v)) for k, v in value.items()}
    if isinstance(value, list):
        return [sanitize(v) for v in value]
    if isinstance(value, (str, int, float, bool)) or value is None:
        return value
    return str(value)


_ACTOR_TYPE_BY_TOKEN = {"candidate": "CANDIDATE", "admin": "ADMIN"}


def actor_type_of(actor) -> str:
    """Map an account instance to its audit actor_type (CANDIDATE / ADMIN / SYSTEM)."""
    if actor is None:
        return "SYSTEM"
    return _ACTOR_TYPE_BY_TOKEN.get(getattr(actor, "ACCOUNT_TYPE", ""), "SYSTEM")


def write_audit(
    db,
    *,
    actor=None,
    action: str,
    entity_type: str,
    entity_id: str = "",
    before: dict | None = None,
    after: dict | None = None,
    actor_type: str | None = None,
    commit: bool = False,
) -> models.AuditLog:
    context = request_context.get({})
    row = models.AuditLog(
        actor_id=getattr(actor, "id", None),
        actor_type=actor_type or actor_type_of(actor),
        request_id=context.get("request_id", str(uuid.uuid4())),
        action=action, entity_type=entity_type, entity_id=str(entity_id or ""),
        before_data=sanitize(before or {}), after_data=sanitize(after or {}),
        ip_address=context.get("ip", ""), user_agent=context.get("user_agent", ""),
    )
    db.add(row)
    if commit:
        db.commit()
    return row


class AuditMiddleware(BaseHTTPMiddleware):
    """Records every successful business mutation not explicitly audited by a route."""

    async def dispatch(self, request: Request, call_next):
        request_id = request.headers.get("X-Request-ID") or str(uuid.uuid4())
        token = request_context.set({
            "request_id": request_id,
            "ip": request.client.host if request.client else "",
            "user_agent": request.headers.get("user-agent", "")[:512],
        })
        try:
            response = await call_next(request)
            response.headers["X-Request-ID"] = request_id
            if request.method in {"POST", "PUT", "PATCH", "DELETE"} and response.status_code < 400:
                path = request.url.path
                if path != "/api/v1/auth/login":
                    actor_id = None
                    actor_type = "SYSTEM"
                    auth = request.headers.get("authorization", "")
                    if auth.lower().startswith("bearer "):
                        try:
                            claims = decode_access_token(auth.split(" ", 1)[1])
                            actor_id = uuid.UUID(claims.get("sub", ""))
                            actor_type = _ACTOR_TYPE_BY_TOKEN.get(claims.get("typ", ""), "SYSTEM")
                        except Exception:
                            pass
                    with SessionLocal() as db:
                        db.add(models.AuditLog(
                            actor_id=actor_id, actor_type=actor_type,
                            request_id=request_id, action=f"{request.method} {path}",
                            entity_type="API", entity_id=path.rsplit("/", 1)[-1],
                            before_data={}, after_data={"status_code": response.status_code},
                            ip_address=request.client.host if request.client else "",
                            user_agent=request.headers.get("user-agent", "")[:512],
                        ))
                        db.commit()
            return response
        finally:
            request_context.reset(token)
