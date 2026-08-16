import type { ApiClient } from './apiTypes';
import { getToken } from './token';
import type {
  Application,
  Announcement,
  AuthResponse,
  Interview,
  Job,
  JobCategory,
  Resume,
  StageHistory,
  User,
} from '../types';

const BASE = import.meta.env.VITE_API_BASE || '/api/v1';

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

export const realApi: ApiClient = {
  async register(input) {
    return request<AuthResponse>('/auth/register', {
      method: 'POST',
      body: JSON.stringify(input),
    });
  },
  async login(input) {
    return request<AuthResponse>('/auth/login', {
      method: 'POST',
      body: JSON.stringify(input),
    });
  },
  async me() {
    return request<User>('/auth/me');
  },
  async listJobs(params) {
    const qs = new URLSearchParams();
    if (params?.search) qs.set('search', params.search);
    if (params?.category_code) qs.set('category_code', params.category_code);
    if (params?.category_codes?.length) {
      params.category_codes.forEach((c) => qs.append('category_codes', c));
    }
    if (params?.location) qs.set('location', params.location);
    if (params?.locations?.length) {
      params.locations.forEach((l) => qs.append('locations', l));
    }
    if (params?.job_type) qs.set('job_type', params.job_type);
    if (params?.job_types?.length) {
      params.job_types.forEach((t) => qs.append('job_types', t));
    }
    const q = qs.toString();
    return request<Job[]>(`/jobs${q ? `?${q}` : ''}`);
  },
  async getJob(id) {
    return request<Job>(`/jobs/${id}`);
  },
  async listJobCategories() {
    return request<JobCategory[]>('/job-categories');
  },
  async listJobLocations() {
    return request<string[]>('/jobs/locations');
  },
  async listAnnouncements(params) {
    const q = params?.type ? `?type=${encodeURIComponent(params.type)}` : '';
    return request<Announcement[]>(`/announcements${q}`);
  },
  async getAnnouncement(id) {
    return request<Announcement>(`/announcements/${id}`);
  },
  async getProfile() {
    return request('/candidate/profile');
  },
  async updateProfile(data) {
    return request('/candidate/profile', { method: 'PUT', body: JSON.stringify(data) });
  },
  async getResume() {
    return request<Resume | null>('/candidate/resume');
  },
  async uploadResume(file) {
    const fd = new FormData();
    fd.append('file', file);
    return request<Resume>('/candidate/resume', { method: 'POST', body: fd });
  },
  async createApplication(jobId, resumeId) {
    return request<Application>('/applications', {
      method: 'POST',
      body: JSON.stringify({ job_id: jobId, resume_id: resumeId }),
    });
  },
  async myApplications() {
    return request<Application[]>('/applications/my');
  },
  async getApplication(id) {
    return request<Application & { interviews: Interview[]; stage_history: StageHistory[] }>(
      `/applications/${id}`,
    );
  },
  async withdrawApplication(id) {
    return request<void>(`/applications/${id}/withdraw`, { method: 'POST' });
  },
  async myOffers() {
    return request('/candidate/offers');
  },
  async respondOffer(id, decision, reason = '') {
    return request(`/candidate/offers/${id}/respond`, {
      method: 'POST',
      body: JSON.stringify({ decision, reason }),
    });
  },
};
