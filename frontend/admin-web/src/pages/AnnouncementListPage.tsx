import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../lib/client';
import type { Announcement, AnnouncementType } from '../types';
import { ANNOUNCEMENT_STATUS_LABELS, ANNOUNCEMENT_TYPE_LABELS } from '../types';

export default function AnnouncementListPage() {
  const navigate = useNavigate();
  const [list, setList] = useState<Announcement[]>([]);
  const [loading, setLoading] = useState(true);
  const [typeFilter, setTypeFilter] = useState<AnnouncementType | ''>('');

  function load() {
    setLoading(true);
    api
      .adminListAnnouncements(typeFilter ? { type: typeFilter } : undefined)
      .then(setList)
      .finally(() => setLoading(false));
  }
  useEffect(load, [typeFilter]);

  async function publish(id: string) {
    await api.adminPublishAnnouncement(id);
    load();
  }
  async function close(id: string) {
    await api.adminCloseAnnouncement(id);
    load();
  }
  async function remove(id: string) {
    if (!confirm('确定删除该动态吗？')) return;
    await api.adminDeleteAnnouncement(id);
    load();
  }

  return (
    <div className="page">
      <div className="filter-row">
        <select
          className="input"
          value={typeFilter}
          onChange={(e) => setTypeFilter(e.target.value as AnnouncementType | '')}
        >
          <option value="">全部类型</option>
          {Object.entries(ANNOUNCEMENT_TYPE_LABELS).map(([k, v]) => (
            <option key={k} value={k}>
              {v}
            </option>
          ))}
        </select>
        <button
          className="btn btn-primary"
          style={{ marginLeft: 'auto' }}
          onClick={() => navigate('/announcements/new')}
        >
          + 新建动态
        </button>
      </div>

      {loading ? (
        <div className="page-loading">加载中…</div>
      ) : (
        <div className="card-2xl">
          <div style={{ padding: '14px 18px', borderBottom: '1px solid var(--line)' }}>
            <span className="muted">共 {list.length} 条动态</span>
          </div>
          <div style={{ overflowX: 'auto' }}>
            <table className="table">
              <thead>
                <tr>
                  <th>类型</th>
                  <th>标题</th>
                  <th>状态</th>
                  <th>置顶</th>
                  <th>操作</th>
                </tr>
              </thead>
              <tbody>
                {list.map((a) => (
                  <tr key={a.id}>
                    <td>
                      <span className="badge-pill indigo">
                        {ANNOUNCEMENT_TYPE_LABELS[a.type]}
                      </span>
                    </td>
                    <td className="cell-title">
                      <button
                        className="btn-link"
                        onClick={() => navigate(`/announcements/${a.id}/edit`)}
                      >
                        {a.title}
                      </button>
                    </td>
                    <td>
                      <span
                        className={`tag ${a.status === 'PUBLISHED' ? 'tag-green' : a.status === 'CLOSED' ? 'tag-gray' : 'tag-blue'}`}
                      >
                        {ANNOUNCEMENT_STATUS_LABELS[a.status]}
                      </span>
                    </td>
                    <td>{a.pinned ? '是' : '否'}</td>
                    <td className="row-actions">
                      <button
                        className="btn-link"
                        onClick={() => navigate(`/announcements/${a.id}/edit`)}
                      >
                        编辑
                      </button>
                      {a.status !== 'PUBLISHED' && (
                        <button className="btn-link" onClick={() => publish(a.id)}>
                          发布
                        </button>
                      )}
                      {a.status === 'PUBLISHED' && (
                        <button className="btn-link" onClick={() => close(a.id)}>
                          关闭
                        </button>
                      )}
                      <button className="btn-link danger" onClick={() => remove(a.id)}>
                        删除
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
