import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../lib/client';
import type { Announcement } from '../types';
import { ANNOUNCEMENT_TYPE_LABELS } from '../types';

export default function AnnouncementListPage() {
  const [list, setList] = useState<Announcement[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    api
      .listAnnouncements()
      .then(setList)
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="page">
      <div className="results-head">
        <h2>招聘动态</h2>
      </div>

      {loading ? (
        <div className="muted" style={{ padding: 40, textAlign: 'center' }}>
          加载中…
        </div>
      ) : list.length === 0 ? (
        <div className="empty">暂无招聘动态。</div>
      ) : (
        <ul className="ann-list">
          {list.map((a) => (
            <li key={a.id} className="ann-row">
              <Link to={`/announcements/${a.id}`} className="ann-link">
                <div className="ann-head">
                  <span className="tag tag-blue">{ANNOUNCEMENT_TYPE_LABELS[a.type]}</span>
                  {a.pinned && <span className="tag tag-amber">置顶</span>}
                  <h3 className="ann-title">{a.title}</h3>
                </div>
                <p className="ann-desc clamp2">{a.content}</p>
                {a.published_at && (
                  <div className="ann-date">{new Date(a.published_at).toLocaleDateString()}</div>
                )}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
