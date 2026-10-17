(function(root){
 'use strict';
 const protectedPage=/^\/(dashboard|smrm|schedules|management|attendance|courses)(\/|$)/.test(location.pathname);
 const maintenance=/^\/maintenance(?:\/|$)/.test(location.pathname),nativeFetch=root.fetch.bind(root);
 let snapshot=null,inflight=null,checked=0,leaving=false,started=false,serviceAuthClient=null;
 const style=document.createElement('style');style.textContent='html.citl-services-checking body>*:not(script):not(#citl-service-recovery):not(#citl-connection-recovery):not(#global-loader){visibility:hidden!important}#citl-service-recovery{position:fixed;inset:20% 5% auto;z-index:99999;background:white;border:1px solid #e1e5ef;border-top:4px solid #f3a628;border-radius:16px;padding:28px;text-align:center;color:#2a3475;font-family:Cairo,sans-serif}#citl-service-recovery button,#citl-service-recovery a{display:inline-block;margin:12px;padding:10px 16px;background:#2a3475;color:white;border:0;border-radius:9px}';document.head.append(style);
 if(protectedPage||/^\/(study|today|tv_display)(\/|$)/.test(location.pathname))document.documentElement.classList.add('citl-services-checking');
 function client(){try{if(root.sb?.auth)return root.sb;if(typeof sb!=='undefined'&&sb?.auth)return sb;if(typeof supabaseClient!=='undefined'&&supabaseClient?.auth)return supabaseClient;}catch(_){}return null;}
 async function headers(){const c=client();let session;if(c){const r=await c.auth.getSession();if(r.error)throw r.error;session=r.data?.session;}
  if(!session){let saved;try{saved=JSON.parse(localStorage.getItem('sb-main-auth')||'null');}catch(_){}if(saved?.access_token){
   if(root.supabase?.createClient){serviceAuthClient||=root.supabase.createClient(root.CITLServiceConnection.url,root.CITLServiceConnection.key,{auth:{storageKey:'sb-main-auth',persistSession:true,autoRefreshToken:true,detectSessionInUrl:false}});const r=await serviceAuthClient.auth.getSession();if(r.error)throw r.error;session=r.data?.session;}else session=saved;
  }}
  return {'Content-Type':'application/json',apikey:root.CITLServiceConnection.key,Authorization:'Bearer '+(session?.access_token||root.CITLServiceConnection.key)};
 }

 async function load(force=false){if(inflight)return inflight;if(!force&&snapshot&&Date.now()-checked<15000)return snapshot;
  inflight=(async()=>{const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),12000);try{
   const response=await nativeFetch(root.CITLServiceConnection.url+'/rest/v1/rpc/citl_service_snapshot',{method:'POST',headers:await headers(),body:'{}',signal:controller.signal,cache:'no-store'});
   if(!response.ok)throw Error('تعذر التحقق من إتاحة الخدمات الآن. أعد المحاولة.');const result=await response.json();if(!Array.isArray(result.services))throw Error('تعذر قراءة إعدادات إتاحة الخدمات. تأكد من تثبيت تحديث قاعدة البيانات.');snapshot=result;checked=Date.now();decorate();return result;
  }finally{clearTimeout(timer);}})().finally(()=>inflight=null);return inflight;
 }
 function matches(route,url){const path=url.pathname.replace(/index\.html$/,'').replace(/\/?$/,'/');if(path!==route.path)return false;
  return Object.entries(route.query||{}).every(([k,v])=>url.searchParams.get(k)===v)&&Object.entries(route.query_not||{}).every(([k,v])=>url.searchParams.get(k)!==v);
 }
 function routeService(url=new URL(location.href)){return snapshot?.services.find(s=>s.routes.some(r=>matches(r,url)));}
 function block(key){if(leaving||maintenance)return;leaving=true;root.CITLPageBoot?.show('جاري تهيئة النظام');location.assign('/maintenance/?service='+encodeURIComponent(key));}
 function errorView(error){root.CITLPageBoot?.failure();document.documentElement.classList.add('citl-services-checking');let box=document.getElementById('citl-service-recovery');if(!box){box=document.createElement('section');box.id='citl-service-recovery';box.innerHTML='<h2>التحقق من إتاحة الخدمة</h2><p></p><button>إعادة المحاولة</button><a href="'+(protectedPage?'/dashboard/':'/')+'">العودة للصفحة الرئيسية</a>';document.body.append(box);box.querySelector('button').onclick=()=>checkPage(true).catch(errorView);}box.querySelector('p').textContent=error.message||'تعذر الاتصال؛ أعد المحاولة.';}
 async function checkPage(force=false){try{await load(force);}catch(error){if(!protectedPage&&!/^\/(study|today|tv_display)(\/|$)/.test(location.pathname)){document.documentElement.classList.remove('citl-services-checking');return true;}throw error;}const s=routeService();if(s&&!s.allowed){block(s.key);return false;}document.documentElement.classList.remove('citl-services-checking');document.getElementById('citl-service-recovery')?.remove();return true;}
 async function enter(key){try{await load();const s=snapshot.services.find(x=>x.key===key);if(!s)throw Error('خدمة غير معروفة');if(!s.allowed){block(key);return false;}return true;}catch(e){errorView(e);return false;}}
 function maintenanceNotice(){const s=routeService();let notice=document.getElementById('citl-maintenance-notice');if(!s||!s.allowed||s.state!=='maintenance'||maintenance){notice?.remove();return;}
  const signature=[s.key,s.reason,snapshot.manager].join(':');if(notice?.dataset.signature===signature)return;
  if(!notice){notice=document.createElement('aside');notice.id='citl-maintenance-notice';notice.setAttribute('role','status');const header=document.querySelector('body>header');if(header)header.after(notice);else document.body.prepend(notice);}
  notice.dataset.signature=signature;notice.replaceChildren();const copy=document.createElement('div'),title=document.createElement('strong'),description=document.createElement('span');title.textContent=s.label+' — قيد الصيانة';description.textContent='هذه الخدمة مغلقة أمام المستخدمين غير المستثنين. '+(s.reason==='system_management'?'أنت تدخل بصلاحية إدارة النظام.':'أنت تدخل ضمن الاستثناءات المسموح بها.');copy.append(title,description);notice.append(copy);
  if(snapshot.manager){const link=document.createElement('a');link.href='/dashboard/?open=services';link.textContent='إدارة الإتاحة';notice.append(link);}
 }
 function decorate(){if(!snapshot||!document.body)return;maintenanceNotice();document.querySelectorAll('a[href],.admin-tab[data-tab]').forEach(el=>{let s;if(el.dataset.tab)s=snapshot.services.find(x=>x.tab===el.dataset.tab);else{try{const url=new URL(el.href,location.href);if(url.origin===location.origin)s=routeService(url);}catch(_){}}
  if(!s)return;el.dataset.citlService=s.key;el.toggleAttribute('data-citl-service-hidden',!!s.hidden);
  let badge=el.querySelector(':scope > .citl-maintenance-badge');if(!s.allowed&&!s.hidden){if(!badge){badge=document.createElement('small');badge.className='citl-maintenance-badge';el.append(badge);}if(badge.textContent!=='قيد التحديث')badge.textContent='قيد التحديث';}else badge?.remove();
 });}
 // React to authoritative RPC denials as well as routes; no request/authorization mutation.
 root.fetch=async function(input,options){const response=await nativeFetch(input,options);if(response.status>=400&&String(input?.url||input).includes('/rest/v1/rpc/')){response.clone().json().then(e=>{const match=/^CITL_SERVICE_MAINTENANCE:([a-z_]+)$/.exec(e.message||'');if(match&&routeService()?.key===match[1])block(match[1]);}).catch(()=>{});}return response;};
 root.CITLServices=Object.freeze({load,checkPage,enter,decorate,decision:key=>snapshot?.services.find(s=>s.key===key),decisionByTab:tab=>snapshot?.services.find(s=>s.tab===tab),reset:()=>{checked=0;snapshot=null;}});
 document.addEventListener('click',e=>{const el=e.target.closest('[data-citl-service]');if(!el)return;const s=snapshot?.services.find(x=>x.key===el.dataset.citlService);if(s&&!s.allowed){e.preventDefault();e.stopImmediatePropagation();block(s.key);}},true);
 // A transient background outage must not replace an already verified TV/page with an overlay.
 // New entries still require verification; server guards remain authoritative for every operation.
 async function refresh(){if(document.hidden||leaving)return;try{await checkPage(true);}catch(e){if(!snapshot&&protectedPage)errorView(e);}}
 function start(){if(started)return;started=true;if(!protectedPage)checkPage(true).catch(errorView);
  let timer;new MutationObserver(()=>{clearTimeout(timer);timer=setTimeout(decorate,40);}).observe(document.body,{childList:true,subtree:true});
  // Targeted form entry; the database ticket endpoint is guarded independently.
  if(typeof root.toggleForms==='function'){const old=root.toggleForms;root.toggleForms=async function(){if(!document.getElementById('signupForm')?.classList.contains('hidden')||await enter('registration'))return old.apply(this,arguments);};}
  if(typeof root.openAddMeetingModal==='function'){const original=root.openAddMeetingModal;root.openAddMeetingModal=function(){const self=this,args=arguments,decision=snapshot?.services.find(s=>s.key==='meeting_booking');if(decision?.allowed)return original.apply(self,args);return enter('meeting_booking').then(ok=>{if(ok)return original.apply(self,args);});};}
  setInterval(refresh,20000);root.addEventListener('focus',refresh);root.addEventListener('online',refresh);document.addEventListener('visibilitychange',refresh);
 }
 root.addEventListener('citl-profile-loaded',()=>{checked=0;checkPage(true).catch(errorView);});
 root.addEventListener('storage',e=>{if(e.key==='sb-main-auth'){snapshot=null;checked=0;refresh();}});
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});else start();
})(window);
