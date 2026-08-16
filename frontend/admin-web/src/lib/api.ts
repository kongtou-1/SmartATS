import type { ApiClient } from './apiTypes';
import { getToken } from './token';
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
  User,
} from '../types';

export const BASE = import.meta.env.VITE_API_BASE || '/api/v1';

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const headers = new Headers(init.headers);
  const token = getToken();
  if (token) headers.set('Authorization', `Bearer ${token}`);
  if (init.body && !(init.body instanceof FormData)) {
    headers.set('Content-Type', 'application/json');
  }
  const res = await fetch(`${BASE}${path}`, { ...init, headers });
  if (!res.ok) {
    let detail = '';
    try {
      detail = (await res.json())?.detail ?? '';
    } catch {
      /* ignore */
    }
    throw new Error(detail || `请求失败 (${res.status})`);
  }
  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

export async function downloadFile(path: string, filename: string) {
  const headers = new Headers();
  const token = getToken();
  if (token) headers.set('Authorization', `Bearer ${token}`);
  const res = await fetch(`${BASE}${path}`, { headers });
  if (!res.ok) throw new Error(`下载失败 (${res.status})`);
  const url = URL.createObjectURL(await res.blob());
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

/** 取回文件二进制（不触发浏览器下载），用于弹窗内嵌预览 */
export async function fetchFileBlob(path: string): Promise<Blob> {
  const headers = new Headers();
  const token = getToken();
  if (token) headers.set('Authorization', `Bearer ${token}`);
  const res = await fetch(`${BASE}${path}`, { headers });
  if (!res.ok) throw new Error(`读取文件失败 (${res.status})`);
  return res.blob();
}

export async function uploadFile<T = unknown>(path: string, file: File): Promise<T> {
  const form = new FormData();
  form.append('file', file);
  return request<T>(path, { method: 'POST', body: form });
}

export const realApi: ApiClient = {
  async login(input) {
    return request<AuthResponse>('/auth/login', { method: 'POST', body: JSON.stringify(input) });
  },
  async me() {
    return request<User>('/auth/me');
  },
  async dashboardSummary() {
    return request<DashboardSummary>('/admin/dashboard/summary');
  },
  async adminListJobs() {
    return request<JobWithStats[]>('/admin/jobs');
  },
  async adminGetJob(id) {
    return request<JobWithStats>(`/admin/jobs/${id}`);
  },
  async adminCreateJob(data: JobInput) {
    return request<JobWithStats>('/admin/jobs', { method: 'POST', body: JSON.stringify(data) });
  },
  async adminUpdateJob(id, data: JobInput) {
    return request<JobWithStats>(`/admin/jobs/${id}`, { method: 'PUT', body: JSON.stringify(data) });
  },
  async adminPublishJob(id) {
    return request<JobWithStats>(`/admin/jobs/${id}/publish`, { method: 'POST' });
  },
  async adminCloseJob(id) {
    return request<JobWithStats>(`/admin/jobs/${id}/close`, { method: 'POST' });
  },

  // ---- Job categories ----
  async listJobCategories() {
    return request<JobCategory[]>('/job-categories');
  },
  async adminListJobCategories() {
    return request<JobCategory[]>('/admin/job-categories');
  },
  async adminCreateJobCategory(data: JobCategoryInput) {
    return request<JobCategory>('/admin/job-categories', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },
  async adminUpdateJobCategory(code, data: JobCategoryInput) {
    return request<JobCategory>(`/admin/job-categories/${code}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  },
  async adminDeleteJobCategory(code) {
    return request<void>(`/admin/job-categories/${code}`, { method: 'DELETE' });
  },

  // ---- Direction owners ----
  async adminListDirectionOwners() {
    return request<User[]>('/admin/direction-owners');
  },

  // ---- Announcements ----
  async listAnnouncements(params) {
    const q = params?.type ? `?type=${encodeURIComponent(params.type)}` : '';
    return request<Announcement[]>(`/announcements${q}`);
  },
  async getAnnouncement(id) {
    return request<Announcement>(`/announcements/${id}`);
  },
  async adminListAnnouncements(params) {
    const q = params?.type ? `?type=${encodeURIComponent(params.type)}` : '';
    return request<Announcement[]>(`/admin/announcements${q}`);
  },
  async adminGetAnnouncement(id) {
    return request<Announcement>(`/admin/announcements/${id}`);
  },
  async adminCreateAnnouncement(data: AnnouncementInput) {
    return request<Announcement>('/admin/announcements', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },
  async adminUpdateAnnouncement(id, data: AnnouncementInput) {
    return request<Announcement>(`/admin/announcements/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  },
  async adminDeleteAnnouncement(id) {
    return request<void>(`/admin/announcements/${id}`, { method: 'DELETE' });
  },
  async adminPublishAnnouncement(id) {
    return request<Announcement>(`/admin/announcements/${id}/publish`, { method: 'POST' });
  },
  async adminCloseAnnouncement(id) {
    return request<Announcement>(`/admin/announcements/${id}/close`, { method: 'POST' });
  },
  async adminListApplications(params) {
    const q = new URLSearchParams();
    if (params?.job_id) q.set('job_id', params.job_id);
    if (params?.stage) q.set('stage', params.stage);
    const qs = q.toString();
    return request<AdminApplication[]>(`/admin/applications${qs ? `?${qs}` : ''}`);
  },
  async adminGetApplication(id) {
    return request<AdminApplicationDetail>(`/admin/applications/${id}`);
  },
  async adminNextStage(id, reason) {
    return request<AdminApplicationDetail>(`/admin/applications/${id}/next-stage`, {
      method: 'POST',
      body: JSON.stringify({ reason }),
    });
  },
  async adminTransition(id, targetStage, reason) {
    return request<AdminApplicationDetail>(`/admin/applications/${id}/transition`, {
      method: 'POST',
      body: JSON.stringify({ target_stage: targetStage, reason }),
    });
  },
  async adminHold(id, reason) {
    return request<AdminApplicationDetail>(`/admin/applications/${id}/hold`, {
      method: 'POST',
      body: JSON.stringify({ reason }),
    });
  },
  async adminResume(id, reason) {
    return request<AdminApplicationDetail>(`/admin/applications/${id}/resume`, {
      method: 'POST',
      body: JSON.stringify({ reason }),
    });
  },
  async adminReject(id, reason) {
    return request<AdminApplicationDetail>(`/admin/applications/${id}/reject`, {
      method: 'POST',
      body: JSON.stringify({ reason }),
    });
  },
  async adminAddCandidateTag(candidateId, tagId) {
    return request(`/admin/talents/${candidateId}/tags`, {
      method: 'POST',
      body: JSON.stringify({ tag_id: tagId }),
    });
  },
  async adminAgentResult(id) {
    return request<AgentResult>(`/admin/applications/${id}/agent-result`);
  },
  async adminAgentRerun(id) {
    return request<AgentResult>(`/admin/applications/${id}/agent-rerun`, { method: 'POST' });
  },
  async adminDownloadResume(id) {
    const detail = await request<AdminApplicationDetail>(`/admin/applications/${id}`);
    const filename = detail.resume?.file_name || 'resume.pdf';
    await downloadFile(`/admin/applications/${id}/resume-download`, filename);
  },
  async adminResumeBlob(id) {
    return fetchFileBlob(`/admin/applications/${id}/resume-download`);
  },
  async adminCreateInterview(data: InterviewInput) {
    return request<Interview>('/admin/interviews', { method: 'POST', body: JSON.stringify(data) });
  },
  async adminListInterviews() {
    return request<InterviewDetail[]>('/admin/interviews');
  },
  async adminGetInterview(id) {
    return request<InterviewDetail>(`/admin/interviews/${id}`);
  },
  async adminUpdateInterview(id, data) {
    return request<Interview>(`/admin/interviews/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  },
  async adminCancelInterview(id) {
    return request<Interview>(`/admin/interviews/${id}/cancel`, { method: 'POST' });
  },
  async remindInterview(id: string) {
    return request<{ ok: boolean; notified: string[]; need_feedback: boolean }>(
      `/admin/interviews/${id}/remind`,
      { method: 'POST' },
    );
  },
  async adminConfirmFeedback(id: string, data: FeedbackConfirmIn) {
    return request<InterviewDetail>(`/admin/interviews/${id}/confirm`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },
  async adminListInterviewers() {
    return request<User[]>('/admin/interviewers');
  },
  async interviewerListInterviews() {
    return request<InterviewDetail[]>('/interviewer/interviews');
  },
  async interviewerGetInterview(id) {
    return request<InterviewDetail>(`/interviewer/interviews/${id}`);
  },
  async interviewerFeedback(id, data: FeedbackInput) {
    return request<InterviewFeedback>(`/interviewer/interviews/${id}/feedback`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },
  async listUsers() {
    return request<User[]>('/admin/users');
  },
  async createUser(data) {
    return request<User>('/admin/users', { method: 'POST', body: JSON.stringify(data) });
  },
  async updateUser(id, data) {
    return request<User>(`/admin/users/${id}`, { method: 'PUT', body: JSON.stringify(data) });
  },
  async listTalents(params) {
    const q = new URLSearchParams(params || {});
    return request(`/admin/talents${q.toString() ? `?${q}` : ''}`);
  },
  async getTalent(id) {
    return request(`/admin/talents/${id}`);
  },
  async reactivateTalent(id, data) {
    return request(`/admin/talents/${id}/reactivate`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },
  async deleteTalent(id) {
    return request(`/admin/talents/${id}`, { method: 'DELETE' });
  },
  async restoreTalent(id) {
    return request(`/admin/talents/${id}/restore`, { method: 'POST' });
  },
  async createTalent(data) {
    return request('/admin/talents', { method: 'POST', body: JSON.stringify(data) });
  },
  async updateTalent(id, data) {
    return request(`/admin/talents/${id}`, { method: 'PUT', body: JSON.stringify(data) });
  },
  async listSourceChannels() {
    return request('/admin/source-channels');
  },
  async listTags() {
    return request('/admin/tags');
  },
  async listTalentOwners() {
    return request('/admin/talent-owners');
  },
  async createSourceChannel(data) {
    return request('/admin/source-channels', { method: 'POST', body: JSON.stringify(data) });
  },
  async updateSourceChannel(id, data) {
    return request(`/admin/source-channels/${id}`, { method: 'PUT', body: JSON.stringify(data) });
  },
  async createTag(data) {
    return request('/admin/tags', { method: 'POST', body: JSON.stringify(data) });
  },
  async updateTag(id, data) {
    return request(`/admin/tags/${id}`, { method: 'PUT', body: JSON.stringify(data) });
  },
  async bulkApplications(data) {
    return request('/admin/applications/bulk-actions', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },
  async calendarEvents(start, end, interviewerId = '') {
    const q = new URLSearchParams({ start, end });
    if (interviewerId) q.set('interviewer_id', interviewerId);
    return request(`/admin/calendar?${q}`);
  },
  async availability(interviewerId, start, end, duration) {
    const q = new URLSearchParams({ start, end, duration_minutes: String(duration) });
    return request(`/admin/calendar/interviewers/${interviewerId}/availability?${q}`);
  },
  async addBusyBlock(data) {
    return request('/admin/calendar/busy-blocks', { method: 'POST', body: JSON.stringify(data) });
  },
  async deleteBusyBlock(id) {
    return request(`/admin/calendar/busy-blocks/${id}`, { method: 'DELETE' });
  },
  async listOffers(status) {
    return request(`/admin/offers${status ? `?status=${encodeURIComponent(status)}` : ''}`);
  },
  async createOffer(data) {
    return request('/admin/offers', { method: 'POST', body: JSON.stringify(data) });
  },
  async offerAction(id, action, data = {}) {
    return request(`/admin/offers/${id}/${action}`, { method: 'POST', body: JSON.stringify(data) });
  },
  async report(name) {
    return request(`/admin/reports/${name}`);
  },
  async notifications() {
    return request('/notifications');
  },
  async readNotification(id) {
    return request(`/notifications/${id}/read`, { method: 'POST' });
  },
  async auditLogs(params) {
    const q = new URLSearchParams(params || {});
    return request(`/admin/audit-logs${q.toString() ? `?${q}` : ''}`);
  },
  async communications(candidateId) {
    return request(`/admin/notifications/${candidateId}/communications`);
  },
  async listTalentNotes(id) {
    return request(`/admin/talents/${id}/notes`);
  },
  async addTalentNote(id, content: string) {
    return request(`/admin/talents/${id}/notes`, {
      method: 'POST',
      body: JSON.stringify({ content }),
    });
  },
};
