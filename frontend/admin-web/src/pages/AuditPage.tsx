import { useEffect, useState } from 'react';
import { api } from '../lib/client';
import { downloadFile } from '../lib/api';
import type { AuditLog } from '../types';
export default function AuditPage() {
  const [rows, setRows] = useState<AuditLog[]>([]);
  useEffect(() => {
    api.auditLogs?.().then((x) => setRows(x.items));
  }, []);
  return (
    <div className="page">
      <div className="page-head">
        <button
          className="btn"
          onClick={() => downloadFile('/admin/audit-logs/export', '操作审计.xlsx')}
        >
          导出审计
        </button>
      </div>
      <div className="card-2xl">
        <div style={{ padding: '14px 18px', borderBottom: '1px solid var(--line)' }}>
          <span className="muted">共 {rows.length} 条记录</span>
        </div>
        <div style={{ overflowX: 'auto' }}>
          <table className="table">
            <thead>
              <tr>
                <th>时间</th>
                <th>操作者</th>
                <th>动作</th>
                <th>实体</th>
                <th>请求号</th>
                <th>IP</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id}>
                  <td>{new Date(r.created_at).toLocaleString()}</td>
                  <td>
                    {r.actor_type}
                    {r.actor_id ? ` · ${r.actor_id.slice(0, 8)}` : ''}
                  </td>
                  <td>
                    <span className="badge-pill indigo">{r.action}</span>
                  </td>
                  <td>
                    {r.entity_type} · {r.entity_id}
                  </td>
                  <td className="mono">{r.request_id}</td>
                  <td>{r.ip_address}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
