/* Delegated actions use the existing secure action form and server-side per-instructor scope. */
(function(root){
 'use strict';
 const E=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const rpc=()=>root.CITLRequests.rpc(root.sb,'citl_delegated_lectures',{});
 let serial=0, pendingAction=new URLSearchParams(location.search).get('delegated_action');
 async function startAction(row){
  if(typeof root.openScheduleActionModal!=='function'){
   const url=new URL('/schedules/',location.origin);url.searchParams.set('delegated_action',String(row.id));
   root.CITLPageBoot?.show('جاري فتح إجراء المحاضرة');location.assign(url.href);return;
  }
  await root.openScheduleActionModal(encodeURIComponent(JSON.stringify(row)));
  const summary=document.getElementById('sa-summary');if(summary){const note=document.createElement('p');note.className='citl-ac-muted';note.textContent='تنفّذ هذا الإجراء بالنيابة؛ سيتم تسجيله باسم حسابك مع بقاء المحاضرة لصاحبها.';summary.prepend(note);}
 }
 async function mount(){
  document.querySelector('#schedule-entry-tools #citl-delegated-action-entry')?.remove();
  const panel=document.getElementById('admin-academic-actions-tab');
  if(!root.currentUser||(!panel&&!pendingAction))return;
  const id=++serial;let card=document.getElementById('citl-delegated-action-entry');if(card)card.hidden=true;
  try{const data=await rpc();if(id!==serial)return;
   if(pendingAction&&typeof root.openScheduleActionModal==='function'){
    const target=pendingAction;pendingAction=null;const url=new URL(location.href);url.searchParams.delete('delegated_action');history.replaceState(null,'',url.href);
    const row=data.allowed&&(data.rows||[]).find(r=>String(r.id)===target);
    if(row)await startAction(row);else root.showNotification?.('المحاضرة غير متاحة أو خارج نطاق صلاحياتك','error');
   }
   if(!data.allowed||!panel)return;
   if(!card){card=document.createElement('section');card.id='citl-delegated-action-entry';card.className='citl-admin-section';card.innerHTML='<div class="citl-admin-section-head"><div><h3><i class="fas fa-user-pen" aria-hidden="true"></i> القائم بالأعمال</h3><p>إلغاء أو إحلال أو تغيير قاعة في نطاق صلاحياتك؛ يُسجّل اسم منفّذ الإجراء.</p></div><button type="button" class="citl-ac-button" data-delegated-open>إجراء بالنيابة</button></div>';card.querySelector('button').onclick=open;panel.prepend(card);}
   card.hidden=false;
  }catch(_){if(pendingAction)root.showNotification?.('تعذر تحميل إجراء الإنابة؛ أعد المحاولة من لوحة التحكم','error');}
 }
 async function open(){const d=document.createElement('dialog');d.className='citl-head-dialog citl-ac-dialog';d.id='citl-delegated-actions';d.dir='rtl';d.innerHTML='<header><strong>إجراء بالنيابة عن عضو هيئة تدريس</strong><button type="button" data-close aria-label="إغلاق">×</button></header><div class="citl-ac-body"><p class="citl-ac-muted">القائم بالأعمال: الأعضاء المعيّنون له فقط. المدير ورئيس القسم حسب نطاق صلاحياتهما. يُسجل الإجراء باسم المنفّذ دون تغيير ربط المحاضر.</p><div class="citl-ac-toolbar"><label>المحاضر<select data-instructor><option value="">كل الأسماء المسموح بها</option></select></label><label>بحث في المحاضر أو المادة أو القاعة<input data-search autocomplete="off" role="combobox" aria-autocomplete="list" aria-expanded="false" aria-controls="citl-delegated-options"><div id="citl-delegated-options" role="listbox" hidden></div></label><button type="button" class="citl-ac-button secondary" data-refresh>تحديث</button></div><div data-rows></div><p role="status"></p></div>';
 d.querySelector('[data-close]').onclick=()=>d.close();d.onclose=()=>d.remove();d.onclick=e=>{if(e.target===d){const r=d.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)d.close();}};document.body.append(d);d.showModal();
 const host=d.querySelector('[data-rows]'),select=d.querySelector('select'),search=d.querySelector('input'),status=d.querySelector('[role=status]'),refresh=d.querySelector('[data-refresh]');let rows=[];
 const normalize=v=>String(v||'').normalize('NFKC').replace(/[\u064B-\u065F\u0670\u0640]/g,'').toLowerCase().trim();
 const options=d.querySelector('#citl-delegated-options');let active=-1;
 function suggest(){const term=normalize(search.value);options.replaceChildren();active=-1;if(!term){options.hidden=true;search.setAttribute('aria-expanded','false');return;}
 const names=[...new Set(rows.filter(r=>!select.value||r.instructor===select.value).flatMap(r=>[r.instructor,r.course_name,r.room_name]).filter(Boolean))].filter(n=>normalize(n).includes(term));
 for(const name of names){const b=document.createElement('button');b.type='button';b.setAttribute('role','option');b.textContent=name;b.onclick=()=>{search.value=name;options.hidden=true;search.setAttribute('aria-expanded','false');draw();search.focus();};options.append(b);}
 options.hidden=!names.length;search.setAttribute('aria-expanded',String(!!names.length));
 }
 search.onkeydown=e=>{const buttons=[...options.children];if(e.key==='Escape'){options.hidden=true;search.setAttribute('aria-expanded','false');return;}if(!buttons.length||options.hidden)return;if(['ArrowDown','ArrowUp'].includes(e.key)){e.preventDefault();active=(active+(e.key==='ArrowDown'?1:-1)+buttons.length)%buttons.length;buttons.forEach((b,i)=>b.setAttribute('aria-selected',String(i===active)));buttons[active].scrollIntoView({block:'nearest'});}if(e.key==='Enter'&&active>=0){e.preventDefault();buttons[active].click();}};
 d.addEventListener('click',e=>{if(e.target!==search&&!options.contains(e.target)){options.hidden=true;search.setAttribute('aria-expanded','false');}});
 function draw(){const filtered=rows.filter(r=>select.value&&r.instructor===select.value&&normalize([r.instructor,r.course_name,r.room_name].join(' ')).includes(normalize(search.value)));host.innerHTML=filtered.length?'<div class="citl-ac-table-wrap"><table class="citl-ac-table"><thead><tr><th>المحاضر / المادة</th><th>اليوم / الوقت</th><th>القاعة</th><th>الإجراء</th></tr></thead><tbody>'+filtered.map((r,i)=>'<tr><td>'+E(r.instructor)+'<small>'+E(r.course_name)+'</small></td><td>'+E(root.CITLStudy?.day(r)||r.day_of_week)+'<small><bdi>'+E(r.time_slot)+'</bdi></small></td><td>'+E(r.room_name)+'</td><td><button class="citl-ac-button secondary" type="button" data-action="'+i+'">اختيار موعد الإجراء</button></td></tr>').join('')+'</tbody></table></div>':'<div class="citl-admin-empty">اختر عضو هيئة التدريس لعرض محاضراته الحالية المسموح لك بإجراء تعديل عليها.</div>';host.querySelectorAll('[data-action]').forEach(b=>b.onclick=async()=>{const row=filtered[Number(b.dataset.action)];d.close();await startAction(row);});}
 async function load(){refresh.disabled=true;host.innerHTML='<div class="citl-admin-placeholder" role="status"><span class="citl-skeleton-line"></span><span class="citl-skeleton-line"></span></div>';status.textContent='';try{const data=await rpc();if(!d.isConnected)return;if(!data.allowed)throw Error('لم تعد هذه الصلاحية متاحة لحسابك');rows=data.rows||[];const old=select.value;select.replaceChildren(new Option('اختر عضو هيئة التدريس',''),...[...new Set(rows.map(r=>r.instructor))].sort().map(n=>new Option(n,n)));if([...select.options].some(o=>o.value===old))select.value=old;draw();}catch(e){rows=[];host.replaceChildren();status.textContent=e.message;}finally{refresh.disabled=false;}}
 select.onchange=()=>{draw();suggest();};search.oninput=()=>{draw();suggest();};refresh.onclick=load;load();
 }
 root.CITLDelegatedActions={mount,open};root.addEventListener('citl-profile-loaded',mount);root.addEventListener('citl-permissions-changed',()=>{document.getElementById('citl-delegated-actions')?.close();mount();});root.addEventListener('citl-schedule-update',mount);mount();
})(window);
