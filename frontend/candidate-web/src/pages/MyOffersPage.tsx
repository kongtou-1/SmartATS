import { useEffect, useState } from 'react';
import { api } from '../lib/client';
import { downloadFile } from '../lib/api';
import type { Offer } from '../types';
const labels: Record<string, string> = {
  SENT: '待确认',
  ACCEPTED: '已接受',
  DECLINED: '已拒绝',
  EXPIRED: '已过期',
};
export default function MyOffersPage() {
  const [rows, setRows] = useState<Offer[]>([]);
  const [msg, setMsg] = useState('');
  const load = () => api.myOffers?.().then(setRows);
  useEffect(() => {
    void load();
  }, []);
  async function respond(o: Offer, decision: 'ACCEPT' | 'DECLINE') {
    const reason = decision === 'DECLINE' ? prompt('可填写拒绝原因') || '' : '';
    await api.respondOffer?.(o.id, decision, reason);
    setMsg(decision === 'ACCEPT' ? '已接受 Offer，申请状态已更新为录用。' : '已拒绝 Offer。');
    void load();
  }
  return (
    <div className="page">
      <h1>我的 Offer</h1>
      {msg && <div className="alert">{msg}</div>}
      {rows.length === 0 ? (
        <div className="empty">暂无 Offer</div>
      ) : (
        rows.map((o) => (
          <section className="block" key={o.id}>
            <div className="detail-head">
              <h3>{o.job_title}</h3>
              <span className="tag tag-blue">{labels[o.status] || o.status}</span>
            </div>
            <div className="kv">
              <div>
                <b>工作地点：</b>
                {o.work_location}
              </div>
              <div>
                <b>预计入职：</b>
                {new Date(o.expected_start_date).toLocaleDateString()}
              </div>
              <div>
                <b>薪酬说明：</b>
                {o.salary_description}
              </div>
              <div>
                <b>有效期：</b>
                {new Date(o.expires_at).toLocaleString()}
              </div>
            </div>
            <button
              className="btn"
              onClick={() =>
                downloadFile(`/candidate/offers/${o.id}/pdf`, `Offer-${o.job_title}.pdf`)
              }
            >
              下载 PDF
            </button>
            {o.status === 'SENT' && (
              <div className="actions">
                <button className="btn btn-primary" onClick={() => respond(o, 'ACCEPT')}>
                  接受 Offer
                </button>
                <button className="btn btn-danger" onClick={() => respond(o, 'DECLINE')}>
                  拒绝
                </button>
              </div>
            )}
          </section>
        ))
      )}
    </div>
  );
}
