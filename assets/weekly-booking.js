(function(root){
 'use strict';
 const form=document.getElementById('meeting-form');if(!form)return;
 let weeks=[],attempt=null;
 const box=document.createElement('details');box.id='weekly-booking';box.className='border border-gray-200 rounded-lg p-3 mt-4 text-sm';
 box.innerHTML='<summary class="font-bold text-[#2A3475] cursor-pointer">تكرار الحجز أسبوعيًا — اختياري</summary><p class="text-xs text-gray-500 my-2">نفس القاعة والحدث. أضف الأسابيع المطلوبة وحدد وقت كل أسبوع.</p><div id="weekly-booking-rows"></div><button type="button" id="weekly-booking-add" class="border rounded-lg px-3 py-2 mt-2 text-[#2A3475] font-bold">+ إضافة الأسبوع التالي</button>';
 form.lastElementChild.before(box);
 function dateAt(date,offset){const d=new Date(date+'T12:00:00Z');if(!Number.isFinite(d.getTime()))throw new Error('اختر تاريخ الحجز أولًا');d.setUTCDate(d.getUTCDate()+offset*7);return d.toISOString().slice(0,10);}
 function render(){
  const host=document.getElementById('weekly-booking-rows');host.replaceChildren();
  weeks.forEach((w,i)=>{
   const row=document.createElement('div');row.className='border-t border-gray-200 py-3';
   const label=document.createElement('strong');label.className='block mb-2 text-xs';
   const date=document.getElementById('meeting-date').value;label.textContent=date?new Intl.DateTimeFormat('ar-EG',{weekday:'long',year:'numeric',month:'long',day:'numeric',timeZone:'UTC'}).format(new Date(dateAt(date,w.offset)+'T12:00:00Z')):'اختر تاريخ الحجز';
   const mode=document.createElement('select');mode.className='border rounded-lg p-2 text-xs';mode.add(new Option('نفس توقيت الحجز الأول','same'));mode.add(new Option('توقيت مختلف','custom'));mode.value=w.mode;
   const time=document.createElement('input');time.type='time';time.className='border rounded-lg p-2 mr-2';time.value=w.time;time.setAttribute('aria-label','وقت بداية الأسبوع '+w.offset);
   const duration=document.createElement('input');duration.type='number';duration.min=1;duration.max=720;duration.value=w.duration;duration.className='border rounded-lg p-2 w-20 mr-2';duration.setAttribute('aria-label','مدة الحجز بالدقائق للأسبوع '+w.offset);
   const note=document.createElement('span');note.className='text-xs mr-1';note.textContent='دقيقة';
   const remove=document.createElement('button');remove.type='button';remove.textContent='حذف هذا الأسبوع';remove.className='text-red-600 text-xs mr-2';remove.onclick=()=>{weeks.splice(i,1);render();};
   const sync=()=>{time.hidden=duration.hidden=note.hidden=w.mode!=='custom';time.required=duration.required=w.mode==='custom';time.disabled=duration.disabled=w.mode!=='custom';};
   mode.onchange=()=>{w.mode=mode.value;sync();};time.oninput=()=>w.time=time.value;duration.oninput=()=>w.duration=Number(duration.value);
   row.append(label,mode,time,duration,note,remove);host.append(row);sync();
  });
  document.getElementById('weekly-booking-add').disabled=weeks.length>=25;
 }
 document.getElementById('weekly-booking-add').onclick=()=>{
  if(!document.getElementById('meeting-date').value){root.showNotification('حدد تاريخ الحجز أولًا','error');return;}
  weeks.push({offset:Math.max(0,...weeks.map(w=>w.offset))+1,mode:'same',time:document.getElementById('meeting-time').value,duration:(Number(document.getElementById('duration').value)||1)*60});render();
 };
 document.getElementById('meeting-date').addEventListener('change',render);
 function reset(){weeks=[];attempt=null;box.open=false;render();}
 form.addEventListener('reset',reset);
 new MutationObserver(()=>{box.hidden=!!document.getElementById('meeting-id').value;}).observe(document.getElementById('add-meeting-modal'),{attributes:true,attributeFilter:['class']});
 function expand(base){
  const rows=[base];
  for(const week of weeks){
   const row={...base,date:dateAt(base.date,week.offset)};
   if(week.mode==='custom'){
    const match=/^(\d{2}):(\d{2})$/.exec(week.time),duration=Number(week.duration);
    if(!match||!Number.isInteger(duration)||duration<1||duration>720)throw new Error('راجع وقت ومدة كل أسبوع');
    const end=Number(match[1])*60+Number(match[2])+duration;
    if(end>=1440)throw new Error('الحجز يجب أن ينتهي في نفس اليوم');
    row.start_time=week.time;row.end_time=String(Math.floor(end/60)).padStart(2,'0')+':'+String(end%60).padStart(2,'0');
   }
   delete row.academic_override;rows.push(row);
  }
  return rows;
 }
 async function save(client,rows){
  const fingerprint=JSON.stringify(rows);
  if(!attempt||attempt.fingerprint!==fingerprint)attempt={fingerprint,ids:rows.map(()=>crypto.randomUUID())};
  const values=rows.map((row,i)=>({...row,id:attempt.ids[i]}));
  let result;try{result=await client.from('meetings').insert(values).select('id');}catch(error){result={error};}
  if(result.error||result.data?.length!==rows.length){
   let check;try{check=await client.from('meetings').select('id').in('id',attempt.ids);}catch(_){check={error:true};}
   if(check.error)throw new Error('تعذر تأكيد الحفظ؛ راجع سجل الحجوزات قبل تغيير الطلب. إعادة المحاولة لن تكرر نفس المواعيد.');
   if(check.data?.length!==rows.length)throw new Error(result.error?.message||'لم تكتمل عملية الحفظ؛ راجع التعارضات');
  }
  attempt=null;return values;
 }
 root.CITLWeeklyBooking=Object.freeze({expand,save,dateAt,reset});
})(window);
