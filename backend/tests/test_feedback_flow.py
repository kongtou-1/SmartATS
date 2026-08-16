import os
import tempfile
import unittest
from datetime import datetime, timedelta, timezone


_TEMP_DIR = tempfile.TemporaryDirectory()
os.environ["DATABASE_URL"] = f"sqlite:///{os.path.join(_TEMP_DIR.name, 'test_feedback.db').replace(os.sep, '/')}"
os.environ["STORAGE_BACKEND"] = "local"
os.environ["UPLOAD_DIR"] = os.path.join(_TEMP_DIR.name, "uploads")

from fastapi.testclient import TestClient  # noqa: E402

from app import models  # noqa: E402
from app.services.database import Base, SessionLocal, engine  # noqa: E402
from app.main import app  # noqa: E402
from app.seed import seed_if_empty  # noqa: E402
from app.services.recruitment import applications, interviews  # noqa: E402


FEEDBACK_BODY = dict(
    professional_score=4,
    project_score=4,
    communication_score=4,
    strengths="技术扎实",
    weaknesses="经验略浅",
    summary="整体不错",
    recommendation="PASS",
)


class FeedbackFlowTest(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        applications.send_email_task.delay = lambda *a, **k: None
        applications.analyze_application_task.delay = lambda *a, **k: None
        interviews.send_email_task.delay = lambda *a, **k: None
        cls.client_context = TestClient(app)
        cls.client = cls.client_context.__enter__()

    @classmethod
    def tearDownClass(cls):
        cls.client_context.__exit__(None, None, None)
        engine.dispose()
        _TEMP_DIR.cleanup()

    def setUp(self):
        Base.metadata.drop_all(bind=engine)
        Base.metadata.create_all(bind=engine)
        seed_if_empty()

    # ---- helpers ----
    def login(self, email):
        resp = self.client.post("/api/v1/auth/login", json={"email": email, "password": "demo1234"})
        self.assertEqual(resp.status_code, 200, resp.text)
        return {"Authorization": f"Bearer {resp.json()['access_token']}"}

    def hr(self):
        return self.login("hr@demo.com")

    def interviewer(self):
        return self.login("interviewer@demo.com")

    def make_app_at_stage(self, stage):
        with SessionLocal() as db:
            cand = db.query(models.CandidateAccount).filter_by(email="candidate@demo.com").one()
            candidate = db.query(models.Candidate).filter_by(user_id=cand.id).one()
            job = db.query(models.Job).first()
            resume = db.query(models.Resume).first()
            hr = db.query(models.AdminAccount).filter_by(role="HR").first()
            ch = db.query(models.SourceChannel).first()
            app = models.Application(
                candidate_id=candidate.id,
                job_id=job.id,
                resume_id=resume.id,
                owner_id=hr.id,
                source_channel_id=ch.id if ch else None,
                source_code_snapshot=ch.code if ch else "UNKNOWN",
                source_name_snapshot=ch.name if ch else "未知",
                current_stage=stage,
                status="ACTIVE",
                ai_score=80,
                applied_at=datetime.now(timezone.utc) - timedelta(days=10),
            )
            db.add(app)
            db.commit()
            return app.id

    def make_interview(self, app_id, round_type, past=True, status="SCHEDULED"):
        with SessionLocal() as db:
            interviewer = db.query(models.AdminAccount).filter_by(email="interviewer@demo.com").one()
            iv = models.Interview(
                application_id=app_id,
                interviewer_id=interviewer.id,
                round_type=round_type,
                scheduled_at=datetime.now(timezone.utc) - timedelta(days=1 if past else -1),
                duration_minutes=60,
                method="视频面试",
                status=status,
                created_by=interviewer.id,
            )
            db.add(iv)
            db.commit()
            return str(iv.id)

    def get_interview(self, iv_id, headers):
        return self.client.get(f"/api/v1/admin/interviews/{iv_id}", headers=headers)

    # ---- tests ----
    def test_1_submit_then_pending(self):
        app_id = self.make_app_at_stage("FIRST_INTERVIEW")
        iv_id = self.make_interview(app_id, "FIRST")
        resp = self.client.post(
            f"/api/v1/interviewer/interviews/{iv_id}/feedback",
            headers=self.interviewer(),
            json=FEEDBACK_BODY,
        )
        self.assertEqual(resp.status_code, 200, resp.text)
        detail = self.get_interview(iv_id, self.hr()).json()
        self.assertEqual(detail["status"], "PENDING_HR_REVIEW")

    def test_2_gate_blocks_without_feedback(self):
        app_id = self.make_app_at_stage("FIRST_INTERVIEW")
        self.make_interview(app_id, "FIRST")
        resp = self.client.post(
            f"/api/v1/admin/applications/{app_id}/next-stage",
            headers=self.hr(),
            json={"reason": "推进"},
        )
        self.assertEqual(resp.status_code, 400, resp.text)
        self.assertIn("尚未提交考官面评", resp.text)

    def test_3_hr_adopt_pass_advances(self):
        app_id = self.make_app_at_stage("FIRST_INTERVIEW")
        iv_id = self.make_interview(app_id, "FIRST")
        self.client.post(
            f"/api/v1/interviewer/interviews/{iv_id}/feedback",
            headers=self.interviewer(),
            json=FEEDBACK_BODY,
        )
        resp = self.client.post(
            f"/api/v1/admin/interviews/{iv_id}/confirm",
            headers=self.hr(),
            json={"mode": "ADOPT", "reason": "采纳通过"},
        )
        self.assertEqual(resp.status_code, 200, resp.text)
        self.assertEqual(resp.json()["status"], "COMPLETED")
        with SessionLocal() as db:
            app = db.get(models.Application, app_id)
            self.assertEqual(app.current_stage, "SECOND_INTERVIEW")

    def test_4_hr_custom_reject(self):
        app_id = self.make_app_at_stage("SECOND_INTERVIEW")
        iv_id = self.make_interview(app_id, "SECOND")
        self.client.post(
            f"/api/v1/interviewer/interviews/{iv_id}/feedback",
            headers=self.interviewer(),
            json={**FEEDBACK_BODY, "recommendation": "FAIL"},
        )
        resp = self.client.post(
            f"/api/v1/admin/interviews/{iv_id}/confirm",
            headers=self.hr(),
            json={"mode": "REJECT", "reason": "HR 决定淘汰"},
        )
        self.assertEqual(resp.status_code, 200, resp.text)
        with SessionLocal() as db:
            app = db.get(models.Application, app_id)
            self.assertEqual(app.status, "REJECTED")

    def test_5_edit_then_lock(self):
        app_id = self.make_app_at_stage("FIRST_INTERVIEW")
        iv_id = self.make_interview(app_id, "FIRST")
        self.client.post(
            f"/api/v1/interviewer/interviews/{iv_id}/feedback",
            headers=self.interviewer(),
            json=FEEDBACK_BODY,
        )
        # re-submit while pending -> allowed
        r2 = self.client.post(
            f"/api/v1/interviewer/interviews/{iv_id}/feedback",
            headers=self.interviewer(),
            json={**FEEDBACK_BODY, "recommendation": "HOLD"},
        )
        self.assertEqual(r2.status_code, 200, r2.text)
        # HR confirms
        self.client.post(
            f"/api/v1/admin/interviews/{iv_id}/confirm",
            headers=self.hr(),
            json={"mode": "ADOPT", "reason": "采纳"},
        )
        # re-submit after confirm -> locked
        r3 = self.client.post(
            f"/api/v1/interviewer/interviews/{iv_id}/feedback",
            headers=self.interviewer(),
            json=FEEDBACK_BODY,
        )
        self.assertEqual(r3.status_code, 400, r3.text)
        self.assertIn("已由 HR 确认", r3.text)

    def test_6_duplicate_confirm(self):
        app_id = self.make_app_at_stage("FIRST_INTERVIEW")
        iv_id = self.make_interview(app_id, "FIRST")
        self.client.post(
            f"/api/v1/interviewer/interviews/{iv_id}/feedback",
            headers=self.interviewer(),
            json=FEEDBACK_BODY,
        )
        self.client.post(
            f"/api/v1/admin/interviews/{iv_id}/confirm",
            headers=self.hr(),
            json={"mode": "ADOPT", "reason": "采纳"},
        )
        r2 = self.client.post(
            f"/api/v1/admin/interviews/{iv_id}/confirm",
            headers=self.hr(),
            json={"mode": "CONFIRM_ONLY", "reason": "重复确认"},
        )
        self.assertEqual(r2.status_code, 400, r2.text)

    def test_7_gate_blocks_no_interview(self):
        app_id = self.make_app_at_stage("FIRST_INTERVIEW")
        resp = self.client.post(
            f"/api/v1/admin/applications/{app_id}/next-stage",
            headers=self.hr(),
            json={"reason": "推进"},
        )
        self.assertEqual(resp.status_code, 400, resp.text)
        self.assertIn("尚未安排对应轮次面试", resp.text)


if __name__ == "__main__":
    unittest.main()
