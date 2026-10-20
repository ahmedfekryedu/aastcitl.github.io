(function(root){
 'use strict';
 const active=document.documentElement.dataset.citlControlPage==='true';
 function navigate(tab,options={}){
  if(active)return false;
  const url=new URL('/dashboard/control.html',location.origin);
  const previous=new URLSearchParams(location.search),aliases={structure:'directory',services:'service-availability',activity:'activity-history',approvals:'academic-review',academic:'academic-actions',profile:'profile','term-schedules':'term-schedules'};
  url.searchParams.set('tab',(!tab||tab==='users')&&aliases[previous.get('open')]|| (typeof tab==='string'?tab:'users'));
  for(const key of ['request','action','term','department','broadcast'])if(previous.get(key))url.searchParams.set(key,previous.get(key));
  for(const key of ['request','action','term','meeting'])if(options[key])url.searchParams.set(key,options[key]);
  root.CITLPageBoot?.show('جاري فتح لوحة التحكم');
  location.assign(url.href);return true;
 }
 root.CITLControlPage=Object.freeze({navigate});
 if(!active)return;
 const panel=document.getElementById('admin-panel-modal'),host=document.getElementById('citl-control-host');
 if(!panel||!host)return;
 host.append(panel);panel.classList.remove('modal');panel.classList.add('citl-control-page-panel');
 const shell=panel.firstElementChild;
 shell.firstElementChild?.remove();
 shell.className='citl-control-layout';shell.removeAttribute('style');
 const home=document.createElement('a');home.href='/dashboard/';home.className='citl-control-home bg-gradient-to-b from-[#F3A628] to-[#d48a1b] text-[#2A3475] px-4 py-2 rounded-lg font-black hover:brightness-110 shadow-lg border border-white/20 text-[13px]';home.setAttribute('data-header-home','');home.innerHTML='<i class="fas fa-home ml-2" aria-hidden="true"></i> الرئيسية';
 document.getElementById('admin-panel-btn')?.before(home);
 document.querySelector('#mobile-menu a[href="/dashboard/"]')?.removeAttribute('aria-current');
 const menuAdmin=document.querySelector('#mobile-menu [data-dashboard-account]');if(menuAdmin)menuAdmin.setAttribute('aria-current','page');
 document.title='لوحة التحكم المركزية | CITL';
 let started=false;
 root.addEventListener('citl-dashboard-ready',async()=>{
  if(started)return;started=true;
  const params=new URLSearchParams(location.search),tab=params.get('tab')||'users';
  try{if(tab==='academic-actions')await root.CITLOversight.openWorkboard({action:params.get('action'),term:params.get('term')});
  else if(tab==='academic-review')await root.CITLOversight.openApprovals({request:params.get('request')});
  else await root.openAdminPanel(tab);
  }finally{host.setAttribute('aria-busy','false');document.getElementById('citl-control-loading')?.remove();}
  if(params.get('meeting'))void root.CITLMeetingUI?.open(params.get('meeting'),false);
  if(params.get('broadcast'))void root.CITLAnnouncements?.open(params.get('broadcast'));
 });
 // Preserve the selected section in refresh and shared links; permissions still checked by existing switch.
 panel.addEventListener('click',event=>{
  const button=event.target.closest('.admin-tab');if(!button)return;
  const url=new URL(location.href);url.searchParams.set('tab',button.dataset.tab);
  history.replaceState(null,'',url.href);
  if(innerWidth<768)requestAnimationFrame(()=>document.querySelector('#citl-control-host .admin-tab-content:not(.hidden)')?.scrollIntoView({behavior:'smooth',block:'start'}));
 });
})(window);

