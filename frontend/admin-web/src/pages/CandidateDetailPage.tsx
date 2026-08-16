import { useCallback, useEffect, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { Mail, Phone, MapPin } from 'lucide-react';
import { AgentAnalysis, ResumeDetails } from '../features/candidates/CandidateAnalysis';
import CandidateCommunications, {
  type CandidateCommunication,
} from '../features/candidates/CandidateCommunications';
import { CandidateFlowActions, type FlowAction } from '../features/candidates/CandidateFlowActions';
import { CandidateInterviews, ROUND_LABELS, ROUND_STAGE, localInputToIso } from '../features/candidates/CandidateInterviews';
import { CurrentPipeline, StageHistory } from '../features/candidates/CandidatePipeline';
import ProfileSnapshot from '../features/candidates/ProfileSnapshot';
import { api } from '../lib/client';
import type { AdminApplicationDetail, InterviewInput, Stage, User } from '../types';
import { STAGE_LABELS, STAGE_ORDER, isInterviewableStage } from '../types';

export default function CandidateDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [detail, setDetail] = useState<AdminApplicationDetail | null>(null);
  const [interviewers, setInterviewers] = useState<User[]>([]);
  const [showInterviewForm, setShowInterviewForm] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [communications, setCommunications] = useState<CandidateCommunication[]>([]);
  const [targetStage, setTargetStage] = useState<Stage>('SCREENING');
  const [actionReason, setActionReason] = useState('');
  const [form, setForm] = useState<InterviewInput>({
    application_id: id ?? '',
    interviewer_id: '',
    round_type: 'FIRST',
    scheduled_at: '',
    duration_minutes: 60,
    method: '视频面试',
    meeting_url: '',
    note: '',
  });

  const load = useCallback(() => {
    if (!id) return;
    api
      .adminGetApplication(id)
      .then((result) => {
        setDetail(result);
        const fallback = STAGE_ORDER.find((stage) => stage !== result.current_stage);
        if (fallback) setTargetStage(fallback);
        const roundByStage: Partial<Record<Stage, InterviewInput['round_type']>> = {
          FIRST_INTERVIEW: 'FIRST',
          SECOND_INTERVIEW: 'SECOND',
          FINAL_REVIEW: 'HR',
        };
        const round = roundByStage[result.current_stage];
        if (round) setForm((current) => ({ ...current, round_type: round }));
      })
      .catch((error) => setMessage((error as Error).message));
  }, [id]);

  useEffect(load, [load]);
  useEffect(() => {
    if (detail?.candidate_id) api.communications?.(detail.candidate_id).then(setCommunications);
  }, [detail?.candidate_id]);
  useEffect(() => {
    api
      .adminListInterviewers()
      .then(setInterviewers)
      .catch((error) => setMessage((error as Error).message || '加载面试官列表失败'));
  }, []);

  // 仅依赖 detail 的派生量，detail 为空时安全降级为 false。
  // 必须声明在下面的深链 useEffect 之前（依赖数组会立即求值），且都在提前 return 之前。
  const isFinal = detail
    ? ['HIRED', 'REJECTED', 'WITHDRAWN'].includes(detail.current_stage)
    : false;
  // 仅「面试环节」阶段（一面/二面/终面）可以安排面试；
  // 已投递 / 简历初筛 / 初筛通过属于筛选环节，必须先推进到面试阶段。
  const canSchedule =
    !!detail && detail.status === 'ACTIVE' && !isFinal && isInterviewableStage(detail.current_stage);

  // 面试决策提示：面试官的「通过/淘汰」只是建议，需 HR 确认后才生效。
  // 在面试环节阶段统计待 HR 确认的已评面试、以及待面试官提交评价的面试。
  const pendingHrCount = detail
    ? detail.interviews.filter((iv) => iv.status === 'PENDING_HR_REVIEW').length
    : 0;
  const awaitingCount = detail
    ? detail.interviews.filter((iv) => iv.status === 'SCHEDULED').length
    : 0;
  const showInterviewHint =
    !!detail && isInterviewableStage(detail.current_stage) && (pendingHrCount > 0 || awaitingCount > 0);

  // 通过 ?action=schedule 深链直接进入时自动展开安排面试表单。
  // ⚠️ 必须放在提前 return 之前，否则 detail 加载前后 hook 数量会变化，触发
  // “Rendered more hooks than during the previous render” 崩溃。
  useEffect(() => {
    if (searchParams.get('action') === 'schedule' && canSchedule && !showInterviewForm) {
      setShowInterviewForm(true);
      navigate(`/candidates/${id}`, { replace: true });
    }
  }, [searchParams, canSchedule, showInterviewForm, id, navigate]);

  async function runFlowAction(action: FlowAction) {
    if (!id || !actionReason.trim()) {
      setMessage('请填写本次操作原因');
      return;
    }
    setBusy(true);
    setMessage('');
    try {
      const reason = actionReason.trim();
      const result =
        action === 'transition'
          ? await api.adminTransition(id, targetStage, reason)
          : action === 'hold'
            ? await api.adminHold(id, reason)
            : action === 'resume'
              ? await api.adminResume(id, reason)
              : await api.adminReject(id, reason);
      setDetail(result);
      setActionReason('');
    } catch (error) {
      setMessage((error as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function rerun() {
    if (!id) return;
    setBusy(true);
    try {
      const result = await api.adminAgentRerun(id);
      setDetail((current) =>
        current ? { ...current, agent_result: result, ai_score: result.score } : current,
      );
    } catch (error) {
      setMessage((error as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function createInterview() {
    if (!id) return;
    setBusy(true);
    setMessage('');
    try {
      // 流程约束：只有面试环节阶段（一面/二面/终面）才能安排面试。
      // 已投递 / 简历初筛 / 初筛通过必须先推进到面试阶段，禁止从筛选环节直接约面试。
      if (!detail || !isInterviewableStage(detail.current_stage)) {
        setMessage('当前阶段不可安排面试，请先推进至一面 / 二面 / 终面');
        return;
      }
      // 后端要求申请阶段与面试轮次一致：若当前阶段不匹配，先自动推进到对应阶段。
      const requiredStage = ROUND_STAGE[form.round_type];
      if (detail.current_stage !== requiredStage) {
        const updated = await api.adminTransition(id, requiredStage, `安排${ROUND_LABELS[form.round_type]}面试`);
        setDetail(updated);
      }
      await api.adminCreateInterview({
        ...form,
        application_id: id,
        scheduled_at: localInputToIso(form.scheduled_at),
      });
      setShowInterviewForm(false);
      load();
    } catch (error) {
      setMessage((error as Error).message);
    } finally {
      setBusy(false);
    }
  }

  if (!detail) return <div className="page-loading">{message || '加载中…'}</div>;

  return (
    <div className="page">
      <button className="btn-link" onClick={() => navigate('/candidates')}>
        ← 返回候选人列表
      </button>

      <div className="cd-hero">
        <div className="cd-hero-main">
          <div className="cd-avatar">{detail.candidate.name.slice(0, 1)}</div>
          <div className="cd-hero-id">
            <div className="cd-hero-name">
              <h1>{detail.candidate.name}</h1>
              <span className="tag tag-blue">{STAGE_LABELS[detail.current_stage]}</span>
              {detail.status === 'ON_HOLD' && <span className="tag tag-amber">暂缓</span>}
            </div>
            <div className="cd-hero-meta">
              {detail.job.title} · 投递于 {new Date(detail.applied_at).toLocaleString()}
            </div>
            <div className="cd-hero-contacts">
              <span className="cd-contact">
                <Mail size={14} /> {detail.candidate.email}
              </span>
              <span className="cd-contact">
                <Phone size={14} /> {detail.candidate.phone}
              </span>
              <span className="cd-contact">
                <MapPin size={14} /> {detail.candidate.city || '—'}
              </span>
            </div>
          </div>
        </div>
        {canSchedule && (
          <div className="cd-hero-actions">
            <button className="btn btn-primary" onClick={() => setShowInterviewForm(true)}>
              + 安排面试
            </button>
          </div>
        )}
      </div>

      <div className="cd-layout">
        <div className="cd-main">
          {message && <div className="alert">{message}</div>}
          {showInterviewHint && (
            <div className="cd-hint">
              <span className="cd-hint-dot" />
              <span>
                {pendingHrCount > 0 && (
                  <>
                    有 <strong>{pendingHrCount}</strong> 场面试已评，面试官的「通过 / 淘汰」仅为建议，
                    <strong>需 HR 在面试详情页确认后才会推进阶段</strong>。
                  </>
                )}
                {pendingHrCount > 0 && awaitingCount > 0 && <span className="cd-hint-sep">·</span>}
                {awaitingCount > 0 && <>{awaitingCount} 场面试待面试官提交评价。</>}
              </span>
            </div>
          )}
          <CurrentPipeline currentStage={detail.current_stage} />
          <AgentAnalysis result={detail.agent_result} busy={busy} onRerun={rerun} />
          <ResumeDetails resume={detail.resume} />
          <CandidateInterviews
            interviews={detail.interviews}
            interviewers={interviewers}
            form={form}
            busy={busy}
            canSchedule={canSchedule}
            formVisible={showInterviewForm}
            candidateName={detail.candidate.name}
            jobTitle={detail.job.title}
            currentStage={detail.current_stage}
            error={message}
            onNavigate={(interviewId) => navigate(`/interviews/${interviewId}`)}
            onToggleForm={() => setShowInterviewForm((current) => !current)}
            onClose={() => setShowInterviewForm(false)}
            onFormChange={setForm}
            onCreate={createInterview}
          />
          <StageHistory history={detail.stage_history} />
          {detail.candidate_profile_snapshot ? (
            <section className="block">
              <h3>本次投递资料快照</h3>
              <ProfileSnapshot
                profile={detail.candidate_profile_snapshot}
                jobType={detail.job_type_snapshot}
              />
            </section>
          ) : (
            <section className="block">
              <h3>本次投递资料快照</h3>
              <div className="muted">旧申请无结构化资料快照</div>
            </section>
          )}
          <CandidateCommunications communications={communications} />
        </div>

        <aside className="cd-aside">
          {!isFinal && (
            <CandidateFlowActions
              detail={detail}
              targetStage={targetStage}
              reason={actionReason}
              busy={busy}
              onTargetStageChange={setTargetStage}
              onReasonChange={setActionReason}
              onAction={runFlowAction}
            />
          )}
        </aside>
      </div>
    </div>
  );
}
