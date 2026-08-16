import MatchRing from '../../components/MatchRing';
import type { AgentResult, Resume } from '../../types';

function fmtDate(s: string | null | undefined): string {
  if (!s) return '—';
  return s.replace(/-/g, '.');
}

export function ResumeDetails({ resume }: { resume: Resume | null }) {
  const parsed = resume?.parsed_data;
  const statusTag =
    resume?.parse_status === 'DONE'
      ? { cls: 'tag-green', text: '已解析' }
      : resume?.parse_status === 'FAILED'
        ? { cls: 'tag-red', text: '解析失败' }
        : resume?.parse_status === 'PARSING'
          ? { cls: 'tag-amber', text: '解析中' }
          : { cls: 'tag-amber', text: '待解析' };

  return (
    <section className="block">
      <h3>原始简历</h3>

      {/* 简历文件 */}
      <div className="resume-section">
        <h4 className="resume-section-title">简历文件</h4>
        {resume ? (
          <div className="resume-file-row">
            <span className="resume-filename">{resume.file_name}</span>
            <span className={`tag ${statusTag.cls}`}>{statusTag.text}</span>
          </div>
        ) : (
          <p className="resume-empty">未上传简历</p>
        )}
      </div>

      {parsed ? (
        <>
          {/* 基本信息 */}
          <div className="resume-section">
            <h4 className="resume-section-title">基本信息</h4>
            <div className="resume-fields">
              <div className="resume-field">
                <label>姓名</label>
                <span>{parsed.name || '—'}</span>
              </div>
              <div className="resume-field">
                <label>邮箱</label>
                <span>{parsed.email || '—'}</span>
              </div>
              <div className="resume-field">
                <label>手机</label>
                <span>{parsed.phone || '—'}</span>
              </div>
            </div>
          </div>

          {/* 技能 */}
          {parsed.skills?.length > 0 && (
            <div className="resume-section">
              <h4 className="resume-section-title">技能</h4>
              <div className="resume-tags">
                {parsed.skills.map((s, i) => (
                  <span key={i} className="tag tag-blue">
                    {s}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* 教育经历 */}
          {parsed.education?.length > 0 && (
            <div className="resume-section">
              <h4 className="resume-section-title">教育经历</h4>
              <div className="resume-list">
                {parsed.education.map((edu, i) => (
                  <div key={i} className="resume-list-item">
                    <div className="resume-fields">
                      <div className="resume-field">
                        <label>学校</label>
                        <span>{edu.school || '—'}</span>
                      </div>
                      <div className="resume-field">
                        <label>专业</label>
                        <span>{edu.major || '—'}</span>
                      </div>
                      <div className="resume-field">
                        <label>学历</label>
                        <span>{edu.degree || '—'}</span>
                      </div>
                      <div className="resume-field">
                        <label>时间</label>
                        <span>
                          {fmtDate(edu.start)} ~ {fmtDate(edu.end)}
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 工作经历 */}
          {parsed.work_experience?.length > 0 && (
            <div className="resume-section">
              <h4 className="resume-section-title">工作经历</h4>
              <div className="resume-list">
                {parsed.work_experience.map((w, i) => (
                  <div key={i} className="resume-list-item">
                    <div className="resume-exp-head">
                      <b>{w.company || '—'}</b>
                      <span className="resume-exp-title">{w.title || ''}</span>
                      <span className="muted">
                        {fmtDate(w.start)} ~ {fmtDate(w.end)}
                      </span>
                    </div>
                    {w.description && <p className="resume-desc">{w.description}</p>}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 项目经历 */}
          {parsed.projects?.length > 0 && (
            <div className="resume-section">
              <h4 className="resume-section-title">项目经历</h4>
              <div className="resume-list">
                {parsed.projects.map((p, i) => (
                  <div key={i} className="resume-list-item">
                    <div className="resume-exp-head">
                      <b>{p.name || '—'}</b>
                      <span className="resume-exp-title">{p.role || ''}</span>
                    </div>
                    {p.description && <p className="resume-desc">{p.description}</p>}
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      ) : (
        resume && (
          <p className="resume-empty" style={{ marginTop: 8 }}>
            简历尚未解析，暂无可展示的结构化内容。
          </p>
        )
      )}
    </section>
  );
}

export function AgentAnalysis({
  result,
  busy,
  onRerun,
}: {
  result: AgentResult | null;
  busy: boolean;
  onRerun: () => void;
}) {
  return (
    <section className="block">
      <h3>
        AI 匹配结果
        <button className="btn-link right" onClick={onRerun} disabled={busy}>
          重新分析
        </button>
      </h3>
      {result ? (
        <div className="match-hero">
          <MatchRing score={result.score} size={104} />
          <div className="agent">
            <div className="agent-summary">{result.summary}</div>
            <div className="agent-row">
              <span className="label-ok">优势</span>
              <ul>
                {result.strengths.map((item, index) => (
                  <li key={index}>{item}</li>
                ))}
              </ul>
            </div>
            <div className="agent-row">
              <span className="label-warn">不足</span>
              <ul>
                {result.gaps.map((item, index) => (
                  <li key={index}>{item}</li>
                ))}
              </ul>
            </div>
            <div className="agent-rec">建议：{result.recommendation}</div>
          </div>
        </div>
      ) : (
        <div className="muted">暂无 AI 分析结果</div>
      )}
    </section>
  );
}
