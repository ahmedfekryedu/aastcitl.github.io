(function(root) {
  'use strict';
  const clock=n=>String(Math.floor(n/60)).padStart(2,'0')+':'+String(n%60).padStart(2,'0');
  const minute=t=>/^\d{2}:\d{2}(?::\d{2})?$/.test(String(t))?Number(t.slice(0,2))*60+Number(t.slice(3,5)):NaN;
  const esc=t=>String(t??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  function impact(rows,from,to) {
    const a=minute(from),b=minute(to);
    if(!Number.isFinite(a)||!Number.isFinite(b)||a>=b)return [];
    return rows.filter(r=>minute(r.start_time)<b&&minute(r.end_time)>a).map(r=>{
      const start=minute(r.start_time),end=minute(r.end_time),left=[];
      if(start<a)left.push(clock(start)+'–'+clock(Math.min(a,end)));
      if(end>b)left.push(clock(Math.max(start,b))+'–'+clock(end));
      return {course:r.course_name||'محاضرة',reserved:'\u2066'+clock(Math.max(start,a))+'–'+clock(Math.min(end,b))+'\u2069',remaining:left.map(t=>'\u2066'+t+'\u2069')};
    });
  }
  function summary(rows,from,to) {
    return impact(rows,from,to).map(r=>r.course+' — وقت الاجتماع: '+r.reserved+'؛ '+(r.remaining.length?'يبقى للمحاضرة: '+r.remaining.join('، '):'يشمل وقت المحاضرة كاملًا في هذا اليوم')).join('\n');
  }
  let active=null;
  function choose(rows,from,to,date) {
    if(active)return Promise.resolve(null);
    const min=minute(from),max=minute(to);
    if(!Number.isFinite(min)||!Number.isFinite(max)||max<=min)return Promise.resolve(null);
    return new Promise(resolve=>{
      const previous=document.activeElement,dialog=document.createElement('dialog');active=dialog;
      dialog.className='citl-lecture-slot';dialog.dir='rtl';dialog.setAttribute('aria-labelledby','citl-lecture-slot-title');
      dialog.innerHTML=`<form method="dialog"><header><div><h2 id="citl-lecture-slot-title">طلب وقت من قاعة محاضرة</h2><p>${esc(date)} · ${esc(from)}–${esc(to)}</p></div><button type="button" data-close aria-label="إغلاق">×</button></header><div class="citl-slot-body"><p>حدّد وقت الاجتماع فقط. يبقى باقي وقت المحاضرة محفوظًا، ولا يُحذف الجدول.</p><div class="citl-slot-presets" role="group" aria-label="مدة الاجتماع"><button type="button" data-minutes="30">نصف ساعة</button><button type="button" data-minutes="60">ساعة</button><button type="button" data-full>الفترة المتاحة كاملة</button></div><div class="citl-slot-times"><label>من<input name="from" type="time" required step="60" min="${esc(from)}" max="${esc(to)}" value="${esc(from)}"></label><label>إلى<input name="to" type="time" required step="60" min="${esc(from)}" max="${esc(to)}" value="${clock(Math.min(min+30,max))}"></label></div><div class="citl-slot-impact" aria-live="polite"></div><p class="citl-slot-error" role="alert" hidden></p><p class="citl-slot-note">هذه الخطوة تجهّز الطلب فقط؛ تأكيد الحجز يخضع لصلاحيات ومسار الاعتماد الحالي.</p></div><footer><button type="submit" class="citl-slot-primary">متابعة طلب الاجتماع</button><button type="button" data-close>إلغاء</button></footer></form>`;
      document.body.append(dialog);
      const form=dialog.querySelector('form'),start=form.elements.from,end=form.elements.to,error=dialog.querySelector('.citl-slot-error'),details=dialog.querySelector('.citl-slot-impact'),submit=dialog.querySelector('[type=submit]');
      function refresh(){
        const a=minute(start.value),b=minute(end.value),valid=Number.isFinite(a)&&Number.isFinite(b)&&a>=min&&b<=max&&a<b;
        error.hidden=valid;error.textContent=valid?'':'اختر بداية ونهاية داخل الفترة المتاحة، على أن تكون النهاية بعد البداية.';
        submit.disabled=!valid;details.textContent=valid?summary(rows,start.value,end.value):'';
        dialog.querySelectorAll('[data-minutes]').forEach(btn=>{const duration=Number(btn.dataset.minutes);btn.disabled=!Number.isFinite(a)||a<min||a+duration>max;btn.setAttribute('aria-pressed',String(valid&&b-a===duration));});
        dialog.querySelector('[data-full]').setAttribute('aria-pressed',String(valid&&a===min&&b===max));
        return valid;
      }
      function close(result){if(active!==dialog)return;active=null;dialog.close();dialog.remove();if(previous?.isConnected)previous.focus({preventScroll:true});resolve(result);}
      dialog.querySelectorAll('[data-close]').forEach(btn=>btn.onclick=()=>close(null));
      dialog.addEventListener('cancel',event=>{event.preventDefault();close(null);});
      dialog.addEventListener('click',event=>{if(event.target===dialog){const box=dialog.getBoundingClientRect();if(event.clientX<box.left||event.clientX>box.right||event.clientY<box.top||event.clientY>box.bottom)close(null);}});
      dialog.querySelectorAll('[data-minutes]').forEach(btn=>btn.onclick=()=>{end.value=clock(minute(start.value)+Number(btn.dataset.minutes));refresh();});
      dialog.querySelector('[data-full]').onclick=()=>{start.value=from;end.value=to;refresh();};
      start.oninput=end.oninput=refresh;
      form.onsubmit=event=>{event.preventDefault();if(refresh())close({time:start.value,duration:(minute(end.value)-minute(start.value))/60});};
      dialog.querySelector('.citl-slot-note').textContent='موافقة المحاضر أولًا، ثم اعتماد مسؤول الحجوزات. لا يُحجز الوقت قبل الموافقتين.';
      refresh();dialog.showModal();
    });
  }
  root.CITLLectureBookingSlot=Object.freeze({choose,impact,summary});
})(window);
