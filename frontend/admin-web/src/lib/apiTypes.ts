import type {
  AdminApplication,
  AdminApplicationDetail,
  AgentResult,
  Announcement,
  AnnouncementInput,
  AuthResponse,
  DashboardSummary,
  FeedbackConfirmIn,
  FeedbackInput,
  Interview,
  InterviewDetail,
  InterviewFeedback,
  InterviewInput,
  Job,
  JobCategory,
  JobCategoryInput,
  JobInput,
  JobWithStats,
  Role,
  User,
  Talent,
  TalentPage,
  TalentReactivateIn,
  SourceChannel,
  Tag,
  Offer,
  Notification,
  AuditLog,
  AvailabilityResult,
  CalendarEvent,
  ChannelReportRow,
  FunnelReport,
  JobCycleReportRow,
  WorkloadReportRow,
} from '../types';

export interface ApiClient {
  login(input: { email: string; password: string; scope?: 'admin' }): Promise<AuthResponse>;
  me(): Promise<User>;
  dashboardSummary(): Promise<DashboardSummary>;

  // Admin jobs
  adminListJobs(): Promise<JobWithStats[]>;
  adminGetJob(id: string): Promise<JobWithStats>;
  adminCreateJob(data: JobInput): Promise<JobWithStats>;
  adminUpdateJob(id: string, data: JobInput): Promise<JobWithStats>;
  adminPublishJob(id: string): Promise<JobWithStats>;
  adminCloseJob(id: string): Promise<JobWithStats>;

  // Job categories (directions)
  listJobCategories(): Promise<JobCategory[]>;
  adminListJobCategories(): Promise<JobCategory[]>;
  adminCreateJobCategory(data: JobCategoryInput): Promise<JobCategory>;
  adminUpdateJobCategory(code: string, data: JobCategoryInput): Promise<JobCategory>;
  adminDeleteJobCategory(code: string): Promise<void>;

  // Direction owners
  adminListDirectionOwners(): Promise<User[]>;

  // Announcements (public + admin)
  listAnnouncements(params?: { type?: string }): Promise<Announcement[]>;
  getAnnouncement(id: string): Promise<Announcement>;
  adminListAnnouncements(params?: { type?: string }): Promise<Announcement[]>;
  adminGetAnnouncement(id: string): Promise<Announcement>;
  adminCreateAnnouncement(data: AnnouncementInput): Promise<Announcement>;
  adminUpdateAnnouncement(id: string, data: AnnouncementInput): Promise<Announcement>;
  adminDeleteAnnouncement(id: string): Promise<void>;
  adminPublishAnnouncement(id: string): Promise<Announcement>;
  adminCloseAnnouncement(id: string): Promise<Announcement>;

  // Admin applications
  adminListApplications(params?: { job_id?: string; stage?: string }): Promise<AdminApplication[]>;
  adminGetApplication(id: string): Promise<AdminApplicationDetail>;
  adminNextStage(id: string, reason: string): Promise<AdminApplicationDetail>;
  adminTransition(
    id: string,
    targetStage: import('../types').Stage,
    reason: string,
  ): Promise<AdminApplicationDetail>;
  adminHold(id: string, reason: string): Promise<AdminApplicationDetail>;
  adminResume(id: string, reason: string): Promise<AdminApplicationDetail>;
  adminReject(id: string, reason: string): Promise<AdminApplicationDetail>;
  adminDownloadResume(id: string): Promise<void>;
  /** 取回简历文件二进制，用于弹窗内嵌预览（不落盘） */
  adminResumeBlob?(id: string): Promise<Blob>;
  adminAddCandidateTag(candidateId: string, tagId: string): Promise<unknown>;
  adminAgentResult(id: string): Promise<AgentResult>;
  adminAgentRerun(id: string): Promise<AgentResult>;

  // Interviews (admin)
  adminCreateInterview(data: InterviewInput): Promise<Interview>;
  adminListInterviews(): Promise<InterviewDetail[]>;
  adminGetInterview(id: string): Promise<InterviewDetail>;
  adminUpdateInterview(id: string, data: Partial<InterviewInput>): Promise<Interview>;
  adminCancelInterview(id: string): Promise<Interview>;
  remindInterview?(id: string): Promise<{ ok: boolean; notified: string[]; need_feedback: boolean }>;
  adminConfirmFeedback(id: string, data: FeedbackConfirmIn): Promise<InterviewDetail>;
  adminListInterviewers(): Promise<User[]>;

  // Interviews (interviewer)
  interviewerListInterviews(): Promise<InterviewDetail[]>;
  interviewerGetInterview(id: string): Promise<InterviewDetail>;
  interviewerFeedback(id: string, data: FeedbackInput): Promise<InterviewFeedback>;

  // Users (super admin)
  listUsers(): Promise<User[]>;
  createUser(data: { email: string; name: string; role: Role; password: string }): Promise<User>;
  updateUser(
    id: string,
    data: {
      name?: string;
      email?: string;
      role?: Role;
      status?: 'ACTIVE' | 'DISABLED';
      password?: string;
    },
  ): Promise<User>;

  listTalents?(params?: Record<string, string>): Promise<TalentPage>;
  getTalent?(id: string): Promise<Talent>;
  reactivateTalent?(id: string, data: TalentReactivateIn): Promise<unknown>;
  deleteTalent?(id: string): Promise<{ id: string; deleted: boolean }>;
  restoreTalent?(id: string): Promise<Talent>;
  createTalent?(data: Partial<Talent> & { name: string }): Promise<Talent>;
  updateTalent?(id: string, data: Partial<Talent> & { name: string; tag_ids?: string[] }): Promise<Talent>;
  listSourceChannels?(): Promise<SourceChannel[]>;
  listTags?(): Promise<Tag[]>;
  listTalentOwners?(): Promise<User[]>;
  createSourceChannel?(data: Omit<SourceChannel, 'id'>): Promise<SourceChannel>;
  updateSourceChannel?(id: string, data: Omit<SourceChannel, 'id'>): Promise<SourceChannel>;
  createTag?(data: Omit<Tag, 'id'>): Promise<Tag>;
  updateTag?(id: string, data: Omit<Tag, 'id'>): Promise<Tag>;
  bulkApplications?(
    data: unknown,
  ): Promise<{ success_count: number; failure_count: number; results: unknown[] }>;
  calendarEvents?(start: string, end: string, interviewerId?: string): Promise<CalendarEvent[]>;
  availability?(
    interviewerId: string,
    start: string,
    end: string,
    duration: number,
  ): Promise<AvailabilityResult>;
  addBusyBlock?(data: {
    interviewer_id: string;
    title: string;
    starts_at: string;
    ends_at: string;
  }): Promise<unknown>;
  deleteBusyBlock?(id: string): Promise<void>;
  listOffers?(status?: string): Promise<Offer[]>;
  createOffer?(data: unknown): Promise<Offer>;
  offerAction?(id: string, action: string, data?: unknown): Promise<unknown>;
  report?(name: 'funnel'): Promise<FunnelReport>;
  report?(name: 'workload'): Promise<WorkloadReportRow[]>;
  report?(name: 'channels'): Promise<ChannelReportRow[]>;
  report?(name: 'job-cycles'): Promise<JobCycleReportRow[]>;
  notifications?(): Promise<Notification[]>;
  readNotification?(id: string): Promise<void>;
  auditLogs?(params?: Record<string, string>): Promise<{ items: AuditLog[]; total: number }>;
  communications?(candidateId: string): Promise<
    {
      id: string;
      channel: string;
      subject: string;
      body: string;
      delivery_status: string;
      created_at: string;
    }[]
  >;
  listTalentNotes?(id: string): Promise<
    {
      id: string;
      content: string;
      author_id: string;
      author_name: string;
      created_at: string;
    }[]
  >;
  addTalentNote?(id: string, content: string): Promise<{ id: string; content: string; author_id: string; created_at: string }>;
}
