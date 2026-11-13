(function(root){
 'use strict';
 const active=document.documentElement.dataset.citlControlPage==='true';
 function navigate(tab,options={}){
  if(active)return false;
  const url=new URL('/dashboard/control.html',location.origin);
  const previous=new URLSearchParams(location.search),aliases={structure:'directory',services:'service-availability',activity:'activity-history',approvals:'academic-review',academic:'academic-actions',profile:'profile','term-schedules':'term-schedules'};
  url.searchParams.set('tab',(!tab||tab==='users')&&aliases[previous.get('open')]|| (typeof tab==='string'?tab:'users'));
  for(const key of ['request','action','term','department','broadcast','swap'])if(previous.get(key))url.searchParams.set(key,previous.get(key));
  for(const key of ['request','action','term','meeting'])if(options[key])url.searchParams.set(key,options[key]);
  root.CITLPageBoot?.show('جاري فتح لوحة التحكم');
  location.assign(url.href);return true;
 }

 // Wait for the actual destination, not a hidden panel or its loading placeholder.
 // A later navigation cancels an earlier pending reveal; no access/data decisions here.
 let stopReveal=null;
 function reveal(resolve,options={}){
  stopReveal?.();let stopped=false,frame=0,timer=0;
  const target=()=>typeof resolve==='function'?resolve():resolve;
  const visible=el=>!!(el?.isConnected&&el.getClientRects().length&&getComputedStyle(el).visibility!=='hidden');
  function ready(){const el=target();return visible(el)&&!el.closest('[aria-busy="true"]')&&!visible(document.getElementById('global-loader'))?el:null;}
  function stop(){stopped=true;observer.disconnect();clearTimeout(timer);cancelAnimationFrame(frame);root.removeEventListener('resize',schedule);document.removeEventListener('visibilitychange',schedule);if(stopReveal===stop)stopReveal=null;}
  function schedule(){if(stopped||frame||document.hidden)return;frame=requestAnimationFrame(()=>{frame=0;if(!ready())return;frame=requestAnimationFrame(()=>{
   frame=0;const el=ready();if(!el)return;stop();
   const modal=el.closest('dialog,.modal.show');
   const header=document.querySelector('.citl-main-header'),style=header&&getComputedStyle(header);
   const clearance=!modal&&header&&['sticky','fixed'].includes(style.position)?Math.max(0,header.getBoundingClientRect().bottom):0;
   const oldMargin=el.style.scrollMarginTop;el.style.scrollMarginTop=(clearance+16)+'px';
   el.scrollIntoView({behavior:'instant',block:options.block||'start',inline:'nearest'});el.style.scrollMarginTop=oldMargin;
   const added=!el.hasAttribute('tabindex'),oldOutline=el.style.outline;
   if(added){el.setAttribute('tabindex','-1');el.style.outline='none';}
   el.focus({preventScroll:true});if(added)el.addEventListener('blur',()=>{el.removeAttribute('tabindex');el.style.outline=oldOutline;},{once:true});
  });});}
  const observer=new MutationObserver(schedule);observer.observe(document.documentElement,{subtree:true,childList:true,attributes:true,attributeFilter:['class','style','hidden','aria-busy']});
  stopReveal=stop;timer=setTimeout(stop,30000);root.addEventListener('resize',schedule);document.addEventListener('visibilitychange',schedule);schedule();return stop;
 }
 function selectedDestination(params){
  const panel=document.getElementById('admin-'+(params.get('tab')||'users')+'-tab');if(!panel||panel.classList.contains('hidden'))return null;
  if(params.get('tab')==='academic-review'&&params.get('request'))return [...panel.querySelectorAll('[data-claim-id]')].find(el=>el.dataset.claimId===params.get('request'))||panel.querySelector('[data-status]')||panel;
  if(params.get('tab')==='academic-actions'&&params.get('action')){const detail=panel.querySelector('#citl-ac-work-detail');if(detail&&!detail.hidden&&detail.dataset.action===params.get('action'))return detail;}
  return panel;
 }
 root.CITLControlPage=Object.freeze({navigate,reveal});
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
  // Ordinary control-page entry stays at the top with its return navigation.
  // Only a link to a specific request/action should jump to an item on first load.
  if((tab==='academic-review'&&params.get('request'))||(tab==='academic-actions'&&params.get('action')))reveal(()=>selectedDestination(params));
  if(params.get('swap'))void root.CITLRoomSwaps?.open(params.get('swap'));
  if(params.get('meeting'))void root.CITLMeetingUI?.open(params.get('meeting'),false);
  if(params.get('broadcast'))void root.CITLAnnouncements?.open(params.get('broadcast'));
 });
 // Preserve the selected section in refresh and shared links; permissions still checked by existing switch.
 panel.addEventListener('click',event=>{
  const button=event.target.closest('.admin-tab');if(!button)return;
  const url=new URL(location.href);url.searchParams.set('tab',button.dataset.tab);
  history.replaceState(null,'',url.href);
  reveal(()=>document.querySelector('#citl-control-host .admin-tab-content:not(.hidden)'));
 });
})(window);

