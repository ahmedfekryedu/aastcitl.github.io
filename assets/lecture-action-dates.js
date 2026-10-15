/* Dates come from the server's Cairo calendar and current-term permission boundary. */
(function(root){
 'use strict';
 let serial=0,loading=false;
 const label=value=>new Intl.DateTimeFormat('ar-EG',{weekday:'long',day:'numeric',month:'long',year:'numeric',timeZone:'Africa/Cairo'}).format(new Date(value+'T12:00:00Z'));
 async function prepare(id,date){
  const ticket=++serial;loading=true;const save=document.getElementById('sa-save-btn');if(save)save.disabled=true;
  try{const data=await root.CITLRequests.rpc(root.sb,'citl_lecture_action_dates',{p_schedule_id:String(id),p_date:date||null});
   if(ticket!==serial)return null;return data;
  }finally{if(ticket===serial){loading=false;if(save)save.disabled=false;}}
 }
 function mount(item,data){
  let host=document.getElementById('sa-date-picker');if(!host){host=document.createElement('section');host.id='sa-date-picker';document.getElementById('sa-summary').parentElement.before(host);}
  host.hidden=false;host.replaceChildren();
  const heading=document.createElement('strong');heading.textContent='موعد الإجراء — الأسبوع السابق والأربعة أسابيع القادمة';host.append(heading);
  const grid=document.createElement('div');grid.className='citl-action-date-grid';host.append(grid);
  for(const date of data.dates||[]){const b=document.createElement('button');b.type='button';b.textContent=label(date)+(date<data.today?" — موعد سابق":"");b.setAttribute('aria-pressed',String(date===data.selected));
   b.onclick=()=>change(date);grid.append(b);}
  if(!data.dates?.length){const p=document.createElement('p');p.textContent='لا توجد مواعيد متاحة ضمن الأسبوع السابق والأربعة أسابيع القادمة.';host.append(p);}
  if(data.manager){const wrap=document.createElement('label');wrap.textContent='للمدير أو المفوّض: اختر موعدًا آخر من بداية الترم';const input=document.createElement('input');input.type='date';input.min=data.starts_on;if(data.ends_on)input.max=data.ends_on;input.value=data.selected||'';
   input.onchange=()=>{if(input.value&&input.reportValidity())change(input.value);};wrap.append(input);host.append(wrap);}
  const selected=document.createElement('p');selected.className='citl-selected-action-date';selected.setAttribute('role','status');selected.textContent=data.selected?'الإجراء ليوم '+label(data.selected):'اختر موعدًا قبل حفظ الإجراء';host.append(selected);
  const save=document.getElementById('sa-save-btn');if(save)save.disabled=!data.selected;
  async function change(date){if(loading)return;grid.querySelectorAll('button').forEach(b=>b.disabled=true);host.querySelectorAll('input').forEach(i=>i.disabled=true);
   try{await root.openScheduleActionModal(encodeURIComponent(JSON.stringify(item)),date);}
   finally{if(host.isConnected){host.querySelectorAll('button,input').forEach(b=>b.disabled=false);const input=host.querySelector('input');if(input)input.value=document.getElementById('sa-action-date').value;}}
  }
 }
 function report(){++serial;loading=false;const host=document.getElementById('sa-date-picker');if(host)host.hidden=true;const save=document.getElementById('sa-save-btn');if(save)save.disabled=false;}
 async function confirm(date,type){if(loading)return false;const names={cancel:'إلغاء المحاضرة',replace:'إحلال المحاضر',move_room:'تغيير القاعة',replace_and_move:'إحلال وتغيير القاعة'};
  return root.showCustomConfirm((names[type]||'حفظ الإجراء')+' ليوم '+label(date)+'؟\nراجع التاريخ للتأكد من اختيار الأسبوع الصحيح. يُطبق الإجراء على هذا الموعد فقط.');
 }
 root.CITLLectureDates={prepare,mount,report,confirm,label};
})(window);
