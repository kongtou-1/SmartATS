import { CalendarClock, X } from 'lucide-react';
import type { InterviewDetail, RoundType, Stage, User } from '../../types';
import { STAGE_LABELS, INTERVIEW_STATUS_LABELS } from '../../types';
import type { InterviewInput } from '../../types';

export const ROUND_STAGE: Record<RoundType, Stage> = {
  FIRST: 'FIRST_INTERVIEW',
  SECOND: 'SECOND_INTERVIEW',
  HR: 'FINAL_REVIEW',
};

export const ROUND_LABELS: Record<RoundType, string> = {
  FIRST: '一面',
  SECOND: '二面',
  HR: 'HR 面',
};

const METHOD_OPTIONS = ['视频面试', '现场面试', '电话面试'];

/** datetime-local 本地字符串 -> ISO(UTC)，与后端 _as_utc 对齐 */
export function localInputToIso(val: string): string {
  if (!val) return '';
  const d = new Date(val);
  if (isNaN(d.getTime())) return val;
  return d.toISOString();
}

function nowLocalMin(): string {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
}

export function CandidateInterviews({
  interviews,
  interviewers,
  form,
  busy,
  canSchedule,
  formVisible,
  candidateName,
  jobTitle,
  currentStage,
  error,
  onNavigate,
  onToggleForm,
  onClose,
  onFormChange,
  onCreate,
}: {
  interviews: InterviewDetail[];
  interviewers: User[];
  form: InterviewInput;
  busy: boolean;
  canSchedule: boolean;
  formVisible: boolean;
  candidateName: string;
  jobTitle: string;
  currentStage: Stage;
  error: string;
  onNavigate: (id: string) => void;
  onToggleForm: () => void;
  onClose: () => void;
  onFormChange: (form: InterviewInput) => void;
  onCreate: () => void;
}) {
  const requiredStage = ROUND_STAGE[form.round_type];
  const willAdvance = currentStage !== requiredStage;
  const stageNote = willAdvance
    ? `当前阶段为「${STAGE_LABELS[currentStage]}」，确认安排后将自动推进至「${STAGE_LABELS[requiredStage]}」`
    : '';
  const minTime = nowLocalMin();

  return (
    <section className="block">
      <h3>
        面试记录
        {interviews.length > 0 && <span className="count-pill">{interviews.length}</span>}
      </h3>
      {interviews.length === 0 ? (
        <div className="muted">暂无面试安排</div>
      ) : (
        interviews.map((interview) => (
          <div
            key={interview.id}
            className="interview-card"
            onClick={() => onNavigate(interview.id)}
          >
            <div className="card-title">
              {ROUND_LABELS[interview.round_type as RoundType] ?? interview.round_type} 面试 ·{' '}
              {interview.interviewer_name}
            </div>
            <div className="card-sub">
              {new Date(interview.scheduled_at).toLocaleString()} · {interview.method} ·{' '}
              {INTERVIEW_STATUS_LABELS[interview.status] ?? interview.status}
            </div>
            {interview.feedback && (
              <div className="card-sub">
                面评：专业 {interview.feedback.professional_score} / 项目{' '}
                {interview.feedback.project_score} / 沟通 {interview.feedback.communication_score} ·
                结论 {interview.feedback.recommendation}
              </div>
            )}
          </div>
        ))
      )}

      <div className="interview-actions">
        {canSchedule && (
          <button className="btn" onClick={onToggleForm}>
            + 安排面试
          </button>
        )}
        {!canSchedule && (
          <span className="muted">仅「一面 / 二面 / 终面」阶段可安排面试，请先推进流程</span>
        )}
      </div>

      {formVisible && (
        <div className="modal-overlay" onClick={onClose}>
          <div className="modal" onClick={(event) => event.stopPropagation()}>
            <div className="modal-head">
              <div className="modal-head-left">
                <div className="modal-head-icon">
                  <CalendarClock size={18} />
                </div>
                <div>
                  <h3>安排面试</h3>
                  <p className="modal-meta">
                    {candidateName} · {jobTitle}
                  </p>
                </div>
              </div>
              <button className="modal-close" onClick={onClose} aria-label="关闭">
                <X size={18} />
              </button>
            </div>

            <div className="modal-body">
              {stageNote && (
                <div className="banner banner-info">
                  <span className="banner-dot" />
                  <span>{stageNote}</span>
                </div>
              )}

              <div className="form-grid">
                <div className="field full">
                  <label>
                    面试官<span className="req">*</span>
                  </label>
                  <select
                    className="input"
                    value={form.interviewer_id}
                    onChange={(event) =>
                      onFormChange({ ...form, interviewer_id: event.target.value })
                    }
                  >
                    <option value="">请选择面试官</option>
                    {interviewers.map((user) => (
                      <option key={user.id} value={user.id}>
                        {user.name}
                        {user.title ? `（${user.title}）` : ''}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="field">
                  <label>
                    面试轮次<span className="req">*</span>
                  </label>
                  <select
                    className="input"
                    value={form.round_type}
                    onChange={(event) =>
                      onFormChange({
                        ...form,
                        round_type: event.target.value as RoundType,
                      })
                    }
                  >
                    <option value="FIRST">一面</option>
                    <option value="SECOND">二面</option>
                    <option value="HR">HR 面</option>
                  </select>
                </div>

                <div className="field">
                  <label>面试方式</label>
                  <select
                    className="input"
                    value={form.method}
                    onChange={(event) => onFormChange({ ...form, method: event.target.value })}
                  >
                    {METHOD_OPTIONS.map((m) => (
                      <option key={m} value={m}>
                        {m}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="field">
                  <label>
                    面试时间<span className="req">*</span>
                  </label>
                  <input
                    className="input"
                    type="datetime-local"
                    min={minTime}
                    value={form.scheduled_at}
                    onChange={(event) =>
                      onFormChange({ ...form, scheduled_at: event.target.value })
                    }
                  />
                </div>

                <div className="field">
                  <label>时长（分钟）</label>
                  <input
                    className="input"
                    type="number"
                    min={15}
                    max={240}
                    step={15}
                    value={form.duration_minutes}
                    onChange={(event) =>
                      onFormChange({ ...form, duration_minutes: +event.target.value })
                    }
                  />
                </div>

                <div className="field full">
                  <label>会议链接</label>
                  <input
                    className="input"
                    placeholder="https://meeting.xxx.com/..."
                    value={form.meeting_url}
                    onChange={(event) =>
                      onFormChange({ ...form, meeting_url: event.target.value })
                    }
                  />
                </div>

                <div className="field full">
                  <label>备注</label>
                  <textarea
                    className="input area"
                    placeholder="面试要点、注意事项等（选填）"
                    value={form.note}
                    onChange={(event) => onFormChange({ ...form, note: event.target.value })}
                  />
                </div>
              </div>

              {error && <div className="alert">{error}</div>}
            </div>

            <div className="modal-foot">
              <span className="modal-meta">* 为必填项</span>
              <div className="modal-foot-btns">
                <button className="btn" onClick={onClose}>
                  取消
                </button>
                <button
                  className="btn btn-primary"
                  disabled={busy || !form.interviewer_id || !form.scheduled_at}
                  onClick={onCreate}
                >
                  {busy ? '提交中…' : '确认安排'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
