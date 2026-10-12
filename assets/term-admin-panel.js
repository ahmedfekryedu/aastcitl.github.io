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
 let timer;
 function start(){
  clearTimeout(timer);placeholder.innerHTML=skeleton;placeholder.hidden=false;frame.style.visibility='hidden';content.setAttribute('aria-busy','true');
  frame.src='/management/?embedded=1&manage=schedules&v=20261012-r6.8.8.1#schedules';
  timer=setTimeout(()=>{
   content.setAttribute('aria-busy','false');placeholder.replaceChildren();
   const text=document.createElement('p');text.textContent='تعذر تحميل إدارة الجداول الآن.';
   const retry=document.createElement('button');retry.type='button';retry.className='citl-term-retry';retry.textContent='إعادة المحاولة';retry.onclick=start;placeholder.append(text,retry);
  },30000);
 }
 root.addEventListener('message',event=>{
  if(event.origin!==location.origin||event.source!==frame.contentWindow||event.data?.type!=='citl-schedules-ready')return;
  clearTimeout(timer);placeholder.hidden=true;frame.style.visibility='visible';content.setAttribute('aria-busy','false');
 });
 content.append(placeholder,frame);modal.querySelector('.admin-tab-content')?.parentElement.append(content);
 button.addEventListener('click',()=>{
  if(!root.CITLPermissions.full(typeof currentUser!=='undefined'?currentUser:root.currentUser))return;
  if(!frame.getAttribute('src'))start();
 });
 let opened=false;
 root.CITLOpenTermAdmin=()=>{
  if(opened||new URLSearchParams(location.search).get('open')!=='term-schedules'||!root.CITLPermissions.full(typeof currentUser!=='undefined'?currentUser:root.currentUser))return;
  opened=true;root.openAdminPanel();button.click();
 };
})(window);
