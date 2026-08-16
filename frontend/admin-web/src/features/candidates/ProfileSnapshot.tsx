import type { ReactNode } from 'react';
import type {
  CandidateProfileSnapshot as Profile,
  CandidateExperienceSnapshot,
  CandidateProjectSnapshot,
  JobType,
} from '../../types';
import { JOB_TYPE_LABELS } from '../../types';

const EDUCATION_TYPE_LABELS: Record<string, string> = {
  FULL_TIME: '全日制',
  PART_TIME: '非全日制',
  OTHER: '其他',
};

const DEGREE_LABELS: Record<string, string> = {
  ASSOCIATE: '大专',
  BACHELOR: '本科',
  MASTER: '硕士',
  DOCTOR: '博士',
  OTHER_POST_SECONDARY: '其他高中以上学历',
};

function period(item: CandidateExperienceSnapshot | CandidateProjectSnapshot): string {
  return `${item.start || '—'} - ${item.current ? '至今' : item.end || '—'}`;
}

function Rows<T>({
  items,
  render,
  empty = '无',
}: {
  items: T[];
  render: (item: T) => ReactNode;
  empty?: string;
}) {
  if (!items?.length) return <span className="muted">{empty}</span>;
  return (
    <>
      {items.map((item, index) => (
        <div className="snapshot-entry" key={index}>
          {render(item)}
        </div>
      ))}
    </>
  );
}

export default function ProfileSnapshot({
  profile,
  jobType,
}: {
  profile: Profile;
  jobType: JobType | null;
}) {
  return (
    <div className="snapshot-grid">
      <div>
        <b>岗位类型：</b>
        {jobType ? JOB_TYPE_LABELS[jobType] : '—'}
      </div>
      <div>
        <b>姓名：</b>
        {profile.name || '—'}
      </div>
      <div>
        <b>手机：</b>
        {profile.phone || '—'}
      </div>
      <div>
        <b>邮箱：</b>
        {profile.contact_email || '—'}
      </div>
      <div>
        <b>证件类型：</b>
        {profile.identity_type || '—'}
      </div>
      <div>
        <b>证件号：</b>
        {profile.identity_number_masked || '—'}
      </div>
      <div className="snapshot-wide">
        <b>期望地点：</b>
        {profile.preferred_locations?.join('、') || '—'}
      </div>
      <div className="snapshot-wide">
        <b>教育经历</b>
        <Rows
          items={profile.education || []}
          render={(item) => (
            <>
              <strong>
                {item.school} · {item.major}
              </strong>
              <span>
                {DEGREE_LABELS[item.degree] || item.degree} /{' '}
                {EDUCATION_TYPE_LABELS[item.education_type] || item.education_type} · {item.college}{' '}
                · {item.start || '—'} - {item.end || '—'}
              </span>
              {(item.laboratory || item.direction || item.advisor) && (
                <span>
                  实验室：{item.laboratory || '—'} · 方向：{item.direction || '—'} · 导师：
                  {item.advisor || '—'}
                </span>
              )}
            </>
          )}
        />
      </div>
      <div className="snapshot-wide">
        <b>实习经历</b>
        <Rows
          items={profile.internships || []}
          render={(item) => (
            <>
              <strong>
                {item.company} · {item.title}
              </strong>
              <span>{period(item)}</span>
              <p>{item.description}</p>
            </>
          )}
        />
      </div>
      <div className="snapshot-wide">
        <b>工作经历</b>
        <Rows
          items={profile.work_experiences || []}
          render={(item) => (
            <>
              <strong>
                {item.company} · {item.title}
              </strong>
              <span>{period(item)}</span>
              <p>{item.description}</p>
            </>
          )}
        />
      </div>
      <div className="snapshot-wide">
        <b>项目经历</b>
        <Rows
          items={profile.projects || []}
          render={(item) => (
            <>
              <strong>
                {item.name} · {item.role}
              </strong>
              <span>{period(item)}</span>
              <p>{item.description}</p>
            </>
          )}
        />
      </div>
      <div>
        <b>语言能力</b>
        <Rows
          items={profile.languages || []}
          render={(item) => (
            <span>
              {item.language} · {item.proficiency}
              {item.exam ? ` · ${item.exam} ${item.score || ''}` : ''}
            </span>
          )}
        />
      </div>
      <div>
        <b>证书</b>
        <Rows
          items={profile.certificates || []}
          render={(item) => (
            <span>
              {item.name} · {item.issuer} · {item.obtained_at}
            </span>
          )}
        />
      </div>
      <div className="snapshot-wide">
        <b>自我评价：</b>
        {profile.self_evaluation || '无'}
      </div>
    </div>
  );
}
