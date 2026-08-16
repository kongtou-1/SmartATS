import { useEffect, useState } from 'react';
import { Sparkles, X, Layers, DollarSign, FileText } from 'lucide-react';
import { api } from '../lib/client';
import type { JobCategory, JobInput, JobType, JobWithStats } from '../types';
import {
  JOB_TYPE_LABELS,
  EXPERIENCE_OPTIONS,
  EDUCATION_OPTIONS,
  URGENCY_OPTIONS,
  DEPARTMENT_OPTIONS,
} from '../types';

interface Props {
  open: boolean;
  /** null = 新建岗位 */
  job: JobWithStats | null;
  onClose: () => void;
  onSaved: (job: JobWithStats) => void;
}

interface FormState {
  title: string;
  location: string;
  category_code: string;
  job_type: JobType;
  headcount: number;
  salaryMode: 'range' | 'negotiable';
  salary_min_k: string;
  salary_max_k: string;
  description: string;
  requirements: string;
  department: string;
  experience_req: string;
  education_req: string;
  urgency: 'HIGH' | 'MEDIUM' | 'LOW';
}

const JOB_TYPE_OPTIONS: JobType[] = ['INTERN', 'SOCIAL', 'CAMPUS'];

function emptyForm(): FormState {
  return {
    title: '',
    location: '',
    category_code: '',
    job_type: 'SOCIAL',
    headcount: 1,
    salaryMode: 'range',
    salary_min_k: '',
    salary_max_k: '',
    description: '',
    requirements: '',
    department: DEPARTMENT_OPTIONS[0] || '研发中心',
    experience_req: '',
    education_req: '',
    urgency: 'MEDIUM',
  };
}

export default function JobEditModal({ open, job, onClose, onSaved }: Props) {
  const [form, setForm] = useState<FormState>(emptyForm);
  const [categories, setCategories] = useState<JobCategory[]>([]);
  const [saving, setSaving] = useState(false);
  const [jdNotice, setJdNotice] = useState('');

  // 打开时重置表单 + 拉取方向列表
  useEffect(() => {
    if (!open) return;
    if (job) {
      setForm({
        title: job.title,
        location: job.location,
        category_code: job.category_code || '',
        job_type: job.job_type,
        headcount: job.headcount ?? 1,
        salaryMode: job.salary_negotiable ? 'negotiable' : 'range',
        salary_min_k: job.salary_min_k != null ? String(job.salary_min_k) : '',
        salary_max_k: job.salary_max_k != null ? String(job.salary_max_k) : '',
        description: job.description,
        requirements: job.requirements,
        department: job.department || DEPARTMENT_OPTIONS[0] || '',
        experience_req: job.experience_req || '',
        education_req: job.education_req || '',
        urgency: (job.urgency as FormState['urgency']) || 'MEDIUM',
      });
    } else {
      setForm(emptyForm());
    }
    setJdNotice('');
    api
      .listJobCategories()
      .then(setCategories)
      .catch(() => setCategories([]));
  }, [open, job]);

  // ESC 关闭 + 锁定背景滚动
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !saving) onClose();
    };
    document.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [open, saving, onClose]);

  if (!open) return null;

  // 构建方向显示文本（父/子）
  function categoryLabel(code: string): string {
    if (!code) return '';
    const cat = categories.find((c) => c.code === code);
    if (!cat) return code;
    if (cat.parent_code) {
      const parent = categories.find((p) => p.code === cat.parent_code);
      return parent ? `${parent.name} / ${cat.name}` : cat.name;
    }
    return cat.name;
  }

  const leafCategories = categories.filter((c) => c.parent_code);

  function set<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  function handleSmartJd() {
    setJdNotice('智能补全 JD 功能开发中，敬请期待');
    window.setTimeout(() => setJdNotice(''), 2600);
  }

  async function handleSave(publish = false) {
    if (!form.title.trim()) {
      window.alert('请填写岗位名称');
      return;
    }
    setSaving(true);
    try {
      const payload: JobInput = {
        title: form.title.trim(),
        location: form.location.trim(),
        category_code: form.category_code || undefined,
        job_type: form.job_type,
        headcount: Number(form.headcount) || 1,
        salary_negotiable: form.salaryMode === 'negotiable',
        salary_min_k:
          form.salaryMode === 'range' && form.salary_min_k !== ''
            ? Number(form.salary_min_k)
            : null,
        salary_max_k:
          form.salaryMode === 'range' && form.salary_max_k !== ''
            ? Number(form.salary_max_k)
            : null,
        description: form.description,
        requirements: form.requirements,
        department: form.department,
        experience_req: form.experience_req || undefined,
        education_req: form.education_req || undefined,
        urgency: form.urgency,
      };
      let saved;
      if (job) {
        saved = await api.adminUpdateJob(job.id, payload);
      } else {
        saved = await api.adminCreateJob(payload);
      }
      // 如果点击"立即发布"且当前是草稿，调用 publish
      if (publish && saved.status === 'DRAFT') {
        saved = await api.adminPublishJob(saved.id);
      }
      onSaved(saved);
    } catch (err) {
      window.alert((err as Error).message || '保存失败');
    } finally {
      setSaving(false);
    }
  }

  const isEdit = Boolean(job);

  return (
    <>
      <div className="modal-overlay" onClick={() => !saving && onClose()} />
      <div className="modal" role="dialog" aria-modal="true" aria-label={isEdit ? '编辑招聘岗位' : '新建岗位'}>
        {/* ---- Header ---- */}
        <div className="modal-head" style={{ padding: '12px 22px' }}>
          <div className="modal-head-left">
            <h3 style={{ margin: 0, fontSize: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
              <Layers size={16} style={{ color: 'var(--primary-strong)' }} />
              编辑招聘岗位
            </h3>
          </div>
          <div className="modal-head-actions">
            <button type="button" className="btn-smart-jd" onClick={handleSmartJd}>
              <Sparkles size={13} /> 智能补全 JD
            </button>
            <button className="drawer-close" onClick={() => !saving && onClose()} title="关闭">
              <X size={18} />
            </button>
          </div>
        </div>

        {/* ---- Body: 3 Sections ---- */}
        <div className="modal-body">
          {/* Section 1: 基础信息 */}
          <div className="modal-section">
            <div className="modal-section-title">
              <span className="section-icon si-blue"><Layers size={11} /></span>
              基础信息
            </div>

            <div className="field" style={{ marginBottom: 14 }}>
              <span>岗位名称 <span style={{ color: 'var(--red)' }}>*</span></span>
              <input
                className="input"
                placeholder="例如：前端工程师"
                value={form.title}
                onChange={(e) => set('title', e.target.value)}
              />
            </div>

            <div className="form-grid" style={{ marginBottom: 14 }}>
              <div className="field">
                <span>所属部门</span>
                <select
                  className="input"
                  value={form.department}
                  onChange={(e) => set('department', e.target.value)}
                >
                  {DEPARTMENT_OPTIONS.map((d) => (
                    <option key={d} value={d}>{d}</option>
                  ))}
                </select>
              </div>
              <div className="field">
                <span>岗位方向 / 职类</span>
                <input
                  className="input"
                  placeholder="例如：技术研发 / Web前端"
                  value={form.category_code ? categoryLabel(form.category_code) : ''}
                  onChange={(e) => {
                    // 从显示名反查 code
                    const val = e.target.value;
                    const matched = leafCategories.find(
                      (c) => categoryLabel(c.code) === val
                    );
                    set('category_code', matched?.code ?? val);
                  }}
                  list="cat-datalist"
                />
                <datalist id="cat-datalist">
                  {leafCategories.map((c) => (
                    <option key={c.code} value={categoryLabel(c.code)} />
                  ))}
                </datalist>
              </div>
            </div>

            <div className="form-grid">
              <div className="field">
                <span>招聘类型</span>
                <select
                  className="input"
                  value={form.job_type}
                  onChange={(e) => set('job_type', e.target.value as JobType)}
                >
                  {JOB_TYPE_OPTIONS.map((t) => (
                    <option key={t} value={t}>{JOB_TYPE_LABELS[t]}</option>
                  ))}
                </select>
              </div>
              <div className="field">
                <span>工作地点</span>
                <input
                  className="input"
                  placeholder="例如：深圳"
                  value={form.location}
                  onChange={(e) => set('location', e.target.value)}
                />
              </div>
            </div>
          </div>

          {/* Section 2: 薪酬预算与用人要求 */}
          <div className="modal-section">
            <div className="modal-section-title">
              <span className="section-icon si-gold"><DollarSign size={11} /></span>
              薪酬预算与用人要求
            </div>

            <div className="field" style={{ marginBottom: 14 }}>
              <span>薪资区间（千元 / 月 & 薪数）</span>
              <div className="salary-range">
                <div className="salary-input">
                  <input
                    className="input"
                    type="number"
                    min={0}
                    placeholder="最低"
                    value={form.salary_min_k}
                    onChange={(e) => set('salary_min_k', e.target.value)}
                    disabled={form.salaryMode === 'negotiable'}
                  />
                  <span className="k">k</span>
                </div>
                <span className="salary-dash">~</span>
                <div className="salary-input">
                  <input
                    className="input"
                    type="number"
                    min={0}
                    placeholder="最高"
                    value={form.salary_max_k}
                    onChange={(e) => set('salary_max_k', e.target.value)}
                    disabled={form.salaryMode === 'negotiable'}
                  />
                  <span className="k">k</span>
                </div>
                <button
                  type="button"
                  className={`seg-btn${form.salaryMode === 'negotiable' ? ' active' : ''}`}
                  onClick={() => set('salaryMode', form.salaryMode === 'negotiable' ? 'range' : 'negotiable')}
                  style={{ marginLeft: 6, padding: '5px 10px', fontSize: 12, whiteSpace: 'nowrap' }}
                >
                  {form.salaryMode === 'negotiable' ? '面议' : '面议'}
                </button>
              </div>
            </div>

            <div className="form-grid" style={{ marginBottom: 0 }}>
              <div className="field">
                <span>招聘人数（HC）</span>
                <input
                  className="input"
                  type="number"
                  min={1}
                  value={form.headcount}
                  onChange={(e) => set('headcount', Number(e.target.value))}
                />
              </div>
              <div className="field">
                <span>经验要求</span>
                <select
                  className="input"
                  value={form.experience_req}
                  onChange={(e) => set('experience_req', e.target.value)}
                >
                  {EXPERIENCE_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
                </select>
              </div>
              <div className="field">
                <span>学历要求</span>
                <select
                  className="input"
                  value={form.education_req}
                  onChange={(e) => set('education_req', e.target.value)}
                >
                  {EDUCATION_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
                </select>
              </div>
              <div className="field">
                <span>招聘紧急度</span>
                <select
                  className="input"
                  value={form.urgency}
                  onChange={(e) => set('urgency', e.target.value as FormState['urgency'])}
                >
                  {URGENCY_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* Section 3: 岗位职责与任职要求 */}
          <div className="modal-section">
            <div className="modal-section-title">
              <span className="section-icon si-indigo"><FileText size={11} /></span>
              岗位职责与任职要求
            </div>

            <div className="field" style={{ marginBottom: 14 }}>
              <span>岗位描述 / 职责说明</span>
              <textarea
                className="input area"
                rows={4}
                placeholder="描述该岗位的核心职责、工作目标与团队情况"
                value={form.description}
                onChange={(e) => set('description', e.target.value)}
              />
            </div>

            <div className="field" style={{ marginBottom: 0 }}>
              <span>任职要求（每行一条要求）</span>
              <textarea
                className="input area"
                rows={4}
                placeholder={"熟练掌握 React 18+、TypeScript、Tailwind CSS 及现代前端工程化工具链\n具有复杂中后台或低代码平台架构经验者优先"}
                value={form.requirements}
                onChange={(e) => set('requirements', e.target.value)}
              />
              {jdNotice && <span className="jd-notice" style={{ marginTop: 6 }}>{jdNotice}</span>}
            </div>
          </div>
        </div>

        {/* ---- Footer ---- */}
        <div className="modal-foot">
          <span className="modal-meta">
            最后更新: {job ? new Date(job.updated_at).toLocaleString('zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' }) : '—'}
          </span>
          <div className="modal-foot-btns">
            <button className="btn" onClick={() => !saving && onClose()} disabled={saving}>
              取消
            </button>
            <button
              className="btn"
              onClick={() => handleSave(false)}
              disabled={saving}
              style={{ borderColor: 'var(--line)', color: 'var(--ink-2)' }}
            >
              {saving ? '保存中…' : '保存为草稿'}
            </button>
            <button
              className="btn btn-primary"
              onClick={() => handleSave(true)}
              disabled={saving}
            >
              {saving ? '发布中…' : '立即发布'}
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
