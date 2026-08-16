"""Agent interfaces for resume parsing and job-matching scoring.

These are intentionally provider-agnostic: the default MVP implementation is a
heuristic parser/scorer (see heuristic.py) with no external API dependency.
A real LLM provider can be dropped in later (see llm.py) without touching the
rest of the codebase.
"""
from abc import ABC, abstractmethod


class ResumeParser(ABC):
    @abstractmethod
    def parse(self, raw: bytes, filename: str, candidate_name: str = "") -> dict:
        """Return a dict shaped like ResumeParsedData (name/email/phone/education/...)."""


class Matcher(ABC):
    @abstractmethod
    def score(
        self,
        job_title: str,
        job_description: str,
        job_requirements: str,
        resume: dict,
    ) -> dict:
        """Return a dict with keys: score, summary, strengths, gaps, recommendation, status."""


def get_parser():
    from ..core.config import AGENT_PROVIDER
    from .heuristic import ResumeParserHeuristic

    if AGENT_PROVIDER == "llm":
        from .llm import ResumeParserLLM

        return ResumeParserLLM()
    return ResumeParserHeuristic()


def get_matcher():
    from ..core.config import AGENT_PROVIDER
    from .heuristic import MatcherHeuristic

    if AGENT_PROVIDER == "llm":
        from .llm import MatcherLLM

        return MatcherLLM()
    return MatcherHeuristic()
