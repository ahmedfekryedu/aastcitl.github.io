(function(root){'use strict';
root.CITLAttendanceManual=async function(ui){
 const {rpc,clear,panel,el,select,field,button,table,cell,labelRow,departmentName,confirmRemoval,requestReason,status}=ui;
 const turn=clear(),data=await rpc('citl_attendance_manual',{p_action:'snapshot'});
 if(!ui.current(turn))return;
 const p=panel(data.manager?'التحضير اليدوي للمحاضرات':'التحضير اليدوي — أعضاء قسمي');
 p.append(el('p','التسجيل الإداري للمحاضرات الحالية والسابقة داخل الترم المحدد. الإضافة تظهر في التقارير، والحذف يزيل واقعة الحضور وأدلتها مع إبقاء أثر الإجراء في سجل التدقيق.','ar8-muted'));
 const filters=el('div',null,'ar8-fields');p.append(filters);
 const term=select(filters,'الترم','term',data.terms.map(t=>[t.id,t.name+(t.is_active?' — الحالي':' — سابق')]));
 const deps=[...new Set(data.visitors.map(v=>v.department))];
 const department=select(filters,'القسم','department',[['','جميع الأقسام المخولة'],...deps.map(d=>[d,departmentName(d)])]);
 const visitor=select(filters,'عضو هيئة التدريس المكلف','visitor',[]);
 const today=new Intl.DateTimeFormat('en-CA',{timeZone:'Africa/Cairo'}).format(new Date());
 const saturday=new Date(today+'T12:00:00Z');saturday.setUTCDate(saturday.getUTCDate()-(saturday.getUTCDay()+1)%7);
 const week=field(filters,'بداية الأسبوع','week','date',saturday.toISOString().slice(0,10));week.max=today;
 const content=el('div',null,'ar8-week'),tools=el('div',null,'ar8-actions');p.append(tools,content);let ticket=0;
 function names(){const previous=visitor.value;visitor.replaceChildren();for(const v of data.visitors.filter(v=>v.term_id===term.value&&(!department.value||v.department===department.value)))visitor.add(new Option(v.name+(v.active?'':' — موقوف'),v.id));if([...visitor.options].some(o=>o.value===previous))visitor.value=previous;}
 function payload(){return {term_id:term.value,visitor_id:visitor.value};}
 async function remove(scan,after){if(!await confirmRemoval('حذف حضور المحاضرة','سيُحذف حضور '+scan.lecture_date+' وأدلته من التقارير. لا يتغير الجدول أو تكليف المحاضر.'))return;await rpc('citl_attendance_manual',{p_action:'delete',p_payload:{...payload(),scan_id:scan.scan_id||scan.id,revision:scan.revision,confirmation:'delete_permanently'}});await after();status.textContent='تم حذف الحضور من التقارير.';}
 async function draw(){const request=++ticket;content.replaceChildren();if(!visitor.value){content.append(el('p','لا توجد تكليفات في هذا الترم والقسم.','ar8-muted'));return;}
  const selected=data.visitors.find(v=>v.id===visitor.value&&v.term_id===term.value),t=data.terms.find(t=>t.id===term.value);
  if(!selected.active||!t.source_available){content.append(el('p',!selected.active?'التكليف موقوف؛ يمكن مراجعة سجلاته السابقة دون تسجيل حضور جديد.':'مصدر جدول هذا الترم غير متاح. السجلات السابقة محفوظة، ولا تُنشأ محاضرات من بيانات غير مؤكدة.','ar8-warning'));return;}
  const result=await rpc('citl_attendance_manual',{p_action:'week',p_payload:{...payload(),week:week.value}});if(request!==ticket||!ui.current(turn))return;
  content.replaceChildren();content.append(el('p',result.note,'ar8-muted'));let count=0;
  for(const day of result.days){if(!day.sessions.length)continue;const section=panel(day.date,content),body=table(section,['المحاضرة / المحاضر','التوقيت والقاعة','الحضور','الإجراء']);
   for(const s of day.sessions){count++;const row=el('tr');const name=cell(row,'');name.append(el('strong',s.course_name),el('span',s.instructor,'ar8-cell-note'));cell(row,s.start_time.slice(0,5)+' – '+s.end_time.slice(0,5)+' · '+s.room_name);cell(row,s.status==='present'?'تم الحضور':s.status==='rejected'?'ملغى إداريًا':'لم يسجل حضور');const action=cell(row,'');
    if(s.scan_id)button('حذف الحضور',()=>remove({...s,lecture_date:day.date},draw),action).classList.add('ar8-danger');
    if(s.status!=='present')button('تسجيل الحضور',async()=>{const reason=await requestReason('تسجيل حضور إداري',s.course_name+' · '+day.date+' — يُحفظ اسم منفذ التسجيل ووقته.');if(!reason)return;await rpc('citl_attendance_manual',{p_action:'present',p_payload:{...payload(),session_id:s.session_id,date:day.date,source_revision:day.revision,revision:s.revision,reason}});await draw();status.textContent='تم تسجيل الحضور وإضافته للتقارير.';},action);
    body.append(row);labelRow(row);
   }
  }
  if(!count)content.append(el('p','لا توجد محاضرات متاحة للتحضير في الفترة المختارة حتى الآن.','ar8-muted'));
 }
 async function records(){const request=++ticket;if(!visitor.value)return;const result=await rpc('citl_attendance_manual',{p_action:'records',p_payload:payload()});if(request!==ticket||!ui.current(turn))return;content.replaceChildren();content.append(el('h3','سجل المحاضر — الترم المحدد'),el('p','أحدث 1000 سجل ظاهر لهذا المحاضر في الترم المحدد.','ar8-muted'));const body=table(content,['المحاضرة','اليوم والقاعة','الحالة','الإجراء']);for(const s of result.rows){const row=el('tr');cell(row,s.historical_context.course_name);cell(row,s.lecture_date+' · '+s.room_name);cell(row,s.status==='present'?'حاضر':'ملغى');button('حذف الحضور',()=>remove(s,records),cell(row,'')).classList.add('ar8-danger');body.append(row);labelRow(row);}if(!result.rows.length)content.append(el('p','لا توجد سجلات.'));}
 async function stepWeek(amount){const d=new Date(week.value+'T12:00:00Z');if(!Number.isFinite(d.getTime()))return;d.setUTCDate(d.getUTCDate()+amount);const next=d.toISOString().slice(0,10);if(next>today)return;week.value=next;await draw();}
 button('الأسبوع السابق',()=>stepWeek(-7),tools);button('عرض الأسبوع',draw,tools);button('الأسبوع التالي',()=>stepWeek(7),tools);button('سجلات المحاضر',records,tools);button('طباعة المعروض',()=>root.print(),tools);
 function changed(){names();draw().catch(ui.report);}term.onchange=changed;department.onchange=changed;visitor.onchange=()=>draw().catch(ui.report);names();await draw();status.textContent=data.manager?'تحضير إداري موثق حسب الترم والأسبوع.':'تظهر تكليفات الأقسام المخولة لك فقط.';
};
})(window);
