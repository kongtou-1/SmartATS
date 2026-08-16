import { useEffect, useState } from 'react';
import {
  X,
  Plus,
  Trash2,
  MessageSquare,
  User,
  Phone,
  Mail,
  MapPin,
  Briefcase,
  Clock,
  Tag as TagIcon,
} from 'lucide-react';
import ReactivateModal from './ReactivateModal';
import { api } from '../lib/client';
import type { Talent, TalentNote, Communication, Tag, Job } from '../types';
import { STAGE_LABELS, REJECT_STAGE_LABELS } from '../types';

type TabKey = 'overview' | 'tags' | 'notes' | 'comms';

interface Props {
  talentId: string | null;
  initial?: Talent | null;
  onClose: () => void;
  onChanged?: () => void;
}

function fmtDateTime(s?: string | null): string {
  if (!s) return '—';
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) return s;
  return d.toLocaleString('zh-CN', { hour12: false });
}

/** 把当前 Talent 映射成后端 TalentIn 字段，避免调用 updateTalent 时漏字段导致技能/标签被清空 */
function toTalentIn(
  t: Talent,
  overrides: Partial<{ skills: string[]; tag_ids: string[] }>,
): Partial<Talent> & { name: string; tag_ids?: string[] } {
  return {
    name: t.name,
    phone: t.phone,
    contact_email: t.contact_email,
    city: t.city,
    years_experience: t.years_experience,
    source_channel_id: t.source_channel_id,
    owner_id: t.owner_id,
    skills: overrides.skills ?? t.skills,
    tag_ids: overrides.tag_ids ?? t.tags.map((x) => x.id),
  };
}

export default function TalentDetailDrawer({ talentId, initial, onClose, onChanged }: Props) {
  const [talent, setTalent] = useState<Talent | null>(initial ?? null);
  const [notes, setNotes] = useState<TalentNote[]>([]);
  const [comms, setComms] = useState<Communication[]>([]);
  const [allTags, setAllTags] = useState<Tag[]>([]);
  const [tab, setTab] = useState<TabKey>('overview');
  const [loading, setLoading] = useState(false);
  const [loadingNotes, setLoadingNotes] = useState(false);
  const [loadingComms, setLoadingComms] = useState(false);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [newNote, setNewNote] = useState('');
  const [skillDraft, setSkillDraft] = useState('');
  const [jobs, setJobs] = useState<Job[]>([]);
  const [reactOpen, setReactOpen] = useState(false);
  const [reactSubmitting, setReactSubmitting] = useState(false);

  /* 并行懒加载（秒开：先用行数据 initial 即时渲染，再后台刷新真值） */
  useEffect(() => {
    if (!talentId) return;
    let cancelled = false;
    setTab('overview');
    setTalent(initial ?? null);
    setError('');
    setLoading(true);
    setLoadingNotes(true);
    setLoadingComms(true);

    api
      .getTalent!(talentId)
      .then((t) => !cancelled && setTalent(t as Talent))
      .catch(() => {})
      .finally(() => !cancelled && setLoading(false));

    api
      .listTalentNotes!(talentId)
      .then((n) => !cancelled && setNotes(n as TalentNote[]))
      .catch(() => !cancelled && setNotes([]))
      .finally(() => !cancelled && setLoadingNotes(false));

    api
      .communications!(talentId)
      .then((c) => !cancelled && setComms(c as Communication[]))
      .catch(() => !cancelled && setComms([]))
      .finally(() => !cancelled && setLoadingComms(false));

    api
      .listTags!()
      .then((tg) => !cancelled && setAllTags(tg as Tag[]))
      .catch(() => {});

    api
      .adminListJobs!()
      .then((j) => !cancelled && setJobs(j as Job[]))
      .catch(() => {});

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [talentId]);

  /* ESC close + 锁定 body 滚动 */
  useEffect(() => {
    function handler(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    document.addEventListener('keydown', handler);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', handler);
      document.body.style.overflow = '';
    };
  }, [onClose]);

  if (!talentId) return null;

  const t = talent;

  async function removeTag(tagId: string) {
    if (!t) return;
    setSaving(true);
    setError('');
    try {
      const remaining = t.tags.filter((x) => x.id !== tagId).map((x) => x.id);
      const updated = (await api.updateTalent!(t.id, toTalentIn(t, { tag_ids: remaining }))) as Talent;
      setTalent(updated);
      onChanged?.();
    } catch (e) {
      setError(e instanceof Error ? e.message : '移除标签失败');
    } finally {
      setSaving(false);
    }
  }

  async function addTag(tagId: string) {
    if (!t || !tagId) return;
    setSaving(true);
    setError('');
    try {
      const updated = (await api.adminAddCandidateTag!(t.id, tagId)) as unknown as Talent;
      setTalent(updated);
      onChanged?.();
    } catch (e) {
      setError(e instanceof Error ? e.message : '添加标签失败');
    } finally {
      setSaving(false);
    }
  }

  async function saveSkills() {
    if (!t) return;
    const skills = skillDraft
      .split(/[,，]/)
      .map((s) => s.trim())
      .filter(Boolean);
    setSaving(true);
    setError('');
    try {
      const updated = (await api.updateTalent!(t.id, toTalentIn(t, { skills }))) as Talent;
      setTalent(updated);
      setSkillDraft('');
      onChanged?.();
    } catch (e) {
      setError(e instanceof Error ? e.message : '保存技能失败');
    } finally {
      setSaving(false);
    }
  }

  async function submitNote() {
    if (!t || !newNote.trim()) return;
    setSaving(true);
    setError('');
    try {
      await api.addTalentNote!(t.id, newNote.trim());
      setNewNote('');
      const n = (await api.listTalentNotes!(t.id)) as TalentNote[];
      setNotes(n);
      onChanged?.();
    } catch (e) {
      setError(e instanceof Error ? e.message : '备注保存失败');
    } finally {
      setSaving(false);
    }
  }

  const availableTags = allTags.filter((tg) => tg.enabled && !t?.tags.some((x) => x.id === tg.id));
  const name = t?.name || '—';
  const firstChar = name.charAt(0).toUpperCase();

  async function removeFromPool() {
    if (!t) return;
    if (!window.confirm(`确认将「${t.name}」移出人才库（可恢复）？`)) return;
    setSaving(true);
    setError('');
    try {
      await api.deleteTalent!(t.id);
      onChanged?.();
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : '移出人才库失败');
    } finally {
      setSaving(false);
    }
  }

  async function confirmReactivate(jobId: string, note: string) {
    if (!t || !jobId) return;
    setReactSubmitting(true);
    setError('');
    try {
      await api.reactivateTalent!(t.id, { job_id: jobId, note: note || null });
      setReactOpen(false);
      onChanged?.();
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : '加入岗位失败');
    } finally {
      setReactSubmitting(false);
    }
  }

  const TABS: { key: TabKey; label: string; count?: number }[] = [
    { key: 'overview', label: '概览' },
    { key: 'tags', label: '技能与标签', count: t?.skills.length },
    { key: 'notes', label: '备注', count: notes.length },
    { key: 'comms', label: '沟通记录', count: comms.length },
  ];

  return (
    <>
      <div className="modal-overlay" onClick={onClose} />
      <div
        className="modal"
        role="dialog"
        aria-label="人才详情"
        style={{ width: 760, maxWidth: 'calc(100vw - 32px)' }}
      >
        <div className="cd-header">
          <div className="cd-avatar">{firstChar}</div>
          <div className="cd-header-info">
            <div className="cd-name-row">
              <span className="cd-name">{name}</span>
              {t?.latest_application?.stage && (
                <span className="cd-badge cd-badge-exp">
                  {STAGE_LABELS[t.latest_application.stage] ?? t.latest_application.stage}
                </span>
              )}
            </div>
            <div className="cd-position">
              {t?.latest_application?.job_title
                ? `最近流程：${t.latest_application.job_title}`
                : '暂无在投流程'}
            </div>
          </div>
          <button className="cd-close" onClick={onClose} title="关闭">
            <X size={18} />
          </button>
        </div>

        <div className="cd-tabs" role="tablist" aria-label="人才信息分类">
          {TABS.map((tb) => (
            <button
              key={tb.key}
              type="button"
              role="tab"
              aria-selected={tab === tb.key}
              className={`cd-tab${tab === tb.key ? ' active' : ''}`}
              onClick={() => setTab(tb.key)}
            >
              {tb.label}
              {tb.count !== undefined && tb.count > 0 && (
                <span className="cd-tab-count">{tb.count}</span>
              )}
            </button>
          ))}
        </div>

        <div className="cd-body">
          {error && <div className="cd-inline-error">{error}</div>}

          {!t && loading && <div className="cd-loading">加载中…</div>}
          {!t && !loading && <div className="cd-empty">未找到该人才</div>}

          {/* ============ 概览 ============ */}
          {tab === 'overview' && t && (
            <section className="cd-section">
              <h4 className="cd-section-title">基本背景信息</h4>
              <div className="cd-grid">
                <div className="cd-field">
                  <span className="cd-field-label"><Phone size={13} /> 联系电话</span>
                  <span className="cd-field-value">{t.phone || '—'}</span>
                </div>
                <div className="cd-field">
                  <span className="cd-field-label"><Mail size={13} /> 电子邮箱</span>
                  <span className="cd-field-value cd-email">{t.contact_email || '—'}</span>
                </div>
                <div className="cd-field">
                  <span className="cd-field-label"><MapPin size={13} /> 城市</span>
                  <span className="cd-field-value">{t.city || '—'}</span>
                </div>
                <div className="cd-field">
                  <span className="cd-field-label"><Briefcase size={13} /> 工作年限</span>
                  <span className="cd-field-value">{t.years_experience} 年</span>
                </div>
                <div className="cd-field">
                  <span className="cd-field-label"><User size={13} /> 负责人</span>
                  <span className="cd-field-value">{t.owner_name || '—'}</span>
                </div>
                <div className="cd-field">
                  <span className="cd-field-label"><TagIcon size={13} /> 来源渠道</span>
                  <span className="cd-field-value">{t.source_name || '—'}</span>
                </div>
              </div>

              <h4 className="cd-section-title" style={{ marginTop: 16 }}>人才库状态</h4>
              <div className="cd-grid">
                <div className="cd-field">
                  <span className="cd-field-label">是否在池</span>
                  <span className="cd-field-value">{t.in_talent_pool ? '是（曾被拒）' : '否'}</span>
                </div>
                <div className="cd-field">
                  <span className="cd-field-label">拒绝阶段</span>
                  <span className="cd-field-value">
                    {t.pool_entered_from_stage ? (REJECT_STAGE_LABELS[t.pool_entered_from_stage] ?? t.pool_entered_from_stage) : '—'}
                  </span>
                </div>
                <div className="cd-field" style={{ gridColumn: '1 / -1' }}>
                  <span className="cd-field-label">拒绝原因</span>
                  <span className="cd-field-value">{t.pool_reject_reason || '—'}</span>
                </div>
                <div className="cd-field">
                  <span className="cd-field-label">进入人才库</span>
                  <span className="cd-field-value">{t.pool_entered_at ? fmtDateTime(t.pool_entered_at) : '—'}</span>
                </div>
              </div>
            </section>
          )}

          {/* ============ 技能与标签 ============ */}
          {tab === 'tags' && t && (
            <>
              <section className="cd-section">
                <h4 className="cd-section-title">技能</h4>
                {t.skills.length > 0 ? (
                  <div className="cd-tags">
                    {t.skills.map((s, i) => (
                      <span className="cd-tag" key={i}>{s}</span>
                    ))}
                  </div>
                ) : (
                  <div className="cd-empty">暂无技能信息</div>
                )}
                <div className="cd-inline-form">
                  <input
                    className="cd-input"
                    placeholder="编辑技能，逗号分隔"
                    value={skillDraft}
                    onChange={(e) => setSkillDraft(e.target.value)}
                  />
                  <button
                    type="button"
                    className="cd-btn cd-btn-outline"
                    onClick={saveSkills}
                    disabled={saving}
                  >
                    保存技能
                  </button>
                </div>
              </section>

              <section className="cd-section">
                <h4 className="cd-section-title">标签</h4>
                {t.tags.length > 0 ? (
                  <div className="cd-tags">
                    {t.tags.map((tg) => (
                      <span
                        className="cd-tag cd-tag-removable"
                        key={tg.id}
                        style={{ borderColor: tg.color, color: tg.color }}
                      >
                        {tg.name}
                        <button
                          type="button"
                          className="cd-tag-x"
                          title="移除标签"
                          onClick={() => removeTag(tg.id)}
                          disabled={saving}
                        >
                          <Trash2 size={12} />
                        </button>
                      </span>
                    ))}
                  </div>
                ) : (
                  <div className="cd-empty">暂无标签</div>
                )}
                <div className="cd-inline-form">
                  <select
                    className="cd-input"
                    value=""
                    onChange={(e) => {
                      if (e.target.value) addTag(e.target.value);
                    }}
                    disabled={saving || availableTags.length === 0}
                  >
                    <option value="">
                      {availableTags.length === 0 ? '暂无可添加标签' : '选择标签添加…'}
                    </option>
                    {availableTags.map((tg) => (
                      <option key={tg.id} value={tg.id}>
                        {tg.name}
                      </option>
                    ))}
                  </select>
                </div>
              </section>
            </>
          )}

          {/* ============ 备注 ============ */}
          {tab === 'notes' && (
            <section className="cd-section">
              <h4 className="cd-section-title">备注</h4>
              {loadingNotes && <div className="cd-loading">加载备注…</div>}
              {!loadingNotes && notes.length === 0 && <div className="cd-empty">暂无备注</div>}
              <div className="cd-rows">
                {notes.map((n) => (
                  <div className="cd-row" key={n.id}>
                    <div className="cd-row-head">
                      <b>{n.author_name || '—'}</b>
                      <span className="muted">{fmtDateTime(n.created_at)}</span>
                    </div>
                    <p className="cd-row-desc">{n.content}</p>
                  </div>
                ))}
              </div>
              <div className="cd-inline-form">
                <textarea
                  className="cd-input cd-textarea"
                  placeholder="填写备注，回车保存"
                  value={newNote}
                  onChange={(e) => setNewNote(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) submitNote();
                  }}
                />
                <button
                  type="button"
                  className="cd-btn cd-btn-primary"
                  onClick={submitNote}
                  disabled={saving || !newNote.trim()}
                >
                  <MessageSquare size={14} /> 添加备注
                </button>
              </div>
            </section>
          )}

          {/* ============ 沟通记录 ============ */}
          {tab === 'comms' && (
            <section className="cd-section">
              <h4 className="cd-section-title">沟通记录</h4>
              {loadingComms && <div className="cd-loading">加载沟通记录…</div>}
              {!loadingComms && comms.length === 0 && <div className="cd-empty">暂无沟通记录</div>}
              <div className="cd-rows">
                {comms.map((c) => (
                  <div className="cd-row" key={c.id}>
                    <div className="cd-row-head">
                      <b>{c.subject || c.channel}</b>
                      <span className={`tag ${c.delivery_status === 'SENT' ? 'tag-green' : 'tag-amber'}`}>
                        {c.delivery_status}
                      </span>
                      <span className="muted">{fmtDateTime(c.created_at)}</span>
                    </div>
                    <p className="cd-row-desc">{c.body}</p>
                  </div>
                ))}
              </div>
            </section>
          )}
        </div>

        <div className="cd-foot">
          <div className="cd-foot-spacer" />
          <span className="muted" style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
            <Clock size={13} /> 更新于 {fmtDateTime(t?.updated_at)}
          </span>
          {t && (
            <>
              <button type="button" className="cd-btn cd-btn-outline" onClick={() => setReactOpen(true)} disabled={saving}>
                加入岗位
              </button>
              <button type="button" className="cd-btn cd-btn-danger" onClick={removeFromPool} disabled={saving}>
                移出人才库
              </button>
            </>
          )}
          <button type="button" className="cd-btn cd-btn-primary" onClick={onClose}>
            关闭
          </button>
        </div>
      </div>

      <ReactivateModal
        open={reactOpen}
        title="加入岗位 / 重新激活"
        jobs={jobs}
        submitting={reactSubmitting}
        onCancel={() => setReactOpen(false)}
        onConfirm={confirmReactivate}
      />
    </>
  );
}
