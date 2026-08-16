"""Storage abstraction used across the backend.

Concrete backends:
- ``MinIOStorage``  (v2 default, S3-compatible object storage)
- ``LocalStorage``  (fallback, writes under ``UPLOAD_DIR``)

Callers should import the unified instance from ``app.storage`` and never depend
on a concrete class::

    from ..storage import storage
    key = storage.save_file("resume.pdf", raw_bytes)
"""
from __future__ import annotations

from typing import Protocol


class Storage(Protocol):
    def ensure_bucket(self) -> None:
        """Idempotently prepare the backend (create bucket / base dir)."""
        ...

    def save_file(self, filename: str, raw: bytes) -> str:
        """Persist ``raw`` bytes and return a stable ``storage_key``."""
        ...

    def read_file(self, storage_key: str) -> bytes:
        """Read back the bytes for a ``storage_key``."""
        ...

    def delete_file(self, storage_key: str) -> None:
        """Delete the object identified by ``storage_key`` (no-op if missing)."""
        ...

    def presign_url(self, storage_key: str, expires_seconds: int = 3600) -> str:
        """Return a URL/path to access the object."""
        ...
