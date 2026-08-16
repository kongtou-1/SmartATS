import { useEffect, useMemo, useState } from 'react';
import { api } from '../lib/client';
import type { JobCategory, JobWithStats, User } from '../types';
import { JOB_STATUS_LABELS, JOB_TYPE_LABELS } from '../types';

interface Props {
  category: JobCategory;
  allCategories: JobCategory[];
  readOnly?: boolean;
  onClose: () => void;
  onEdit: () => void;
}

function Avatar({ name }: { name: string }) {
  const initial = name ? name.charAt(0) : '?';
  return (
    <div
      style={{
        width: 40,
        height: 40,
        borderRadius: '50%',
        background: 'var(--primary-soft)',
        color: 'var(--primary-strong)',
        display: 'grid',
        placeItems: 'center',
        fontWeight: 700,
        fontSize: 15,
        flexShrink: 0,
      }}
    >
      {initial}
    </div>
  );
}

export default function CategoryJobDrawer({ category, allCategories, readOnly, onClose, onEdit }: Props) {
  const [jobs, setJobs] = useState<JobWithStats[]>([]);
  const [owner, setOwner] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      setLoading(true);
      try {
        const [jobList, owners] = await Promise.all([
          api.adminListJobs(),
          api.adminListDirectionOwners(),
        ]);
        setJobs(jobList);
        setOwner(owners.find((u) => u.id === category.owner_id) || null);
      } catch {
        // ignore
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [category]);

  const relatedJobs = useMemo(() => {
    const codes = new Set<string>();
    codes.add(category.code);
    const collect = (code: string) => {
      allCategories
        .filter((c) => c.parent_code === code)
        .forEach((c) => {
          codes.add(c.code);
          collect(c.code);
        });
    };
    collect(category.code);
    return jobs.filter((j) => j.category_code && codes.has(j.category_code));
  }, [jobs, category, allCategories]);

  return (
    <div className="drawer-overlay" onClick={onClose}>
      <div className="drawer" onClick={(e) => e.stopPropagation()}>
        <div className="drawer-head">
          <h3>{category.name}</h3>
          <button className="drawer-close" onClick={onClose} aria-label="关闭">
            ×
          </button>
        </div>
        <div className="drawer-body">
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 14,
              padding: 16,
              border: '1px solid var(--line)',
              borderRadius: 'var(--radius)',
              marginBottom: 22,
            }}
          >
            <Avatar name={owner?.name || category.owner_name || '未分配'} />
            <div style={{ minWidth: 0 }}>
              <div style={{ fontWeight: 700, color: 'var(--ink)' }}>
                {owner?.name || category.owner_name || '未分配负责人'}
              </div>
              <div style={{ fontSize: 12.5, color: 'var(--muted)', marginTop: 2 }}>
                {(owner?.title || category.owner_title) || ROLE_LABELS.DIRECTION_OWNER}
              </div>
              {owner?.email && (
                <div style={{ fontSize: 12.5, color: 'var(--muted)', marginTop: 2 }}>
                  {owner.email}
                </div>
              )}
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
            <h4 style={{ margin: 0, fontSize: 14, color: 'var(--ink)' }}>
              关联岗位（{relatedJobs.length}）
            </h4>
          </div>

          {loading ? (
            <div className="muted">加载中…</div>
          ) : relatedJobs.length === 0 ? (
            <div className="empty">该方向下暂无岗位</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {relatedJobs.map((job) => (
                <div
                  key={job.id}
                  style={{
                    padding: 14,
                    border: '1px solid var(--line)',
                    borderRadius: 'var(--radius-sm)',
                    background: '#fff',
                  }}
                >
                  <div style={{ fontWeight: 700, color: 'var(--ink)', marginBottom: 6 }}>
                    {job.title}
                  </div>
                  <div style={{ fontSize: 12.5, color: 'var(--muted)' }}>
                    {job.location} · {JOB_TYPE_LABELS[job.job_type]} · HC {job.headcount ?? 1}
                  </div>
                  <div style={{ marginTop: 8 }}>
                    <span className={`tag ${job.status === 'PUBLISHED' ? 'tag-green' : job.status === 'DRAFT' ? 'tag-indigo' : 'tag-gray'}`}>
                      {JOB_STATUS_LABELS[job.status]}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
        {!readOnly && (
          <div style={{ padding: '14px 22px', borderTop: '1px solid var(--line)' }}>
            <button className="btn btn-primary" style={{ width: '100%' }} onClick={onEdit}>
              编辑方向
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

const ROLE_LABELS = {
  DIRECTION_OWNER: '方向负责人',
} as const;
