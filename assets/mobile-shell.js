(function(root){'use strict';
 const menu=document.getElementById('mobile-menu')||document.getElementById('cm-mobile-nav');
 const panel=menu?.querySelector('.citl-drawer'),trigger=document.querySelector('.citl-mobile-menu-button');
 if(!menu||!panel||!trigger)return;
 let returnFocus=null,previousScroll='',opened=false;
 const mobile=()=>innerWidth<1024&&!document.documentElement.classList.contains('citl-desktop-request');
 function close(restore=true){
  if(!opened)return;opened=false;menu.hidden=true;menu.classList.add('hidden');document.body.style.overflow=previousScroll;
  trigger.setAttribute('aria-expanded','false');if(restore&&returnFocus?.isConnected)returnFocus.focus({preventScroll:true});
 }
 function toggle(){
  if(opened){close();return;}if(!mobile())return;
  document.getElementById('notif-menu')?.classList.add('hidden');document.getElementById('profile-info-menu')?.classList.add('hidden');
  returnFocus=document.activeElement;previousScroll=document.body.style.overflow;opened=true;menu.hidden=false;menu.classList.remove('hidden');
  document.body.style.overflow='hidden';trigger.setAttribute('aria-expanded','true');panel.querySelector('[data-mobile-close]').focus({preventScroll:true});
 }
 async function notifications(){
  close(false);document.getElementById('profile-info-menu')?.classList.add('hidden');
  const pending=root.toggleNotifications?.();
  root.CITLFitNotifications?.();await pending;root.CITLFitNotifications?.();
 }
 let confirmingLogout=false;
 document.addEventListener('click',async e=>{
  const button=e.target.closest('button,a');if(!button||(!/\blogout\s*\(/.test(button.getAttribute('onclick')||'')&&!button.hasAttribute('data-logout')))return;
  e.preventDefault();e.stopImmediatePropagation();if(confirmingLogout)return;confirmingLogout=true;close(false);
  const dialog=document.createElement('dialog');dialog.className='citl-logout-confirm';dialog.dir='rtl';
  dialog.innerHTML='<h3>تأكيد تسجيل الخروج</h3><p>هل تريد تسجيل الخروج من حسابك في نظام الكلية؟</p><footer><button type="button" data-cancel>البقاء في النظام</button><button type="button" data-confirm>تسجيل الخروج</button></footer>';
  document.body.append(dialog);dialog.showModal();
  const accepted=await new Promise(resolve=>{dialog.querySelector('[data-cancel]').onclick=()=>{dialog.close();resolve(false);};dialog.querySelector('[data-confirm]').onclick=()=>{dialog.close();resolve(true);};dialog.addEventListener('cancel',()=>resolve(false),{once:true});});
  dialog.remove();confirmingLogout=false;if(accepted)await root.logout();else if(button.isConnected)button.focus({preventScroll:true});
 },true);
 trigger.setAttribute('aria-controls',menu.id);
 menu.addEventListener('click',e=>{
  if(e.target.closest('[data-mobile-close]')){e.preventDefault();close();}
  else if(e.target.closest('a[href]'))close(false);
 });
 document.addEventListener('keydown',e=>{
  if(!opened)return;
  if(e.key==='Escape'){e.preventDefault();close();return;}
  if(e.key!=='Tab')return;
  const focusable=[...panel.querySelectorAll('a[href],button:not([disabled]),summary,[tabindex="0"]')].filter(x=>x.getClientRects().length);
  const first=focusable[0],last=focusable[focusable.length-1];
  if(e.shiftKey&&document.activeElement===first){e.preventDefault();last?.focus();}
  else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first?.focus();}
 });
 root.addEventListener('resize',()=>{if(!mobile())close(false);});
 document.addEventListener('click',e=>{
  if(!mobile())return;
  if(!e.target.closest('#notif-menu,#notif-btn-wrapper,#notif-btn-wrapper-pc'))document.getElementById('notif-menu')?.classList.add('hidden');
 });
 const bell=document.querySelector('.citl-mobile-bell'),popup=document.getElementById('notif-menu');
 if(popup)new MutationObserver(()=>bell?.setAttribute('aria-expanded',String(!popup.classList.contains('hidden')))).observe(popup,{attributes:true,attributeFilter:['class']});
 function updateProfile(p){
  if(!p)return;
  panel.querySelector('[data-mobile-account]').textContent=p.full_name||p.email||'';
  panel.querySelector('[data-mobile-position]').textContent=p.position||'';
  const faculty=p.faculty_verification_status==='approved'&&(['faculty','visiting_lecturer'].includes(p.account_type)||p.is_visiting_lecturer===true);
  panel.querySelectorAll('[data-citl-mobile-personal]').forEach(a=>a.hidden=!faculty);
 }
 root.addEventListener('citl-profile-loaded',e=>updateProfile(e.detail));updateProfile(root.currentUser);
 document.addEventListener('click',e=>{
  const link=e.target.closest('a[href]');if(!link||e.defaultPrevented||e.button!==0||e.ctrlKey||e.metaKey||e.shiftKey||link.target&&link.target!=='_self')return;
  const target=new URL(link.href,location.href);
  if(target.origin===location.origin&&target.pathname!==location.pathname)root.CITLPageBoot?.show('جاري تهيئة النظام');
 });
 root.CITLMobileShell=Object.freeze({toggle,close,notifications,profile:()=>{if(typeof root.openAdminPanel==='function')root.openAdminPanel('profile');else {root.CITLPageBoot?.show('جاري تهيئة النظام');location.href='/dashboard/?open=profile';}}});
})(window);
