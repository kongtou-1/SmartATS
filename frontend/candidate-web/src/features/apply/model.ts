import type {
  CandidateCertificate,
  CandidateEducation,
  CandidateExperience,
  CandidateLanguage,
  CandidateProfile,
  CandidateProject,
  Resume,
} from '../../types';

export const APPLY_STEPS = [
  { title: '基本信息' },
  { title: '教育经历' },
  { title: '实践经历' },
  { title: '补充资料与简历' },
  { title: '确认提交' },
] as const;

export const blankProfile: CandidateProfile = {
  name: '',
  phone: '',
  contact_email: '',
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
  gender: '',
  birth_year: '',
  city: '',
  current_status: '',
  current_title: '',
  current_company: '',
  years_experience: '',
  expected_salary: '',
};

export const createEducation = (): CandidateEducation => ({
  start: '',
  end: '',
  education_type: 'FULL_TIME',
  school: '',
  degree: 'BACHELOR',
  college: '',
  major: '',
  laboratory: '',
  direction: '',
  advisor: '',
});

export const createExperience = (): CandidateExperience => ({
  company: '',
  title: '',
  start: '',
  end: '',
  current: false,
  description: '',
});

export const createProject = (): CandidateProject => ({
  name: '',
  role: '',
  start: '',
  end: '',
  current: false,
  description: '',
});

export const createLanguage = (): CandidateLanguage => ({
  language: '',
  proficiency: '',
  exam: '',
  score: '',
});

export const createCertificate = (): CandidateCertificate => ({
  name: '',
  issuer: '',
  obtained_at: '',
});

export type ProfileListKey =
  'education' | 'internships' | 'work_experiences' | 'projects' | 'languages' | 'certificates';

export type ChangeProfile = <K extends keyof CandidateProfile>(
  key: K,
  value: CandidateProfile[K],
) => void;

export type UpdateProfileList = <K extends ProfileListKey>(
  key: K,
  index: number,
  value: CandidateProfile[K][number],
) => void;

export function validateApplyStep(
  profile: CandidateProfile,
  resume: Resume | null,
  step: number,
): string {
  if (step === 0) {
    const missing: string[] = [];
    if (!profile.name.trim()) missing.push('姓名');
    if (!profile.phone.trim()) missing.push('手机号码');
    if (!profile.contact_email.trim()) missing.push('邮箱');
    if (!profile.identity_type) missing.push('个人证件');
    if (!profile.identity_number_set && !profile.identity_number?.trim()) missing.push('证件号码');
    if (!profile.preferred_locations.length) missing.push('期望工作地点');
    if (missing.length) return `请填写：${missing.join('、')}`;
  }

  if (step === 1) {
    if (!profile.education.length) return '请至少添加一段高中以上教育经历';
    for (const item of profile.education) {
      if (
        !item.start ||
        !item.end ||
        !item.education_type ||
        !item.school ||
        !item.degree ||
        !item.college ||
        !item.major
      ) {
        return '请完整填写教育经历必填项';
      }
      if (item.end < item.start) return '教育经历结束时间不能早于开始时间';
    }
  }

  if (step === 2) {
    const experienceGroups = [
      ['实习经历', profile.internships],
      ['工作经历', profile.work_experiences],
    ] as const;
    for (const [label, items] of experienceGroups) {
      for (const item of items) {
        if (
          !item.company ||
          !item.title ||
          !item.start ||
          (!item.current && !item.end) ||
          !item.description
        ) {
          return `请完整填写${label}`;
        }
        if (!item.current && item.end < item.start) return `${label}结束时间不能早于开始时间`;
      }
    }
    for (const item of profile.projects) {
      if (
        !item.name ||
        !item.role ||
        !item.start ||
        (!item.current && !item.end) ||
        !item.description
      ) {
        return '请完整填写项目经历';
      }
      if (!item.current && item.end < item.start) return '项目经历结束时间不能早于开始时间';
    }
  }

  if (step === 3) {
    for (const item of profile.languages) {
      if (!item.language.trim() || !item.proficiency.trim()) {
        return '已添加的语言能力需填写语种和熟练度';
      }
    }
    for (const item of profile.certificates) {
      if (!item.name.trim() || !item.issuer.trim() || !item.obtained_at) {
        return '已添加的证书需填写名称、颁发机构和取得时间';
      }
    }
    if (!resume) return '请上传 PDF、DOC 或 DOCX 简历';
  }

  return '';
}
