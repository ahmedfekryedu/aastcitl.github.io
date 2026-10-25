/* Safe reads get one fresh retry; caller cancellation and writes never retry. */
(function(root){'use strict';
const events=[];function record(method,status){events.push({time:new Date().toISOString(),method,status});if(events.length>30)events.shift();}
root.CITLReadFetch=async function(input,options={}){
 const method=String(options.method||input?.method||'GET').toUpperCase();if(method!=='GET'&&method!=='HEAD')return fetch(input,options);
 const original=options.signal||input?.signal;
 for(let attempt=0;attempt<2;attempt++){
  const controller=new AbortController();let timedOut=false;const abort=()=>controller.abort(original?.reason);
  if(original?.aborted)abort();else original?.addEventListener('abort',abort,{once:true});
  const timer=setTimeout(()=>{timedOut=true;controller.abort();},attempt===0?12000:8000);
  try{
   const response=await fetch(input,{...options,signal:controller.signal});
   if(attempt===0&&[502,503,504].includes(response.status)&&!original?.aborted){try{await response.body?.cancel();}catch(_){}continue;}
   if(response.status>=400)record(method,response.status);return response;
  }catch(error){
   if(original?.aborted)throw error;
   if(attempt===0&&navigator.onLine!==false&&(timedOut||error instanceof TypeError))continue;
   record(method,timedOut?'timeout':'network');
   if(timedOut)throw Object.assign(new Error('تأخر الاتصال بالخدمة. أعد المحاولة؛ لم تتغير بياناتك.'),{code:'CITL_TIMEOUT'});
   throw error;
  }finally{clearTimeout(timer);original?.removeEventListener('abort',abort);}
 }
};
root.CITLDiagnostics=Object.freeze({snapshot:()=>events.map(x=>({...x})),clear:()=>{events.length=0;}});
})(window);
