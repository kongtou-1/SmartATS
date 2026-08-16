import { useEffect, useState } from 'react';
import { api } from '../lib/client';
import { BASE, downloadFile, uploadFile } from '../lib/api';
import { getToken } from '../lib/token';
import { REJECT_STAGE_LABELS } from '../types';
import type { Job, SourceChannel, Tag, Talent, TalentPage, User } from '../types';
import TalentDetailDrawer from '../components/TalentDetailDrawer';
import ReasonModal from '../components/ReasonModal';
import ReactivateModal from '../components/ReactivateModal';

const POLL_TIMEOUT_MS = 60000;
const POLL_INTERVAL_MS = 1000;

const stageLabels: Record<string, string> = {
  APPLIED: '已投递',
  SCREENING: '简历初筛',
  SCREENING_PASSED: '初筛通过',
  FIRST_INTERVIEW: '一面',
  SECOND_INTERVIEW: '二面',
  FINAL_REVIEW: '终面',
  HIRED: '面试通过',
  REJECTED: '已拒绝',
};

const clean = (row: Record<string, string>) =>
  Object.fromEntries(Object.entries(row).filter(([, v]) => v !== ''));

const INITIAL_FILTERS: Record<string, string> = {
  name: '',
  phone: '',
  skills: '',
  tag_ids: '',
  source_channel_id: '',
  owner_id: '',
  job_id: '',
  stage: '',
  reject_stage: '',
  min_years: '',
  max_years: '',
  page: '1',
  page_size: '20',
};

interface DataJob {
  id: string;
  status: 'PENDING' | 'RUNNING' | 'COMPLETED' | 'FAILED';
  error_message?: string;
  output_key?: string;
  summary: { created?: number; updated?: number; skipped?: number };
}

export default function TalentPoolPage({ variant = 'pool' }: { variant?: 'pool' | 'directory' }) {
  const isPool = variant === 'pool';
  const [page, setPage] = useState<TalentPage>({ items: [], page: 1, page_size: 20, total: 0 });
  const [sources, setSources] = useState<SourceChannel[]>([]);
  const [tags, setTags] = useState<Tag[]>([]);
  const [owners, setOwners] = useState<User[]>([]);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [selected, setSelected] = useState<string[]>([]);
  const [filters, setFilters] = useState<Record<string, string>>(INITIAL_FILTERS);
  const [message, setMessage] = useState('');
  const [activeId, setActiveId] = useState<string | null>(null);
  const [activeInitial, setActiveInitial] = useState<Talent | null>(null);
  const [reasonOpen, setReasonOpen] = useState<null | { action: 'REJECT' | 'NOTIFY' }>(null);
  const [submitting, setSubmitting] = useState(false);
  const [busy, setBusy] = useState<'' | 'import' | 'export'>('');
  const [scope, setScope] = useState<string>(isPool ? 'pool' : 'all');
  const [reactOpen, setReactOpen] = useState(false);
  const [reactIds, setReactIds] = useState<string[]>([]);

  const load = (override: Record<string, string> = {}) => {
    const next = { ...filters, ...override };
    setFilters(next);
    return api
      .listTalents?.(clean({ ...next, scope }))
      .then((x) => {
        setPage(x);
        setSelected([]);
      })
      .catch((e) => setMessage('人才列表加载失败：' + (e instanceof Error ? e.message : String(e))));
  };
  useEffect(() => {
    void api
      .listTalents?.(clean({ ...INITIAL_FILTERS, scope }))
      .then((result) => {
        setPage(result);
        setSelected([]);
      })
      .catch((e) => setMessage('人才列表加载失败：' + (e instanceof Error ? e.message : String(e))));
    void Promise.all([
      api.listSourceChannels?.().then(setSources).catch(() => {}),
      api.listTags?.().then(setTags).catch(() => {}),
      api.listTalentOwners?.().then(setOwners).catch(() => {}),
      api.adminListJobs().then(setJobs).catch(() => {}),
    ]).catch(() => setMessage('筛选选项加载失败，部分筛选可能不可用'));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ---- Directory (CRM) bulk actions: advance / reject / notify ----
  async function runBulk(action: 'REJECT' | 'NOTIFY', text: string) {
    setReasonOpen(null);
    setSubmitting(true);
    try {
      const r = await api.bulkApplications?.({
        application_ids: selected,
        action,
        reason: action === 'REJECT' ? text : '',
        subject: '招聘流程通知',
        body: action === 'NOTIFY' ? text : '',
        idempotency_key: crypto.randomUUID(),
      });
      setMessage(`成功 ${r?.success_count || 0}，失败 ${r?.failure_count || 0}`);
      void load();
    } catch (e) {
      setMessage((e as Error).message);
    } finally {
      setSubmitting(false);
    }
  }
  async function advance() {
    setSubmitting(true);
    try {
      const r = await api.bulkApplications?.({
        application_ids: selected,
        action: 'ADVANCE',
        idempotency_key: crypto.randomUUID(),
      });
      setMessage(`成功 ${r?.success_count || 0}，失败 ${r?.failure_count || 0}`);
      void load();
    } catch (e) {
      setMessage((e as Error).message);
    } finally {
      setSubmitting(false);
    }
  }
  function bulkDirectory(action: 'ADVANCE' | 'REJECT' | 'NOTIFY') {
    if (!selected.length) return;
    if (action === 'ADVANCE') void advance();
    else setReasonOpen({ action });
  }

  // ---- Pool bulk actions: reactivate / remove / restore ----
  function openReactivate(ids: string[]) {
    if (!ids.length) return;
    setReactIds(ids);
    setReactOpen(true);
  }
  async function confirmReactivate(jobId: string, note: string) {
    setReactOpen(false);
    setSubmitting(true);
    try {
      let ok = 0;
      let fail = 0;
      for (const id of reactIds) {
        try {
          await api.reactivateTalent?.(id, { job_id: jobId, note: note || null });
          ok++;
        } catch {
          fail++;
        }
      }
      setMessage(`重新激活成功 ${ok}，失败 ${fail}`);
      void load();
    } finally {
      setSubmitting(false);
    }
  }
  async function removeSelected() {
    if (!selected.length) return;
    if (!window.confirm(`确认将选中的 ${selected.length} 位人才移出人才库（可恢复）？`)) return;
    setSubmitting(true);
    try {
      let ok = 0;
      for (const id of selected) {
        try {
          await api.deleteTalent?.(id);
          ok++;
        } catch {
          /* ignore individual failures */
        }
      }
      setMessage(`已移出 ${ok} 位人才`);
      void load();
    } finally {
      setSubmitting(false);
    }
  }
  async function restoreSelected() {
    if (!selected.length) return;
    setSubmitting(true);
    try {
      let ok = 0;
      for (const id of selected) {
        try {
          await api.restoreTalent?.(id);
          ok++;
        } catch {
          /* ignore */
        }
      }
      setMessage(`已恢复 ${ok} 位人才`);
      void load();
    } finally {
      setSubmitting(false);
    }
  }

  async function waitJob(id: string) {
    for (let i = 0; i * POLL_INTERVAL_MS < POLL_TIMEOUT_MS; i++) {
      const res = await fetch(`${BASE}/admin/data-jobs/${id}`, {
        headers: { Authorization: `Bearer ${getToken() || ''}` },
      });
      const job = (await res.json()) as DataJob;
      if (job.status === 'COMPLETED') return job;
      if (job.status === 'FAILED') throw new Error(job.error_message || '数据任务失败');
      await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));
    }
    throw new Error('任务仍在处理中，请稍后重试');
  }
  async function importExcel(file?: File) {
    if (!file) return;
    setBusy('import');
    try {
      const job = await uploadFile<DataJob>('/admin/data-jobs/import', file);
      setMessage('正在导入…');
      const done = await waitJob(job.id);
      setMessage(
        `导入完成：新增 ${done.summary.created || 0}，更新 ${done.summary.updated || 0}，失败 ${done.summary.skipped || 0}`,
      );
      if (done.output_key)
        await downloadFile(`/admin/data-jobs/${job.id}/download`, '人才导入错误.xlsx');
      void load();
    } catch (e) {
      setMessage((e as Error).message);
    } finally {
      setBusy('');
    }
  }
  async function exportExcel() {
    setBusy('export');
    try {
      const qs = new URLSearchParams(clean({ ...filters, scope, page: '', page_size: '' }));
      const res = await fetch(`${BASE}/admin/data-jobs/export?${qs}`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${getToken() || ''}` },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || '导出失败');
      setMessage('正在导出当前筛选…');
      await waitJob(data.id);
      await downloadFile(`/admin/data-jobs/${data.id}/download`, '人才库-当前筛选.xlsx');
      setMessage('当前筛选结果导出完成');
    } catch (e) {
      setMessage((e as Error).message);
    } finally {
      setBusy('');
    }
  }

  const set = (key: string, value: string) => setFilters({ ...filters, [key]: value, page: '1' });
  const switchScope = (s: string) => {
    setScope(s);
    void load({ scope: s, page: '1' });
  };
  const totalPages = Math.max(1, Math.ceil(page.total / page.page_size));
  const selectedTags = new Set(filters.tag_ids.split(',').filter(Boolean));
  const toggleTag = (id: string) => {
    const next = new Set(selectedTags);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    set('tag_ids', [...next].join(','));
  };

  // For the pool, selection is by candidate id; for the directory, by application id.
  const rowKey = (t: Talent) => (isPool ? t.id : t.latest_application?.id ?? '');
  const toggleRow = (t: Talent) => {
    const k = rowKey(t);
    if (!k) return;
    setSelected(selected.includes(k) ? selected.filter((x) => x !== k) : [...selected, k]);
  };

  return (
    <div className="page">
      {isPool && (
        <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
          <button
            className={scope === 'pool' ? 'btn btn-primary' : 'btn'}
            onClick={() => switchScope('pool')}
          >
            在池人才
          </button>
          <button
            className={scope === 'archived' ? 'btn btn-primary' : 'btn'}
            onClick={() => switchScope('archived')}
          >
            已归档
          </button>
        </div>
      )}

      <div className="filters v2-filters">
        <input className="input" placeholder="姓名" value={filters.name} onChange={(e) => set('name', e.target.value)} />
        <input className="input" placeholder="手机号" value={filters.phone} onChange={(e) => set('phone', e.target.value)} />
        <input className="input" placeholder="技能（逗号分隔，全部匹配）" value={filters.skills} onChange={(e) => set('skills', e.target.value)} />
        <input className="input" type="number" min="0" placeholder="最少工作年限" value={filters.min_years} onChange={(e) => set('min_years', e.target.value)} />
        <input className="input" type="number" min="0" placeholder="最多工作年限" value={filters.max_years} onChange={(e) => set('max_years', e.target.value)} />
        <select className="input" value={filters.source_channel_id} onChange={(e) => set('source_channel_id', e.target.value)}>
          <option value="">全部来源</option>
          {sources.map((s) => (
            <option key={s.id} value={s.id}>{s.name}</option>
          ))}
        </select>
        <select className="input" value={filters.owner_id} onChange={(e) => set('owner_id', e.target.value)}>
          <option value="">全部负责人</option>
          {owners.map((x) => (
            <option key={x.id} value={x.id}>{x.name}</option>
          ))}
        </select>
        <select className="input" value={filters.job_id} onChange={(e) => set('job_id', e.target.value)}>
          <option value="">全部岗位</option>
          {jobs.map((x) => (
            <option key={x.id} value={x.id}>{x.title}</option>
          ))}
        </select>
        {isPool ? (
          <select className="input" value={filters.reject_stage} onChange={(e) => set('reject_stage', e.target.value)}>
            <option value="">全部拒绝阶段</option>
            {Object.entries(REJECT_STAGE_LABELS).map(([k, v]) => (
              <option key={k} value={k}>{v}</option>
            ))}
          </select>
        ) : (
          <select className="input" value={filters.stage} onChange={(e) => set('stage', e.target.value)}>
            <option value="">全部阶段</option>
            {Object.entries(stageLabels).map(([k, v]) => (
              <option key={k} value={k}>{v}</option>
            ))}
          </select>
        )}
        <button className="btn btn-primary" onClick={() => load({ page: '1' })}>组合搜索</button>
        <button
          className="btn"
          onClick={() =>
            void load({
              name: '', phone: '', skills: '', tag_ids: '', source_channel_id: '', owner_id: '',
              job_id: '', stage: '', reject_stage: '', min_years: '', max_years: '', page: '1', page_size: '20',
            })
          }
        >
          清空
        </button>
      </div>

      <div className="tag-filter">
        <span>标签（多选且全部匹配）</span>
        {tags.filter((x) => x.enabled).map((x) => (
          <label className={selectedTags.has(x.id) ? 'tag-option selected' : 'tag-option'} key={x.id}>
            <input type="checkbox" checked={selectedTags.has(x.id)} onChange={() => toggleTag(x.id)} />
            {x.name}
          </label>
        ))}
      </div>

      <div className="toolbar">
        {isPool && scope === 'pool' && (
          <>
            <button className="btn" onClick={() => openReactivate(selected)}>批量加入岗位</button>
            <button className="btn btn-danger" onClick={removeSelected}>批量移出人才库</button>
          </>
        )}
        {isPool && scope === 'archived' && (
          <button className="btn" onClick={restoreSelected}>批量恢复</button>
        )}
        {!isPool && (
          <>
            <button className="btn" onClick={() => bulkDirectory('ADVANCE')}>批量推进</button>
            <button className="btn btn-danger" onClick={() => bulkDirectory('REJECT')}>批量拒绝</button>
            <button className="btn" onClick={() => bulkDirectory('NOTIFY')}>批量通知</button>
          </>
        )}
        <button className="btn" onClick={exportExcel}>导出当前筛选</button>
      </div>

      {message && <div className="alert">{message}</div>}

      <div className="table-wrap">
        <table className="table">
          <thead>
            <tr>
              <th></th>
              <th>姓名</th>
              <th>联系方式</th>
              <th>技能/标签</th>
              <th>来源</th>
              <th>负责人</th>
              {isPool ? (
                <>
                  <th>拒绝阶段</th>
                  <th>拒绝原因</th>
                  <th>进入人才库</th>
                  <th>操作</th>
                </>
              ) : (
                <th>最近流程</th>
              )}
            </tr>
          </thead>
          <tbody>
            {page.items.map((t: Talent) => {
              const k = rowKey(t);
              const disabled = !isPool && !t.latest_application;
              return (
                <tr key={t.id}>
                  <td>
                    <input
                      type="checkbox"
                      disabled={disabled}
                      title={disabled ? '无在投流程，无法批量操作' : ''}
                      checked={!!k && selected.includes(k)}
                      onChange={() => toggleRow(t)}
                    />
                  </td>
                  <td
                    onClick={() => { setActiveInitial(t); setActiveId(t.id); }}
                    style={{ cursor: 'pointer' }}
                  >
                    <b>{t.name}</b>
                    <div className="muted compact">{t.years_experience} 年经验 · {t.city}</div>
                  </td>
                  <td>
                    {t.phone}
                    <div>{t.contact_email}</div>
                  </td>
                  <td>
                    {t.skills.join('、')}
                    <div>
                      {t.tags.map((x) => (
                        <span className="tag" style={{ borderColor: x.color }} key={x.id}>{x.name}</span>
                      ))}
                    </div>
                  </td>
                  <td>{t.source_name || '未设置'}</td>
                  <td>{t.owner_name || '未分配'}</td>
                  {isPool ? (
                    <>
                      <td>{t.pool_entered_from_stage ? (REJECT_STAGE_LABELS[t.pool_entered_from_stage] ?? t.pool_entered_from_stage) : '—'}</td>
                      <td style={{ maxWidth: 240 }}>{t.pool_reject_reason || '—'}</td>
                      <td>{t.pool_entered_at ? new Date(t.pool_entered_at).toLocaleString('zh-CN', { hour12: false }) : '—'}</td>
                      <td>
                        <button className="btn btn-link" onClick={() => { setActiveInitial(t); setActiveId(t.id); }}>查看</button>
                        {scope === 'pool' && (
                          <>
                            <button className="btn btn-link" onClick={() => openReactivate([t.id])}>加入岗位</button>
                            <button className="btn btn-link" style={{ color: '#e2553f' }} onClick={() => { setSelected([t.id]); void removeSelected(); }}>移出</button>
                          </>
                        )}
                        {scope === 'archived' && (
                          <button className="btn btn-link" onClick={() => { setSelected([t.id]); void restoreSelected(); }}>恢复</button>
                        )}
                      </td>
                    </>
                  ) : (
                    <td>
                      {t.latest_application ? (
                        <>
                          {t.latest_application.job_title}
                          <div className="muted compact">
                            {stageLabels[t.latest_application.stage] || t.latest_application.stage}
                          </div>
                        </>
                      ) : (
                        '尚无申请'
                      )}
                    </td>
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="pagination">
        <button className="btn" disabled={page.page <= 1} onClick={() => load({ page: String(page.page - 1) })}>上一页</button>
        <span>第 {page.page} / {totalPages} 页</span>
        <button className="btn" disabled={page.page >= totalPages} onClick={() => load({ page: String(page.page + 1) })}>下一页</button>
        <select className="input" value={filters.page_size} onChange={(e) => load({ page: '1', page_size: e.target.value })}>
          <option value="20">20 条/页</option>
          <option value="50">50 条/页</option>
          <option value="100">100 条/页</option>
        </select>
      </div>

      {activeId && (
        <TalentDetailDrawer
          talentId={activeId}
          initial={activeInitial}
          onClose={() => setActiveId(null)}
          onChanged={() => load()}
        />
      )}

      {reasonOpen && (
        <ReasonModal
          open
          title={reasonOpen.action === 'REJECT' ? '填写拒绝原因' : '填写通知正文'}
          placeholder={reasonOpen.action === 'REJECT' ? '请输入拒绝原因' : '请输入通知正文'}
          confirmText={reasonOpen.action === 'REJECT' ? '确认拒绝' : '发送通知'}
          multiline={reasonOpen.action === 'NOTIFY'}
          submitting={submitting}
          onConfirm={(text) => runBulk(reasonOpen.action, text)}
          onCancel={() => setReasonOpen(null)}
        />
      )}

      <ReactivateModal
        open={reactOpen}
        jobs={jobs}
        submitting={submitting}
        onCancel={() => setReactOpen(false)}
        onConfirm={confirmReactivate}
      />

      {busy && (
        <div
          style={{
            position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.35)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1100,
          }}
        >
          <div style={{ background: 'var(--surface, #fff)', color: 'var(--ink, #1a1c21)', padding: '18px 24px', borderRadius: 12, boxShadow: '0 8px 30px rgba(0,0,0,0.2)', fontWeight: 600 }}>
            正在{busy === 'import' ? '导入' : '导出'}人才数据…（后台处理中，请稍候）
          </div>
        </div>
      )}
    </div>
  );
}
