import { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { MapPin, Users, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { api } from '../lib/client';
import { useShell } from '../components/ShellContext';
import JobStatsBar from '../components/JobStatsBar';
import JobDetailDrawer from '../components/JobDetailDrawer';
import JobEditModal from '../components/JobEditModal';
import { formatSalary } from '../types';
import type { JobStatus, JobType, JobWithStats } from '../types';
import {
  JOB_STATUS_LABELS,
  JOB_TYPE_LABELS,
  URGENCY_LABELS,
} from '../types';

const TYPE_OPTIONS: { value: JobType | 'ALL'; label: string }[] = [
  { value: 'ALL', label: '招聘类型（全部）' },
  { value: 'INTERN', label: JOB_TYPE_LABELS.INTERN },
  { value: 'SOCIAL', label: JOB_TYPE_LABELS.SOCIAL },
  { value: 'CAMPUS', label: JOB_TYPE_LABELS.CAMPUS },
];

function typeBadgeClass(t: JobType): string {
  switch (t) {
    case 'SOCIAL': return 'social';
    case 'CAMPUS': return 'campus';
    case 'INTERN': return 'intern';
    default: return '';
  }
}

function statusDotClass(s: JobStatus): string {
  switch (s) {
    case 'PUBLISHED': return 'sd-green';
    case 'DRAFT': return 'sd-blue';
    case 'CLOSED': return 'sd-gray';
    default: return 'sd-gray';
  }
}

/** Generate a short job code like TECH-FE-001 from id */
function jobCode(job: JobWithStats): string {
  const prefix = job.category_code?.toUpperCase().replace(/_/g, '-') ?? 'JOB';
  const short = job.id.slice(0, 4).toUpperCase();
  return `${prefix}-${short}`;
}

function downloadCsv(jobs: JobWithStats[]) {
  const header = ['岗位名称', '方向', '类型', '地点', '招聘人数', '薪资', '状态', '投递数', '创建时间'];
  const rows = jobs.map((j) => [
    j.title,
    j.category_name || '',
    JOB_TYPE_LABELS[j.job_type],
    j.location,
    String(j.headcount ?? ''),
    formatSalary(j),
    JOB_STATUS_LABELS[j.status],
    String(j.applications_total),
    j.created_at,
  ]);
  const csv = [header, ...rows]
    .map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(','))
    .join('\n');
  const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `岗位列表_${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

export default function JobListPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const params = useParams();
  const shell = useShell();
  const [jobs, setJobs] = useState<JobWithStats[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<JobStatus | 'ALL'>('ALL');
  const [typeFilter, setTypeFilter] = useState<JobType | 'ALL'>('ALL');
  const [categoryFilter, setCategoryFilter] = useState<string>('ALL');
  const [locationFilter, setLocationFilter] = useState<string>('ALL');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [drawerJob, setDrawerJob] = useState<JobWithStats | null>(null);
  const [editOpen, setEditOpen] = useState(false);
  const [editJob, setEditJob] = useState<JobWithStats | null>(null);
  const [closeTarget, setCloseTarget] = useState<JobWithStats | null>(null);
  const [publishTarget, setPublishTarget] = useState<JobWithStats | null>(null);

  function load() {
    setLoading(true);
    api
      .adminListJobs()
      .then(setJobs)
      .finally(() => setLoading(false));
  }
  useEffect(load, []);

  // 深链：/jobs/new → 新建弹窗；/jobs/:id/edit → 编辑弹窗；/jobs/:id → 只读详情抽屉
  const isNewPath = location.pathname.endsWith('/new');
  const isEditPath = location.pathname.endsWith('/edit');
  const routeId = params.id;
  useEffect(() => {
    if (isNewPath) {
      setDrawerJob(null);
      setEditJob(null);
      setEditOpen(true);
      return;
    }
    if (routeId && isEditPath) {
      setEditOpen(false);
      api
        .adminGetJob(routeId)
        .then((j) => {
          setDrawerJob(null);
          setEditJob(j);
          setEditOpen(true);
        })
        .catch(() => setEditOpen(false));
      return;
    }
    if (routeId) {
      // 只读详情：不进入编辑态
      setEditOpen(false);
      api
        .adminGetJob(routeId)
        .then((j) => setDrawerJob(j))
        .catch(() => setDrawerJob(null));
      return;
    }
    setEditOpen(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isNewPath, isEditPath, routeId]);

  function openCreate() {
    setEditJob(null);
    setEditOpen(true);
  }
  /** 打开只读详情（点击行 / 岗位名称的默认行为） */
  function openDetail(j: JobWithStats) {
    setDrawerJob(j);
  }
  /** 仅在明确点击「编辑」时才进入编辑态 */
  function openEdit(j: JobWithStats) {
    setDrawerJob(null);
    setEditJob(j);
    setEditOpen(true);
  }
  function closeDetail() {
    setDrawerJob(null);
    if (routeId && !isEditPath) navigate('/jobs');
  }
  /** 跳转候选人页，并带上岗位筛选 */
  function goCandidates(j: JobWithStats) {
    setDrawerJob(null);
    navigate(
      `/candidates?jobId=${encodeURIComponent(j.id)}&jobTitle=${encodeURIComponent(j.title)}`,
    );
  }
  function closeModal() {
    setEditOpen(false);
    navigate('/jobs');
  }
  function handleSaved() {
    setEditOpen(false);
    navigate('/jobs');
    load();
  }

  // 头部主操作 + 导出
  useEffect(() => {
    shell.setPrimaryAction({ label: '新建岗位', onClick: openCreate });
    return () => shell.setPrimaryAction(undefined);
  }, [shell]);

  useEffect(() => {
    shell.setExportFn(() => downloadCsv(jobs));
    return () => shell.setExportFn(undefined);
  }, [shell, jobs]);

  async function confirmClose(id: string) {
    await api.adminCloseJob(id);
    setCloseTarget(null);
    load();
  }
  async function confirmPublish(id: string) {
    await api.adminPublishJob(id);
    setPublishTarget(null);
    load();
  }
  function toggleSelect(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }
  async function batchClose() {
    for (const id of selected) {
      if (jobs.find((j) => j.id === id)?.status === 'PUBLISHED') {
        await api.adminCloseJob(id);
      }
    }
    setSelected(new Set());
    load();
  }

  const categoryOptions = useMemo(() => {
    const map = new Map<string, string>();
    jobs.forEach((j) => {
      if (j.category_code && j.category_name) map.set(j.category_code, j.category_name);
    });
    return Array.from(map, ([code, name]) => ({ code, name }));
  }, [jobs]);
  const locationOptions = useMemo(
    () => Array.from(new Set(jobs.map((j) => j.location).filter(Boolean))).sort(),
    [jobs],
  );

  const filtered = useMemo(() => {
    const q = shell.searchQuery.trim().toLowerCase();
    return jobs.filter((j) => {
      if (statusFilter !== 'ALL' && j.status !== statusFilter) return false;
      if (typeFilter !== 'ALL' && j.job_type !== typeFilter) return false;
      if (categoryFilter !== 'ALL' && j.category_code !== categoryFilter) return false;
      if (locationFilter !== 'ALL' && j.location !== locationFilter) return false;
      if (q) {
        const hay = `${j.title} ${j.location} ${j.category_name || ''}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [jobs, statusFilter, typeFilter, categoryFilter, locationFilter, shell.searchQuery]);

  const allChecked = filtered.length > 0 && filtered.every((j) => selected.has(j.id));

  return (
    <div className="page">
      <JobStatsBar jobs={jobs} active={statusFilter} onSelect={setStatusFilter} />

      <div className="card-2xl">
        {/* Compact filter row */}
        <div className="filter-row" style={{ padding: '14px 18px 10px' }}>
          <div className="filter-compact" style={{ flex: 1 }}>
            <select
              className="input"
              value={locationFilter}
              onChange={(e) => setLocationFilter(e.target.value)}
            >
              <option value="ALL">全部地点（全国）</option>
              {locationOptions.map((l) => (
                <option key={l} value={l}>{l}</option>
              ))}
            </select>
            <select
              className="input"
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value as JobType | 'ALL')}
            >
              {TYPE_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
            <select
              className="input"
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
            >
              <option value="ALL">全部方向</option>
              {categoryOptions.map((o) => (
                <option key={o.code} value={o.code}>{o.name}</option>
              ))}
            </select>
          </div>
          <span className="muted" style={{ fontSize: 12.5, whiteSpace: 'nowrap' }}>
            共 <b>{filtered.length}</b> 个岗位
          </span>
        </div>

        {selected.size > 0 && (
          <div className="batch-bar">
            <span>已选 {selected.size} 个</span>
            <button className="btn btn-danger" onClick={batchClose}>
              批量关闭
            </button>
            <button className="btn-link" onClick={() => setSelected(new Set())}>
              取消选择
            </button>
          </div>
        )}

        {loading ? (
          <div className="page-loading">加载中…</div>
        ) : (
          <div style={{ padding: 4, overflowX: 'auto' }}>
            <table className="table">
              <thead>
                <tr>
                  <th style={{ width: 38 }}>
                    <input
                      type="checkbox"
                      checked={allChecked}
                      onChange={(e) =>
                        setSelected(
                          e.target.checked
                            ? new Set(filtered.map((j) => j.id))
                            : new Set(),
                        )
                      }
                    />
                  </th>
                  <th>岗位名称</th>
                  <th>方向</th>
                  <th>类型</th>
                  <th>地点</th>
                  <th>薪资与通道</th>
                  <th>状态</th>
                  <th style={{ width: 210 }}>操作</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((j) => (
                  <tr key={j.id} onClick={() => openDetail(j)} title="点击查看岗位详情">
                    <td onClick={(e) => e.stopPropagation()}>
                      <input
                        type="checkbox"
                        checked={selected.has(j.id)}
                        onChange={() => toggleSelect(j.id)}
                      />
                    </td>
                    <td>
                      <div className="job-cell-title">
                        <div className="title-row">
                          <span
                            className="title-link"
                            title="查看岗位详情"
                            onClick={(e) => { e.stopPropagation(); openDetail(j); }}
                          >
                            {j.title}
                          </span>
                          {j.urgency === 'HIGH' && (
                            <span className="urgency-tag">急聘</span>
                          )}
                        </div>
                        <div className="job-cell-sub">
                          <span>{jobCode(j)}</span>
                          {formatSalary(j) !== '—' && (
                            <> · {formatSalary(j)}</>
                          )}
                          {j.headcount != null && (
                            <> · 编制{j.headcount}人</>
                          )}
                        </div>
                      </div>
                    </td>
                    <td>{j.category_name || '—'}</td>
                    <td>
                      <span className={`badge-pill ${typeBadgeClass(j.job_type)}`}>
                        {JOB_TYPE_LABELS[j.job_type]}
                      </span>
                    </td>
                    <td>
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, color: 'var(--ink-2)', fontSize: 13 }}>
                        <MapPin size={13} style={{ color: 'var(--muted)' }} />
                        {j.location}
                      </span>
                    </td>
                    <td>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                        <span style={{ fontWeight: 600, fontSize: 13 }}>{formatSalary(j)}</span>
                        <span
                          className="applied-count-link"
                          title="查看该岗位候选人"
                          onClick={(e) => { e.stopPropagation(); goCandidates(j); }}
                        >
                          {j.applications_total || 0} 人已投递
                        </span>
                      </div>
                    </td>
                    <td>
                      <span className={`status-dot ${statusDotClass(j.status)}`}>
                        {JOB_STATUS_LABELS[j.status]}
                      </span>
                    </td>
                    <td className="row-actions" onClick={(e) => e.stopPropagation()}>
                      <button className="btn-link" onClick={() => openDetail(j)}>
                        详情
                      </button>
                      <button className="btn-link" onClick={() => openEdit(j)}>
                        编辑
                      </button>
                      <button
                        className="btn-link"
                        title="跳转候选人页面（已按该岗位筛选）"
                        onClick={() => goCandidates(j)}
                      >
                        <Users size={13} style={{ marginRight: 3, verticalAlign: '-2px' }} />
                        候选人
                      </button>
                    {j.status === 'PUBLISHED' ? (
                      <button className="btn-link" onClick={() => setCloseTarget(j)}>
                        关闭
                      </button>
                    ) : (
                        <button className="btn-link" onClick={() => setPublishTarget(j)}>
                          发布
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
                {filtered.length === 0 && (
                  <tr>
                    <td colSpan={8}>
                      <div className="empty">没有符合条件的岗位</div>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>

            {/* Pagination placeholder */}
            {filtered.length > 0 && (
              <div style={{
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                padding: '12px 16px', borderTop: '1px solid var(--line)',
                fontSize: 12, color: 'var(--muted)',
              }}>
                <span>第 {filtered.length} 条候选信息，当前显示第 1 / 1 页</span>
                <div style={{ display: 'flex', gap: 6 }}>
                  <button className="btn" disabled style={{ padding: '5px 12px', fontSize: 12 }}>上一页</button>
                  <button className="btn btn-primary" disabled style={{ padding: '5px 12px', fontSize: 12 }}>1</button>
                  <button className="btn" disabled style={{ padding: '5px 12px', fontSize: 12 }}>下一页</button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      <JobDetailDrawer
        job={drawerJob}
        onClose={closeDetail}
        onEdit={openEdit}
        onViewCandidates={goCandidates}
      />
      <JobEditModal open={editOpen} job={editJob} onClose={closeModal} onSaved={handleSaved} />

      {closeTarget && (
        <div className="modal-overlay" onMouseDown={() => setCloseTarget(null)}>
          <div
            className="modal"
            style={{ width: 460 }}
            onMouseDown={(e) => e.stopPropagation()}
          >
            <div className="modal-head">
              <div className="modal-head-left">
                <div
                  className="modal-head-icon"
                  style={{ background: 'var(--amber-soft)', color: 'var(--amber)' }}
                >
                  <AlertTriangle size={18} />
                </div>
                <div>
                  <h3>关闭岗位</h3>
                  <p style={{ color: 'var(--muted)', fontSize: 12.5 }}>{closeTarget.title}</p>
                </div>
              </div>
              <button className="modal-close" onClick={() => setCloseTarget(null)}>
                ×
              </button>
            </div>
            <div className="modal-body">
              <p style={{ margin: 0, color: 'var(--muted)', fontSize: 13.5, lineHeight: 1.65 }}>
                关闭后该岗位将停止接收新的简历投递，已投递的候选人不受影响。确认关闭此岗位？
              </p>
            </div>
            <div className="modal-foot modal-foot--end">
              <div className="modal-foot-btns">
                <button className="btn" onClick={() => setCloseTarget(null)}>
                  取消
                </button>
                <button className="btn btn-danger" onClick={() => confirmClose(closeTarget.id)}>
                  确认关闭
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {publishTarget && (
        <div className="modal-overlay" onMouseDown={() => setPublishTarget(null)}>
          <div
            className="modal"
            style={{ width: 460 }}
            onMouseDown={(e) => e.stopPropagation()}
          >
            <div className="modal-head">
              <div className="modal-head-left">
                <div
                  className="modal-head-icon"
                  style={{ background: 'var(--primary-soft)', color: 'var(--primary)' }}
                >
                  <CheckCircle2 size={18} />
                </div>
                <div>
                  <h3>发布岗位</h3>
                  <p style={{ color: 'var(--muted)', fontSize: 12.5 }}>{publishTarget.title}</p>
                </div>
              </div>
              <button className="modal-close" onClick={() => setPublishTarget(null)}>
                ×
              </button>
            </div>
            <div className="modal-body">
              <p style={{ margin: 0, color: 'var(--muted)', fontSize: 13.5, lineHeight: 1.65 }}>
                发布后该岗位将对外公开招聘，开始接收简历投递。确认发布此岗位？
              </p>
            </div>
            <div className="modal-foot modal-foot--end">
              <div className="modal-foot-btns">
                <button className="btn" onClick={() => setPublishTarget(null)}>
                  取消
                </button>
                <button className="btn btn-primary" onClick={() => confirmPublish(publishTarget.id)}>
                  确认发布
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
