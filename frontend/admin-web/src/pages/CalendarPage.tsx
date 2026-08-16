import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import FullCalendar from '@fullcalendar/react';
import dayGridPlugin from '@fullcalendar/daygrid';
import timeGridPlugin from '@fullcalendar/timegrid';
import interactionPlugin from '@fullcalendar/interaction';
import zhCnLocale from '@fullcalendar/core/locales/zh-cn';
import { api } from '../lib/client';
import { getToken } from '../lib/token';
import { useAuth } from '../components/AuthContext';
import type { CalendarEvent, User } from '../types';

type Slot = { start: string; end: string };
const localValue = (date: Date) => {
  const offset = date.getTimezoneOffset() * 60000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 16);
};

export default function CalendarPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const calendarRef = useRef<FullCalendar>(null);
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [interviewers, setInterviewers] = useState<User[]>([]);
  const [interviewer, setInterviewer] = useState(user?.role === 'INTERVIEWER' ? user.id : '');
  const [msg, setMsg] = useState('');
  const rangeRef = useRef<{ start: string; end: string }>({ start: '', end: '' });
  const [slots, setSlots] = useState<Slot[]>([]);
  const [duration, setDuration] = useState(60);
  const [busy, setBusy] = useState({
    title: '不可用',
    starts_at: localValue(new Date()),
    ends_at: localValue(new Date(Date.now() + 3600000)),
  });
  useEffect(() => {
    if (user?.role !== 'INTERVIEWER')
      api
        .adminListInterviewers()
        .then(setInterviewers)
        .catch(() => {});
  }, [user?.role]);
  const load = useCallback(
    async (start = rangeRef.current.start, end = rangeRef.current.end) => {
      if (!start || !end) return;
      const rows = (await api.calendarEvents?.(start, end, interviewer)) || [];
      setEvents(rows);
    },
    [interviewer],
  );
  useEffect(() => {
    void load();
  }, [load]);
  async function subscribe() {
    try {
      const res = await fetch('/api/v1/admin/calendar/subscription', {
        method: 'POST',
        headers: { Authorization: `Bearer ${getToken() || ''}` },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || '生成失败');
      setMsg(`ICS 订阅地址：${location.origin}${data.feed_url}`);
    } catch (e) {
      setMsg((e as Error).message);
    }
  }
  async function importIcs(file?: File) {
    if (!file || !interviewer) return;
    try {
      const fd = new FormData();
      fd.append('file', file);
      const res = await fetch(`/api/v1/admin/calendar/ics/import?interviewer_id=${interviewer}`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${getToken() || ''}` },
        body: fd,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || '导入失败');
      setMsg(`已导入 ${data.imported || 0} 个忙碌事件`);
      void load();
    } catch (e) {
      setMsg((e as Error).message);
    }
  }
  async function addBusy() {
    if (!interviewer) {
      setMsg('请先选择面试官');
      return;
    }
    try {
      await api.addBusyBlock?.({
        interviewer_id: interviewer,
        title: busy.title,
        starts_at: new Date(busy.starts_at).toISOString(),
        ends_at: new Date(busy.ends_at).toISOString(),
      });
      setMsg('不可用时段已保存，排期时将自动检测冲突');
      void load();
    } catch (e) {
      setMsg((e as Error).message);
    }
  }
  async function findSlots() {
    if (!interviewer) {
      setMsg('请先选择面试官');
      return;
    }
    const start = new Date();
    start.setMinutes(0, 0, 0);
    const end = new Date(start.getTime() + 7 * 86400000);
    try {
      const data = await api.availability?.(
        interviewer,
        start.toISOString(),
        end.toISOString(),
        duration,
      );
      setSlots(data?.slots || []);
      setMsg(`未来 7 天找到 ${data?.slots?.length || 0} 个可用时段`);
    } catch (e) {
      setMsg((e as Error).message);
    }
  }
  async function removeBusy(id: string) {
    if (!confirm('删除这个手工不可用时段？')) return;
    try {
      await api.deleteBusyBlock?.(id);
      setMsg('不可用时段已删除');
      void load();
    } catch (e) {
      setMsg((e as Error).message);
    }
  }
  return (
    <div className="page">
      <div className="page-head">
        <div className="toolbar">
          {user?.role !== 'INTERVIEWER' && (
            <select
              className="input"
              value={interviewer}
              onChange={(e) => setInterviewer(e.target.value)}
            >
              <option value="">全部面试官</option>
              {interviewers.map((x) => (
                <option value={x.id} key={x.id}>
                  {x.name}
                </option>
              ))}
            </select>
          )}
          <button className="btn btn-primary" onClick={() => navigate('/interviews')}>
            安排面试
          </button>
          <label className="btn">
            导入 ICS
            <input
              hidden
              type="file"
              accept=".ics,text/calendar"
              disabled={!interviewer}
              onChange={(e) => importIcs(e.target.files?.[0])}
            />
          </label>
          <button className="btn" onClick={subscribe}>
            生成订阅地址
          </button>
        </div>
      </div>
      {msg && <div className="alert">{msg}</div>}
      <section className="block">
        <h3>忙闲工具</h3>
        <div className="inline-form">
          <input
            className="input"
            value={busy.title}
            onChange={(e) => setBusy({ ...busy, title: e.target.value })}
            placeholder="不可用原因"
          />
          <input
            className="input"
            type="datetime-local"
            value={busy.starts_at}
            onChange={(e) => setBusy({ ...busy, starts_at: e.target.value })}
          />
          <input
            className="input"
            type="datetime-local"
            value={busy.ends_at}
            onChange={(e) => setBusy({ ...busy, ends_at: e.target.value })}
          />
          <button className="btn" onClick={addBusy}>
            添加不可用
          </button>
          <select
            className="input"
            value={duration}
            onChange={(e) => setDuration(Number(e.target.value))}
          >
            <option value={30}>30 分钟</option>
            <option value={60}>60 分钟</option>
            <option value={90}>90 分钟</option>
            <option value={120}>120 分钟</option>
          </select>
          <button className="btn" onClick={findSlots}>
            查询未来 7 天空闲
          </button>
        </div>
        {slots.length > 0 && (
          <div className="slot-list">
            {slots.slice(0, 24).map((x) => (
              <button
                className="slot-chip"
                key={x.start}
                onClick={() => {
                  calendarRef.current?.getApi().gotoDate(x.start);
                  setBusy({
                    ...busy,
                    starts_at: localValue(new Date(x.start)),
                    ends_at: localValue(new Date(x.end)),
                  });
                }}
              >
                {new Date(x.start).toLocaleString('zh-CN', {
                  month: 'numeric',
                  day: 'numeric',
                  weekday: 'short',
                  hour: '2-digit',
                  minute: '2-digit',
                })}
              </button>
            ))}
          </div>
        )}
      </section>
      <div className="calendar-card">
        <FullCalendar
          ref={calendarRef}
          plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin]}
          locales={[zhCnLocale]}
          locale="zh-cn"
          initialView="timeGridWeek"
          headerToolbar={{
            left: 'prev,next today',
            center: 'title',
            right: 'dayGridMonth,timeGridWeek,timeGridDay',
          }}
          events={events}
          datesSet={(x) => {
            const s = x.start.toISOString();
            const e = x.end.toISOString();
            if (rangeRef.current.start === s && rangeRef.current.end === e) return;
            rangeRef.current = { start: s, end: e };
            void load(s, e);
          }}
          eventClick={(x) => {
            if (x.event.extendedProps.type === 'BUSY') {
              if (x.event.extendedProps.source === 'MANUAL') void removeBusy(x.event.id);
              else setMsg('ICS 忙碌事件需通过重新导入源日历维护');
            } else navigate(`/interviews/${x.event.id}`);
          }}
          nowIndicator
          height="auto"
        />
      </div>
    </div>
  );
}
