import { useState } from 'react';
import MatchRing from '../../components/MatchRing';
import { api } from '../../lib/client';
import type { AdminApplicationDetail, AgentRecommendation } from '../../types';
import { CheckCircle2, XCircle, RefreshCw, ExternalLink, AlertTriangle, FileText } from 'lucide-react';

interface Props {
  applicationId: string;
  detail: AdminApplicationDetail;
  busy: boolean;
  onPass: () => void;
  onReject: () => void;
  onRerun: () => void;
  onViewFull: () => void;
}

const REC_LABEL: Record<AgentRecommendation, string> = {
  RECOMMEND: '推荐进入下一轮',
  CONSIDER: '建议进一步考察',
  REJECT: '建议谨慎 / 暂不推进',
};

export default function ScreeningDecisionPanel({
  applicationId,
  detail,
  busy,
  onPass,
  onReject,
  onRerun,
  onViewFull,
}: Props) {
  const agent = detail.agent_result;
  const risk =
    !!agent &&
    (agent.recommendation === 'CONSIDER' ||
      agent.recommendation === 'REJECT' ||
      (agent.gaps && agent.gaps.length > 0));
  const hasResume = !!detail.resume?.storage_key;
  const [downloading, setDownloading] = useState(false);

  async function handleViewResume() {
    if (!hasResume || downloading) return;
    setDownloading(true);
    try {
      await api.adminDownloadResume(applicationId);
    } catch (e) {
      window.alert(`打开简历失败：${e instanceof Error ? e.message : e}`);
    } finally {
      setDownloading(false);
    }
  }

  return (
    <aside className="swb-decision card">
      {/* 顶部：原始简历 */}
      <section className="swb-resume-preview">
        <button
          className="swb-resume-btn"
          onClick={handleViewResume}
          disabled={!hasResume || busy || downloading}
          title={hasResume ? '查看候选人上传的原始简历 PDF' : '暂无原始简历'}
        >
          <FileText size={18} />
          <span className="swb-resume-btn-title">查看原始简历</span>
          <span className="swb-resume-btn-meta">
            {detail.resume?.file_name || '未上传简历'}
          </span>
        </button>
      </section>

      {/* 中部：AI 画像 */}
      <section className="swb-ai">
        <h3>AI 契合度画像</h3>
        <div className="swb-ai-match">
          <MatchRing score={detail.ai_score ?? 0} size={104} />
        </div>

        <div className="swb-ai-block">
          <div className="swb-ai-label label-ok">契合度优势分析</div>
          {agent?.strengths?.length ? (
            <ul className="swb-adv">
              {agent.strengths.map((s, i) => (
                <li key={i}>{s}</li>
              ))}
            </ul>
          ) : (
            <div className="muted">暂无优势数据</div>
          )}
        </div>

        <div className="swb-ai-block">
          <div className="swb-ai-label label">AI 总体评价</div>
          <p className="swb-ai-summary">{agent?.summary || '暂无'}</p>
        </div>

        {risk && (
          <div className="swb-risk">
            <div className="swb-risk-title">
              <AlertTriangle size={14} /> 风险预警
            </div>
            {agent?.gaps?.length ? (
              <ul>
                {agent.gaps.map((g, i) => (
                  <li key={i}>{g}</li>
                ))}
              </ul>
            ) : null}
            {agent?.recommendation && (
              <div className="swb-risk-rec">AI 建议：{REC_LABEL[agent.recommendation]}</div>
            )}
          </div>
        )}
      </section>

      {/* 底部：决策按钮 */}
      <section className="swb-actions">
        <button className="btn btn-pass" disabled={busy} onClick={onPass}>
          <CheckCircle2 size={18} /> 初筛通过
        </button>
        <button className="btn btn-danger" disabled={busy} onClick={onReject}>
          <XCircle size={18} /> 淘汰并转入人才库
        </button>
        <div className="swb-actions-row">
          <button className="btn-link" onClick={onRerun} disabled={busy}>
            <RefreshCw size={14} /> 重跑 AI
          </button>
          <button className="btn-link" onClick={onViewFull}>
            <ExternalLink size={14} /> 完整档案
          </button>
        </div>
      </section>
    </aside>
  );
}
