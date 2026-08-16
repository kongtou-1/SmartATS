import os
import tempfile
import unittest
from datetime import datetime, timedelta, timezone


_TEMP_DIR = tempfile.TemporaryDirectory()
os.environ["DATABASE_URL"] = f"sqlite:///{os.path.join(_TEMP_DIR.name, 'test.db').replace(os.sep, '/')}"
os.environ["STORAGE_BACKEND"] = "local"
os.environ["UPLOAD_DIR"] = os.path.join(_TEMP_DIR.name, "uploads")

from fastapi.testclient import TestClient

from app import models
from app.services.database import Base, SessionLocal, engine
from app.main import app
from app.seed import seed_if_empty
from app.services.recruitment import applications, interviews
from app.core.identity import encrypt_identity_number


class WorkflowTest(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        applications.send_email_task.delay = lambda *args, **kwargs: None
        applications.analyze_application_task.delay = lambda *args, **kwargs: None
        interviews.send_email_task.delay = lambda *args, **kwargs: None
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

    def login(self, email):
        response = self.client.post(
            "/api/v1/auth/login", json={"email": email, "password": "demo1234"}
        )
        self.assertEqual(response.status_code, 200, response.text)
        return {"Authorization": f"Bearer {response.json()['access_token']}"}

    def create_application(self):
        candidate_headers = self.login("candidate@demo.com")
        with SessionLocal() as db:
            user = db.query(models.CandidateAccount).filter_by(email="candidate@demo.com").one()
            candidate = db.query(models.Candidate).filter_by(user_id=user.id).one()
            candidate.contact_email=user.email;candidate.normalized_email=user.email
            candidate.identity_type="CN_ID";candidate.identity_number_encrypted=encrypt_identity_number("310101199001011234");candidate.identity_number_last4="1234"
            candidate.preferred_locations=["上海"];candidate.education=[{"start":"2014-09","end":"2018-06","education_type":"FULL_TIME","school":"示例大学","degree":"BACHELOR","college":"计算机学院","major":"计算机科学","laboratory":"","direction":"","advisor":""}]
            resume = models.Resume(
                candidate_id=candidate.id,
                file_name="resume.txt",
                storage_key="test/resume.txt",
                parse_status="DONE",
                parsed_data={"skills": []},
            )
            db.add(resume)
            db.commit()
            resume_id = str(resume.id)
            job_id = str(db.query(models.Job).filter_by(status="PUBLISHED").first().id)
        response = self.client.post(
            "/api/v1/applications", json={"job_id": job_id,"resume_id":resume_id}, headers=candidate_headers
        )
        self.assertEqual(response.status_code, 201, response.text)
        return response.json()["id"], candidate_headers

    def test_public_jobs_do_not_require_login(self):
        self.assertEqual(self.client.get("/api/v1/jobs").status_code, 200)

    def test_transition_hold_resume_and_history(self):
        application_id, candidate_headers = self.create_application()
        hr_headers = self.login("hr@demo.com")

        response = self.client.post(
            f"/api/v1/admin/applications/{application_id}/transition",
            json={"target_stage": "SECOND_INTERVIEW", "reason": "跳过一面，已有充分评估"},
            headers=hr_headers,
        )
        self.assertEqual(response.status_code, 200, response.text)
        self.assertEqual(response.json()["current_stage"], "SECOND_INTERVIEW")

        response = self.client.post(
            f"/api/v1/admin/applications/{application_id}/transition",
            json={"target_stage": "SCREENING", "reason": "资料需重新核验"},
            headers=hr_headers,
        )
        self.assertEqual(response.json()["stage_history"][-1]["action"], "RETURN")

        response = self.client.post(
            f"/api/v1/admin/applications/{application_id}/hold",
            json={"reason": "等待编制确认"},
            headers=hr_headers,
        )
        self.assertEqual(response.json()["status"], "ON_HOLD")

        response = self.client.post(
            f"/api/v1/admin/applications/{application_id}/resume",
            json={"reason": "编制已经确认"},
            headers=hr_headers,
        )
        self.assertEqual(response.json()["status"], "ACTIVE")
        self.assertEqual(response.json()["stage_history"][-1]["action"], "RESUME")

        candidate_detail = self.client.get(
            f"/api/v1/applications/{application_id}", headers=candidate_headers
        ).json()
        self.assertEqual(len(candidate_detail["stage_history"]), 5)
        self.assertNotIn("reason", candidate_detail["stage_history"][-1])

    def test_interview_constraints(self):
        application_id, _ = self.create_application()
        hr_headers = self.login("hr@demo.com")
        with SessionLocal() as db:
            interviewer_id = str(
                db.query(models.AdminAccount).filter_by(email="interviewer@demo.com").one().id
            )
            hr_id = str(db.query(models.AdminAccount).filter_by(email="hr@demo.com").one().id)

        payload = {
            "application_id": application_id,
            "interviewer_id": interviewer_id,
            "round_type": "FIRST",
            "scheduled_at": (datetime.now(timezone.utc) + timedelta(days=1)).isoformat(),
            "duration_minutes": 60,
            "method": "视频面试",
            "meeting_url": "",
            "note": "",
        }
        self.assertEqual(
            self.client.post("/api/v1/admin/interviews", json=payload, headers=hr_headers).status_code,
            400,
        )
        self.client.post(
            f"/api/v1/admin/applications/{application_id}/transition",
            json={"target_stage": "FIRST_INTERVIEW", "reason": "进入一面"},
            headers=hr_headers,
        )
        self.assertEqual(
            self.client.post(
                "/api/v1/admin/interviews",
                json={**payload, "interviewer_id": hr_id},
                headers=hr_headers,
            ).status_code,
            400,
        )
        created = self.client.post("/api/v1/admin/interviews", json=payload, headers=hr_headers)
        self.assertEqual(created.status_code, 201, created.text)
        self.assertEqual(
            self.client.post("/api/v1/admin/interviews", json=payload, headers=hr_headers).status_code,
            409,
        )


if __name__ == "__main__":
    unittest.main()
