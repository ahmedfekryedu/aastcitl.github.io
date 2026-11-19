import React, { useEffect, useRef } from 'react';
import QRCode from 'qrcode';
import { formatTimeSlot, getCairoNow, getLectureState } from '../lib/cairoTime';
import type { PlaylistSlide } from '../types/tv';

interface Props {
  slide: Extract<PlaylistSlide, { kind: 'study' | 'study-end' }>;
  isStale: boolean;
}

export const FullScheduleMode: React.FC<Props> = ({ slide, isStale }) => {
  const qrCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const now = getCairoNow();

  useEffect(() => {
    if (!qrCanvasRef.current) return;
    QRCode.toCanvas(qrCanvasRef.current, 'https://aastcitl.me/study/', {
      width: 72,
      margin: 1,
      color: { dark: '#11183d', light: '#ffffff' },
    }).catch(() => {});
  }, [slide.key]);

  if (slide.kind === 'study-end') {
    return (
      <div className="tv2-study-card tv2-study-empty">
        <i className="fas fa-calendar-check" />
        <h2>{slide.ended ? 'انتهت محاضرات اليوم الدراسي' : 'لا توجد محاضرات مجدولة اليوم'}</h2>
        <p>يمكن للطلاب متابعة الجداول الأسبوعية الكاملة عبر مسح رمز QR</p>
        <div className="tv2-qr-box"><canvas ref={qrCanvasRef} /></div>
      </div>
    );
  }

  return (
    <div className="tv2-study-card">
      {isStale && (
        <div className="tv2-stale-banner" role="status">
          تعذر التحديث اللحظي مؤقتاً — يتم عرض آخر بيانات مؤكدة لليوم
        </div>
      )}

      <div className="tv2-study-hero">
        <div className="tv2-study-hero-main">
          <div className="tv2-qr-box" title="جداول الطلاب">
            <canvas ref={qrCanvasRef} />
          </div>
          <div>
            <div className="tv2-room-badge font-english">{slide.room}</div>
            <div className="tv2-room-sub">الجداول الدراسية اليومية · {now.dateLabel}</div>
          </div>
        </div>
        {slide.totalPages > 1 && (
          <div className="tv2-page-pill">
            <i className="fas fa-layer-group" /> صفحة {slide.page} من {slide.totalPages}
          </div>
        )}
      </div>

      <div className="tv2-table-head">
        <div>التوقيت</div>
        <div>المقرر الدراسي والمحاضر</div>
        <div>الحالة</div>
      </div>

      <div className="tv2-rows-list">
        {slide.rows.map((row, idx) => {
          const state = getLectureState(row, now);
          return (
            <div key={`${row.id ?? idx}`} className={`tv2-row is-${state}`}>
              <div className="tv2-row-time font-english" dir="ltr">
                {formatTimeSlot(row.time_slot)}
              </div>
              <div className="tv2-row-main">
                <h3>{row.course_name || 'محاضرة دراسية'}</h3>
                <div className="tv2-row-meta">
                  <span className="tv2-row-instructor">
                    <i className="fas fa-user-tie" /> {row.instructor || 'هيئة التدريس'}
                  </span>
                  {row.course_code && <span className="tv2-row-code font-english">{row.course_code}</span>}
                </div>
              </div>
              <div className="tv2-row-state">
                <span className={`tv2-pill pill-${state}`}>
                  {state === 'live' ? 'الآن' : state === 'cancelled' ? 'ملغاة' : 'قادمة'}
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
