import type { AdminApplicationDetail, Stage } from '../../types';
import { STAGE_LABELS, STAGE_ORDER } from '../../types';

export type FlowAction = 'transition' | 'hold' | 'resume' | 'reject';

export function CandidateFlowActions({
  detail,
  targetStage,
  reason,
  busy,
  onTargetStageChange,
  onReasonChange,
  onAction,
}: {
  detail: AdminApplicationDetail;
  targetStage: Stage;
  reason: string;
  busy: boolean;
  onTargetStageChange: (stage: Stage) => void;
  onReasonChange: (reason: string) => void;
  onAction: (action: FlowAction) => void;
}) {
  const disabled = busy || !reason.trim();
  return (
    <section className="block">
      <h3>流程操作</h3>
      <div className="interview-form">
        <textarea
          className="input area"
          placeholder="必填：说明本次操作原因"
          value={reason}
          onChange={(event) => onReasonChange(event.target.value)}
        />
        {detail.status === 'ACTIVE' ? (
          <>
            <select
              className="input"
              value={targetStage}
              onChange={(event) => onTargetStageChange(event.target.value as Stage)}
            >
              {STAGE_ORDER.filter((stage) => stage !== detail.current_stage).map((stage) => (
                <option value={stage} key={stage}>
                  {STAGE_LABELS[stage]}
                </option>
              ))}
            </select>
            <div className="actions">
              <button
                className="btn btn-primary"
                disabled={disabled}
                onClick={() => onAction('transition')}
              >
                跳转到所选阶段
              </button>
              <button className="btn" disabled={disabled} onClick={() => onAction('hold')}>
                暂缓
              </button>
              <button
                className="btn btn-danger"
                disabled={disabled}
                onClick={() => onAction('reject')}
              >
                拒绝
              </button>
            </div>
          </>
        ) : (
          <button
            className="btn btn-primary"
            disabled={disabled}
            onClick={() => onAction('resume')}
          >
            恢复申请流程
          </button>
        )}
      </div>
    </section>
  );
}
