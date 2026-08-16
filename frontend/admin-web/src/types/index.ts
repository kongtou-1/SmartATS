// Shared domain types mirroring the MVP backend API contract (hr_ats_agent_mvp_v1.md §16).

export type Role = 'SUPER_ADMIN' | 'HR' | 'INTERVIEWER' | 'CANDIDATE' | 'DIRECTION_OWNER';

export interface User {
  id: string;
  email: string;
  name: string;
  title?: string;
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

export const EXPERIENCE_OPTIONS = [
  { value: '', label: '不限' },
  { value: '1-3', label: '1-3年' },
  { value: '3-5', label: '3-5年' },
  { value: '5-10', label: '5-10年' },
  { value: '10+', label: '10年以上' },
];

export const EDUCATION_OPTIONS = [
  { value: '', label: '不限' },
  { value: 'college', label: '大专' },
  { value: 'bachelor', label: '本科及以上' },
  { value: 'master', label: '硕士' },
  { value: 'phd', label: '博士' },
];

export const URGENCY_LABELS: Record<string, string> = {
  HIGH: '高(急聘优先推流)',
  MEDIUM: '中',
  LOW: '低',
};

export const URGENCY_OPTIONS = [
  { value: 'HIGH', label: '高(急聘优先推流)' },
  { value: 'MEDIUM', label: '中' },
  { value: 'LOW', label: '低' },
];

export const DEPARTMENT_OPTIONS = [
  '研发中心',
  '产品设计',
  '市场营销',
  '人力资源',
  '财务管理',
  '运营支持',
];

export interface Job {
  id: string;
  title: string;
  location: string;
  description: string;
  requirements: string;
  category_code?: string | null;
  category_name?: string | null;
  job_type: JobType;
  status: JobStatus;
  headcount?: number;
  salary_negotiable?: boolean;
  salary_min_k?: number | null;
  salary_max_k?: number | null;
  department?: string;
  experience_req?: string | null;
  education_req?: string | null;
  urgency?: string;
  created_by?: string;
  published_at?: string | null;
  created_at: string;
  updated_at: string;
}

export interface JobInput {
  title: string;
  location: string;
  description: string;
  requirements: string;
  category_code?: string;
  job_type: JobType;
  headcount: number;
  salary_negotiable?: boolean;
  salary_min_k?: number | null;
  salary_max_k?: number | null;
  department?: string;
  experience_req?: string | null;
  education_req?: string | null;
  urgency?: string;
}

// Job enriched with live application / pipeline stats (admin views).
export interface JobWithStats extends Job {
  applications_total: number;
  stage_counts: Record<string, number>;
}

// Format a job's salary into a short display string.
export function formatSalary(
  job: Partial<Pick<Job, 'salary_negotiable' | 'salary_min_k' | 'salary_max_k'>>,
): string {
  if (job.salary_negotiable) return '面议';
  const min = job.salary_min_k;
  const max = job.salary_max_k;
  if (min == null && max == null) return '—';
  if (min != null && max != null) return `${min}-${max}k`;
  if (min != null) return `${min}k 以上`;
  return `≤${max}k`;
}

export type Stage =
  | 'APPLIED'
  | 'SCREENING'
  | 'SCREENING_PASSED'
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
  reason: string;
  changed_by?: string | null;
  changed_by_name: string;
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

// Candidate-facing list item (admin list view)
// Enriched with light-weight snapshot fields so kanban & matrix views can
// render rich candidate cards without an extra detail call per row.
export interface AdminApplication {
  id: string;
  candidate_id: string;
  job_id: string;
  current_stage: Stage;
  status: ApplicationStatus;
  ai_score: number | null;
  applied_at: string;
  candidate_name: string;
  job_title: string;
  latest_company: string;
  latest_school: string;
  latest_degree: string;
  skills: string[];
  next_interview_at: string | null;
  next_interview_round: string;
  next_interviewer_name: string;
  /** 关联的 Offer 状态（无则 null）：用于标记「已发 Offer」、隐藏发 Offer 按钮、审批通过后从看板移除 */
  offer_status?: string | null;
}

export interface CandidateEducationSnapshot {
  start: string;
  end: string;
  education_type: string;
  school: string;
  degree: string;
  college: string;
  major: string;
  laboratory?: string;
  direction?: string;
  advisor?: string;
}

export interface CandidateExperienceSnapshot {
  company: string;
  title: string;
  start: string;
  end: string;
  current: boolean;
  description: string;
}

export interface CandidateProjectSnapshot {
  name: string;
  role: string;
  start: string;
  end: string;
  current: boolean;
  description: string;
}

export interface CandidateLanguageSnapshot {
  language: string;
  proficiency: string;
  exam?: string;
  score?: string;
}

export interface CandidateCertificateSnapshot {
  name: string;
  issuer: string;
  obtained_at: string;
}

export interface CandidateProfileSnapshot {
  name: string;
  phone: string;
  contact_email: string;
  identity_type: string;
  identity_number_masked: string;
  preferred_locations: string[];
  education: CandidateEducationSnapshot[];
  internships: CandidateExperienceSnapshot[];
  work_experiences: CandidateExperienceSnapshot[];
  projects: CandidateProjectSnapshot[];
  languages: CandidateLanguageSnapshot[];
  certificates: CandidateCertificateSnapshot[];
  self_evaluation: string;
}

export interface AdminApplicationDetail {
  id: string;
  candidate_id: string;
  job_id: string;
  resume_id: string;
  current_stage: Stage;
  status: ApplicationStatus;
  ai_score: number | null;
  applied_at: string;
  candidate: { name: string; email: string; phone: string; city: string };
  job: Job;
  resume: Resume | null;
  agent_result: AgentResult | null;
  interviews: InterviewDetail[];
  stage_history: StageHistory[];
  candidate_profile_snapshot: CandidateProfileSnapshot | null;
  job_type_snapshot: JobType | null;
}

export type InterviewStatus = 'SCHEDULED' | 'PENDING_HR_REVIEW' | 'COMPLETED' | 'CANCELLED';
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

export interface InterviewDetail extends Interview {
  candidate_name: string;
  job_title: string;
  interviewer_name: string;
  feedback?: InterviewFeedback;
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

export interface FeedbackInput {
  professional_score: number;
  project_score: number;
  communication_score: number;
  strengths: string;
  weaknesses: string;
  summary: string;
  recommendation: FeedbackRecommendation;
}

export type FeedbackDecision = 'ADOPT' | 'ADVANCE' | 'REJECT' | 'HOLD' | 'CONFIRM_ONLY';
export interface FeedbackConfirmIn {
  mode: FeedbackDecision;
  target_stage?: Stage;
  reason: string;
}

export const INTERVIEW_STATUS_LABELS: Record<InterviewStatus, string> = {
  SCHEDULED: '待开始',
  PENDING_HR_REVIEW: '待HR确认',
  COMPLETED: '已完成',
  CANCELLED: '已取消',
};

export interface InterviewInput {
  application_id: string;
  interviewer_id: string;
  round_type: RoundType;
  scheduled_at: string;
  duration_minutes: number;
  method: string;
  meeting_url: string;
  note: string;
}

// ---- Display label maps ----
export const STAGE_LABELS: Record<Stage, string> = {
  APPLIED: '已投递',
  SCREENING: '简历初筛',
  SCREENING_PASSED: '初筛通过',
  FIRST_INTERVIEW: '一面',
  SECOND_INTERVIEW: '二面',
  FINAL_REVIEW: '终面',
  HIRED: '面试通过',
  REJECTED: '已拒绝',
  WITHDRAWN: '已撤回',
};

/** 候选人被拒后进入人才库时记录的「拒绝阶段」中文标签 */
export const REJECT_STAGE_LABELS: Record<string, string> = {
  SCREENING: '简历初筛',
  FIRST_INTERVIEW: '专业初试',
  SECOND_INTERVIEW: '技术复试',
  FINAL_REVIEW: 'HR终面',
};

export const JOB_STATUS_LABELS: Record<JobStatus, string> = {
  DRAFT: '草稿',
  PUBLISHED: '招聘中',
  CLOSED: '已关闭',
};

// ---- Job categories (directions) ----
export interface JobCategory {
  id: string;
  code: string;
  name: string;
  parent_code?: string | null;
  sort_order: number;
  owner_id?: string | null;
  owner_name?: string | null;
  owner_title?: string | null;
  open_job_count?: number;
  total_headcount?: number;
  child_count?: number;
  created_at: string;
  updated_at: string;
}
export interface JobCategoryInput {
  code: string;
  name: string;
  parent_code?: string | null;
  sort_order?: number;
  owner_id?: string | null;
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
  published_at?: string | null;
  created_by?: string;
  created_at: string;
  updated_at: string;
}
export interface AnnouncementInput {
  type?: AnnouncementType;
  title: string;
  content?: string;
  pinned?: boolean;
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

export const ROLE_LABELS: Record<Role, string> = {
  SUPER_ADMIN: '超级管理员',
  HR: 'HR',
  INTERVIEWER: '面试官',
  CANDIDATE: '求职者',
  DIRECTION_OWNER: '方向负责人',
};

export const STAGE_ORDER: Stage[] = [
  'APPLIED',
  'SCREENING',
  'SCREENING_PASSED',
  'FIRST_INTERVIEW',
  'SECOND_INTERVIEW',
  'FINAL_REVIEW',
  'HIRED',
];

/** Offer 状态中文标签（用于候选人卡片角标） */
export const OFFER_STATUS_LABELS: Record<string, string> = {
  DRAFT: 'Offer 草稿',
  PENDING_APPROVAL: 'Offer 已发放',
  REJECTED_APPROVAL: 'Offer 已驳回',
  APPROVED: 'Offer 已审批',
  SENT: 'Offer 已发送',
  ACCEPTED: 'Offer 已接受',
  DECLINED: 'Offer 已拒绝',
  EXPIRED: 'Offer 已过期',
  VOIDED: 'Offer 已作废',
};

/** Offer 审批通过（及之后所有状态）：候选人离开 /candidates 看板 */
export const OFFER_OFFBOARD_STAGES: string[] = [
  'APPROVED',
  'SENT',
  'ACCEPTED',
  'DECLINED',
  'EXPIRED',
  'VOIDED',
];

/**
 * 仅这些阶段允许「安排面试」。
 * 已投递(APPLIED) / 简历初筛(SCREENING) / 初筛通过(SCREENING_PASSED) 处于筛选环节，
 * 必须先推进到一面/二面/终面，才能发起面试。
 */
export const INTERVIEWABLE_STAGES: Stage[] = [
  'FIRST_INTERVIEW',
  'SECOND_INTERVIEW',
  'FINAL_REVIEW',
];

export function isInterviewableStage(stage: Stage | null | undefined): boolean {
  return stage != null && INTERVIEWABLE_STAGES.includes(stage);
}

// ---- V2 talent, collaboration, offer and reporting ----
export interface Tag {
  id: string;
  name: string;
  color: string;
  enabled: boolean;
}
export interface SourceChannel {
  id: string;
  code: string;
  name: string;
  enabled: boolean;
  sort_order: number;
}
export interface Talent {
  id: string;
  user_id: string | null;
  name: string;
  phone: string;
  contact_email: string;
  city: string;
  years_experience: number;
  owner_id: string | null;
  owner_name: string;
  source_channel_id: string | null;
  source_name: string;
  skills: string[];
  tags: { id: string; name: string; color: string }[];
  latest_application: {
    id: string;
    job_id: string;
    job_title: string;
    stage: Stage;
    status: string;
  } | null;
  // Talent pool (人才库) fields
  in_talent_pool: boolean;
  pool_entered_at: string | null;
  pool_entered_from_stage: string | null;
  pool_reject_reason: string | null;
  pool_entered_by_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface TalentReactivateIn {
  job_id: string;
  note?: string | null;
}
export interface TalentPage {
  items: Talent[];
  page: number;
  page_size: number;
  total: number;
}
export interface TalentNote {
  id: string;
  content: string;
  author_id: string;
  author_name: string;
  created_at: string;
}
export interface Communication {
  id: string;
  channel: string;
  subject: string;
  body: string;
  delivery_status: string;
  created_at: string;
}
export type OfferStatus =
  | 'DRAFT'
  | 'PENDING_APPROVAL'
  | 'APPROVED'
  | 'SENT'
  | 'ACCEPTED'
  | 'DECLINED'
  | 'EXPIRED'
  | 'VOIDED'
  | 'REJECTED_APPROVAL';
export interface Offer {
  id: string;
  application_id: string;
  candidate_id: string;
  job_id: string;
  status: OfferStatus;
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
export interface Notification {
  id: string;
  kind: string;
  title: string;
  body: string;
  link: string;
  read_at: string | null;
  created_at: string;
}
export interface AuditLog {
  id: string;
  actor_id: string | null;
  actor_type: string;
  request_id: string;
  action: string;
  entity_type: string;
  entity_id: string;
  before_data: unknown;
  after_data: unknown;
  ip_address: string;
  created_at: string;
}

export interface CalendarEvent {
  id: string;
  title: string;
  start: string;
  end: string;
  type: string;
  source: string;
}

export interface AvailabilityResult {
  slots: { start: string; end: string }[];
}

export interface FunnelReport {
  total: number;
  rejected: number;
  stages: {
    stage: string;
    display_label: string;
    count: number;
    percent_of_total: number;
    conversion_rate: number;
    average_hours: number;
  }[];
}

export interface WorkloadReportRow {
  name: string;
  stage_actions: number;
  interviews: number;
  offers: number;
}

export interface ChannelReportRow {
  code: string;
  name: string;
  applications: number;
  interviewed: number;
  offers_sent: number;
  offers_accepted: number;
  hire_rate: number;
}

export interface JobCycleReportRow {
  job_id: string;
  job_title: string;
  days: number;
  status: string;
}

// ---- Dashboard ----
export interface DashboardStats {
  pending_resume_count: number;
  today_interview_count: number;
  pending_offer_count: number;
  active_job_count: number;
  open_headcount: number;
}

export interface DashboardInterview {
  id: string;
  application_id: string;
  candidate_name: string;
  job_title: string;
  interviewer_name: string;
  round_type: RoundType;
  round_label: string;
  scheduled_at: string;
  duration_minutes: number;
  time_range: string;
  method: string;
  meeting_url: string;
}

export interface DashboardUrgentJob {
  id: string;
  title: string;
  department: string;
  salary_min_k: number | null;
  salary_max_k: number | null;
  salary_negotiable: boolean;
  salary_text: string;
  headcount: number;
  applications_total: number;
}

export interface DashboardSummary {
  greeting: string;
  today_text: string;
  recruiting_status: string;
  stats: DashboardStats;
  interviews: DashboardInterview[];
  urgent_jobs: DashboardUrgentJob[];
}
