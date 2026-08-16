import type {
  Announcement,
  Application,
  CandidateProfile,
  Interview,
  Job,
  JobCategory,
  Resume,
  User,
} from '../types';

const DB_KEY = 'hr_mock_db_v1';

export interface CandidateMockDb {
  users: User[];
  passwords: Record<string, string>;
  profiles: Record<string, CandidateProfile>;
  candidates: Record<string, string>;
  resumes: Record<string, Resume>;
  jobs: Job[];
  jobCategories: JobCategory[];
  announcements: Announcement[];
  applications: Application[];
  interviews: Interview[];
}

export function uid(prefix: string): string {
  return `${prefix}_${Math.random().toString(36).slice(2, 10)}`;
}

export function nowIso(): string {
  return new Date().toISOString();
}

export function delay<T>(value: T, milliseconds = 250): Promise<T> {
  return new Promise((resolve) => setTimeout(() => resolve(value), milliseconds));
}

export function blankProfile(name = '', email = '', phone = ''): CandidateProfile {
  return {
    name,
    phone,
    contact_email: email,
    identity_type: 'CN_ID',
    identity_number: '',
    identity_number_masked: '',
    identity_number_set: false,
    preferred_locations: [],
    education: [],
    internships: [],
    work_experiences: [],
    projects: [],
    languages: [],
    certificates: [],
    self_evaluation: '',
    profile_version: 0,
    profile_saved_at: null,
  };
}

export function saveMockDb(db: CandidateMockDb): void {
  localStorage.setItem(DB_KEY, JSON.stringify(db));
}

export function loadMockDb(createSeed: () => CandidateMockDb): CandidateMockDb {
  const raw = localStorage.getItem(DB_KEY);
  if (raw) {
    try {
      const db = JSON.parse(raw) as CandidateMockDb;
      db.profiles = db.profiles || {};
      for (const user of db.users.filter((item) => item.role === 'CANDIDATE')) {
        const old = db.profiles[user.id] as Partial<CandidateProfile> | undefined;
        db.profiles[user.id] = {
          ...blankProfile(user.name, user.email),
          ...(old || {}),
          preferred_locations: old?.preferred_locations || [],
          education: old?.education || [],
          internships: old?.internships || [],
          work_experiences: old?.work_experiences || [],
          projects: old?.projects || [],
          languages: old?.languages || [],
          certificates: old?.certificates || [],
        };
      }
      db.jobs = db.jobs.map((job) => ({ ...job, job_type: job.job_type || 'SOCIAL' }));
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

export function findMockUserByEmail(db: CandidateMockDb, email: string): User | undefined {
  return db.users.find((user) => user.email.toLowerCase() === email.toLowerCase());
}
