import type { AdminApplicationDetail, Stage } from '../../types';
import { STAGE_LABELS, STAGE_ORDER } from '../../types';

export function CurrentPipeline({ currentStage }: { currentStage: Stage }) {
  const currentIndex = STAGE_ORDER.indexOf(currentStage);
  return (
    <section className="block">
      <h3>当前招聘阶段</h3>
      <ol className="pipeline">
        {STAGE_ORDER.map((stage, index) => (
          <li
            key={stage}
            className={`pl-item ${index < currentIndex ? 'done' : ''} ${index === currentIndex ? 'active' : ''}`}
          >
            <span className="pl-dot">{index < currentIndex ? '✓' : index + 1}</span>
            <span className="pl-body">
              <span className="pl-label">{STAGE_LABELS[stage]}</span>
              {index === currentIndex && <div className="pl-note">当前所在阶段</div>}
            </span>
          </li>
        ))}
      </ol>
    </section>
  );
}

export function StageHistory({ history }: { history: AdminApplicationDetail['stage_history'] }) {
  return (
    <section className="block">
      <h3>阶段操作历史</h3>
      {history.length === 0 ? (
        <div className="muted">暂无历史记录</div>
      ) : (
        <ol className="pipeline">
          {[...history].reverse().map((item) => (
            <li className="pl-item done" key={item.id}>
              <span className="pl-dot">✓</span>
              <span className="pl-body">
                <span className="pl-label">
                  {item.action === 'HOLD'
                    ? '暂缓申请'
                    : item.action === 'RESUME'
                      ? '恢复申请'
                      : item.action === 'REJECT'
                        ? '拒绝候选人'
                        : item.action === 'WITHDRAW'
                          ? '候选人撤回'
                          : `${item.from_stage ? STAGE_LABELS[item.from_stage] : '开始'} → ${item.to_stage ? STAGE_LABELS[item.to_stage] : '暂缓'}`}
                </span>
                <div className="pl-note">
                  {new Date(item.created_at).toLocaleString()} · {item.changed_by_name}
                </div>
                <div>{item.reason}</div>
              </span>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}
