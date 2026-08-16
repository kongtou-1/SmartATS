"""Pydantic request and response contracts grouped by domain."""
from .announcements import AnnouncementInput, AnnouncementOut
from .applications import EducationItem, WorkItem, ProjectItem, ResumeParsedData, ResumeOut, AgentResultOut, ApplicationCreateIn, StageTransitionIn, StageReasonIn, CandidateStageHistoryOut, AdminStageHistoryOut, ApplicationOut, CandidateApplicationDetail, InterviewOut, InterviewFeedbackOut, InterviewDetailOut, FeedbackInput, FeedbackConfirmIn, InterviewInput, AdminApplicationOut, AdminCandidateInfo, AdminApplicationDetailOut
from .auth import RegisterIn, LoginIn, CandidateAccountOut, AdminAccountOut, AccountOut, AuthResponse
from .bulk_actions import BulkActionIn
from .calendar import BusyBlockIn
from .candidates import CandidateEducationItem, CandidateExperienceItem, CandidateProjectItem, CandidateLanguageItem, CandidateCertificateItem, ProfileIn, ProfileOut
from .dashboard import DashboardInterviewItem, DashboardUrgentJobItem, DashboardStats, DashboardSummaryOut
from .jobs import JobInput, JobOut, JobWithStats, JobCategoryInput, JobCategoryOut
from .notifications import NotificationOut
from .offers import OfferIn, OfferDecisionIn, OfferResponseIn, OfferOut
from .talents import SourceChannelIn, TagIn, CandidateTagAssignIn, TalentIn, TalentMergeIn, TalentReactivateIn, NoteIn, TalentOut, PageOut, SourceChannelOut, TagOut
from .users import UserCreateIn, UserUpdateIn

__all__ = ['AnnouncementInput', 'AnnouncementOut', 'EducationItem', 'WorkItem', 'ProjectItem', 'ResumeParsedData', 'ResumeOut', 'AgentResultOut', 'ApplicationCreateIn', 'StageTransitionIn', 'StageReasonIn', 'CandidateStageHistoryOut', 'AdminStageHistoryOut', 'ApplicationOut', 'CandidateApplicationDetail', 'InterviewOut', 'InterviewFeedbackOut', 'InterviewDetailOut', 'FeedbackInput', 'FeedbackConfirmIn', 'InterviewInput', 'AdminApplicationOut', 'AdminCandidateInfo', 'AdminApplicationDetailOut', 'RegisterIn', 'LoginIn', 'CandidateAccountOut', 'AdminAccountOut', 'AccountOut', 'AuthResponse', 'BulkActionIn', 'BusyBlockIn', 'CandidateEducationItem', 'CandidateExperienceItem', 'CandidateProjectItem', 'CandidateLanguageItem', 'CandidateCertificateItem', 'ProfileIn', 'ProfileOut', 'DashboardInterviewItem', 'DashboardUrgentJobItem', 'DashboardStats', 'DashboardSummaryOut', 'JobInput', 'JobOut', 'JobWithStats', 'JobCategoryInput', 'JobCategoryOut', 'NotificationOut', 'OfferIn', 'OfferDecisionIn', 'OfferResponseIn', 'OfferOut', 'SourceChannelIn', 'TagIn', 'CandidateTagAssignIn', 'TalentIn', 'TalentMergeIn', 'TalentReactivateIn', 'NoteIn', 'TalentOut', 'PageOut', 'SourceChannelOut', 'TagOut', 'UserCreateIn', 'UserUpdateIn']
