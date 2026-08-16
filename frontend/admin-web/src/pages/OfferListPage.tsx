import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { FileCheck2, Clock, Send, CheckCircle2 } from 'lucide-react';
import { api } from '../lib/client';
import { downloadFile } from '../lib/api';
import { useAuth } from '../components/AuthContext';
import { useShell } from '../components/ShellContext';
import JobDetailDrawer from '../components/JobDetailDrawer';
import CandidateDetailDrawer from '../features/candidates/CandidateDetailDrawer';
import type { AdminApplication, JobWithStats, Offer, OfferStatus } from '../types';

const LABELS: Record<OfferStatus, string> = {
  DRAFT: '草稿',
  PENDING_APPROVAL: '待审批',
  APPROVED: '已审批',
  SENT: '已发送',
  ACCEPTED: '已接受',
  DECLINED: '已拒绝',
  EXPIRED: '已过期',
  VOIDED: '已作废',
  REJECTED_APPROVAL: '审批驳回',
};

function statusPill(s: OfferStatus): string {
  const map: Record<OfferStatus, string> = {
    DRAFT: 'gray',
    PENDING_APPROVAL: 'amber',
    APPROVED: 'blue',
    SENT: 'indigo',
    ACCEPTED: 'emerald',
    DECLINED: 'rose',
    EXPIRED: 'gray',
    VOIDED: 'gray',
    REJECTED_APPROVAL: 'rose',
  };
  return map[s];
}

export default function OfferListPage() {
  const { user } = useAuth();
  const shell = useShell();
  const navigate = useNavigate();
  const [rows, setRows] = useState<Offer[]>([]);
  const [statusFilter, setStatusFilter] = useState<OfferStatus | 'ALL'>('ALL');
  const [msg, setMsg] = useState('');
  const [drawerApp, setDrawerApp] = useState<AdminApplication | null>(null);
  const [drawerJob, setDrawerJob] = useState<JobWithStats | null>(null);

  const load = () => {
    const p = api.listOffers?.();
    if (p) p.then(setRows);
  };
  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const filtered = useMemo(() => {
    const q = shell.searchQuery.trim().toLowerCase();
    return rows.filter((o) => {
      if (statusFilter !== 'ALL' && o.status !== statusFilter) return false;
      if (q) {
        const hay = `${o.candidate_name} ${o.job_title}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [rows, statusFilter, shell.searchQuery]);

  const stats = [
    { label: 'Offer 总数', val: rows.length, icon: FileCheck2, cls: 'blue' },
    {
      label: '待审批',
      val: rows.filter((o) => o.status === 'PENDING_APPROVAL').length,
      icon: Clock,
      cls: 'amber',
    },
    {
      label: '已发送',
      val: rows.filter((o) => o.status === 'SENT').length,
      icon: Send,
      cls: 'indigo',
    },
    {
      label: '已接受',
      val: rows.filter((o) => o.status === 'ACCEPTED').length,
      icon: CheckCircle2,
      cls: 'emerald',
    },
  ];

  async function act(o: Offer, action: string) {
    const comment = action === 'reject' ? prompt('请输入驳回原因') || '' : '';
    if (action === 'reject' && !comment) return;
    const p = api.offerAction?.(o.id, action, { comment });
    if (p) await p;
    void load();
  }

  /** 点击「候选人」：打开候选人详情抽屉（按 application_id 加载完整档案） */
  function openCandidate(o: Offer) {
    setDrawerApp({
      id: o.application_id,
      candidate_id: o.candidate_id,
      job_id: o.job_id,
      current_stage: 'FINAL_REVIEW',
      status: 'ACTIVE',
      ai_score: null,
      applied_at: o.created_at,
      candidate_name: o.candidate_name,
      job_title: o.job_title,
      latest_company: '',
      latest_school: '',
      latest_degree: '',
      skills: [],
      next_interview_at: null,
      next_interview_round: '',
      next_interviewer_name: '',
    });
  }
  /** 点击「岗位」：拉取岗位详情后打开岗位抽屉 */
  async function openJob(o: Offer) {
    try {
      const j = await api.adminGetJob(o.job_id);
      setDrawerJob(j);
    } catch {
      setMsg('岗位详情加载失败');
    }
  }
  /** 岗位抽屉里「查看候选人」：跳转到候选人页并按该岗位筛选 */
  function goCandidates(j: JobWithStats) {
    navigate(
      `/candidates?jobId=${encodeURIComponent(j.id)}&jobTitle=${encodeURIComponent(j.title)}`,
    );
    setDrawerJob(null);
  }

  return (
    <div className="page">
      <div className="stat-grid">
        {stats.map((s) => {
          const Icon = s.icon;
          return (
            <div className="stat-card" key={s.label}>
              <div className="row">
                <span className="title">{s.label}</span>
                <span className={`ic ${s.cls}`}>
                  <Icon size={18} />
                </span>
              </div>
              <div className="val">{s.val}</div>
            </div>
          );
        })}
      </div>

      <div className="seg" style={{ marginBottom: 14 }}>
        {(
          [
            { v: 'ALL', l: '全部' },
            { v: 'PENDING_APPROVAL', l: '待审批' },
            { v: 'SENT', l: '已发送' },
            { v: 'ACCEPTED', l: '已接受' },
          ] as { v: OfferStatus | 'ALL'; l: string }[]
        ).map((t) => (
          <button
            key={t.v}
            className={statusFilter === t.v ? 'active' : ''}
            onClick={() => setStatusFilter(t.v)}
          >
            {t.l}
          </button>
        ))}
      </div>

      {msg && <div className="alert">{msg}</div>}

      <div className="card-2xl">
        <div style={{ padding: '14px 18px', borderBottom: '1px solid var(--line)' }}>
          <span className="muted">共 {filtered.length} 份 Offer</span>
        </div>
        <div style={{ overflowX: 'auto' }}>
          <table className="table">
            <thead>
              <tr>
                <th>候选人</th>
                <th>岗位</th>
                <th>入职日期</th>
                <th>有效期</th>
                <th>状态</th>
                <th>操作</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((o) => (
                <tr key={o.id}>
                  <td className="cell-title">
                    <span
                      className="title-link"
                      title="查看候选人详情"
                      onClick={() => openCandidate(o)}
                    >
                      {o.candidate_name}
                    </span>
                  </td>
                  <td>
                    <span
                      className="title-link"
                      title="查看岗位详情"
                      onClick={() => openJob(o)}
                    >
                      {o.job_title}
                    </span>
                  </td>
                  <td>{new Date(o.expected_start_date).toLocaleDateString()}</td>
                  <td>{new Date(o.expires_at).toLocaleString()}</td>
                  <td>
                    <span className={`tag tag-${statusPill(o.status)}`}>
                      {LABELS[o.status]}
                    </span>
                  </td>
                  <td className="row-actions">
                    {user?.role === 'HR' &&
                      ['DRAFT', 'REJECTED_APPROVAL'].includes(o.status) && (
                        <button className="btn-link" onClick={() => act(o, 'submit')}>
                          提交审批
                        </button>
                      )}
                    {user?.role === 'HR' && o.status === 'APPROVED' && (
                      <button className="btn-link" onClick={() => act(o, 'send')}>
                        发送
                      </button>
                    )}
                    {user?.role === 'SUPER_ADMIN' && o.status === 'PENDING_APPROVAL' && (
                      <>
                        <button className="btn-link" onClick={() => act(o, 'approve')}>
                          批准
                        </button>
                        <button
                          className="btn-link danger"
                          onClick={() => act(o, 'reject')}
                        >
                          驳回
                        </button>
                      </>
                    )}
                    {o.current_version > 0 && (
                      <button
                        className="btn-link"
                        onClick={() =>
                          downloadFile(
                            `/admin/offers/${o.id}/pdf`,
                            `Offer-${o.candidate_name}.pdf`,
                          )
                        }
                      >
                        PDF
                      </button>
                    )}
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={6}>
                    <div className="empty">暂无符合条件的 Offer</div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <JobDetailDrawer
        job={drawerJob}
        onClose={() => setDrawerJob(null)}
        onViewCandidates={goCandidates}
      />
      <CandidateDetailDrawer app={drawerApp} onClose={() => setDrawerApp(null)} />
    </div>
  );
}
