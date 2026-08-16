import MatchRing from '../../components/MatchRing';
import type { AdminApplicationDetail } from '../../types';

function gradeFromScore(s: number | null): string {
  if (s == null) return '—';
  if (s >= 90) return 'A+';
  if (s >= 80) return 'A';
  if (s >= 70) return 'B+';
  if (s >= 60) return 'B';
  return 'C';
}
function gradeClass(s: number | null): string {
  if (s == null) return '';
  if (s >= 80) return 'grade-hi';
  if (s >= 60) return 'grade-mid';
  return 'grade-lo';
}

export default function ScreeningResume({
  detail,
}: {
  detail: AdminApplicationDetail;
  loading?: boolean;
}) {
  const p = detail.candidate_profile_snapshot;
  const agent = detail.agent_result;
  const skills = detail.resume?.parsed_data?.skills || [];
  const score = detail.ai_score;
  const name = p?.name || detail.candidate.name;

  return (
    <section className="swb-resume card">
      <header className="swb-resume-head">
        <div className="swb-resume-id">
          <div className="swb-avatar-lg">{name?.[0] || '?'}</div>
          <div>
            <h2>{name}</h2>
            <div className="muted">应聘岗位：{detail.job.title}</div>
            <div className="swb-sub">
              {p?.phone || detail.candidate.phone} · {p?.contact_email || detail.candidate.email}
              {p?.preferred_locations?.length ? ` · 期望：${p.preferred_locations.join('、')}` : ''}
            </div>
          </div>
        </div>
        <div className="swb-resume-score">
          <MatchRing score={score ?? 0} size={96} />
          {score != null && <span className={`swb-grade ${gradeClass(score)}`}>{gradeFromScore(score)} 级</span>}
        </div>
      </header>

      <div className="swb-section">
        <h3>AI 核心亮点解析</h3>
        {agent ? (
          <div className="swb-aihl">
            <p className="swb-ai-summary">{agent.summary || '—'}</p>
            <div className="swb-tags-green">
              {(agent.strengths || []).map((s, i) => (
                <span className="tag tag-ok" key={i}>
                  {s}
                </span>
              ))}
            </div>
          </div>
        ) : (
          <div className="muted">暂无 AI 分析</div>
        )}
      </div>

      <div className="swb-section">
        <h3>过往公司与核心产出业绩</h3>
        {p?.work_experiences?.length ? (
          p.work_experiences.map((w, i) => (
            <div className="swb-exp" key={i}>
              <div className="swb-exp-head">
                <b>{w.company}</b> · {w.title}
                <span className="muted"> {w.start} - {w.current ? '至今' : w.end}</span>
              </div>
              {w.description && <p>{w.description}</p>}
            </div>
          ))
        ) : (
          <div className="muted">无工作经历</div>
        )}
        {p?.internships?.length ? (
          p.internships.map((w, i) => (
            <div className="swb-exp" key={`i${i}`}>
              <div className="swb-exp-head">
                <b>{w.company}</b> · {w.title}
                <span className="muted">（实习） {w.start} - {w.current ? '至今' : w.end}</span>
              </div>
              {w.description && <p>{w.description}</p>}
            </div>
          ))
        ) : null}
      </div>

      <div className="swb-section">
        <h3>项目经验与技术栈</h3>
        {p?.projects?.length ? (
          p.projects.map((pr, i) => (
            <div className="swb-exp" key={i}>
              <div className="swb-exp-head">
                <b>{pr.name}</b> · {pr.role}
                <span className="muted"> {pr.start} - {pr.current ? '至今' : pr.end}</span>
              </div>
              {pr.description && <p>{pr.description}</p>}
            </div>
          ))
        ) : (
          <div className="muted">无项目经历</div>
        )}
      </div>

      <div className="swb-section">
        <h3>学历教育背景及技能标签</h3>
        {p?.education?.length ? (
          <div className="swb-edu">
            {p.education.map((e, i) => (
              <span className="tag" key={i}>
                {e.school} · {e.degree} · {e.major}
              </span>
            ))}
          </div>
        ) : (
          <div className="muted">无教育记录</div>
        )}
        {skills.length > 0 && (
          <div className="swb-edu">
            {skills.map((s, i) => (
              <span className="tag tag-tech" key={i}>
                {s}
              </span>
            ))}
          </div>
        )}
        {p?.languages?.length ? (
          <div className="swb-edu">
            {p.languages.map((l, i) => (
              <span className="tag" key={i}>
                {l.language} · {l.proficiency}
              </span>
            ))}
          </div>
        ) : null}
        {p?.self_evaluation ? (
          <div className="swb-self">
            <span className="muted">自我评价：</span>
            {p.self_evaluation}
          </div>
        ) : null}
      </div>
    </section>
  );
}
