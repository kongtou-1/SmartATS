import type { ApiClient } from './apiTypes';
import type {
  Application,
  Announcement,
  AuthResponse,
  Interview,
  Job,
  JobCategory,
  Resume,
  User,
} from '../types';
import {
  blankProfile,
  delay,
  findMockUserByEmail as findUserByEmail,
  loadMockDb,
  nowIso,
  saveMockDb as save,
  uid,
  type CandidateMockDb as Db,
} from './mockDb';

// ---------------------------------------------------------------------------
// A tiny localStorage-backed fake backend so the MVP frontend is fully usable
// before the real FastAPI service exists. It mirrors the API contract in
// hr_ats_agent_mvp_v1.md §16. Swap to the real backend by setting
// VITE_USE_MOCK=false (or removing .env).
// ---------------------------------------------------------------------------

function seed(): Db {
  const hrId = uid('u');
  const candidateId = uid('u');
  const interviewerId = uid('u');
  const adminId = uid('u');
  const candUserId = uid('u');
  const jobs: Job[] = [
    {
      id: uid('j'),
      title: '前端工程师',
      location: '深圳',
      description: '负责公司核心产品 Web 前端开发，参与组件库建设与性能优化。',
      requirements:
        '1. 熟练掌握 React/Vue 等主流框架；\n2. 熟悉 TypeScript；\n3. 理解前端工程化与构建工具；\n4. 3 年以上相关经验。',
      status: 'PUBLISHED',
      job_type: 'SOCIAL',
      created_by: hrId,
      published_at: nowIso(),
      created_at: nowIso(),
      updated_at: nowIso(),
      category_code: 'RND',
      category_name: '研发',
    },
    {
      id: uid('j'),
      title: '后端工程师 (Python)',
      location: '上海',
      description: '负责招聘系统后端服务开发，基于 FastAPI 构建高可用 API。',
      requirements:
        '1. 精通 Python；\n2. 熟悉 FastAPI / SQLAlchemy；\n3. 熟悉 PostgreSQL；\n4. 有 AI 集成经验者优先。',
      status: 'PUBLISHED',
      job_type: 'CAMPUS',
      created_by: hrId,
      published_at: nowIso(),
      created_at: nowIso(),
      updated_at: nowIso(),
      category_code: 'RND',
      category_name: '研发',
    },
    {
      id: uid('j'),
      title: '产品设计师 (草稿)',
      location: '北京',
      description: '负责产品交互与视觉设计。',
      requirements: '1. 熟练使用 Figma；\n2. 有 B 端产品设计经验。',
      status: 'DRAFT',
      job_type: 'INTERN',
      created_by: hrId,
      published_at: null,
      created_at: nowIso(),
      updated_at: nowIso(),
      category_name: '产品',
    },
  ];
  const users: User[] = [
    {
      id: candUserId,
      email: 'candidate@demo.com',
      name: '示例求职者',
      role: 'CANDIDATE',
      status: 'ACTIVE',
      created_at: nowIso(),
    },
    {
      id: hrId,
      email: 'hr@demo.com',
      name: '示例 HR',
      role: 'HR',
      status: 'ACTIVE',
      created_at: nowIso(),
    },
    {
      id: interviewerId,
      email: 'interviewer@demo.com',
      name: '示例面试官',
      role: 'INTERVIEWER',
      status: 'ACTIVE',
      created_at: nowIso(),
    },
    {
      id: adminId,
      email: 'admin@demo.com',
      name: '超级管理员',
      role: 'SUPER_ADMIN',
      status: 'ACTIVE',
      created_at: nowIso(),
    },
  ];
  const jobCategories: JobCategory[] = [
    {
      code: 'RND',
      name: '研发',
      parent_code: null,
      sort_order: 1,
      created_at: nowIso(),
      updated_at: nowIso(),
    },
    {
      code: 'OPS',
      name: '运营',
      parent_code: null,
      sort_order: 2,
      created_at: nowIso(),
      updated_at: nowIso(),
    },
    {
      code: 'PROD',
      name: '产品',
      parent_code: null,
      sort_order: 3,
      created_at: nowIso(),
      updated_at: nowIso(),
    },
    {
      code: 'MKT',
      name: '市场',
      parent_code: null,
      sort_order: 4,
      created_at: nowIso(),
      updated_at: nowIso(),
    },
    {
      code: 'FUNC',
      name: '职能',
      parent_code: null,
      sort_order: 5,
      created_at: nowIso(),
      updated_at: nowIso(),
    },
  ];
  const announcements: Announcement[] = [
    {
      id: uid('a'),
      type: 'NOTICE',
      title: '2026 春季校园招聘正式启动',
      content: '本次春招覆盖研发、产品、运营等多个方向，欢迎应届毕业生投递。简历投递通道现已开放。',
      status: 'PUBLISHED',
      pinned: true,
      created_at: nowIso(),
      updated_at: nowIso(),
      published_at: nowIso(),
    },
    {
      id: uid('a'),
      type: 'FLOW_ISSUE',
      title: '笔试/面试环节常见问题说明',
      content:
        '1) 面试前 30 分钟会收到会议链接；\n2) 若无法按时参加，请在站内信申请改期；\n3) 结果一般在面试后 5 个工作日内反馈。',
      status: 'PUBLISHED',
      pinned: false,
      created_at: nowIso(),
      updated_at: nowIso(),
      published_at: nowIso(),
    },
  ];
  return {
    users,
    passwords: {
      [candUserId]: 'demo1234',
      [hrId]: 'demo1234',
      [interviewerId]: 'demo1234',
      [adminId]: 'demo1234',
    },
    profiles: {
      [candUserId]: blankProfile('示例求职者', 'candidate@demo.com', '13800000000'),
    },
    candidates: { [candUserId]: candidateId },
    resumes: {},
    jobs,
    jobCategories,
    announcements,
    applications: [],
    interviews: [],
  };
}

function load(): Db {
  return loadMockDb(seed);
}

function mockAgentScore(): number {
  return 70 + Math.floor(Math.random() * 26); // 70-95
}

export const mockApi: ApiClient = {
  async register(input) {
    const db = load();
    if (findUserByEmail(db, input.email)) {
      throw new Error('该邮箱已注册');
    }
    const id = uid('u');
    const user: User = {
      id,
      email: input.email,
      name: input.name,
      role: 'CANDIDATE',
      status: 'ACTIVE',
      created_at: nowIso(),
    };
    db.users.push(user);
    db.passwords[id] = input.password;
    db.profiles[id] = blankProfile(input.name, input.email);
    db.candidates[id] = uid('c');
    save(db);
    const res: AuthResponse = { access_token: 'mock-' + id, token_type: 'bearer', user };
    return delay(res);
  },

  async login(input) {
    const db = load();
    const user = findUserByEmail(db, input.email);
    if (!user || db.passwords[user.id] !== input.password) {
      throw new Error('邮箱或密码错误');
    }
    const res: AuthResponse = { access_token: 'mock-' + user.id, token_type: 'bearer', user };
    return delay(res);
  },

  async me() {
    const db = load();
    const token = localStorage.getItem('hr_token');
    const id = token?.replace('mock-', '');
    const user = db.users.find((u) => u.id === id);
    if (!user) throw new Error('未登录');
    return delay(user);
  },

  async listJobs(params) {
    const db = load();
    let jobs = db.jobs.filter((j) => j.status === 'PUBLISHED');
    if (params?.search) {
      const s = params.search.toLowerCase();
      jobs = jobs.filter(
        (j) => j.title.toLowerCase().includes(s) || j.location.toLowerCase().includes(s),
      );
    }
    const codes = [
      ...(params?.category_code ? [params.category_code] : []),
      ...(params?.category_codes || []),
    ];
    if (codes.length) {
      jobs = jobs.filter((j) => codes.includes(j.category_code || ''));
    }
    const locs = [
      ...(params?.location ? [params.location] : []),
      ...(params?.locations || []),
    ];
    if (locs.length) {
      jobs = jobs.filter((j) => locs.includes(j.location));
    }
    const types = [
      ...(params?.job_type ? [params.job_type] : []),
      ...(params?.job_types || []),
    ];
    if (types.length) {
      jobs = jobs.filter((j) => types.includes(j.job_type));
    }
    return delay(jobs);
  },

  async getJob(id) {
    const db = load();
    const job = db.jobs.find((j) => j.id === id);
    if (!job) throw new Error('岗位不存在');
    return delay(job);
  },

  async listJobCategories() {
    const db = load();
    return delay([...db.jobCategories].sort((a, b) => a.sort_order - b.sort_order));
  },

  async listJobLocations() {
    const db = load();
    const set = new Set(
      db.jobs
        .filter((j) => j.status === 'PUBLISHED')
        .map((j) => j.location)
        .filter(Boolean),
    );
    return delay(Array.from(set));
  },

  async listAnnouncements(params) {
    const db = load();
    let list = db.announcements.filter((a) => a.status === 'PUBLISHED');
    if (params?.type) list = list.filter((a) => a.type === params.type);
    return delay(
      [...list].sort((a, b) => {
        if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
        return (b.published_at || '').localeCompare(a.published_at || '');
      }),
    );
  },

  async getAnnouncement(id) {
    const db = load();
    const a = db.announcements.find((x) => x.id === id);
    if (!a) throw new Error('动态不存在');
    return delay(a);
  },

  async getProfile() {
    const db = load();
    const token = localStorage.getItem('hr_token');
    const id = token?.replace('mock-', '');
    const profile = db.profiles[id!] || blankProfile();
    return delay(profile);
  },

  async updateProfile(data) {
    const db = load();
    const token = localStorage.getItem('hr_token');
    const id = token?.replace('mock-', '');
    const current = db.profiles[id!] || blankProfile();
    db.profiles[id!] = {
      ...data,
      identity_number: '',
      identity_number_set: current.identity_number_set || !!data.identity_number,
      identity_number_masked: data.identity_number
        ? `**************${data.identity_number.slice(-4)}`
        : current.identity_number_masked,
      profile_version: (current.profile_version || 0) + 1,
      profile_saved_at: nowIso(),
    };
    const u = db.users.find((x) => x.id === id);
    if (u) u.name = data.name;
    save(db);
    return delay(db.profiles[id!]);
  },

  async getResume() {
    const db = load();
    const token = localStorage.getItem('hr_token');
    const userId = token?.replace('mock-', '');
    const candId = db.candidates[userId!];
    return delay(db.resumes[candId] || null);
  },

  async uploadResume(file) {
    const db = load();
    const token = localStorage.getItem('hr_token');
    const userId = token?.replace('mock-', '');
    if (!userId) throw new Error('未登录');
    const candId = db.candidates[userId];
    const extension = file.name.slice(file.name.lastIndexOf('.')).toLowerCase();
    if (!['.pdf', '.doc', '.docx'].includes(extension))
      throw new Error('仅支持 PDF、DOC、DOCX 简历');
    if (file.size > 10 * 1024 * 1024) throw new Error('简历文件不能超过 10MB');
    const resume: Resume = {
      id: uid('r'),
      candidate_id: candId,
      file_name: file.name,
      storage_key: 'mock/' + file.name,
      parse_status: 'PENDING',
      parsed_data: null,
      created_at: nowIso(),
      updated_at: nowIso(),
    };
    db.resumes[candId] = resume;
    save(db);
    return delay(resume);
  },

  async createApplication(jobId, resumeId) {
    const db = load();
    const token = localStorage.getItem('hr_token');
    const userId = token?.replace('mock-', '');
    if (!userId) throw new Error('未登录');
    const candId = db.candidates[userId];
    const resume = db.resumes[candId];
    if (!resume || resume.id !== resumeId) throw new Error('请选择本人已上传的简历');
    const profile = db.profiles[userId];
    if (
      !profile?.name.trim() ||
      !profile.phone.trim() ||
      !profile.contact_email.trim() ||
      !profile.identity_number_set ||
      !profile.preferred_locations.length ||
      !profile.education.length
    )
      throw new Error('请先完善必填资料和教育经历');
    const job = db.jobs.find((j) => j.id === jobId);
    if (!job || job.status !== 'PUBLISHED') throw new Error('岗位不存在或未发布');
    const existing = db.applications.find(
      (a) => a.candidate_id === candId && a.job_id === jobId && a.status === 'ACTIVE',
    );
    if (existing) {
      throw new Error('你已投递过该岗位');
    }
    const score = mockAgentScore();
    const now = nowIso();
    const app: Application = {
      id: uid('a'),
      candidate_id: candId,
      job_id: jobId,
      resume_id: resume.id,
      current_stage: 'APPLIED',
      status: 'ACTIVE',
      ai_score: score,
      applied_at: now,
      job: db.jobs.find((j) => j.id === jobId),
      stage_history: [
        {
          id: uid('sh'),
          from_stage: null,
          to_stage: 'APPLIED',
          action: 'APPLY',
          created_at: now,
        },
      ],
      agent_result: {
        id: uid('ag'),
        application_id: '',
        score,
        summary: '整体与岗位要求较匹配，具备相关开发与项目经验。',
        strengths: ['具备相关技术栈经验', '有完整项目经历'],
        gaps: ['缺少部分岗位要求的深层经验'],
        recommendation: score >= 80 ? 'RECOMMEND' : 'CONSIDER',
        status: 'DONE',
      },
    };
    app.agent_result!.application_id = app.id;
    db.applications.push(app);
    save(db);
    return delay(app);
  },

  async myApplications() {
    const db = load();
    const token = localStorage.getItem('hr_token');
    const userId = token?.replace('mock-', '');
    if (!userId) throw new Error('未登录');
    const candId = db.candidates[userId];
    const apps = db.applications
      .filter((a) => a.candidate_id === candId)
      .map((a) => ({ ...a, job: db.jobs.find((j) => j.id === a.job_id) }));
    return delay(apps);
  },

  async getApplication(id) {
    const db = load();
    const app = db.applications.find((a) => a.id === id);
    if (!app) throw new Error('申请不存在');
    const interviews: Interview[] = db.interviews
      .filter((i) => i.application_id === id)
      .map((i) => ({
        ...i,
        interviewer_name: db.users.find((u) => u.id === i.interviewer_id)?.name,
      }));
    return delay({
      ...app,
      job: db.jobs.find((j) => j.id === app.job_id),
      interviews,
      stage_history: app.stage_history || [],
    });
  },

  async withdrawApplication(id) {
    const db = load();
    const app = db.applications.find((a) => a.id === id);
    if (!app) throw new Error('申请不存在');
    const previousStage = app.current_stage;
    app.status = 'WITHDRAWN';
    app.current_stage = 'WITHDRAWN';
    app.stage_history = app.stage_history || [];
    app.stage_history.push({
      id: uid('sh'),
      from_stage: previousStage === 'WITHDRAWN' ? null : previousStage,
      to_stage: 'WITHDRAWN',
      action: 'WITHDRAW',
      created_at: nowIso(),
    });
    save(db);
    return delay(undefined);
  },
};
