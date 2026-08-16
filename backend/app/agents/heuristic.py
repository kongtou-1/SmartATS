"""Default heuristic Agent implementation (no external API dependency).

- ResumeParserHeuristic: extract text from PDF/DOCX, then best-effort pull out
  contact info, skills, and a few education/work/project items via simple rules.
- MatcherHeuristic: score a resume against a job by keyword overlap between the
  job requirements and the resume text, producing strengths/gaps + a recommendation.
"""
import io
import re

from .base import Matcher, ResumeParser

_EMAIL_RE = re.compile(r"[A-Za-z0-9._%+\-]+@[A-Za-z0-9.\-]+\.[A-Za-z]{2,}")
_PHONE_RE = re.compile(r"(?:\+?86[\s\-]?)?1[3-9]\d{9}")
# A compact keyword dictionary for skills detection (extend as needed).
_SKILL_KEYWORDS = [
    "python", "java", "javascript", "typescript", "go", "golang", "c++", "c#", "rust",
    "react", "vue", "angular", "node", "node.js", "spring", "django", "flask", "fastapi",
    "sql", "mysql", "postgresql", "postgres", "mongodb", "redis", "elasticsearch",
    "docker", "kubernetes", "k8s", "aws", "azure", "gcp", "linux", "nginx",
    "tensorflow", "pytorch", "pandas", "numpy", "sklearn", "scikit-learn", "xgboost",
    "html", "css", "sass", "webpack", "vite", "figma", "photoshop",
    "git", "ci/cd", "敏捷", "scrum", "项目管理", "数据分析", "机器学习", "深度学习",
    "前端", "后端", "全栈", "算法", "数据结构", "微服务", "分布式", "测试",
]


def _extract_text(raw: bytes, filename: str) -> str:
    lower = filename.lower()
    if lower.endswith(".pdf"):
        try:
            from pdfminer.high_level import extract_text

            return extract_text(io.BytesIO(raw)) or ""
        except Exception:
            return ""
    if lower.endswith(".docx"):
        try:
            import docx

            document = docx.Document(io.BytesIO(raw))
            return "\n".join(p.text for p in document.paragraphs if p.text)
        except Exception:
            return ""
    # Fallback: treat as plain text.
    try:
        return raw.decode("utf-8", errors="ignore")
    except Exception:
        return ""


def _detect_skills(text: str) -> list:
    low = text.lower()
    found = []
    for kw in _SKILL_KEYWORDS:
        if kw in low and kw not in found:
            found.append(kw)
    # Also pick up explicit "技能：a, b, c" style lists.
    m = re.search(r"(技能|skills)\s*[:：]\s*(.+)", low)
    if m:
        for part in re.split(r"[,\n、;/]", m.group(2)):
            part = part.strip()
            if part and part not in found:
                found.append(part)
    return found


def _section(text: str, *keywords) -> str:
    """Return the text following the first matching section header."""
    for kw in keywords:
        m = re.search(rf"{kw}\s*[:：]?\s*\n", text)
        if m:
            rest = text[m.end():]
            # stop at the next all-caps-ish header or blank line gap
            nxt = re.search(r"\n\s*(?:[一二三四五六七八九十]+[.、]?\s*\S{2,8}|[A-Z][A-Za-z ]{3,})\s*\n", rest)
            return rest[: nxt.start()] if nxt else rest
    return ""


class ResumeParserHeuristic(ResumeParser):
    def parse(self, raw: bytes, filename: str, candidate_name: str = "") -> dict:
        try:
            text = _extract_text(raw, filename)
            email = (_EMAIL_RE.search(text).group(0) if _EMAIL_RE.search(text) else "")
            phone = (_PHONE_RE.search(text).group(0).replace(" ", "") if _PHONE_RE.search(text) else "")
            name = candidate_name or (text.strip().splitlines()[0].strip() if text.strip() else "")

            skills = _detect_skills(text)

            edu_text = _section(text, "教育", "education")
            work_text = _section(text, "工作经历", "工作", "experience", "实习")
            proj_text = _section(text, "项目", "projects", "project")

            education = (
                [{"school": edu_text.splitlines()[0].strip()[:128] if edu_text.strip() else "",
                  "degree": "", "major": "", "start": "", "end": ""}]
                if edu_text.strip()
                else []
            )
            work_experience = (
                [{"company": work_text.splitlines()[0].strip()[:128] if work_text.strip() else "",
                  "title": "", "start": "", "end": "", "description": work_text.strip()[:1000]}]
                if work_text.strip()
                else []
            )
            projects = (
                [{"name": proj_text.splitlines()[0].strip()[:128] if proj_text.strip() else "",
                  "role": "", "description": proj_text.strip()[:1000]}]
                if proj_text.strip()
                else []
            )

            return {
                "name": name,
                "email": email,
                "phone": phone,
                "education": education,
                "work_experience": work_experience,
                "projects": projects,
                "skills": skills,
            }
        except Exception:
            # Never fail an upload because of parsing; return a minimal record.
            return {
                "name": candidate_name,
                "email": "",
                "phone": "",
                "education": [],
                "work_experience": [],
                "projects": [],
                "skills": [],
            }


class MatcherHeuristic(Matcher):
    def score(
        self,
        job_title: str,
        job_description: str,
        job_requirements: str,
        resume: dict,
    ) -> dict:
        req_lines = [ln.strip().lstrip("0123456789.、-• ").strip()
                     for ln in job_requirements.splitlines() if ln.strip()]
        # also consider requirement tokens embedded in description
        resume_text = " ".join(
            [resume.get("name", ""), resume.get("email", ""), " ".join(resume.get("skills", []))]
            + [w.get("description", "") for w in resume.get("work_experience", [])]
            + [p.get("description", "") for p in resume.get("projects", [])]
        ).lower()

        matched, gaps = [], []
        for line in req_lines:
            tokens = [t for t in re.split(r"[\s,，、;；/().（）]+", line) if len(t) >= 2]
            hit = any(tok.lower() in resume_text for tok in tokens)
            (matched if hit else gaps).append(line)

        total = max(len(req_lines), 1)
        hit_rate = len(matched) / total if req_lines else 0.0
        # Baseline 50 + up to 50 for requirement coverage; ~70 if no requirements given.
        score = round(50 + hit_rate * 50) if req_lines else 70
        score = max(0, min(100, score))

        if score >= 80:
            recommendation = "RECOMMEND"
        elif score >= 65:
            recommendation = "CONSIDER"
        else:
            recommendation = "REJECT"

        if matched:
            summary = f"整体与岗位要求较匹配（匹配度 {score}%），具备相关经验：{'; '.join(matched[:3])}。"
        else:
            summary = f"与岗位要求匹配度一般（{score}%），建议进入面试进一步评估。"

        return {
            "score": float(score),
            "summary": summary,
            "strengths": matched[:5],
            "gaps": gaps[:5],
            "recommendation": recommendation,
            "status": "DONE",
        }
