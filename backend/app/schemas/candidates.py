"""Pydantic contracts for this business domain."""
from datetime import datetime
from typing import List, Literal, Optional
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field



class CandidateEducationItem(BaseModel):
    start: str = ""
    end: str = ""
    education_type: str = ""
    school: str = ""
    degree: str = ""
    college: str = ""
    major: str = ""
    laboratory: str = ""
    direction: str = ""
    advisor: str = ""



class CandidateExperienceItem(BaseModel):
    company: str = ""
    title: str = ""
    start: str = ""
    end: str = ""
    current: bool = False
    description: str = ""



class CandidateProjectItem(BaseModel):
    name: str = ""
    role: str = ""
    start: str = ""
    end: str = ""
    current: bool = False
    description: str = ""



class CandidateLanguageItem(BaseModel):
    language: str = ""
    proficiency: str = ""
    exam: str = ""
    score: str = ""



class CandidateCertificateItem(BaseModel):
    name: str = ""
    issuer: str = ""
    obtained_at: str = ""



class ProfileIn(BaseModel):
    name: str = ""
    phone: str = ""
    contact_email: str = ""
    identity_type: str = ""
    identity_number: Optional[str] = None
    preferred_locations: List[str] = []
    education: List[CandidateEducationItem] = []
    internships: List[CandidateExperienceItem] = []
    work_experiences: List[CandidateExperienceItem] = []
    projects: List[CandidateProjectItem] = []
    languages: List[CandidateLanguageItem] = []
    certificates: List[CandidateCertificateItem] = []
    self_evaluation: str = ""



class ProfileOut(BaseModel):
    name: str = ""
    phone: str = ""
    contact_email: str = ""
    identity_type: str = ""
    identity_number_masked: str = ""
    identity_number_set: bool = False
    preferred_locations: List[str] = []
    education: List[CandidateEducationItem] = []
    internships: List[CandidateExperienceItem] = []
    work_experiences: List[CandidateExperienceItem] = []
    projects: List[CandidateProjectItem] = []
    languages: List[CandidateLanguageItem] = []
    certificates: List[CandidateCertificateItem] = []
    self_evaluation: str = ""
    profile_version: int = 0
    profile_saved_at: Optional[datetime] = None
