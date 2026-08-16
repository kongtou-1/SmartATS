import type { ApiClient } from './apiTypes';
import type {
  AdminApplication,
  AdminApplicationDetail,
  AgentResult,
  Announcement,
  AnnouncementInput,
  ChannelReportRow,
  DashboardSummary,
  FeedbackConfirmIn,
  FeedbackInput,
  FunnelReport,
  InterviewDetail,
  InterviewFeedback,
  InterviewInput,
  Job,
  JobCategory,
  JobCategoryInput,
  JobCycleReportRow,
  JobInput,
  JobWithStats,
  Resume,
  Role,
  Stage,
  StageHistory,
  User,
  WorkloadReportRow,
} from '../types';
import { STAGE_ORDER } from '../types';
import {
  currentMockUserId as currentUserId,
  delay,
  findMockUser as findUser,
  loadMockDb,
  nowIso,
  saveMockDb as save,
  uid,
  type AdminMockDb as Db,
  type MockCandidate as Candidate,
  type StoredApplication,
} from './mockDb';

function sampleResume(name: string, email: string, phone: string): Resume {
  return {
    id: uid('r'),
    candidate_id: '',
    file_name: name + '_简历.pdf',
    storage_key: 'mock/' + name + '.pdf',
    parse_status: 'DONE',
    parsed_data: {
      name,
      email,
      phone,
      education: [
        { school: '某某大学', degree: '本科', major: '计算机科学', start: '2015', end: '2019' },
      ],
      work_experience: [
        {
          company: '示例科技',
          title: '前端工程师',
          start: '2019',
          end: '2024',
          description: '负责 Web 前端开发与组件库建设。',
        },
      ],
      projects: [{ name: '招聘系统 MVP', role: '核心开发', description: '实现求职者端与管理端。' }],
      skills: ['React', 'TypeScript', 'Vue', 'Node.js', 'Webpack'],
    },
    created_at: nowIso(),
    updated_at: nowIso(),
  };
}

// Diverse candidate profiles so the kanban / matrix view has rich cards.
const CANDIDATE_PROFILES: Array<{
  name: string;
  email: string;
  phone: string;
  city: string;
  school: string;
  degree: string;
  company: string;
  skills: string[];
}> = [
  {
    name: '陆天宇',
    email: 'lu@demo.com',
    phone: '13900000001',
    city: '深圳',
    school: '中国美术学院',
    degree: '本科',
    company: '美团 / 企业平台部 · 高级体验设计师',
    skills: ['Design System', 'B端中后台', 'Figma', '动效设计'],
  },
  {
    name: '黄诗雨',
    email: 'huang@demo.com',
    phone: '13900000002',
    city: '广州',
    school: '中山大学',
    degree: '硕士',
    company: '腾讯（暑期实习） · 前端开发工程师',
    skills: ['ACM校队银牌', 'React', 'Node全栈'],
  },
  {
    name: '沈思远',
    email: 'shen@demo.com',
    phone: '13900000003',
    city: '上海',
    school: '华中科技大学',
    degree: '本科',
    company: '字节跳动 / 抖音架构组 · 高级前端',
    skills: ['React生态精通', 'Monorepo架构', '性能优化'],
  },
  {
    name: '程梦',
    email: 'cheng@demo.com',
    phone: '13900000004',
    city: '上海',
    school: '上海交通大学',
    degree: '硕士',
    company: '小红书 / 推荐中台 · Senior Python',
    skills: ['高并发微服务', 'FastAPI', 'Asyncio', '搜索推荐'],
  },
  {
    name: '赵子轩',
    email: 'zhao@demo.com',
    phone: '13900000005',
    city: '杭州',
    school: '浙江大学',
    degree: '博士',
    company: '高济科技 / 大模型研究院 · AI 算法',
    skills: ['顶会论文一作', 'Megatron训练', 'LLM推理优化'],
  },
  {
    name: '王清漪',
    email: 'qingyi@demo.com',
    phone: '13900000006',
    city: '北京',
    school: '北京大学',
    degree: '硕士',
    company: '字节 / TikTok · 内容理解',
    skills: ['NLP', 'Transformer', 'PyTorch', '多模态'],
  },
];

function richResume(p: (typeof CANDIDATE_PROFILES)[number]): Resume {
  return {
    id: uid('r'),
    candidate_id: '',
    file_name: p.name + '_简历.pdf',
    storage_key: 'mock/' + p.name + '.pdf',
    parse_status: 'DONE',
    parsed_data: {
      name: p.name,
      email: p.email,
      phone: p.phone,
      education: [{ school: p.school, degree: p.degree, major: '相关方向', start: '2018', end: '2022' }],
      work_experience: [
        {
          company: p.company.split('·')[0].trim(),
          title: p.company.split('·')[1]?.trim() || '工程师',
          start: '2022',
          end: '至今',
          description: p.skills.join('、'),
        },
      ],
      projects: [{ name: '代表性项目', role: '核心成员', description: p.skills.join('、') }],
      skills: p.skills,
    },
    created_at: nowIso(),
    updated_at: nowIso(),
  };
}

function seed(): Db {
  const hrId = uid('u');
  const interviewerId = uid('u');
  const adminId = uid('u');
  const ownerZhangId = uid('u');
  const ownerHeId = uid('u');
  const ownerLiId = uid('u');
  const ownerZhouId = uid('u');
  const ownerSongId = uid('u');
  const c1 = uid('u');
  const c2 = uid('u');
  const c3 = uid('u');

  const users: User[] = [
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
    {
      id: ownerZhangId,
      email: 'zhangchen@demo.com',
      name: '张晨',
      title: '技术委员会主席 / 技术VP',
      role: 'DIRECTION_OWNER',
      status: 'ACTIVE',
      created_at: nowIso(),
    },
    {
      id: ownerHeId,
      email: 'heyue@demo.com',
      name: '何悦',
      title: '用户运营与增长总监',
      role: 'DIRECTION_OWNER',
      status: 'ACTIVE',
      created_at: nowIso(),
    },
    {
      id: ownerLiId,
      email: 'liwei@demo.com',
      name: '李维',
      title: '服务端架构师',
      role: 'DIRECTION_OWNER',
      status: 'ACTIVE',
      created_at: nowIso(),
    },
    {
      id: ownerZhouId,
      email: 'zhoubo@demo.com',
      name: '周博',
      title: 'AI工程化负责人',
      role: 'DIRECTION_OWNER',
      status: 'ACTIVE',
      created_at: nowIso(),
    },
    {
      id: ownerSongId,
      email: 'songzixuan@demo.com',
      name: '宋子轩',
      title: '移动端技术组长',
      role: 'DIRECTION_OWNER',
      status: 'ACTIVE',
      created_at: nowIso(),
    },
    {
      id: c1,
      email: 'zhang@demo.com',
      name: '张三',
      role: 'CANDIDATE',
      status: 'ACTIVE',
      created_at: nowIso(),
    },
    {
      id: c2,
      email: 'li@demo.com',
      name: '李四',
      role: 'CANDIDATE',
      status: 'ACTIVE',
      created_at: nowIso(),
    },
    {
      id: c3,
      email: 'wang@demo.com',
      name: '王五',
      role: 'CANDIDATE',
      status: 'ACTIVE',
      created_at: nowIso(),
    },
  ];

  const candidates: Candidate[] = [
    {
      id: uid('c'),
      user_id: c1,
      name: '张三',
      email: 'zhang@demo.com',
      phone: '13800000001',
      city: '深圳',
    },
    {
      id: uid('c'),
      user_id: c2,
      name: '李四',
      email: 'li@demo.com',
      phone: '13800000002',
      city: '上海',
    },
    {
      id: uid('c'),
      user_id: c3,
      name: '王五',
      email: 'wang@demo.com',
      phone: '13800000003',
      city: '北京',
    },
    // Diverse profiles to feed kanban / matrix demo cards.
    ...CANDIDATE_PROFILES.map((p) => ({
      id: uid('c'),
      user_id: uid('u'),
      name: p.name,
      email: p.email,
      phone: p.phone,
      city: p.city,
    })),
  ];

  const resumes: Record<string, Resume> = {};
  candidates.forEach((cd, idx) => {
    const profile = CANDIDATE_PROFILES[idx - 3]; // first 3 indices use sample, the rest pull from profiles
    const r = profile ? richResume(profile) : sampleResume(cd.name, cd.email, cd.phone);
    r.candidate_id = cd.id;
    resumes[cd.id] = r;
  });

  const jobs: Job[] = [
    {
      id: uid('j'),
      title: '前端工程师',
      location: '深圳',
      description: '负责公司核心产品 Web 前端开发，参与组件库建设与性能优化。',
      requirements:
        '1. 熟练掌握 React/Vue；\n2. 熟悉 TypeScript；\n3. 理解前端工程化；\n4. 3 年以上经验。',
      category_code: 'RND_FE',
      status: 'PUBLISHED',
      job_type: 'SOCIAL',
      headcount: 3,
      salary_negotiable: false,
      salary_min_k: 18,
      salary_max_k: 30,
      department: '研发中心',
      experience_req: '3-5',
      education_req: 'bachelor',
      urgency: 'HIGH',
      created_by: hrId,
      published_at: nowIso(),
      created_at: nowIso(),
      updated_at: nowIso(),
    },
    {
      id: uid('j'),
      title: '后端工程师 (Python)',
      location: '上海',
      description: '负责招聘系统后端服务开发，基于 FastAPI 构建高可用 API。',
      requirements: '1. 精通 Python；\n2. 熟悉 FastAPI / SQLAlchemy；\n3. 熟悉 PostgreSQL。',
      category_code: 'RND_BE',
      status: 'PUBLISHED',
      job_type: 'CAMPUS',
      headcount: 5,
      salary_negotiable: false,
      salary_min_k: 15,
      salary_max_k: 25,
      department: '研发中心',
      experience_req: '1-3',
      education_req: 'bachelor',
      urgency: 'MEDIUM',
      created_by: hrId,
      published_at: nowIso(),
      created_at: nowIso(),
      updated_at: nowIso(),
    },
    {
      id: uid('j'),
      title: '产品设计师',
      location: '北京',
      description: '负责产品交互与视觉设计。',
      requirements: '1. 熟练使用 Figma；\n2. 有 B 端产品设计经验。',
      category_code: 'PRODUCT',
      status: 'DRAFT',
      job_type: 'INTERN',
      headcount: 1,
      salary_negotiable: true,
      salary_min_k: null,
      salary_max_k: null,
      department: '产品设计',
      experience_req: '',
      education_req: 'bachelor',
      urgency: 'LOW',
      created_by: hrId,
      published_at: null,
      created_at: nowIso(),
      updated_at: nowIso(),
    },
    {
      id: uid('j'),
      title: '算法工程师 (推荐/搜索)',
      location: '深圳',
      description: '负责推荐与搜索算法研发，构建大规模机器学习排序与召回系统。',
      requirements:
        '1. 扎实的机器学习基础；\n2. 熟悉 PyTorch / TensorFlow；\n3. 有推荐/搜索/NLP 落地经验；\n4. 熟悉 Python 与 C++。',
      category_code: 'RND_AI',
      status: 'PUBLISHED',
      job_type: 'SOCIAL',
      headcount: 2,
      salary_negotiable: false,
      salary_min_k: 30,
      salary_max_k: 55,
      department: '算法与AI',
      experience_req: '3-5',
      education_req: 'master',
      urgency: 'HIGH',
      created_by: hrId,
      published_at: nowIso(),
      created_at: nowIso(),
      updated_at: nowIso(),
    },
    {
      id: uid('j'),
      title: '跨端开发工程师 (Flutter/RN)',
      location: '北京',
      description: '负责移动端与跨端业务开发，基于 Flutter / React Native 构建高性能应用。',
      requirements: '1. 熟悉 Dart 或 TypeScript；\n2. 有跨端框架实战经验；\n3. 理解原生与跨端桥接机制。',
      category_code: 'RND_MOBILE',
      status: 'PUBLISHED',
      job_type: 'SOCIAL',
      headcount: 2,
      salary_negotiable: false,
      salary_min_k: 20,
      salary_max_k: 38,
      department: '移动端与跨端',
      experience_req: '1-3',
      education_req: 'bachelor',
      urgency: 'MEDIUM',
      created_by: hrId,
      published_at: nowIso(),
      created_at: nowIso(),
      updated_at: nowIso(),
    },
  ];

  const j1 = jobs[0].id;
  const j2 = jobs[1].id;
  const j3 = jobs[2].id;
  const appA: StoredApplication = {
    id: uid('a'),
    candidate_id: candidates[0].id,
    job_id: j1,
    resume_id: resumes[candidates[0].id].id,
    current_stage: 'SCREENING',
    status: 'ACTIVE',
    ai_score: 88,
    applied_at: nowIso(),
  };
  const appB: StoredApplication = {
    id: uid('a'),
    candidate_id: candidates[1].id,
    job_id: j1,
    resume_id: resumes[candidates[1].id].id,
    current_stage: 'FIRST_INTERVIEW',
    status: 'ACTIVE',
    ai_score: 76,
    applied_at: nowIso(),
  };
  const appC: StoredApplication = {
    id: uid('a'),
    candidate_id: candidates[2].id,
    job_id: j2,
    resume_id: resumes[candidates[2].id].id,
    current_stage: 'APPLIED',
    status: 'ACTIVE',
    ai_score: 64,
    applied_at: nowIso(),
  };

  // --- Richer demo data for kanban & matrix views ---
  // Candidates[3..8] apply to the 3 jobs across 6 stages so each kanban column
  // and matrix cell has a real card.
  const stageMatrix: Array<{ stage: string; aiScore: number; jobIdx: 0 | 1 | 2; round?: 'FIRST' | 'SECOND' | 'HR' }> = [
    { stage: 'SCREENING', aiScore: 91, jobIdx: 0 }, // 陆天宇 → 产品设计师, but we route to j1 since j3 is DRAFT
    { stage: 'FIRST_INTERVIEW', aiScore: 89, jobIdx: 0, round: 'FIRST' },
    { stage: 'SECOND_INTERVIEW', aiScore: 94, jobIdx: 0, round: 'SECOND' },
    { stage: 'FINAL_REVIEW', aiScore: 98, jobIdx: 1, round: 'HR' },
    { stage: 'HIRED', aiScore: 99, jobIdx: 1 },
  ];
  // Use jobs[1] (后端 Python) for second row so the matrix shows multiple columns.
  const richApplications: StoredApplication[] = [];
  const interviewDetailList: InterviewDetail[] = [];
  for (let i = 0; i < stageMatrix.length; i++) {
    const meta = stageMatrix[i];
    const candidate = candidates[3 + i];
    const jobId = [j1, j1, j1, j2, j2][i];
    const app: StoredApplication = {
      id: uid('a'),
      candidate_id: candidate.id,
      job_id: jobId,
      resume_id: resumes[candidate.id].id,
      current_stage: meta.stage,
      status: meta.stage === 'HIRED' ? 'HIRED' : 'ACTIVE',
      ai_score: meta.aiScore,
      applied_at: new Date(Date.now() - 86400000 * (i + 1)).toISOString(),
    };
    richApplications.push(app);
    if (meta.round) {
      interviewDetailList.push({
        id: uid('i'),
        application_id: app.id,
        interviewer_id: interviewerId,
        round_type: meta.round,
        scheduled_at: new Date(Date.now() + 86400000 * (i + 1)).toISOString(),
        duration_minutes: 60,
        method: '视频面试',
        meeting_url: 'https://meet.demo.com/room/' + app.id,
        status: 'SCHEDULED',
        note: '请提前 5 分钟进入会议室',
        candidate_name: candidate.name,
        job_title: jobs[meta.jobIdx].title,
        interviewer_name: '示例面试官',
      });
    }
  }

  const agent_results: Record<string, AgentResult> = {
    [appA.id]: mkAgent(appA.id, 88, 'RECOMMEND'),
    [appB.id]: mkAgent(appB.id, 76, 'CONSIDER'),
    [appC.id]: mkAgent(appC.id, 64, 'CONSIDER'),
    ...Object.fromEntries(
      richApplications.map((a) => [a.id, mkAgent(a.id, a.ai_score ?? 0, a.ai_score && a.ai_score >= 85 ? 'RECOMMEND' : 'CONSIDER')]),
    ),
  };

  const interview1: InterviewDetail = {
    id: uid('i'),
    application_id: appB.id,
    interviewer_id: interviewerId,
    round_type: 'FIRST',
    scheduled_at: new Date(Date.now() + 86400000 * 2).toISOString(),
    duration_minutes: 60,
    method: '视频面试',
    meeting_url: 'https://meet.demo.com/room/abc',
    status: 'SCHEDULED',
    note: '请提前准备项目介绍',
    candidate_name: '李四',
    job_title: '前端工程师',
    interviewer_name: '示例面试官',
  };
  const feedbacks: Record<string, InterviewFeedback> = {
    [interview1.id]: {
      id: uid('f'),
      interview_id: interview1.id,
      interviewer_id: interviewerId,
      professional_score: 4,
      project_score: 4,
      communication_score: 5,
      strengths: '项目经验扎实，沟通顺畅',
      weaknesses: '对底层原理掌握一般',
      summary: '适合进入下一轮',
      recommendation: 'PASS',
    },
  };

  const jobCategories: JobCategory[] = [
    mkCategory('RND', '研发', null, 1, ownerZhangId),
    mkCategory('OPS', '运营', null, 2, ownerHeId),
    mkCategory('PRODUCT', '产品', null, 3),
    mkCategory('MARKET', '市场', null, 4),
    mkCategory('FUNCTION', '职能', null, 5),
    mkCategory('RND_FE', '前端', 'RND', 1, ownerZhangId),
    mkCategory('RND_BE', '后端', 'RND', 2, ownerLiId),
    mkCategory('RND_AI', '算法与AI', 'RND', 3, ownerZhouId),
    mkCategory('RND_MOBILE', '移动端与跨端', 'RND', 4, ownerSongId),
  ];

  const announcements: Announcement[] = [
    {
      id: uid('an'),
      type: 'DYNAMIC',
      title: '2026 春季校招正式启动',
      content: '本轮校招覆盖研发、产品、运营等多个方向，欢迎投递！',
      status: 'PUBLISHED',
      pinned: true,
      published_at: nowIso(),
      created_by: hrId,
      created_at: nowIso(),
      updated_at: nowIso(),
    },
  ];

  return {
    users,
    passwords: {
      [hrId]: 'demo1234',
      [interviewerId]: 'demo1234',
      [adminId]: 'demo1234',
      [ownerZhangId]: 'demo1234',
      [ownerHeId]: 'demo1234',
      [ownerLiId]: 'demo1234',
      [ownerZhouId]: 'demo1234',
      [ownerSongId]: 'demo1234',
      [c1]: 'demo1234',
      [c2]: 'demo1234',
      [c3]: 'demo1234',
    },
    candidates,
    resumes,
    jobs,
    jobCategories,
    announcements,
    applications: [appA, appB, appC, ...richApplications],
    agent_results,
    interviews: [interview1, ...interviewDetailList],
    feedbacks,
  };
}

function mkCategory(
  code: string,
  name: string,
  parent_code: string | null,
  sort_order: number,
  owner_id: string | null = null,
): JobCategory {
  return {
    id: uid('cat'),
    code,
    name,
    parent_code,
    sort_order,
    owner_id,
    created_at: nowIso(),
    updated_at: nowIso(),
  };
}

function mkAgent(appId: string, score: number, rec: AgentResult['recommendation']): AgentResult {
  return {
    id: uid('ag'),
    application_id: appId,
    score,
    summary:
      score >= 80
        ? '整体与岗位高度匹配，建议优先跟进。'
        : '基本匹配，存在部分能力缺口，可进入面试进一步评估。',
    strengths: ['具备相关技术栈经验', '有完整项目经历'],
    gaps: ['缺少岗位要求的个别深层经验'],
    recommendation: rec,
    status: 'DONE',
  };
}

function load(): Db {
  return loadMockDb(seed);
}

function withStats(db: Db, job: Job): JobWithStats {
  const stage_counts: Record<string, number> = {};
  let applications_total = 0;
  for (const a of db.applications) {
    if (a.job_id === job.id) {
      applications_total += 1;
      const stage = a.current_stage;
      stage_counts[stage] = (stage_counts[stage] || 0) + 1;
    }
  }
  return { ...job, applications_total, stage_counts };
}

function enrichCategories(db: Db): JobCategory[] {
  const userMap = new Map(db.users.map((u) => [u.id, u]));
  const jobCounts = new Map<string, number>();
  const jobHeadcounts = new Map<string, number>();
  for (const j of db.jobs) {
    if (j.status !== 'PUBLISHED') continue;
    const code = j.category_code || '';
    jobCounts.set(code, (jobCounts.get(code) || 0) + 1);
    jobHeadcounts.set(code, (jobHeadcounts.get(code) || 0) + (j.headcount || 0));
  }

  const nodeMap = new Map<string, { cat: JobCategory; children: string[] }>();
  for (const cat of db.jobCategories) {
    nodeMap.set(cat.code, { cat, children: [] });
  }
  for (const cat of db.jobCategories) {
    if (cat.parent_code && nodeMap.has(cat.parent_code)) {
      nodeMap.get(cat.parent_code)!.children.push(cat.code);
    }
  }

  const collectCodes = (code: string, acc: Set<string>) => {
    acc.add(code);
    const node = nodeMap.get(code);
    if (!node) return;
    for (const childCode of node.children) {
      collectCodes(childCode, acc);
    }
  };

  const sorted = [...db.jobCategories].sort(
    (a, b) => a.sort_order - b.sort_order || a.name.localeCompare(b.name, 'zh-Hans-CN'),
  );

  return sorted.map((cat) => {
    const codes = new Set<string>();
    collectCodes(cat.code, codes);
    let open_job_count = 0;
    let total_headcount = 0;
    codes.forEach((code) => {
      open_job_count += jobCounts.get(code) || 0;
      total_headcount += jobHeadcounts.get(code) || 0;
    });
    const owner = cat.owner_id ? userMap.get(cat.owner_id) : undefined;
    const child_count = nodeMap.get(cat.code)?.children.length || 0;
    return {
      ...cat,
      owner_name: owner?.name || null,
      owner_title: owner?.title || null,
      open_job_count,
      total_headcount,
      child_count,
    };
  });
}

function buildDetail(db: Db, app: StoredApplication): AdminApplicationDetail {
  const cand = db.candidates.find((c) => c.id === app.candidate_id)!;
  const job = db.jobs.find((j) => j.id === app.job_id)!;
  const interviews = db.interviews
    .filter((i) => i.application_id === app.id)
    .map((i) => ({ ...i, feedback: db.feedbacks[i.id] }));
  return {
    id: app.id,
    candidate_id: app.candidate_id,
    job_id: app.job_id,
    resume_id: app.resume_id,
    current_stage: app.current_stage as AdminApplicationDetail['current_stage'],
    status: app.status as AdminApplicationDetail['status'],
    ai_score: app.ai_score,
    applied_at: app.applied_at,
    candidate: { name: cand.name, email: cand.email, phone: cand.phone, city: cand.city },
    job,
    resume: db.resumes[app.candidate_id] || null,
    agent_result: db.agent_results[app.id] || null,
    interviews,
    stage_history: db.stage_history?.[app.id] || [],
    candidate_profile_snapshot: null,
    job_type_snapshot: null,
  };
}

function addHistory(
  db: Db,
  app: StoredApplication,
  fromStage: Stage | null,
  toStage: Stage | null,
  action: StageHistory['action'],
  reason: string,
) {
  db.stage_history ||= {};
  db.stage_history[app.id] ||= [];
  const operator = db.users.find((u) => u.id === currentUserId());
  db.stage_history[app.id].push({
    id: uid('h'),
    from_stage: fromStage,
    to_stage: toStage,
    action,
    reason,
    changed_by: operator?.id,
    changed_by_name: operator?.name || '系统',
    created_at: nowIso(),
  });
}

export const mockApi: ApiClient = {
  async login(input) {
    const db = load();
    const user = findUser(db, input.email);
    if (!user || db.passwords[user.id] !== input.password) throw new Error('邮箱或密码错误');
    return delay({ access_token: 'mock-' + user.id, token_type: 'bearer', user });
  },
  async me() {
    const db = load();
    const user = db.users.find((u) => u.id === currentUserId());
    if (!user) throw new Error('未登录');
    return delay(user);
  },
  async dashboardSummary() {
    const today = new Date().toLocaleDateString('zh-CN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    });
    const weekday = ['星期日', '星期一', '星期二', '星期三', '星期四', '星期五', '星期六'][new Date().getDay()];
    const summary: DashboardSummary = {
      greeting: '下午好，',
      today_text: `${today} ${weekday}`,
      recruiting_status:
        '今日共有 4 场面试待开展、1 份新投递简历待初筛，目前全公司共有 5 个在招职位（18 HC）正在推进。',
      stats: {
        pending_resume_count: 1,
        today_interview_count: 4,
        pending_offer_count: 1,
        active_job_count: 5,
        open_headcount: 18,
      },
      interviews: [
        {
          id: 'iv-1',
          application_id: 'app-1',
          candidate_name: '沈思远',
          job_title: '前端工程师',
          interviewer_name: '示例 HR',
          round_type: 'FIRST',
          round_label: '专业初试',
          scheduled_at: new Date().toISOString(),
          duration_minutes: 60,
          time_range: '15:00 - 16:00',
          method: '线上视频',
          meeting_url: 'https://meeting.example.com/1',
        },
        {
          id: 'iv-2',
          application_id: 'app-2',
          candidate_name: '沈思远',
          job_title: '前端工程师',
          interviewer_name: '张威（技术VP）',
          round_type: 'SECOND',
          round_label: '技术复试',
          scheduled_at: new Date().toISOString(),
          duration_minutes: 60,
          time_range: '14:30 - 15:30',
          method: '线上视频',
          meeting_url: 'https://meeting.example.com/2',
        },
        {
          id: 'iv-3',
          application_id: 'app-3',
          candidate_name: '程梦',
          job_title: '后端工程师（Python）',
          interviewer_name: '示例 HR',
          round_type: 'HR',
          round_label: 'HR终面',
          scheduled_at: new Date().toISOString(),
          duration_minutes: 60,
          time_range: '16:00 - 17:00',
          method: '线上视频',
          meeting_url: 'https://meeting.example.com/3',
        },
        {
          id: 'iv-4',
          application_id: 'app-4',
          candidate_name: '黄诗雨',
          job_title: '算法工程师',
          interviewer_name: '李雷（算法总监）',
          round_type: 'FIRST',
          round_label: '专业初试',
          scheduled_at: new Date().toISOString(),
          duration_minutes: 60,
          time_range: '10:00 - 11:00',
          method: '线上视频',
          meeting_url: 'https://meeting.example.com/4',
        },
      ],
      urgent_jobs: [
        {
          id: 'j-urgent-1',
          title: '前端工程师',
          department: '研发中心',
          salary_min_k: 22,
          salary_max_k: 35,
          salary_negotiable: false,
          salary_text: '22k-35k',
          headcount: 3,
          applications_total: 48,
        },
        {
          id: 'j-urgent-2',
          title: '后端工程师（Python）',
          department: '研发中心',
          salary_min_k: 25,
          salary_max_k: 45,
          salary_negotiable: false,
          salary_text: '25k-45k',
          headcount: 2,
          applications_total: 62,
        },
        {
          id: 'j-urgent-3',
          title: '大模型算法工程师',
          department: '人工智能实验室',
          salary_min_k: 40,
          salary_max_k: 70,
          salary_negotiable: false,
          salary_text: '40k-70k',
          headcount: 1,
          applications_total: 79,
        },
      ],
    };
    return delay(summary);
  },

  async adminListJobs() {
    const db = load();
    return delay(db.jobs.map((j) => withStats(db, j)));
  },
  async adminGetJob(id) {
    const db = load();
    const job = db.jobs.find((j) => j.id === id);
    if (!job) throw new Error('岗位不存在');
    return delay(withStats(db, job));
  },
  async adminCreateJob(data: JobInput) {
    const db = load();
    const job: Job = {
      id: uid('j'),
      ...data,
      department: data.department || '',
      urgency: data.urgency || 'MEDIUM',
      status: 'DRAFT',
      created_by: currentUserId(),
      published_at: null,
      created_at: nowIso(),
      updated_at: nowIso(),
    };
    db.jobs.push(job);
    save(db);
    return delay(withStats(db, job));
  },
  async adminUpdateJob(id, data: JobInput) {
    const db = load();
    const job = db.jobs.find((j) => j.id === id);
    if (!job) throw new Error('岗位不存在');
    Object.assign(job, data, { updated_at: nowIso() });
    save(db);
    return delay(withStats(db, job));
  },
  async adminPublishJob(id) {
    const db = load();
    const job = db.jobs.find((j) => j.id === id);
    if (!job) throw new Error('岗位不存在');
    job.status = 'PUBLISHED';
    job.published_at = nowIso();
    job.updated_at = nowIso();
    save(db);
    return delay(withStats(db, job));
  },
  async adminCloseJob(id) {
    const db = load();
    const job = db.jobs.find((j) => j.id === id);
    if (!job) throw new Error('岗位不存在');
    job.status = 'CLOSED';
    job.updated_at = nowIso();
    save(db);
    return delay(withStats(db, job));
  },

  // ---- Job categories ----
  async listJobCategories() {
    return delay(load().jobCategories);
  },
  async adminListJobCategories() {
    const db = load();
    return delay(enrichCategories(db));
  },
  async adminCreateJobCategory(data: JobCategoryInput) {
    const db = load();
    if (db.jobCategories.some((c) => c.code === data.code)) throw new Error('方向编码已存在');
    const cat = mkCategory(
      data.code,
      data.name,
      data.parent_code ?? null,
      data.sort_order ?? 0,
      data.owner_id ?? null,
    );
    db.jobCategories.push(cat);
    save(db);
    return delay(enrichCategories(db).find((c) => c.code === cat.code)!);
  },
  async adminUpdateJobCategory(code, data: JobCategoryInput) {
    const db = load();
    const cat = db.jobCategories.find((c) => c.code === code);
    if (!cat) throw new Error('方向不存在');
    if (code !== data.code && db.jobCategories.some((c) => c.code === data.code))
      throw new Error('方向编码已存在');
    cat.code = data.code;
    cat.name = data.name;
    cat.parent_code = data.parent_code ?? null;
    cat.sort_order = data.sort_order ?? 0;
    cat.owner_id = data.owner_id ?? null;
    cat.updated_at = nowIso();
    save(db);
    return delay(enrichCategories(db).find((c) => c.code === cat.code)!);
  },
  async adminDeleteJobCategory(code) {
    const db = load();
    const cat = db.jobCategories.find((c) => c.code === code);
    if (!cat) throw new Error('方向不存在');
    if (db.jobCategories.some((c) => c.parent_code === code))
      throw new Error('该方向下还有子方向，无法删除');
    if (db.jobs.some((j) => j.category_code === code))
      throw new Error('该方向下还有岗位，无法删除');
    db.jobCategories = db.jobCategories.filter((c) => c.code !== code);
    save(db);
    return delay(undefined);
  },

  // ---- Direction owners ----
  async adminListDirectionOwners() {
    const db = load();
    return delay(db.users.filter((u) => u.role === 'DIRECTION_OWNER' && u.status === 'ACTIVE'));
  },

  // ---- Announcements ----
  async listAnnouncements(params) {
    const db = load();
    let list = db.announcements.filter((a) => a.status === 'PUBLISHED');
    if (params?.type) list = list.filter((a) => a.type === params.type);
    list = list
      .slice()
      .sort(
        (a, b) =>
          Number(b.pinned) - Number(a.pinned) ||
          (b.published_at || '').localeCompare(a.published_at || ''),
      );
    return delay(list);
  },
  async getAnnouncement(id) {
    const db = load();
    const a = db.announcements.find((x) => x.id === id);
    if (!a || a.status !== 'PUBLISHED') throw new Error('动态不存在');
    return delay(a);
  },
  async adminListAnnouncements(params) {
    const db = load();
    let list = db.announcements.slice();
    if (params?.type) list = list.filter((a) => a.type === params.type);
    list = list
      .slice()
      .sort(
        (a, b) =>
          Number(b.pinned) - Number(a.pinned) ||
          (b.created_at || '').localeCompare(a.created_at || ''),
      );
    return delay(list);
  },
  async adminGetAnnouncement(id) {
    const db = load();
    const a = db.announcements.find((x) => x.id === id);
    if (!a) throw new Error('动态不存在');
    return delay(a);
  },
  async adminCreateAnnouncement(data: AnnouncementInput) {
    const db = load();
    const a: Announcement = {
      id: uid('an'),
      type: data.type || 'NOTICE',
      title: data.title,
      content: data.content || '',
      status: 'DRAFT',
      pinned: data.pinned || false,
      published_at: null,
      created_by: currentUserId(),
      created_at: nowIso(),
      updated_at: nowIso(),
    };
    db.announcements.push(a);
    save(db);
    return delay(a);
  },
  async adminUpdateAnnouncement(id, data: AnnouncementInput) {
    const db = load();
    const a = db.announcements.find((x) => x.id === id);
    if (!a) throw new Error('动态不存在');
    a.type = data.type || a.type;
    a.title = data.title;
    a.content = data.content || '';
    a.pinned = data.pinned || false;
    a.updated_at = nowIso();
    save(db);
    return delay(a);
  },
  async adminDeleteAnnouncement(id) {
    const db = load();
    db.announcements = db.announcements.filter((x) => x.id !== id);
    save(db);
    return delay(undefined);
  },
  async adminPublishAnnouncement(id) {
    const db = load();
    const a = db.announcements.find((x) => x.id === id);
    if (!a) throw new Error('动态不存在');
    a.status = 'PUBLISHED';
    a.published_at = nowIso();
    a.updated_at = nowIso();
    save(db);
    return delay(a);
  },
  async adminCloseAnnouncement(id) {
    const db = load();
    const a = db.announcements.find((x) => x.id === id);
    if (!a) throw new Error('动态不存在');
    a.status = 'CLOSED';
    a.updated_at = nowIso();
    save(db);
    return delay(a);
  },

  async adminListApplications(params) {
    const db = load();
    let list = db.applications.slice();
    if (params?.job_id) list = list.filter((a) => a.job_id === params.job_id);
    if (params?.stage) list = list.filter((a) => a.current_stage === params.stage);
    const out: AdminApplication[] = list.map((a) => {
      const resume = db.resumes[a.candidate_id];
      const parsed = resume?.parsed_data;
      const edu = parsed?.education?.[0];
      const work = parsed?.work_experience?.[0];
      const skills = (parsed?.skills ?? []).slice(0, 4);
      const nextInterview = db.interviews
        .filter((iv) => iv.application_id === a.id && iv.status === 'SCHEDULED')
        .sort((x, y) => +new Date(x.scheduled_at) - +new Date(y.scheduled_at))[0];
      const interviewer = nextInterview
        ? db.users.find((u) => u.id === nextInterview.interviewer_id)
        : undefined;
      const degreeMap: Record<string, string> = {
        BACHELOR: '本科',
        MASTER: '硕士',
        DOCTOR: '博士',
        ASSOCIATE: '大专',
      };
      return {
        id: a.id,
        candidate_id: a.candidate_id,
        job_id: a.job_id,
        current_stage: a.current_stage as AdminApplication['current_stage'],
        status: a.status as AdminApplication['status'],
        ai_score: a.ai_score,
        applied_at: a.applied_at,
        candidate_name: db.candidates.find((c) => c.id === a.candidate_id)?.name ?? '',
        job_title: db.jobs.find((j) => j.id === a.job_id)?.title ?? '',
        latest_company: work?.company ?? '',
        latest_school: edu?.school ?? '',
        latest_degree: degreeMap[edu?.degree ?? ''] ?? edu?.degree ?? '',
        skills,
        next_interview_at: nextInterview?.scheduled_at ?? null,
        next_interview_round: nextInterview?.round_type ?? '',
        next_interviewer_name: interviewer?.name ?? '',
      };
    });
    return delay(out);
  },
  async adminGetApplication(id) {
    const db = load();
    const app = db.applications.find((a) => a.id === id);
    if (!app) throw new Error('申请不存在');
    return delay(buildDetail(db, app));
  },
  async adminNextStage(id, reason) {
    const db = load();
    const app = db.applications.find((a) => a.id === id);
    if (!app) throw new Error('申请不存在');
    const idx = STAGE_ORDER.indexOf(app.current_stage as Stage);
    if (idx < 0 || idx >= STAGE_ORDER.length - 1) throw new Error('已处于最终阶段，无法继续推进');
    const next = STAGE_ORDER[idx + 1];
    addHistory(db, app, app.current_stage as Stage, next, 'ADVANCE', reason);
    app.current_stage = next;
    if (next === 'HIRED') app.status = 'HIRED';
    save(db);
    return delay(buildDetail(db, app));
  },
  async adminTransition(id, targetStage, reason) {
    const db = load();
    const app = db.applications.find((a) => a.id === id);
    if (!app) throw new Error('申请不存在');
    const action =
      STAGE_ORDER.indexOf(targetStage) > STAGE_ORDER.indexOf(app.current_stage as Stage)
        ? 'ADVANCE'
        : 'RETURN';
    addHistory(db, app, app.current_stage as Stage, targetStage, action, reason);
    app.current_stage = targetStage;
    if (targetStage === 'HIRED') app.status = 'HIRED';
    save(db);
    return delay(buildDetail(db, app));
  },
  async adminAddCandidateTag(candidateId, tagId) {
    // Mock: talent tag assignment is a no-op for offline demo.
    return delay({ ok: true, candidate_id: candidateId, tag_id: tagId });
  },
  async adminHold(id, reason) {
    const db = load();
    const app = db.applications.find((a) => a.id === id);
    if (!app) throw new Error('申请不存在');
    addHistory(db, app, app.current_stage as Stage, null, 'HOLD', reason);
    app.status = 'ON_HOLD';
    save(db);
    return delay(buildDetail(db, app));
  },
  async adminResume(id, reason) {
    const db = load();
    const app = db.applications.find((a) => a.id === id);
    if (!app) throw new Error('申请不存在');
    addHistory(db, app, null, app.current_stage as Stage, 'RESUME', reason);
    app.status = 'ACTIVE';
    save(db);
    return delay(buildDetail(db, app));
  },
  async adminReject(id, reason) {
    const db = load();
    const app = db.applications.find((a) => a.id === id);
    if (!app) throw new Error('申请不存在');
    addHistory(db, app, app.current_stage as Stage, 'REJECTED', 'REJECT', reason);
    app.current_stage = 'REJECTED';
    app.status = 'REJECTED';
    save(db);
    return delay(buildDetail(db, app));
  },
  async adminAgentResult(id) {
    const db = load();
    let r = db.agent_results[id];
    if (!r) {
      const app = db.applications.find((a) => a.id === id)!;
      r = mkAgent(id, app.ai_score ?? 70, (app.ai_score ?? 70) >= 80 ? 'RECOMMEND' : 'CONSIDER');
      db.agent_results[id] = r;
      save(db);
    }
    return delay(r);
  },
  async adminAgentRerun(id) {
    const db = load();
    const app = db.applications.find((a) => a.id === id)!;
    const score = 60 + Math.floor(Math.random() * 36);
    const r = mkAgent(id, score, score >= 80 ? 'RECOMMEND' : 'CONSIDER');
    db.agent_results[id] = r;
    app.ai_score = score;
    save(db);
    return delay(r);
  },
  async adminDownloadResume(id) {
    const db = load();
    const app = db.applications.find((a) => a.id === id);
    const resume = app ? db.resumes[app.resume_id] : undefined;
    const filename = resume?.file_name || 'resume.pdf';
    const blob = new Blob(['mock resume content'], { type: 'application/pdf' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  },
  async adminResumeBlob() {
    return new Blob(['mock resume content'], { type: 'application/pdf' });
  },

  async adminCreateInterview(data: InterviewInput) {
    const db = load();
    const app = db.applications.find((a) => a.id === data.application_id)!;
    const cand = db.candidates.find((c) => c.id === app.candidate_id)!;
    const job = db.jobs.find((j) => j.id === app.job_id)!;
    const interviewer = db.users.find((u) => u.id === data.interviewer_id)!;
    const it: InterviewDetail = {
      id: uid('i'),
      ...data,
      status: 'SCHEDULED',
      candidate_name: cand.name,
      job_title: job.title,
      interviewer_name: interviewer.name,
    };
    db.interviews.push(it);
    save(db);
    return delay(it);
  },
  async adminListInterviews() {
    return delay(load().interviews);
  },
  async adminGetInterview(id) {
    const db = load();
    const it = db.interviews.find((i) => i.id === id);
    if (!it) throw new Error('面试不存在');
    return delay({ ...it, feedback: db.feedbacks[id] });
  },
  async adminUpdateInterview(id, data) {
    const db = load();
    const it = db.interviews.find((i) => i.id === id);
    if (!it) throw new Error('面试不存在');
    Object.assign(it, data);
    save(db);
    return delay(it);
  },
  async adminCancelInterview(id) {
    const db = load();
    const it = db.interviews.find((i) => i.id === id);
    if (!it) throw new Error('面试不存在');
    it.status = 'CANCELLED';
    save(db);
    return delay(it);
  },
  async adminListInterviewers() {
    return delay(load().users.filter((u) => u.role === 'INTERVIEWER'));
  },

  async interviewerListInterviews() {
    const db = load();
    const me = currentUserId();
    return delay(db.interviews.filter((i) => i.interviewer_id === me));
  },
  async interviewerGetInterview(id) {
    const db = load();
    const it = db.interviews.find((i) => i.id === id);
    if (!it) throw new Error('面试不存在');
    return delay({ ...it, feedback: db.feedbacks[id] });
  },
  async interviewerFeedback(id, data: FeedbackInput) {
    const db = load();
    const it = db.interviews.find((i) => i.id === id);
    if (!it) throw new Error('面试不存在');
    const fb: InterviewFeedback = {
      id: db.feedbacks[id]?.id || uid('f'),
      interview_id: id,
      interviewer_id: it.interviewer_id,
      ...data,
    };
    db.feedbacks[id] = fb;
    it.status = 'PENDING_HR_REVIEW';
    save(db);
    return delay(fb);
  },

  async adminConfirmFeedback(id, data: FeedbackConfirmIn) {
    const db = load();
    const it = db.interviews.find((i) => i.id === id);
    if (!it) throw new Error('面试不存在');
    if (!db.feedbacks[id]) throw new Error('面试尚未提交面评，无法确认');
    it.status = 'COMPLETED';
    save(db);
    return delay({ ...it, feedback: db.feedbacks[id] });
  },

  async listUsers() {
    return delay(load().users);
  },
  async createUser(data: { email: string; name: string; role: Role; password: string }) {
    const db = load();
    if (findUser(db, data.email)) throw new Error('邮箱已存在');
    const user: User = {
      id: uid('u'),
      email: data.email,
      name: data.name,
      role: data.role,
      status: 'ACTIVE',
      created_at: nowIso(),
    };
    db.users.push(user);
    db.passwords[user.id] = data.password;
    save(db);
    return delay(user);
  },
  async updateUser(id, data) {
    const db = load();
    const user = db.users.find((u) => u.id === id);
    if (!user) throw new Error('用户不存在');
    if (data.name !== undefined) user.name = data.name;
    if (data.email !== undefined) user.email = data.email;
    if (data.role !== undefined) user.role = data.role;
    if (data.status !== undefined) user.status = data.status;
    if (data.password) db.passwords[id] = data.password;
    save(db);
    return delay(user);
  },

  // Reports: must implement so VITE_USE_MOCK=true doesn't crash on ReportsPage
  // (was previously undefined -> "Cannot read properties of undefined (reading 'then')").
  // Numbers mirror the screenshot for visual continuity across mock/real switches.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  async report(name: string): Promise<any> {
    if (name === 'funnel') {
      return delay({
        total: 540,
        rejected: 0,
        stages: [
          { stage: 'APPLIED',          display_label: '简历投递量',   count: 540, percent_of_total: 1.0000, conversion_rate: 1.0000, average_hours: 0 },
          { stage: 'SCREENING',        display_label: '简历初筛',     count: 300, percent_of_total: 0.5556, conversion_rate: 0.5556, average_hours: 12 },
          { stage: 'SCREENING_PASSED', display_label: '初筛通过',     count: 198, percent_of_total: 0.3667, conversion_rate: 0.6600, average_hours: 24 },
          { stage: 'FIRST_INTERVIEW',  display_label: '安排专业面试', count:  82, percent_of_total: 0.1519, conversion_rate: 0.4141, average_hours: 72 },
          { stage: 'SECOND_INTERVIEW', display_label: '面试通过',     count:  28, percent_of_total: 0.0519, conversion_rate: 0.3415, average_hours: 72 },
          { stage: 'OFFERS_SENT',      display_label: '发出 Offer',   count:  14, percent_of_total: 0.0259, conversion_rate: 0.5000, average_hours: 48 },
          { stage: 'HIRED',            display_label: '最终入职',     count:  11, percent_of_total: 0.0204, conversion_rate: 0.7857, average_hours: 120 },
        ],
      });
    }
    if (name === 'channels') {
      return delay([
        { code: 'BOSS',        name: 'BOSS直聘', applications: 260, interviewed: 60, offers_sent: 8, offers_accepted: 5, hire_rate: 0.0192 },
        { code: 'REFERRAL',    name: '员工内推', applications: 120, interviewed: 35, offers_sent: 5, offers_accepted: 4, hire_rate: 0.0333 },
        { code: 'AGENCY',      name: '猎头机构', applications:  75, interviewed: 18, offers_sent: 3, offers_accepted: 2, hire_rate: 0.0267 },
        { code: 'CAREER_SITE', name: '官网招聘', applications:  55, interviewed: 10, offers_sent: 0, offers_accepted: 0, hire_rate: 0.0000 },
        { code: 'CAMPUS',      name: '校园宣讲', applications:  30, interviewed:  5, offers_sent: 0, offers_accepted: 0, hire_rate: 0.0000 },
      ]);
    }
    if (name === 'workload') return delay([]);
    if (name === 'job-cycles') return delay([]);
    return delay({});
  },
};
