/* Read-only booking history for members; the existing meetings RLS remains authoritative. */
(function(root){
 'use strict';
 const modal=document.getElementById('admin-panel-modal');
 const sample=modal?.querySelector('.admin-tab[data-tab="profile"]');if(!sample)return;
 const button=sample.cloneNode(true);button.dataset.tab='my-bookings';button.classList.remove('active');button.style.display='none';
 button.querySelector('span').textContent='حجوزاتي';button.querySelector('i').className='fas fa-calendar-check';sample.after(button);
 const panel=document.createElement('section');panel.id='admin-my-bookings-tab';panel.className='admin-tab-content hidden';
 panel.innerHTML=`<style>
 @media(max-width:640px){
 #admin-my-bookings-tab table,#admin-my-bookings-tab tbody{display:block;width:100%}
 #admin-my-bookings-tab thead{display:none}
 #admin-my-bookings-tab tr[data-booking]{display:block;margin:12px;padding:10px;border:1px solid #e5e7eb;border-radius:10px}
 #admin-my-bookings-tab tr[data-booking] td{display:flex;justify-content:space-between;align-items:center;gap:12px;padding:5px 0;direction:rtl;white-space:normal!important}
 #admin-my-bookings-tab tr[data-booking] td::before{content:attr(data-label);font-weight:700;color:#64748b;flex-shrink:0;font-size:11px}
 }
 </style><div class="bg-white rounded-xl border border-gray-200 overflow-hidden">
  <div class="p-4 border-b border-gray-100 flex items-center justify-between gap-3"><div><h3 class="font-bold text-[#2A3475] text-base">سجل حجوزاتي</h3><p class="text-xs text-gray-500 mt-1">طلبات حجز القاعات التي قدمتها وحالة مراجعتها.</p></div><button type="button" data-refresh class="px-3 py-2 rounded-lg border border-gray-200 text-xs font-bold text-[#2A3475] hover:bg-gray-50">تحديث</button></div>
  <div class="p-4 border-b border-gray-100"><label class="text-xs font-bold text-gray-600">حالة الحجز<select data-status class="block mt-2 w-full md:w-64 rounded-lg border border-gray-200 px-3 py-2 text-sm bg-white text-[#2A3475]" aria-label="حالة الحجز"><option value="">كل الحالات</option value="pending">قيد المراجعة</option><option value="confirmed">معتمدة</option><option value="rejected">مرفوضة</option><option value="modification_requested">طلب تعديل</option><option value="cancellation_requested">طلب إلغاء</option></select></label></div>
  <div class="overflow-x-auto"><table class="w-full text-right text-sm"><thead class="bg-gray-50 text-xs text-gray-500"><tr><th class="p-3">الحجز</th><th class="p-3">القاعة</th><th class="p-3">التاريخ</th><th class="p-3">الوقت</th><th class="p-3">الحالة</th></tr></thead><tbody data-rows></tbody></table></div>
  <div class="p-3 border-t border-gray-100 flex flex-wrap items-center justify-between gap-2"><p data-feedback role="status" class="text-xs text-gray-500"></p><div class="flex gap-2"><button type="button" data-prev class="px-3 py-1 rounded-lg border border-gray-200 text-xs text-[#2A3475] disabled:opacity-50">السابق</button><button type="button" data-next class="px-3 py-1 rounded-lg border border-gray-200 text-xs text-[#2A3475] disabled:opacity-50">التالي</button></div></div></div>`;
 modal.querySelector('.admin-tab-content').parentElement.append(panel);
 const $=selector=>panel.querySelector(selector),rows=$('[data-rows]'),feedback=$('[data-feedback]');
 const labels={pending:['قيد المراجعة','text-amber-700 bg-amber-50'],confirmed:['معتمد','text-green-700 bg-green-50'],rejected:['مرفوض','text-red-700 bg-red-50'],modification_requested:['طلب تعديل قيد المراجعة','text-blue-700 bg-blue-50'],cancellation_requested:['طلب إلغاء قيد المراجعة','text-amber-700 bg-amber-50']};
 let page=0,serial=0,busy=false;const size=25;
 const allowed=()=>root.currentUser && root.currentUser.role!=='manager' && !root.CITLAuth.facultyPending(root.currentUser);
 function empty(message){rows.replaceChildren();const tr=document.createElement('tr'),td=document.createElement('td');td.colSpan=5;td.className='p-8 text-center text-sm text-gray-500';td.textContent=message;tr.append(td);rows.append(tr);}
 function draw(items){rows.replaceChildren();for(const item of items){const tr=document.createElement('tr');tr.dataset.booking='';tr.className='border-b border-gray-100';
  const state=labels[item.status]||['حالة غير معروفة','text-gray-600 bg-gray-100'];
  for(const [index,text] of [item.title||'حجز قاعة',item.rooms?.name||'—',item.date||'—',`${(item.start_time||'').slice(0,5)} – ${(item.end_time||'').slice(0,5)}`,state[0]].entries()){
   const td=document.createElement('td');td.className='p-3 text-xs text-gray-700';td.dataset.label=['الحجز','القاعة','التاريخ','الوقت','الحالة'][index];
   if(index===4){const badge=document.createElement('span');badge.className='inline-block rounded-full px-2 py-1 font-bold '+state[1];badge.textContent=text;td.append(badge);}else if(index===2||index===3){const value=document.createElement('bdi');value.dir='ltr';value.textContent=text;td.append(value);}else td.textContent=text;
   if(index===2||index===3){td.dir='ltr';td.style.whiteSpace='nowrap';}if(index===0){td.style.minWidth='120px';td.style.overflowWrap='anywhere';}tr.append(td);
  }rows.append(tr);
 }}
 async function load(quiet=false){
  if(!allowed())return;
  const request=++serial;busy=true;$('[data-refresh]').disabled=true;$('[data-prev]').disabled=true;$('[data-next]').disabled=true;rows.setAttribute('aria-busy','true');
  if(!quiet){rows.innerHTML=root.CITLLoading?.table(5)||'';feedback.textContent='جاري تحميل حجوزاتك…';}
  try{
   const session=await root.CITLAuth.session();
   let query=root.sb.from('meetings').select('id,title,date,start_time,end_time,status,room_id,rooms(name)').eq('user_id',session.user.id).order('date',{ascending:false}).order('start_time',{ascending:false}).order('id',{ascending:false});
   if($('[data-status]').value)query=query.eq('status',$('[data-status]').value);
   const {data,error}=await query.range(page*size,page*size+size);if(error)throw error;
   if(request!==serial)return;
   const items=data||[];draw(items.slice(0,size));if(!items.length)empty(page?'لا توجد حجوزات في هذه الصفحة.':'لا توجد حجوزات بهذه الحالة حتى الآن.');
   feedback.textContent=`صفحة ${page+1} · ${Math.min(items.length,size)} حجز`;
   $('[data-prev]').disabled=page===0;$('[data-next]').disabled=items.length<=size;
  }catch(error){if(request!==serial)return;if(root.CITLAuth.redirectIfSignedOut(error))return;
   if(!quiet)empty('تعذر تحميل حجوزاتك. اضغط تحديث لإعادة المحاولة.');feedback.textContent='تعذر تحديث السجل؛ أعد المحاولة.';$('[data-prev]').disabled=page===0;
  }finally{if(request===serial){busy=false;$('[data-refresh]').disabled=false;rows.setAttribute('aria-busy','false');}}
 }
 $('[data-refresh]').onclick=()=>load();$('[data-status]').onchange=()=>{page=0;load();};
 $('[data-prev]').onclick=()=>{if(page>0){page--;load();}};$('[data-next]').onclick=()=>{page++;load();};
 function refreshVisible(){if(!busy&&!document.hidden&&modal.classList.contains('show')&&!panel.classList.contains('hidden'))load(true);}
 setInterval(refreshVisible,15000);document.addEventListener('visibilitychange',refreshVisible);
 root.CITLMemberBookings=Object.freeze({load});
})(window);
