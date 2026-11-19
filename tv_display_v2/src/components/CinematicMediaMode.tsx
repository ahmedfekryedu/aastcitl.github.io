import React, { useEffect, useRef } from 'react';
import { motion } from 'motion/react';
import type { TvPoster } from '../types/tv';
import { attachVideoLayout } from '../adapters/samsungVideo';
import { CompactLiveSchedule } from './CompactLiveSchedule';
import { useTvStore } from '../store/useTvStore';

interface Props {
  poster: TvPoster;
  index: number;
  total: number;
  onVideoProgress: (pct: number) => void;
  onVideoEnded: () => void;
}

export const CinematicMediaMode: React.FC<Props> = ({
  poster,
  index,
  total,
  onVideoProgress,
  onVideoEnded,
}) => {
  const lowPower = useTvStore((s) => s.lowPowerMode);
  const hostRef = useRef<HTMLDivElement | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const isVideo = poster.media_type === 'video' || /\.(mp4|webm|mov|m4v)(\?|$)/i.test(poster.image_url);

  useEffect(() => {
    if (!isVideo || !videoRef.current || !hostRef.current) return;
    const video = videoRef.current;
    const detach = attachVideoLayout(video, hostRef.current, poster);

    const handleTime = () => {
      if (video.duration && Number.isFinite(video.duration) && video.duration > 0) {
        onVideoProgress(Math.min(99.5, (video.currentTime / video.duration) * 100));
      }
    };
    const handleEnded = () => {
      onVideoProgress(100);
      onVideoEnded();
    };
    const handleError = () => {
      window.setTimeout(onVideoEnded, 2500);
    };

    video.addEventListener('timeupdate', handleTime);
    video.addEventListener('ended', handleEnded);
    video.addEventListener('error', handleError);

    video.muted = !poster.play_sound;
    video.play().catch(() => {
      video.muted = true;
      video.play().catch(handleError);
    });

    return () => {
      detach();
      video.removeEventListener('timeupdate', handleTime);
      video.removeEventListener('ended', handleEnded);
      video.removeEventListener('error', handleError);
      video.pause();
      video.removeAttribute('src');
      video.load();
    };
  }, [poster.id, poster.image_url, isVideo]);

  return (
    <motion.div
      className="tv2-media-shell"
      initial={lowPower ? { opacity: 0 } : { opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      exit={lowPower ? { opacity: 0 } : { opacity: 0, y: -10 }}
      transition={{ duration: lowPower ? 0.2 : 0.5, ease: [0.16, 1, 0.3, 1] }}
    >
      {/* 4:5 Target Media Stage (1080x1350 logical ratio) */}
      <div className="tv2-media-stage" ref={hostRef}>
        <div className="tv2-media-counter">
          <span>إعلان</span>
          <strong className="font-english">{index + 1} / {total}</strong>
        </div>

        {isVideo ? (
          <video
            ref={videoRef}
            src={poster.image_url}
            playsInline
            autoPlay
            preload="auto"
            className="tv2-media-element"
          />
        ) : (
          <img
            src={poster.image_url}
            alt={poster.title || 'إعلان'}
            className="tv2-media-element"
            style={{ objectFit: poster.fit_mode === 'cover' ? 'cover' : 'contain' }}
          />
        )}
      </div>

      {/* Persistent Compact Live Schedule docked underneath */}
      <CompactLiveSchedule />
    </motion.div>
  );
};
