import React from 'react';
import { useTvStore } from '../store/useTvStore';

interface Props {
  progress: number; // 0..100
  isExamMode: boolean;
}

export const NewsTickerBar: React.FC<Props> = ({ progress, isExamMode }) => {
  const newsConfig = useTvStore((s) => s.newsConfig);
  const text = newsConfig.text || 'مرحباً بكم في كلية النقل الدولي واللوجستيات';
  const speed = newsConfig.speed || '35s';

  return (
    <footer className="tv2-footer">
      <div className="tv2-progress-track">
        <div
          className="tv2-progress-fill"
          style={{ transform: `scaleX(${Math.min(1, Math.max(0, progress / 100))})` }}
        />
      </div>

      <div className="tv2-ticker-row">
        <div className={`tv2-ticker-badge ${isExamMode ? 'is-exam' : ''}`}>
          <i className={`fas ${isExamMode ? 'fa-exclamation-triangle' : 'fa-bullhorn'}`} />
          <span>{isExamMode ? 'تعليمات اللجان' : 'آخر التحديثات'}</span>
        </div>
        <div className="tv2-ticker-viewport">
          <div className="tv2-ticker-track" style={{ animationDuration: speed }}>
            {text}
          </div>
        </div>
      </div>
    </footer>
  );
};
