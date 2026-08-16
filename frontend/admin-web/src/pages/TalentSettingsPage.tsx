import { useEffect, useState } from 'react';
import { api } from '../lib/client';
import { useAuth } from '../components/AuthContext';
import type { SourceChannel, Tag } from '../types';

const emptyChannel = { code: '', name: '', enabled: true, sort_order: 0 };
const emptyTag = { name: '', color: '#2563eb', enabled: true };

export default function TalentSettingsPage() {
  const { user } = useAuth();
  const [channels, setChannels] = useState<SourceChannel[]>([]);
  const [tags, setTags] = useState<Tag[]>([]);
  const [channel, setChannel] = useState(emptyChannel);
  const [tag, setTag] = useState(emptyTag);
  const [msg, setMsg] = useState('');
  const load = () =>
    Promise.all([api.listSourceChannels?.().then(setChannels), api.listTags?.().then(setTags)]);
  useEffect(() => {
    void load();
  }, []);
  async function addChannel() {
    if (!channel.code.trim() || !channel.name.trim()) return;
    try {
      await api.createSourceChannel?.({
        ...channel,
        code: channel.code.trim().toUpperCase(),
        name: channel.name.trim(),
      });
      setChannel(emptyChannel);
      setMsg('来源渠道已创建');
      void load();
    } catch (e) {
      setMsg((e as Error).message);
    }
  }
  async function toggleChannel(row: SourceChannel) {
    try {
      await api.updateSourceChannel?.(row.id, {
        code: row.code,
        name: row.name,
        sort_order: row.sort_order,
        enabled: !row.enabled,
      });
      void load();
    } catch (e) {
      setMsg((e as Error).message);
    }
  }
  async function addTag() {
    if (!tag.name.trim()) return;
    try {
      await api.createTag?.({ ...tag, name: tag.name.trim() });
      setTag(emptyTag);
      setMsg('候选人标签已创建');
      void load();
    } catch (e) {
      setMsg((e as Error).message);
    }
  }
  async function toggleTag(row: Tag) {
    try {
      await api.updateTag?.(row.id, { name: row.name, color: row.color, enabled: !row.enabled });
      void load();
    } catch (e) {
      setMsg((e as Error).message);
    }
  }
  return (
    <div className="page">
      {msg && <div className="alert">{msg}</div>}
      <div className="report-grid">
        <section className="block">
          <h3>来源渠道</h3>
          {user?.role === 'SUPER_ADMIN' && (
            <div className="inline-form">
              <input
                className="input"
                placeholder="编码，如 CAMPUS"
                value={channel.code}
                onChange={(e) => setChannel({ ...channel, code: e.target.value })}
              />
              <input
                className="input"
                placeholder="显示名称"
                value={channel.name}
                onChange={(e) => setChannel({ ...channel, name: e.target.value })}
              />
              <input
                className="input"
                type="number"
                title="排序"
                value={channel.sort_order}
                onChange={(e) => setChannel({ ...channel, sort_order: Number(e.target.value) })}
              />
              <button className="btn btn-primary" onClick={addChannel}>
                添加
              </button>
            </div>
          )}
          <table className="table">
            <thead>
              <tr>
                <th>编码</th>
                <th>名称</th>
                <th>状态</th>
                <th>操作</th>
              </tr>
            </thead>
            <tbody>
              {channels.map((x) => (
                <tr key={x.id}>
                  <td className="mono">{x.code}</td>
                  <td>{x.name}</td>
                  <td>{x.enabled ? '启用' : '停用'}</td>
                  <td>
                    {user?.role === 'SUPER_ADMIN' && (
                      <button className="btn-link" onClick={() => toggleChannel(x)}>
                        {x.enabled ? '停用' : '启用'}
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
        <section className="block">
          <h3>候选人标签</h3>
          <div className="inline-form">
            <input
              className="input"
              placeholder="标签名称"
              value={tag.name}
              onChange={(e) => setTag({ ...tag, name: e.target.value })}
            />
            <input
              type="color"
              title="标签颜色"
              value={tag.color}
              onChange={(e) => setTag({ ...tag, color: e.target.value })}
            />
            <button className="btn btn-primary" onClick={addTag}>
              添加
            </button>
          </div>
          <table className="table">
            <thead>
              <tr>
                <th>标签</th>
                <th>状态</th>
                <th>操作</th>
              </tr>
            </thead>
            <tbody>
              {tags.map((x) => (
                <tr key={x.id}>
                  <td>
                    <span className="tag" style={{ borderColor: x.color, color: x.color }}>
                      {x.name}
                    </span>
                  </td>
                  <td>{x.enabled ? '启用' : '停用'}</td>
                  <td>
                    <button className="btn-link" onClick={() => toggleTag(x)}>
                      {x.enabled ? '停用' : '启用'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      </div>
    </div>
  );
}
