(function(root) {
  'use strict';
  let context, buffer, loading, source, gain, unlocked=false;
  const fallback = document.createElement('audio');
  fallback.id='tv-alarm-audio'; fallback.src='/alarm.mp3'; fallback.preload='auto';
  fallback.style.display='none';
  if(document.body)document.body.append(fallback);else document.addEventListener('DOMContentLoaded',()=>document.body.append(fallback),{once:true});
  function blocked() { return new DOMException('اضغط أيقونة الإعلان بجانب العنوان لتفعيل واختبار الصوت', 'NotAllowedError'); }
  function getContext() {
    const Constructor=root.AudioContext||root.webkitAudioContext;
    if(!Constructor)return null;
    if(!context||context.state==='closed')context=new Constructor();
    return context;
  }
  function prepare() {
    if(buffer)return Promise.resolve(buffer);
    if(!loading)loading=fetch('/alarm.mp3').then(r=>{if(!r.ok)throw new Error('ملف التنبيه غير متاح');return r.arrayBuffer();})
      .then(data=>new Promise((resolve,reject)=>context.decodeAudioData(data,resolve,reject)))
      .then(value=>buffer=value).catch(error=>{loading=null;throw error;});
    return loading;
  }
  let epoch=0;
  function pause() {
    epoch++;const current=source,currentGain=gain;source=null;gain=null;
    if(current){current.onended=null;try{current.stop();}catch(_){}current.disconnect();}
    if(currentGain)currentGain.disconnect();
    fallback.pause();try{fallback.currentTime=0;}catch(_){}
  }
  async function resume(ctx) {
    if(ctx.state==='running')return;
    if(!unlocked)throw blocked();
    let timer;
    try{await Promise.race([ctx.resume(),new Promise((_,reject)=>{timer=setTimeout(()=>reject(blocked()),2000);})]);}
    finally{clearTimeout(timer);}
    if(ctx.state!=='running')throw blocked();
  }
  async function play() {
    pause();const ticket=epoch;
    root.dispatchEvent(new Event('citl-tv-alarm-attempt'));
    try {
      const ctx=getContext();
      if(!ctx)throw new Error('Web Audio unavailable');
      await resume(ctx);if(ticket!==epoch)return;
      const decoded=await prepare();if(ticket!==epoch)return;
      await resume(ctx);if(ticket!==epoch)return;
      source=ctx.createBufferSource();source.buffer=decoded;
      gain=ctx.createGain();gain.gain.value=.6;source.connect(gain);gain.connect(ctx.destination);
      const current=source,currentGain=gain;
      current.onended=()=>{current.disconnect();currentGain.disconnect();if(source===current){source=null;gain=null;}};
      source.start();
    } catch(error) {
      if(ticket!==epoch)return;
      // A decoder/Web Audio failure must not disable the working HTML audio path.
      // Never bypass an explicit autoplay rejection or start an old slide's alarm.
      if(error.name==='NotAllowedError')throw error;
      fallback.volume=.6;await fallback.play();if(ticket!==epoch)return;
    }
    root.dispatchEvent(new Event('citl-tv-alarm-start'));
  }
  async function test() {
    unlocked=true;
    // play() invokes resume synchronously, preserving this click's activation.
    return play();
  }
  root.CITLTVAudio={play,pause,test,get state(){return context?.state || (fallback.paused?'idle':'running');}};
})(window);
