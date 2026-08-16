import type {
  AgentResult,
  Announcement,
  InterviewDetail,
  InterviewFeedback,
  Job,
  JobCategory,
  Resume,
  StageHistory,
  User,
} from '../types';

const DB_KEY = 'hr_admin_mock_db_v2';

export interface MockCandidate {
  id: string;
  user_id: string;
  name: string;
  email: string;
  phone: string;
  city: string;
}

export interface StoredApplication {
  id: string;
  candidate_id: string;
  job_id: string;
  resume_id: string;
  current_stage: string;
  status: string;
  ai_score: number | null;
  applied_at: string;
}

export interface AdminMockDb {
  users: User[];
  passwords: Record<string, string>;
  candidates: MockCandidate[];
  resumes: Record<string, Resume>;
  jobs: Job[];
  jobCategories: JobCategory[];
  announcements: Announcement[];
  applications: StoredApplication[];
  agent_results: Record<string, AgentResult>;
  interviews: InterviewDetail[];
  feedbacks: Record<string, InterviewFeedback>;
  stage_history?: Record<string, StageHistory[]>;
}

export function uid(prefix: string): string {
  return `${prefix}_${Math.random().toString(36).slice(2, 10)}`;
}

export function nowIso(): string {
  return new Date().toISOString();
}

export function delay<T>(value: T, milliseconds = 200): Promise<T> {
  return new Promise((resolve) => setTimeout(() => resolve(value), milliseconds));
}

export function saveMockDb(db: AdminMockDb): void {
  localStorage.setItem(DB_KEY, JSON.stringify(db));
}

export function loadMockDb(createSeed: () => AdminMockDb): AdminMockDb {
  const raw = localStorage.getItem(DB_KEY);
  if (raw) {
    try {
      const db = JSON.parse(raw) as AdminMockDb;
      db.jobs = db.jobs.map((job) => ({
        ...job,
        job_type: job.job_type || 'SOCIAL',
        headcount: job.headcount ?? 1,
        salary_negotiable: job.salary_negotiable ?? false,
      }));
      saveMockDb(db);
      return db;
    } catch {
      // Invalid local demo data is replaced with a clean seed.
    }
  }
  const db = createSeed();
  saveMockDb(db);
  return db;
}

export function currentMockUserId(): string | undefined {
  return localStorage.getItem('hr_admin_token')?.replace('mock-', '');
}

export function findMockUser(db: AdminMockDb, email: string): User | undefined {
  return db.users.find((user) => user.email.toLowerCase() === email.toLowerCase());
}
