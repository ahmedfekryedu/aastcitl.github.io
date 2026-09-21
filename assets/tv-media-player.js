(function(root) {
  'use strict';
  let generation = 0, active, activeRow, ready = true, stalledAt = 0, playbackFailure;
  let pendingVideo = null;
  const retired = new Set();
  const audioUnlocked = new WeakSet();
  function releasePrevious() {
    for (const media of retired) if (!media.isConnected) { media.removeAttribute('src'); media.load(); retired.delete(media); }
  }
  function requestAudioUnlock() {
    const button=ensureAudioControl();button.textContent='اضغط هنا لتفعيل واختبار الصوت';
  }
  function ensureAudioControl() {
    let button=document.getElementById('tv-enable-audio');if(button)return button;
    button = document.createElement('button'); button.id = 'tv-enable-audio';
    button.textContent = 'تفعيل واختبار الصوت';
    button.style.cssText = 'position:relative;z-index:110;background:#F3A628;color:#172150;border-radius:9px;padding:7px 12px;margin-top:5px;font:700 13px Cairo,sans-serif;cursor:pointer';
    button.addEventListener('click', () => {
      // Unlock the current video's audio and the alarm in this same trusted gesture.
      if(active?.tagName==='VIDEO'&&activeRow?.play_sound&&!active.paused&&active.currentTime>0){audioUnlocked.add(active);play(active,true).catch(()=>{});}
      const attempt=root.CITLTVAudio?.test();
      Promise.resolve(attempt).then(()=>button.textContent='اختبار الصوت مرة أخرى').catch(()=>button.textContent='تعذر الصوت — اضغط للمحاولة');
    });
    (document.getElementById('current-time')?.parentElement||document.body).append(button);
    return button;
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
    activeRow = row;
    active.style.objectFit = active.tagName==='VIDEO' ? 'cover' : row.fit_mode === 'contain' ? 'contain' : 'cover';
    if (active.tagName === 'VIDEO' && active.muted === !!row.play_sound) {
      if(active.ended)active.muted=!row.play_sound;
      else if(!row.play_sound)active.muted=true;
      else if(active.ended||active.paused||!audioUnlocked.has(active))requestAudioUnlock();
      else {
        const media=active;media.muted=false;
        setTimeout(()=>{if(active===media&&activeRow?.play_sound&&media.paused&&!media.ended){play(media,false).catch(()=>{});requestAudioUnlock();}},150);
      }
    }

  }
  const images = new Map();
  const video = row => row?.media_type === 'video' || row?.mime_type === 'video/mp4' || /\.mp4(?:\?|$)/i.test(row?.image_url || '');
  function cancel(discardPreload = false) {
    generation++; ready = true;
    if(pendingVideo&&pendingVideo!==active){const media=pendingVideo;pendingVideo=null;media.pause();media.removeAttribute('src');media.load();media.closest('.poster-slide')?.remove();}
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
      pendingVideo=null;active = media; activeRow = row; stalledAt = 0;
      releasePrevious();
      playbackFailure = () => {
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
      if (video(row)) { if(pendingVideo===media)pendingVideo=null;media.pause(); media.removeAttribute('src'); media.load(); }
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
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',ensureAudioControl,{once:true});else ensureAudioControl();
  root.CITLTVMedia = Object.freeze({cancel,show,preload,video,videoProgress,updateSettings,releasePrevious,requestAudioUnlock,waiting:()=>!ready});
})(window);
