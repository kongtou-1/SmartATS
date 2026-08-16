import { NavLink } from 'react-router-dom';
import {
  Briefcase,
  Layers,
  Activity,
  Users,
  Database,
  Sliders,
  Video,
  Calendar,
  FileCheck2,
  BarChart3,
  Bell,
  ShieldCheck,
  PanelLeftClose,
  PanelLeft,
  LogOut,
  Home,
  ScanSearch,
  type LucideIcon,
} from 'lucide-react';
import type { Role } from '../types';
import { ROLE_LABELS } from '../types';

interface NavDef {
  to: string;
  label: string;
  icon: LucideIcon;
  roles: Role[];
  badge?: 'candidates' | 'interviews' | 'notifications';
}

const NAV: NavDef[] = [
  { to: '/dashboard', label: '首页', icon: Home, roles: ['SUPER_ADMIN', 'HR', 'INTERVIEWER', 'DIRECTION_OWNER'] },
  { to: '/jobs', label: '岗位管理', icon: Briefcase, roles: ['SUPER_ADMIN', 'HR'] },
  { to: '/job-categories', label: '岗位方向', icon: Layers, roles: ['SUPER_ADMIN', 'HR', 'DIRECTION_OWNER'] },
  { to: '/candidates', label: '候选人', icon: Users, roles: ['SUPER_ADMIN', 'HR'], badge: 'candidates' },
  { to: '/screening', label: '初筛工作台', icon: ScanSearch, roles: ['SUPER_ADMIN', 'HR'] },
  { to: '/interviews', label: '面试', icon: Video, roles: ['SUPER_ADMIN', 'HR', 'INTERVIEWER'], badge: 'interviews' },
  { to: '/calendar', label: '日历', icon: Calendar, roles: ['SUPER_ADMIN', 'HR', 'INTERVIEWER'] },
  { to: '/offers', label: 'Offer', icon: FileCheck2, roles: ['SUPER_ADMIN', 'HR'] },
  { to: '/reports', label: '报表', icon: BarChart3, roles: ['SUPER_ADMIN', 'HR'] },
  { to: '/notifications', label: '通知', icon: Bell, roles: ['SUPER_ADMIN', 'HR', 'INTERVIEWER'], badge: 'notifications' },
  { to: '/talent-settings', label: '人才配置', icon: Sliders, roles: ['SUPER_ADMIN', 'HR'] },
  { to: '/announcements', label: '招聘动态', icon: Activity, roles: ['SUPER_ADMIN', 'HR'] },
  { to: '/audit', label: '审计', icon: ShieldCheck, roles: ['SUPER_ADMIN'] },
  { to: '/talents', label: '人才库', icon: Database, roles: ['SUPER_ADMIN', 'HR'] },
  { to: '/users', label: '后台用户', icon: Users, roles: ['SUPER_ADMIN'] },
];

export interface SidebarBadges {
  candidates?: number;
  interviews?: number;
  notifications?: number;
}

interface SidebarProps {
  collapsed: boolean;
  onToggleCollapse: () => void;
  role: Role;
  user: { name: string; role: Role } | null;
  onLogout: () => void;
  badges: SidebarBadges;
}

export default function Sidebar({
  collapsed,
  onToggleCollapse,
  role,
  user,
  onLogout,
  badges,
}: SidebarProps) {
  const visible = NAV.filter((n) => n.roles.includes(role));

  return (
    <aside className={`sidebar${collapsed ? ' collapsed' : ''}`}>
      {/* Brand */}
      <div className="side-brand">
        <div className="side-logo">
          <div className="side-logo-mark">招</div>
          {!collapsed && (
            <div className="side-logo-text">
              <span className="side-logo-title">招聘管理后台</span>
              <span className="side-logo-sub">
        
              </span>
            </div>
          )}
        </div>
        <button
          className="side-collapse-btn"
          onClick={onToggleCollapse}
          title={collapsed ? '展开侧边栏' : '折叠侧边栏'}
        >
          {collapsed ? <PanelLeft size={17} /> : <PanelLeftClose size={17} />}
        </button>
      </div>

      {/* Nav */}
      <nav className="side-nav">
        {visible.map((n) => {
          const Icon = n.icon;
          const badgeVal =
            n.badge === 'candidates'
              ? badges.candidates
              : n.badge === 'interviews'
              ? badges.interviews
              : n.badge === 'notifications'
              ? badges.notifications
              : undefined;
          const showBadge = badgeVal !== undefined && badgeVal > 0;
          const badgeCls =
            n.badge === 'interviews' ? 'emerald' : n.badge === 'notifications' ? 'amber' : '';
          return (
            <NavLink
              key={n.to}
              to={n.to}
              className={({ isActive }) => `side-link${isActive ? ' active' : ''}`}
              title={collapsed ? n.label : undefined}
            >
              <span className="ico">
                <Icon size={18} />
              </span>
              <span className="label">
                <span>{n.label}</span>
                {showBadge && <span className={`badge ${badgeCls}`}>{badgeVal}</span>}
              </span>
            </NavLink>
          );
        })}
      </nav>

      {/* Footer / user */}
      <div className="side-foot">
        <div className="side-foot-card">
          <div className="side-foot-avatar">{(user?.name || '?').slice(0, 1)}</div>
          {!collapsed && (
            <div className="side-foot-meta">
              <div className="side-foot-name">
                {user?.name}
                <span className="side-foot-role">{ROLE_LABELS[role]}</span>
              </div>
              <div className="side-foot-sub">招聘协作平台</div>
            </div>
          )}
        </div>
        <div className="side-foot-actions">
          <button onClick={onLogout}>
            <LogOut size={13} />
            退出登录
          </button>
          {!collapsed && <span className="ver">v2.4.0</span>}
        </div>
      </div>
    </aside>
  );
}
