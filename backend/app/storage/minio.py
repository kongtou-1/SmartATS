"""MinIO (S3-compatible) object storage backend — v2 default.

The bucket is created lazily via ``ensure_bucket()`` (called from the FastAPI
lifespan) so importing this module never requires MinIO to be reachable.
"""
from __future__ import annotations

import io
import os
from datetime import timedelta

from minio import Minio
from minio.error import S3Error

from ..core.config import (
    MINIO_ACCESS_KEY,
    MINIO_BUCKET,
    MINIO_ENDPOINT,
    MINIO_SECRET_KEY,
    MINIO_SECURE,
)
from .base import Storage


def _random_hex() -> str:
    import uuid

    return uuid.uuid4().hex


class MinIOStorage:
    def __init__(self) -> None:
        self.client = Minio(
            MINIO_ENDPOINT,
            access_key=MINIO_ACCESS_KEY,
            secret_key=MINIO_SECRET_KEY,
            secure=MINIO_SECURE,
        )
        self.bucket = MINIO_BUCKET

    def ensure_bucket(self) -> None:
        try:
            if not self.client.bucket_exists(self.bucket):
                self.client.make_bucket(self.bucket)
        except S3Error as exc:  # pragma: no cover - depends on live MinIO
            raise RuntimeError(f"MinIO bucket init failed for '{self.bucket}': {exc}") from exc

    def save_file(self, filename: str, raw: bytes) -> str:
        normalized = filename.replace("\\", "/")
        folder = "offers" if normalized.startswith("offers/") else "data-jobs" if normalized.startswith("data-jobs/") else "resumes"
        safe_name = os.path.basename(normalized) or "file"
        key = f"{folder}/{_random_hex()}_{safe_name}"
        self.client.put_object(
            self.bucket,
            key,
            data=io.BytesIO(raw),
            length=len(raw),
            content_type="application/octet-stream",
        )
        return key

    def read_file(self, storage_key: str) -> bytes:
        resp = self.client.get_object(self.bucket, storage_key)
        try:
            return resp.read()
        finally:
            resp.close()
            resp.release_conn()

    def delete_file(self, storage_key: str) -> None:
        try:
            self.client.remove_object(self.bucket, storage_key)
        except S3Error:
            pass

    def presign_url(self, storage_key: str, expires_seconds: int = 3600) -> str:
        return self.client.presigned_get_object(
            self.bucket, storage_key, expires=timedelta(seconds=expires_seconds)
        )
