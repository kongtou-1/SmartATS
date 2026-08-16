@echo off
REM HR ATS v2 dev launcher (Windows). Prereq: docker infra up (cd ../infra && docker compose up -d).
cd /d %~dp0
if not exist .venv\Scripts\uvicorn.exe (
    echo [ERROR] .venv not found. Run: python -m venv .venv && pip install -r requirements.txt
    pause
    exit /b 1
)
REM Use venv executables by full path to avoid conda's activate shadowing.
start "hr-api" cmd /k "cd /d %~dp0 && .venv\Scripts\uvicorn.exe app.main:app --reload --port 8111"
start "hr-celery" cmd /k "cd /d %~dp0 && .venv\Scripts\celery.exe -A app.workers.celery_app worker -l info --pool=solo"
start "hr-beat" cmd /k "cd /d %~dp0 && .venv\Scripts\celery.exe -A app.workers.celery_app beat -l info"
echo Started API (http://localhost:8111), Celery worker, and Celery beat in 3 windows. Close a window to stop it.
pause
