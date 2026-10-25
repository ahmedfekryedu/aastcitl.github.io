(function(root){'use strict';
 const version='20261023-r6.9.2.38',cache=new Map();
 const text=url=>{if(!cache.has(url))cache.set(url,fetch(url,{cache:'no-cache'}).then(r=>{if(!r.ok)throw Error('تعذر تحميل ملفات المعاينة');return r.text();}).catch(e=>{cache.delete(url);throw e;}));return cache.get(url);};
 let logo;const getLogo=()=>logo||(logo=fetch('/CITL.png').then(r=>r.blob()).then(b=>new Promise((ok,no)=>{const r=new FileReader();r.onload=()=>ok(r.result);r.onerror=no;r.readAsDataURL(b);})).catch(e=>{logo=null;throw e;}));
 const json=x=>JSON.stringify(x).replace(/</g,'\\u003c');
 async function mount(host,snapshot,page,active){
  if(!['schedules','smrm'].includes(page))throw Error('Unsupported preview page');
  const token={};host._previewToken=token;host.innerHTML='<div class="citl-preview-skeleton"></div>';
  const doc=new DOMParser().parseFromString(await text('/'+page+'/?preview-template='+version),'text/html');
  const sheets=[...new Set([...doc.querySelectorAll('link[rel=stylesheet]')].map(e=>new URL(e.getAttribute('href'),location.origin+'/'+page+'/')).filter(u=>u.origin===location.origin).map(u=>u.pathname))];
  const modules=['permissions.js','study-model.js','account-preview-views.js','academic-booking.js','room-availability.js','account-preview-page-runtime.js'];
  const [css,js,logoURL]=await Promise.all([Promise.all(sheets.map(f=>text(f+'?v='+version))),Promise.all(modules.map(f=>text('/assets/'+f+'?v='+version))),getLogo()]);
  if(!host.isConnected||host._previewToken!==token||!active())return;
  const parts=[doc.querySelector('.citl-main-header'),doc.querySelector('main'),doc.querySelector('.citl-main-footer')];
  if(parts.some(x=>!x))throw Error('قالب الصفحة غير مكتمل');
  for(const part of parts){part.querySelectorAll('script,iframe,form,dialog').forEach(e=>e.remove());for(const el of [part,...part.querySelectorAll('*')]){
   const click=el.getAttribute('onclick')||'';
   if(/openRoomPicker/.test(click))el.dataset.previewAction='room';
   else if(/applyFilters/.test(click))el.dataset.previewAction='filter';
   else if(/resetFilters/.test(click))el.dataset.previewAction='reset';
   else if(/notif/i.test(click))el.dataset.previewTab='notifications';
   else if(/MobileMenu/.test(click))el.dataset.previewAction='menu';
   else if(/Logout/.test(click))el.dataset.previewAction='exit';
   else if(/openScheduleHub|openMyScheduleModal/.test(click))el.dataset.previewAction='personal';
   else if(click)el.dataset.previewAction='readonly';
   for(const a of [...el.attributes])if(a.name.startsWith('on'))el.removeAttribute(a.name);
   if(el.tagName==='IMG'&&el.getAttribute('src')?.includes('CITL.png'))el.src=logoURL;
   if(el.tagName==='A'){const href=el.getAttribute('href')||'';el.dataset.previewTab=href.includes('/schedules')?'schedules-page':href.includes('/smrm')?'rooms-page':href.includes('/dashboard')?'dashboard':'profile';el.href='#';el.removeAttribute('target');}
  }}
  for(const id of ['profile-name','profile-name-mob']){const el=doc.getElementById(id);if(el)el.textContent=snapshot.profile.full_name||snapshot.profile.email;}
  for(const id of ['profile-role','profile-role-mob']){const el=doc.getElementById(id);if(el)el.textContent=snapshot.profile.position||'';}
  const nonce=crypto.randomUUID(),origin=location.origin;
  const csp="default-src 'none'; script-src 'nonce-"+nonce+"'; style-src 'unsafe-inline' "+origin+" https://cdnjs.cloudflare.com; font-src "+origin+" https://cdnjs.cloudflare.com; img-src data: "+origin+"; connect-src 'none'; form-action 'none'; base-uri "+origin;
  const script=code=>'<script nonce="'+nonce+'">'+code.replace(/<\/script/gi,'<\\/script')+'</script>';
  const iframe=document.createElement('iframe');iframe.title=(page==='smrm'?'القاعات الدراسية':'الجداول الدراسية')+' — معاينة فقط';iframe.setAttribute('sandbox','allow-scripts');iframe.referrerPolicy='no-referrer';
  iframe.srcdoc='<!doctype html><html dir="rtl" lang="ar"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta http-equiv="Content-Security-Policy" content="'+csp+'"><base href="'+origin+'/">'+css.map(s=>'<style>'+s.replace(/<\/style/gi,'<\\/style')+'</style>').join('')+[...doc.head.querySelectorAll('style')].map(e=>e.outerHTML).join('')+'<link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css"><style>html,body{margin:0!important;visibility:visible!important;opacity:1!important;overflow-x:hidden;background:#f5f6fa!important;font-family:Cairo,sans-serif}body{display:flex;flex-direction:column;min-height:100vh}.citl-main-header{position:relative!important}main{min-width:0}#preview-detail{position:fixed;inset:12px;margin:auto;height:fit-content;overflow:auto;box-sizing:border-box;z-index:2147483647;background:white;box-shadow:0 0 0 100vmax #17234f99;width:min(580px,calc(100vw - 28px));max-height:85dvh;border:1px solid #dbe0ed;border-radius:14px;padding:18px;color:#2a3475}#preview-detail::backdrop{background:#17234f99}#preview-detail dl>div{padding:9px;border-bottom:1px solid #eee}#preview-detail [data-preview-close]{position:relative;z-index:1;display:flex;align-items:center;justify-content:center;width:36px;height:36px;min-width:36px;border:1px solid #dbe0ed;border-radius:8px;background:#f1f3f9;color:#2a3475;cursor:pointer;pointer-events:auto}#preview-detail dt{font-weight:bold}#preview-detail dd{margin:3px 0;white-space:pre-wrap;overflow-wrap:anywhere}.preview-page-tools{display:flex;gap:8px;flex-wrap:wrap;margin:12px 0}.preview-page-tools button,.preview-page-tools select{padding:8px;border:1px solid #dce1ed;border-radius:8px;background:white;color:#2a3475}#preview-status{color:#a33e2a;padding:8px}#preview-menu{position:fixed;top:100px;right:12px;z-index:9999;background:white;padding:16px;border-radius:12px;box-shadow:0 10px 40px #0003}#preview-menu button{display:block;padding:10px;width:100%;text-align:right}.citl-booking-toggle{margin-top:0}.citl-account-preview{display:none}</style></head><body>'+parts.map(e=>e.outerHTML).join('')+'<nav id="preview-menu" hidden><button data-preview-tab="dashboard">الرئيسية</button><button data-preview-tab="rooms-page">القاعات الدراسية</button><button data-preview-tab="schedules-page">الجداول الدراسية</button><button data-preview-tab="notifications">الإشعارات</button></nav><section id="preview-detail" role="dialog" aria-modal="true" aria-label="تفاصيل المعاينة" hidden><button type="button" data-preview-close aria-label="إغلاق">×</button><h3></h3><dl></dl></section>'+script('window.CITLPreviewSnapshot='+json(snapshot)+';window.CITLPreviewPage='+json(page)+';window.currentUser=CITLPreviewSnapshot.profile;')+js.map(script).join('')+'</body></html>';
  host.replaceChildren(iframe);
 }
 root.CITLPreviewPages=Object.freeze({mount});
})(window);
