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
 content.append(frame);modal.querySelector('.admin-tab-content')?.parentElement.append(content);
 button.addEventListener('click',()=>{
  if(!root.CITLPermissions.full(typeof currentUser!=='undefined'?currentUser:root.currentUser))return;
  if(!frame.getAttribute('src'))frame.src='/management/?embedded=1&manage=schedules#schedules';
 });
 let opened=false;
 root.CITLOpenTermAdmin=()=>{
  if(opened||new URLSearchParams(location.search).get('open')!=='term-schedules'||!root.CITLPermissions.full(typeof currentUser!=='undefined'?currentUser:root.currentUser))return;
  opened=true;root.openAdminPanel();button.click();
 };
})(window);
