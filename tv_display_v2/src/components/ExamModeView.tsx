import React from 'react';
import type { ExamRow } from '../types/tv';

interface Props {
  exams: ExamRow[];
  pageIndex: number;
}

export const ExamModeView: React.FC<Props> = ({ exams, pageIndex }) => {
  const perPage = 8;
  const totalPages = Math.max(1, Math.ceil(exams.length / perPage));
  const safePage = pageIndex % totalPages;
  const slice = exams.slice(safePage * perPage, (safePage + 1) * perPage);

  return (
    <div className="tv2-study-card">
      <div className="tv2-study-hero">
        <div className="tv2-study-hero-main">
          <div className="tv2-qr-box">
            <img src="/tv_display/qr.png" alt="Exam QR" style={{ width: 68, height: 68, objectFit: 'contain' }} />
          </div>
          <div>
            <div className="tv2-room-badge">لجان الامتحانات اليوم</div>
            <div className="tv2-room-sub">{exams[0]?.exam_date || ''}</div>
          </div>
        </div>
        {totalPages > 1 && (
          <div className="tv2-page-pill">
            صفحة {safePage + 1} من {totalPages}
          </div>
        )}
      </div>

      <div className="tv2-rows-list">
        {slice.map((exam, idx) => (
          <div key={`${exam.id ?? idx}`} className="tv2-row is-upcoming">
            <div className="tv2-row-time font-english" dir="ltr">
              {exam.start_time.slice(0, 5)} - {exam.end_time.slice(0, 5)}
            </div>
            <div className="tv2-row-main">
              <h3>{exam.course_name}</h3>
              <div className="tv2-row-meta">
                <span>{exam.instructor}</span>
                {exam.academic_level && <span className="tv2-row-code">الفرقة {exam.academic_level}</span>}
              </div>
            </div>
            <div className="tv2-row-state">
              <span className="tv2-pill pill-live font-english">{exam.room_name}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
