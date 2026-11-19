/**
 * CITL Media Crop Studio (4:5 = 1080x1350)
 * Shared module for Dashboard & SMRM upload modals.
 * Computes automatic center crop + optional pan/zoom and outputs FFmpeg crop filter
 * or Canvas-cropped Blob for images (preserving GIF animation untouched).
 */
(function (root) {
  'use strict';

  const TARGET_W = 1080;
  const TARGET_H = 1350;
  const TARGET_RATIO = TARGET_W / TARGET_H; // 0.8 (4:5)

  function computeAutoCrop(srcW, srcH, offsetX = 0, offsetY = 0, zoom = 1) {
    const safeZoom = Math.max(1, Math.min(3, Number(zoom) || 1));
    const srcRatio = srcW / srcH;
    let cropW, cropH;

    if (srcRatio > TARGET_RATIO) {
      cropH = Math.round(srcH / safeZoom);
      cropW = Math.round(cropH * TARGET_RATIO);
    } else {
      cropW = Math.round(srcW / safeZoom);
      cropH = Math.round(cropW / TARGET_RATIO);
    }

    // Ensure even dimensions for H.264 / yuv420p compatibility
    cropW = cropW - (cropW % 2);
    cropH = cropH - (cropH % 2);

    const maxX = Math.max(0, srcW - cropW);
    const maxY = Math.max(0, srcH - cropH);
    const x = Math.round(Math.min(maxX, Math.max(0, maxX / 2 + offsetX * (maxX / 2))));
    const y = Math.round(Math.min(maxY, Math.max(0, maxY / 2 + offsetY * (maxY / 2))));

    return {
      x,
      y,
      w: cropW,
      h: cropH,
      ffmpegFilter: `crop=${cropW}:${cropH}:${x}:${y},scale=${TARGET_W}:${TARGET_H}:flags=lanczos`,
    };
  }

  async function cropImageTo45(file, { offsetX = 0, offsetY = 0, zoom = 1, fitMode = 'cover' } = {}) {
    // Preserve animated GIFs without flattening
    if (file.type === 'image/gif' || /\.gif$/i.test(file.name || '')) return file;

    const bitmap = await createImageBitmap(file);
    const canvas = document.createElement('canvas');
    canvas.width = TARGET_W;
    canvas.height = TARGET_H;
    const ctx = canvas.getContext('2d');

    ctx.fillStyle = '#060A1C';
    ctx.fillRect(0, 0, TARGET_W, TARGET_H);

    if (fitMode === 'contain') {
      const scale = Math.min(TARGET_W / bitmap.width, TARGET_H / bitmap.height);
      const dw = Math.round(bitmap.width * scale);
      const dh = Math.round(bitmap.height * scale);
      ctx.drawImage(bitmap, Math.round((TARGET_W - dw) / 2), Math.round((TARGET_H - dh) / 2), dw, dh);
    } else {
      const crop = computeAutoCrop(bitmap.width, bitmap.height, offsetX, offsetY, zoom);
      ctx.drawImage(bitmap, crop.x, crop.y, crop.w, crop.h, 0, 0, TARGET_W, TARGET_H);
    }

    bitmap.close?.();
    const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/webp', 0.92));
    return new File([blob], file.name.replace(/\.[^.]+$/, '') + '-4x5.webp', { type: 'image/webp' });
  }

  root.CITLMediaCropStudio = Object.freeze({
    TARGET_W,
    TARGET_H,
    TARGET_RATIO,
    computeAutoCrop,
    cropImageTo45,
  });
})(window);
