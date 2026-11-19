import React, { useEffect, useState } from 'react';
import { getCairoNow } from '../lib/cairoTime';
import { useTvStore } from '../store/useTvStore';

interface Props {
  title: string;
}

export const TvHeader: React.FC<Props> = ({ title }) => {
  const [clock, setClock] = useState(() => getCairoNow());
  const setSettingsOpen = useTvStore((s) => s.setSettingsOpen);

  useEffect(() => {
    const id = window.setInterval(() => setClock(getCairoNow()), 1000);
    return () => window.clearInterval(id);
  }, []);

  return (
    <header className="tv2-header">
      <div className="tv2-header-brand">
        <button
          type="button"
          className="tv2-logo-btn"
          onClick={() => setSettingsOpen(true)}
          title="اضغط لضبط القاعات"
          aria-label="إعدادات القاعات"
        >
          <img src="/CITL.png" alt="CITL Logo" />
        </button>
        <div className="tv2-header-titles">
          <h1>{title}</h1>
          <p className="font-english">COLLEGE OF INTERNATIONAL TRANSPORT &amp; LOGISTICS</p>
        </div>
      </div>

      <div dir="ltr" className="tv2-clock">
        <div className="tv2-clock-time font-english">{clock.timeLabel}</div>
        <div className="tv2-clock-date font-english">{clock.dateLabel}</div>
      </div>
    </header>
  );
};
