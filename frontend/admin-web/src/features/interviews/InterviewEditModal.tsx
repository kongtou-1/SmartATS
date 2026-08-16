import { useEffect, useState } from 'react';
import { CalendarClock, X } from 'lucide-react';
import { api } from '../../lib/client';
import type { Interview, InterviewDetail, InterviewInput, RoundType, User } from '../../types';

interface Props {
  open: boolean;
  /** 要编辑的面试（仅在待进行时可编辑） */
  interview: InterviewDetail | null;
  onClose: () => void;
  onSaved: (updated: Interview) => void;
}

interface FormState {
  interviewer_id: string;
  round_type: RoundType;
  scheduled_at: string; // datetime-local 本地字符串 YYYY-MM-DDTHH:mm
  duration_minutes: number;
  method: string;
  meeting_url: string;
  note: string;
}

/** ISO(含时区) -> datetime-local 本地字符串 */
function isoToLocalInput(iso: string): string {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '';
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
}

/** datetime-local 本地字符串 -> ISO(UTC) */
function localInputToIso(val: string): string {
  return new Date(val).toISOString();
}

const ROUND_LABELS: Record<RoundType, string> = {
  FIRST: '一面',
  SECOND: '二面',
  HR: 'HR 面',
};

export default function InterviewEditModal({ open, interview, onClose, onSaved }: Props) {
  const [form, setForm] = useState<FormState | null>(null);
  const [interviewers, setInterviewers] = useState<User[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!open || !interview) return;
    setForm({
      interviewer_id: interview.interviewer_id,
      round_type: interview.round_type,
      scheduled_at: isoToLocalInput(interview.scheduled_at),
      duration_minutes: interview.duration_minutes,
      method: interview.method,
      meeting_url: interview.meeting_url,
      note: interview.note,
    });
    setError('');
    api
      .adminListInterviewers()
      .then(setInterviewers)
      .catch(() => setInterviewers([]));
  }, [open, interview]);

  // ESC 关闭 + 锁定背景滚动
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !saving) onClose();
    };
    document.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [open, saving, onClose]);

  if (!open || !form || !interview) return null;

  function set<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((f) => (f ? { ...f, [key]: value } : f));
  }

  async function handleSave() {
    if (!form) return;
    if (!form.interviewer_id) {
      setError('请选择面试官');
      return;
    }
    if (!form.scheduled_at) {
      setError('请选择面试时间');
      return;
    }
    setSaving(true);
    setError('');
    try {
      const payload: InterviewInput = {
        application_id: interview!.application_id,
        interviewer_id: form.interviewer_id,
        round_type: form.round_type,
        scheduled_at: localInputToIso(form.scheduled_at),
        duration_minutes: Number(form.duration_minutes) || 60,
        method: form.method.trim(),
        meeting_url: form.meeting_url.trim(),
        note: form.note.trim(),
      };
      const updated = await api.adminUpdateInterview(interview!.id, payload);
      onSaved(updated);
    } catch (err) {
      setError((err as Error).message || '保存失败');
    } finally {
      setSaving(false);
    }
  }

  // 当前面试官可能不在可选列表（已禁用/非 INTERVIEWER），确保选项存在
  const interviewerOptions = interviewers.some((u) => u.id === form.interviewer_id)
    ? interviewers
    : form.interviewer_id
      ? [...interviewers, { id: form.interviewer_id, name: interview.interviewer_name || '原面试官', role: 'INTERVIEWER' } as User]
      : interviewers;

  return (
    <>
      <div className="modal-overlay" onClick={() => !saving && onClose()} />
      <div className="modal" role="dialog" aria-modal="true" aria-label="改期 / 编辑面试">
        <div className="modal-head">
          <div className="modal-head-left">
            <div className="modal-head-icon">
              <CalendarClock size={16} />
            </div>
            <div>
              <h3>改期 / 编辑面试</h3>
              <p className="muted">
                {interview.candidate_name} · {interview.job_title} · {ROUND_LABELS[interview.round_type]}面
              </p>
            </div>
          </div>
          <div className="modal-head-actions">
            <button className="drawer-close" onClick={() => !saving && onClose()} title="关闭">
              <X size={18} />
            </button>
          </div>
        </div>

        <div className="modal-body">
          <div className="modal-section">
            <div className="modal-section-title">
              <span className="section-icon si-blue">
                <CalendarClock size={11} />
              </span>
              面试安排
            </div>

            <div className="form-grid" style={{ marginBottom: 14 }}>
              <div className="field">
                <span>面试官</span>
                <select
                  className="input"
                  value={form.interviewer_id}
                  onChange={(e) => set('interviewer_id', e.target.value)}
                >
                  {interviewerOptions.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="field">
                <span>面试轮次</span>
                <select
                  className="input"
                  value={form.round_type}
                  onChange={(e) => set('round_type', e.target.value as RoundType)}
                >
                  <option value="FIRST">一面</option>
                  <option value="SECOND">二面</option>
                  <option value="HR">HR 面</option>
                </select>
              </div>
            </div>

            <div className="form-grid" style={{ marginBottom: 14 }}>
              <div className="field">
                <span>面试时间</span>
                <input
                  className="input"
                  type="datetime-local"
                  value={form.scheduled_at}
                  onChange={(e) => set('scheduled_at', e.target.value)}
                />
              </div>
              <div className="field">
                <span>时长（分钟）</span>
                <input
                  className="input"
                  type="number"
                  min={15}
                  max={240}
                  step={15}
                  value={form.duration_minutes}
                  onChange={(e) => set('duration_minutes', Number(e.target.value))}
                />
              </div>
            </div>

            <div className="field" style={{ marginBottom: 14 }}>
              <span>面试方式</span>
              <input
                className="input"
                placeholder="如：视频面试 / 现场面试"
                value={form.method}
                onChange={(e) => set('method', e.target.value)}
              />
            </div>

            <div className="field" style={{ marginBottom: 14 }}>
              <span>会议链接</span>
              <input
                className="input"
                placeholder="视频会议链接（可选）"
                value={form.meeting_url}
                onChange={(e) => set('meeting_url', e.target.value)}
              />
            </div>

            <div className="field" style={{ marginBottom: 0 }}>
              <span>备注</span>
              <textarea
                className="input area"
                rows={3}
                placeholder="给面试官 / 候选人的补充说明（可选）"
                value={form.note}
                onChange={(e) => set('note', e.target.value)}
              />
            </div>
          </div>

          {error && (
            <div className="alert" style={{ marginTop: 4 }}>
              {error}
            </div>
          )}
        </div>

        <div className="modal-foot">
          <span className="modal-meta">修改后将同步更新候选人侧的面试信息</span>
          <div className="modal-foot-btns">
            <button className="btn" onClick={() => !saving && onClose()} disabled={saving}>
              取消
            </button>
            <button className="btn btn-primary" onClick={handleSave} disabled={saving}>
              {saving ? '保存中…' : '保存修改'}
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
