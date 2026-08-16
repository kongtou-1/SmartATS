import { useEffect, useState } from 'react';
import {
  X,
  Sparkles,
  Star,
  User,
  Building2,
  GraduationCap,
  Phone,
  Mail,
  MapPin,
  XCircle,
  CalendarClock,
  ArrowRight,
  CheckCircle2,
  Clock,
  FileText,
  Download,
  ExternalLink,
  Briefcase,
} from 'lucide-react';
import { api } from '../../lib/client';
import ProfileSnapshot from './ProfileSnapshot';
import type {
  AdminApplication,
  AdminApplicationDetail,
  RoundType,
  Stage,
  StageHistory,
} from '../../types';
import {
  INTERVIEW_STATUS_LABELS,
  STAGE_LABELS,
  STAGE_ORDER,
  isInterviewableStage,
} from '../../types';

/* ------------------------------------------------------------------ */
/*  Stage stepper labels & icons for the modal's horizontal pipeline   */
/*  与 /candidates 看板保持一致：投递 → 简历初筛 → 初筛通过 → 一面 → 二面 → 终面 → 面试通过 */
/* ------------------------------------------------------------------ */
const DRAWER_STAGES = STAGE_ORDER.map((key) => ({
  key,
  label: key === 'APPLIED' ? '投递' : STAGE_LABELS[key],
}));

const ROUND_LABELS: Record<RoundType, string> = {
  FIRST: '一面',
  SECOND: '二面',
  HR: 'HR 面',
};

const ACTION_LABELS: Record<StageHistory['action'], string> = {
  APPLY: '投递',
  ADVANCE: '推进',
  RETURN: '回退',
  HOLD: '暂缓',
  RESUME: '恢复',
  REJECT: '淘汰',
  WITHDRAW: '撤回',
  TRANSITION: '流转',
};

const RECOMMENDATION_LABELS: Record<string, string> = {
  PASS: '建议通过',
  HOLD: '建议待定',
  FAIL: '建议淘汰',
};

type TabKey = 'overview' | 'resume' | 'interviews' | 'history' | 'profile';

function gradeFromScore(s: number | null): string {
  if (s === null) return '—';
  if (s >= 90) return 'A+';
  if (s >= 80) return 'A';
  if (s >= 70) return 'B+';
  if (s >= 60) return 'B';
  return 'C';
}

function gradeClass(s: number | null): string {
  if (s === null) return '';
  if (s >= 80) return 'grade-hi';
  if (s >= 60) return 'grade-mid';
  return 'grade-lo';
}

function fmtDateTime(s: string | null | undefined): string {
  if (!s) return '—';
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) return s;
  return d.toLocaleString('zh-CN', { hour12: false });
}

function fmtDate(s: string | null | undefined): string {
  if (!s) return '—';
  return String(s).replace(/-/g, '.');
}

interface Props {
  app: AdminApplication | null;
  onClose: () => void;
  onAdvance?: () => void;
  onReject?: () => void;
  onSchedule?: () => void;
  /** 跳转到候选人完整详情页（暂缓 / 恢复 / 指定阶段流转等高级操作） */
  onOpenFullPage?: () => void;
}

export default function CandidateDetailDrawer({
  app,
  onClose,
  onAdvance,
  onReject,
  onSchedule,
  onOpenFullPage,
}: Props) {
  const [detail, setDetail] = useState<AdminApplicationDetail | null>(null);
  const [tab, setTab] = useState<TabKey>('overview');
  const [resumeUrl, setResumeUrl] = useState<string | null>(null);
  const [resumeBusy, setResumeBusy] = useState(false);
  const [resumeError, setResumeError] = useState('');

  /* Load full detail when app changes */
  useEffect(() => {
    if (!app) { setDetail(null); return; }
    let cancelled = false;
    setTab('overview');
    api.adminGetApplication(app.id).then((d) => {
      if (!cancelled) setDetail(d);
    }).catch(() => {});
    return () => { cancelled = true; };
  }, [app?.id]);

  /* 切换候选人时释放上一份简历预览的 blob URL */
  useEffect(() => {
    setResumeError('');
    return () => {
      setResumeUrl((prev) => {
        if (prev) URL.revokeObjectURL(prev);
        return null;
      });
    };
  }, [app?.id]);

  /* ESC close */
  useEffect(() => {
    function handler(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    document.addEventListener('keydown', handler);
    /* lock body scroll */
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', handler);
      document.body.style.overflow = '';
    };
  }, [onClose]);

  if (!app) return null;

  const d = detail;
  const currentStage = d?.current_stage ?? app.current_stage;
  const currentIdx = DRAWER_STAGES.findIndex((s) => s.key === currentStage);
  const isFinal = ['HIRED', 'REJECTED', 'WITHDRAWN'].includes(currentStage);
  // 「面试通过」及已拒绝 / 已撤回属流程终态：不再展示预约面试与推进入口。
  const canSchedule = !isFinal && isInterviewableStage(currentStage);
  const canReject = !isFinal && (d ? d.status === 'ACTIVE' || d.status === 'ON_HOLD' : true);
  const score = d?.ai_score ?? app.ai_score;
  const name = d?.candidate?.name ?? app.candidate_name;
  const firstChar = name.charAt(0).toUpperCase();
  const snap = d?.candidate_profile_snapshot ?? null;
  const resume = d?.resume ?? null;
  const parsed = resume?.parsed_data ?? null;

  /* Build skill list */
  const skills = d?.agent_result
    ? [...d.agent_result.strengths.slice(0, 4)]
    : (app.skills.length > 0 ? app.skills.slice(0, 4) : []);

  /* Basic info fields */
  const company = snap?.work_experiences?.[0]?.company || app.latest_company || '—';
  const title = snap?.work_experiences?.[0]?.title || '—';
  const school = snap?.education?.[0]?.school || app.latest_school || '—';
  const degree = snap?.education?.[0]?.degree || app.latest_degree || '';
  const major = snap?.education?.[0]?.major || '—';
  const phone = d?.candidate?.phone || snap?.phone || '—';
  const email = d?.candidate?.email || snap?.contact_email || '—';
  const city = d?.candidate?.city || snap?.preferred_locations?.[0] || '—';

  const resumeStatusTag =
    resume?.parse_status === 'DONE'
      ? { cls: 'tag-green', text: '已解析' }
      : resume?.parse_status === 'FAILED'
        ? { cls: 'tag-red', text: '解析失败' }
        : resume?.parse_status === 'PARSING'
          ? { cls: 'tag-amber', text: '解析中' }
          : { cls: 'tag-amber', text: '待解析' };

  async function toggleResumePreview() {
    if (resumeUrl) {
      URL.revokeObjectURL(resumeUrl);
      setResumeUrl(null);
      return;
    }
    if (!app) return;
    setResumeBusy(true);
    setResumeError('');
    try {
      const blob = api.adminResumeBlob
        ? await api.adminResumeBlob(app.id)
        : null;
      if (!blob) throw new Error('当前环境不支持在线预览，请直接下载');
      setResumeUrl(URL.createObjectURL(blob));
    } catch (e) {
      setResumeError(e instanceof Error ? e.message : '简历预览失败');
    } finally {
      setResumeBusy(false);
    }
  }

  async function downloadResume() {
    if (!app) return;
    setResumeError('');
    try {
      await api.adminDownloadResume(app.id);
    } catch (e) {
      setResumeError(e instanceof Error ? e.message : '简历下载失败');
    }
  }

  const TABS: { key: TabKey; label: string; count?: number }[] = [
    { key: 'overview', label: '概览' },
    { key: 'resume', label: '简历文件' },
    { key: 'interviews', label: '面试记录', count: d?.interviews?.length },
    { key: 'history', label: '流程记录', count: d?.stage_history?.length },
    { key: 'profile', label: '投递资料' },
  ];

  return (
    <>
      <div className="modal-overlay" onClick={onClose} />
      <div className="modal" role="dialog" aria-label="候选人详情"
        style={{ width: 980, maxWidth: 'calc(100vw - 32px)' }}>
        {/* ====== HEADER (dark) ====== */}
        <div className="cd-header">
          <div className="cd-avatar">{firstChar}</div>
          <div className="cd-header-info">
            <div className="cd-name-row">
              <span className="cd-name">{name}</span>
              <span className="cd-badge cd-badge-exp">{STAGE_LABELS[currentStage]}</span>
              {d?.status === 'ON_HOLD' && <span className="cd-badge cd-badge-gender">暂缓中</span>}
              <span className={`cd-badge cd-score ${gradeClass(score)}`}>匹配度 {score ?? '—'}%</span>
            </div>
            <div className="cd-position">
              应聘：{app.job_title} · 投递于 {fmtDateTime(d?.applied_at ?? app.applied_at)}
            </div>
          </div>
          <button className="cd-close" onClick={onClose} title="关闭">
            <X size={18} />
          </button>
        </div>

        {/* ====== STAGE STEPPER ====== */}
        <div className="cd-stages" aria-label="招聘流程">
          {DRAWER_STAGES.map((s, i) => {
            const isDone = i < currentIdx;
            const isActive = i === currentIdx;
            const isAfter = i > currentIdx;
            return (
              <div
                className={`cd-stage-item ${isDone ? 'done' : ''} ${isActive ? 'active' : ''} ${isAfter ? 'after' : ''}`}
                key={s.key}
                title={`第 ${i + 1} 步：${s.label}${isActive ? '（当前阶段）' : ''}`}
              >
                <div className="cd-stage-dot">
                  {isDone ? <CheckCircle2 size={15} /> : isActive ? <Clock size={15} /> : <span>{i + 1}</span>}
                </div>
                <span className="cd-stage-label">
                  {s.label}
                  {isActive && <span className="cd-stage-current">当前阶段</span>}
                </span>
                {i < DRAWER_STAGES.length - 1 && (
                  <div className={`cd-stage-line ${isDone ? 'done' : ''}`} />
                )}
              </div>
            );
          })}
        </div>

        {/* ====== TABS ====== */}
        <div className="cd-tabs" role="tablist" aria-label="候选人信息分类">
          {TABS.map((t) => (
            <button
              key={t.key}
              type="button"
              role="tab"
              aria-selected={tab === t.key}
              className={`cd-tab${tab === t.key ? ' active' : ''}`}
              onClick={() => setTab(t.key)}
            >
              {t.label}
              {t.count !== undefined && t.count > 0 && (
                <span className="cd-tab-count">{t.count}</span>
              )}
            </button>
          ))}
        </div>

        <div className="cd-body">
          {!d && <div className="cd-loading">加载候选人完整资料…</div>}

          {/* ================= 概览 ================= */}
          {tab === 'overview' && (
            <>
              <section className="cd-ai-card">
                <div className="cd-ai-head">
                  <div className="cd-ai-title">
                    <Sparkles size={16} className="cd-ai-icon" />
                    AI 智能画像与核心亮点解析
                  </div>
                  <span className={`cd-grade ${gradeClass(score)}`}>
                    综合高潜等级 {gradeFromScore(score)}
                  </span>
                </div>
                <p className="cd-ai-summary">
                  {d?.agent_result?.summary ||
                    `候选人在 ${company || '当前公司'} 担任 ${title || '相关岗位'}，具备扎实的专业积累。与目标岗位「${app.job_title}」的核心技术栈契合度达到 ${score ?? '?'}%。`}
                </p>
                {skills.length > 0 && (
                  <div className="cd-tags">
                    {skills.map((skill, i) => (
                      <span className="cd-tag" key={i}>
                        <Star size={12} className="cd-tag-star" />{typeof skill === 'string' ? skill : String(skill)}
                      </span>
                    ))}
                  </div>
                )}
                {d?.agent_result && d.agent_result.gaps.length > 0 && (
                  <div className="cd-ai-gaps">
                    <span className="cd-ai-gaps-label">待考察</span>
                    <ul>
                      {d.agent_result.gaps.map((g, i) => <li key={i}>{g}</li>)}
                    </ul>
                  </div>
                )}
              </section>

              <section className="cd-section">
                <h4 className="cd-section-title">基本背景信息</h4>
                <div className="cd-grid">
                  <div className="cd-field">
                    <span className="cd-field-label"><User size={13} /> 当前就职</span>
                    <span className="cd-field-value">{company}{title !== '—' ? ` / ${title}` : ''}</span>
                  </div>
                  <div className="cd-field">
                    <span className="cd-field-label"><Building2 size={13} /> 现任职级</span>
                    <span className="cd-field-value">{title}</span>
                  </div>
                  <div className="cd-field">
                    <span className="cd-field-label"><GraduationCap size={13} /> 毕业院校</span>
                    <span className="cd-field-value">{school}{degree ? `（${degree}）` : ''}</span>
                  </div>
                  <div className="cd-field">
                    <span className="cd-field-label"><GraduationCap size={13} /> 专业方向</span>
                    <span className="cd-field-value">{major}</span>
                  </div>
                  <div className="cd-field">
                    <span className="cd-field-label"><Phone size={13} /> 联系电话</span>
                    <span className="cd-field-value">{phone}</span>
                  </div>
                  <div className="cd-field">
                    <span className="cd-field-label"><Mail size={13} /> 电子邮箱</span>
                    <span className="cd-field-value cd-email">{email}</span>
                  </div>
                  <div className="cd-field">
                    <span className="cd-field-label"><MapPin size={13} /> 期望城市</span>
                    <span className="cd-field-value">
                      {snap?.preferred_locations?.length ? snap.preferred_locations.join('、') : city}
                    </span>
                  </div>
                  <div className="cd-field">
                    <span className="cd-field-label"><Briefcase size={13} /> 证件信息</span>
                    <span className="cd-field-value">
                      {snap?.identity_type
                        ? `${snap.identity_type} ${snap.identity_number_masked || ''}`.trim()
                        : '—'}
                    </span>
                  </div>
                </div>
              </section>

              {snap?.self_evaluation && (
                <section className="cd-section">
                  <h4 className="cd-section-title">自我评价</h4>
                  <p className="cd-para">{snap.self_evaluation}</p>
                </section>
              )}
            </>
          )}

          {/* ================= 简历文件 ================= */}
          {tab === 'resume' && (
            <>
              <section className="cd-section">
                <h4 className="cd-section-title">简历文件</h4>
                {resume ? (
                  <div className="cd-file-card">
                    <div className="cd-file-icon"><FileText size={20} /></div>
                    <div className="cd-file-meta">
                      <div className="cd-file-name">{resume.file_name}</div>
                      <div className="cd-file-sub">
                        <span className={`tag ${resumeStatusTag.cls}`}>{resumeStatusTag.text}</span>
                        <span className="muted">上传于 {fmtDateTime(resume.created_at)}</span>
                      </div>
                    </div>
                    <div className="cd-file-actions">
                      <button
                        type="button"
                        className="cd-btn cd-btn-outline"
                        onClick={toggleResumePreview}
                        disabled={resumeBusy}
                      >
                        <ExternalLink size={14} />
                        {resumeBusy ? '加载中…' : resumeUrl ? '收起预览' : '在线预览'}
                      </button>
                      <button type="button" className="cd-btn cd-btn-primary" onClick={downloadResume}>
                        <Download size={14} /> 下载原件
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="cd-empty">该候选人未上传简历文件</div>
                )}
                {resumeError && <div className="cd-inline-error">{resumeError}</div>}
                {resumeUrl && (
                  <iframe className="cd-pdf-frame" src={resumeUrl} title="简历预览" />
                )}
              </section>

              {parsed ? (
                <>
                  <section className="cd-section">
                    <h4 className="cd-section-title">简历解析 · 基本信息</h4>
                    <div className="cd-grid">
                      <div className="cd-field">
                        <span className="cd-field-label">姓名</span>
                        <span className="cd-field-value">{parsed.name || '—'}</span>
                      </div>
                      <div className="cd-field">
                        <span className="cd-field-label">邮箱</span>
                        <span className="cd-field-value">{parsed.email || '—'}</span>
                      </div>
                      <div className="cd-field">
                        <span className="cd-field-label">手机</span>
                        <span className="cd-field-value">{parsed.phone || '—'}</span>
                      </div>
                    </div>
                  </section>

                  {parsed.skills?.length > 0 && (
                    <section className="cd-section">
                      <h4 className="cd-section-title">技能</h4>
                      <div className="cd-tags">
                        {parsed.skills.map((s, i) => (
                          <span className="cd-tag" key={i}>{s}</span>
                        ))}
                      </div>
                    </section>
                  )}

                  {parsed.education?.length > 0 && (
                    <section className="cd-section">
                      <h4 className="cd-section-title">教育经历</h4>
                      <div className="cd-rows">
                        {parsed.education.map((edu, i) => (
                          <div className="cd-row" key={i}>
                            <div className="cd-row-head">
                              <b>{edu.school || '—'}</b>
                              <span className="cd-row-sub">{edu.major || ''} {edu.degree || ''}</span>
                              <span className="muted">{fmtDate(edu.start)} ~ {fmtDate(edu.end)}</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </section>
                  )}

                  {parsed.work_experience?.length > 0 && (
                    <section className="cd-section">
                      <h4 className="cd-section-title">工作经历</h4>
                      <div className="cd-rows">
                        {parsed.work_experience.map((w, i) => (
                          <div className="cd-row" key={i}>
                            <div className="cd-row-head">
                              <b>{w.company || '—'}</b>
                              <span className="cd-row-sub">{w.title || ''}</span>
                              <span className="muted">{fmtDate(w.start)} ~ {fmtDate(w.end)}</span>
                            </div>
                            {w.description && <p className="cd-row-desc">{w.description}</p>}
                          </div>
                        ))}
                      </div>
                    </section>
                  )}

                  {parsed.projects?.length > 0 && (
                    <section className="cd-section">
                      <h4 className="cd-section-title">项目经历</h4>
                      <div className="cd-rows">
                        {parsed.projects.map((p, i) => (
                          <div className="cd-row" key={i}>
                            <div className="cd-row-head">
                              <b>{p.name || '—'}</b>
                              <span className="cd-row-sub">{p.role || ''}</span>
                            </div>
                            {p.description && <p className="cd-row-desc">{p.description}</p>}
                          </div>
                        ))}
                      </div>
                    </section>
                  )}
                </>
              ) : (
                resume && (
                  <div className="cd-empty">简历尚未解析，暂无结构化内容，可下载原件查看。</div>
                )
              )}
            </>
          )}

          {/* ================= 面试记录 ================= */}
          {tab === 'interviews' && (
            <section className="cd-section">
              <h4 className="cd-section-title">面试记录</h4>
              {d && d.interviews.length > 0 ? (
                <div className="cd-rows">
                  {d.interviews.map((iv) => (
                    <div className="cd-row" key={iv.id}>
                      <div className="cd-row-head">
                        <b>{ROUND_LABELS[iv.round_type] || iv.round_type}</b>
                        <span className="cd-row-sub">{iv.interviewer_name || '未指派'} · {iv.method || '—'}</span>
                        <span className={`tag ${iv.status === 'COMPLETED' ? 'tag-green' : iv.status === 'CANCELLED' ? 'tag-red' : 'tag-amber'}`}>
                          {INTERVIEW_STATUS_LABELS[iv.status]}
                        </span>
                      </div>
                      <div className="cd-row-meta">
                        <CalendarClock size={13} /> {fmtDateTime(iv.scheduled_at)} · {iv.duration_minutes} 分钟
                      </div>
                      {iv.feedback && (
                        <div className="cd-feedback">
                          <div className="cd-feedback-scores">
                            <span>专业 {iv.feedback.professional_score}</span>
                            <span>项目 {iv.feedback.project_score}</span>
                            <span>沟通 {iv.feedback.communication_score}</span>
                            <span className="cd-feedback-rec">
                              {RECOMMENDATION_LABELS[iv.feedback.recommendation] || iv.feedback.recommendation}
                            </span>
                          </div>
                          {iv.feedback.summary && <p className="cd-row-desc">{iv.feedback.summary}</p>}
                        </div>
                      )}
                      {iv.note && <p className="cd-row-desc">备注：{iv.note}</p>}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="cd-empty">暂无面试记录</div>
              )}
            </section>
          )}

          {/* ================= 流程记录 ================= */}
          {tab === 'history' && (
            <section className="cd-section">
              <h4 className="cd-section-title">阶段流转记录</h4>
              {d && d.stage_history.length > 0 ? (
                <ol className="cd-timeline">
                  {d.stage_history.map((h) => (
                    <li className="cd-timeline-item" key={h.id}>
                      <span className="cd-timeline-dot" />
                      <div className="cd-timeline-body">
                        <div className="cd-timeline-head">
                          <b>{ACTION_LABELS[h.action] || h.action}</b>
                          <span className="cd-row-sub">
                            {h.from_stage ? STAGE_LABELS[h.from_stage] : '—'}
                            <ArrowRight size={12} style={{ verticalAlign: '-2px', margin: '0 4px' }} />
                            {h.to_stage ? STAGE_LABELS[h.to_stage] : '—'}
                          </span>
                          <span className="muted">{fmtDateTime(h.created_at)}</span>
                        </div>
                        <div className="cd-row-meta">
                          操作人：{h.changed_by_name || '系统'}
                          {h.reason ? ` · ${h.reason}` : ''}
                        </div>
                      </div>
                    </li>
                  ))}
                </ol>
              ) : (
                <div className="cd-empty">暂无流转记录</div>
              )}
            </section>
          )}

          {/* ================= 投递资料快照 ================= */}
          {tab === 'profile' && (
            <section className="cd-section">
              <h4 className="cd-section-title">本次投递资料快照</h4>
              {snap ? (
                <ProfileSnapshot profile={snap} jobType={d?.job_type_snapshot ?? null} />
              ) : (
                <div className="cd-empty">该投递没有结构化资料快照</div>
              )}
            </section>
          )}
        </div>

        {/* ====== FOOTER ACTIONS ====== */}
        <div className="cd-foot">
          {onOpenFullPage && (
            <button type="button" className="cd-btn cd-btn-ghost" onClick={onOpenFullPage}>
              打开完整详情页
            </button>
          )}
          <div className="cd-foot-spacer" />
          {canReject && (
            <button type="button" className="cd-btn cd-btn-danger-outline" onClick={onReject}>
              <XCircle size={14} /> 标记淘汰
            </button>
          )}
          {canSchedule && (
            <button
              type="button"
              className="cd-btn cd-btn-outline"
              onClick={onSchedule}
            >
              <CalendarClock size={14} /> 预约面试
            </button>
          )}
          {isFinal ? (
            <span className="cd-final-note">
              该候选人已处于「{STAGE_LABELS[currentStage]}」终态，流程已结束
            </span>
          ) : (
            <button type="button" className="cd-btn cd-btn-primary" onClick={onAdvance}>
              推进至下一阶段（{currentIdx >= 0 && currentIdx < DRAWER_STAGES.length - 1 ? DRAWER_STAGES[currentIdx + 1].label : '完成'}）
              <ArrowRight size={14} />
            </button>
          )}
        </div>
      </div>
    </>
  );
}
