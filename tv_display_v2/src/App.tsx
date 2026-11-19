import React, { useEffect, useState } from 'react';
import { AnimatePresence } from 'motion/react';
import { useTvStore } from './store/useTvStore';
import { startRealtimeSync } from './services/realtimeSync';
import { TvHeader } from './components/TvHeader';
import { FullScheduleMode } from './components/FullScheduleMode';
import { CinematicMediaMode } from './components/CinematicMediaMode';
import { ExamModeView } from './components/ExamModeView';
import { NewsTickerBar } from './components/NewsTickerBar';
import { RoomSettingsModal } from './components/RoomSettingsModal';

export const App: React.FC = () => {
  const playlist = useTvStore((s) => s.playlist);
  const currentIndex = useTvStore((s) => s.currentIndex);
  const examRows = useTvStore((s) => s.examRows);
  const displayConfig = useTvStore((s) => s.displayConfig);
  const posterConfig = useTvStore((s) => s.posterConfig);
  const isStale = useTvStore((s) => s.isStale);
  const advanceSlide = useTvStore((s) => s.advanceSlide);

  const [progress, setProgress] = useState(0);
  const [examPage, setExamPage] = useState(0);

  const isExamMode = Boolean(displayConfig.examsEnabled && examRows.length > 0);
  const currentSlide = playlist[currentIndex];
  const isVideoSlide =
    currentSlide?.kind === 'poster' &&
    (currentSlide.poster.media_type === 'video' || /\.(mp4|webm|mov|m4v)(\?|$)/i.test(currentSlide.poster.image_url));

  useEffect(() => {
    return startRealtimeSync();
  }, []);

  // Rotation timer for non-video slides (videos advance strictly on `ended`)
  useEffect(() => {
    setProgress(0);
    if (isVideoSlide) return;

    const durationMs = isExamMode
      ? (displayConfig.examSlideDurationSeconds || 15) * 1000
      : currentSlide?.kind === 'poster'
        ? ((currentSlide.poster.duration || posterConfig.rotationSeconds || 15) * 1000)
        : (displayConfig.slideDurationSeconds || 10) * 1000;

    const stepMs = 100;
    let elapsed = 0;
    const id = window.setInterval(() => {
      elapsed += stepMs;
      const pct = Math.min(100, (elapsed / durationMs) * 100);
      setProgress(pct);
      if (elapsed >= durationMs) {
        window.clearInterval(id);
        if (isExamMode) setExamPage((p) => p + 1);
        else advanceSlide();
      }
    }, stepMs);

    return () => window.clearInterval(id);
  }, [currentSlide?.key, isExamMode, isVideoSlide, examPage]);

  const headerTitle = isExamMode
    ? 'لوحة إعلانات لجان الامتحانات النهائية'
    : currentSlide?.kind === 'poster'
      ? 'لوحة الإعلانات والفعاليات الأكاديمية'
      : 'شاشة الجداول الدراسية اليومية';

  return (
    <div className="tv2-app">
      <TvHeader title={headerTitle} />

      <main className="tv2-stage">
        {isExamMode ? (
          <ExamModeView exams={examRows} pageIndex={examPage} />
        ) : (
          <AnimatePresence mode="wait">
            {currentSlide?.kind === 'poster' ? (
              <CinematicMediaMode
                key={currentSlide.key}
                poster={currentSlide.poster}
                index={currentSlide.index}
                total={currentSlide.total}
                onVideoProgress={setProgress}
                onVideoEnded={advanceSlide}
              />
            ) : currentSlide ? (
              <FullScheduleMode key={currentSlide.key} slide={currentSlide} isStale={isStale} />
            ) : (
              <div className="tv2-loading">جاري تحميل الجداول والقاعات...</div>
            )}
          </AnimatePresence>
        )}
      </main>

      <NewsTickerBar progress={progress} isExamMode={isExamMode} />
      <RoomSettingsModal />
    </div>
  );
};
