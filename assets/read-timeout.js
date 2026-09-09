/* Bound read requests so an unavailable connection cannot leave the page loader open forever.
   Writes and uploads keep the SDK's original behavior. No database functions are added. */
(function(root){
  'use strict';
  root.CITLReadFetch=async function(input,options={}){
    const method=String(options.method||input?.method||'GET').toUpperCase();
    if(method!=='GET'&&method!=='HEAD')return fetch(input,options);
    const controller=new AbortController(),original=options.signal;
    const abort=()=>controller.abort(original?.reason);
    if(original?.aborted)abort();else original?.addEventListener('abort',abort,{once:true});
    const timer=setTimeout(()=>controller.abort(),15000);
    try{return await fetch(input,{...options,signal:controller.signal});}
    finally{clearTimeout(timer);original?.removeEventListener('abort',abort);}
  };
})(window);
