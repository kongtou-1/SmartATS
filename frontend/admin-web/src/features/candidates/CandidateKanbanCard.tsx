import { useNavigate } from 'react-router-dom';
import {
  CalendarClock,
  Briefcase,
  GraduationCap,
  Building2,
  Send,
} from 'lucide-react';
import type { AdminApplication } from '../../types';
import { isInterviewableStage, OFFER_STATUS_LABELS } from '../../types';

function scoreClass(s: number | null): string {
  if (s === null) return '';
  if (s >= 80) return 'hi';
  if (s >= 60) return 'mid';
  return 'lo';
}

function formatInterviewAt(iso: string | null): { date: string; time: string } | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (isNaN(d.getTime())) return null;
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  const hh = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  return { date: `${y}-${m}-${day}`, time: `${hh}:${mm}` };
}

const ROUND_LABELS: Record<string, string> = {
  FIRST: '一面',
  SECOND: '二面',
  HR: 'HR 面',
};

export default function CandidateKanbanCard({
  app,
  onAdvance,
  onSelect,
  selected,
  onToggleSelect,
  onSendOffer,
}: {
  app: AdminApplication;
  onAdvance?: (a: AdminApplication) => void;
  onSelect?: (a: AdminApplication) => void;
  selected?: boolean;
  onToggleSelect?: (a: AdminApplication) => void;
  onSendOffer?: (a: AdminApplication) => void;
}) {
  const navigate = useNavigate();
  const scheduleable = isInterviewableStage(app.current_stage);
  const interview = formatInterviewAt(app.next_interview_at);
  const interviewRound = app.next_interview_round
    ? ROUND_LABELS[app.next_interview_round] || app.next_interview_round
    : '';

  const cardClass = `kanban-card${selected ? ' selected' : ''}`;

  return (
    <div
      className={cardClass}
      onClick={() => onSelect ? onSelect(app) : navigate(`/candidates/${app.id}`)}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') (onSelect ? onSelect(app) : navigate(`/candidates/${app.id}`));
      }}
    >
      <div className="kanban-card-head">
        <div className="kanban-card-name" title={app.candidate_name}>
          {app.candidate_name || '匿名候选人'}
        </div>
        <div className="kanban-card-head-right">
          {onToggleSelect && (
            <input
              type="checkbox"
              checked={!!selected}
              onClick={(e) => e.stopPropagation()}
              onChange={() => onToggleSelect(app)}
              className="kanban-card-check"
              aria-label={`选择 ${app.candidate_name}`}
            />
          )}
          {app.ai_score !== null && (
            <span className={`score-pill ${scoreClass(app.ai_score)}`}>{app.ai_score}</span>
          )}
        </div>
      </div>

      <div className="kanban-card-job">{app.job_title || '未指定岗位'}</div>

      <div className="kanban-card-meta">
        {app.latest_company && (
          <div className="kanban-meta-row">
            <Building2 size={12} className="meta-ico" />
            <span className="kanban-meta-text">{app.latest_company}</span>
          </div>
        )}
        {(app.latest_school || app.latest_degree) && (
          <div className="kanban-meta-row">
            <GraduationCap size={12} className="meta-ico" />
            <span className="kanban-meta-text">
              {app.latest_school || '—'}
              {app.latest_degree ? `（${app.latest_degree}）` : ''}
            </span>
          </div>
        )}
      </div>

      {interview && (
        <div className="kanban-card-iv">
          <span className="kanban-iv-tag">
            {interviewRound || '面试'} <span className="kanban-iv-tag-state">待开始</span>
          </span>
          <span className="kanban-iv-when">
            {interview.date} · {interview.time}
            {app.next_interviewer_name ? ` · ${app.next_interviewer_name}` : ''}
          </span>
        </div>
      )}

      {app.skills.length > 0 && (
        <div className="kanban-card-skills">
          {app.skills.slice(0, 3).map((s) => (
            <span className="kanban-skill" key={s}>
              {s}
            </span>
          ))}
        </div>
      )}

      <div className="kanban-card-foot">
        {app.offer_status && OFFER_STATUS_LABELS[app.offer_status] && (
          <span className="kanban-card-offer-tag">{OFFER_STATUS_LABELS[app.offer_status]}</span>
        )}
        {scheduleable && (
          <button
            type="button"
            className="btn-link kanban-card-action"
            onClick={(e) => {
              e.stopPropagation();
              // 跳转详情页，那里可以创建面试
              navigate(`/candidates/${app.id}?action=schedule`);
            }}
          >
            <CalendarClock size={13} />
            约面试
          </button>
        )}
        {onAdvance && app.current_stage !== 'HIRED' && app.current_stage !== 'REJECTED' && (
          <button
            type="button"
            className="btn-link kanban-card-action primary"
            onClick={(e) => {
              e.stopPropagation();
              onAdvance(app);
            }}
          >
            <Briefcase size={13} />
            推进
            <span aria-hidden>›</span>
          </button>
        )}
        {onSendOffer && app.current_stage === 'HIRED' && !app.offer_status && (
          <button
            type="button"
            className="btn-link kanban-card-action primary"
            onClick={(e) => {
              e.stopPropagation();
              onSendOffer(app);
            }}
          >
            <Send size={13} />
            发 Offer
          </button>
        )}
      </div>
    </div>
  );
}
