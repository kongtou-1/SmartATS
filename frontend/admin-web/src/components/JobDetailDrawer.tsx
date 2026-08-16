import { useEffect, useState, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { X, MapPin, CheckCircle2, Copy, Edit3, Users, ArrowRight, Check, Briefcase } from 'lucide-react';
import { api } from '../lib/client';
import type { AdminApplication, JobWithStats, Stage } from '../types';
import {
  formatSalary,
  EXPERIENCE_OPTIONS,
  EDUCATION_OPTIONS,
  JOB_STATUS_LABELS,
  JOB_TYPE_LABELS,
  STAGE_LABELS,
  STAGE_ORDER,
  URGENCY_LABELS,
} from '../types';

interface Props {
  job: JobWithStats | null;
  onClose: () => void;
  /** 点击「编辑岗位」——只有主动点击才进入编辑态 */
  onEdit?: (job: JobWithStats) => void;
  /** 点击「查看候选人」——跳转候选人页并带上该岗位 */
  onViewCandidates?: (job: JobWithStats) => void;
  /** 渲染形态：drawer=右侧抽屉（默认），modal=屏幕中央弹窗 */
  variant?: 'drawer' | 'modal';
}

function statusDot(status: JobWithStats['status']) {
  const map: Record<string, { cls: string; label: string }> = {
    PUBLISHED: { cls: 'sd-green', label: JOB_STATUS_LABELS.PUBLISHED },
    DRAFT: { cls: 'sd-blue', label: JOB_STATUS_LABELS.DRAFT },
    CLOSED: { cls: 'sd-gray', label: JOB_STATUS_LABELS.CLOSED },
  };
  const s = map[status] || map.CLOSED!;
  return <span className={`status-dot ${s.cls}`}>{s.label}</span>;
}

/** Generate a short job code like TECH-FE-001 */
function jobCode(job: JobWithStats): string {
  const prefix = job.category_code?.toUpperCase().replace(/_/g, '-') ?? 'JOB';
  const short = job.id.slice(0, 4).toUpperCase();
  return `${prefix}-${short}`;
}

function optionLabel(
  options: { value: string; label: string }[],
  value?: string | null,
): string {
  if (!value) return '不限';
  return options.find((o) => o.value === value)?.label ?? value;
}

function formatDate(v?: string | null): string {
  if (!v) return '—';
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return String(v);
  return d.toLocaleDateString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
}

function KV({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="job-kv">
      <span className="job-kv-label">{label}</span>
      <span className="job-kv-value">{value ?? '—'}</span>
    </div>
  );
}

export default function JobDetailDrawer({
  job,
  onClose,
  onEdit,
  onViewCandidates,
  variant = 'drawer',
}: Props) {
  const navigate = useNavigate();
  const [apps, setApps] = useState<AdminApplication[]>([]);
  const [appsLoading, setAppsLoading] = useState(false);
  const [copied, setCopied] = useState(false);

  const jobId = job?.id;
  const isModal = variant === 'modal';

  // 拉取该岗位下的真实候选人（只读预览，最多展示 4 条）
  useEffect(() => {
    if (!jobId) {
      setApps([]);
      return;
    }
    let alive = true;
    setAppsLoading(true);
    api
      .adminListApplications({ job_id: jobId })
      .then((list) => {
        if (alive) setApps(list);
      })
      .catch(() => {
        if (alive) setApps([]);
      })
      .finally(() => {
        if (alive) setAppsLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [jobId]);

  // ESC 关闭
  useEffect(() => {
    if (!jobId) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [jobId, onClose]);

  useEffect(() => {
    setCopied(false);
  }, [jobId]);

  if (!job) return null;

  const total = job.applications_total || 0;
  const counts = job.stage_counts || {};

  // Active candidates count (not in terminal states)
  const activeStages = STAGE_ORDER.filter(
    (s) => !['HIRED', 'REJECTED', 'WITHDRAWN'].includes(s),
  );
  const activeCount = activeStages.reduce((sum, s) => sum + (counts[s] || 0), 0);
  const hiredCount = counts.HIRED || 0;

  // Parse requirements into lines
  const reqLines = (job.requirements || '')
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean);

  const funnelStages: Stage[] = STAGE_ORDER;
  const funnelMax = Math.max(1, ...funnelStages.map((s) => counts[s] || 0));
  const previewApps = apps.slice(0, 4);

  function handleCopyLink() {
    const url = `${window.location.origin}/jobs/${job!.id}`;
    navigator.clipboard
      .writeText(url)
      .then(() => {
        setCopied(true);
        window.setTimeout(() => setCopied(false), 1800);
      })
      .catch(() => {});
  }

  /* ---------------- 详情内容（drawer 与 modal 复用） ---------------- */
  const detailBody = (
    <>
      {/* Meta row */}
      <div className="detail-header-meta">
        {job.department && <span>{job.department}</span>}
        {job.category_name && <span>·</span>}
        {job.category_name && <span>{job.category_name}</span>}
        <span>·</span>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3 }}>
          <MapPin size={12} />
          {job.location}
        </span>
        <span>·</span>
        <span>{JOB_TYPE_LABELS[job.job_type]}</span>
      </div>

      {/* Info Cards */}
      <div className="detail-cards">
        <div className="detail-card">
          <div className="detail-card-label">薪资区间</div>
          <div className="detail-card-value">{formatSalary(job)}</div>
          <div className="detail-card-sub">{job.salary_negotiable ? '面议' : '月薪'}</div>
        </div>
        <div className="detail-card">
          <div className="detail-card-label">招聘编制 / 进度</div>
          <div className="detail-card-value">{job.headcount ?? 1}人</div>
          <div className="detail-card-sub">
            面试通过 <span className="hl">{hiredCount}人</span>
          </div>
        </div>
        <div className="detail-card">
          <div className="detail-card-label">候选人池</div>
          <div className="detail-card-value" style={{ color: 'var(--primary)' }}>
            {total}份投递
          </div>
          <div className="detail-card-sub">{activeCount}人在流程中</div>
        </div>
      </div>

      {/* 基本信息 */}
      <div className="detail-section">
        <h4>基本信息</h4>
        <div className="job-kv-grid">
          <KV label="岗位编号" value={jobCode(job)} />
          <KV label="岗位状态" value={JOB_STATUS_LABELS[job.status]} />
          <KV label="所属部门" value={job.department || '—'} />
          <KV label="岗位方向" value={job.category_name || '—'} />
          <KV label="招聘类型" value={JOB_TYPE_LABELS[job.job_type]} />
          <KV label="工作地点" value={job.location || '—'} />
          <KV label="招聘人数" value={`${job.headcount ?? 1} 人`} />
          <KV label="薪资范围" value={formatSalary(job)} />
          <KV label="经验要求" value={optionLabel(EXPERIENCE_OPTIONS, job.experience_req)} />
          <KV label="学历要求" value={optionLabel(EDUCATION_OPTIONS, job.education_req)} />
          <KV
            label="招聘紧急度"
            value={
              job.urgency === 'HIGH' ? (
                <span className="urgency-tag">急聘</span>
              ) : (
                URGENCY_LABELS[job.urgency || 'MEDIUM'] || '中'
              )
            }
          />
          <KV label="发布时间" value={formatDate(job.published_at)} />
          <KV label="创建时间" value={formatDate(job.created_at)} />
          <KV label="最后更新" value={formatDate(job.updated_at)} />
        </div>
      </div>

      {/* 招聘漏斗 */}
      {total > 0 && (
        <div className="detail-section">
          <h4>招聘漏斗</h4>
          <div className="job-funnel">
            {funnelStages.map((s) => {
              const n = counts[s] || 0;
              return (
                <div className="job-funnel-row" key={s}>
                  <span className="job-funnel-label">{STAGE_LABELS[s]}</span>
                  <div className="job-funnel-track">
                    <div
                      className="job-funnel-bar"
                      style={{ width: `${Math.round((n / funnelMax) * 100)}%` }}
                    />
                  </div>
                  <span className="job-funnel-num">{n}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Job Description */}
      <div className="detail-section">
        <h4>岗位职责</h4>
        <p className="detail-text">{job.description || '—'}</p>
      </div>

      {/* Requirements List */}
      <div className="detail-section">
        <h4>任职资格</h4>
        {reqLines.length > 0 ? (
          <div className="detail-req-list">
            {reqLines.map((line, i) => (
              <div className="detail-req-item" key={i}>
                <CheckCircle2 size={15} className="check-icon" />
                <span>{line.replace(/^[·\-*•]\s*/, '')}</span>
              </div>
            ))}
          </div>
        ) : (
          <p className="detail-text" style={{ color: 'var(--muted)' }}>
            —
          </p>
        )}
      </div>

      {/* 该岗位候选人（真实数据） */}
      <div className="detail-section">
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: 8,
          }}
        >
          <h4 style={{ margin: 0 }}>该岗位候选人（{apps.length}）</h4>
          <button
            className="btn-link"
            style={{ fontSize: 12 }}
            onClick={() => onViewCandidates?.(job)}
          >
            查看全部 ›
          </button>
        </div>

        {appsLoading ? (
          <p className="detail-text" style={{ color: 'var(--muted)' }}>
            加载中…
          </p>
        ) : previewApps.length === 0 ? (
          <p className="detail-text" style={{ color: 'var(--muted)' }}>
            暂无候选人投递
          </p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {previewApps.map((a) => (
              <div
                className="candidate-mini-card candidate-mini-card--link"
                key={a.id}
                title="查看候选人详情"
                onClick={() => navigate(`/candidates/${a.id}`)}
              >
                <div className="candidate-mini-info">
                  <div className="candidate-avatar">
                    {(a.candidate_name || '?').slice(0, 1)}
                  </div>
                  <div style={{ minWidth: 0 }}>
                    <div className="candidate-name">{a.candidate_name}</div>
                    <div className="candidate-extra">
                      {[a.latest_company, a.latest_school, a.latest_degree]
                        .filter(Boolean)
                        .join(' / ') || '暂无履历信息'}
                    </div>
                  </div>
                </div>
                <div
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'flex-end',
                    gap: 4,
                  }}
                >
                  {a.ai_score != null && (
                    <span className="candidate-match">匹配 {a.ai_score}%</span>
                  )}
                  <span className="badge-pill blue">{STAGE_LABELS[a.current_stage]}</span>
                </div>
              </div>
            ))}
            {apps.length > previewApps.length && (
              <button
                className="btn-link"
                style={{ alignSelf: 'flex-start', fontSize: 12.5 }}
                onClick={() => onViewCandidates?.(job)}
              >
                还有 {apps.length - previewApps.length} 位候选人，前往候选人页查看 ›
              </button>
            )}
          </div>
        )}
      </div>
    </>
  );

  /* ---------------- 底部操作 ---------------- */
  const footerActions = (
    <>
      <button className="link-copy" onClick={handleCopyLink}>
        {copied ? <Check size={13} /> : <Copy size={13} />}
        {copied ? '已复制' : '复制投递主页'}
      </button>
      <div className={isModal ? 'modal-foot-btns' : undefined} style={{ display: 'flex', gap: 8 }}>
        <button
          className="btn btn-soft"
          onClick={() => onViewCandidates?.(job)}
          style={{ padding: '7px 14px', fontSize: 13 }}
          title="跳转到候选人页面，并按该岗位筛选"
        >
          <Users size={14} style={{ marginRight: 5 }} />
          查看候选人
          <ArrowRight size={13} style={{ marginLeft: 4 }} />
        </button>
        {onEdit && (
          <button
            className="btn btn-primary"
            onClick={() => onEdit(job)}
            style={{ padding: '7px 16px', fontSize: 13 }}
          >
            <Edit3 size={14} style={{ marginRight: 5 }} /> 编辑岗位
          </button>
        )}
      </div>
    </>
  );

  /* ---------------- 渲染 ---------------- */
  if (isModal) {
    return (
      <>
        <div className="modal-overlay" onClick={onClose} />
        <div className="modal" role="dialog" aria-label="岗位详情" style={{ width: 720 }}>
          <div className="modal-head">
            <div className="modal-head-left">
              <span className="modal-head-icon">
                <Briefcase size={17} />
              </span>
              <div style={{ minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                  <span className="detail-header-code">{jobCode(job)}</span>
                  {statusDot(job.status)}
                  <span className="job-readonly-tag">只读</span>
                </div>
                <h3 style={{ margin: 0, fontSize: 17 }}>{job.title}</h3>
              </div>
            </div>
            <button className="modal-close" onClick={onClose} title="关闭">
              <X size={18} />
            </button>
          </div>
          <div className="modal-body">{detailBody}</div>
          <div className="modal-foot">{footerActions}</div>
        </div>
      </>
    );
  }

  return (
    <>
      <div className="drawer-overlay" onClick={onClose} />
      <aside className="drawer drawer--wide" role="dialog" aria-label="岗位详情">
        {/* ---- Header ---- */}
        <div className="drawer-head">
          <div style={{ minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
              <span className="detail-header-code">{jobCode(job)}</span>
              {statusDot(job.status)}
              <span className="job-readonly-tag">只读</span>
            </div>
            <h3 style={{ margin: 0, fontSize: 17 }}>{job.title}</h3>
          </div>
          <button className="drawer-close" onClick={onClose} title="关闭">
            <X size={18} />
          </button>
        </div>

        <div className="drawer-body">{detailBody}</div>

        {/* ---- Footer Actions ---- */}
        <div className="drawer-footer-actions">{footerActions}</div>
      </aside>
    </>
  );
}
