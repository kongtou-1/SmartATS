import { CheckCheck, X } from 'lucide-react';
import type { Notification } from '../types';

interface Props {
  open: boolean;
  items: Notification[];
  onClose: () => void;
  onRead: (id: string) => void;
  onReadAll: () => void;
}

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

export default function NotificationCenter({
  open,
  items,
  onClose,
  onRead,
  onReadAll,
}: Props) {
  if (!open) return null;
  const unread = items.filter((n) => !n.read_at).length;
  return (
    <>
      <div className="drawer-overlay" onClick={onClose} />
      <aside className="drawer" role="dialog" aria-label="通知中心">
        <div className="drawer-head">
          <h3>通知中心</h3>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            {unread > 0 && (
              <span className="badge-pill blue">{unread} 条未读</span>
            )}
            <button className="drawer-close" onClick={onReadAll} title="全部已读">
              <CheckCheck size={17} />
            </button>
            <button className="drawer-close" onClick={onClose} title="关闭">
              <X size={18} />
            </button>
          </div>
        </div>
        <div className="drawer-body">
          {items.length === 0 ? (
            <div className="empty">
              <b>暂无通知</b>
              系统通知与审批提醒会出现在这里
            </div>
          ) : (
            <div className="notif-list">
              {items.map((n) => {
                const unreadItem = !n.read_at;
                return (
                  <div
                    key={n.id}
                    className={`notif-item${unreadItem ? ' unread' : ''}`}
                    onClick={() => onRead(n.id)}
                  >
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div className="n-title">
                        {unreadItem && <span className="ndot" />}
                        <span>{n.title}</span>
                      </div>
                      <div className="n-body">{n.body}</div>
                      <div className="n-time" style={{ marginTop: 6 }}>
                        {timeAgo(n.created_at)} · {new Date(n.created_at).toLocaleDateString()}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </aside>
    </>
  );
}
