(function(root) {
  'use strict';

  let generation = 0;
  let active;
  let ready = true;
  let preparedVideo;
  let stalledAt = 0;
  let playbackFailure;
  let soundUnlockCleanup = null;

  const images = new Map();

  const video = row =>
    row?.media_type === 'video' ||
    row?.mime_type === 'video/mp4' ||
    /\.mp4(?:\?|$)/i.test(row?.image_url || '');

  function clearSoundUnlock() {
    if (typeof soundUnlockCleanup === 'function') {
      try {
        soundUnlockCleanup();
      } catch (_) {}
    }

    soundUnlockCleanup = null;
  }

  function cancel(discardPreload = false) {
    generation++;
    ready = true;

    clearSoundUnlock();

    if (active?.tagName === 'VIDEO') {
      try {
        active.pause();
        active.removeAttribute('src');
        active.load();
      } catch (_) {}
    }

    active = null;
    stalledAt = 0;
    playbackFailure = null;

    if (discardPreload && preparedVideo) {
      try {
        preparedVideo.element.pause?.();
        preparedVideo.element.removeAttribute('src');
        preparedVideo.element.load();
      } catch (_) {}

      preparedVideo = null;
    }
  }

  async function imageSource(url) {
    if (images.has(url)) {
      return images.get(url);
    }

    const task = (async () => {
      try {
        const cache = await caches.open('citl-posters-images');

        let response = await cache.match(url);

        if (!response) {
          response = await fetch(url, {
            signal: AbortSignal.timeout(20000)
          });

          if (!response.ok) {
            throw new Error('image unavailable');
          }

          await cache.put(url, response.clone());

          const keys = await cache.keys();

          await Promise.all(
            keys
              .slice(0, Math.max(0, keys.length - 30))
              .map(key => cache.delete(key))
          );
        }

        return URL.createObjectURL(
          await response.blob()
        );

      } catch (_) {
        return url;
      }
    })();

    images.set(url, task);

    while (images.size > 3) {
      const key = images.keys().next().value;
      const removed = images.get(key);

      images.delete(key);

      removed.then(source => {
        if (
          typeof source === 'string' &&
          source.startsWith('blob:')
        ) {
          URL.revokeObjectURL(source);
        }
      });
    }

    return task;
  }

  function armSoundUnlock(media) {
    clearSoundUnlock();

    let unlocked = false;

    const cleanup = () => {
      document.removeEventListener('click', unlock);
      document.removeEventListener('touchstart', unlock);
      document.removeEventListener('keydown', unlock);

      if (soundUnlockCleanup === cleanup) {
        soundUnlockCleanup = null;
      }
    };

    const unlock = async event => {
      if (unlocked || active !== media) {
        return;
      }

      if (event?.type === 'keydown') {
        const key = event.key;
        const code = event.keyCode;

        const allowed =
          key === 'Enter' ||
          key === ' ' ||
          key === 'Spacebar' ||
          code === 13 ||
          code === 32;

        if (!allowed) {
          return;
        }
      }

      try {
        media.removeAttribute('muted');

        media.muted = false;
        media.defaultMuted = false;
        media.volume = 1;

        await media.play();

        unlocked = true;
        cleanup();

      } catch (_) {
        // نترك المستمع موجودًا لمحاولة أخرى
      }
    };

    document.addEventListener('click', unlock);
    document.addEventListener('touchstart', unlock);
    document.addEventListener('keydown', unlock);

    soundUnlockCleanup = cleanup;
  }

  async function show(
    row,
    card,
    host,
    container,
    onVisible,
    onFailure
  ) {
    const ticket = generation;

    ready = false;
    clearSoundUnlock();

    // Samsung TV:
    // لا نستخدم فيديو preload منفصل عن الـ DOM.
    const warmed = null;

    if (preparedVideo) {
      try {
        preparedVideo.element.pause?.();
        preparedVideo.element.removeAttribute('src');
        preparedVideo.element.load();
      } catch (_) {}

      preparedVideo = null;
    }

    const isVideo = video(row);

    const media = document.createElement(
      isVideo ? 'video' : 'img'
    );

    media.className =
      'w-full h-full rounded-xl shadow-2xl';

    media.style.objectFit =
      row.fit_mode === 'contain'
        ? 'contain'
        : 'cover';

    media.id =
      isVideo
        ? 'active-poster-video'
        : 'active-poster-img';

    if (isVideo) {
      /*
       * نحاول تشغيل الفيديو بالصوت أولًا.
       * لو سياسة المتصفح منعت Audible Autoplay،
       * سنرجع تلقائيًا إلى Muted Autoplay.
       */
      media.removeAttribute('muted');

      media.muted = false;
      media.defaultMuted = false;
      media.volume = 1;

      media.autoplay = true;
      media.loop = false;
      media.playsInline = true;
      media.preload = 'auto';

      media.setAttribute('autoplay', '');
      media.setAttribute('playsinline', '');
      media.setAttribute('webkit-playsinline', '');

    } else {
      media.alt = row.title || 'إعلان';
      media.decoding = 'async';
    }

    const source = isVideo
      ? row.image_url
      : await imageSource(row.image_url);

    if (ticket !== generation) {
      return;
    }

    /*
     * Samsung TV Fix:
     * الفيديو يدخل الـ DOM قبل src/load.
     */
    if (isVideo) {
      host.replaceChildren(media);
      container.replaceChildren(card);

      active = media;
    }

    let timer;

    try {
      await new Promise((resolve, reject) => {
        timer = setTimeout(
          () =>
            reject(
              new Error('تعذر تحميل الإعلان')
            ),
          25000
        );

        media.addEventListener(
          isVideo ? 'loadeddata' : 'load',
          resolve,
          { once: true }
        );

        media.addEventListener(
          'error',
          () =>
            reject(
              new Error('ملف الإعلان غير متاح')
            ),
          { once: true }
        );

        media.src = source;

        if (isVideo) {
          media.load();
        }
      });

      clearTimeout(timer);

      if (
        isVideo &&
        (
          !Number.isFinite(media.duration) ||
          media.duration <= 0
        )
      ) {
        throw new Error(
          'مدة الفيديو غير صالحة'
        );
      }

      if (ticket !== generation) {
        if (isVideo) {
          media.pause();
          media.removeAttribute('src');
          media.load();
        }

        return;
      }

      if (!isVideo && media.decode) {
        await media.decode().catch(() => {});
      }

      if (ticket !== generation) {
        return;
      }

      if (!isVideo) {
        host.replaceChildren(media);
        container.replaceChildren(card);
      }

      active = media;
      stalledAt = 0;

      playbackFailure = () => {
        clearSoundUnlock();

        try {
          media.pause();
          media.removeAttribute('src');
          media.load();
        } catch (_) {}

        active = null;

        host.textContent =
          'توقف تحميل الفيديو؛ ستتابع الشاشة تلقائيًا';

        host.style.cssText +=
          ';color:#fff;font-size:20px;padding:24px';

        onFailure?.(
          new Error('توقف تحميل الفيديو')
        );
      };

      if (isVideo) {
        try {
          /*
           * المحاولة الأولى:
           * تشغيل بالصوت.
           */
          media.removeAttribute('muted');

          media.muted = false;
          media.defaultMuted = false;
          media.volume = 1;

          await media.play();

        } catch (playError) {
          /*
           * Chrome / Samsung قد يمنعان
           * autoplay بالصوت.
           *
           * في الحالة دي نشغل الفيديو صامت
           * بدل ما يفشل بالكامل.
           */
          media.muted = true;
          media.defaultMuted = true;
          media.volume = 0;

          media.setAttribute('muted', '');

          await media.play();

          /*
           * أول OK / Enter / Click / Touch
           * يفتح الصوت.
           */
          armSoundUnlock(media);
        }
      }

      if (ticket !== generation) {
        return;
      }

      await new Promise(resolve =>
        requestAnimationFrame(() =>
          requestAnimationFrame(resolve)
        )
      );

      if (ticket !== generation) {
        return;
      }

      ready = true;

      onVisible(
        isVideo
          ? media.duration
          : null
      );

    } catch (error) {
      clearTimeout(timer);

      if (ticket !== generation) {
        return;
      }

      clearSoundUnlock();

      if (isVideo) {
        try {
          media.pause();
          media.removeAttribute('src');
          media.load();
        } catch (_) {}
      }

      ready = true;

      host.textContent = isVideo
        ? 'تعذر تشغيل الفيديو؛ تحقق من الاتصال واستخدم MP4 / H.264. ستتابع الشاشة تلقائيًا.'
        : 'تعذر تحميل هذا الإعلان؛ ستتابع الشاشة تلقائيًا';

      host.style.cssText +=
        ';color:#fff;font-size:20px;padding:24px';

      container.replaceChildren(card);

      onFailure?.(error);
    }
  }

  function preload(row) {
    if (!row) {
      return;
    }

    /*
     * Samsung TV:
     * ممنوع preload لفيديو داخل عنصر VIDEO منفصل.
     */
    if (video(row)) {
      return;
    }

    imageSource(row.image_url)
      .catch(() => {});
  }

  function videoProgress() {
    if (
      active?.tagName !== 'VIDEO' ||
      !Number.isFinite(active.duration) ||
      !ready
    ) {
      return null;
    }

    if (
      !active.ended &&
      active.readyState < 3
    ) {
      if (!stalledAt) {
        stalledAt = Date.now();
      }
    } else {
      stalledAt = 0;
    }

    if (
      active.error ||
      (
        stalledAt &&
        Date.now() - stalledAt > 30000
      )
    ) {
      playbackFailure?.();
      return null;
    }

    return active.ended
      ? 100
      : Math.min(
          99.99,
          (
            active.currentTime /
            active.duration
          ) * 100
        );
  }

  root.CITLTVMedia = Object.freeze({
    cancel,
    show,
    preload,
    video,
    videoProgress,
    waiting: () => !ready
  });

})(window);
