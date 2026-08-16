import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { api } from '../lib/client';
import type { Announcement, AnnouncementInput, AnnouncementType } from '../types';
import { ANNOUNCEMENT_TYPE_LABELS } from '../types';

export default function AnnouncementEditPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const isEdit = Boolean(id);
  const [form, setForm] = useState<AnnouncementInput>({
    type: 'NOTICE',
    title: '',
    content: '',
    pinned: false,
  });
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');

  useEffect(() => {
    if (id) {
      api
        .adminGetAnnouncement(id)
        .then((a: Announcement) =>
          setForm({ type: a.type, title: a.title, content: a.content, pinned: a.pinned }),
        );
    }
  }, [id]);

  function set(key: keyof AnnouncementInput, val: string | boolean) {
    setForm({ ...form, [key]: val });
  }

  async function save() {
    setBusy(true);
    setMsg('');
    try {
      if (isEdit) {
        await api.adminUpdateAnnouncement(id!, form);
      } else {
        await api.adminCreateAnnouncement(form);
      }
      navigate('/announcements');
    } catch (e) {
      setMsg((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="page narrow">
      <button className="btn-link" onClick={() => navigate('/announcements')}>
        ← 返回招聘动态
      </button>
      <h1>{isEdit ? '编辑动态' : '新建动态'}</h1>

      <label className="field">
        <span>类型</span>
        <select
          className="input"
          value={form.type}
          onChange={(e) => set('type', e.target.value as AnnouncementType)}
        >
          {Object.entries(ANNOUNCEMENT_TYPE_LABELS).map(([k, v]) => (
            <option key={k} value={k}>
              {v}
            </option>
          ))}
        </select>
      </label>
      <label className="field">
        <span>标题</span>
        <input
          className="input"
          value={form.title}
          onChange={(e) => set('title', e.target.value)}
        />
      </label>
      <label className="field">
        <span>正文</span>
        <textarea
          className="input area"
          value={form.content}
          onChange={(e) => set('content', e.target.value)}
        />
      </label>
      <label className="field checkbox">
        <input
          type="checkbox"
          checked={form.pinned}
          onChange={(e) => set('pinned', e.target.checked)}
        />
        <span>置顶</span>
      </label>

      {msg && <div className="alert">{msg}</div>}
      <div className="row-actions">
        <button className="btn btn-primary" disabled={busy} onClick={save}>
          {busy ? '保存中…' : '保存'}
        </button>
        {isEdit && (
          <button className="btn" onClick={() => navigate('/announcements')}>
            取消
          </button>
        )}
      </div>
    </div>
  );
}
