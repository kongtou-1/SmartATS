import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { api } from '../lib/client';
import type { Announcement } from '../types';
import { ANNOUNCEMENT_TYPE_LABELS } from '../types';

export default function AnnouncementDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [a, setA] = useState<Announcement | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) return;
    api
      .getAnnouncement(id)
      .then(setA)
      .catch(() => setA(null))
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) return <div className="page-loading">加载中…</div>;
  if (!a) return <div className="empty">动态不存在或已下架。</div>;

  return (
    <div className="page narrow">
      <button className="btn-link" onClick={() => navigate('/announcements')}>
        ← 返回招聘动态
      </button>
      <div className="ann-detail-head">
        <span className="tag tag-blue">{ANNOUNCEMENT_TYPE_LABELS[a.type]}</span>
        {a.pinned && <span className="tag tag-amber">置顶</span>}
        <h1>{a.title}</h1>
        {a.published_at && (
          <div className="card-sub">{new Date(a.published_at).toLocaleDateString()} 发布</div>
        )}
      </div>
      <section className="block">
        <p className="pre-wrap">{a.content}</p>
      </section>
    </div>
  );
}
