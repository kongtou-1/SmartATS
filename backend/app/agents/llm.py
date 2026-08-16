"""Optional LLM-backed Agent provider (pluggable slot).

Not used in the MVP by default (AGENT_PROVIDER=heuristic). Implement these by
wiring your preferred model/SDK; the rest of the app only depends on the
ResumeParser / Matcher interfaces in base.py, so enabling "llm" requires no
other changes.
"""
import os

from .base import Matcher, ResumeParser


class _NotConfigured(RuntimeError):
    pass


class ResumeParserLLM(ResumeParser):
    def __init__(self) -> None:
        self.api_key = os.getenv("LLM_API_KEY")
        if not self.api_key:
            raise _NotConfigured("LLM_API_KEY 未配置，无法使用 LLM 简历解析")

    def parse(self, raw: bytes, filename: str, candidate_name: str = "") -> dict:
        raise NotImplementedError("实现 LLM 简历解析调用（返回 ResumeParsedData 形状）")


class MatcherLLM(Matcher):
    def __init__(self) -> None:
        self.api_key = os.getenv("LLM_API_KEY")
        if not self.api_key:
            raise _NotConfigured("LLM_API_KEY 未配置，无法使用 LLM 匹配评分")

    def score(self, job_title, job_description, job_requirements, resume) -> dict:
        raise NotImplementedError("实现 LLM 岗位匹配调用（返回评分形状）")
