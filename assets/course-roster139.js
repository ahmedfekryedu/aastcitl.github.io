(function(root){
 'use strict';
 const E=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const departments={'transport-logistics':'قسم إدارة لوجستيات النقل','supply-chain':'قسم إدارة لوجستيات سلاسل الإمداد','trade-logistics':'قسم إدارة لوجستيات التجارة الدولية','energy-logistics':'قسم إدارة لوجستيات الطاقة والبترول'};
 let flags=new Map(),ready=false,warning='',term='',scope='',version=0;
 const rpc=(action,payload={})=>root.CITLRequests.rpc(root.sb,'citl_course_roster139',{p_action:action,p_payload:{term_id:term,department:scope,...payload}});
 async function load(t,d){const id=++version;term=t;scope=d;ready=false;warning='';flags=new Map();
  try{const result=await rpc('list');if(id!==version)return;flags=new Map((result.items||[]).map(x=>[x.id,x]));ready=true;}
  catch(e){if(id!==version)return;warning='تعذر التحقق من قائمة المواد المستبعدة. لم يُغيّر أي تكليف. راجع تثبيت SQL139 وفحصه أو أعد التحديث؛ الإضافة والاستبعاد غير متاحين الآن.';}
 }
 function dialog(title,body){const d=document.createElement('dialog');d.className='cm-dialog s135-dialog';d.innerHTML=`<header><strong>${E(title)}</strong><button type="button" data-roster-close aria-label="إغلاق">×</button></header><div class="cm-body">${body}</div>`;document.body.append(d);d.onclose=()=>d.remove();d.querySelector('[data-roster-close]').onclick=()=>d.close();d.showModal();return d;}
 async function change(o,enabled,reload){
  const f=flags.get(o.id);if(!ready||!f)throw Error('حدّث قائمة المواد قبل تعديلها.');
  const snapshot={term_id:term,department:scope,offering_id:o.id,enabled,expected_enabled:f.enabled,expected_updated_at:f.updated_at};
  const d=dialog(enabled?'إعادة المادة إلى الاستيفاء':'استبعاد المادة من قائمة الاستيفاء',`<p><strong>${E(o.course_name)}</strong> · ${E(o.course_code)}</p><p>${enabled?'ستعود المادة لقائمة القسم؛ يلزم اعتماد المرجع والتكليف والإتاحة قبل الاستيفاء.':'ستُخفى المادة من قائمة تعيين المنسقين والعمل الحالي. لا تُحذف من الجدول ولا تُحذف تقاريرها أو تكليفاتها؛ يمكن إعادتها لاحقًا.'}</p><p>تقارير محفوظة: ${Number(o.reports)||0}. يُسجل الحساب المنفذ والتاريخ تلقائيًا.</p><p role="alert"></p><div class="s135-actions"><button type="button" class="cm-btn" data-roster-confirm>${enabled?'إعادة المادة':'تأكيد الاستبعاد'}</button><button type="button" class="cm-btn secondary" data-roster-cancel>إلغاء</button></div>`);
  d.querySelector('[data-roster-cancel]').onclick=()=>d.close();let busy=false;d.addEventListener('cancel',e=>{if(busy)e.preventDefault();});
  d.querySelector('[data-roster-confirm]').onclick=async()=>{if(busy)return;busy=true;d.querySelectorAll('button').forEach(b=>b.disabled=true);
   try{await rpc('set',snapshot);d.close();await reload();}catch(e){if(d.isConnected)d.querySelector('[role=alert]').textContent=e.message||'تعذر حفظ الحالة؛ حدّث القائمة.';}finally{busy=false;d.querySelectorAll('button').forEach(b=>b.disabled=false);}
  };
 }
 function open({rows,department,technical,active,onReference,reload}){
  if(!active)throw Error('اختر الفصل الحالي.');if(!departments[department])throw Error('اختر القسم الذي تريد إضافة المادة إليه أولًا.');if(!ready)throw Error(warning||'حدّث قائمة المواد.');
  const pool=rows.filter(o=>o.source_active&&((o.department_key===department&&flags.get(o.id)?.enabled===false)||(technical&&!o.department_key&&(!o.source_department||o.source_department===department))));
  const d=dialog('إضافة من جدول الفصل — '+departments[department],`<p>اختر مادة موجودة في جدول الفصل: إعادة مادة مستبعدة، أو إسناد مادة لم يُحسم قسمها بعد. لا نُنشئ مادة جديدة ولا ننسخ تكليفات مادة أخرى.</p><label>بحث المادة أو الكود<input type="search" data-roster-search></label><p>${rows.filter(o=>o.source_active&&o.department_key===department&&flags.get(o.id)?.enabled!==false).length} مادة موجودة بالفعل بقائمة القسم. المواد المرتبطة بقسم آخر لا تُنقل تلقائيًا؛ راجع ربطها بالجدول قبل تعديل نطاقها.</p><div data-roster-pool></div>`);
  const draw=()=>{const q=d.querySelector('[data-roster-search]').value.trim().toLowerCase();const found=pool.filter(o=>(o.course_name+' '+o.course_code).toLowerCase().includes(q));d.querySelector('[data-roster-pool]').innerHTML=found.length?`<div class="cm-table-wrap"><table class="cm-table"><thead><tr><th>المادة</th><th>الحالة</th><th>الإجراء</th></tr></thead><tbody>${found.map((o,i)=>`<tr><td data-label="المادة"><strong>${E(o.course_name)}</strong><small>${E(o.course_code)}</small></td><td data-label="الحالة">${o.department_key?'مستبعدة من الاستيفاء':'القسم غير محسوم'}</td><td data-label="الإجراء"><button class="cm-btn" data-roster-pick="${i}">${o.department_key?'إعادة إلى القسم':'تحديد القسم واللائحة'}</button></td></tr>`).join('')}</tbody></table></div>`:'<p class="s135-note">لا توجد مواد مطابقة قابلة للإضافة في القائمة الحالية. إن كانت مادة موجودة بالجدول ولا تظهر هنا أو بقسمها، افتح «معاينة ومزامنة الجدول» وراجع المطابقة؛ لا تُضف نسخة مكررة.</p>';
   d.querySelectorAll('[data-roster-pick]').forEach(b=>b.onclick=()=>{const o=found[Number(b.dataset.rosterPick)];d.close();if(o.department_key)change(o,true,reload).catch(e=>document.getElementById('cm-status').textContent=e.message);else onReference(o);});
  };d.querySelector('[data-roster-search]').oninput=draw;draw();
 }
 root.CITLCourseRoster139={load,open,change,ready:()=>ready,warning:()=>warning,excluded:id=>flags.get(id)?.enabled===false,known:id=>ready&&flags.has(id)};
})(window);
