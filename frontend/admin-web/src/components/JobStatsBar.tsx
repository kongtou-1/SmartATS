import { Briefcase, CheckCircle2, FileEdit, Archive } from 'lucide-react';
import type { Job, JobStatus } from '../types';

interface Props {
  jobs: Job[];
  active: JobStatus | 'ALL';
  onSelect: (s: JobStatus | 'ALL') => void;
}

export default function JobStatsBar({ jobs, active, onSelect }: Props) {
  const counts = {
    ALL: jobs.length,
    PUBLISHED: jobs.filter((j) => j.status === 'PUBLISHED').length,
    DRAFT: jobs.filter((j) => j.status === 'DRAFT').length,
    CLOSED: jobs.filter((j) => j.status === 'CLOSED').length,
  };
  const cards = [
    { key: 'ALL' as const, label: '全部岗位', val: counts.ALL, icon: Briefcase, cls: 'blue', sub: '在招 + 历史' },
    { key: 'PUBLISHED' as const, label: '招聘中', val: counts.PUBLISHED, icon: CheckCircle2, cls: 'emerald', sub: '对外可见' },
    { key: 'DRAFT' as const, label: '草稿', val: counts.DRAFT, icon: FileEdit, cls: 'indigo', sub: '待发布' },
    { key: 'CLOSED' as const, label: '已关闭', val: counts.CLOSED, icon: Archive, cls: 'amber', sub: '已下线' },
  ];
  return (
    <div className="stat-grid">
      {cards.map((c) => {
        const Icon = c.icon;
        const isActive = active === c.key;
        return (
          <div
            key={c.key}
            className={`stat-card${isActive ? ' selected' : ''}`}
            onClick={() => onSelect(c.key)}
          >
            <div className="row">
              <span className="title">{c.label}</span>
              <span className={`ic ${c.cls}`}>
                <Icon size={18} />
              </span>
            </div>
            <div className="val">{c.val}</div>
            <div className="foot">
              <span>{c.sub}</span>
            </div>
          </div>
        );
      })}
    </div>
  );
}
