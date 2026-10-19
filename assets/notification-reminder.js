(function(root){'use strict';
 let busy=false,lastCheck=0,owner='',pending=null,timer=null,opening=false;
 const key=id=>'citl-overdue-opened:'+id;
 const acknowledged=(id,day)=>{try{return sessionStorage.getItem(key(id))===day;}catch(_){return false;}};
 function visible(e){return !!e&&e.getClientRects().length>0&&getComputedStyle(e).visibility!=='hidden'&&getComputedStyle(e).display!=='none';}
 function close(){document.getElementById('citl-overdue-reminder')?.close();pending=null;clearTimeout(timer);timer=null;}
 function show(){timer=null;if(!pending||owner!==root.currentUser?.id)return close();if(acknowledged(owner,pending.day))return close();
  if(document.hidden||document.documentElement.classList.contains('citl-page-booting')||visible(document.getElementById('global-loader'))||[...document.querySelectorAll('dialog[open],.modal,#mobile-menu,#cm-mobile-nav,#notif-menu')].some(visible)){timer=setTimeout(show,1500);return;}
  const d=document.createElement('dialog');d.id='citl-overdue-reminder';d.dir='rtl';d.setAttribute('aria-labelledby','citl-overdue-title');d.setAttribute('aria-describedby','citl-overdue-description');d.innerHTML='<div class="citl-overdue-icon" aria-hidden="true"><i class="fas fa-bell"></i></div><h2 id="citl-overdue-title">إشعارات تنتظر مراجعتك</h2><p id="citl-overdue-description"></p><p class="citl-overdue-note">افتح الإشعارات للاطلاع على التفاصيل والإجراءات المطلوبة.</p><button type="button"><i class="fas fa-bell" aria-hidden="true"></i> فتح الإشعارات</button><div role="status"></div>';
  d.querySelector('#citl-overdue-description').textContent='لديك '+Number(pending.total).toLocaleString('ar-EG')+' إشعار لم تفتحه منذ أكثر من ٢٤ ساعة.';const day=pending.day,id=owner;d.oncancel=e=>e.preventDefault();d.onclose=()=>d.remove();d.querySelector('button').onclick=async e=>{e.stopPropagation();if(opening)return;opening=true;const b=e.currentTarget;b.disabled=true;d.querySelector('[role=status]').textContent='جاري فتح الإشعارات…';try{const menu=document.getElementById('notif-menu');if(!menu||typeof root.toggleNotifications!=='function')throw Error('قائمة الإشعارات غير جاهزة؛ أعد المحاولة.');menu.classList.add('hidden');await root.toggleNotifications({overdue:true});if(menu.classList.contains('hidden'))throw Error('تعذر فتح الإشعارات؛ أعد المحاولة.');try{sessionStorage.setItem(key(id),day);}catch(_){}close();menu.querySelector('button')?.focus({preventScroll:true});}catch(error){d.querySelector('[role=status]').textContent=error.message||'تعذر فتح الإشعارات؛ أعد المحاولة.';}finally{opening=false;b.disabled=false;}};
  d.querySelectorAll('i.fa-bell').forEach(icon=>{icon.outerHTML='<svg aria-hidden="true" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M10 21h4M12 2V1"/></svg>';});
  document.body.append(d);d.showModal();
 }
 async function check(){const id=root.currentUser?.id;if(!id||!root.sb||root.CITLAuth?.facultyPending(root.currentUser)){close();return;}if(owner!==id){close();owner=id;lastCheck=0;}if(busy||Date.now()-lastCheck<60000||document.hidden)return;busy=true;lastCheck=Date.now();
  try{const r=await root.sb.rpc('citl_overdue_notifications',{p_page:0});if(r.error)throw r.error;if(id!==root.currentUser?.id)return;const data=r.data;if(!data?.total){close();return;}if(acknowledged(id,data.day))return;if(!document.getElementById('citl-overdue-reminder')){pending=data;clearTimeout(timer);show();}}catch(_){/* Reminder reads cannot interrupt login or an unrelated operation. */}finally{busy=false;}
 }
 root.CITLNotificationReminder=Object.freeze({check});root.addEventListener('citl-profile-loaded',()=>void check());document.addEventListener('visibilitychange',()=>{if(!document.hidden)void check();});setInterval(check,60000);void check();
})(window);

// Pending decisions survive "mark all read". Read-only, server-authorized workflow query.
(function(root){'use strict';
 const labels={academic:'اعتماد إجراءات المحاضرات',meeting:'اعتماد طلبات القاعات',registration:'اعتماد تسجيل الأعضاء'};
 let busy=false,checked=0,owner='',items=[],timer=null,opening=false;
 const key=kind=>'citl-pending-opened:'+owner+':'+kind;
 function acknowledged(kind){try{return Date.now()-Number(localStorage.getItem(key(kind))||0)<3600000;}catch(_){return false;}}
 function visible(e){return !!e&&e.getClientRects().length>0&&getComputedStyle(e).visibility!=='hidden'&&getComputedStyle(e).display!=='none';}
 function close(){clearTimeout(timer);timer=null;document.getElementById('citl-pending-reminder')?.close();}
 async function read(){const result=await root.sb.rpc('citl_pending_approval_reminders');if(result.error)throw result.error;return Array.isArray(result.data?.items)?result.data.items:[];}
 function show(){clearTimeout(timer);timer=null;
  if(owner!==root.currentUser?.id){close();return;}
  const kinds=Object.keys(labels).filter(k=>!acknowledged(k)&&items.some(x=>x.kind===k));
  if(!kinds.length){close();return;}
  if(document.hidden||document.documentElement.classList.contains('citl-page-booting')||visible(document.getElementById('global-loader'))||[...document.querySelectorAll('dialog[open],.modal,#mobile-menu,#cm-mobile-nav,#notif-menu')].some(visible)){timer=setTimeout(show,1500);return;}
  const d=document.createElement('dialog');d.id='citl-pending-reminder';d.dir='rtl';d.setAttribute('aria-labelledby','citl-pending-title');
  d.innerHTML='<div class="citl-overdue-icon" aria-hidden="true">!</div><h2 id="citl-pending-title">طلبات تنتظر إجراءك منذ ساعة</h2><p>قراءة الإشعار لا تُنهي طلب الاعتماد. افتح كل نوع لمراجعة الطلبات المعلقة ضمن صلاحياتك.</p><div data-actions></div><p class="citl-overdue-note">إذا بقي الطلب معلقًا سيظهر التذكير بعد ساعة من فتحه.</p><div role="status"></div>';
  d.oncancel=e=>e.preventDefault();d.onclose=()=>d.remove();
  kinds.forEach(kind=>{const b=document.createElement('button');b.type='button';b.dataset.pendingKind=kind;b.textContent=labels[kind]+' ('+items.filter(x=>x.kind===kind).length.toLocaleString('ar-EG')+')';d.querySelector('[data-actions]').append(b);
   b.onclick=async()=>{if(opening)return;opening=true;b.disabled=true;d.querySelector('[role=status]').textContent='جاري التحقق من حالة الطلبات…';
    try{const uid=owner;const fresh=await read();if(uid!==root.currentUser?.id){close();return;}items=fresh;const target=items.find(x=>x.kind===kind);
     if(!target){close();root.showNotification?.('تمت معالجة هذه الطلبات بالفعل.','success');timer=setTimeout(show,100);return;}
     close();root.showLoader?.('جاري فتح الطلبات المعلقة');
     let opened;
     if(kind==='academic'&&typeof root.CITLOversight?.openWorkboard==='function')opened=await root.CITLOversight.openWorkboard({action:target.id});
     else if(kind==='registration'&&typeof root.CITLOversight?.openApprovals==='function')opened=await root.CITLOversight.openApprovals({request:target.id});
     else if(kind==='meeting'&&typeof root.CITLMeetingUI?.open==='function')opened=await root.CITLMeetingUI.open(target.id,true);
     else {try{localStorage.setItem(key(kind),String(Date.now()));}catch(_){}location.assign(target.route);return;}
     if(opened===false)throw Error('تعذر فتح الطلبات؛ لم يتم تأجيل التذكير.');
     try{localStorage.setItem(key(kind),String(Date.now()));}catch(_){}timer=setTimeout(show,1500);
    }catch(error){if(d.isConnected)d.querySelector('[role=status]').textContent=error.message||'تعذر فتح الطلبات؛ أعد المحاولة.';else {root.showNotification?.(error.message,'error');timer=setTimeout(show,1500);}}
    finally{root.hideLoader?.();opening=false;b.disabled=false;}
   };
  });document.body.append(d);d.showModal();
 }
 async function check(force=false){const id=root.currentUser?.id;if(!id||!root.sb||root.CITLAuth?.facultyPending(root.currentUser)){items=[];close();return;}if(owner!==id){close();items=[];owner=id;checked=0;}if(busy||opening||document.hidden||(!force&&Date.now()-checked<60000))return;busy=true;checked=Date.now();try{const fresh=await read();if(id!==root.currentUser?.id)return;const changed=JSON.stringify(items)!==JSON.stringify(fresh);items=fresh;if(changed||!document.getElementById('citl-pending-reminder')){close();show();}}catch(_){/* Missing migration or offline read must not block other work. */}finally{busy=false;}}
 root.CITLPendingApprovalsReminder=Object.freeze({check});root.addEventListener('citl-profile-loaded',()=>void check());document.addEventListener('visibilitychange',()=>{if(!document.hidden)void check();});setInterval(check,60000);void check();
})(window);
