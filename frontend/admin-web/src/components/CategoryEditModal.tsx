import { useEffect, useMemo, useState } from 'react';
import { api } from '../lib/client';
import type { JobCategory, JobCategoryInput, User } from '../types';

interface Props {
  category: JobCategory | null;
  allCategories: JobCategory[];
  initialValues?: Partial<JobCategoryInput>;
  onSaved: () => void;
  onCancel: () => void;
}

export default function CategoryEditModal({ category, allCategories, initialValues, onSaved, onCancel }: Props) {
  const isEdit = Boolean(category);
  const [form, setForm] = useState<JobCategoryInput>({
    code: '',
    name: '',
    parent_code: '',
    sort_order: 0,
    owner_id: '',
  });
  const [owners, setOwners] = useState<User[]>([]);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');

  useEffect(() => {
    api.adminListDirectionOwners().then(setOwners).catch(() => {});
  }, []);

  useEffect(() => {
    if (category) {
      setForm({
        code: category.code,
        name: category.name,
        parent_code: category.parent_code ?? '',
        sort_order: category.sort_order,
        owner_id: category.owner_id ?? '',
      });
    } else {
      setForm({
        code: '',
        name: '',
        parent_code: initialValues?.parent_code ?? '',
        sort_order: initialValues?.sort_order ?? allCategories.length + 1,
        owner_id: initialValues?.owner_id ?? '',
      });
    }
    setMsg('');
  }, [category, allCategories.length, initialValues]);

  const parentOptions = useMemo(() => {
    const excluded = new Set<string>();
    if (category) {
      excluded.add(category.code);
      const collect = (code: string) => {
        allCategories
          .filter((c) => c.parent_code === code)
          .forEach((c) => {
            excluded.add(c.code);
            collect(c.code);
          });
      };
      collect(category.code);
    }
    return allCategories.filter((c) => !excluded.has(c.code));
  }, [allCategories, category]);

  async function save() {
    setBusy(true);
    setMsg('');
    try {
      const payload: JobCategoryInput = {
        ...form,
        parent_code: form.parent_code || null,
        owner_id: form.owner_id || null,
      };
      if (isEdit && category) {
        await api.adminUpdateJobCategory(category.code, payload);
      } else {
        await api.adminCreateJobCategory(payload);
      }
      onSaved();
    } catch (e) {
      setMsg((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="modal-overlay" onClick={onCancel}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <h3>{isEdit ? `编辑方向 · ${category?.name}` : '新建方向'}</h3>
          <button className="modal-close" onClick={onCancel} aria-label="关闭">
            ×
          </button>
        </div>
        <div className="modal-body">
          <label className="field">
            <span>方向名称</span>
            <input
              className="input"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="如：前端"
            />
          </label>
          <label className="field">
            <span>方向编码</span>
            <input
              className="input"
              value={form.code}
              disabled={isEdit}
              onChange={(e) => setForm({ ...form, code: e.target.value })}
              placeholder="如：RND_FE"
            />
          </label>
          <label className="field">
            <span>父级方向</span>
            <select
              className="input"
              value={form.parent_code ?? ''}
              onChange={(e) => setForm({ ...form, parent_code: e.target.value })}
            >
              <option value="">无（一级方向）</option>
              {parentOptions.map((c) => (
                <option key={c.code} value={c.code}>
                  {c.name}（{c.code}）
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            <span>方向负责人</span>
            <select
              className="input"
              value={form.owner_id ?? ''}
              onChange={(e) => setForm({ ...form, owner_id: e.target.value })}
            >
              <option value="">未分配</option>
              {owners.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.name} {u.title ? `· ${u.title}` : ''}
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            <span>排序</span>
            <input
              className="input"
              type="number"
              value={form.sort_order}
              onChange={(e) => setForm({ ...form, sort_order: Number(e.target.value) })}
            />
          </label>
          {msg && <div className="alert">{msg}</div>}
        </div>
        <div className="modal-foot">
          <button className="btn" onClick={onCancel}>
            取消
          </button>
          <button className="btn btn-primary" disabled={busy || !form.name || !form.code} onClick={save}>
            {busy ? '保存中…' : '保存'}
          </button>
        </div>
      </div>
    </div>
  );
}
