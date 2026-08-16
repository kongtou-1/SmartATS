import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api } from '../lib/client';
import type { Application, Stage, StageHistory } from '../types';
import { STAGE_LABELS, JOB_TYPE_LABELS } from '../types';

const WITHDRAWABLE: Stage[] = [
  'APPLIED',
  'SCREENING',
  'FIRST_INTERVIEW',
  'SECOND_INTERVIEW',
  'FINAL_REVIEW',
];

/** 终态阶段 —— 归入"历史记录" */
const TERMINAL_STAGES: Stage[] = ['HIRED', 'REJECTED', 'WITHDRAWN'];

function stageTagClass(stage: Stage): string {
  if (['HIRED'].includes(stage)) return 'tag-green';
  if (['REJECTED', 'WITHDRAWN'].includes(stage)) return 'tag-gray';
  return 'tag-blue';
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  const yy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yy}-${mm}-${dd}`;
}

interface TimelineNode {
  id: string;
  label: string;
  date: string;
  kind: 'start' | 'progress' | 'end';
}

function buildTimelineNodes(
  stageHistory: StageHistory[] | undefined,
  appliedAt: string,
  currentStage: Stage,
): TimelineNode[] {
  const nodes: TimelineNode[] = [];

  nodes.push({
    id: 'apply-start',
    label: '投递简历',
    date: formatDate(appliedAt),
    kind: 'start',
  });

  const meaningful = (stageHistory ?? []).filter(
    (h) => h.action !== 'APPLY' && h.action !== 'TRANSITION',
  );
  for (const h of meaningful) {
    let label = '';
    if (h.action === 'ADVANCE' && h.to_stage) {
      label = STAGE_LABELS[h.to_stage] || h.to_stage;
    } else if (h.action === 'REJECT') {
      label = '流程终止';
    } else if (h.action === 'WITHDRAW') {
      label = '已撤回';
    } else if (h.action === 'HOLD') {
      label = '申请暂缓';
    } else if (h.action === 'RESUME') {
      label = '恢复流程';
    } else if (h.to_stage) {
      label = STAGE_LABELS[h.to_stage] || h.to_stage;
    } else {
      label = '状态更新';
    }
    nodes.push({
      id: h.id,
      label,
      date: formatDate(h.created_at),
      kind:
        ['REJECTED', 'WITHDRAWN', 'HIRED'].includes(currentStage) &&
        nodes.length > 0 &&
        h.action === 'REJECT'
          ? 'end'
          : 'progress',
    });
  }

  const terminalStages: Stage[] = ['REJECTED', 'WITHDRAWN', 'HIRED'];
  if (terminalStages.includes(currentStage)) {
    const hasEnd = nodes.some((n) => n.kind === 'end');
    if (!hasEnd) {
      nodes.push({
        id: 'terminal-fallback',
        label:
          currentStage === 'HIRED'
            ? '已通过'
            : currentStage === 'WITHDRAWN'
              ? '已撤回'
              : '流程终止',
        date: '',
        kind: 'end',
      });
    }
  }

  return nodes;
}

function MiniTimeline({
  nodes,
}: {
  nodes: TimelineNode[];
}) {
  return (
    <div className="mini-timeline">
      {nodes.map((node, idx) => (
        <div key={node.id} className={`mt-node mt-${node.kind}`}>
          <div className="mt-dot" />
          {idx < nodes.length - 1 && <div className="mt-line" />}
          <span className="mt-label">{node.label}</span>
          {node.date && <span className="mt-date">{node.date}</span>}
        </div>
      ))}
    </div>
  );
}

export default function MyApplicationsPage() {
  const navigate = useNavigate();
  const [apps, setApps] = useState<Application[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);

  useEffect(() => {
    api
      .myApplications()
      .then(setApps)
      .finally(() => setLoading(false));
  }, []);

  async function handleWithdraw(a: Application, e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    if (!window.confirm(`确认撤回「${a.job?.title ?? '该岗位'}」的投递？`)) return;
    setBusyId(a.id);
    try {
      await api.withdrawApplication(a.id);
      setApps((prev) =>
        prev.map((x) =>
          x.id === a.id ? { ...x, status: 'WITHDRAWN', current_stage: 'WITHDRAWN' } : x,
        ),
      );
    } finally {
      setBusyId(null);
    }
  }

  const activeApps = apps.filter(
    (a) => !TERMINAL_STAGES.includes(a.current_stage),
  );
  const historyApps = apps.filter((a) =>
    TERMINAL_STAGES.includes(a.current_stage),
  );

  function renderSection(
    title: string,
    list: Application[],
    startIdx: number,
  ) {
    if (list.length === 0) return null;
    return (
      <section className="app-section">
        <div className="app-section-head">
          <h2>{title}</h2>
          <span className="app-count">（{list.length}）</span>
        </div>
        <ul className="app-card-list">
          {list.map((a, i) => {
            const canWithdraw =
              ['ACTIVE', 'ON_HOLD'].includes(a.status) &&
              WITHDRAWABLE.includes(a.current_stage);
            const timelineNodes = buildTimelineNodes(
              a.stage_history,
              a.applied_at,
              a.current_stage,
            );
            return (
              <li
                key={a.id}
                className="app-card"
                onClick={() => navigate(`/jobs/${a.job_id}`)}
                style={{ cursor: 'pointer' }}
              >
                <div className="app-card-inner">
                  {/* 左侧：序号 + 主信息 */}
                  <div className="app-card-body">
                    <span className="app-seq">第 {startIdx + i + 1} 志愿</span>
                    <Link
                      to={`/jobs/${a.job_id}`}
                      className="app-job-title"
                      onClick={(e) => e.stopPropagation()}
                    >
                      {a.job?.title ?? '岗位'}
                    </Link>
                    <div className="app-meta-row">
                      <span className="app-meta-label">状态：</span>
                      <span className={`tag ${stageTagClass(a.current_stage)}`}>
                        {STAGE_LABELS[a.current_stage]}
                      </span>
                      {a.job?.job_type && (
                        <>
                          <span className="app-meta-divider">，</span>
                          <span className="app-meta-label">类型：</span>
                          <span>{JOB_TYPE_LABELS[a.job.job_type]}</span>
                        </>
                      )}
                      {a.job?.location && (
                        <>
                          <span className="app-meta-divider">，</span>
                          <span className="app-meta-label">地点：</span>
                          <span>{a.job.location}</span>
                        </>
                      )}
                    </div>
                    <MiniTimeline nodes={timelineNodes} />
                  </div>

                  {/* 右侧：日期 + 操作 */}
                  <div className="app-card-right">
                    <span className="app-date">
                      {new Date(a.applied_at).toLocaleString()}
                    </span>
                    <div className="app-card-actions">
                      {canWithdraw && (
                        <button
                          className="btn btn-sm btn-outline"
                          disabled={busyId === a.id}
                          onClick={(e) => handleWithdraw(a, e)}
                        >
                          {busyId === a.id ? '撤回中…' : '撤回'}
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      </section>
    );
  }

  return (
    <div className="page app-page">
      {loading ? (
        <div className="muted" style={{ padding: 40, textAlign: 'center' }}>
          加载中…
        </div>
      ) : apps.length === 0 ? (
        <div className="empty">
          还没有投递记录，去<a onClick={() => (window.location.href = '/')}>岗位列表</a>看看吧
        </div>
      ) : (
        <div className="app-layout">
          {renderSection('进行中的申请', activeApps, 0)}
          {renderSection('历史记录', historyApps, activeApps.length)}
        </div>
      )}
    </div>
  );
}
