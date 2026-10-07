(function(root) {
  'use strict';
  let generation = 0, active, activeRow, ready = true, stalledAt = 0, playbackFailure;
  let pendingVideo = null;
  const retired = new Set();
  let audioEnabled = false;
  // A playlist creates a new VIDEO node each cycle. Remember the user's choice
  // by media record for this page session, not by the discarded DOM element.
  const manualAudio = new Set();
  const audioKey = row => String(row?.id ?? row?.image_url ?? '');
  function enableVideoAudio(media) {
    if(media!==active||media.paused||media.ended||media.currentTime<=0)return;
    media.volume=1;media.muted=false;
    // Unmute an already-playing decoder; never start audible playback or reload it.
    setTimeout(()=>{
      if(active===media&&media.paused&&!media.ended&&!media.muted){
        audioEnabled=false;manualAudio.delete(audioKey(activeRow));media.muted=true;
        play(media,false).catch(()=>{});requestAudioUnlock();
      }
    },150);
  }
  function releasePrevious() {
    for (const media of retired) if (!media.isConnected) { root.CITLVideoLayout?.release(media);media.removeAttribute('src'); media.load(); retired.delete(media); }
  }
  function requestAudioUnlock() {
    const button=active?.closest('.poster-slide')?.querySelector('[data-tv-audio-control]');
    if(button)audioLabel(button,'اضغط لتفعيل واختبار الصوت');
  }
  function audioLabel(button,label) {
    button.title=label;button.setAttribute('aria-label',label);
  }
  function bindAudioControl(card) {
    const button=card.querySelector('[data-tv-audio-control]');if(!button)return;
    button.addEventListener('click', () => {
      // Unlock the current video's audio and the alarm in this same trusted gesture.
      audioEnabled=true;
      if(active?.tagName==='VIDEO'){manualAudio.add(audioKey(activeRow));enableVideoAudio(active);}
      const attempt=root.CITLTVAudio?.test();
      Promise.resolve(attempt).then(()=>audioLabel(button,'اختبار الصوت مرة أخرى')).catch(()=>audioLabel(button,'تعذر الصوت — اضغط للمحاولة'));
    });
  }
  async function play(media, sound) {
    const position = media.currentTime;
    media.muted = !sound;
    try { await media.play(); }
    catch (error) {
      if (!sound || error.name !== 'NotAllowedError') throw error;
      media.muted = true; await media.play(); requestAudioUnlock();
    }
    // Retain the current scene if resuming after a blocked unmute resets playback.
    if (position > .1 && media.currentTime < position - .1) media.currentTime = position;
  }
  function updateSettings(row) {
    if (!row || !active) return;
    if(activeRow?.play_sound!==row.play_sound&&!row.play_sound)manualAudio.delete(audioKey(activeRow));
    activeRow = {...row};
    active.style.objectFit = active.tagName==='VIDEO' ? (active.dataset.videoPlane==='native'?'fill':'cover') : row.fit_mode === 'contain' ? 'contain' : 'cover';
    if (active.tagName === 'VIDEO') {
      if(!row.play_sound&&!manualAudio.has(audioKey(activeRow)))active.muted=true;
      else if(audioEnabled)enableVideoAudio(active);
      else requestAudioUnlock();
    }

  }
  const images = new Map();
  const video = row => row?.media_type === 'video' || row?.mime_type === 'video/mp4' || /\.mp4(?:\?|$)/i.test(row?.image_url || '');
  function cancel(discardPreload = false) {
    generation++; ready = true;
    if(pendingVideo&&pendingVideo!==active){const media=pendingVideo;pendingVideo=null;root.CITLVideoLayout?.release(media);media.pause();media.removeAttribute('src');media.load();media.closest('.poster-slide')?.remove();}
    if (active?.tagName === 'VIDEO') { active.pause(); retired.add(active); }
    active = null; activeRow = null; stalledAt = 0; playbackFailure = null;
    releasePrevious();
  }
  async function imageSource(url) {
    if (images.has(url)) return images.get(url);
    const task = (async () => {
      try {
        const cache = await caches.open('citl-posters-images');
        let response = await cache.match(url);
        if (!response) {
          response = await fetch(url, {signal:AbortSignal.timeout(20000)});
          if (!response.ok) throw new Error('image unavailable');
          await cache.put(url, response.clone());
          const keys = await cache.keys();
          await Promise.all(keys.slice(0, Math.max(0, keys.length - 30)).map(key => cache.delete(key)));
        }
        const source = URL.createObjectURL(await response.blob());
        return source;
      } catch (_) { return url; } // Normal browser loading still works when CORS/cache storage is unavailable.
    })();
    images.set(url, task);
    while (images.size > 3) {
      const key = images.keys().next().value, removed = images.get(key); images.delete(key);
      removed.then(source => { if (source.startsWith('blob:')) URL.revokeObjectURL(source); });
    }
    return task;
  }
  async function show(row, card, host, container, onVisible, onFailure) {
    const ticket = generation; ready = false;
    bindAudioControl(card);
    const media = document.createElement(video(row) ? 'video' : 'img');
    media.className = 'w-full h-full rounded-xl shadow-2xl';
    media.style.objectFit = video(row) ? 'cover' : row.fit_mode === 'contain' ? 'contain' : 'cover';
    media.id = video(row) ? 'active-poster-video' : 'active-poster-img';
    if (video(row)) { media.setAttribute('muted','');media.defaultMuted=true;media.muted = true; media.autoplay = false; media.loop = false; media.playsInline = true; media.preload = 'auto'; }
    else { media.alt = row.title || 'إعلان'; media.decoding = 'async'; }
    const source = video(row) ? row.image_url : await imageSource(row.image_url);
    if (ticket !== generation) return;
    let timer;
    try {
      if(video(row)) {
        // Samsung needs the final video element in the DOM BEFORE src/load.
        // Keep the previous card above it until the new stream is ready, without moving the video later.
        const previous=container.firstElementChild;
        if(previous){previous.style.position='relative';previous.style.zIndex='2';previous.style.opacity='1';}
        container.style.position='relative';card.style.position='absolute';card.style.inset='0';card.style.zIndex='1';
        host.replaceChildren(media);container.append(card);pendingVideo=media;
        root.CITLVideoLayout?.attach(media,host,row,{tv:true});
      }
      await new Promise((resolve, reject) => {
        timer = setTimeout(() => reject(new Error('تعذر تحميل الإعلان')), 25000);
        media.addEventListener(video(row) ? 'loadeddata' : 'load', resolve, {once:true});
        media.addEventListener('error', () => reject(new Error('ملف الإعلان غير متاح')), {once:true});
        media.src = source; if (video(row)) media.load();
      });
      clearTimeout(timer);
      if (video(row) && (!Number.isFinite(media.duration) || media.duration <= 0 || !media.videoWidth || !media.videoHeight)) throw new Error('تعذر فك صورة الفيديو؛ أعد رفعه بالإصدار الجديد');
      if (ticket !== generation) { if (video(row)) { media.pause(); media.removeAttribute('src'); media.load(); card.remove(); } return; }
      if (!video(row) && media.decode) await media.decode().catch(() => {});
      if (ticket !== generation) return;
      // Start decoding before swapping cards; leave the previous frame visible while loading.
      if (video(row)) {
        try {await Promise.race([play(media,false),new Promise((_,reject)=>{timer=setTimeout(()=>reject(new Error('تعذر بدء تشغيل الفيديو')),12000);})]);}
        finally {clearTimeout(timer);}
      }
      if (ticket !== generation) { media.pause?.();card.remove();return; }
      if(video(row)) {
        for(const previous of [...container.children])if(previous!==card)previous.remove();
        card.style.position='';card.style.inset='';card.style.zIndex='';
      } else {host.replaceChildren(media); container.replaceChildren(card);}
      pendingVideo=null;active = media; activeRow = {...row}; stalledAt = 0;
      if(video(row)){
        const afterPlaying=()=>{
          if(media!==active||media.currentTime<=0||media.paused)return;
          media.removeEventListener('timeupdate',afterPlaying);
          if(audioEnabled&&(activeRow.play_sound||manualAudio.has(audioKey(activeRow))))enableVideoAudio(media);
        };
        media.addEventListener('timeupdate',afterPlaying);afterPlaying();
      }
      releasePrevious();
      playbackFailure = () => {
        root.CITLVideoLayout?.release(media);
        media.pause(); media.removeAttribute('src'); media.load(); active = null;
        host.textContent = 'توقف تحميل الفيديو؛ ستتابع الشاشة تلقائيًا';
        host.style.cssText += ';color:#fff;font-size:20px;padding:24px';
        onFailure?.(new Error('توقف تحميل الفيديو'));
      };
      if (ticket !== generation) return;
      await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
      if (ticket !== generation) return;
      ready = true; onVisible(video(row) ? media.duration : null);
    } catch (error) {
      clearTimeout(timer);
      if (ticket !== generation) return;
      if (video(row)) { root.CITLVideoLayout?.release(media);if(pendingVideo===media)pendingVideo=null;media.pause(); media.removeAttribute('src'); media.load(); }
      ready = true;
      host.textContent = video(row) ? 'تعذر تشغيل الفيديو؛ تحقق من الاتصال واستخدم MP4 / H.264. ستتابع الشاشة تلقائيًا.' : 'تعذر تحميل هذا الإعلان؛ ستتابع الشاشة تلقائيًا';
      host.style.cssText += ';color:#fff;font-size:20px;padding:24px';
      container.replaceChildren(card); releasePrevious(); onFailure?.(error);
    }
  }
  function preload(row) {
    if (!row) return;
    if (!video(row)) { imageSource(row.image_url).catch(() => {}); return; }
    // Do not allocate/load detached video decoders on Samsung.
  }
  function videoProgress() {
    if (active?.tagName !== 'VIDEO' || !Number.isFinite(active.duration) || !ready) return null;
    if (!active.ended && active.readyState < 3) { if (!stalledAt) stalledAt = Date.now(); } else stalledAt = 0;
    if (active.error || (stalledAt && Date.now()-stalledAt>30000)) { playbackFailure?.(); return null; }
    return active.ended ? 100 : Math.min(99.99, active.currentTime / active.duration * 100);
  }
  root.CITLTVMedia = Object.freeze({cancel,show,preload,video,videoProgress,updateSettings,releasePrevious,requestAudioUnlock,waiting:()=>!ready});
})(window);
