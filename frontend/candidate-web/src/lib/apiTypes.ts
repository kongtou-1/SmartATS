import type {
  Application,
  Announcement,
  AuthResponse,
  Interview,
  Job,
  JobCategory,
  Resume,
  User,
  Offer,
  CandidateProfile,
} from '../types';

// The surface every client (real + mock) must implement.
export interface ApiClient {
  // Auth
  register(input: { email: string; password: string; name: string }): Promise<AuthResponse>;
  login(input: { email: string; password: string; scope?: 'candidate' }): Promise<AuthResponse>;
  me(): Promise<User>;

  // Public jobs
  listJobs(params?: {
    search?: string;
    category_code?: string;
    category_codes?: string[];
    location?: string;
    locations?: string[];
    job_type?: string;
    job_types?: string[];
  }): Promise<Job[]>;
  getJob(id: string): Promise<Job>;

  // Job categories (public) + distinct locations
  listJobCategories(): Promise<JobCategory[]>;
  listJobLocations(): Promise<string[]>;

  // Announcements (public)
  listAnnouncements(params?: { type?: string }): Promise<Announcement[]>;
  getAnnouncement(id: string): Promise<Announcement>;

  // Candidate profile + resume
  getProfile(): Promise<CandidateProfile>;
  updateProfile(data: CandidateProfile): Promise<CandidateProfile>;
  getResume(): Promise<Resume | null>;
  uploadResume(file: File): Promise<Resume>;

  // Applications
  createApplication(jobId: string, resumeId: string): Promise<Application>;
  myApplications(): Promise<Application[]>;
  getApplication(
    id: string,
  ): Promise<
    Application & { interviews: Interview[]; stage_history: import('../types').StageHistory[] }
  >;
  withdrawApplication(id: string): Promise<void>;
  myOffers?(): Promise<Offer[]>;
  respondOffer?(id: string, decision: 'ACCEPT' | 'DECLINE', reason?: string): Promise<Offer>;
}
