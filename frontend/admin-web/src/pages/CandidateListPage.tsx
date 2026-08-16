import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  Search,
  LayoutGrid,
  List as ListIcon,
  Grid3x3,
  ScanSearch,
  ArrowRight,
} from 'lucide-react';
import { api } from '../lib/client';
import type { AdminApplication, Job, Stage } from '../types';
import { STAGE_LABELS, OFFER_OFFBOARD_STAGES } from '../types';
import BoardView from '../features/candidates/BoardView';
import ListView from '../features/candidates/ListView';
import MatrixView from '../features/candidates/MatrixView';
import CandidateDetailDrawer from '../features/candidates/CandidateDetailDrawer';
import SendOfferModal from '../features/candidates/SendOfferModal';

type ViewMode = 'board' | 'list' | 'matrix';

const STAGES_FOR_FILTER: Stage[] = [
  'APPLIED',
  'SCREENING',
  'SCREENING_PASSED',
  'FIRST_INTERVIEW',
  'SECOND_INTERVIEW',
  'FINAL_REVIEW',
  'HIRED',
  'REJECTED',
  'WITHDRAWN',
];

function ViewTab({
  active,
  icon: Icon,
  label,
  onClick,
}: {
  active: boolean;
  icon: typeof LayoutGrid;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      className={`view-tab${active ? ' active' : ''}`}
      onClick={onClick}
    >
      <Icon size={14} />
      <span>{label}</span>
    </button>
  );
}

export default function CandidateListPage() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [apps, setApps] = useState<AdminApplication[]>([]);
  const [jobs, setJobs] = useState<Job[]>([]);
  // 支持从岗位管理页跳转：/candidates?jobId=xxx&jobTitle=xxx
  const [jobId, setJobId] = useState(
    () => searchParams.get('jobId') || searchParams.get('job_id') || '',
  );
  const [stage, setStage] = useState(() => searchParams.get('stage') || '');
  const [search, setSearch] = useState('');
  const [view, setView] = useState<ViewMode>('board');
  const [loading, setLoading] = useState(true);
  const [selectedApp, setSelectedApp] = useState<AdminApplication | null>(null);
  const [advanceTarget, setAdvanceTarget] = useState<AdminApplication | null>(null);
  const [advanceRemark, setAdvanceRemark] = useState('');
  // 标记淘汰：使用自有弹窗收集原因（候选人淘汰后仍保留在人才库中）
  const [rejectTarget, setRejectTarget] = useState<AdminApplication | null>(null);
  const [rejectReason, setRejectReason] = useState('');
  const [rejectBusy, setRejectBusy] = useState(false);
  const [rejectError, setRejectError] = useState('');
  // 发 Offer：从「面试通过」列的候选人卡片发起
  const [offerApp, setOfferApp] = useState<AdminApplication | null>(null);
  const [offerMsg, setOfferMsg] = useState('');

  useEffect(() => {
    api
      .adminListJobs()
      .then(setJobs)
      .catch(() => {});
  }, []);

  // URL → state：从岗位页跳转 / 浏览器前后退时同步筛选
  useEffect(() => {
    const q = searchParams.get('jobId') || searchParams.get('job_id') || '';
    setJobId((prev) => (prev === q ? prev : q));
    const s = searchParams.get('stage') || '';
    setStage((prev) => (prev === s ? prev : s));
  }, [searchParams]);

  /** 修改岗位筛选时同步写回 URL，保证刷新/分享可复现 */
  function changeJobFilter(next: string) {
    setJobId(next);
    const sp = new URLSearchParams(searchParams);
    if (next) {
      sp.set('jobId', next);
      const title = jobs.find((j) => j.id === next)?.title;
      if (title) sp.set('jobTitle', title);
      else sp.delete('jobTitle');
    } else {
      sp.delete('jobId');
      sp.delete('job_id');
      sp.delete('jobTitle');
    }
    setSearchParams(sp, { replace: true });
  }

  const activeJob = jobs.find((j) => j.id === jobId);
  const activeJobTitle = activeJob?.title || searchParams.get('jobTitle') || '';

  function load() {
    setLoading(true);
    api
      .adminListApplications({
        job_id: jobId || undefined,
        stage: stage || undefined,
      })
      .then(setApps)
      .finally(() => setLoading(false));
  }
  useEffect(load, [jobId, stage]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return apps.filter((a) => {
      // Offer 审批通过（及之后状态）的候选人离开候选人看板
      if (a.offer_status && OFFER_OFFBOARD_STAGES.includes(a.offer_status)) return false;
      // 已淘汰的候选人离开候选人看板，仅保留在人才库中
      if (a.current_stage === 'REJECTED') return false;
      if (!q) return true;
      return (
        a.candidate_name?.toLowerCase().includes(q) ||
        a.job_title?.toLowerCase().includes(q) ||
        a.latest_company?.toLowerCase().includes(q) ||
        a.latest_school?.toLowerCase().includes(q) ||
        a.skills?.some((s) => s.toLowerCase().includes(q))
      );
    });
  }, [apps, search]);

  function handleAdvance(a: AdminApplication) {
    setAdvanceRemark('');
    setAdvanceTarget(a);
  }

  async function confirmAdvance() {
    if (!advanceTarget) return;
    const reason = advanceRemark.trim() || '推进';
    try {
      await api.adminNextStage(advanceTarget.id, reason);
      setAdvanceTarget(null);
      load();
    } catch (e) {
      window.alert(`推进失败：${e instanceof Error ? e.message : e}`);
    }
  }

  function handleSelect(app: AdminApplication) {
    setSelectedApp(app);
  }

  function handleCloseDrawer() {
    setSelectedApp(null);
  }

  function handleDrawerAdvance() {
    if (!selectedApp) return;
    handleAdvance(selectedApp);
  }

  function handleDrawerReject() {
    if (!selectedApp) return;
    setRejectReason('');
    setRejectError('');
    setRejectTarget(selectedApp);
  }

  async function confirmReject() {
    if (!rejectTarget) return;
    setRejectBusy(true);
    setRejectError('');
    try {
      await api.adminReject(rejectTarget.id, rejectReason.trim() || '淘汰');
      setRejectTarget(null);
      setSelectedApp(null);
      load();
    } catch (e) {
      setRejectError(e instanceof Error ? e.message : String(e));
    } finally {
      setRejectBusy(false);
    }
  }

  /** 跳转到候选人详情页并自动展开安排面试表单 */
  function scheduleFor(a: AdminApplication) {
    navigate(`/candidates/${a.id}?action=schedule`);
    setSelectedApp(null);
  }

  function handleDrawerSchedule() {
    if (!selectedApp) return;
    scheduleFor(selectedApp);
  }

  function handleOpenFullPage() {
    if (!selectedApp) return;
    navigate(`/candidates/${selectedApp.id}`);
    setSelectedApp(null);
  }

  // Stage filter labels shown on board columns (only stages with apps).
  const stageOptions: Stage[] = STAGES_FOR_FILTER;

  return (
    <div className="page candidates-page">
      <div className="candidates-toolbar">
        <div className="filters">
          <div className="input-with-icon candidates-search">
            <Search size={14} className="input-ico" />
            <input
              className="input"
              placeholder="搜索姓名、公司、学校、标签…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <select
            className="input"
            value={jobId}
            onChange={(e) => changeJobFilter(e.target.value)}
          >
            <option value="">全部在招岗位</option>
            {jobs.map((j) => (
              <option key={j.id} value={j.id}>
                {j.title}
              </option>
            ))}
            {/* 深链带入的岗位可能不在当前列表（如已关闭岗位），补一个占位项避免选中态丢失 */}
            {jobId && !activeJob && (
              <option value={jobId}>{activeJobTitle || '指定岗位'}</option>
            )}
          </select>
          <select
            className="input"
            value={stage}
            onChange={(e) => setStage(e.target.value)}
          >
            <option value="">全部招聘阶段</option>
            {stageOptions.map((s) => (
              <option key={s} value={s}>
                {STAGE_LABELS[s]}
              </option>
            ))}
          </select>
        </div>
        <div
          className="toolbar-right"
          style={{ display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}
        >
          <span className="muted">共 {apps.length} 位候选人</span>
          <button
            className="btn btn-primary"
            onClick={() => navigate(jobId ? `/jobs/${jobId}/screening` : '/screening')}
          >
            <ScanSearch size={14} style={{ verticalAlign: '-1px', marginRight: 4 }} />
            进入初筛工作台
          </button>
          <div className="view-switcher" role="tablist" aria-label="视图切换">
            <ViewTab
              active={view === 'board'}
              icon={LayoutGrid}
              label="看板视图"
              onClick={() => setView('board')}
            />
            <ViewTab
              active={view === 'list'}
              icon={ListIcon}
              label="列表模式"
              onClick={() => setView('list')}
            />
            <ViewTab
              active={view === 'matrix'}
              icon={Grid3x3}
              label="岗位矩阵"
              onClick={() => setView('matrix')}
            />
          </div>
        </div>
      </div>

      {loading ? (
        <div className="page-loading">加载中…</div>
      ) : filtered.length === 0 ? (
        <div className="empty">
          <b>没有匹配的候选人</b>
          {jobId
            ? `岗位「${activeJobTitle || '指定岗位'}」下暂无符合条件的候选人，可清除岗位筛选查看全部。`
            : '尝试清空搜索或筛选条件，或发布更多岗位以扩大漏斗。'}
          <button
            type="button"
            className="btn-link"
            style={{ display: 'block', margin: '12px auto 0' }}
            onClick={() => (jobId ? changeJobFilter('') : navigate('/jobs/new'))}
          >
            {jobId ? '清除岗位筛选' : '去发布岗位'}
          </button>
        </div>
      ) : view === 'board' ? (
        <BoardView
          apps={filtered}
          onAdvance={handleAdvance}
          onSelect={handleSelect}
          onSendOffer={(a) => setOfferApp(a)}
        />
      ) : view === 'list' ? (
        <ListView
          apps={filtered}
          onSelect={handleSelect}
          onAdvance={handleAdvance}
          onSchedule={scheduleFor}
        />
      ) : (
        <MatrixView apps={filtered} jobs={jobs} onSelect={handleSelect} />
      )}

      {/* Candidate Detail Drawer */}

      {/* 推进候选人：自定义弹窗（替代浏览器 window.prompt） */}
      {advanceTarget && (
        <div className="modal-overlay" style={{ zIndex: 80 }} onMouseDown={() => setAdvanceTarget(null)}>
          <div
            className="modal"
            style={{ width: 480, zIndex: 82 }}
            onMouseDown={(e) => e.stopPropagation()}
          >
            <div className="modal-head">
              <div className="modal-head-left">
                <div className="modal-head-icon">
                  <ArrowRight size={18} />
                </div>
                <div>
                  <h3>推进候选人</h3>
                </div>
              </div>
              <button className="modal-close" onClick={() => setAdvanceTarget(null)}>
                ×
              </button>
            </div>
            <div className="modal-body">
              <label className="field" style={{ marginBottom: 0 }}>
                <span>备注（选填）</span>
                <textarea
                  className="input"
                  value={advanceRemark}
                  onChange={(e) => setAdvanceRemark(e.target.value)}
                  placeholder="例如：技术能力达标，进入下一轮面试"
                  rows={3}
                  autoFocus
                />
              </label>
            </div>
            <div className="modal-foot modal-foot--end">
              <div className="modal-foot-btns">
                <button className="btn" onClick={() => setAdvanceTarget(null)}>
                  取消
                </button>
                <button className="btn btn-primary" onClick={confirmAdvance}>
                  确认推进
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 标记淘汰：自定义弹窗（替代浏览器 window.prompt） */}
      {rejectTarget && (
        <div className="modal-overlay" style={{ zIndex: 80 }} onMouseDown={() => !rejectBusy && setRejectTarget(null)}>
          <div
            className="modal"
            style={{ width: 480, zIndex: 82 }}
            onMouseDown={(e) => e.stopPropagation()}
          >
            <div className="modal-head" style={{ padding: '14px 20px' }}>
              <h3 style={{ margin: 0, fontSize: 15 }}>标记淘汰</h3>
              <button className="modal-close" onClick={() => setRejectTarget(null)} disabled={rejectBusy}>
                ×
              </button>
            </div>
            <div className="modal-body" style={{ padding: '14px 20px' }}>
              <div className="alert alert-soft" style={{ marginBottom: 14 }}>
                淘汰后本次投递流程结束，候选人资料<b>仍保留在人才库</b>中，后续可继续检索与复用。
              </div>
              <label className="field" style={{ marginBottom: 0 }}>
                <span>淘汰原因</span>
                <textarea
                  className="input"
                  value={rejectReason}
                  onChange={(e) => setRejectReason(e.target.value)}
                  placeholder="例如：项目深度不足，与岗位技术栈匹配度偏低"
                  rows={3}
                  autoFocus
                />
              </label>
              {rejectError && <div className="cd-inline-error">{rejectError}</div>}
            </div>
            <div className="modal-foot modal-foot--end">
              <div className="modal-foot-btns">
                <button className="btn" onClick={() => setRejectTarget(null)} disabled={rejectBusy}>
                  取消
                </button>
                <button className="btn btn-danger" onClick={confirmReject} disabled={rejectBusy}>
                  {rejectBusy ? '处理中…' : '确认淘汰'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <CandidateDetailDrawer
        app={selectedApp}
        onClose={handleCloseDrawer}
        onAdvance={handleDrawerAdvance}
        onReject={handleDrawerReject}
        onSchedule={handleDrawerSchedule}
        onOpenFullPage={handleOpenFullPage}
      />

      {offerMsg && (
        <div
          className="alert alert-success"
          style={{ position: 'fixed', bottom: 24, right: 24, zIndex: 60, margin: 0 }}
        >
          {offerMsg}
          <button
            className="btn-link"
            style={{ marginLeft: 12 }}
            onClick={() => navigate('/offers')}
          >
            查看 Offer ›
          </button>
          <button
            className="modal-close"
            style={{ marginLeft: 8 }}
            onClick={() => setOfferMsg('')}
          >
            ×
          </button>
        </div>
      )}

      <SendOfferModal
        app={offerApp}
        onClose={() => setOfferApp(null)}
        onCreated={() => {
          setOfferMsg('Offer 已提交审批，等待超管审批后可发送');
        }}
      />
    </div>
  );
}