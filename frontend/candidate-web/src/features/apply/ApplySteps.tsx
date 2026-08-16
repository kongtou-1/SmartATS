import { useState, type ChangeEvent, type DragEvent } from 'react';
import type { CandidateProfile, Resume } from '../../types';
import {
  createCertificate,
  createEducation,
  createExperience,
  createLanguage,
  createProject,
  type ChangeProfile,
  type ProfileListKey,
  type UpdateProfileList,
} from './model';
import {
  Empty,
  EntryCard,
  ExperienceSection,
  Field,
  IconField,
  Month,
  RadioGroup,
  SectionHead,
  Select,
  Text,
  renderLabel,
} from './FormControls';

type CommonProps = {
  profile: CandidateProfile;
  change: ChangeProfile;
  updateList: UpdateProfileList;
  remove: (key: ProfileListKey, index: number) => void;
};

function getFileKind(name: string): string {
  const lower = name.toLowerCase();
  if (lower.endsWith('.pdf')) return 'pdf';
  if (lower.endsWith('.doc') || lower.endsWith('.docx')) return 'doc';
  return 'file';
}

function getFileBadge(name: string): string {
  const kind = getFileKind(name);
  if (kind === 'pdf') return 'PDF';
  if (kind === 'doc') return 'DOC';
  return 'FILE';
}

function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 KB';
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

function getStatusText(file: File | null, resume: Resume | null, uploading: boolean): string {
  if (uploading) return '上传中…';
  if (file) return '待上传';
  if (!resume) return '';
    switch (resume.parse_status) {
      case 'DONE':
        return '✓ 已就绪';
      case 'PARSING':
        return '解析中';
      case 'PENDING':
        return '已上传';
      case 'FAILED':
        return '解析失败';
      default:
        return resume.parse_status;
    }
}

function getStatusClass(file: File | null, resume: Resume | null, uploading: boolean): string {
  if (uploading) return 'parsing';
  if (file) return 'pending';
  if (!resume) return '';
  switch (resume.parse_status) {
    case 'DONE':
      return 'ready';
    case 'PARSING':
      return 'parsing';
    case 'FAILED':
      return 'error';
    default:
      return 'pending';
  }
}

const GENDER_LABELS: Record<string, string> = {
  MALE: '男',
  FEMALE: '女',
  OTHER: '其他',
  '': '未填写',
};

const STATUS_LABELS: Record<string, string> = {
  EMPLOYED_LOOKING: '在职 · 考虑好机会',
  EMPLOYED_PASSIVE: '在职 · 暂不考虑',
  UNEMPLOYED: '离职 · 正在找工作',
  GRADUATE: '应届生',
  FREELANCE: '自由职业',
  '': '未填写',
};

const YEARS_LABELS: Record<string, string> = {
  '0': '应届生 / 1年以下',
  '1-3': '1-3年',
  '3-5': '3-5年',
  '5-10': '5-10年',
  '10+': '10年以上',
  '': '未填写',
};

const IDENTITY_LABELS: Record<string, string> = {
  CN_ID: '中国居民身份证',
  PASSPORT: '护照',
  HK_MACAO_TAIWAN: '港澳台证件',
  OTHER: '其他',
  '': '未填写',
};

const EDU_TYPE_LABELS: Record<string, string> = {
  FULL_TIME: '全日制',
  PART_TIME: '非全日制',
  OTHER: '其他',
  '': '未填写',
};

const DEGREE_LABELS: Record<string, string> = {
  ASSOCIATE: '大专',
  BACHELOR: '本科',
  MASTER: '硕士',
  DOCTOR: '博士',
  OTHER_POST_SECONDARY: '其他高中以上学历',
  '': '未填写',
};

function labelMap(map: Record<string, string>, value?: string): string {
  if (value === undefined || value === null || value === '') return '未填写';
  return map[value] ?? value;
}

function rangeText(start: string, end: string, current?: boolean): string {
  if (current) return `${start || '—'} - 至今`;
  return `${start || '—'} - ${end || '—'}`;
}

export function BasicInfoStep({ profile, change }: Pick<CommonProps, 'profile' | 'change'>) {
  const genderOptions = [
    ['MALE', '男'],
    ['FEMALE', '女'],
  ] as const;

  const statusOptions = [
    ['EMPLOYED_LOOKING', '在职 · 考虑好机会'],
    ['EMPLOYED_PASSIVE', '在职 · 暂不考虑'],
    ['UNEMPLOYED', '离职 · 正在找工作'],
    ['GRADUATE', '应届生'],
    ['FREELANCE', '自由职业'],
  ] as const;

  const yearsOptions = [
    ['0', '应届生 / 1年以下'],
    ['1-3', '1-3年'],
    ['3-5', '3-5年'],
    ['5-10', '5-10年'],
    ['10+', '10年以上'],
  ] as const;

  return (
    <section className="form-section">
      <div className="form-group">
        <h3 className="group-title">
          <span className="group-icon">👤</span>
          个人基本资料
        </h3>
        <div className="form-grid three-col">
          <Field label="姓名 *" value={profile.name} onChange={(value) => change('name', value)} />
          <RadioGroup
            label="性别"
            value={profile.gender || ''}
            options={genderOptions}
            onChange={(value) => change('gender', value as typeof profile.gender)}
          />
          <IconField
            label="年龄 / 出生年"
            value={profile.birth_year || ''}
            placeholder="如 1997"
            onChange={(value) => change('birth_year', value)}
          />
          <IconField
            label="手机号码 *"
            value={profile.phone}
            onChange={(value) => change('phone', value)}
          />
          <IconField
            label="电子邮箱 *"
            type="email"
            value={profile.contact_email}
            onChange={(value) => change('contact_email', value)}
          />
          <IconField
            label="所在城市 / 期望工作地 *"
            value={profile.city || ''}
            placeholder="如 广东 · 深圳"
            onChange={(value) => change('city', value)}
          />
        </div>
      </div>

      <div className="form-group">
        <h3 className="group-title">
          <span className="group-icon">💼</span>
          求职意向与职业现状
        </h3>
        <div className="form-grid three-col">
          <Select
            label="当前求职状态"
            value={profile.current_status || ''}
            onChange={(value) => change('current_status', value)}
            options={statusOptions}
          />
          <IconField
            label="当前 / 最近职位"
            value={profile.current_title || ''}
            placeholder="如 资深前端工程师"
            onChange={(value) => change('current_title', value)}
          />
          <IconField
            label="当前 / 最近公司"
            value={profile.current_company || ''}
            placeholder="如 某头部互联网独角兽"
            onChange={(value) => change('current_company', value)}
          />
          <Select
            label="工作年限"
            value={profile.years_experience || ''}
            onChange={(value) => change('years_experience', value)}
            options={yearsOptions}
          />
          <IconField
            label="期望薪资"
            value={profile.expected_salary || ''}
            placeholder="如 28k-42k"
            onChange={(value) => change('expected_salary', value)}
          />
          <label className="field">
            <span>{renderLabel('个人证件 *')}</span>
            <select
              className="input"
              value={profile.identity_type}
              autoComplete="off"
              onChange={(event) => change('identity_type', event.target.value)}
            >
              <option value="" disabled={profile.identity_type !== ''}>
                请选择证件类型
              </option>
              <option value="CN_ID">中国居民身份证</option>
              <option value="PASSPORT">护照</option>
              <option value="HK_MACAO_TAIWAN">港澳台证件</option>
              <option value="OTHER">其他</option>
            </select>
          </label>
          <Field
            label={`证件号码 * ${profile.identity_number_set ? `（已保存 ${profile.identity_number_masked}，留空不修改）` : ''}`}
            value={profile.identity_number || ''}
            onChange={(value) => change('identity_number', value)}
          />
          <IconField
            label="期望工作地点 *（多个用逗号分隔）"
            value={profile.preferred_locations.join('，')}
            onChange={(value) =>
              change(
                'preferred_locations',
                value
                  .split(/[，,]/)
                  .map((item) => item.trim())
                  .filter(Boolean),
              )
            }
          />
        </div>
      </div>
    </section>
  );
}

export function EducationStep({ profile, change, updateList, remove }: CommonProps) {
  return (
    <section className="form-section">
      <SectionHead
        title="教育经历"
        hint="至少一段，大专及以上"
        onAdd={() => change('education', [...profile.education, createEducation()])}
      />
      {profile.education.length === 0 && <Empty text="暂无教育经历，请添加" />}
      {profile.education.map((item, index) => (
        <EntryCard
          title={`教育经历 ${index + 1}`}
          onRemove={() => remove('education', index)}
          key={index}
        >
          <div className="form-stack">
            <div className="form-row">
              <Month
                label="开始时间 *"
                value={item.start}
                onChange={(value) => updateList('education', index, { ...item, start: value })}
              />
              <Month
                label="结束/预计毕业 *"
                value={item.end}
                onChange={(value) => updateList('education', index, { ...item, end: value })}
              />
            </div>
            <Field
              label="学校 *"
              value={item.school}
              onChange={(value) => updateList('education', index, { ...item, school: value })}
            />
            <div className="form-row">
              <Select
                label="学历类型 *"
                value={item.education_type}
                onChange={(value) =>
                  updateList('education', index, {
                    ...item,
                    education_type: value as typeof item.education_type,
                  })
                }
                options={[
                  ['FULL_TIME', '全日制'],
                  ['PART_TIME', '非全日制'],
                  ['OTHER', '其他'],
                ]}
              />
              <Select
                label="学历 *"
                value={item.degree}
                onChange={(value) =>
                  updateList('education', index, {
                    ...item,
                    degree: value as typeof item.degree,
                  })
                }
                options={[
                  ['ASSOCIATE', '大专'],
                  ['BACHELOR', '本科'],
                  ['MASTER', '硕士'],
                  ['DOCTOR', '博士'],
                  ['OTHER_POST_SECONDARY', '其他高中以上学历'],
                ]}
              />
            </div>
            <div className="form-row">
              <Field
                label="学院 *"
                value={item.college}
                onChange={(value) => updateList('education', index, { ...item, college: value })}
              />
              <Field
                label="专业 *"
                value={item.major}
                onChange={(value) => updateList('education', index, { ...item, major: value })}
              />
            </div>
            <div className="form-row">
              <Field
                label="实验室（选填）"
                value={item.laboratory}
                onChange={(value) =>
                  updateList('education', index, { ...item, laboratory: value })
                }
              />
              <Field
                label="方向（选填）"
                value={item.direction}
                onChange={(value) => updateList('education', index, { ...item, direction: value })}
              />
            </div>
            <Field
              label="导师（选填）"
              value={item.advisor}
              onChange={(value) => updateList('education', index, { ...item, advisor: value })}
            />
          </div>
        </EntryCard>
      ))}
    </section>
  );
}

export function ExperienceStep({ profile, change, updateList, remove }: CommonProps) {
  return (
    <section className="form-section">
      <ExperienceSection
        title="实习经历"
        rows={profile.internships}
        add={() => change('internships', [...profile.internships, createExperience()])}
        update={(index, value) => updateList('internships', index, value)}
        remove={(index) => remove('internships', index)}
      />
      <ExperienceSection
        title="工作经历"
        rows={profile.work_experiences}
        add={() => change('work_experiences', [...profile.work_experiences, createExperience()])}
        update={(index, value) => updateList('work_experiences', index, value)}
        remove={(index) => remove('work_experiences', index)}
      />
      <SectionHead
        title="项目经历"
        hint="可添加 0 条或多条"
        onAdd={() => change('projects', [...profile.projects, createProject()])}
      />
      {profile.projects.length === 0 && <Empty text="暂无项目经历，可手动添加" />}
      {profile.projects.map((item, index) => (
        <EntryCard
          title={`项目经历 ${index + 1}`}
          onRemove={() => remove('projects', index)}
          key={index}
        >
          <div className="form-stack">
            <Field
              label="名称 *"
              value={item.name}
              onChange={(value) => updateList('projects', index, { ...item, name: value })}
            />
            <Field
              label="角色 *"
              value={item.role}
              onChange={(value) => updateList('projects', index, { ...item, role: value })}
            />
            <div className="form-row">
              <Month
                label="开始时间 *"
                value={item.start}
                onChange={(value) => updateList('projects', index, { ...item, start: value })}
              />
              <Month
                label="结束时间"
                value={item.end}
                disabled={item.current}
                onChange={(value) => updateList('projects', index, { ...item, end: value })}
              />
            </div>
            <label className="check">
              <input
                type="checkbox"
                checked={item.current}
                onChange={(event) =>
                  updateList('projects', index, {
                    ...item,
                    current: event.target.checked,
                    end: event.target.checked ? '' : item.end,
                  })
                }
              />
              至今
            </label>
          </div>
          <Text
            label="描述 *"
            value={item.description}
            onChange={(value) => updateList('projects', index, { ...item, description: value })}
          />
        </EntryCard>
      ))}
    </section>
  );
}

export function SupplementStep({
  profile,
  resume,
  file,
  uploading,
  change,
  updateList,
  remove,
  onFileChange,
  onFile,
}: CommonProps & {
  resume: Resume | null;
  file: File | null;
  uploading: boolean;
  onFileChange: (event: ChangeEvent<HTMLInputElement>) => void;
  onFile: (file: File | null) => void;
}) {
  const [dragging, setDragging] = useState(false);

  function handleDrop(event: DragEvent<HTMLLabelElement>) {
    event.preventDefault();
    setDragging(false);
    const dropped = event.dataTransfer.files?.[0];
    if (dropped) onFile(dropped);
  }

  return (
    <section className="form-section">
      <SectionHead
        title="语言能力"
        hint="可添加 0 条或多条"
        onAdd={() => change('languages', [...profile.languages, createLanguage()])}
      />
      {profile.languages.length === 0 && <Empty text="暂无语言能力，可手动添加" />}
      {profile.languages.map((item, index) => (
        <EntryCard
          title={`语言 ${index + 1}`}
          onRemove={() => remove('languages', index)}
          key={index}
        >
          <div className="form-stack">
            <div className="form-row">
              <Field
                label="语种 *"
                value={item.language}
                onChange={(value) => updateList('languages', index, { ...item, language: value })}
              />
              <Field
                label="熟练度 *"
                value={item.proficiency}
                onChange={(value) =>
                  updateList('languages', index, { ...item, proficiency: value })
                }
              />
            </div>
            <div className="form-row">
              <Field
                label="考试名称（选填）"
                value={item.exam}
                onChange={(value) => updateList('languages', index, { ...item, exam: value })}
              />
              <Field
                label="成绩（选填）"
                value={item.score}
                onChange={(value) => updateList('languages', index, { ...item, score: value })}
              />
            </div>
          </div>
        </EntryCard>
      ))}
      <SectionHead
        title="证书"
        hint="可添加 0 条或多条"
        onAdd={() => change('certificates', [...profile.certificates, createCertificate()])}
      />
      {profile.certificates.length === 0 && <Empty text="暂无证书，可手动添加" />}
      {profile.certificates.map((item, index) => (
        <EntryCard
          title={`证书 ${index + 1}`}
          onRemove={() => remove('certificates', index)}
          key={index}
        >
          <div className="form-stack">
            <div className="form-row">
              <Field
                label="名称 *"
                value={item.name}
                onChange={(value) => updateList('certificates', index, { ...item, name: value })}
              />
              <Field
                label="颁发机构 *"
                value={item.issuer}
                onChange={(value) => updateList('certificates', index, { ...item, issuer: value })}
              />
            </div>
            <Month
              label="取得时间 *"
              value={item.obtained_at}
              onChange={(value) =>
                updateList('certificates', index, { ...item, obtained_at: value })
              }
            />
          </div>
        </EntryCard>
      ))}
      <Text
        label="自我评价（选填）"
        value={profile.self_evaluation}
        onChange={(value) => change('self_evaluation', value)}
      />
      <div className="resume-upload">
        <h3 className="resume-upload-title">
          <span className="resume-upload-icon">📄</span>
          附件简历上传 <small>（推荐 PDF / Word）</small>
        </h3>

        {file || resume ? (
          <div className={`resume-file-card${uploading ? ' uploading' : ''}`}>
            <div className={`resume-file-badge ${getFileKind(file?.name || resume?.file_name || '')}`}>
              {getFileBadge(file?.name || resume?.file_name || '')}
            </div>
            <div className="resume-file-info">
              <div className="resume-file-name">{file?.name || resume?.file_name}</div>
              <div className="resume-file-meta">
                {file && !uploading && <span>大小：{formatFileSize(file.size)}</span>}
                <span className={`resume-file-status ${getStatusClass(file, resume, uploading)}`}>
                  {getStatusText(file, resume, uploading)}
                </span>
              </div>
            </div>
            <label className={`btn btn-outline btn-sm resume-reupload${uploading ? ' disabled' : ''}`}>
              <input type="file" accept=".pdf,.doc,.docx" onChange={onFileChange} hidden disabled={uploading} />
              重新上传
            </label>
          </div>
        ) : (
          <label
            className={`resume-empty-card${dragging ? ' dragging' : ''}${uploading ? ' uploading' : ''}`}
            onDragOver={(event) => {
              event.preventDefault();
              setDragging(true);
            }}
            onDragLeave={() => setDragging(false)}
            onDrop={handleDrop}
          >
            <input type="file" accept=".pdf,.doc,.docx" onChange={onFileChange} hidden disabled={uploading} />
            <span className="resume-empty-icon">+</span>
            <span className="resume-empty-text">点击上传简历附件</span>
            <small>支持 PDF / DOC / DOCX，最大 10MB</small>
          </label>
        )}
      </div>
    </section>
  );
}

function ReviewRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="review-row">
      <dt>{label}</dt>
      <dd>{value || '—'}</dd>
    </div>
  );
}

export function ReviewStep({
  profile,
  resume,
}: {
  profile: CandidateProfile;
  resume: Resume | null;
}) {
  return (
    <section className="form-section preview review-page">
      <h2>确认申请信息</h2>

      <div className="review-block">
        <h3 className="review-block-title">基本信息</h3>
        <dl className="review-fields">
          <ReviewRow label="姓名" value={profile.name} />
          <ReviewRow label="性别" value={labelMap(GENDER_LABELS, profile.gender)} />
          <ReviewRow label="出生年" value={profile.birth_year || ''} />
          <ReviewRow label="手机号码" value={profile.phone} />
          <ReviewRow label="电子邮箱" value={profile.contact_email} />
          <ReviewRow label="所在城市" value={profile.city || ''} />
          <ReviewRow label="求职状态" value={labelMap(STATUS_LABELS, profile.current_status)} />
          <ReviewRow label="当前职位" value={profile.current_title || ''} />
          <ReviewRow label="当前公司" value={profile.current_company || ''} />
          <ReviewRow label="工作年限" value={labelMap(YEARS_LABELS, profile.years_experience)} />
          <ReviewRow label="期望薪资" value={profile.expected_salary || ''} />
          <ReviewRow label="证件类型" value={labelMap(IDENTITY_LABELS, profile.identity_type)} />
          <ReviewRow
            label="证件号码"
            value={
              profile.identity_number_set
                ? profile.identity_number_masked || '(已保存)'
                : profile.identity_number || '新号码待保存'
            }
          />
          <ReviewRow label="期望工作地点" value={profile.preferred_locations.join('、')} />
        </dl>
      </div>

      <div className="review-block">
        <h3 className="review-block-title">教育经历</h3>
        {profile.education.length === 0 ? (
          <Empty text="暂无教育经历" />
        ) : (
          profile.education.map((item, index) => (
            <div className="entry-card" key={index}>
              <h4 className="review-entry-title">教育经历 {index + 1}</h4>
              <dl className="review-fields">
                <ReviewRow label="学校" value={item.school} />
                <ReviewRow label="学历类型" value={labelMap(EDU_TYPE_LABELS, item.education_type)} />
                <ReviewRow label="学历" value={labelMap(DEGREE_LABELS, item.degree)} />
                <ReviewRow label="学院" value={item.college} />
                <ReviewRow label="专业" value={item.major} />
                <ReviewRow label="起止时间" value={rangeText(item.start, item.end)} />
                <ReviewRow label="实验室" value={item.laboratory} />
                <ReviewRow label="方向" value={item.direction} />
                <ReviewRow label="导师" value={item.advisor} />
              </dl>
            </div>
          ))
        )}
      </div>

      <div className="review-block">
        <h3 className="review-block-title">实习经历</h3>
        {profile.internships.length === 0 ? (
          <Empty text="暂无实习经历" />
        ) : (
          profile.internships.map((item, index) => (
            <div className="entry-card" key={index}>
              <h4 className="review-entry-title">实习经历 {index + 1}</h4>
              <dl className="review-fields">
                <ReviewRow label="单位" value={item.company} />
                <ReviewRow label="职位" value={item.title} />
                <ReviewRow
                  label="起止时间"
                  value={rangeText(item.start, item.end, item.current)}
                />
              </dl>
              <p className="review-prose">{item.description || '—'}</p>
            </div>
          ))
        )}
      </div>

      <div className="review-block">
        <h3 className="review-block-title">工作经历</h3>
        {profile.work_experiences.length === 0 ? (
          <Empty text="暂无工作经历" />
        ) : (
          profile.work_experiences.map((item, index) => (
            <div className="entry-card" key={index}>
              <h4 className="review-entry-title">工作经历 {index + 1}</h4>
              <dl className="review-fields">
                <ReviewRow label="单位" value={item.company} />
                <ReviewRow label="职位" value={item.title} />
                <ReviewRow
                  label="起止时间"
                  value={rangeText(item.start, item.end, item.current)}
                />
              </dl>
              <p className="review-prose">{item.description || '—'}</p>
            </div>
          ))
        )}
      </div>

      <div className="review-block">
        <h3 className="review-block-title">项目经历</h3>
        {profile.projects.length === 0 ? (
          <Empty text="暂无项目经历" />
        ) : (
          profile.projects.map((item, index) => (
            <div className="entry-card" key={index}>
              <h4 className="review-entry-title">项目经历 {index + 1}</h4>
              <dl className="review-fields">
                <ReviewRow label="名称" value={item.name} />
                <ReviewRow label="角色" value={item.role} />
                <ReviewRow
                  label="起止时间"
                  value={rangeText(item.start, item.end, item.current)}
                />
              </dl>
              <p className="review-prose">{item.description || '—'}</p>
            </div>
          ))
        )}
      </div>

      <div className="review-block">
        <h3 className="review-block-title">语言能力</h3>
        {profile.languages.length === 0 ? (
          <Empty text="暂无语言能力" />
        ) : (
          profile.languages.map((item, index) => (
            <div className="entry-card" key={index}>
              <h4 className="review-entry-title">语言 {index + 1}</h4>
              <dl className="review-fields">
                <ReviewRow label="语种" value={item.language} />
                <ReviewRow label="熟练度" value={item.proficiency} />
                <ReviewRow label="考试名称" value={item.exam} />
                <ReviewRow label="成绩" value={item.score} />
              </dl>
            </div>
          ))
        )}
      </div>

      <div className="review-block">
        <h3 className="review-block-title">证书</h3>
        {profile.certificates.length === 0 ? (
          <Empty text="暂无证书" />
        ) : (
          profile.certificates.map((item, index) => (
            <div className="entry-card" key={index}>
              <h4 className="review-entry-title">证书 {index + 1}</h4>
              <dl className="review-fields">
                <ReviewRow label="名称" value={item.name} />
                <ReviewRow label="颁发机构" value={item.issuer} />
                <ReviewRow label="取得时间" value={item.obtained_at} />
              </dl>
            </div>
          ))
        )}
      </div>

      <div className="review-block">
        <h3 className="review-block-title">自我评价</h3>
        <p className="review-prose">{profile.self_evaluation || '—'}</p>
      </div>

      <div className="review-block">
        <h3 className="review-block-title">简历文件</h3>
        {resume ? (
          <dl className="review-fields">
            <ReviewRow label="文件名" value={resume.file_name} />
            <ReviewRow label="状态" value={getStatusText(null, resume, false)} />
          </dl>
        ) : (
          <Empty text="未上传简历" />
        )}
      </div>

      <div className="privacy-note">
        提交后，本次资料和岗位类型将固化为申请快照。证件号码加密保存，招聘人员仅看到脱敏号码。
      </div>
    </section>
  );
}
