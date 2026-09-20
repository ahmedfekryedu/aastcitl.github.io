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

  const isSamsungTV =
    /Tizen|SMART-TV|Samsung.*TV|Maple/i.test(
      navigator.userAgent || ''
    );

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
        const cache =
          await caches.open('citl-posters-images');

        let response =
          await cache.match(url);

        if (!response) {
          response = await fetch(url, {
            signal: AbortSignal.timeout(20000)
          });

          if (!response.ok) {
            throw new Error('image unavailable');
          }

          await cache.put(
            url,
            response.clone()
          );

          const keys =
            await cache.keys();

          await Promise.all(
            keys
              .slice(
                0,
                Math.max(
                  0,
                  keys.length - 30
                )
              )
              .map(key =>
                cache.delete(key)
              )
          );
        }

        const source =
          URL.createObjectURL(
            await response.blob()
          );

        return source;

      } catch (_) {
        return url;
      }
    })();

    images.set(url, task);

    while (images.size > 3) {
      const key =
        images.keys().next().value;

      const removed =
        images.get(key);

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
      document.removeEventListener(
        'click',
        unlock,
        true
      );

      document.removeEventListener(
        'pointerdown',
        unlock,
        true
      );

      document.removeEventListener(
        'touchstart',
        unlock,
        true
      );

      document.removeEventListener(
        'keydown',
        unlock,
        true
      );

      document.removeEventListener(
        'keyup',
        unlock,
        true
      );

      window.removeEventListener(
        'keydown',
        unlock,
        true
      );

      window.removeEventListener(
        'keyup',
        unlock,
        true
      );

      window.removeEventListener(
        'click',
        unlock,
        true
      );

      if (
        soundUnlockCleanup === cleanup
      ) {
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
         * فتح الصوت فقط بعد تفاعل فعلي
         * من الريموت / الماوس / اللمس.
         *
         * لا نوقف الفيديو ولا نعيد تحميله.
         */
        media.removeAttribute('muted');

        media.muted = false;
        media.defaultMuted = false;
        media.volume = 1;

        /*
         * لو الفيديو شغال بالفعل،
         * play() لا يعيده من البداية.
         */
        const result =
          media.play();

        if (
          result &&
          typeof result.then === 'function'
        ) {
          await result;
        }

        /*
         * تأكيد حالة الصوت مرة ثانية
         * لبعض متصفحات Samsung.
         */
        media.removeAttribute('muted');

        media.muted = false;
        media.defaultMuted = false;
        media.volume = 1;

        unlocked = true;

        cleanup();

      } catch (_) {
        /*
         * مهم:
         * لا نوقف الفيديو ولا نعمل load()
         * في حالة فشل فتح الصوت.
         *
         * نخلي الفيديو مستمر كما هو
         * وننتظر تفاعل آخر.
         */
      }
    };

    /*
     * أي Click أو Touch على الكمبيوتر/الموبايل.
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
     * Samsung Remote:
     * لا نقيدها بـ Enter فقط.
     * أي key event يعتبر user gesture.
     */
    document.addEventListener(
      'keydown',
      unlock,
      true
    );

    document.addEventListener(
      'keyup',
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
     * لا نستخدم detached video preload.
     * ده جزء مهم من توافق Samsung.
     */
    const warmed = null;

    if (preparedVideo) {
      try {
        preparedVideo.element.pause?.();
        preparedVideo.element.removeAttribute(
          'src'
        );
        preparedVideo.element.load();
      } catch (_) {}

      preparedVideo = null;
    }

    const isVideo =
      video(row);

    const media =
      document.createElement(
        isVideo
          ? 'video'
          : 'img'
      );

    /*
     * مهم:
     * رجعنا Samsung class
     * كما كانت في النسخة التي عرضت الفيديو بنجاح.
     */
    if (
      isVideo &&
      isSamsungTV &&
      document.body
    ) {
      document.body.classList.add(
        'samsung-tv-video'
      );
    }

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
       * نفس إعدادات النسخة التي كانت تعمل.
       *
       * نجرب التشغيل بالصوت أولًا.
       * لو المتصفح رفضه،
       * هنرجع muted autoplay.
       */
      media.muted = false;
      media.defaultMuted = false;
      media.volume = 1;

      media.autoplay = true;
      media.loop = false;
      media.playsInline = true;
      media.preload = 'auto';

      media.setAttribute(
        'autoplay',
        ''
      );

      media.setAttribute(
        'playsinline',
        ''
      );

      media.setAttribute(
        'webkit-playsinline',
        ''
      );

    } else {
      media.alt =
        row.title || 'إعلان';

      media.decoding =
        'async';
    }

    const source =
      isVideo
        ? row.image_url
        : await imageSource(
            row.image_url
          );

    if (
      ticket !== generation
    ) {
      return;
    }

    /*
     * مهم جدًا لـ Samsung:
     *
     * ندخل VIDEO إلى DOM أولًا
     * قبل تعيين src/load.
     *
     * ده هو السلوك الذي كان يعمل.
     */
    if (isVideo) {
      host.replaceChildren(
        media
      );

      container.replaceChildren(
        card
      );

      active = media;
    }

    let timer;

    try {
      await new Promise(
        (resolve, reject) => {
          timer = setTimeout(
            () =>
              reject(
                new Error(
                  'تعذر تحميل الإعلان'
                )
              ),
            25000
          );

          media.addEventListener(
            isVideo
              ? 'loadeddata'
              : 'load',
            resolve,
            {
              once: true
            }
          );

          media.addEventListener(
            'error',
            () =>
              reject(
                new Error(
                  'ملف الإعلان غير متاح'
                )
              ),
            {
              once: true
            }
          );

          media.src =
            source;

          if (isVideo) {
            media.load();
          }
        }
      );

      clearTimeout(timer);

      if (
        isVideo &&
        (
          !Number.isFinite(
            media.duration
          ) ||
          media.duration <= 0
        )
      ) {
        throw new Error(
          'مدة الفيديو غير صالحة'
        );
      }

      if (
        ticket !== generation
      ) {
        if (isVideo) {
          media.pause();

          media.removeAttribute(
            'src'
          );

          media.load();
        }

        return;
      }

      if (
        !isVideo &&
        media.decode
      ) {
        await media
          .decode()
          .catch(() => {});
      }

      if (
        ticket !== generation
      ) {
        return;
      }

      if (!isVideo) {
        host.replaceChildren(
          media
        );

        container.replaceChildren(
          card
        );
      }

      active = media;
      stalledAt = 0;

      playbackFailure = () => {
        clearSoundUnlock();

        try {
          media.pause();

          media.removeAttribute(
            'src'
          );

          media.load();
        } catch (_) {}

        active = null;

        host.textContent =
          'توقف تحميل الفيديو؛ ستتابع الشاشة تلقائيًا';

        host.style.cssText +=
          ';color:#fff;font-size:20px;padding:24px';

        onFailure?.(
          new Error(
            'توقف تحميل الفيديو'
          )
        );
      };

      if (isVideo) {
        try {
          /*
           * المحاولة الأولى:
           * تشغيل بالصوت.
           *
           * دي نفس طريقة النسخة
           * التي كان الفيديو يظهر معها.
           */
          media.muted = false;
          media.defaultMuted = false;
          media.volume = 1;

          await media.play();

        } catch (playError) {
          /*
           * لو Samsung / Chrome
           * رفض autoplay بالصوت:
           *
           * نرجع فورًا إلى التشغيل الصامت
           * بدون تغيير DOM
           * بدون reload
           * بدون src جديد.
           */
          media.muted = true;
          media.defaultMuted = true;
          media.volume = 0;

          await media.play();

          /*
           * بعد نجاح تشغيل الصورة،
           * نستمع لتفاعل الريموت
           * لفتح الصوت.
           */
          armSoundUnlock(
            media
          );
        }
      }

      if (
        ticket !== generation
      ) {
        return;
      }

      await new Promise(
        resolve =>
          requestAnimationFrame(
            () =>
              requestAnimationFrame(
                resolve
              )
          )
      );

      if (
        ticket !== generation
      ) {
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

      if (
        ticket !== generation
      ) {
        return;
      }

      clearSoundUnlock();

      if (isVideo) {
        try {
          media.pause();

          media.removeAttribute(
            'src'
          );

          media.load();
        } catch (_) {}
      }

      ready = true;

      host.textContent =
        isVideo
          ? 'تعذر تشغيل الفيديو؛ تحقق من الاتصال واستخدم MP4 / H.264. ستتابع الشاشة تلقائيًا.'
          : 'تعذر تحميل هذا الإعلان؛ ستتابع الشاشة تلقائيًا';

      host.style.cssText +=
        ';color:#fff;font-size:20px;padding:24px';

      container.replaceChildren(
        card
      );

      onFailure?.(
        error
      );
    }
  }

  function preload(row) {
    if (!row) {
      return;
    }

    /*
     * ممنوع video preload
     * داخل عنصر منفصل.
     */
    if (video(row)) {
      return;
    }

    imageSource(
      row.image_url
    ).catch(() => {});
  }

  function videoProgress() {
    if (
      active?.tagName !== 'VIDEO' ||
      !Number.isFinite(
        active.duration
      ) ||
      !ready
    ) {
      return null;
    }

    if (
      !active.ended &&
      active.readyState < 3
    ) {
      if (!stalledAt) {
        stalledAt =
          Date.now();
      }

    } else {
      stalledAt = 0;
    }

    if (
      active.error ||
      (
        stalledAt &&
        Date.now() -
          stalledAt >
          30000
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

  root.CITLTVMedia =
    Object.freeze({
      cancel,
      show,
      preload,
      video,
      videoProgress,
      waiting: () => !ready
    });

})(window);
