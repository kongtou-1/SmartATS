import { useEffect, useState } from 'react';
import { api } from '../lib/client';
import type { Role, User } from '../types';
import { ROLE_LABELS } from '../types';

const ROLES: Role[] = ['SUPER_ADMIN', 'HR', 'INTERVIEWER', 'CANDIDATE', 'DIRECTION_OWNER'];

export default function UserAdminPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');
  const [form, setForm] = useState({
    name: '',
    title: '',
    email: '',
    password: 'demo1234',
    role: 'HR' as Role,
  });

  function load() {
    api
      .listUsers()
      .then(setUsers)
      .catch(() => {});
  }
  useEffect(load, []);

  async function create() {
    setBusy(true);
    setMsg('');
    try {
      await api.createUser(form);
      setShowForm(false);
      setForm({ name: '', title: '', email: '', password: 'demo1234', role: 'HR' });
      load();
    } catch (e) {
      setMsg((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function setRole(id: string, role: Role) {
    await api.updateUser(id, { role });
    load();
  }
  async function toggleStatus(u: User) {
    await api.updateUser(u.id, { status: u.status === 'ACTIVE' ? 'DISABLED' : 'ACTIVE' });
    load();
  }

  return (
    <div className="page">
      <div className="page-head">
        <button className="btn btn-primary" onClick={() => setShowForm((v) => !v)}>
          + 新建用户
        </button>
      </div>

      {showForm && (
        <div className="block">
          <div className="form-grid">
            <label className="field">
              <span>姓名</span>
              <input
                className="input"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
              />
            </label>
            <label className="field">
              <span>职位头衔</span>
              <input
                className="input"
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
                placeholder="如：技术委员会主席 / 技术VP"
              />
            </label>
            <label className="field">
              <span>邮箱</span>
              <input
                className="input"
                type="email"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
              />
            </label>
            <label className="field">
              <span>密码</span>
              <input
                className="input"
                value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })}
              />
            </label>
            <label className="field">
              <span>角色</span>
              <select
                className="input"
                value={form.role}
                onChange={(e) => setForm({ ...form, role: e.target.value as Role })}
              >
                {ROLES.map((r) => (
                  <option key={r} value={r}>
                    {ROLE_LABELS[r]}
                  </option>
                ))}
              </select>
            </label>
          </div>
          {msg && <div className="alert">{msg}</div>}
          <button
            className="btn btn-primary"
            disabled={busy || !form.name || !form.email}
            onClick={create}
          >
            创建
          </button>
        </div>
      )}

      <div className="card-2xl">
        <div style={{ padding: '14px 18px', borderBottom: '1px solid var(--line)' }}>
          <span className="muted">共 {users.length} 个账号</span>
        </div>
        <div style={{ overflowX: 'auto' }}>
          <table className="table">
            <thead>
              <tr>
                <th>姓名</th>
                <th>职位头衔</th>
                <th>邮箱</th>
                <th>角色</th>
                <th>状态</th>
                <th>操作</th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.id}>
                  <td className="cell-title">{u.name}</td>
                  <td className="muted">{u.title || '—'}</td>
                  <td>{u.email}</td>
                  <td>
                    <select
                      className="input"
                      value={u.role}
                      onChange={(e) => setRole(u.id, e.target.value as Role)}
                    >
                      {ROLES.map((r) => (
                        <option key={r} value={r}>
                          {ROLE_LABELS[r]}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td>
                    <span className={`tag ${u.status === 'ACTIVE' ? 'tag-green' : 'tag-gray'}`}>
                      {u.status === 'ACTIVE' ? '正常' : '已禁用'}
                    </span>
                  </td>
                  <td className="row-actions">
                    <button className="btn-link" onClick={() => toggleStatus(u)}>
                      {u.status === 'ACTIVE' ? '禁用' : '启用'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
