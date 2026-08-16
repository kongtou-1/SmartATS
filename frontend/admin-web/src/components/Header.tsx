import { useLocation } from 'react-router-dom';
import { Search, RefreshCw, Bell, Download, Plus } from 'lucide-react';

interface HeaderProps {
  searchQuery: string;
  onSearchChange: (q: string) => void;
  onToggleNotifications: () => void;
  unreadCount: number;
  onExport?: () => void;
  onRefresh: () => void;
  isRefreshing?: boolean;
  primaryAction?: { label: string; onClick: () => void };
}

const TAB_TITLES: Record<string, { title: string; subtitle: string }> = {
  jobs: { title: '岗位管理', subtitle: '统一管理全公司在招职位、招聘进度、用人编制与发布状态' },
  'job-categories': { title: '岗位方向', subtitle: '配置业务线职类、专业通道与岗位层级架构' },
  announcements: { title: '招聘动态', subtitle: '实时跟踪各部门面试流转、简历初筛与 Offer 审批轨迹' },
  candidates: { title: '候选人管理', subtitle: '全流程候选人看板，支持多阶段智能跟进与快速安排面试' },
  talents: { title: '人才库', subtitle: '企业核心高潜人才储备库与往期高分候选人画像沉淀' },
  'talent-settings': { title: '人才配置 (HC规划)', subtitle: '季度招聘编制预算、部门 HC 消耗率与达成进度监控' },
  interviews: { title: '面试协同', subtitle: '多考官日历协同、面试间快速分配与线上视频连线' },
  calendar: { title: '招聘日历', subtitle: '月度与周视图面试安排，支持一键同步日历' },
  offers: { title: 'Offer 管理', subtitle: '薪酬审批、电子 Offer 发放与候选人意向确认跟踪' },
  reports: { title: '招聘效能报表', subtitle: '招聘漏斗转化分析、渠道 ROI 对比及到岗周期洞察' },
  notifications: { title: '系统通知', subtitle: '待办任务、审批提醒与智能流转预警' },
  audit: { title: '审计日志', subtitle: '操作留痕、账号变更与安全合规审计' },
  users: { title: '后台用户', subtitle: '系统账号、角色与权限管理' },
};

export default function Header({
  searchQuery,
  onSearchChange,
  onToggleNotifications,
  unreadCount,
  onExport,
  onRefresh,
  isRefreshing = false,
  primaryAction,
}: HeaderProps) {
  const { pathname } = useLocation();
  const seg = pathname.split('/')[1] || 'jobs';
  const info = TAB_TITLES[seg] || { title: '招聘管理', subtitle: '招聘后台管理中心' };

  return (
    <header className="topbar">
      <div className="topbar-inner">
        <div className="topbar-left">
          <h1 className="topbar-title">{info.title}</h1>
        </div>

        <div className="topbar-right">
          <div className="search-box">
            <Search size={15} className="si" />
            <input
              type="text"
              placeholder="搜索岗位、方向、地点..."
              value={searchQuery}
              onChange={(e) => onSearchChange(e.target.value)}
            />
            {searchQuery && (
              <button className="clear" onClick={() => onSearchChange('')} title="清除">
                ×
              </button>
            )}
          </div>

          <button
            className={`icon-btn${isRefreshing ? ' spin' : ''}`}
            onClick={onRefresh}
            title="刷新数据"
          >
            <RefreshCw size={16} />
          </button>

          <button
            className="icon-btn"
            onClick={onToggleNotifications}
            title="查看通知"
          >
            <Bell size={16} />
            {unreadCount > 0 && <span className="dot" />}
          </button>

          {onExport && (
            <button className="icon-btn" onClick={onExport} title="导出报表">
              <Download size={16} />
            </button>
          )}

          {primaryAction && (
            <button className="btn-primary rounded" onClick={primaryAction.onClick}>
              <Plus size={15} strokeWidth={2.5} />
              {primaryAction.label}
            </button>
          )}
        </div>
      </div>
    </header>
  );
}
