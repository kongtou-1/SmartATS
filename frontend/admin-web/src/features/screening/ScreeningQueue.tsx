import { Search, EyeOff, Users } from 'lucide-react';
import type { AdminApplication, JobWithStats } from '../../types';

interface Props {
  apps: AdminApplication[];
  processed: Record<string, 'passed' | 'rejected'>;
  selectedId: string | null;
  loading: boolean;
  search: string;
  onSearch: (s: string) => void;
  hideProcessed: boolean;
  onToggleHide: () => void;
  onSelect: (a: AdminApplication) => void;
  globalMode: boolean;
  jobId: string;
  jobs: JobWithStats[];
  onJobChange: (v: string) => void;
}

function scoreClass(s: number | null): 'hi' | 'mid' | 'lo' | 'none' {
  if (s === null || s === undefined) return 'none';
  if (s >= 80) return 'hi';
  if (s >= 60) return 'mid';
  return 'lo';
}

export default function ScreeningQueue({
  apps,
  processed,
  selectedId,
  loading,
  search,
  onSearch,
  hideProcessed,
  onToggleHide,
  onSelect,
  globalMode,
  jobId,
  jobs,
  onJobChange,
}: Props) {
  return (
    <aside className="swb-queue">
      <div className="swb-queue-head">
        <div className="swb-queue-title">
          <Users size={15} /> 待初筛队列
          <span className="swb-queue-count">{apps.length}</span>
        </div>
        {globalMode && (
          <select className="input swb-job-select" value={jobId} onChange={(e) => onJobChange(e.target.value)}>
            <option value="">全部岗位</option>
            {jobs.map((j) => (
              <option key={j.id} value={j.id}>
                {j.title}
              </option>
            ))}
          </select>
        )}
      </div>

      <div className="swb-queue-tools">
        <div className="input-with-icon swb-search">
          <Search size={14} className="input-ico" />
          <input
            className="input"
            placeholder="搜索姓名、公司、学校、技能…"
            value={search}
            onChange={(e) => onSearch(e.target.value)}
          />
        </div>
        <button
          className={`btn-link ${hideProcessed ? 'active' : ''}`}
          onClick={onToggleHide}
          title="隐藏已处理"
        >
          <EyeOff size={14} /> 隐藏已处理
        </button>
      </div>

      <div className="swb-queue-list">
        {loading ? (
          <div className="swb-queue-loading">加载中…</div>
        ) : apps.length === 0 ? (
          <div className="swb-queue-empty muted">没有匹配的候选人</div>
        ) : (
          apps.map((a) => {
            const st = processed[a.id];
            return (
              <button
                key={a.id}
                className={`swb-qcard ${selectedId === a.id ? 'active' : ''} ${st ? 'done' : ''}`}
                onClick={() => onSelect(a)}
              >
                <div className="swb-qcard-top">
                  <span className="swb-avatar">{a.candidate_name?.[0] || '?'}</span>
                  <span className="swb-qcard-name">{a.candidate_name}</span>
                  {a.ai_score != null && (
                    <span className={`score-pill ${scoreClass(a.ai_score)}`}>{a.ai_score}</span>
                  )}
                </div>
                <div className="swb-qcard-meta">
                  {[a.latest_company, a.latest_school].filter(Boolean).join(' · ') || '—'}
                </div>
                {globalMode && a.job_title && <div className="swb-qcard-job">{a.job_title}</div>}
                <div className="swb-qcard-tags">
                  {(a.skills || []).slice(0, 3).map((s) => (
                    <span className="tag" key={s}>
                      {s}
                    </span>
                  ))}
                </div>
                {st && (
                  <span className={`swb-qstatus ${st}`}>
                    {st === 'passed' ? '已通过' : '已淘汰'}
                  </span>
                )}
              </button>
            );
          })
        )}
      </div>
    </aside>
  );
}
