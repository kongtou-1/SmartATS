import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Loader2, Inbox, CheckCircle2, RefreshCw, Bell } from 'lucide-react';
import { api } from '../lib/client';
import { useShell } from '../components/ShellContext';
import type { AdminApplication, AdminApplicationDetail, JobWithStats } from '../types';
import ScreeningQueue from '../features/screening/ScreeningQueue';
import ScreeningResume from '../features/screening/ScreeningResume';
import ScreeningDecisionPanel from '../features/screening/ScreeningDecisionPanel';
import '../features/screening/screening.css';

type Outcome = 'passed' | 'rejected';

export default function ScreeningWorkbenchPage() {
  const { jobId } = useParams();
  const navigate = useNavigate();
  const shell = useShell();

  const [selJobId, setSelJobId] = useState(jobId || '');
  const [jobs, setJobs] = useState<JobWithStats[]>([]);
  const [queue, setQueue] = useState<AdminApplication[]>([]);
  const [loading, setLoading] = useState(true);
  const [processed, setProcessed] = useState<Record<string, Outcome>>({});
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<AdminApplicationDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [search, setSearch] = useState('');
  const [hideProcessed, setHideProcessed] = useState(false);
  const [toast, setToast] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  function flashToast(kind: 'ok' | 'err', text: string) {
    setToast({ kind, text });
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 2600);
  }

  // 左右栏宽度（可拖拽调整）
  const bodyRef = useRef<HTMLDivElement>(null);
  const [leftWidth, setLeftWidth] = useState(320);
  const [rightWidth, setRightWidth] = useState(366);
  const dragging = useRef<null | 'left' | 'right'>(null);

  // 岗位下拉（全局模式可用）
  useEffect(() => {
    api.adminListJobs().then(setJobs).catch(() => {});
  }, []);

  // 加载队列（APPLIED = 待初筛）
  function loadQueue() {
    setLoading(true);
    api
      .adminListApplications({ job_id: selJobId || undefined, stage: 'APPLIED' })
      .then(setQueue)
      .finally(() => setLoading(false));
  }
  useEffect(loadQueue, [selJobId]);

  function selectById(a: AdminApplication) {
    const id = a.id;
    setSelectedId(id);
    setDetail(null);
    setDetailLoading(true);
    api
      .adminGetApplication(id)
      .then(setDetail)
      .finally(() => setDetailLoading(false));
  }

  // 拖拽调整左右栏宽度
  useEffect(() => {
    function onMove(e: MouseEvent) {
      if (!dragging.current || !bodyRef.current) return;
      const rect = bodyRef.current.getBoundingClientRect();
      if (dragging.current === 'left') {
        let w = e.clientX - rect.left - 4; // 减去左内边距
        w = Math.max(240, Math.min(560, w));
        setLeftWidth(w);
      } else {
        let w = rect.right - e.clientX - 4; // 减去右内边距
        w = Math.max(300, Math.min(620, w));
        setRightWidth(w);
      }
    }
    function onUp() {
      if (!dragging.current) return;
      dragging.current = null;
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    }
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    return () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
  }, []);

  function startDrag(side: 'left' | 'right') {
    dragging.current = side;
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
  }

  function nextUnprocessed(currentId: string): AdminApplication | null {
    if (!queue.length) return null;
    const idx = queue.findIndex((a) => a.id === currentId);
    for (let i = idx + 1; i < queue.length; i++) if (!processed[queue[i].id]) return queue[i];
    for (let i = 0; i < idx; i++) if (!processed[queue[i].id]) return queue[i];
    return null;
  }

  function decide(outcome: Outcome) {
    if (!selectedId || busy) return;
    setBusy(true);
    const id = selectedId;
    const run = async () => {
      if (outcome === 'passed') {
        await api.adminTransition(id, 'SCREENING_PASSED', '初筛通过');
        flashToast('ok', '已通过初筛');
      } else {
        // 淘汰由后端统一处理：自动进入人才库并打上对应阶段的淘汰标签
        await api.adminReject(id, '初筛未通过');
        flashToast('ok', '已淘汰，候选人已转入人才库');
      }
      setProcessed((p) => ({ ...p, [id]: outcome }));
      // 决策后该候选人立即离开初筛队列（后端已置 REJECTED/SCREENING_PASSED，淘汰者进入人才库）
      setQueue((q) => q.filter((a) => a.id !== id));
      const next = nextUnprocessed(id);
      if (next) selectById(next);
      else {
        setSelectedId(null);
        setDetail(null);
      }
    };
    run()
      .catch((e: unknown) => {
        const msg = e instanceof Error ? e.message : String(e);
        flashToast('err', `操作失败：${msg}`);
        window.alert(`操作失败：${msg}`);
      })
      .finally(() => setBusy(false));
  }

  async function handleRerun() {
    if (!selectedId) return;
    setDetailLoading(true);
    try {
      await api.adminAgentRerun(selectedId);
      const d = await api.adminGetApplication(selectedId);
      setDetail(d);
    } finally {
      setDetailLoading(false);
    }
  }

  const filteredQueue = useMemo(() => {
    const q = search.trim().toLowerCase();
    return queue.filter((a) => {
      if (hideProcessed && processed[a.id]) return false;
      if (!q) return true;
      return (
        a.candidate_name?.toLowerCase().includes(q) ||
        a.latest_company?.toLowerCase().includes(q) ||
        a.latest_school?.toLowerCase().includes(q) ||
        a.skills?.some((s) => s.toLowerCase().includes(q))
      );
    });
  }, [queue, search, hideProcessed, processed]);

  const pendingCount = queue.filter((a) => !processed[a.id]).length;
  const processedCount = Object.keys(processed).length;
  const jobTitle = jobs.find((j) => j.id === selJobId)?.title || '';
  const allDone = !loading && processedCount > 0 && pendingCount === 0;
  const emptyQueue = !loading && queue.length === 0 && processedCount === 0;

  return (
    <div className="screening-wb">
      <header className="swb-top">
        <div className="swb-title">
          <span>初筛工作台</span>
          {selJobId ? (
            <span className="swb-job">· {jobTitle}</span>
          ) : (
            <span className="swb-job muted">· 全部岗位</span>
          )}
        </div>
        <div className="swb-actions">
          <span className="swb-stats">
            待初筛 <b>{pendingCount}</b> 人 · 已处理 {processedCount} 人
          </span>
          <button className="icon-btn" onClick={shell.onRefresh} title="刷新队列">
            <RefreshCw size={16} />
          </button>
          <button
            className="icon-btn"
            onClick={shell.onToggleNotifications}
            title="通知中心"
          >
            <Bell size={16} />
            {shell.unreadCount ? <span className="dot" /> : null}
          </button>
        </div>
      </header>

      <div
        className="swb-body"
        ref={bodyRef}
        style={{ '--lw': `${leftWidth}px`, '--rw': `${rightWidth}px` } as React.CSSProperties}
      >
        <ScreeningQueue
          apps={filteredQueue}
          processed={processed}
          selectedId={selectedId}
          loading={loading}
          search={search}
          onSearch={setSearch}
          hideProcessed={hideProcessed}
          onToggleHide={() => setHideProcessed((v) => !v)}
          onSelect={selectById}
          globalMode={!selJobId}
          jobId={selJobId}
          jobs={jobs as JobWithStats[]}
          onJobChange={(v) => setSelJobId(v)}
        />

        <div
          className="swb-resizer swb-resizer-left"
          onMouseDown={() => startDrag('left')}
          role="separator"
          aria-orientation="vertical"
          aria-label="调整队列宽度"
        />

        {detail ? (
          <ScreeningResume detail={detail} loading={detailLoading} />
        ) : (
          <div className="swb-center-empty card">
            {loading ? (
              <Loader2 className="spin" size={26} />
            ) : emptyQueue ? (
              <>
                <Inbox size={34} />
                <b>该范围暂无待初筛候选人</b>
                <span className="muted">已投递待初筛的候选人会出现在这里</span>
              </>
            ) : allDone ? (
              <>
                <CheckCircle2 size={34} className="ok" />
                <b>全部初筛完成</b>
                <span className="muted">本批次候选人已全部处理，可切换岗位或返回</span>
              </>
            ) : (
              <span className="muted">从左侧队列选择一位候选人开始初筛</span>
            )}
          </div>
        )}

        <div
          className="swb-resizer swb-resizer-right"
          onMouseDown={() => startDrag('right')}
          role="separator"
          aria-orientation="vertical"
          aria-label="调整决策栏宽度"
        />

        {detail ? (
          <ScreeningDecisionPanel
            applicationId={selectedId!}
            detail={detail}
            busy={busy}
            onPass={() => decide('passed')}
            onReject={() => decide('rejected')}
            onRerun={handleRerun}
            onViewFull={() => navigate(`/candidates/${selectedId}`)}
          />
        ) : (
          <div className="swb-right-empty" />
        )}
      </div>

      {toast && (
        <div className={`swb-toast swb-toast--${toast.kind}`} role="status">
          {toast.text}
        </div>
      )}
    </div>
  );
}
