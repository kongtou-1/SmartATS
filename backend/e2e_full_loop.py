"""End-to-end full-loop test against the real FastAPI backend on :8111.

Walks the entire MVP recruiting loop and asserts the 4 simulated email kinds
are produced (APPLICATION_RECEIVED / INTERVIEW_INVITE / INTERVIEW_CANCEL /
FINAL_RESULT). Uses a fresh sqlite DB (set DATABASE_URL before launching uvicorn).

Run order:
  DATABASE_URL=sqlite:///./hr_8111.db uvicorn app.main:app --port 8111 &
  python e2e_full_loop.py
"""
import sqlite3
import sys
import httpx

BASE = "http://localhost:8111/api/v1"
DB_PATH = "hr_8111.db"

fails = []


def check(cond, label):
    if cond:
        print(f"  PASS  {label}")
    else:
        print(f"  FAIL  {label}")
        fails.append(label)


def client_for(token=None):
    headers = {"Authorization": f"Bearer {token}"} if token else {}
    return httpx.Client(base_url=BASE, headers=headers, timeout=20)


def login(c, email, password):
    r = c.post("/auth/login", json={"email": email, "password": password})
    assert r.status_code == 200, f"login {email} -> {r.status_code} {r.text}"
    return r.json()["access_token"]


def main():
    # 0. health
    with client_for() as c:
        r = c.get("/health")
        check(r.status_code == 200, "health 200")

    cand1 = client_for()
    hr = client_for()
    sa = client_for()

    # 1. candidate login + resume upload + parse
    t = login(cand1, "candidate@demo.com", "demo1234")
    cand1.headers["Authorization"] = f"Bearer {t}"
    check(cand1.get("/candidate/profile").status_code == 200, "candidate profile GET")

    resume_text = (
        "张三\n"
        "邮箱: zhangsan@example.com\n"
        "电话: 13800138000\n"
        "技能: Python, FastAPI, React, PostgreSQL, 后端, 微服务\n"
        "工作经历\n某科技公司 后端工程师，负责招聘系统 API 与微服务。\n"
        "项目经历\nATS 项目，使用 FastAPI + PostgreSQL 构建。\n"
    )
    r = cand1.post(
        "/candidate/resume",
        files={"file": ("zhangsan_resume.txt", resume_text.encode("utf-8"), "text/plain")},
    )
    check(r.status_code == 201, f"resume upload 201 (got {r.status_code})")
    parsed = r.json().get("parsed_data", {})
    check(bool(parsed.get("skills")), f"resume parsed skills non-empty: {parsed.get('skills')}")
    check(bool(parsed.get("email")), f"resume parsed email: {parsed.get('email')}")

    # 2. browse jobs -> pick two PUBLISHED
    r = cand1.get("/jobs")
    check(r.status_code == 200, "jobs list 200")
    jobs = [j for j in r.json() if j["status"] == "PUBLISHED"]
    check(len(jobs) >= 2, f"have >=2 PUBLISHED jobs (got {len(jobs)})")
    job1, job2 = jobs[0], jobs[1]

    # 3. apply (AppA on job1, AppB on job2)
    r = cand1.post("/applications", json={"job_id": job1["id"]})
    check(r.status_code == 201, f"apply job1 201 (got {r.status_code})")
    appA_id = r.json()["id"]
    r = cand1.post("/applications", json={"job_id": job2["id"]})
    check(r.status_code == 201, f"apply job2 201 (got {r.status_code})")
    appB_id = r.json()["id"]

    # 4. my-applications + detail
    r = cand1.get("/applications/my")
    check(r.status_code == 200 and len(r.json()) >= 2, "my applications >=2")
    r = cand1.get(f"/applications/{appA_id}")
    check(r.status_code == 200, "application detail 200")

    # 5. HR login
    t = login(hr, "hr@demo.com", "demo1234")
    hr.headers["Authorization"] = f"Bearer {t}"
    check(hr.get("/admin/jobs").status_code == 200, "HR admin jobs 200")

    # 6. HR can list interviewers (the key fix)
    r = hr.get("/admin/interviewers")
    check(r.status_code == 200, f"HR /admin/interviewers 200 (got {r.status_code})")
    ivs = [u for u in r.json() if u["role"] == "INTERVIEWER"]
    check(len(ivs) >= 1, f"interviewer list non-empty (got {len(ivs)})")
    interviewer_id = ivs[0]["id"]

    # 7. next-stage AppA a couple times, then create + cancel interview
    r = hr.post(f"/admin/applications/{appA_id}/next-stage", json={"reason": "进入简历审核"})
    check(r.status_code == 200, "AppA next-stage 200")
    from datetime import datetime, timedelta, timezone
    sched = (datetime.now(timezone.utc) + timedelta(days=2)).isoformat()
    r = hr.post(
        "/admin/interviews",
        json={
            "application_id": appA_id,
            "interviewer_id": interviewer_id,
            "round_type": "FIRST",
            "scheduled_at": sched,
            "duration_minutes": 60,
            "method": "视频面试",
            "meeting_url": "https://meet.example.com/room/1",
            "note": "请准备项目介绍",
        },
    )
    check(r.status_code == 201, f"create interview 201 (got {r.status_code})")
    interview_id = r.json()["id"]
    # verify candidate cannot see AI score via their interview view (candidate API has none)
    r = hr.post(f"/admin/interviews/{interview_id}/cancel")
    check(r.status_code == 200 and r.json().get("status") == "CANCELLED", "cancel interview -> CANCELLED")

    # 8. reject AppB -> FINAL_RESULT
    r = hr.post(f"/admin/applications/{appB_id}/reject", json={"reason": "当前岗位匹配度不足"})
    check(r.status_code == 200 and r.json().get("status") == "REJECTED", "reject AppB -> REJECTED")

    # 9. create + publish a 3rd job, candidate applies, advance to HIRED -> FINAL_RESULT
    r = hr.post(
        "/admin/jobs",
        json={
            "title": "数据分析师",
            "location": "深圳",
            "description": "负责招聘数据看板与漏斗分析。",
            "requirements": "1. 熟练 Python；\n2. 熟悉 Pandas / SQL；\n3. 有数据分析经验。",
        },
    )
    check(r.status_code == 201, f"create job 201 (got {r.status_code})")
    job3 = r.json()
    r = hr.post(f"/admin/jobs/{job3['id']}/publish")
    check(r.status_code == 200 and r.json().get("status") == "PUBLISHED", "publish job3")
    r = cand1.post("/applications", json={"job_id": job3["id"]})
    check(r.status_code == 201, f"apply job3 201 (got {r.status_code})")
    appC_id = r.json()["id"]
    for _ in range(6):
        r = hr.post(f"/admin/applications/{appC_id}/next-stage", json={"reason": "通过本阶段评估"})
        if r.status_code != 200:
            break
        if r.json().get("status") == "HIRED":
            break
    check(r.status_code == 200 and r.json().get("status") == "HIRED", f"AppC advanced to HIRED (got {r.json().get('status')})")

    # 10. register cand2, upload resume, apply job2, withdraw (tests withdraw button backend path)
    r2 = httpx.Client(base_url=BASE, timeout=20)
    r = r2.post("/auth/register", json={"email": "cand2@example.com", "password": "demo1234", "name": "李四"})
    check(r.status_code in (200, 201), f"register cand2 200/201 (got {r.status_code})")
    t2 = login(r2, "cand2@example.com", "demo1234")
    r2.headers["Authorization"] = f"Bearer {t2}"
    r = r2.post(
        "/candidate/resume",
        files={"file": ("lisi_resume.txt", "李四\n13800138001\n技能: Python, SQL, 数据分析\n".encode("utf-8"), "text/plain")},
    )
    check(r.status_code == 201, f"cand2 resume upload 201 (got {r.status_code})")
    r = r2.post("/applications", json={"job_id": job2["id"]})
    check(r.status_code == 201, f"cand2 apply job2 201 (got {r.status_code})")
    appD_id = r.json()["id"]
    r = r2.post(f"/applications/{appD_id}/withdraw")
    check(r.status_code == 204, f"cand2 withdraw 204 (got {r.status_code})")
    r = r2.get(f"/applications/{appD_id}")
    check(r.status_code == 200 and r.json().get("status") == "WITHDRAWN", "cand2 application now WITHDRAWN")

    # 11. assert all 4 email kinds present in email_logs
    conn = sqlite3.connect(DB_PATH)
    kinds = {row[0] for row in conn.execute("SELECT DISTINCT kind FROM email_logs")}
    conn.close()
    print("  email_logs kinds:", sorted(kinds))
    for k in ["APPLICATION_RECEIVED", "INTERVIEW_INVITE", "INTERVIEW_CANCEL", "FINAL_RESULT"]:
        check(k in kinds, f"email kind present: {k}")

    cand1.close()
    hr.close()
    sa.close()
    r2.close()

    print("\n==== RESULT ====")
    if fails:
        print(f"{len(fails)} FAILURE(S):")
        for f in fails:
            print(" -", f)
        sys.exit(1)
    print("ALL E2E CHECKS PASSED")


if __name__ == "__main__":
    main()
