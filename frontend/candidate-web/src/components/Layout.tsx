import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useAuth } from './AuthContext';

export default function Layout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  return (
    <div className="app-shell">
      <header className="topbar">
        <div className="brand" onClick={() => navigate('/')}>
          招聘平台
        </div>
        <nav className="nav">
          <NavLink to="/" end className={({ isActive }) => (isActive ? 'active' : '')}>
            岗位
          </NavLink>
          <NavLink to="/announcements" className={({ isActive }) => (isActive ? 'active' : '')}>
            招聘动态
          </NavLink>
          {user && (
            <NavLink to="/resume" className={({ isActive }) => (isActive ? 'active' : '')}>
              我的简历
            </NavLink>
          )}
          {user && (
            <NavLink to="/applications" className={({ isActive }) => (isActive ? 'active' : '')}>
              我的申请
            </NavLink>
          )}
          {user && (
            <NavLink to="/offers" className={({ isActive }) => (isActive ? 'active' : '')}>
              我的 Offer
            </NavLink>
          )}
        </nav>
        <div className="userbox">
          {user ? (
            <>
              <span className="user-name-pill">{user.name}</span>
              <span className="avatar">{(user.name || '?').slice(0, 1)}</span>
              <button
                className="btn-link"
                onClick={() => {
                  logout();
                  navigate('/login');
                }}
              >
                退出
              </button>
            </>
          ) : (
            <button className="btn btn-primary" onClick={() => navigate('/login')}>
              登录 / 注册
            </button>
          )}
        </div>
      </header>
      <main className="content">
        <Outlet />
      </main>
      <footer className="site-footer">
        <div className="footer-inner">
          <span className="footer-left">
            <a href="#">官方网站</a>
          </span>
          <span className="footer-right">
            关注我们
            <a href="#" className="social-icon" title="微信" aria-label="微信">W</a>
          </span>
        </div>
      </footer>
    </div>
  );
}
