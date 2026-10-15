(async function(){'use strict';
 const title=document.getElementById('service-title'),message=document.getElementById('service-message'),key=new URLSearchParams(location.search).get('service');
 try{const cfg=window.CITLServiceConnection,controller=new AbortController(),timer=setTimeout(()=>controller.abort(),12000);let response;try{response=await fetch(cfg.url+'/rest/v1/rpc/citl_service_snapshot',{method:'POST',headers:{apikey:cfg.key,Authorization:'Bearer '+cfg.key,'Content-Type':'application/json'},body:'{}',cache:'no-store',signal:controller.signal});}finally{clearTimeout(timer);}if(!response.ok)throw Error('network');const result=await response.json(),service=result.services?.find(s=>s.key===key);if(!service)throw Error('service');title.textContent=service.title;message.textContent=service.message;
  if(service.state==='available'){title.textContent=service.label+' متاحة الآن';message.textContent='تمت إعادة إتاحة الخدمة. يمكنك العودة للصفحة الرئيسية وفتحها من جديد.';}document.title=title.textContent+' | CITL Smart System';
 }catch(_){message.textContent='تعذر جلب الرسالة المخصصة الآن. يمكنك العودة للصفحة الرئيسية أو إعادة المحاولة لاحقًا.';}
})();
