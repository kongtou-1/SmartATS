import { useMemo } from 'react';
import type { AdminApplication, Job, Stage } from '../../types';

// Stage mapping for the matrix row:
//   简历初筛 = APPLIED + SCREENING（投递阶段统一并到这里）
//   专业初试 = FIRST_INTERVIEW
//   技术复试 = SECOND_INTERVIEW
//   HR终面 = FINAL_REVIEW
//   Offer发放 = （暂无独立 stage，留空列占位）
//   面试通过 = HIRED
//
// "在途候选人" = 处在流程中（非 REJECTED / WITHDRAWN / HIRED）的活跃候选人。

interface Col {
  key: string;
  label: string;
  stages: Stage[];
}

const MATRIX_COLUMNS: Col[] = [
  { key: 'SCREEN', label: '简历初筛', stages: ['APPLIED', 'SCREENING'] },
  { key: 'PASSED', label: '初筛通过', stages: ['SCREENING_PASSED'] },
  { key: 'PRO', label: '专业初试', stages: ['FIRST_INTERVIEW'] },
  { key: 'TECH', label: '技术复试', stages: ['SECOND_INTERVIEW'] },
  { key: 'HR', label: 'HR终面', stages: ['FINAL_REVIEW'] },
  { key: 'OFFER', label: 'Offer发放', stages: [] },
  { key: 'HIRED', label: '面试通过', stages: ['HIRED'] },
];

interface MatrixViewProps {
  apps: AdminApplication[];
  jobs: Job[];
  onSelect?: (a: AdminApplication) => void;
}

function scoreClass(s: number | null): 'hi' | 'mid' | 'lo' | 'none' {
  if (s === null) return 'none';
  if (s >= 80) return 'hi';
  if (s >= 60) return 'mid';
  return 'lo';
}

function brandOf(job: Job): { letter: string; tone: string } {
  const map: Record<string, { letter: string; tone: string }> = {
    研发中心: { letter: '研', tone: 'brand-indigo' },
    产品设计: { letter: '设', tone: 'brand-rose' },
    市场营销: { letter: '市', tone: 'brand-orange' },
    人力资源: { letter: '人', tone: 'brand-teal' },
    财务管理: { letter: '财', tone: 'brand-green' },
    运营支持: { letter: '运', tone: 'brand-amber' },
  };
  return map[job.department || ''] ?? { letter: (job.title || '?').slice(0, 1), tone: 'brand-indigo' };
}

interface OwnerInfo {
  name: string;
  tag: string;
}
function ownerOf(job: Job): OwnerInfo {
  // 占位文案：实际可接 hr.users 接口查询 created_by 对应的姓名/职级。
  // 这里按部门给出合理的兜底。
  if (job.department === '研发中心') return { name: '张晨', tag: '前端技术专家' };
  if (job.department === '产品设计') return { name: '李宇', tag: '高级设计师' };
  if (job.department === '人力资源') return { name: '顾琳', tag: 'HR 负责人' };
  if (job.department === '市场营销') return { name: '苏婉', tag: '市场负责人' };
  return { name: 'HR 团队', tag: '招聘' };
}

function inPipeline(a: AdminApplication): boolean {
  return a.status === 'ACTIVE';
}

export default function MatrixView({ apps, jobs, onSelect }: MatrixViewProps) {
  // 仅显示有投递的岗位，按候选人数量排序
  const jobVolume = new Map<string, number>();
  for (const a of apps) jobVolume.set(a.job_id, (jobVolume.get(a.job_id) ?? 0) + 1);
  const sortedJobs = useMemo(
    () =>
      [...jobs]
        .filter((j) => jobVolume.get(j.id))
        .sort((a, b) => (jobVolume.get(b.id) ?? 0) - (jobVolume.get(a.id) ?? 0))
        .slice(0, 6),
    [jobs, apps],
  );

  // 索引 (job_id + columnKey) → 候选人
  const cellMap = useMemo(() => {
    const m = new Map<string, AdminApplication[]>();
    for (const a of apps) {
      for (const col of MATRIX_COLUMNS) {
        if (col.stages.includes(a.current_stage)) {
          const k = `${a.job_id}::${col.key}`;
          const arr = m.get(k) ?? [];
          arr.push(a);
          m.set(k, arr);
        }
      }
    }
    return m;
  }, [apps]);

  if (sortedJobs.length === 0) {
    return (
      <div className="empty">
        <b>暂无岗位矩阵数据</b>
        当有候选人投递时，每个岗位的 6 阶段分布会按卡片列出。
      </div>
    );
  }

  return (
    <div className="matrix2-list">
      {sortedJobs.map((job) => {
        const brand = brandOf(job);
        const owner = ownerOf(job);
        const inFlight = apps.filter((a) => a.job_id === job.id && inPipeline(a)).length;
        const subParts: string[] = [];
        if (job.department) subParts.push(job.department);
        if (job.location) subParts.push(job.location);
        if (job.headcount) subParts.push(`编制HC：${job.headcount}人`);
        const subtitle = subParts.join(' · ');
        return (
          <div key={job.id} className="card-2xl matrix2-job-card">
            <div className="matrix2-job-head">
              <div className={`matrix2-brand ${brand.tone}`}>{brand.letter}</div>
              <div className="matrix2-job-title-wrap">
                <div className="matrix2-job-title">{job.title}</div>
                <div className="matrix2-job-sub">
                  {subtitle}
                  <span className="matrix2-owner">
                    {' · 负责人：'}
                    {owner.name}
                    <span className="muted">（{owner.tag}）</span>
                  </span>
                </div>
              </div>
              <div className="matrix2-inflight">
                在途候选人 <span className="matrix2-inflight-num">{inFlight}</span> 位
              </div>
            </div>
            <div className="matrix2-cols">
              {MATRIX_COLUMNS.map((col) => {
                const list = cellMap.get(`${job.id}::${col.key}`) ?? [];
                const hasPeople = list.length > 0;
                const isOfferCol = col.key === 'OFFER';
                return (
                  <div
                    key={col.key}
                    className={`matrix2-col-card ${hasPeople ? 'has-people' : ''} ${
                      isOfferCol && !hasPeople ? 'is-empty' : ''
                    }`}
                  >
                    <div className="matrix2-col-head">
                      <span className="matrix2-col-label">{col.label}</span>
                    </div>
                    <div className="matrix2-col-num">
                      <span className="matrix2-col-count">{list.length}</span>
                      <span className="matrix2-col-unit">人</span>
                    </div>
                    <div className="matrix2-col-people">
                      {list.length === 0 ? (
                        <span className="matrix2-col-empty">—</span>
                      ) : (
                        list.slice(0, 4).map((a) => {
                          const tone = scoreClass(a.ai_score);
                          return (
                            <button
                              type="button"
                              key={a.id}
                              className={`matrix2-person tone-${tone}`}
                              onClick={() => onSelect?.(a)}
                              title={`${a.candidate_name} · ${a.ai_score ?? '-'}% · ${job.title}`}
                            >
                              {a.candidate_name}
                            </button>
                          );
                        })
                      )}
                      {list.length > 4 ? (
                        <span className="matrix2-person-more">+{list.length - 4}</span>
                      ) : null}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}
