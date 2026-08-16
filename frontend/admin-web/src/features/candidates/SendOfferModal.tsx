import { useState } from 'react';
import { Send } from 'lucide-react';
import { api } from '../../lib/client';
import type { AdminApplication } from '../../types';

interface Props {
  app: AdminApplication | null;
  onClose: () => void;
  /** 创建成功后回调（用于提示 / 跳转） */
  onCreated?: (offerId: string) => void;
}

/** 默认有效期：入职日期后 14 天 */
function defaultExpiry(start: string): string {
  if (!start) return '';
  const d = new Date(`${start}T00:00:00`);
  if (Number.isNaN(d.getTime())) return '';
  d.setDate(d.getDate() + 14);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T18:00`;
}

export default function SendOfferModal({ app, onClose, onCreated }: Props) {
  const [salary, setSalary] = useState('');
  const [location, setLocation] = useState('');
  const [startDate, setStartDate] = useState('');
  const [expiresAt, setExpiresAt] = useState('');
  const [probation, setProbation] = useState('');
  const [extraTerms, setExtraTerms] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  if (!app) return null;

  const canSubmit = salary.trim() && location.trim() && startDate && expiresAt && !busy;

  async function submit() {
    if (!salary.trim() || !location.trim() || !startDate || !expiresAt) {
      setError('请填写薪资说明、工作地点、入职日期与有效期');
      return;
    }
    setError('');
    setBusy(true);
    try {
      const created = await api.createOffer?.({
        application_id: app!.id,
        salary_description: salary.trim(),
        work_location: location.trim(),
        expected_start_date: `${startDate}T00:00:00`,
        expires_at: `${expiresAt}:00`,
        probation: probation.trim(),
        extra_terms: extraTerms.trim(),
      });
      const id = created ? (created as { id?: string }).id : undefined;
      if (!id) {
        onCreated?.('');
        onClose();
        return;
      }
      // 创建成功后自动提交审批，直接进入「待审批」
      try {
        await api.offerAction?.(id, 'submit');
        onCreated?.(id);
      } catch {
        setError('Offer 已创建，但自动提交审批失败，请到「Offer 管理」手动提交');
        setBusy(false);
        return;
      }
      onClose();
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : '创建失败，请稍后重试';
      setError(msg);
      setBusy(false);
    }
  }

  return (
    <div className="modal-overlay" onMouseDown={() => !busy && onClose()}>
      <div className="modal" style={{ width: 680 }} onMouseDown={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <div className="modal-head-left">
            <div className="modal-head-icon modal-head-icon--primary">
              <Send size={18} />
            </div>
            <h3>发放 Offer</h3>
          </div>
          <button className="modal-close" onClick={onClose} disabled={busy}>
            ×
          </button>
        </div>

        <div className="modal-body">
          <div className="form-grid">
            <label className="field">
              <span>薪资说明 *</span>
              <textarea
                className="input"
                value={salary}
                onChange={(e) => setSalary(e.target.value)}
                placeholder="例如：月薪 25K×14，含绩效与年终奖"
                rows={2}
                autoFocus
              />
            </label>

            <label className="field">
              <span>工作地点 *</span>
              <input
                className="input"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                placeholder="例如：深圳·南山"
              />
            </label>

            <label className="field">
              <span>入职日期 *</span>
              <input
                className="input"
                type="date"
                value={startDate}
                onChange={(e) => {
                  const v = e.target.value;
                  setStartDate(v);
                  setExpiresAt((prev) => (prev && prev < `${v}T` ? prev : defaultExpiry(v)));
                }}
              />
            </label>

            <label className="field">
              <span>有效期至 *</span>
              <input
                className="input"
                type="datetime-local"
                value={expiresAt}
                onChange={(e) => setExpiresAt(e.target.value)}
              />
            </label>

            <label className="field" style={{ gridColumn: '1 / -1' }}>
              <span>试用期</span>
              <input
                className="input"
                value={probation}
                onChange={(e) => setProbation(e.target.value)}
                placeholder="例如：3 个月"
              />
            </label>

            <label className="field" style={{ gridColumn: '1 / -1' }}>
              <span>附加条款</span>
              <textarea
                className="input"
                value={extraTerms}
                onChange={(e) => setExtraTerms(e.target.value)}
                placeholder="选填，例如：远程办公每周不超过 2 天"
                rows={2}
              />
            </label>
          </div>

          {error && <div className="cd-inline-error" style={{ marginTop: 12 }}>{error}</div>}
        </div>

        <div className="modal-foot modal-foot--end">
          <div className="modal-foot-btns">
            <button className="btn" onClick={onClose} disabled={busy}>
              取消
            </button>
            <button className="btn btn-primary" onClick={submit} disabled={!canSubmit}>
              {busy ? '提交中…' : '发放 Offer'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
