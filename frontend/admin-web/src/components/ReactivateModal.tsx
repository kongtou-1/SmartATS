import { useEffect, useState } from 'react';
import { UserPlus, X } from 'lucide-react';
import type { Job } from '../types';

interface Props {
  open: boolean;
  /** 弹窗主标题 */
  title?: string;
  jobs: Job[];
  submitting?: boolean;
  onCancel: () => void;
  /** 返回选中的岗位 ID 与备注 */
  onConfirm: (jobId: string, note: string) => void;
}

export default function ReactivateModal({
  open,
  title = '加入岗位 / 重新激活',
  jobs,
  submitting = false,
  onCancel,
  onConfirm,
}: Props) {
  const [jobId, setJobId] = useState('');
  const [note, setNote] = useState('');

  useEffect(() => {
    if (open) {
      setJobId('');
      setNote('');
    }
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !submitting) onCancel();
    };
    document.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [open, submitting, onCancel]);

  if (!open) return null;

  return (
    <>
      <div className="modal-overlay" onClick={() => !submitting && onCancel()} />
      <div
        className="modal"
        role="dialog"
        aria-modal="true"
        aria-label={title}
        style={{ width: 520, maxWidth: 'calc(100vw - 32px)', minHeight: 280 }}
      >
        {/* ---- Header ---- */}
        <div className="modal-head">
          <div className="modal-head-left">
            <div className="modal-head-icon modal-head-icon--primary">
              <UserPlus size={18} />
            </div>
            <div>
              <h3>{title}</h3>
            </div>
          </div>
          <div className="modal-head-actions">
            <button
              type="button"
              className="drawer-close"
              onClick={() => !submitting && onCancel()}
              title="关闭"
              disabled={submitting}
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* ---- Body ---- */}
        <div className="modal-body" style={{ overflow: 'visible', overflowY: 'visible', flex: 'none', height: 'auto' }}>
          <div className="modal-section" style={{ marginBottom: 0 }}>
            <div className="modal-section-title">
              <span className="section-icon si-blue">
                <UserPlus size={11} />
              </span>
              选择目标岗位
            </div>

            <label className="field" style={{ marginBottom: 14 }}>
              <span>
                目标岗位 <span style={{ color: 'var(--red)' }}>*</span>
              </span>
              <select
                className="input"
                value={jobId}
                onChange={(e) => setJobId(e.target.value)}
                disabled={submitting}
                autoFocus
              >
                <option value="">请选择岗位…</option>
                {jobs.map((j) => (
                  <option key={j.id} value={j.id}>
                    {j.title}
                  </option>
                ))}
              </select>
            </label>

            <label className="field" style={{ marginBottom: 0 }}>
              <span>备注（可选）</span>
                <textarea
                className="input area"
                rows={2}
                placeholder="补充说明，例如：该候选人上次因薪资未达预期落选，本次可优先匹配更高职级"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                disabled={submitting}
                style={{ minHeight: 64 }}
              />
            </label>
          </div>
        </div>

        {/* ---- Footer ---- */}
        <div className="modal-foot modal-foot--end">
          <div className="modal-foot-btns">
            <button type="button" className="btn" onClick={onCancel} disabled={submitting}>
              取消
            </button>
            <button
              type="button"
              className="btn btn-primary"
              disabled={submitting || !jobId}
              onClick={() => onConfirm(jobId, note.trim())}
            >
              {submitting ? '加入中…' : '确认加入'}
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
