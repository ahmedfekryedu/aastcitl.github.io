(function(root) {
  'use strict';
  let context, buffer, loading, source;
  const fallback = document.createElement('audio');
  fallback.id='tv-alarm-audio'; fallback.src='/alarm.mp3'; fallback.preload='auto';
  fallback.style.display='none';
  if(document.body)document.body.append(fallback);else document.addEventListener('DOMContentLoaded',()=>document.body.append(fallback),{once:true});
  function blocked() { return new DOMException('اضغط أيقونة الإعلان بجانب العنوان لتفعيل واختبار الصوت', 'NotAllowedError'); }
  function getContext() {
    const Constructor=root.AudioContext||root.webkitAudioContext;
    if(!Constructor)return null;
    if(!context)context=new Constructor();
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
  function pause() { epoch++;if(source){try{source.stop();}catch(_){}source.disconnect();source=null;}fallback.pause();try{fallback.currentTime=0;}catch(_){} }
  async function play() {
    pause();const ticket=epoch;
    root.dispatchEvent(new Event('citl-tv-alarm-attempt'));
    const ctx=getContext();
    if(ctx) {
      if(ctx.state!=='running')throw blocked();
      const decoded=await prepare();if(ticket!==epoch)return;
      source=ctx.createBufferSource();source.buffer=decoded;
      const gain=ctx.createGain();gain.gain.value=.6;source.connect(gain);gain.connect(ctx.destination);source.start();
    } else { fallback.volume=.6;await fallback.play(); }
    root.dispatchEvent(new Event('citl-tv-alarm-start'));
  }
  async function test() {
    const ctx=getContext();
    // resume is called synchronously from the remote/click gesture.
    if(ctx)await ctx.resume();
    return play();
  }
  root.CITLTVAudio={play,pause,test,get state(){return context?.state || (fallback.paused?'idle':'running');}};
})(window);
