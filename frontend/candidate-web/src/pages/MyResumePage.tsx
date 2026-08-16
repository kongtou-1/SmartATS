import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../lib/client';
import type { CandidateProfile, Resume } from '../types';

/* ---- label maps ---- */
const DEGREE_LABELS: Record<string, string> = {
  ASSOCIATE: '专科',
  BACHELOR: '本科',
  MASTER: '硕士',
  DOCTOR: '博士',
  OTHER_POST_SECONDARY: '其他',
  '': '未填写',
};

const EDU_TYPE_LABELS: Record<string, string> = {
  FULL_TIME: '全日制',
  PART_TIME: '非全日制',
  OTHER: '其他',
  '': '未填写',
};

const ID_TYPE_LABELS: Record<string, string> = {
  CN_ID: '中国 · 居民身份证',
  PASSPORT: '护照',
  OTHER: '其他证件',
  '': '未填写',
};

function fmtDate(s: string | null | undefined): string {
  if (!s) return '';
  // "2024-09" → "2024.09"
  return s.replace(/-/g, '.');
}

function fmtDateTime(s: string | null | undefined): string {
  if (!s) return '';
  const d = new Date(s);
  if (isNaN(d.getTime())) return '';
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export default function MyResumePage() {
  const [profile, setProfile] = useState<CandidateProfile | null>(null);
  const [resume, setResume] = useState<Resume | null>(null);
  const navigate = useNavigate();

  useEffect(() => {
    api.getProfile().then(setProfile);
    api.getResume().then(setResume);
  }, []);

  /* ---- refresh after returning from wizard ---- */
  useEffect(() => {
    const onFocus = () => {
      api.getProfile().then(setProfile);
      api.getResume().then(setResume);
    };
    window.addEventListener('focus', onFocus);
    return () => window.removeEventListener('focus', onFocus);
  }, []);

  const handleEdit = (e: React.MouseEvent) => {
    e.preventDefault();
    navigate('/apply?mode=edit');
  };

  return (
    <div className="resume-page">
      {/* ---- header banner ---- */}
      <div className="resume-header">
        <div className="resume-header-inner">
          <div>
            <h1>我的简历</h1>
            {profile?.profile_saved_at && (
              <p className="resume-updated">
                <span className="resume-dot" />
                最近更新：{fmtDateTime(profile.profile_saved_at)}
              </p>
            )}
          </div>
          <button className="btn btn-outline resume-edit-btn" onClick={handleEdit}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
            编辑
          </button>
        </div>
      </div>

      {/* ---- body card ---- */}
      <div className="resume-body">
        {!profile ? (
          <div className="page-loading">加载中…</div>
        ) : (
          <>
            {/* 基本信息 */}
            <section className="resume-section">
              <h2 className="resume-section-title">基本信息</h2>
              <div className="resume-fields">
                <div className="resume-field">
                  <label>姓名</label>
                  <span>{profile.name || '未填写'}</span>
                </div>
                <div className="resume-field">
                  <label>手机号码</label>
                  <span>{profile.phone || '未填写'}</span>
                </div>
                <div className="resume-field">
                  <label>邮箱</label>
                  <span>{profile.contact_email || '未填写'}</span>
                </div>
                <div className="resume-field">
                  <label>个人证件</label>
                  <span>
                    {ID_TYPE_LABELS[profile.identity_type] || profile.identity_type}
                    {profile.identity_number_masked ? ` · ${profile.identity_number_masked}` : ''}
                  </span>
                </div>
                <div className="resume-field">
                  <label>期望工作地点</label>
                  <span>
                    {profile.preferred_locations.length
                      ? profile.preferred_locations.join('、')
                      : '未填写'}
                  </span>
                </div>
              </div>
            </section>

            {/* 教育经历 */}
            <section className="resume-section">
              <h2 className="resume-section-title">教育经历</h2>
              {profile.education.length === 0 ? (
                <p className="resume-empty">暂无教育经历</p>
              ) : (
                <div className="resume-list">
                  {profile.education.map((edu, i) => (
                    <div key={i} className="resume-list-item">
                      <div className="resume-fields">
                        <div className="resume-field">
                          <label>起止时间</label>
                          <span>{fmtDate(edu.start)} ~ {fmtDate(edu.end)}</span>
                        </div>
                        <div className="resume-field">
                          <label>学历类型</label>
                          <span>{EDU_TYPE_LABELS[edu.education_type] || edu.education_type}</span>
                        </div>
                        <div className="resume-field">
                          <label>学校名称</label>
                          <span>{edu.school || '未填写'}</span>
                        </div>
                        <div className="resume-field">
                          <label>学历</label>
                          <span>{DEGREE_LABELS[edu.degree] || edu.degree}</span>
                        </div>
                        <div className="resume-field">
                          <label>学院</label>
                          <span>{edu.college || '未填写'}</span>
                        </div>
                        <div className="resume-field">
                          <label>专业</label>
                          <span>{edu.major || '未填写'}</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>

            {/* 实习经历 */}
            <section className="resume-section">
              <h2 className="resume-section-title">实习经历</h2>
              {profile.internships.length === 0 ? (
                <p className="resume-empty">暂无实习经历</p>
              ) : (
                <div className="resume-list">
                  {profile.internships.map((item, i) => (
                    <div key={i} className="resume-list-item">
                      <div className="resume-exp-head">
                        <b>{item.company || '未填写公司'}</b>
                        <span className="resume-exp-title">{item.title || ''}</span>
                        <span className="muted">
                          {fmtDate(item.start)} ~ {item.current ? '至今' : fmtDate(item.end)}
                        </span>
                      </div>
                      {item.description && (
                        <p className="resume-desc">{item.description}</p>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </section>

            {/* 工作经历 */}
            <section className="resume-section">
              <h2 className="resume-section-title">工作经历</h2>
              {profile.work_experiences.length === 0 ? (
                <p className="resume-empty">暂无工作经历</p>
              ) : (
                <div className="resume-list">
                  {profile.work_experiences.map((item, i) => (
                    <div key={i} className="resume-list-item">
                      <div className="resume-exp-head">
                        <b>{item.company || '未填写公司'}</b>
                        <span className="resume-exp-title">{item.title || ''}</span>
                        <span className="muted">
                          {fmtDate(item.start)} ~ {item.current ? '至今' : fmtDate(item.end)}
                        </span>
                      </div>
                      {item.description && (
                        <p className="resume-desc">{item.description}</p>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </section>

            {/* 项目经历 */}
            <section className="resume-section">
              <h2 className="resume-section-title">项目经历</h2>
              {profile.projects.length === 0 ? (
                <p className="resume-empty">暂无项目经历</p>
              ) : (
                <div className="resume-list">
                  {profile.projects.map((item, i) => (
                    <div key={i} className="resume-list-item">
                      <div className="resume-exp-head">
                        <b>{item.name || '未填写项目名'}</b>
                        <span className="resume-exp-title">{item.role ? `${item.role}` : ''}</span>
                        <span className="muted">
                          {fmtDate(item.start)} ~ {item.current ? '至今' : fmtDate(item.end)}
                        </span>
                      </div>
                      {item.description && (
                        <p className="resume-desc">{item.description}</p>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </section>

            {/* 语言能力 & 证书 —— 并排或上下排列 */}
            {(profile.languages.length > 0 || profile.certificates.length > 0) && (
              <section className="resume-section">
                {profile.languages.length > 0 && (
                  <>
                    <h2 className="resume-section-title">语言能力</h2>
                    <div className="resume-tags">
                      {profile.languages.map((lang, i) => (
                        <span key={i} className="tag tag-blue">
                          {lang.language}
                          {lang.proficiency ? ` · ${lang.proficiency}` : ''}
                          {lang.exam && lang.score ? ` (${lang.exam} ${lang.score})` : ''}
                        </span>
                      ))}
                    </div>
                  </>
                )}
                {profile.certificates.length > 0 && (
                  <>
                    <h2 className="resume-section-title">证书</h2>
                    <div className="resume-tags">
                      {profile.certificates.map((cert, i) => (
                        <span key={i} className="tag tag-gray">
                          {cert.name}
                          {cert.issuer ? ` · ${cert.issuer}` : ''}
                          {cert.obtained_at ? ` (${fmtDate(cert.obtained_at)})` : ''}
                        </span>
                      ))}
                    </div>
                  </>
                )}
              </section>
            )}

            {/* 自我评价 */}
            {profile.self_evaluation && (
              <section className="resume-section">
                <h2 className="resume-section-title">自我评价</h2>
                <p className="pre-wrap resume-eval">{profile.self_evaluation}</p>
              </section>
            )}

            {/* 简历文件 */}
            <section className="resume-section">
              <h2 className="resume-section-title">简历文件</h2>
              {resume ? (
                <div className="resume-file-row">
                  <span className="resume-filename">{resume.file_name}</span>
                  <span className={`tag ${
                    resume.parse_status === 'DONE' ? 'tag-green' :
                    resume.parse_status === 'FAILED' ? 'tag-red' :
                    'tag-amber'
                  }`}>
                    {resume.parse_status === 'PENDING' ? '待解析' :
                     resume.parse_status === 'PARSING' ? '解析中' :
                     resume.parse_status === 'DONE' ? '已解析' :
                     '解析失败'}
                  </span>
                </div>
              ) : (
                <p className="resume-empty">尚未上传简历文件，编辑时可上传 PDF、DOC 或 DOCX。</p>
              )}
            </section>
          </>
        )}
      </div>
    </div>
  );
}
