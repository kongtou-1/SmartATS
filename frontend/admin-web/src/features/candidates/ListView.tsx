import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { CalendarPlus, ChevronRight } from 'lucide-react';
import type { AdminApplication, Stage } from '../../types';
import { STAGE_LABELS, isInterviewableStage } from '../../types';

interface ListViewProps {
  apps: AdminApplication[];
  onSelect?: (a: AdminApplication) => void;
  onAdvance?: (a: AdminApplication) => void;
  onSchedule?: (a: AdminApplication) => void;
}

// Stage 胶囊配色 —— 与参考图一致：
//   浅蓝 = 投递 / 一面 / 二面 / 终面（面试进行中）
//   浅紫 = 简历筛选 / 面试通过（流程节点）
//   浅灰 = 已拒绝 / 已撤回（终止态）
function stageToneClass(stage: Stage): string {
  if (stage === 'SCREENING' || stage === 'SCREENING_PASSED' || stage === 'HIRED') return 'stage-pill-purple';
  if (stage === 'APPLIED' || stage === 'FIRST_INTERVIEW' || stage === 'SECOND_INTERVIEW' || stage === 'FINAL_REVIEW')
    return 'stage-pill-blue';
  return 'stage-pill-gray';
}

function scoreToneClass(s: number | null): 'hi' | 'mid' | 'lo' | 'none' {
  if (s === null) return 'none';
  if (s >= 80) return 'hi';
  if (s >= 60) return 'mid';
  return 'lo';
}

function formatDate(iso: string | null | undefined): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '—';
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(
    d.getDate(),
  ).padStart(2, '0')}`;
}

function companyAndTitle(a: AdminApplication): string {
  if (a.latest_company) return a.latest_company;
  return '—';
}

export default function ListView({
  apps,
  onSelect,
  onAdvance,
  onSchedule,
}: ListViewProps) {
  const navigate = useNavigate();
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const allChecked = apps.length > 0 && selected.size === apps.length;
  const someChecked = selected.size > 0 && selected.size < apps.length;

  function toggleAll() {
    if (allChecked) setSelected(new Set());
    else setSelected(new Set(apps.map((a) => a.id)));
  }
  function toggleOne(id: string) {
    const next = new Set(selected);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelected(next);
  }
  function rowClick(a: AdminApplication, e: React.MouseEvent) {
    // 不要在用户点了按钮/复选框时触发查看
    const t = e.target as HTMLElement;
    if (t.closest('button') || t.closest('input') || t.closest('a')) return;
    if (onSelect) onSelect(a);
    else navigate(`/candidates/${a.id}`);
  }

  return (
    <div className="card-2xl listview2-card">
      <div className="listview2-head">
        <span className="muted">共 {apps.length} 位候选人</span>
        {selected.size > 0 ? (
          <span className="listview2-bulk">
            已选 {selected.size} 位
            <button
              type="button"
              className="btn-link"
              onClick={() => setSelected(new Set())}
            >
              清空
            </button>
          </span>
        ) : null}
      </div>
      <div className="listview2-scroll">
        <table className="table listview2-table">
          <colgroup>
            <col style={{ width: 36 }} />
            <col style={{ width: 110 }} />
            <col style={{ width: 150 }} />
            <col style={{ width: 110 }} />
            <col style={{ width: 180 }} />
            <col style={{ width: 160 }} />
            <col style={{ width: 90 }} />
            <col style={{ width: 100 }} />
            <col style={{ width: 220 }} />
          </colgroup>
          <thead>
            <tr>
              <th>
                <input
                  type="checkbox"
                  checked={allChecked}
                  ref={(el) => {
                    if (el) el.indeterminate = someChecked;
                  }}
                  onChange={toggleAll}
                  aria-label="全选"
                />
              </th>
              <th>候选人姓名</th>
              <th>目标岗位</th>
              <th>当前阶段</th>
              <th>就职公司与职称</th>
              <th>毕业院校</th>
              <th>匹配度</th>
              <th>投递日期</th>
              <th>极速推进操作</th>
            </tr>
          </thead>
          <tbody>
            {apps.map((a) => {
              const tone = scoreToneClass(a.ai_score);
              const stageTone = stageToneClass(a.current_stage);
              const canAdvance = a.status === 'ACTIVE';
              const canScheduleRow = a.status === 'ACTIVE' && isInterviewableStage(a.current_stage);
              return (
                <tr
                  key={a.id}
                  className={`listview2-row ${selected.has(a.id) ? 'selected' : ''}`}
                  onClick={(e) => rowClick(a, e)}
                >
                  <td onClick={(e) => e.stopPropagation()}>
                    <input
                      type="checkbox"
                      checked={selected.has(a.id)}
                      onChange={() => toggleOne(a.id)}
                      aria-label={`选择 ${a.candidate_name}`}
                    />
                  </td>
                  <td className="listview2-name">{a.candidate_name || '—'}</td>
                  <td>
                    <span className="listview2-job">{a.job_title || '—'}</span>
                  </td>
                  <td>
                    <span className={`stage-pill ${stageTone}`}>
                      {STAGE_LABELS[a.current_stage] || a.current_stage}
                    </span>
                  </td>
                  <td className="listview2-meta">
                    <span className="listview2-meta-main">{companyAndTitle(a)}</span>
                  </td>
                  <td className="listview2-meta">
                    {a.latest_school ? (
                      <>
                        <span className="listview2-meta-main">{a.latest_school}</span>
                        {a.latest_degree ? (
                          <span className="listview2-meta-sub">（{a.latest_degree}）</span>
                        ) : null}
                      </>
                    ) : (
                      <span className="muted">—</span>
                    )}
                  </td>
                  <td>
                    {a.ai_score === null ? (
                      <span className="muted">—</span>
                    ) : (
                      <span className={`match-pill match-${tone}`}>{a.ai_score}%</span>
                    )}
                  </td>
                  <td className="listview2-date">{formatDate(a.applied_at)}</td>
                  <td onClick={(e) => e.stopPropagation()}>
                    <div className="listview2-actions">
                      {canScheduleRow && (
                        <button
                          type="button"
                          className="btn btn-soft listview2-action-btn"
                          onClick={() => {
                            if (onSchedule) onSchedule(a);
                            else if (onSelect) onSelect(a);
                            else navigate(`/candidates/${a.id}?action=schedule`);
                          }}
                        >
                          <CalendarPlus size={13} />
                          <span>约面试</span>
                        </button>
                      )}
                      <button
                        type="button"
                        className="btn btn-primary listview2-action-btn"
                        disabled={!canAdvance}
                        onClick={() => {
                          if (onAdvance) onAdvance(a);
                        }}
                      >
                        <span>推进至下一阶段</span>
                        <ChevronRight size={13} />
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {apps.length === 0 ? (
          <div className="empty">
            <b>暂无候选人</b>
            试试清空筛选项，或发布更多岗位以扩大漏斗。
          </div>
        ) : null}
      </div>
    </div>
  );
}
