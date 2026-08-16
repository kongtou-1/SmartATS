import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Calendar,
  Clock,
  User,
  Monitor,
  ExternalLink,
  Bell,
  Edit3,
  XCircle,
  Search,
} from 'lucide-react';
import { api } from '../lib/client';
import { useAuth } from '../components/AuthContext';
import type { InterviewDetail } from '../types';
import InterviewEditModal from '../features/interviews/InterviewEditModal';

/* ------------------------------------------------------------------ */
/*  Types & constants                                                 */
/* ------------------------------------------------------------------ */

type FilterKey = 'ALL' | 'TODAY' | 'UPCOMING' | 'NO_FEEDBACK' | 'PENDING_HR' | 'COMPLETED';

const FILTERS: { key: FilterKey; label: string }[] = [
  { key: 'ALL', label: '全部' },
  { key: 'TODAY', label: '今日面试' },
  { key: 'UPCOMING', label: '待开始' },
  { key: 'NO_FEEDBACK', label: '待录面评' },
  { key: 'PENDING_HR', label: '待HR确认' },
  { key: 'COMPLETED', label: '已完成' },
];

const ROUND_TAG: Record<string, { label: string; cls: string }> = {
  FIRST: { label: '专业初试', cls: 'blue' },
  SECOND: { label: '技术复试', cls: 'indigo' },
  HR: { label: 'HR 终面', cls: 'purple' },
};

function fmtTimeRange(it: InterviewDetail): string {
  const d = new Date(it.scheduled_at);
  if (isNaN(d.getTime())) return '';
  const pad = (n: number) => String(n).padStart(2, '0');
  const end = new Date(d.getTime() + (it.duration_minutes || 60) * 60_000);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} (${pad(d.getHours())}:${pad(d.getMinutes())} - ${pad(end.getHours())}:${pad(end.getMinutes())})`;
}

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

function isOngoing(it: InterviewDetail, now: number): boolean {
  if (it.status !== 'SCHEDULED') return false;
  const start = new Date(it.scheduled_at).getTime();
  return start <= now && now <= start + (it.duration_minutes || 60) * 60_000;
}

/** 面试时间是否已过（到了该填面评的时候）。以开始时间为准：到点即可填写。 */
function isPastDue(it: InterviewDetail, now: number): boolean {
  if (it.status !== 'SCHEDULED') return false;
  return new Date(it.scheduled_at).getTime() <= now;
}

function isToday(it: InterviewDetail): boolean {
  const d = new Date(it.scheduled_at);
  const t = new Date();
  return d.getFullYear() === t.getFullYear() && d.getMonth() === t.getMonth() && d.getDate() === t.getDate();
}

function initialOf(name: string): string {
  return name?.charAt(0) || '?';
}

/* Color palette for avatar backgrounds – deterministic by name */
function avatarColor(name: string): string {
  const colors = ['#2563eb', '#7c3aed', '#059669', '#d97706', '#dc2626', '#0891b2'];
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return colors[Math.abs(hash) % colors.length];
}

/* ------------------------------------------------------------------ */
/*  Page                                                               */
/* ------------------------------------------------------------------ */

export default function InterviewListPage() {
  const { user } = useAuth();
  const [list, setList] = useState<InterviewDetail[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<FilterKey>('ALL');
  const [q, setQ] = useState('');
  const [editTarget, setEditTarget] = useState<InterviewDetail | null>(null);
  const [cancelTarget, setCancelTarget] = useState<InterviewDetail | null>(null);
  const [cancelling, setCancelling] = useState(false);
  const [toast, setToast] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);

  const canManage = user?.role === 'HR' || user?.role === 'SUPER_ADMIN';
  const isInterviewer = user?.role === 'INTERVIEWER';

  const reload = useCallback(() => {
    setLoading(true);
    const fn = isInterviewer ? api.interviewerListInterviews() : api.adminListInterviews();
    fn.then(setList).finally(() => setLoading(false));
  }, [isInterviewer]);

  useEffect(() => { reload(); }, [reload]);

  /* ---- stats computed from raw list (pre-filter) ---- */
  const stats = useMemo(() => {
    const now = Date.now();
    const total = list.length;
    const upcomingOrOngoing = list.filter((it) => it.status === 'SCHEDULED').length;
    const noFeedback = list.filter((it) => it.status === 'SCHEDULED' && !it.feedback).length;
    const pendingHr = list.filter((it) => it.status === 'PENDING_HR_REVIEW').length;
    const passed = list.filter(
      (it) => it.status === 'COMPLETED' && it.feedback?.recommendation === 'PASS'
    ).length;
    return { total, upcomingOrOngoing, noFeedback, pendingHr, passed };
  }, [list]);

  /* ---- filtered & sorted ---- */
  const filtered = useMemo(() => {
    const now = Date.now();
    const qs = q.trim().toLowerCase();

    let rows = list.filter((it) => it.status !== 'CANCELLED');

    switch (filter) {
      case 'TODAY':
        rows = rows.filter(isToday); break;
      case 'UPCOMING':
        rows = rows.filter((it) => it.status === 'SCHEDULED' && new Date(it.scheduled_at).getTime() > now); break;
      case 'NO_FEEDBACK':
        rows = rows.filter((it) => it.status === 'SCHEDULED' && !it.feedback); break;
      case 'PENDING_HR':
        rows = rows.filter((it) => it.status === 'PENDING_HR_REVIEW'); break;
      case 'COMPLETED':
        rows = rows.filter((it) => it.status === 'COMPLETED'); break;
      default: break;
    }

    if (qs) {
      rows = rows.filter(
        (it) =>
          it.candidate_name?.toLowerCase().includes(qs) ||
          it.job_title?.toLowerCase().includes(qs) ||
          it.interviewer_name?.toLowerCase().includes(qs)
      );
    }

    // sort: upcoming first, then by time asc
    return [...rows].sort((a, b) => {
      const pa = a.status === 'SCHEDULED' ? 0 : 1;
      const pb = b.status === 'SCHEDULED' ? 0 : 1;
      if (pa !== pb) return pa - pb;
      return new Date(a.scheduled_at).getTime() - new Date(b.scheduled_at).getTime();
    });
  }, [list, filter, q]);

  async function handleCancel(it: InterviewDetail) {
    setCancelTarget(it);
  }

  function showToast(type: 'ok' | 'err', text: string) {
    setToast({ type, text });
    setTimeout(() => setToast(null), 2600);
  }

  async function handleRemind(it: InterviewDetail) {
    try {
      await api.remindInterview!(it.id);
      showToast('ok', `已向 ${it.interviewer_name || '面试官'} 发送面试提醒`);
    } catch (e) {
      showToast('err', (e as Error).message || '提醒失败');
    }
  }

  async function confirmCancel() {
    if (!cancelTarget) return;
    setCancelling(true);
    try {
      await api.adminCancelInterview(cancelTarget.id);
      setCancelTarget(null);
      reload();
    } catch (e) {
      window.alert((e as Error).message || '取消失败');
    } finally {
      setCancelling(false);
    }
  }

  /* ---- render ---- */
  return (
    <div className="page iv-page">
      {/* ===== Header ===== */}
      {/* ===== Stats Cards ===== */}
      <div className="iv-stats">
        <div className={`iv-stat ${filter === 'ALL' ? 'active' : ''}`} onClick={() => setFilter('ALL')}>
          <div className="iv-stat-label">全部排期</div>
          <div className="iv-stat-num">{stats.total}<span className="iv-stat-unit">场</span></div>
        </div>
        <div className={`iv-stat ${filter === 'UPCOMING' ? 'active' : ''}`} onClick={() => setFilter('UPCOMING')}>
          <div className="iv-stat-label">
            <Clock size={14} /> 待开始 / 进行中
          </div>
          <div className="iv-stat-num">{stats.upcomingOrOngoing}<span className="iv-stat-unit">场</span></div>
        </div>
        <div className={`iv-stat warn ${filter === 'NO_FEEDBACK' ? 'active' : ''}`} onClick={() => setFilter('NO_FEEDBACK')}>
          <div className="iv-stat-label">
            <Bell size={14} /> 待录考官面评
          </div>
          <div className="iv-stat-num">{stats.noFeedback}<span className="iv-stat-unit">场</span></div>
        </div>
        <div className={`iv-stat warn ${filter === 'PENDING_HR' ? 'active' : ''}`} onClick={() => setFilter('PENDING_HR')}>
          <div className="iv-stat-label">
            <Bell size={14} /> 待 HR 确认
          </div>
          <div className="iv-stat-num">{stats.pendingHr}<span className="iv-stat-unit">场</span></div>
        </div>
        <div className={`iv-stat ok ${filter === 'COMPLETED' ? 'active' : ''}`} onClick={() => setFilter('COMPLETED')}>
          <div className="iv-stat-label">已出评级通过</div>
          <div className="iv-stat-num">{stats.passed}<span className="iv-stat-unit">场</span></div>
        </div>
      </div>

      {/* ===== Filter Tabs ===== */}
      <div className="iv-filter-bar">
        <div className="iv-tabs">
          {FILTERS.map((f) => (
            <button key={f.key} className={filter === f.key ? 'active' : ''} onClick={() => setFilter(f.key)}>
              {f.label}
            </button>
          ))}
        </div>
        <div className="iv-filter-right">
          <span className="muted">共找到 {filtered.length} 场面试记录</span>
        </div>
      </div>

      {/* ===== Search (inline, compact) ===== */}
      <div className="iv-search-row">
        <div className="search-box" style={{ maxWidth: 320 }}>
          <Search size={15} className="si" />
          <input type="text" placeholder="搜索候选人 / 岗位 / 面试官…" value={q} onChange={(e) => setQ(e.target.value)} />
          {q && <button className="clear" onClick={() => setQ('')} title="清除">×</button>}
        </div>
      </div>

      {/* ===== Card List ===== */}
      {loading ? (
        <div className="page-loading">加载中…</div>
      ) : filtered.length === 0 ? (
        <div className="empty"><b>暂无面试记录</b><span className="muted">切换筛选条件试试吧</span></div>
      ) : (
        <div className="iv-cards">
          {filtered.map((it) => {
            const scheduled = it.status === 'SCHEDULED';
            const ongoing = scheduled && isOngoing(it, Date.now());
            const pastDue = scheduled && isPastDue(it, Date.now());
            const rt = ROUND_TAG[it.round_type] || { label: it.round_type, cls: 'gray' };

            return (
              <div key={it.id} className={`iv-card ${ongoing ? 'iv-card-ongoing' : ''}`}>
                {/* --- Top row: avatar + name + status --- */}
                <div className="iv-card-head">
                  <div className="iv-card-profile">
                    <span
                      className="iv-avatar"
                      style={{ background: avatarColor(it.candidate_name || '?') }}
                    >
                      {initialOf(it.candidate_name)}
                    </span>
                    <div className="iv-card-name-row">
                      <Link to={`/interviews/${it.id}`} className="iv-card-name">
                        {it.candidate_name}
                      </Link>
                      <span className={`tag tag-${rt.cls} tag-sm`}>{rt.label}</span>
                    {scheduled && !it.feedback && pastDue && (
                      <span className="tag tag-sm tag-red">逾期待评</span>
                    )}
                    {scheduled && !it.feedback && !pastDue && (
                      <span className="tag tag-sm tag-amber">待面评</span>
                    )}
                    {it.status === 'PENDING_HR_REVIEW' && (
                      <span className="tag tag-sm tag-amber">待HR确认</span>
                    )}
                      {it.feedback && (
                        <span className={`tag tag-sm ${it.feedback.recommendation === 'PASS' ? 'tag-green' : it.feedback.recommendation === 'FAIL' ? 'tag-red' : 'tag-gray'}`}>
                          {it.feedback.recommendation === 'PASS' ? '已通过' : it.feedback.recommendation === 'FAIL' ? '未通过' : '待定'}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="iv-card-status-col">
                    {scheduled && !ongoing && <span className="iv-status-pill iv-status-sched">待开始</span>}
                    {ongoing && <span className="iv-status-pill iv-status-live">进行中</span>}
                    {it.status === 'COMPLETED' && <span className="iv-status-pill iv-status-done">已完成</span>}
                    {it.status === 'PENDING_HR_REVIEW' && <span className="iv-status-pill iv-status-pending">待HR确认</span>}
                  </div>
                </div>

                {/* --- Job title --- */}
                <div className="iv-card-job">
                  应聘职位：{it.job_title}
                </div>

                {/* --- Meta row: time · interviewer · method + actions --- */}
                <div className="iv-card-meta">
                  <div className="iv-card-meta-left">
                    <span className="iv-meta-item">
                      <Calendar size={14} />
                      {fmtTimeRange(it)}
                    </span>
                    <span className="iv-meta-item">
                      <User size={14} />
                      主考官：{it.interviewer_name}
                    </span>
                    <span className="iv-meta-item">
                      <Monitor size={14} />
                      {it.method || '未指定'}
                    </span>
                    {!it.meeting_url && scheduled && (
                      <span className="iv-meta-item muted" style={{ fontSize: 12 }}>
                        <ExternalLink size={14} /> 无会议链接
                      </span>
                    )}
                  </div>
                  <div className="iv-card-meta-actions">
                    <Link to={`/interviews/${it.id}`} className="btn btn-sm iv-open-btn" title="进入面试详情">
                      <ExternalLink size={13} /> 进入
                    </Link>
                    {it.meeting_url && (
                      <a href={it.meeting_url} target="_blank" rel="noreferrer" className="btn btn-primary btn-sm iv-meet-btn">
                        <ExternalLink size={13} /> 进入会议
                      </a>
                    )}
                    {canManage && scheduled && (
                      <>
                        <button className="link-btn" onClick={() => setEditTarget(it)} title="改期 / 编辑">
                          <Edit3 size={14} /> 改期
                        </button>
                        <button className="link-btn danger" onClick={() => handleCancel(it)} title="取消面试">
                          <XCircle size={14} /> 取消
                        </button>
                      </>
                    )}
                    {canManage && (scheduled || it.status === 'PENDING_HR_REVIEW') && (
                      <button className="link-btn" onClick={() => handleRemind(it)} title="提醒面试官">
                        <Bell size={14} /> 提醒考官
                      </button>
                    )}
                  </div>
                </div>

                {/* --- Action row: interviewer only --- */}
                {(isInterviewer && scheduled && (!ongoing || (pastDue && !it.feedback))) ? (
                <div className="iv-card-actions">
                  <div className="iv-card-actions-right">
                    {isInterviewer && scheduled && pastDue && !it.feedback && (
                      <Link to={`/interviews/${it.id}`} className="btn btn-sm iv-feedback-btn">
                        录入/提交考官面评
                      </Link>
                    )}
                  </div>
                </div>
                ) : null}

              </div>
            );
          })}
        </div>
      )}

      {/* ===== Edit Modal ===== */}
      <InterviewEditModal
        open={!!editTarget}
        interview={editTarget}
        onClose={() => setEditTarget(null)}
        onSaved={() => { setEditTarget(null); reload(); }}
      />

      {/* ===== Cancel confirm Modal（替代浏览器 window.confirm） ===== */}
      {cancelTarget && (
        <div className="modal-overlay" onMouseDown={() => !cancelling && setCancelTarget(null)}>
          <div
            className="modal"
            style={{ width: 440 }}
            onMouseDown={(e) => e.stopPropagation()}
          >
            <div className="modal-head">
              <div className="modal-head-left">
                <div className="modal-head-icon" style={{ background: 'var(--red-soft)', color: 'var(--red)' }}>
                  <XCircle size={18} />
                </div>
                <div>
                  <h3>取消面试</h3>
                  <p className="muted" style={{ margin: 0, fontSize: 12.5 }}>
                    {cancelTarget.candidate_name} · {ROUND_TAG[cancelTarget.round_type]?.label || cancelTarget.round_type}面试
                  </p>
                </div>
              </div>
              <button className="modal-close" onClick={() => !cancelling && setCancelTarget(null)}>
                ×
              </button>
            </div>
            <div className="modal-body">
              <p style={{ margin: 0, color: 'var(--ink-2)', fontSize: 13.5, lineHeight: 1.6 }}>
                确认要取消该场面试吗？取消后候选人侧将同步更新为已取消，此操作不可通过本页面恢复。
              </p>
            </div>
            <div className="modal-foot">
              <span className="modal-meta">取消后可在候选人详情中重新安排</span>
              <div className="modal-foot-btns">
                <button className="btn" onClick={() => !cancelling && setCancelTarget(null)} disabled={cancelling}>
                  暂不取消
                </button>
                <button
                  className="btn btn-danger"
                  onClick={confirmCancel}
                  disabled={cancelling}
                >
                  {cancelling ? '取消中…' : '确认取消'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {toast && (
        <div
          style={{
            position: 'fixed',
            top: 16,
            right: 16,
            zIndex: 1200,
            background: toast.type === 'ok' ? 'var(--primary, #2563eb)' : 'var(--red, #dc2626)',
            color: '#fff',
            padding: '10px 16px',
            borderRadius: 10,
            boxShadow: '0 8px 30px rgba(0,0,0,0.2)',
            fontSize: 13,
            maxWidth: 320,
          }}
        >
          {toast.text}
        </div>
      )}
    </div>
  );
}
