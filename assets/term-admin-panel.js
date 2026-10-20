// One shared entry in the existing SMRM/dashboard panel; same nav styles and permissions.
(function(root){
 'use strict';
 const modal=document.getElementById('admin-panel-modal');if(!modal)return;
 const sample=modal.querySelector('.admin-tab[data-tab="news"]');if(!sample)return;
 const button=sample.cloneNode(true);button.dataset.tab='term-schedules';button.classList.remove('active');
 button.querySelector('span').textContent='إدارة الجداول';
 const icon=button.querySelector('i');if(icon)icon.className='fas fa-calendar-alt';
 sample.after(button);
 const content=document.createElement('div');content.id='admin-term-schedules-tab';content.className='admin-tab-content hidden';
 const frame=document.createElement('iframe');frame.title='إدارة الجداول';
 frame.style.cssText='display:block;width:100%;height:calc(85vh - 135px);min-height:420px;border:0;background:#f8fafc';
 const placeholder=document.createElement('div');placeholder.className='citl-term-loading';placeholder.setAttribute('role','status');
 const skeleton='<span class="citl-loading-label">جارٍ تحميل إدارة الجداول…</span><div aria-hidden="true"><span class="citl-skeleton-line short"></span><span class="citl-skeleton-line"></span><span class="citl-skeleton-line tall"></span><div class="citl-term-fields">'+Array.from({length:4},()=>'<div><span class="citl-skeleton-line short"></span><span class="citl-skeleton-line tall"></span></div>').join('')+'</div><span class="citl-skeleton-line tall"></span><span class="citl-skeleton-line tall"></span></div>';
 let timer,resize,dialogs;
 // The full control page scrolls as one document; legacy modal keeps its bounded frame.
 function fitDialogs(){
  if(!document.documentElement.hasAttribute('data-citl-control-page'))return;
  const rect=frame.getBoundingClientRect();
  frame.contentDocument?.querySelectorAll('dialog[open]').forEach(d=>{
   d.style.maxHeight=Math.max(160,root.innerHeight-40)+'px';d.style.position='fixed';d.style.margin='0';d.style.bottom='auto';d.style.left='50%';d.style.right='auto';d.style.transform='translateX(-50%)';
   const top=Math.max(12,Math.min(frame.clientHeight-d.offsetHeight-12,root.innerHeight/2-rect.top-d.offsetHeight/2));d.style.top=top+'px';
  });
 }
 function fitFrame(){
  if(!document.documentElement.hasAttribute('data-citl-control-page'))return;
  try{const doc=frame.contentDocument,main=doc?.querySelector('main');if(!main)return;
   const height=Math.ceil(main.getBoundingClientRect().height+Math.max(0,main.offsetTop)+16);
   if(height>16)frame.style.height=Math.max(420,height)+'px';
  }catch(_){/* Same-origin content only. */}
 }
 frame.addEventListener('load',()=>{resize?.disconnect();dialogs?.disconnect();if(!document.documentElement.hasAttribute('data-citl-control-page'))return;const main=frame.contentDocument?.querySelector('main');if(main){resize=new ResizeObserver(fitFrame);resize.observe(main);fitFrame();dialogs=new MutationObserver(fitDialogs);dialogs.observe(frame.contentDocument.body,{subtree:true,attributes:true,attributeFilter:['open']});fitDialogs();}});
 root.addEventListener('resize',()=>{fitFrame();fitDialogs();});root.addEventListener('scroll',fitDialogs,{passive:true});

 function start(){
  if(root.CITLServices?.decision('schedule_admin')?.allowed===false){root.CITLServices.enter('schedule_admin');return;}
  clearTimeout(timer);placeholder.innerHTML=skeleton;placeholder.hidden=false;frame.style.visibility='hidden';content.setAttribute('aria-busy','true');
  frame.src='/management/?embedded=1&manage=schedules&v=20261013-r6.8.10#schedules';
  timer=setTimeout(()=>{
   content.setAttribute('aria-busy','false');placeholder.replaceChildren();
   const text=document.createElement('p');text.textContent='تعذر تحميل إدارة الجداول الآن.';
   const retry=document.createElement('button');retry.type='button';retry.className='citl-term-retry';retry.textContent='إعادة المحاولة';retry.onclick=start;placeholder.append(text,retry);
  },30000);
 }
 root.addEventListener('message',event=>{
  if(event.origin!==location.origin||event.source!==frame.contentWindow||event.data?.type!=='citl-schedules-ready')return;
  fitFrame();clearTimeout(timer);placeholder.hidden=true;frame.style.visibility='visible';content.setAttribute('aria-busy','false');
 });
 content.append(placeholder,frame);modal.querySelector('.admin-tab-content')?.parentElement.append(content);
 root.CITLLoadTermAdmin=()=>{if(root.CITLPermissions.can(root.currentUser,'can_manage_schedules')&&!frame.getAttribute('src'))start();};
 button.addEventListener('click',()=>{
  if(!root.CITLPermissions.can(typeof currentUser!=='undefined'?currentUser:root.currentUser,'can_manage_schedules'))return;
  if(!frame.getAttribute('src'))start();
 });
 let opened=false;
 root.CITLOpenTermAdmin=()=>{
  if(opened||new URLSearchParams(location.search).get('open')!=='term-schedules'||!root.CITLPermissions.can(typeof currentUser!=='undefined'?currentUser:root.currentUser,'can_manage_schedules'))return;
  opened=true;root.openAdminPanel();button.click();
 };
})(window);
