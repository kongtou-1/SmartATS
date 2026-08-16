// Shared domain types mirroring the MVP backend API contract (hr_ats_agent_mvp_v1.md §16).

export type Role = 'SUPER_ADMIN' | 'HR' | 'INTERVIEWER' | 'CANDIDATE';

export interface User {
  id: string;
  email: string;
  name: string;
  role: Role;
  status: 'ACTIVE' | 'DISABLED';
  created_at: string;
}

export interface AuthResponse {
  access_token: string;
  token_type: string;
  user: User;
}

export type JobStatus = 'DRAFT' | 'PUBLISHED' | 'CLOSED';
export type JobType = 'INTERN' | 'SOCIAL' | 'CAMPUS';
export const JOB_TYPE_LABELS: Record<JobType, string> = {
  INTERN: '实习',
  SOCIAL: '社会招聘',
  CAMPUS: '校园招聘',
};

export interface Job {
  id: string;
  title: string;
  location: string;
  description: string;
  requirements: string;
  status: JobStatus;
  job_type: JobType;
  category_code?: string | null;
  category_name?: string | null;
  created_by?: string;
  published_at?: string | null;
  created_at: string;
  updated_at: string;
}

// ---- Job categories / directions (admin-managed) ----
export interface JobCategory {
  code: string;
  name: string;
  parent_code?: string | null;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

// ---- Announcements / recruitment dynamics ----
export type AnnouncementType = 'NOTICE' | 'DYNAMIC' | 'FLOW_ISSUE';
export type AnnouncementStatus = 'DRAFT' | 'PUBLISHED' | 'CLOSED';
export interface Announcement {
  id: string;
  type: AnnouncementType;
  title: string;
  content: string;
  status: AnnouncementStatus;
  pinned: boolean;
  created_at: string;
  updated_at: string;
  published_at?: string | null;
}

export const ANNOUNCEMENT_TYPE_LABELS: Record<AnnouncementType, string> = {
  NOTICE: '公告',
  DYNAMIC: '动态',
  FLOW_ISSUE: '流程问题',
};

export const ANNOUNCEMENT_STATUS_LABELS: Record<AnnouncementStatus, string> = {
  DRAFT: '草稿',
  PUBLISHED: '已发布',
  CLOSED: '已关闭',
};

export type Stage =
  | 'APPLIED'
  | 'SCREENING'
  | 'FIRST_INTERVIEW'
  | 'SECOND_INTERVIEW'
  | 'FINAL_REVIEW'
  | 'HIRED'
  | 'REJECTED'
  | 'WITHDRAWN';

export type ApplicationStatus = 'ACTIVE' | 'ON_HOLD' | 'HIRED' | 'REJECTED' | 'WITHDRAWN';

export interface StageHistory {
  id: string;
  from_stage: Stage | null;
  to_stage: Stage | null;
  action: 'APPLY' | 'ADVANCE' | 'RETURN' | 'HOLD' | 'RESUME' | 'REJECT' | 'WITHDRAW' | 'TRANSITION';
  created_at: string;
}

export interface EducationItem {
  school: string;
  degree: string;
  major: string;
  start: string;
  end: string;
}

export interface WorkItem {
  company: string;
  title: string;
  start: string;
  end: string;
  description: string;
}

export interface ProjectItem {
  name: string;
  role: string;
  description: string;
}

export interface ResumeParsedData {
  name: string;
  email: string;
  phone: string;
  education: EducationItem[];
  work_experience: WorkItem[];
  projects: ProjectItem[];
  skills: string[];
}

export interface Resume {
  id: string;
  candidate_id: string;
  file_name: string;
  storage_key: string;
  parse_status: 'PENDING' | 'PARSING' | 'DONE' | 'FAILED';
  parsed_data: ResumeParsedData | null;
  created_at: string;
  updated_at: string;
}

export interface CandidateEducation {
  start: string;
  end: string;
  education_type: 'FULL_TIME' | 'PART_TIME' | 'OTHER' | '';
  school: string;
  degree: 'ASSOCIATE' | 'BACHELOR' | 'MASTER' | 'DOCTOR' | 'OTHER_POST_SECONDARY' | '';
  college: string;
  major: string;
  laboratory: string;
  direction: string;
  advisor: string;
}
export interface CandidateExperience {
  company: string;
  title: string;
  start: string;
  end: string;
  current: boolean;
  description: string;
}
export interface CandidateProject {
  name: string;
  role: string;
  start: string;
  end: string;
  current: boolean;
  description: string;
}
export interface CandidateLanguage {
  language: string;
  proficiency: string;
  exam: string;
  score: string;
}
export interface CandidateCertificate {
  name: string;
  issuer: string;
  obtained_at: string;
}
export interface CandidateProfile {
  name: string;
  phone: string;
  contact_email: string;
  identity_type: string;
  identity_number?: string | null;
  identity_number_masked: string;
  identity_number_set: boolean;
  preferred_locations: string[];
  education: CandidateEducation[];
  internships: CandidateExperience[];
  work_experiences: CandidateExperience[];
  projects: CandidateProject[];
  languages: CandidateLanguage[];
  certificates: CandidateCertificate[];
  self_evaluation: string;
  profile_version: number;
  profile_saved_at: string | null;
  /* 求职意向与职业现状（投递表单展示，后端兼容 extra='ignore'） */
  gender?: 'MALE' | 'FEMALE' | 'OTHER' | '';
  birth_year?: string;
  city?: string;
  current_status?: string;
  current_title?: string;
  current_company?: string;
  years_experience?: string;
  expected_salary?: string;
}

export type AgentRecommendation = 'RECOMMEND' | 'CONSIDER' | 'REJECT';

export interface AgentResult {
  id: string;
  application_id: string;
  score: number;
  summary: string;
  strengths: string[];
  gaps: string[];
  recommendation: AgentRecommendation;
  status: 'PENDING' | 'DONE' | 'FAILED';
}

export interface Application {
  id: string;
  candidate_id: string;
  job_id: string;
  resume_id: string;
  current_stage: Stage;
  status: ApplicationStatus;
  ai_score: number | null;
  applied_at: string;
  job?: Job;
  agent_result?: AgentResult | null;
  stage_history?: StageHistory[];
}

export type InterviewStatus = 'SCHEDULED' | 'COMPLETED' | 'CANCELLED';
export type RoundType = 'FIRST' | 'SECOND' | 'HR';

export interface Interview {
  id: string;
  application_id: string;
  interviewer_id: string;
  round_type: RoundType;
  scheduled_at: string;
  duration_minutes: number;
  method: string;
  meeting_url: string;
  status: InterviewStatus;
  note: string;
  interviewer_name?: string;
  candidate_name?: string;
  job_title?: string;
}

export type FeedbackRecommendation = 'PASS' | 'HOLD' | 'FAIL';

export interface InterviewFeedback {
  id: string;
  interview_id: string;
  interviewer_id: string;
  professional_score: number;
  project_score: number;
  communication_score: number;
  strengths: string;
  weaknesses: string;
  summary: string;
  recommendation: FeedbackRecommendation;
}

// ---- Display label maps ----

export const STAGE_LABELS: Record<Stage, string> = {
  APPLIED: '已投递',
  SCREENING: '简历审核中',
  FIRST_INTERVIEW: '一面',
  SECOND_INTERVIEW: '二面',
  FINAL_REVIEW: '结果确认中',
  HIRED: '已通过',
  REJECTED: '招聘流程已结束',
  WITHDRAWN: '已撤回',
};

export const JOB_STATUS_LABELS: Record<JobStatus, string> = {
  DRAFT: '草稿',
  PUBLISHED: '招聘中',
  CLOSED: '已关闭',
};

export const ROLE_LABELS: Record<Role, string> = {
  SUPER_ADMIN: '超级管理员',
  HR: 'HR',
  INTERVIEWER: '面试官',
  CANDIDATE: '求职者',
};

export interface Offer {
  id: string;
  application_id: string;
  candidate_id: string;
  job_id: string;
  status: string;
  salary_description: string;
  work_location: string;
  expected_start_date: string;
  expires_at: string;
  probation: string;
  extra_terms: string;
  current_version: number;
  candidate_name: string;
  job_title: string;
  created_by: string;
  approved_by: string | null;
  created_at: string;
  updated_at: string;
}
