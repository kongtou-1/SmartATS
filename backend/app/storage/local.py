"""Local-disk file storage (fallback when ``STORAGE_BACKEND=local``)."""
from __future__ import annotations

import os

from ..core.config import UPLOAD_DIR
from .base import Storage


def _random_hex() -> str:
    import uuid

    return uuid.uuid4().hex


class LocalStorage:
    def ensure_bucket(self) -> None:
        os.makedirs(os.path.join(UPLOAD_DIR, "resumes"), exist_ok=True)

    def save_file(self, filename: str, raw: bytes) -> str:
        normalized = filename.replace("\\", "/")
        folder = "offers" if normalized.startswith("offers/") else "data-jobs" if normalized.startswith("data-jobs/") else "resumes"
        safe_name = os.path.basename(normalized) or "file"
        key = os.path.join(folder, f"{_random_hex()}_{safe_name}")
        path = os.path.join(UPLOAD_DIR, key)
        os.makedirs(os.path.dirname(path), exist_ok=True)
        with open(path, "wb") as f:
            f.write(raw)
        return key

    def read_file(self, storage_key: str) -> bytes:
        path = os.path.join(UPLOAD_DIR, storage_key)
        _ensure_within(path)
        with open(path, "rb") as f:
            return f.read()

    def delete_file(self, storage_key: str) -> None:
        path = os.path.join(UPLOAD_DIR, storage_key)
        try:
            os.remove(path)
        except FileNotFoundError:
            pass

    def presign_url(self, storage_key: str, expires_seconds: int = 3600) -> str:
        # Local disk has no presigned URL; return the relative key for callers to map.
        return storage_key


def _ensure_within(path: str) -> None:
    """Prevent path-traversal when reading back a storage_key."""
    base = os.path.abspath(UPLOAD_DIR)
    if os.path.abspath(path) != base and not os.path.abspath(path).startswith(base + os.sep):
        raise ValueError("illegal storage_key")
