import { useCallback, useEffect, useState } from 'react';
import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from './AuthContext';
import { api } from '../lib/client';
import type { Notification, Role } from '../types';
import Sidebar, { type SidebarBadges } from './Sidebar';
import Header from './Header';
import NotificationCenter from './NotificationCenter';
import { ShellContext, type PrimaryAction } from './ShellContext';

export default function Layout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const role = (user?.role ?? 'HR') as Role;

  // 初筛工作台是沉浸式三栏页面：隐藏全局顶栏，由工作台自带顶栏接管顶部。
  const isImmersive = location.pathname.startsWith('/screening');

  const [collapsed, setCollapsed] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const [searchQuery, setSearchQuery] = useState('');
  const [primaryAction, setPrimaryAction] = useState<PrimaryAction | undefined>();
  const [exportFn, setExportFnState] = useState<(() => void) | undefined>();
  // React 的 state setter 若收到函数会当作 updater 立即执行；
  // 这里用 () => fn 的写法把函数“原样存进 state”，避免注册导出时被误调用。
  const setExportFn = useCallback((fn: (() => void) | undefined) => {
    setExportFnState(() => fn);
  }, []);

  const handleRefresh = useCallback(() => setRefreshKey((k) => k + 1), []);
  const handleToggleNotifications = useCallback(() => setNotifOpen(true), []);

  const [badges, setBadges] = useState<SidebarBadges>({});
  const [notifOpen, setNotifOpen] = useState(false);
  const [notifs, setNotifs] = useState<Notification[]>([]);

  const loadBadges = useCallback(() => {
    const n = api.notifications?.();
    if (n) n.then((rows) => {
      setNotifs(rows);
      setBadges((b) => ({
        ...b,
        notifications: rows.filter((r) => !r.read_at).length,
      }));
    }).catch(() => {});

    if (role === 'HR' || role === 'SUPER_ADMIN') {
      // 候选人与面试看板徽标仅 HR / 超级管理员可见；其余角色无接口权限，
      // 调用会触发 403 并以未捕获异常刷屏，故在此按角色拦截。
      const iv = api.adminListInterviews?.();
      if (iv) iv.then((rows) => {
        setBadges((b) => ({
          ...b,
          interviews: rows.filter((r) => r.status === 'SCHEDULED').length,
        }));
      }).catch(() => {});
      const ap = api.adminListApplications?.();
      if (ap) ap.then((rows) => {
        setBadges((b) => ({ ...b, candidates: rows.length }));
      }).catch(() => {});
    } else if (role === 'INTERVIEWER') {
      // 面试官只能看自己的面试：用专属接口取数，避免调用无权限的 admin 接口。
      const iv = api.interviewerListInterviews?.();
      if (iv) iv.then((rows) => {
        setBadges((b) => ({
          ...b,
          interviews: rows.filter((r) => r.status === 'SCHEDULED').length,
        }));
      }).catch(() => {});
    }
    // DIRECTION_OWNER 等角色既无候选人/面试看板权限，侧边栏也未展示相关徽标，直接跳过。
  }, [role]);

  useEffect(() => {
    void loadBadges();
  }, [loadBadges]);

  const readOne = (id: string) => {
    const p = api.readNotification?.(id);
    if (p) p.then(() => loadBadges());
  };
  const readAll = () => {
    // mark each unread; the backend endpoint is per-id, so fan out
    const pending = notifs
      .filter((n) => !n.read_at)
      .map((n) => api.readNotification?.(n.id));
    Promise.all(pending.filter(Boolean) as Promise<unknown>[]).then(() => loadBadges());
  };

  return (
    <ShellContext.Provider
      value={{
        searchQuery,
        setSearchQuery,
        setPrimaryAction,
        setExportFn,
        onRefresh: handleRefresh,
        onToggleNotifications: handleToggleNotifications,
        unreadCount: badges.notifications ?? 0,
      }}
    >
      <div className="admin-shell">
        <Sidebar
          collapsed={collapsed}
          onToggleCollapse={() => setCollapsed((c) => !c)}
          role={role}
          user={user ? { name: user.name, role } : null}
          onLogout={() => {
            logout();
            navigate('/login');
          }}
          badges={badges}
        />
        <main className="admin-main">
          {!isImmersive && (
            <Header
              searchQuery={searchQuery}
              onSearchChange={setSearchQuery}
              onToggleNotifications={handleToggleNotifications}
              unreadCount={badges.notifications ?? 0}
              onExport={exportFn}
              onRefresh={handleRefresh}
              isRefreshing={false}
              primaryAction={primaryAction}
            />
          )}
          <div className={`admin-content${isImmersive ? ' immersive' : ''}`}>
            <Outlet key={refreshKey} />
          </div>
        </main>
      </div>

      <NotificationCenter
        open={notifOpen}
        items={notifs}
        onClose={() => setNotifOpen(false)}
        onRead={readOne}
        onReadAll={readAll}
      />
    </ShellContext.Provider>
  );
}
