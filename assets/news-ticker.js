(function(root){
  'use strict';
  let last=null,watched=false;
  function apply(config,key='news_config'){
    const el=document.getElementById('news-ticker-content');if(!el||!config)return;
    const stamp=Number(config.updatedAt)||0;
    if(last?.key===key&&last.stamp>stamp)return;
    const text=String(config.text||''),parsed=Number(config.sliderVal),slider=Number.isFinite(parsed)?Math.max(0,Math.min(100,parsed)):50;
    const changed=el.dataset.lastText!==text;
    if(changed){el.textContent=text.split('\n').filter(line=>line.trim()).join('   ✦   ');el.dataset.lastText=text;}
    const animation=el.getAnimations()[0],oldDuration=Number(animation?.effect?.getTiming().duration),oldTime=Number(animation?.currentTime);
    const duration=Math.max(1,(el.scrollWidth+(el.parentElement?.clientWidth||innerWidth))/(35+slider*1.6));
    document.documentElement.style.setProperty('--ticker-speed',duration+'s');el.dataset.tickerSlider=String(slider);
    // Preserve the current position when only speed changes.
    if(!changed&&animation&&oldDuration>0&&Number.isFinite(oldTime))animation.currentTime=oldTime/oldDuration*duration*1000;
    last={config,key,stamp};
  }
  function publish(key,config){
    localStorage.setItem(key,JSON.stringify(config));
    root.dispatchEvent(new CustomEvent('citl:news-updated',{detail:{key,config}}));
  }
  function watch(client,getKey){
    if(watched)return;watched=true;let busy=false;
    const receive=(key,config)=>{if(key===getKey())apply(config,key);};
    root.addEventListener('citl:news-updated',event=>receive(event.detail.key,event.detail.config));
    root.addEventListener('storage',event=>{if(event.key===getKey()&&event.newValue){try{receive(event.key,JSON.parse(event.newValue));}catch(_){}}});
    const poll=async()=>{
      if(busy||document.hidden||!navigator.onLine)return;busy=true;const key=getKey(),controller=new AbortController(),timer=setTimeout(()=>controller.abort(),10000);
      try{const {data,error}=await client.from('site_settings').select('setting_value').eq('setting_key',key).maybeSingle().abortSignal(controller.signal);if(!error&&data?.setting_value)receive(key,data.setting_value);}catch(_){}
      finally{busy=false;clearTimeout(timer);}
    };
    client.channel('citl-news-immediate').on('postgres_changes',{event:'*',schema:'public',table:'site_settings'},payload=>{if(payload.new?.setting_value)receive(payload.new.setting_key,payload.new.setting_value);}).subscribe();
    setInterval(poll,5000);root.addEventListener('online',poll);document.addEventListener('visibilitychange',()=>{if(!document.hidden)poll();});
  }
  root.addEventListener('resize',()=>{if(last)apply(last.config,last.key);});
  document.fonts?.ready.then(()=>{if(last)apply(last.config,last.key);});
  root.CITLTicker=Object.freeze({apply,publish,watch});
})(window);
