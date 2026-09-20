/* Bound read requests so an unavailable connection cannot leave the page loader open forever.
   Writes and uploads keep the SDK's original behavior. No database functions are added. */
(function(root){
  'use strict';
  root.CITLReadFetch=async function(input,options={}){
    const method=String(options.method||input?.method||'GET').toUpperCase();
    if(method!=='GET'&&method!=='HEAD')return fetch(input,options);
    const controller=new AbortController(),original=options.signal||input?.signal;
    const abort=()=>controller.abort(original?.reason);
    if(original?.aborted)abort();else original?.addEventListener('abort',abort,{once:true});
    const timer=setTimeout(()=>controller.abort(),15000);
    try{
      // One retry for safe reads only, inside the same total 15-second deadline.
      for(let attempt=0;attempt<2;attempt++){
        try{
          const response=await fetch(input,{...options,signal:controller.signal});
          if(attempt===0 && [502,503,504].includes(response.status) && !controller.signal.aborted){
            try{await response.body?.cancel();}catch(_){}
            await new Promise(resolve=>setTimeout(resolve,300));
            continue;
          }
          if(response.status>=400) record(method,response.status);
          return response;
        }catch(error){
          if(attempt===0 && !controller.signal.aborted){await new Promise(resolve=>setTimeout(resolve,300));continue;}
          record(method,controller.signal.aborted?'timeout-or-cancel':'network');
          throw error;
        }
      }
    }
    finally{clearTimeout(timer);original?.removeEventListener('abort',abort);}
  };
  const events=[];
  function record(method,status){
    // No URLs, tokens, names, payloads or server error text are retained.
    events.push({time:new Date().toISOString(),method,status});
    if(events.length>30)events.shift();
  }
  root.CITLDiagnostics=Object.freeze({snapshot:()=>events.map(event=>({...event})),clear:()=>{events.length=0;}});
})(window);
