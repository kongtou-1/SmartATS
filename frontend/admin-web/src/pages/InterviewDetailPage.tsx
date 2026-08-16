import { useEffect, useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import { CalendarClock, CheckCircle2, Clock, Link2, User } from 'lucide-react';
import { api } from '../lib/client';
import { useAuth } from '../components/AuthContext';
import type {
  FeedbackConfirmIn,
  FeedbackDecision,
  FeedbackInput,
  InterviewDetail,
  Stage,
} from '../types';
import { INTERVIEW_STATUS_LABELS, STAGE_LABELS, STAGE_ORDER } from '../types';
import InterviewEditModal from '../features/interviews/InterviewEditModal';

const REC: Record<string, string> = { PASS: '通过', HOLD: '待定', FAIL: '不通过' };

function formatTimeRange(scheduledAt: string, durationMinutes: number) {
  const start = new Date(scheduledAt);
  const end = new Date(start.getTime() + durationMinutes * 60_000);
  const fmt = (d: Date) =>
    `${d.getFullYear()}/${d.getMonth() + 1}/${d.getDate()} ${String(d.getHours()).padStart(2, '0')}:${String(
      d.getMinutes(),
    ).padStart(2, '0')}`;
  return `${fmt(start)} – ${String(end.getHours()).padStart(2, '0')}:${String(end.getMinutes()).padStart(2, '0')}（${durationMinutes} 分钟）`;
}

function useInterviewStatus(it: InterviewDetail | null) {
  return useMemo(() => {
    if (!it) {
      return { label: '—', variant: 'tag', inProgress: false, overdue: false };
    }
    const now = new Date();
    const start = new Date(it.scheduled_at);
    const end = new Date(start.getTime() + it.duration_minutes * 60_000);
    const inProgress = it.status === 'SCHEDULED' && now >= start && now < end;
    const overdue = it.status === 'SCHEDULED' && now >= end;
    if (inProgress) {
      return { label: '进行中', variant: 'tag-blue' as const, inProgress: true, overdue: false };
    }
    const base = INTERVIEW_STATUS_LABELS[it.status as keyof typeof INTERVIEW_STATUS_LABELS] ?? it.status;
    let variant: string;
    if (it.status === 'PENDING_HR_REVIEW') variant = 'tag-amber';
    else if (it.status === 'COMPLETED') variant = 'tag-green';
    else if (it.status === 'CANCELLED') variant = 'tag-gray';
    else if (overdue) variant = 'tag-amber';
    else variant = 'tag';
    return { label: base, variant, inProgress, overdue };
  }, [it?.status, it?.scheduled_at, it?.duration_minutes]);
}

export default function InterviewDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const [it, setIt] = useState<InterviewDetail | null>(null);
  const [appStage, setAppStage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');
  const [editOpen, setEditOpen] = useState(false);

  const [confirmReason, setConfirmReason] = useState('');
  const [confirmBusy, setConfirmBusy] = useState(false);
  const [confirmMsg, setConfirmMsg] = useState('');

  const isInterviewer = user?.role === 'INTERVIEWER';
  const canManage = user?.role === 'HR' || user?.role === 'SUPER_ADMIN';

  const [fb, setFb] = useState<FeedbackInput>({
    professional_score: 3,
    project_score: 3,
    communication_score: 3,
    strengths: '',
    weaknesses: '',
    summary: '',
    recommendation: 'PASS',
  });

  async function load() {
    if (!id) return;
    const fn =
      user?.role === 'INTERVIEWER' ? api.interviewerGetInterview(id) : api.adminGetInterview(id);
    const detail = await fn;
    setIt(detail);
    if (canManage && detail.application_id) {
      try {
        const app = await api.adminGetApplication(detail.application_id);
        setAppStage(app.current_stage);
      } catch {
        /* 忽略：拿不到申请阶段不影响面评展示 */
      }
    }
  }
  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, user?.role]);

  useEffect(() => {
    if (it?.feedback) {
      setFb({
        professional_score: it.feedback.professional_score,
        project_score: it.feedback.project_score,
        communication_score: it.feedback.communication_score,
        strengths: it.feedback.strengths,
        weaknesses: it.feedback.weaknesses,
        summary: it.feedback.summary,
        recommendation: it.feedback.recommendation,
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [it?.feedback?.id]);

  async function submitFeedback() {
    if (!id) return;
    setMsg('');
    if (!fb.summary.trim()) {
      setMsg('请填写面试总结后再提交');
      return;
    }
    setBusy(true);
    try {
      await api.interviewerFeedback(id, fb);
      load();
    } catch (e) {
      setMsg((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function cancelInterview() {
    if (!id || !window.confirm('确认取消这场面试？候选人会收到取消通知邮件（模拟落库）。')) return;
    setBusy(true);
    setMsg('');
    try {
      await api.adminCancelInterview(id);
      load();
    } catch (e) {
      setMsg((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function confirmFeedback(mode: FeedbackDecision) {
    if (!id) return;
    setConfirmBusy(true);
    setConfirmMsg('');
    try {
      const payload: FeedbackConfirmIn = {
        mode,
        reason: confirmReason.trim(),
        ...(mode === 'ADVANCE' && nextStage ? { target_stage: nextStage } : {}),
      };
      await api.adminConfirmFeedback(id, payload);
      setConfirmReason('');
      load();
    } catch (e) {
      setConfirmMsg((e as Error).message);
    } finally {
      setConfirmBusy(false);
    }
  }

  const status = useInterviewStatus(it);

  if (!it) return <div className="page-loading">加载中…</div>;

  const submitted = !!it.feedback;
  const canEdit =
    isInterviewer &&
    !submitted &&
    it.status === 'SCHEDULED' &&
    new Date(it.scheduled_at) <= new Date();

  const locked = submitted;

  const nextStage: Stage | undefined = (() => {
    if (!appStage) return undefined;
    const idx = STAGE_ORDER.indexOf(appStage as Stage);
    if (idx < 0 || idx >= STAGE_ORDER.length - 1) return undefined;
    return STAGE_ORDER[idx + 1];
  })();
  const canAdvance = !!nextStage && nextStage !== 'HIRED';

  return (
    <div className="page narrow">
      <div className="page-head">
        <h1>
          {it.round_type} 面试
          <span className={`tag ${status.variant}`} style={{ marginLeft: 10, verticalAlign: 'middle' }}>
            {status.inProgress && <span className="live-dot" />} {status.label}
          </span>
        </h1>
      </div>

      <section className="block interview-head">
        <div className="interview-meta">
          <div className="meta-cell">
            <span className="meta-label">候选人</span>
            <span className="meta-value">
              <User size={14} /> {it.candidate_name}
            </span>
          </div>
          <div className="meta-cell">
            <span className="meta-label">岗位</span>
            <span className="meta-value">{it.job_title}</span>
          </div>
          <div className="meta-cell">
            <span className="meta-label">面试官</span>
            <span className="meta-value">{it.interviewer_name}</span>
          </div>
          <div className="meta-cell wide">
            <span className="meta-label">时间</span>
            <span className="meta-value">
              <Clock size={14} /> {formatTimeRange(it.scheduled_at, it.duration_minutes)}
            </span>
          </div>
          <div className="meta-cell">
            <span className="meta-label">方式</span>
            <span className="meta-value">{it.method || '—'}</span>
          </div>
          {it.meeting_url ? (
            <div className="meta-cell wide">
              <span className="meta-label">链接</span>
              <a href={it.meeting_url} target="_blank" rel="noreferrer" className="meta-link">
                <Link2 size={14} /> {it.meeting_url}
              </a>
            </div>
          ) : null}
          {it.note ? (
            <div className="meta-cell wide">
              <span className="meta-label">备注</span>
              <span className="meta-value">{it.note}</span>
            </div>
          ) : null}
        </div>

        {it.status === 'SCHEDULED' && canManage && (
          <div className="interview-actions-bar">
            <button className="btn" disabled={busy} onClick={() => setEditOpen(true)}>
              <CalendarClock size={15} /> 改期 / 编辑
            </button>
            <button className="btn btn-danger" disabled={busy} onClick={cancelInterview}>
              {busy ? '处理中…' : '取消面试'}
            </button>
            <span className="muted">取消后候选人将收到通知（模拟邮件落库）。</span>
          </div>
        )}
      </section>

      {it && (
        <InterviewEditModal
          open={editOpen}
          interview={it}
          onClose={() => setEditOpen(false)}
          onSaved={() => {
            setEditOpen(false);
            load();
          }}
        />
      )}

      <section className="block interview-feedback-block">
        <h3>面试评价</h3>
        {locked ? (
          <ReadOnlyFeedback feedback={it.feedback!} locked />
        ) : isInterviewer && canEdit ? (
          <div className="feedback-form">
            <div className="feedback-row three">
              <ScoreField
                label="专业能力"
                value={fb.professional_score}
                onChange={(v) => setFb({ ...fb, professional_score: v })}
              />
              <ScoreField
                label="项目经验"
                value={fb.project_score}
                onChange={(v) => setFb({ ...fb, project_score: v })}
              />
              <ScoreField
                label="沟通能力"
                value={fb.communication_score}
                onChange={(v) => setFb({ ...fb, communication_score: v })}
              />
            </div>
            <div className="feedback-row two">
              <label className="feedback-field">
                <span>优势</span>
                <textarea
                  className="input"
                  value={fb.strengths}
                  onChange={(e) => setFb({ ...fb, strengths: e.target.value })}
                  placeholder="候选人突出的能力或亮点"
                />
              </label>
              <label className="feedback-field">
                <span>不足</span>
                <textarea
                  className="input"
                  value={fb.weaknesses}
                  onChange={(e) => setFb({ ...fb, weaknesses: e.target.value })}
                  placeholder="候选人存在的短板或风险"
                />
              </label>
            </div>
            <div className="feedback-row">
              <label className="feedback-field">
                <span>总结</span>
                <span className="req" />
                <textarea
                  className="input"
                  value={fb.summary}
                  onChange={(e) => setFb({ ...fb, summary: e.target.value })}
                  placeholder="简要总结面试整体印象（必填）"
                />
              </label>
            </div>
            <div className="feedback-row action">
              <label className="feedback-field rec">
                <span>面试建议</span>
                <select
                  className="input"
                  value={fb.recommendation}
                  onChange={(e) =>
                    setFb({ ...fb, recommendation: e.target.value as FeedbackInput['recommendation'] })
                  }
                >
                  <option value="PASS">通过</option>
                  <option value="HOLD">待定</option>
                  <option value="FAIL">不通过</option>
                </select>
              </label>
              <button className="btn btn-primary" disabled={busy} onClick={submitFeedback}>
                {busy ? '提交中…' : '提交面评'}
              </button>
            </div>
            {msg && <div className="alert">{msg}</div>}
          </div>
        ) : it.feedback ? (
          <ReadOnlyFeedback feedback={it.feedback!} />
        ) : isInterviewer ? (
          <div className="muted">面试时间开始后（到点）才可填写评价</div>
        ) : (
          <div className="muted">面试官尚未填写评价</div>
        )}
      </section>

      {canManage && it.status === 'PENDING_HR_REVIEW' && (
        <section className="block">
          <h3>HR 确认面评决策</h3>
          <div className="muted">
            面试官给出的「是否通过」仅为参考建议，最终决策（推进 / 淘汰 / 暂缓）只能由 HR 或管理员在此操作。
          </div>
          {it.feedback && (
            <div className="agent-rec">
              面试官建议：{REC[it.feedback.recommendation]}（仅供参考）
            </div>
          )}
          <label className="field">
            <span>确认原因 / 备注</span>
            <textarea
              className="input area"
              value={confirmReason}
              onChange={(e) => setConfirmReason(e.target.value)}
              placeholder="说明决策依据，必填"
            />
          </label>
          <div className="block action-row">
            <button
              className="btn btn-primary"
              disabled={confirmBusy || !confirmReason.trim()}
              onClick={() => confirmFeedback('ADOPT')}
            >
              采纳面试官建议
            </button>
            <button
              className="btn"
              disabled={confirmBusy || !confirmReason.trim() || !canAdvance}
              onClick={() => confirmFeedback('ADVANCE')}
              title={canAdvance ? '' : '当前阶段无有效下一阶段（终面录用需走 Offer 流程）'}
            >
              推进至{canAdvance ? STAGE_LABELS[nextStage!] : '下一阶段'}
            </button>
            <button
              className="btn btn-danger"
              disabled={confirmBusy || !confirmReason.trim()}
              onClick={() => confirmFeedback('REJECT')}
            >
              淘汰
            </button>
            <button
              className="btn"
              disabled={confirmBusy || !confirmReason.trim()}
              onClick={() => confirmFeedback('HOLD')}
            >
              暂缓
            </button>
            <button
              className="btn"
              disabled={confirmBusy || !confirmReason.trim()}
              onClick={() => confirmFeedback('CONFIRM_ONLY')}
            >
              仅确认面评
            </button>
          </div>
          {confirmMsg && <div className="alert">{confirmMsg}</div>}
        </section>
      )}
    </div>
  );
}

function ScoreField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
}) {
  return (
    <label className="feedback-field score">
      <span>{label}（1-5）</span>
      <input
        className="input"
        type="number"
        min={1}
        max={5}
        value={value}
        onChange={(e) => onChange(+e.target.value)}
      />
    </label>
  );
}

function ReadOnlyFeedback({
  feedback,
  locked,
}: {
  feedback: NonNullable<InterviewDetail['feedback']>;
  locked?: boolean;
}) {
  return (
    <div className="feedback-readonly">
      <div className="feedback-scores">
        <div className="score-badge">
          <span className="score-label">专业</span>
          <span className="score-num">{feedback.professional_score}</span>
        </div>
        <div className="score-badge">
          <span className="score-label">项目</span>
          <span className="score-num">{feedback.project_score}</span>
        </div>
        <div className="score-badge">
          <span className="score-label">沟通</span>
          <span className="score-num">{feedback.communication_score}</span>
        </div>
        <div className="score-badge rec">
          <span className="score-label">建议</span>
          <span className="score-num">{REC[feedback.recommendation]}</span>
        </div>
      </div>
      <div className="feedback-texts">
        {feedback.strengths && (
          <div className="feedback-text">
            <b>优势</b>
            <p>{feedback.strengths}</p>
          </div>
        )}
        {feedback.weaknesses && (
          <div className="feedback-text">
            <b>不足</b>
            <p>{feedback.weaknesses}</p>
          </div>
        )}
        {feedback.summary && (
          <div className="feedback-text full">
            <b>总结</b>
            <p>{feedback.summary}</p>
          </div>
        )}
      </div>
      {locked && (
        <div className="feedback-locked">
          <CheckCircle2 size={14} /> 面评已提交，不可修改
        </div>
      )}
    </div>
  );
}
