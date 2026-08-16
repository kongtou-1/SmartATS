import type { AdminApplication, Stage } from '../../types';
import { STAGE_LABELS, STAGE_ORDER } from '../../types';
import CandidateKanbanCard from './CandidateKanbanCard';

interface BoardViewProps {
  apps: AdminApplication[];
  onAdvance?: (a: AdminApplication) => void;
  onSelect?: (a: AdminApplication) => void;
  selectedIds?: Set<string>;
  onToggleSelect?: (a: AdminApplication) => void;
  onSendOffer?: (a: AdminApplication) => void;
}

export default function BoardView({
  apps,
  onAdvance,
  onSelect,
  selectedIds,
  onToggleSelect,
  onSendOffer,
}: BoardViewProps) {
  // Group by current_stage; ignore REJECTED / WITHDRAWN in the main board to keep
  // the rail focused on active pipeline; surface them in a footer row instead.
  const active = STAGE_ORDER.filter((s) => s !== 'APPLIED' || true); // keep APPLIED as first col
  const grouped: Record<string, AdminApplication[]> = Object.fromEntries(
    active.map((s) => [s, [] as AdminApplication[]]),
  );
  const terminal: AdminApplication[] = [];
  for (const a of apps) {
    if (a.current_stage === 'REJECTED' || a.current_stage === 'WITHDRAWN' || a.current_stage === 'HIRED') {
      if (a.current_stage === 'HIRED') {
        grouped['HIRED'].push(a);
      } else {
        terminal.push(a);
      }
    } else {
      grouped[a.current_stage]?.push(a);
    }
  }

  return (
    <div className="kanban-board">
      <div className="kanban-columns">
        {active.map((stage: Stage) => {
          const list = grouped[stage] || [];
          return (
            <div className="kanban-col" key={stage}>
              <div className="kanban-col-head">
                <span className="kanban-col-title">{STAGE_LABELS[stage]}</span>
                <span className="kanban-col-count">{list.length}</span>
              </div>
              <div className="kanban-col-body">
                {list.length === 0 ? (
                  <div className="kanban-col-empty">暂无候选人</div>
                ) : (
                  list.map((a) => (
                    <CandidateKanbanCard
                      key={a.id}
                      app={a}
                      onAdvance={onAdvance}
                      onSelect={onSelect}
                      selected={selectedIds?.has(a.id)}
                      onToggleSelect={onToggleSelect}
                      onSendOffer={onSendOffer}
                    />
                  ))
                )}
              </div>
            </div>
          );
        })}
      </div>
      {terminal.length > 0 && (
        <div className="kanban-terminal">
          <div className="kanban-terminal-label">已结束流程</div>
          <div className="kanban-terminal-list">
            {terminal.map((a) => (
              <span className="kanban-terminal-chip" key={a.id}>
                {a.candidate_name} · {STAGE_LABELS[a.current_stage]}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}