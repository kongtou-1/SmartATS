import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import type { Offer } from '../types';

const BASE = import.meta.env.VITE_API_BASE || '/api/v1';
const labels: Record<string, string> = {
  SENT: '待确认',
  ACCEPTED: '已接受',
  DECLINED: '已拒绝',
  EXPIRED: '已过期',
};

export default function OfferResponsePage() {
  const { token = '' } = useParams();
  const [offer, setOffer] = useState<Offer | null>(null);
  const [required, setRequired] = useState(false);
  const [msg, setMsg] = useState('正在验证安全链接…');
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    fetch(`${BASE}/offers/respond/${token}`)
      .then(async (r) => {
        const data = await r.json();
        if (!r.ok) throw new Error(data.detail || '链接无效');
        setOffer(data.offer);
        setRequired(data.response_required);
        setMsg('');
      })
      .catch((e) => setMsg(e.message));
  }, [token]);
  async function respond(decision: 'ACCEPT' | 'DECLINE') {
    const reason = decision === 'DECLINE' ? prompt('可填写拒绝原因') || '' : '';
    if (!confirm(decision === 'ACCEPT' ? '确认接受这份 Offer？' : '确认拒绝这份 Offer？')) return;
    setBusy(true);
    try {
      const r = await fetch(`${BASE}/offers/respond/${token}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ decision, reason }),
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data.detail || '提交失败');
      setOffer(data);
      setRequired(false);
      setMsg(
        decision === 'ACCEPT'
          ? '已接受 Offer，招聘申请已更新为录用。'
          : '已拒绝 Offer，感谢您的反馈。',
      );
    } catch (e) {
      setMsg((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function pdf() {
    const r = await fetch(`${BASE}/offers/respond/${token}/pdf`);
    if (!r.ok) {
      const data = await r.json().catch(() => ({}));
      setMsg(data.detail || '下载失败');
      return;
    }
    const url = URL.createObjectURL(await r.blob());
    const a = document.createElement('a');
    a.href = url;
    a.download = `Offer-${offer?.job_title || ''}.pdf`;
    a.click();
    URL.revokeObjectURL(url);
  }
  return (
    <main className="public-offer-shell">
      <section className="public-offer-card">
        <div className="offer-mark">录用通知</div>
        <h1>{offer?.job_title || 'Offer 安全确认'}</h1>
        {offer && (
          <>
            <p className="offer-name">致 {offer.candidate_name}</p>
            <div className="offer-summary">
              <div>
                <span>工作地点</span>
                <b>{offer.work_location}</b>
              </div>
              <div>
                <span>预计入职</span>
                <b>{new Date(offer.expected_start_date).toLocaleDateString()}</b>
              </div>
              <div>
                <span>薪酬说明</span>
                <b>{offer.salary_description}</b>
              </div>
              <div>
                <span>有效期至</span>
                <b>{new Date(offer.expires_at).toLocaleString()}</b>
              </div>
            </div>
            <p>
              <span className="tag">{labels[offer.status] || offer.status}</span>
            </p>
            {required && (
              <div className="public-offer-actions">
                <button className="btn" onClick={pdf}>
                  下载 PDF
                </button>
                <button
                  className="btn btn-primary"
                  disabled={busy}
                  onClick={() => respond('ACCEPT')}
                >
                  接受 Offer
                </button>
                <button
                  className="btn btn-danger"
                  disabled={busy}
                  onClick={() => respond('DECLINE')}
                >
                  拒绝
                </button>
              </div>
            )}
          </>
        )}
        {msg && <div className={offer && !required ? 'alert alert-ok' : 'alert'}>{msg}</div>}
        <p className="security-note">此链接为一次性安全链接，确认后立即失效。请勿转发。</p>
      </section>
    </main>
  );
}
