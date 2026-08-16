"""Application configuration loaded from environment variables.

v2 changes:
- Loads `.env` via python-dotenv (Docker also passes these vars directly).
- Default DATABASE_URL points at the Docker Postgres in infra/.
- Added Redis (Celery broker/backend) and MinIO (object storage) settings.
- STORAGE_BACKEND selects MinIO (v2 default) or local-disk fallback.
"""
import os
import base64
import hashlib

from dotenv import load_dotenv

load_dotenv()  # load backend/.env if present

_HERE = os.path.dirname(os.path.abspath(__file__))  # backend/app/core
_APP_DIR = os.path.dirname(_HERE)                   # backend/app
_BACKEND_DIR = os.path.dirname(_APP_DIR)            # backend

# Database: default to the Docker Postgres defined in infra/docker-compose.yml.
# For a no-Docker smoke test you can set: DATABASE_URL=sqlite:///./hr.db
DATABASE_URL = os.getenv("DATABASE_URL", "postgresql://hr:hr_password@localhost:5432/hr_ats")

SECRET_KEY = os.getenv("SECRET_KEY", "mvp-development-secret-key-change-in-production-32bytes")
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = int(os.getenv("ACCESS_TOKEN_EXPIRE_MINUTES", "1440"))

# Celery / Redis
REDIS_URL = os.getenv("REDIS_URL", "redis://localhost:6379/0")

# Object storage: MinIO (v2 default) or local disk fallback.
STORAGE_BACKEND = os.getenv("STORAGE_BACKEND", "minio")  # minio | local

MINIO_ENDPOINT = os.getenv("MINIO_ENDPOINT", "localhost:9000")
MINIO_ACCESS_KEY = os.getenv("MINIO_ACCESS_KEY", "hrminio")
MINIO_SECRET_KEY = os.getenv("MINIO_SECRET_KEY", "hrminio_password")
MINIO_BUCKET = os.getenv("MINIO_BUCKET", "hr-resumes")
MINIO_SECURE = os.getenv("MINIO_SECURE", "false").lower() == "true"

# Local-disk fallback directory (only used when STORAGE_BACKEND=local).
UPLOAD_DIR = os.getenv("UPLOAD_DIR", os.path.join(_BACKEND_DIR, "uploads"))
os.makedirs(UPLOAD_DIR, exist_ok=True)

# Agent provider: "heuristic" (default, no external deps) or "llm" (needs API key).
AGENT_PROVIDER = os.getenv("AGENT_PROVIDER", "heuristic")

CORS_ORIGINS = os.getenv(
    "CORS_ORIGINS",
    "http://localhost:5173,http://localhost:5177,http://127.0.0.1:5173,http://127.0.0.1:5177",
).split(",")

# Candidate portal origin used in simulated outbound Offer messages.
CANDIDATE_PORTAL_URL = os.getenv("CANDIDATE_PORTAL_URL", "http://localhost:5173").rstrip("/")

# Use a dedicated Fernet key in production. The deterministic development
# fallback keeps local demo databases readable between restarts.
IDENTITY_ENCRYPTION_KEY = os.getenv("IDENTITY_ENCRYPTION_KEY") or base64.urlsafe_b64encode(
    hashlib.sha256(b"hr-ats-development-identity-key").digest()
).decode()
