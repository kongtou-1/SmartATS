import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Calendar,
  FileCheck2,
  FileText,
  Flame,
  Plus,
  BarChart3,
  Users,
  Video,
  ArrowRight,
  ChevronRight,
} from 'lucide-react';
import { api } from '../lib/client';
import { useAuth } from '../components/AuthContext';
import type { DashboardSummary, DashboardInterview, DashboardUrgentJob } from '../types';

function GreetingHour() {
  const hour = new Date().getHours();
  if (hour < 12) return '早上好';
  if (hour < 14) return '中午好';
  if (hour < 19) return '下午好';
  return '晚上好';
}

export default function DashboardPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const isHRRole = user?.role === 'HR' || user?.role === 'SUPER_ADMIN';
  const isInterviewer = user?.role === 'INTERVIEWER';

  useEffect(() => {
    api
      .dashboardSummary?.()
      .then((data) => {
        setSummary(data);
        setLoading(false);
      })
      .catch((err) => {
        setError(err instanceof Error ? err.message : '加载失败');
        setLoading(false);
      });
  }, []);

  const displayName = user?.name || 'HR';
  const todayText = useMemo(() => {
    if (summary?.today_text) return summary.today_text;
    const d = new Date();
    const weekdays = ['星期日', '星期一', '星期二', '星期三', '星期四', '星期五', '星期六'];
    return `${d.getFullYear()}年${String(d.getMonth() + 1).padStart(2, '0')}月${String(d.getDate()).padStart(2, '0')}日 ${weekdays[d.getDay()]}`;
  }, [summary]);

  const greeting = summary?.greeting || `${GreetingHour()}，`;
  const statusLine =
    summary?.recruiting_status ||
    '今日共有 0 场面试待开展、0 份新投递简历待初筛，目前全公司共有 0 个在招职位正在推进。';

  const stats = summary?.stats ?? {
    pending_resume_count: 0,
    today_interview_count: 0,
    pending_offer_count: 0,
    active_job_count: 0,
    open_headcount: 0,
  };

  if (loading) {
    return (
      <div className="page dashboard-page">
        <div className="page-loading">加载中…</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="page dashboard-page">
        <div className="empty">{error}</div>
      </div>
    );
  }

  return (
    <div className="page dashboard-page">
      {/* Hero banner */}
      <section className="dashboard-hero">
        <div className="dashboard-hero-main">
          <div className="dashboard-hero-date">
            <Calendar size={13} />
            <span>{todayText}</span>
            <span className="dashboard-hero-badge">招聘进行中</span>
          </div>
          <h1 className="dashboard-hero-title">
            {greeting}
            {displayName} 👋
          </h1>
          <p className="dashboard-hero-sub">{statusLine}</p>
        </div>
        <div className="dashboard-hero-actions">
          {isHRRole && (
            <button className="btn btn-primary" onClick={() => navigate('/jobs/new')}>
              <Plus size={16} />
              发布新职位
            </button>
          )}
          <button className="btn" onClick={() => navigate('/interviews')}>
            <Video size={16} />
            安排面试
          </button>
          {isHRRole && (
            <button className="btn" onClick={() => navigate('/candidates')}>
              <Users size={16} />
              候选人看板
            </button>
          )}
          {isHRRole && (
            <button className="btn" onClick={() => navigate('/reports')}>
              <BarChart3 size={16} />
              数据报表
            </button>
          )}
        </div>
      </section>

      {/* Quick task cards */}
      <section className="dashboard-section">
        <div className="dashboard-section-head">
          <h2>今日待办与任务直通车</h2>
          <span className="dashboard-section-hint">点击卡片可快速跳转至对应业务模块</span>
        </div>
        <div className="dashboard-task-grid">
          {!isInterviewer && (
            <TaskCard
              icon={<FileText size={22} />}
              title="待处理简历"
              tag="待评审"
              tagType="info"
              count={stats.pending_resume_count}
              unit="份新投递"
              action="立即去筛选"
              onAction={() => navigate('/candidates')}
            />
          )}
          <TaskCard
            icon={<Calendar size={22} />}
            title="今日待面试"
            tag="今日待面"
            tagType="success"
            count={stats.today_interview_count}
            unit="场待评估"
            action="查看面试日程"
            onAction={() => navigate('/interviews')}
          />
          {!isInterviewer && (
            <TaskCard
              icon={<FileCheck2 size={22} />}
              title="已发 Offer 跟踪"
              tag={stats.pending_offer_count > 0 ? '待确认' : '正常'}
              tagType={stats.pending_offer_count > 0 ? 'warning' : 'info'}
              count={stats.pending_offer_count}
              unit="人待入职确认"
              action="Offer 审批进度"
              onAction={() => navigate('/offers')}
            />
          )}
          {!isInterviewer && (
            <div className="task-card task-card--emphasis" onClick={() => navigate('/jobs')}>
              <div className="task-card-top">
                <span className="task-card-icon task-card-icon--emphasis">
                  <Flame size={22} />
                </span>
                <span className="task-card-tag task-card-tag--danger">重点关注</span>
              </div>
              <div className="task-card-body task-card-body--emphasis">
                <div className="task-card-chart">
                  <div className="mini-bars">
                    <span style={{ height: '40%' }} />
                    <span style={{ height: '70%' }} />
                    <span style={{ height: '55%' }} />
                    <span style={{ height: '85%' }} />
                    <span style={{ height: '60%' }} />
                  </div>
                  <div className="mini-line" />
                </div>
                <div className="task-card-info">
                  <div className="task-card-title">急聘岗位推进中</div>
                  <div className="task-card-meta">
                    {summary?.urgent_jobs?.length ?? 0} 个高优先级岗位
                  </div>
                </div>
              </div>
              <div className="task-card-foot">
                <span>查看急聘岗位</span>
                <ArrowRight size={14} />
              </div>
            </div>
          )}
        </div>
      </section>

      {/* Bottom grid: interviews + urgent jobs */}
      <div className="dashboard-bottom-grid">
        <section className="dashboard-card dashboard-card--interviews">
          <div className="dashboard-card-head">
            <div>
              <h3>今日面试协同日程</h3>
              <span className="dashboard-card-sub">实时更新协同面试进度与反馈</span>
            </div>
            <button className="dashboard-link" onClick={() => navigate('/interviews')}>
              完整日历 <ChevronRight size={14} />
            </button>
          </div>
          <div className="dashboard-interview-list">
            {(summary?.interviews ?? []).length === 0 ? (
              <div className="empty">今日暂无面试</div>
            ) : (
              (summary?.interviews ?? []).map((iv) => (
                <InterviewRow key={iv.id} interview={iv} onEnter={() => navigate(`/interviews/${iv.id}`)} />
              ))
            )}
          </div>
        </section>

        {!isInterviewer && (
          <section className="dashboard-card dashboard-card--jobs">
            <div className="dashboard-card-head">
              <div>
                <h3>急聘职位关注榜</h3>
              </div>
              <button className="dashboard-link" onClick={() => navigate('/jobs')}>
                查看全部 <ChevronRight size={14} />
              </button>
            </div>
            <div className="dashboard-job-list">
              {(summary?.urgent_jobs ?? []).length === 0 ? (
                <div className="empty">暂无急聘职位</div>
              ) : (
                (summary?.urgent_jobs ?? []).map((job) => (
                  <UrgentJobRow key={job.id} job={job} onClick={() => navigate(`/jobs`)} />
                ))
              )}
            </div>
          </section>
        )}
      </div>
    </div>
  );
}

function TaskCard({
  icon,
  title,
  tag,
  tagType,
  count,
  unit,
  action,
  onAction,
}: {
  icon: React.ReactNode;
  title: string;
  tag: string;
  tagType: 'info' | 'success' | 'warning' | 'danger';
  count: number;
  unit: string;
  action: string;
  onAction: () => void;
}) {
  return (
    <div className="task-card" onClick={onAction}>
      <div className="task-card-top">
        <span className={`task-card-icon task-card-icon--${tagType}`}>{icon}</span>
        <span className={`task-card-tag task-card-tag--${tagType}`}>{tag}</span>
      </div>
      <div className="task-card-body">
        <div className="task-card-count">
          {count}
          <span className="task-card-unit">{unit}</span>
        </div>
      </div>
      <div className="task-card-foot">
        <span>{action}</span>
        <ArrowRight size={14} />
      </div>
    </div>
  );
}

function InterviewRow({
  interview,
  onEnter,
}: {
  interview: DashboardInterview;
  onEnter: () => void;
}) {
  const initials = interview.candidate_name.slice(0, 1) || '?';
  return (
    <div className="dashboard-interview-row">
      <div className="dashboard-avatar">{initials}</div>
      <div className="dashboard-interview-info">
        <div className="dashboard-interview-name">
          {interview.candidate_name}
          <span className="dashboard-interview-round">{interview.round_label}</span>
        </div>
        <div className="dashboard-interview-meta">
          {interview.time_range} · 主考官：{interview.interviewer_name} · {interview.method}
        </div>
        <div className="dashboard-interview-job">{interview.job_title}</div>
      </div>
      <button className="btn btn-primary btn-sm" onClick={onEnter}>
        进入面试
      </button>
    </div>
  );
}

function UrgentJobRow({ job, onClick }: { job: DashboardUrgentJob; onClick: () => void }) {
  return (
    <div className="dashboard-job-row" onClick={onClick}>
      <div className="dashboard-job-main">
        <div className="dashboard-job-title">
          {job.title}
          <span className="dashboard-job-salary">{job.salary_text}</span>
        </div>
        <div className="dashboard-job-meta">
          已投 <b>{job.applications_total}</b> 人 · {job.department}
        </div>
      </div>
      <span className="dashboard-job-tag">急聘</span>
    </div>
  );
}
