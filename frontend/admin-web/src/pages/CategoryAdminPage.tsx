import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../components/AuthContext';
import { api } from '../lib/client';
import CategoryEditModal from '../components/CategoryEditModal';
import CategoryJobDrawer from '../components/CategoryJobDrawer';
import JobDetailDrawer from '../components/JobDetailDrawer';
import {
  formatSalary,
  JOB_STATUS_LABELS,
  JOB_TYPE_LABELS,
  EXPERIENCE_OPTIONS,
  EDUCATION_OPTIONS,
} from '../types';
import type { JobCategory, JobCategoryInput, JobWithStats } from '../types';

/* ----------------------------- Types ----------------------------- */

interface TreeNode extends JobCategory {
  children: TreeNode[];
  depth: number;
}

/* ----------------------------- Tree helpers ----------------------------- */

function buildTree(list: JobCategory[]): TreeNode[] {
  const map = new Map<string, TreeNode>();
  list.forEach((c) => map.set(c.code, { ...c, children: [], depth: 0 }));
  const roots: TreeNode[] = [];
  map.forEach((node) => {
    if (node.parent_code && map.has(node.parent_code)) {
      map.get(node.parent_code)!.children.push(node);
    } else {
      roots.push(node);
    }
  });
  const sortFn = (a: TreeNode, b: TreeNode) =>
    a.sort_order - b.sort_order || a.name.localeCompare(b.name, 'zh-Hans-CN');
  const sortRec = (nodes: TreeNode[]) => {
    nodes.sort(sortFn);
    nodes.forEach((n) => sortRec(n.children));
  };
  sortRec(roots);
  const walk = (nodes: TreeNode[], depth: number) => {
    nodes.forEach((n) => {
      n.depth = depth;
      walk(n.children, depth + 1);
    });
  };
  walk(roots, 0);
  return roots;
}

function filterTree(nodes: TreeNode[], q: string): TreeNode[] {
  const lower = q.trim().toLowerCase();
  if (!lower) return nodes;
  const rec = (n: TreeNode): TreeNode | null => {
    const selfMatch =
      n.name.toLowerCase().includes(lower) ||
      n.code.toLowerCase().includes(lower) ||
      (n.owner_name || '').toLowerCase().includes(lower);
    const kids = n.children.map(rec).filter(Boolean) as TreeNode[];
    if (selfMatch || kids.length) return { ...n, children: kids };
    return null;
  };
  return nodes.map(rec).filter(Boolean) as TreeNode[];
}

function filterHiring(nodes: TreeNode[]): TreeNode[] {
  const rec = (n: TreeNode): TreeNode | null => {
    const kids = n.children.map(rec).filter(Boolean) as TreeNode[];
    if ((n.open_job_count || 0) > 0 || kids.length) return { ...n, children: kids };
    return null;
  };
  return nodes.map(rec).filter(Boolean) as TreeNode[];
}

/* ----------------------------- UI helpers ----------------------------- */

function Chevron({ open }: { open: boolean }) {
  return (
    <svg
      width="10"
      height="10"
      viewBox="0 0 10 10"
      fill="currentColor"
      aria-hidden
      style={{ transform: open ? 'rotate(90deg)' : undefined, transition: 'transform .15s' }}
    >
      <path d="M3 1.5 L7 5 L3 8.5 Z" />
    </svg>
  );
}

function FolderIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" strokeLinecap="round">
      <path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7Z" fill="currentColor" fillOpacity="0.12" />
    </svg>
  );
}

function TagIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" strokeLinecap="round">
      <path d="M3 12V5a2 2 0 0 1 2-2h7l9 9-9 9-9-9Z" />
      <circle cx="8" cy="8" r="1.4" fill="currentColor" stroke="none" />
    </svg>
  );
}

function Avatar({ name }: { name: string }) {
  const initial = name ? name.charAt(0) : '?';
  return (
    <div
      style={{
        width: 32,
        height: 32,
        borderRadius: '50%',
        background: 'var(--primary-soft)',
        color: 'var(--primary-strong)',
        display: 'grid',
        placeItems: 'center',
        fontWeight: 700,
        fontSize: 13,
        flexShrink: 0,
      }}
    >
      {initial}
    </div>
  );
}

function typeBadgeClass(t: string): string {
  switch (t) {
    case 'SOCIAL': return 'social';
    case 'CAMPUS': return 'campus';
    case 'INTERN': return 'intern';
    default: return '';
  }
}

function jobCode(job: JobWithStats): string {
  const prefix = job.category_code?.toUpperCase().replace(/_/g, '-') ?? 'JOB';
  const short = job.id.slice(0, 4).toUpperCase();
  return `${prefix}-${short}`;
}

function expLabel(v?: string | null): string {
  return EXPERIENCE_OPTIONS.find((o) => o.value === v)?.label ?? '经验不限';
}

function eduLabel(v?: string | null): string {
  return EDUCATION_OPTIONS.find((o) => o.value === v)?.label ?? '学历不限';
}

/* ----------------------------- Job card ----------------------------- */

function JobCard({
  job,
  onView,
}: {
  job: JobWithStats;
  onView: (job: JobWithStats) => void;
}) {
  const navigate = useNavigate();
  return (
    <div
      className="catv2-job-card catv2-job-card--clickable"
      role="button"
      tabIndex={0}
      title="点击查看 JD 详情"
      onClick={() => onView(job)}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onView(job);
        }
      }}
    >
      <span className="catv2-job-dot" />
      <div className="catv2-job-main">
        <div className="catv2-job-title-row">
          <span className="catv2-job-title">{job.title}</span>
          <span className="catv2-job-code">{jobCode(job)}</span>
          <span
            className={`tag ${
              job.status === 'PUBLISHED' ? 'tag-green' : job.status === 'DRAFT' ? 'tag-indigo' : 'tag-gray'
            }`}
          >
            {JOB_STATUS_LABELS[job.status]}
          </span>
          <span className={`badge-pill ${typeBadgeClass(job.job_type)}`}>
            {JOB_TYPE_LABELS[job.job_type]}
          </span>
          {job.urgency === 'HIGH' && <span className="urgency-tag">紧急</span>}
        </div>
        <div className="catv2-job-meta">
          <span>{job.department || '—'}</span>
          <span>·</span>
          <span>{job.location}</span>
          <span>·</span>
          <span>{formatSalary(job)}</span>
          <span>·</span>
          <span>{expLabel(job.experience_req)}</span>
          <span>·</span>
          <span>{eduLabel(job.education_req)}</span>
        </div>
      </div>
      <div className="catv2-job-stats">
        <span className="catv2-job-stat">
          <b>{job.applications_total || 0}</b> 投递
        </span>
        <span className="catv2-job-stat">
          <b>{job.headcount || 1}</b> HC
        </span>
      </div>
      <div className="catv2-job-actions">
        <button
          className="btn btn-soft catv2-job-btn"
          onClick={(e) => {
            e.stopPropagation();
            navigate(
              `/candidates?jobId=${job.id}&jobTitle=${encodeURIComponent(job.title)}`,
            );
          }}
        >
          候选人 ({job.applications_total || 0})
        </button>
      </div>
    </div>
  );
}

/* ----------------------------- Page ----------------------------- */

export default function CategoryAdminPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const canManage = user?.role === 'SUPER_ADMIN' || user?.role === 'HR';

  const [list, setList] = useState<JobCategory[]>([]);
  const [jobs, setJobs] = useState<JobWithStats[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [hiringOnly, setHiringOnly] = useState(false);
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());

  const [modalOpen, setModalOpen] = useState(false);
  const [modalCategory, setModalCategory] = useState<JobCategory | null>(null);
  const [modalPreset, setModalPreset] = useState<Partial<JobCategoryInput> | null>(null);

  const [drawerCategory, setDrawerCategory] = useState<JobCategory | null>(null);
  const [drawerJob, setDrawerJob] = useState<JobWithStats | null>(null);

  function load() {
    setLoading(true);
    Promise.all([api.adminListJobCategories(), api.adminListJobs()])
      .then(([cats, jobList]) => {
        setList(cats);
        setJobs(jobList);
      })
      .finally(() => setLoading(false));
  }
  useEffect(load, []);

  const visibleList = useMemo(() => {
    if (canManage) return list;
    return list.filter((c) => c.owner_id === user?.id);
  }, [list, canManage, user]);

  const tree = useMemo(() => buildTree(visibleList), [visibleList]);
  const searching = search.trim().length > 0;

  const displayTree = useMemo(() => {
    let t = searching ? filterTree(tree, search) : tree;
    if (hiringOnly) t = filterHiring(t);
    return t;
  }, [tree, search, searching, hiringOnly]);

  const jobsByCode = useMemo(() => {
    const m = new Map<string, JobWithStats[]>();
    for (const j of jobs) {
      const code = j.category_code || '';
      if (!m.has(code)) m.set(code, []);
      m.get(code)!.push(j);
    }
    m.forEach((arr) =>
      arr.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()),
    );
    return m;
  }, [jobs]);

  const stats = useMemo(() => {
    const roots = visibleList.filter((c) => !c.parent_code);
    const children = visibleList.filter((c) => c.parent_code);
    const openJobs = roots.reduce((sum, c) => sum + (c.open_job_count || 0), 0);
    const totalHc = roots.reduce((sum, c) => sum + (c.total_headcount || 0), 0);
    const ownerIds = new Set(visibleList.map((c) => c.owner_id).filter(Boolean));
    return {
      rootCount: roots.length,
      childCount: children.length,
      openJobs,
      totalHc,
      ownerCount: ownerIds.size,
    };
  }, [visibleList]);

  function expandAll() {
    setCollapsed(new Set());
  }
  function collapseAll() {
    const all = new Set<string>();
    const dfs = (nodes: TreeNode[]) =>
      nodes.forEach((n) => {
        if (n.children.length) all.add(n.code);
        dfs(n.children);
      });
    dfs(tree);
    setCollapsed(all);
  }
  function toggle(code: string) {
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(code)) next.delete(code);
      else next.add(code);
      return next;
    });
  }

  function openCreate() {
    setModalCategory(null);
    setModalPreset(null);
    setModalOpen(true);
  }
  function openAddChild(parent: JobCategory) {
    setModalCategory(null);
    setModalPreset({ parent_code: parent.code });
    setModalOpen(true);
  }
  function openEdit(c: JobCategory) {
    setModalCategory(c);
    setModalPreset(null);
    setModalOpen(true);
  }
  function openDrawer(c: JobCategory) {
    setDrawerCategory(c);
  }
  function closeDrawer() {
    setDrawerCategory(null);
  }
  function closeModal() {
    setModalOpen(false);
  }
  function handleSaved() {
    setModalOpen(false);
    load();
  }
  async function remove(c: JobCategory) {
    const hint = c.parent_code ? '（含其下子项将变为一级方向）' : '';
    if (!confirm(`确定删除方向「${c.name}」吗？${hint}`)) return;
    try {
      await api.adminDeleteJobCategory(c.code);
      load();
    } catch (e) {
      alert((e as Error).message);
    }
  }

  function renderNode(node: TreeNode, forceOpen: boolean) {
    const hasChildren = node.children.length > 0;
    const ownJobs = jobsByCode.get(node.code) || [];
    const isOpen = forceOpen || !collapsed.has(node.code);
    const showBody = isOpen && (hasChildren || ownJobs.length > 0);
    const indent = 12 + node.depth * 20;

    return (
      <div className="catv2-node" key={node.code}>
        <div className="catv2-node-head" style={{ paddingLeft: indent }}>
          <div className="catv2-node-main">
            <button
              className="cat-toggle"
              onClick={() => toggle(node.code)}
              disabled={!hasChildren && ownJobs.length === 0}
              aria-label={isOpen ? '收起' : '展开'}
              title={isOpen ? '收起' : '展开'}
            >
              <Chevron open={isOpen && (hasChildren || ownJobs.length > 0)} />
            </button>
            <span className="cat-ico">{hasChildren ? <FolderIcon /> : <TagIcon />}</span>
            <span className="cat-name" title={node.name}>
              {node.name}
            </span>
            <span className="cat-code-pill">{node.code}</span>
            {hasChildren && (
              <span className="badge-pill blue">{node.child_count} 个子方向</span>
            )}
          </div>

          <div className="catv2-node-jobs">
            {(node.open_job_count || 0) > 0 ? (
              <>
                <span className="tag tag-green">
                  {hasChildren
                    ? `在招 ${node.open_job_count} 个岗位`
                    : `在招 ${node.open_job_count}/共 ${node.open_job_count} 岗位`}
                </span>
                {hasChildren && (
                  <span className="catv2-jobs-sub">
                    共 {node.open_job_count} 个岗位 · {node.total_headcount} HC
                  </span>
                )}
              </>
            ) : (
              <span className="muted">暂无在招</span>
            )}
          </div>

          <div className="catv2-node-owner">
            {node.owner_id ? (
              <div className="cat-owner">
                <Avatar name={node.owner_name || ''} />
                <div>
                  <div className="cat-owner-name">{node.owner_name}</div>
                  {node.owner_title && <div className="cat-owner-title">{node.owner_title}</div>}
                </div>
              </div>
            ) : (
              <span className="muted">未分配</span>
            )}
          </div>

          <div className="catv2-node-actions">
            {canManage && (
              <>
                <button
                  className="btn-link"
                  title="添加子方向"
                  onClick={() => openAddChild(node)}
                >
                  +
                </button>
                <button className="btn-link" onClick={() => openDrawer(node)}>
                  岗位
                </button>
                <button className="btn-link" onClick={() => openEdit(node)}>
                  编辑
                </button>
                <button className="btn-link danger" onClick={() => remove(node)}>
                  删除
                </button>
              </>
            )}
            {!canManage && (
              <button className="btn-link" onClick={() => openDrawer(node)}>
                岗位
              </button>
            )}
          </div>
        </div>

        {showBody && (
          <div className="catv2-node-body" style={{ paddingLeft: indent }}>
            {hasChildren && (
              <div className="catv2-children">
                {node.children.map((child) => renderNode(child, forceOpen))}
              </div>
            )}
            {ownJobs.length > 0 && (
              <div className="catv2-jobs">
                {ownJobs.map((job) => (
                  <JobCard key={job.id} job={job} onView={setDrawerJob} />
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="page">
      <div className="stat-grid">
        <div className="stat-card">
          <div className="row">
            <span className="title">一级业务方向</span>
            <span className="ic blue"><FolderIcon /></span>
          </div>
          <div className="val">{stats.rootCount}<span className="unit">个</span></div>
        </div>
        <div className="stat-card">
          <div className="row">
            <span className="title">专业子方向</span>
            <span className="ic indigo"><TagIcon /></span>
          </div>
          <div className="val">{stats.childCount}<span className="unit">个细分</span></div>
        </div>
        <div className="stat-card">
          <div className="row">
            <span className="title">当前在招岗位</span>
            <span className="ic emerald"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 2v20M2 12h20"/></svg></span>
          </div>
          <div className="val">{stats.openJobs}<span className="unit">个在招 ({stats.totalHc} HC)</span></div>
        </div>
        <div className="stat-card">
          <div className="row">
            <span className="title">方向责任人</span>
            <span className="ic amber"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="8" r="4"/><path d="M4 20c0-4 4-6 8-6s8 2 8 6"/></svg></span>
          </div>
          <div className="val">{stats.ownerCount}<span className="unit">位业务专家</span></div>
        </div>
      </div>

      <div className="cat-toolbar">
        <input
          className="input cat-search"
          placeholder="搜索方向 / 编码 / 负责人"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <div className="filter-pills">
          <button className={!hiringOnly ? 'active' : ''} onClick={() => setHiringOnly(false)}>全部</button>
          <button className={hiringOnly ? 'active' : ''} onClick={() => setHiringOnly(true)}>仅看在招</button>
        </div>
        <button className="btn" onClick={expandAll}>展开全部</button>
        <button className="btn" onClick={collapseAll}>收起全部</button>
      </div>

      <div className="card-2xl catv2-card">
        {canManage && (
          <div className="catv2-listbar">
            <span className="catv2-listbar-title">方向与子方向</span>
            <button className="btn btn-primary" onClick={openCreate}>+ 新建方向</button>
          </div>
        )}
        <div className="catv2-header">
          <div className="catv2-header-cell catv2-header--name">层级架构（一级方向 / 子方向 / 挂载岗位）</div>
          <div className="catv2-header-cell catv2-header--jobs">在招岗位与需求</div>
          <div className="catv2-header-cell catv2-header--owner">序列负责人 / 用人经理</div>
          <div className="catv2-header-cell catv2-header--actions">快捷操作</div>
        </div>
        {loading ? (
          <div className="page-loading"><div className="pl-body">加载中…</div></div>
        ) : displayTree.length === 0 ? (
          <div className="empty">还没有符合条件的方向</div>
        ) : (
          <div className="catv2-tree">
            {displayTree.map((n) => renderNode(n, searching || hiringOnly))}
          </div>
        )}
      </div>

      {modalOpen && (
        <CategoryEditModal
          category={modalCategory}
          allCategories={list}
          initialValues={modalPreset ?? undefined}
          onSaved={handleSaved}
          onCancel={closeModal}
        />
      )}

      {drawerCategory && (
        <CategoryJobDrawer
          category={drawerCategory}
          allCategories={list}
          readOnly={!canManage}
          onClose={closeDrawer}
          onEdit={() => {
            closeDrawer();
            openEdit(drawerCategory);
          }}
        />
      )}

      {drawerJob && (
        <JobDetailDrawer
          job={drawerJob}
          variant="modal"
          onClose={() => setDrawerJob(null)}
          onViewCandidates={(j) => {
            setDrawerJob(null);
            navigate(
              `/candidates?jobId=${j.id}&jobTitle=${encodeURIComponent(j.title)}`,
            );
          }}
        />
      )}
    </div>
  );
}
