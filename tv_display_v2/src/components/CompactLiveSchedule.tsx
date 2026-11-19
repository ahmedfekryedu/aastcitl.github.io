import React, { useEffect, useMemo, useState } from 'react';
import { formatTimeSlot, getCairoNow, getLectureState } from '../lib/cairoTime';
import { useTvStore } from '../store/useTvStore';

export const CompactLiveSchedule: React.FC = () => {
  const scheduleRows = useTvStore((s) => s.scheduleRows);
  const alerts = useTvStore((s) => s.alerts);
  const [offset, setOffset] = useState(0);

  const items = useMemo(() => {
    const now = getCairoNow();
    return scheduleRows
      .map((row) => ({ row, state: getLectureState(row, now) }))
      .filter((x) => x.state !== 'ended')
      .sort((a, b) => {
        const rank = { live: 0, cancelled: 1, upcoming: 2, ended: 3 };
        return rank[a.state] - rank[b.state];
      });
  }, [scheduleRows]);

  useEffect(() => {
    if (items.length <= 2) return;
    const id = window.setInterval(() => {
      setOffset((prev) => (prev + 2) % items.length);
    }, 6000);
    return () => window.clearInterval(id);
  }, [items.length]);

  if (!items.length) return null;

  const visible = items.length <= 2
    ? items
    : [items[offset % items.length], items[(offset + 1) % items.length]];

  const liveCount = items.filter((i) => i.state === 'live').length;
  const latestAlert = alerts[0];

  return (
    <section className="tv2-compact-dock" aria-label="المحاضرات الجارية والقادمة">
      <div className="tv2-compact-head">
        <div className="tv2-compact-title">
          <span className="tv2-live-dot" />
          <span>المحاضرات الجارية والقادمة الآن</span>
        </div>
        <span className="tv2-compact-meta">
          {liveCount > 0 ? `${liveCount} جارية الآن` : `${items.length} محاضرة متبقية اليوم`}
        </span>
      </div>

      {latestAlert && (
        <div className="tv2-smart-alert" role="status">
          <i className="fas fa-bell" />
          <span>{latestAlert.message}</span>
        </div>
      )}

      <div className="tv2-compact-rows">
        {visible.map(({ row, state }, idx) => (
          <div key={`${row.id ?? row.room_name}-${idx}`} className={`tv2-compact-row is-${state}`}>
            <div className="tv2-compact-room font-english">{row.room_name}</div>
            <div className="tv2-compact-info">
              <strong>{row.course_name || 'محاضرة دراسية'}</strong>
              <span>
                <i className="fas fa-user-tie" /> {row.instructor || 'هيئة التدريس'}
              </span>
            </div>
            <div className="tv2-compact-right">
              <span className={`tv2-pill pill-${state}`}>
                {state === 'live' ? 'الآن' : state === 'cancelled' ? 'ملغاة' : 'قادمة'}
              </span>
              <span className="tv2-compact-time font-english" dir="ltr">
                {formatTimeSlot(row.time_slot)}
              </span>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
};
