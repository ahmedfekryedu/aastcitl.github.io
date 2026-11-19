import type { TvPoster } from '../types/tv';

export function isSamsungTV(): boolean {
  return /SMART-TV|SMARTTV|Tizen|Maple/i.test(navigator.userAgent) && !/Android|Mobile/i.test(navigator.userAgent);
}

/**
 * Samsung Native Video Plane Adapter:
 * Preserves `native-cw` geometry without applying CSS transforms on Samsung hardware video planes.
 */
export function attachVideoLayout(video: HTMLVideoElement, host: HTMLElement, poster: TvPoster): () => void {
  if (poster.video_layout !== 'native-cw') {
    video.style.width = '100%';
    video.style.height = '100%';
    video.style.objectFit = poster.fit_mode === 'cover' ? 'cover' : 'contain';
    return () => {};
  }

  const native = isSamsungTV() && document.body.classList.contains('tv-rotate-cw');
  video.dataset.videoPlane = native ? 'native' : 'composited';
  host.style.position = 'relative';
  host.style.overflow = 'hidden';

  const resize = () => {
    if (native) {
      const ratio = video.videoWidth && video.videoHeight ? video.videoWidth / video.videoHeight : 1920 / 1080;
      const width = Math.max(host.clientWidth, host.clientHeight / ratio);
      const height = width * ratio;
      video.style.position = 'absolute';
      video.style.width = `${width}px`;
      video.style.height = `${height}px`;
      video.style.left = `${(host.clientWidth - width) / 2}px`;
      video.style.top = `${(host.clientHeight - height) / 2}px`;
      video.style.maxWidth = 'none';
      video.style.maxHeight = 'none';
      video.style.objectFit = 'fill';
      return;
    }
    video.style.position = 'absolute';
    video.style.width = `${host.clientHeight}px`;
    video.style.height = `${host.clientWidth}px`;
    video.style.left = '50%';
    video.style.top = '50%';
    video.style.maxWidth = 'none';
    video.style.maxHeight = 'none';
    video.style.transform = 'translate(-50%, -50%) rotate(-90deg)';
  };

  resize();
  const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(resize) : null;
  ro?.observe(host);
  window.addEventListener('resize', resize);
  video.addEventListener('loadedmetadata', resize);

  return () => {
    ro?.disconnect();
    window.removeEventListener('resize', resize);
    video.removeEventListener('loadedmetadata', resize);
  };
}
