"""Password hashing and JWT handling (no third-party crypto dependency)."""
import hashlib
import hmac
import os
import uuid
from datetime import datetime, timedelta, timezone

import jwt

from .config import ACCESS_TOKEN_EXPIRE_MINUTES, ALGORITHM, SECRET_KEY


def hash_password(password: str) -> str:
    """PBKDF2-HMAC-SHA256 with a random salt, stored as algo$salt$hash."""
    salt = os.urandom(16)
    dk = hashlib.pbkdf2_hmac("sha256", password.encode("utf-8"), salt, 100_000)
    return f"pbkdf2_sha256${salt.hex()}${dk.hex()}"


def verify_password(password: str, stored: str) -> bool:
    try:
        algo, salt_hex, dk_hex = stored.split("$")
        if algo != "pbkdf2_sha256":
            return False
        salt = bytes.fromhex(salt_hex)
        dk = hashlib.pbkdf2_hmac("sha256", password.encode("utf-8"), salt, 100_000)
        return hmac.compare_digest(dk.hex(), dk_hex)
    except Exception:
        return False


TOKEN_TYPE_CANDIDATE = "candidate"
TOKEN_TYPE_ADMIN = "admin"


def create_access_token(
    user_id: str,
    account_type: str = TOKEN_TYPE_CANDIDATE,
    expires_minutes: int = ACCESS_TOKEN_EXPIRE_MINUTES,
) -> str:
    """Issue a JWT.

    `account_type` ("candidate" | "admin") is embedded as the `typ` claim so the
    auth dependency knows which isolated account table to look the subject up in.
    """
    now = datetime.now(timezone.utc)
    payload = {
        "sub": str(user_id),
        "typ": account_type,
        "iat": now,
        "exp": now + timedelta(minutes=expires_minutes),
    }
    return jwt.encode(payload, SECRET_KEY, algorithm=ALGORITHM)


def decode_access_token(token: str) -> dict:
    """Returns the JWT payload; raises jwt.PyJWTError on invalid/expired tokens."""
    return jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])


def new_uuid() -> uuid.UUID:
    return uuid.uuid4()
