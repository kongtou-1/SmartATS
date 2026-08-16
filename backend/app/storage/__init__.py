"""Storage backend selection.

Exposes a single ``storage`` instance (MinIO by default) so callers import
``from ..storage import storage`` and never depend on a concrete backend.
"""
from __future__ import annotations

from ..core.config import STORAGE_BACKEND
from .base import Storage

if STORAGE_BACKEND == "local":
    from .local import LocalStorage as _Backend
else:
    from .minio import MinIOStorage as _Backend

storage: Storage = _Backend()
