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
 host.append(panel);panel.classList.add('citl-control-page-panel');
 const close=document.getElementById('close-admin-panel');
 if(close){const home=document.createElement('a');home.href='/dashboard/';home.className=close.className;home.textContent='←';home.title='العودة للرئيسية';home.setAttribute('aria-label','العودة للرئيسية');close.replaceWith(home);}
 document.title='لوحة التحكم المركزية | CITL';
 let started=false;
 root.addEventListener('citl-dashboard-ready',()=>{
  if(started)return;started=true;
  const params=new URLSearchParams(location.search),tab=params.get('tab')||'users';
  if(tab==='academic-actions')void root.CITLOversight.openWorkboard({action:params.get('action'),term:params.get('term')});
  else if(tab==='academic-review')void root.CITLOversight.openApprovals({request:params.get('request')});
  else root.openAdminPanel(tab);
  if(params.get('meeting'))void root.CITLMeetingUI?.open(params.get('meeting'),false);
  if(params.get('broadcast'))void root.CITLAnnouncements?.open(params.get('broadcast'));
 });
 // Preserve the selected section in refresh and shared links; permissions still checked by existing switch.
 panel.addEventListener('click',event=>{
  const button=event.target.closest('.admin-tab');if(!button)return;
  const url=new URL(location.href);url.searchParams.set('tab',button.dataset.tab);
  history.replaceState(null,'',url.href);
 });
})(window);

