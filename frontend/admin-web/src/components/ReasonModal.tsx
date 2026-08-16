import { useEffect, useState } from 'react';
import { X } from 'lucide-react';

interface Props {
  open: boolean;
  title: string;
  placeholder?: string;
  confirmText?: string;
  multiline?: boolean;
  submitting?: boolean;
  onConfirm: (text: string) => void;
  onCancel: () => void;
}

export default function ReasonModal({
  open,
  title,
  placeholder,
  confirmText = '确认',
  multiline = false,
  submitting = false,
  onConfirm,
  onCancel,
}: Props) {
  const [text, setText] = useState('');

  useEffect(() => {
    if (open) setText('');
  }, [open]);

  if (!open) return null;

  return (
    <>
      <div className="modal-overlay" onClick={onCancel} />
      <div
        className="modal"
        role="dialog"
        aria-label={title}
        style={{ width: 460, maxWidth: 'calc(100vw - 32px)' }}
      >
        <div className="cd-header">
          <div className="cd-header-info">
            <div className="cd-name-row">
              <span className="cd-name">{title}</span>
            </div>
          </div>
          <button className="cd-close" onClick={onCancel} title="关闭">
            <X size={18} />
          </button>
        </div>
        <div className="cd-body">
          {multiline ? (
            <textarea
              className="cd-input cd-textarea"
              placeholder={placeholder}
              value={text}
              onChange={(e) => setText(e.target.value)}
              autoFocus
            />
          ) : (
            <input
              className="cd-input"
              placeholder={placeholder}
              value={text}
              onChange={(e) => setText(e.target.value)}
              autoFocus
            />
          )}
        </div>
        <div className="cd-foot">
          <div className="cd-foot-spacer" />
          <button type="button" className="cd-btn cd-btn-ghost" onClick={onCancel}>
            取消
          </button>
          <button
            type="button"
            className="cd-btn cd-btn-primary"
            disabled={submitting || !text.trim()}
            onClick={() => onConfirm(text.trim())}
          >
            {confirmText}
          </button>
        </div>
      </div>
    </>
  );
}
