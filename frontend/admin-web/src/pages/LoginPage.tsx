import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../components/AuthContext';

const ROLES = [
  { key: 'hr', label: 'HR', email: 'hr@demo.com' },
  { key: 'interviewer', label: '面试官', email: 'interviewer@demo.com' },
  { key: 'admin', label: '管理员', email: 'admin@demo.com' },
  { key: 'direction_owner', label: '方向负责人', email: 'zhangchen@demo.com' },
];

export default function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('hr@demo.com');
  const [password, setPassword] = useState('demo1234');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const activeRole = ROLES.find((r) => r.email === email);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      await login(email, password);
      navigate('/');
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="auth-shell">
      <form className="auth-card" onSubmit={submit}>
        <div className="auth-brand">
          <div className="mark">招</div>
          <div>
            <div className="name">招聘管理后台</div>
          </div>
        </div>
        <label className="field">
          <span>邮箱</span>
          <input
            className="input"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
        </label>
        <label className="field">
          <span>密码</span>
          <input
            className="input"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
        </label>
        {error && <div className="alert">{error}</div>}
        <button className="btn btn-primary" disabled={busy} type="submit">
          {busy ? '登录中…' : '登录'}
        </button>
        <div className="role-cards" aria-label="演示账号角色">
          {ROLES.map((role) => (
            <button
              key={role.key}
              type="button"
              className={`role-card ${activeRole?.key === role.key ? 'active' : ''}`}
              onClick={() => {
                setEmail(role.email);
                setPassword('demo1234');
              }}
              aria-pressed={activeRole?.key === role.key}
            >
              <span className="role-card-label">{role.label}</span>
              <span className="role-card-email">{role.email}</span>
            </button>
          ))}
        </div>
        <div className="role-hint">密码均为 demo1234，点击卡片可切换账号</div>
      </form>
    </div>
  );
}
