"""Guardrails for the backend package boundaries introduced by the refactor."""
from pathlib import Path

from app.main import app


APP_DIR = Path(__file__).resolve().parents[1] / "app"


def test_main_uses_aggregated_api_routers():
    source = (APP_DIR / "main.py").read_text(encoding="utf-8")
    assert "from .api import admin_api_router, user_api_router" in source
    assert "from .modules" not in source


def test_service_layer_does_not_define_routers_or_depend_on_legacy_modules():
    for path in (APP_DIR / "services").rglob("*.py"):
        source = path.read_text(encoding="utf-8")
        assert "APIRouter" not in source, path
        assert ".modules" not in source, path


def test_services_are_grouped_and_modules_is_only_a_compatibility_entrypoint():
    service_files = [path.name for path in (APP_DIR / "services").glob("*.py")]
    module_files = [path.name for path in (APP_DIR / "modules").glob("*.py")]
    assert service_files == ["__init__.py"]
    assert module_files == ["__init__.py"]
    assert (APP_DIR / "services" / "database" / "session.py").is_file()
    assert (APP_DIR / "services" / "email" / "sender.py").is_file()
    assert not (APP_DIR / "core" / "database.py").exists()
    assert not (APP_DIR / "email" / "sender.py").exists()


def test_admin_and_user_routes_are_both_registered():
    paths = set(app.openapi()["paths"])
    assert "/api/v1/admin/jobs" in paths
    assert "/api/v1/jobs" in paths
    assert "/api/v1/candidate/profile" in paths
    assert "/api/v1/interviewer/interviews" in paths
