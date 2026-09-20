(function(root) {
  'use strict';
  const weeks = new Map(), pending = new Map();
  let watching = false;
  const dateKey = date => `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`;
  function weekStart(value = new Date()) {
    const date = new Date(value); date.setHours(12,0,0,0);
    date.setDate(date.getDate() - (date.getDay()+1)%7);
    return date;
  }
  function weekDays(value) {
    const start = weekStart(value);
    return Array.from({length:6},(_,offset)=>{const date=new Date(start);date.setDate(start.getDate()+offset);return date;});
  }
  const minutes = time => Number(time.slice(0,2))*60 + Number(time.slice(3,5));
  function key(room, start) { return room + ':' + dateKey(start); }
  function load(sb, room, start, redraw) {
    if (!room) return;
    if (!watching) {
      watching = true;
      const refresh = () => { weeks.clear(); if (!document.hidden) redraw(); };
      setInterval(refresh, 60000);
      if (sb.channel) {
        const channel = sb.channel('citl-academic-booking-calendar');
        for (const table of ['academic_schedule','schedule_actions','rooms']) channel.on('postgres_changes',{event:'*',schema:'public',table},refresh);
        channel.subscribe();
      }
      root.addEventListener('online',refresh);
    }
    const k = key(room,start), cached = weeks.get(k);
    if ((cached && Date.now()-cached.at<15000) || pending.has(k)) return;
    const end = new Date(start); end.setDate(end.getDate()+6);
    pending.set(k, sb.rpc('citl_booking_lectures',{p_room:room,p_from:dateKey(start),p_to:dateKey(end)}).then(({data,error}) => {
      weeks.set(k,{at:Date.now(),rows:error?null:data || [],error:!!error});
    }).catch(() => weeks.set(k,{at:Date.now(),rows:null,error:true})).finally(() => { pending.delete(k); redraw(); }));
  }
  function paint(cell, sb, room, start, day, time, open) {
    const cached = weeks.get(key(room,start));
    if (!cached || cached.error) {
      cell.textContent = cached?.error ? 'تعذر التحقق من المحاضرات' : 'جاري التحقق…';
      cell.style.cssText += ';font-size:10px;color:#69769b;text-align:center;padding:8px';
      // Submission always rechecks on the server, even if the calendar could not load.
      cell.addEventListener('click',open); return;
    }
    const rows = cached.rows.filter(r => r.lecture_date===dateKey(day) && minutes(r.start_time)<minutes(time)+60 && minutes(r.end_time)>minutes(time));
    if (!rows.length) { cell.addEventListener('click',open); return; }
    const block = document.createElement('div');
    block.style.cssText='background:#eef0fa;color:#2A3475;border-right:3px solid #F3A628;margin:4px;padding:7px;border-radius:6px;font-size:10px;line-height:1.6;height:calc(100% - 8px)';
    const title=document.createElement('strong');title.textContent='محجوز لمحاضرة';block.append(title);
    for (const row of rows) { const line=document.createElement('div'); line.textContent=`${row.course_name || 'محاضرة'} · ${row.start_time.slice(0,5)}–${row.end_time.slice(0,5)}`;block.append(line); }
    cell.append(block);
    cell.addEventListener('click',async () => {
      const approved = root.CITLPermissions.can(root.currentUser,'can_approve');
      const message = approved ? 'هذا الموعد محجوز لمحاضرة. هل تريد تجهيز اجتماع بدلًا منها في هذا التاريخ؟ ستؤكد التعارض الحالي عند الحفظ.' : 'هذا الموعد محجوز لمحاضرة. يمكن إرسال طلب اجتماع، ويظل معلقًا حتى يراجعه مسؤول الاعتماد. متابعة؟';
      if (await root.showConfirmDialog(message)) open();
    });
  }
  async function check(sb, data, user, confirm = root.showConfirmDialog) {
    const {data:collisions,error} = await sb.rpc('citl_booking_conflicts',{p_room:data.room_id,p_date:data.date,p_start:data.start_time || data.startTime,p_end:data.end_time || data.endTime});
    if (error || !Array.isArray(collisions)) throw new Error('تعذر التحقق من تعارض المحاضرات؛ لم يُحفظ الحجز. تأكد من تطبيق ملف ربط القاعات.');
    if (!root.CITLPermissions.can(user,'can_approve')) {
      if (collisions.length && !await confirm('الموعد محجوز لمحاضرة. هل تريد إرسال طلب اجتماع لمراجعة مسؤول الاعتماد؟ لن يصبح حجزًا مؤكدًا الآن.')) throw new Error('تم إلغاء الطلب');
      return {};
    }
    if (!collisions.length) return {academic_override:null};
    const names=collisions.map(r=>`${r.course_name || 'محاضرة'} (${r.start_time.slice(0,5)}–${r.end_time.slice(0,5)})`).join('\n');
    if (!await confirm('الموعد يتعارض مع:\n'+names+'\nهل تعتمد تخصيص هذا الموعد للاجتماع في هذه القاعة وهذا اليوم؟')) throw new Error('تم إلغاء الحفظ؛ المحاضرة لم تتغير');
    return {academic_override:collisions};
  }
  async function roomSelect(sb, selected='') {
    let select=document.getElementById('room-edit-academic');
    if (!select) {
      const name=document.getElementById('room-edit-name'); if (!name) return;
      const wrapper=document.createElement('div');const label=document.createElement('label');label.htmlFor='room-edit-academic';label.textContent='ربط القاعة بالجدول الدراسي';label.className='block text-sm font-bold text-gray-600 mb-1';
      select=document.createElement('select');select.id='room-edit-academic';select.className='w-full border rounded-xl px-3 py-2 font-bold';wrapper.append(label,select);name.parentElement.after(wrapper);
    }
    select.dataset.selection=selected;select.disabled=true;
    const {data,error}=await sb.rpc('citl_booking_room_names');
    if (select.dataset.selection!==selected) return;
    if (error) { select.replaceChildren(new Option('تعذر تحميل قاعات الجدول — أعد فتح التبويب','')); return; }
    select.replaceChildren(new Option('بدون ربط دراسي',''));
    const names=new Set((data || []).map(r=>r.room_name));if(selected) names.add(selected);
    for(const name of [...names].sort((a,b)=>a.localeCompare(b,'ar'))) select.add(new Option(name,name));
    select.value=selected;select.disabled=false;select.dispatchEvent(new Event('change',{bubbles:true}));
  }
  root.CITLAcademicBooking=Object.freeze({load,paint,check,roomSelect,dateKey,weekStart,weekDays,invalidate:()=>weeks.clear()});
})(window);
