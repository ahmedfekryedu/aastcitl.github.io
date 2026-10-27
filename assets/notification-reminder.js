(function(root){
 'use strict';
 let owner='',busy=false,checked=0,timer=null,opening=false,available=false;
 const key=id=>'citl-notification-reminder-opened:'+id;
 const acknowledged=()=>{try{return sessionStorage.getItem(key(owner))==='1';}catch(_){return false;}};
 const visible=e=>!!e&&e.getClientRects().length>0&&getComputedStyle(e).visibility!=='hidden'&&getComputedStyle(e).display!=='none';
 function close(){clearTimeout(timer);timer=null;document.getElementById('citl-overdue-reminder')?.close();}
 function show(){
  clearTimeout(timer);timer=null;
  if(owner!==root.currentUser?.id||!available||acknowledged())return close();
  if(document.getElementById('citl-overdue-reminder'))return;
  if(document.hidden||document.documentElement.classList.contains('citl-page-booting')||visible(document.getElementById('global-loader'))||[...document.querySelectorAll('dialog[open],.modal,#mobile-menu,#cm-mobile-nav,#notif-menu')].some(visible)){timer=setTimeout(show,1500);return;}
  const d=document.createElement('dialog');d.id='citl-overdue-reminder';d.dir='rtl';d.setAttribute('aria-labelledby','citl-overdue-title');
  d.innerHTML='<div class="citl-overdue-icon" aria-hidden="true"><svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M10 21h4"/></svg></div><h2 id="citl-overdue-title">لديك إشعارات للمراجعة</h2><p>افتح القائمة واختر الإشعار الذي تريد مراجعته.</p><button type="button">فتح الإشعارات</button><div role="status"></div>';
  d.oncancel=e=>e.preventDefault();d.onclose=()=>d.remove();
  d.querySelector('button').onclick=async e=>{
   e.stopPropagation();if(opening)return;opening=true;const uid=owner;e.currentTarget.disabled=true;
   try{
    if(!document.getElementById('notif-menu')||typeof root.toggleNotifications!=='function')throw Error('قائمة الإشعارات غير جاهزة؛ أعد المحاولة.');
    // Close the modal before focusing the inbox. No request or destination opens here.
    d.close();await root.toggleNotifications({open:true});
    if(uid!==root.currentUser?.id)return;
    const menu=document.getElementById('notif-menu');if(menu.classList.contains('hidden'))throw Error('تعذر فتح الإشعارات؛ أعد المحاولة.');
    try{sessionStorage.setItem(key(uid),'1');}catch(_){}
    menu.querySelector('button')?.focus({preventScroll:true});
   }catch(error){root.showNotification?.(error.message||'تعذر فتح الإشعارات؛ أعد المحاولة.','error');timer=setTimeout(show,1500);}
   finally{opening=false;}
  };
  document.body.append(d);d.showModal();
 }
 async function check(force=false){
  const id=root.currentUser?.id;
  if(!id||!root.sb||root.CITLAuth?.facultyPending?.(root.currentUser)){available=false;close();return;}
  if(owner!==id){close();owner=id;checked=0;available=false;}
  if(acknowledged()){close();return;}
  // The canonical inbox includes already-opened requests which still need a decision.
  if(root.__citlNotifications?.length){available=true;show();return;}
  if(busy||opening||document.hidden||(!force&&Date.now()-checked<60000))return;
  busy=true;checked=Date.now();
  try{
   const results=await Promise.allSettled([root.sb.rpc('citl_overdue_notifications',{p_page:0}),root.sb.rpc('citl_pending_approval_reminders')]);
   if(id!==root.currentUser?.id)return;
   available=results.some(r=>r.status==='fulfilled'&&!r.value.error&&(r.value.data?.total>0||r.value.data?.items?.length>0));
   if(available)show();else close();
  }catch(_){/* A read failure must not interrupt another operation. */}finally{busy=false;}
 }
 root.CITLNotificationReminder=Object.freeze({check});root.CITLPendingApprovalsReminder=Object.freeze({check});
 root.addEventListener('citl-profile-loaded',()=>void check(true));
 document.addEventListener('visibilitychange',()=>{if(!document.hidden)void check();});
 setInterval(check,60000);void check();
})(window);
