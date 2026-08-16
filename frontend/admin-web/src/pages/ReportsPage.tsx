import { useEffect, useMemo, useState } from 'react';
import { api } from '../lib/client';
import { downloadFile } from '../lib/api';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from 'recharts';
import type {
  ChannelReportRow,
  FunnelReport,
  JobCycleReportRow,
  WorkloadReportRow,
} from '../types';

export default function ReportsPage() {
  const [funnel, setFunnel] = useState<FunnelReport>({ total: 0, rejected: 0, stages: [] });
  const [workload, setWorkload] = useState<WorkloadReportRow[]>([]);
  const [channels, setChannels] = useState<ChannelReportRow[]>([]);
  const [cycles, setCycles] = useState<JobCycleReportRow[]>([]);

  useEffect(() => {
    api.report?.('funnel').then((r) => setFunnel(r ?? { total: 0, rejected: 0, stages: [] }));
    api.report?.('workload').then(setWorkload);
    api.report?.('channels').then((r) => setChannels(r ?? []));
    api.report?.('job-cycles').then((r) => setCycles(r ?? []));
  }, []);

  const sortedChannels = useMemo(
    () => [...channels].sort((a, b) => b.applications - a.applications),
    [channels],
  );
  const maxChannelApps = Math.max(1, ...channels.map((c) => c.applications));
  const funnelTotal = funnel.total > 0 ? funnel.total : funnel.stages.reduce((s, x) => s + x.count, 0);

  return (
    <div className="page">
      <div className="page-head">
        <div className="toolbar">
          <button className="btn" onClick={() => downloadFile('/admin/reports/funnel/export', '招聘漏斗.xlsx')}>
            导出漏斗
          </button>
          <button className="btn" onClick={() => downloadFile('/admin/reports/channels/export', '渠道效果.xlsx')}>
            导出渠道
          </button>
          <button className="btn" onClick={() => downloadFile('/admin/reports/workload/export', 'HR工作量.xlsx')}>
            导出工作量
          </button>
        </div>
      </div>

      <div className="report-grid">
        <section className="block">
          <h3>招聘漏斗转化全景</h3>
          {funnel.stages.length === 0 ? (
            <div className="empty">暂无数据</div>
          ) : (
            <div className="funnel">
              {funnel.stages.map((s) => {
                const denom = funnelTotal > 0 ? funnelTotal : 1;
                const pct = s.count / denom;
                const widthPct = Math.max(2, pct * 100);
                return (
                  <div
                    className="funnel-row"
                    key={s.stage}
                    title={s.average_hours ? `平均停留 ${s.average_hours} 小时` : undefined}
                  >
                    <span className="funnel-label">{s.display_label}</span>
                    <span className="funnel-track" aria-hidden>
                      <span className="funnel-bar" style={{ width: `${widthPct}%` }} />
                    </span>
                    <span className="funnel-count">
                      <b>{s.count}</b> 人
                      <em style={{ color: 'var(--muted)', fontStyle: 'normal', marginLeft: 6 }}>
                        ({(pct * 100).toFixed(1)}%)
                      </em>
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </section>

        <section className="block">
          <h3>渠道贡献与转化 ROI</h3>
          {sortedChannels.length === 0 ? (
            <div className="empty">暂无数据</div>
          ) : (
            <div className="funnel">
              {sortedChannels.map((c) => {
                const w = c.applications / maxChannelApps;
                const widthPct = Math.max(2, w * 100);
                return (
                  <div
                    className="funnel-row"
                    key={c.code}
                    title={`投递 ${c.applications} 份 · 面试 ${c.interviewed} · Offer ${c.offers_sent} · 录用 ${c.offers_accepted}`}
                  >
                    <span className="funnel-label">{c.name}</span>
                    <span className="funnel-track" aria-hidden>
                      <span className="funnel-bar" style={{ width: `${widthPct}%` }} />
                    </span>
                    <span className="funnel-count funnel-count--detail">
                      投递 <b>{c.applications}</b> 份 · 录用 <b>{c.offers_accepted}</b> 人
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </section>

        <section className="block">
          <h3>HR 工作量</h3>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={workload}>
              <CartesianGrid strokeDasharray="3 3" stroke="#eef0f4" />
              <XAxis dataKey="name" tick={{ fill: '#7a828f', fontSize: 12 }} />
              <YAxis tick={{ fill: '#7a828f', fontSize: 12 }} />
              <Tooltip
                contentStyle={{
                  borderRadius: 10,
                  border: '1px solid #e9ebef',
                  boxShadow: '0 8px 24px rgba(20,23,33,0.08)',
                  fontSize: 12,
                }}
              />
              <Bar dataKey="stage_actions" fill="#2563eb" name="阶段操作" radius={[4, 4, 0, 0]} />
              <Bar dataKey="interviews" fill="#0ea5e9" name="面试" radius={[4, 4, 0, 0]} />
              <Bar dataKey="offers" fill="#f59e0b" name="Offer" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </section>

        <section className="block">
          <h3>岗位招聘周期</h3>
          <table className="table">
            <thead>
              <tr>
                <th>岗位</th>
                <th>周期</th>
                <th>状态</th>
              </tr>
            </thead>
            <tbody>
              {cycles.map((x) => (
                <tr key={x.job_id}>
                  <td>{x.job_title}</td>
                  <td>{x.days} 天</td>
                  <td>{x.status}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      </div>
    </div>
  );
}
