import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { api } from '../lib/client';
import type { Job } from '../types';
import { JOB_STATUS_LABELS, JOB_TYPE_LABELS } from '../types';
import { useAuth } from '../components/AuthContext';

const LIST_RE = /^(\d+)[、.．]\s*(.*)$/;

function RichText({ text }: { text: string }) {
  const lines = text.split('\n');
  const nodes: JSX.Element[] = [];
  let paragraphBuffer: string[] = [];
  let listItems: string[] = [];
  let listStart = 1;

  const flushParagraph = () => {
    if (paragraphBuffer.length === 0) return;
    const content = paragraphBuffer.join('\n').trim();
    if (content) {
      nodes.push(
        <p key={nodes.length} className="job-section-text">
          {content}
        </p>,
      );
    }
    paragraphBuffer = [];
  };

  const flushList = () => {
    if (listItems.length === 0) return;
    nodes.push(
      <ol key={nodes.length} className="job-section-list" start={listStart}>
        {listItems.map((item, i) => (
          <li key={i}>{item}</li>
        ))}
      </ol>,
    );
    listItems = [];
  };

  for (const rawLine of lines) {
    const line = rawLine.trimEnd();
    if (!line.trim()) {
      flushParagraph();
      flushList();
      continue;
    }

    const match = line.match(LIST_RE);
    if (match) {
      flushParagraph();
      if (listItems.length === 0) listStart = parseInt(match[1], 10);
      listItems.push(match[2]);
    } else {
      flushList();
      paragraphBuffer.push(line);
    }
  }

  flushParagraph();
  flushList();
  return <>{nodes}</>;
}

export default function JobDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [job, setJob] = useState<Job | null>(null);

  useEffect(() => {
    if (!id) return;
    api.getJob(id).then(setJob);
  }, [id, user]);

  function apply() {
    if (!user) {
      navigate('/login');
      return;
    }
    navigate(`/jobs/${id}/apply`);
  }

  if (!job) return <div className="page-loading">加载中…</div>;

  const metaItems = [
    job.location,
    JOB_TYPE_LABELS[job.job_type],
    job.category_name,
    `职位ID：${job.id.slice(0, 8).toUpperCase()}`,
  ].filter(Boolean) as string[];

  const isClosed = job.status === 'CLOSED';

  return (
    <div className="page narrow job-detail">
      <header className="job-detail-head">
        <h1>{job.title}</h1>
        <div className="job-detail-meta">
          {metaItems.map((item, idx) => (
            <span key={idx}>
              {item}
              {idx < metaItems.length - 1 && <span className="divider">|</span>}
            </span>
          ))}
          {job.status !== 'PUBLISHED' && (
            <>
              <span className="divider">|</span>
              <span className="job-status-note">{JOB_STATUS_LABELS[job.status]}</span>
            </>
          )}
        </div>
      </header>

      <section className="job-detail-section">
        <h2>职位描述</h2>
        <RichText text={job.description} />
      </section>

      <section className="job-detail-section">
        <h2>职位要求</h2>
        <RichText text={job.requirements} />
      </section>

      <section className="job-detail-section muted">
        发布时间：{new Date(job.created_at).toLocaleDateString()}
      </section>

      <div className="apply-bar">
        <div>
          <div style={{ fontWeight: 600 }}>{job.title}</div>
          <div className="card-sub">{job.location}</div>
        </div>
        <button className="btn btn-primary" onClick={apply} disabled={isClosed}>
          {isClosed ? '已停止招聘' : user ? '投递' : '登录后投递'}
        </button>
      </div>
    </div>
  );
}
