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

    const prompt = document.getElementById('tv-sound-unlock');
    if (prompt) {
      prompt.remove();
    }
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

    const prompt = document.createElement('div');

    prompt.id = 'tv-sound-unlock';
    prompt.textContent = 'اضغط OK لتشغيل الصوت';

    prompt.style.cssText = `
      position: fixed;
      z-index: 999999;
      left: 50%;
      bottom: 28px;
      transform: translateX(-50%);
      background: rgba(0,0,0,.75);
      color: #fff;
      padding: 10px 18px;
      border-radius: 10px;
      font-size: 18px;
      font-family: inherit;
      pointer-events: none;
      white-space: nowrap;
    `;

    if (document.body) {
      document.body.appendChild(prompt);
    }

    const cleanup = () => {
      document.removeEventListener('click', unlock, true);
      document.removeEventListener('pointerdown', unlock, true);
      document.removeEventListener('touchstart', unlock, true);
      document.removeEventListener('keydown', unlock, true);

      window.removeEventListener('keydown', unlock, true);
      window.removeEventListener('keyup', unlock, true);
      window.removeEventListener('click', unlock, true);

      const currentPrompt =
        document.getElementById('tv-sound-unlock');

      if (currentPrompt) {
        currentPrompt.remove();
      }

      if (soundUnlockCleanup === cleanup) {
        soundUnlockCleanup = null;
      }
    };

    const unlock = async () => {
      if (
        unlocked ||
        active !== media ||
        media.tagName !== 'VIDEO'
      ) {
        return;
      }

      try {
        /*
         * هنا فقط نفتح الصوت بعد تفاعل حقيقي
         * من المستخدم أو الريموت.
         */
        media.removeAttribute('muted');

        media.muted = false;
        media.defaultMuted = false;
        media.volume = 1;

        const result = media.play();

        if (
          result &&
          typeof result.then === 'function'
        ) {
          await result;
        }

        /*
         * تأكيد مرة ثانية بعد play().
         */
        media.removeAttribute('muted');
        media.muted = false;
        media.defaultMuted = false;
        media.volume = 1;

        unlocked = true;

        cleanup();

      } catch (_) {
        /*
         * لو Samsung رفض فتح الصوت لأي سبب،
         * نرجع فورًا للوضع الصامت حتى لا تسود الشاشة.
         */
        try {
          media.muted = true;
          media.defaultMuted = true;
          media.volume = 0;

          media.setAttribute('muted', '');

          await media.play();
        } catch (_) {}
      }
    };

    /*
     * Chrome / Mobile
     */
    document.addEventListener(
      'click',
      unlock,
      true
    );

    document.addEventListener(
      'pointerdown',
      unlock,
      true
    );

    document.addEventListener(
      'touchstart',
      unlock,
      true
    );

    /*
     * Samsung Remote / Keyboard
     */
    document.addEventListener(
      'keydown',
      unlock,
      true
    );

    window.addEventListener(
      'keydown',
      unlock,
      true
    );

    window.addEventListener(
      'keyup',
      unlock,
      true
    );

    window.addEventListener(
      'click',
      unlock,
      true
    );

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

    /*
     * لا نستخدم detached VIDEO preload.
     * ده كان مهم جدًا لتوافق Samsung.
     */
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
       * مهم جدًا:
       *
       * Samsung يبدأ الفيديو MUTED.
       * دي الطريقة اللي ثبت إنها بتظهر الفيديو
       * بدون Black Screen.
       */
      media.muted = true;
      media.defaultMuted = true;
      media.volume = 0;

      media.autoplay = true;
      media.loop = false;
      media.playsInline = true;
      media.preload = 'auto';

      media.setAttribute('muted', '');
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
     * أهم Samsung Fix:
     *
     * عنصر VIDEO يدخل DOM أولًا،
     * وبعدها فقط نضع src وننفذ load().
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
          () => {
            reject(
              new Error('تعذر تحميل الإعلان')
            );
          },
          25000
        );

        media.addEventListener(
          isVideo ? 'loadeddata' : 'load',
          resolve,
          { once: true }
        );

        media.addEventListener(
          'error',
          () => {
            reject(
              new Error('ملف الإعلان غير متاح')
            );
          },
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
        /*
         * تشغيل مضمون للصورة أولًا.
         */
        media.muted = true;
        media.defaultMuted = true;
        media.volume = 0;

        media.setAttribute('muted', '');

        await media.play();

        /*
         * بعد ما الفيديو اشتغل بالفعل،
         * ننتظر OK / Click لفتح الصوت.
         */
        armSoundUnlock(media);
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
     * مهم:
     * لا نعمل preload لفيديو داخل عنصر VIDEO منفصل.
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
