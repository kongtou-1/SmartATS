import { useEffect, useState } from 'react';
import { CheckCheck } from 'lucide-react';
import { api } from '../lib/client';
import type { Notification } from '../types';

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return '刚刚';
  if (m < 60) return `${m} 分钟前`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h} 小时前`;
  const d = Math.floor(h / 24);
  return `${d} 天前`;
}

export default function NotificationPage() {
  const [rows, setRows] = useState<Notification[]>([]);
  const load = () => {
    const p = api.notifications?.();
    if (p) p.then(setRows);
  };
  useEffect(() => {
    void load();
  }, []);

  const unread = rows.filter((n) => !n.read_at).length;

  const readAll = () => {
    const pending = rows
      .filter((n) => !n.read_at)
      .map((n) => api.readNotification?.(n.id));
    Promise.all(pending.filter(Boolean) as Promise<unknown>[]).then(() => load());
  };

  const readOne = (id: string) => {
    const p = api.readNotification?.(id);
    if (p) p.then(() => load());
  };

  return (
    <div className="page">
      <div className="page-head">
        {unread > 0 && (
          <button className="btn" onClick={readAll}>
            <CheckCheck size={15} />
            全部已读
          </button>
        )}
      </div>

      <div className="notif-panel">
        <div className="notif-head" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
          {unread > 0 && <span className="badge-pill blue">{unread} 未读</span>}
          <span className="muted">共 {rows.length} 条</span>
        </div>
        <div className="notif-list">
          {rows.length === 0 ? (
            <div className="empty">
              <b>暂无通知</b>
              系统通知与审批提醒会出现在这里
            </div>
          ) : (
            rows.map((n) => {
              const unreadItem = !n.read_at;
              return (
                <div
                  key={n.id}
                  className={`notif-item${unreadItem ? ' unread' : ''}`}
                  onClick={() => readOne(n.id)}
                >
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div className="n-title">
                      {unreadItem && <span className="ndot" />}
                      <span>{n.title}</span>
                    </div>
                    <div className="n-body">{n.body}</div>
                  </div>
                  <span className="n-time">{timeAgo(n.created_at)}</span>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
