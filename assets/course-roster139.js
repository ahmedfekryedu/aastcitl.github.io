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
  const pool=rows.filter(o=>o.source_active),label=o=>o.department_key?departments[o.department_key]||o.department_key:'لم تُسند لقسم';
  const eligible=o=>(o.department_key===department&&flags.get(o.id)?.enabled===false)||(technical&&!o.department_key&&(!o.source_department||o.source_department===department||o.reference?.released_for_department141===true));
  const state=o=>o.department_key===department?(flags.get(o.id)?.enabled===false?'مستبعدة — يمكن إعادتها':'موجودة بقائمة هذا القسم'):o.department_key?'مرتبطة بقسم آخر':eligible(o)?'متاحة لاختيار القسم واللائحة':'تحتاج مراجعة قسم المصدر';
  const d=dialog('اختيار مواد من الجدول — '+departments[department],`<p>مواد الجدول الحالي ظاهرة أدناه دون كتابة بحث. اختر «المتاحة للإضافة» لتضييق القائمة. المادة الموجودة بقسم آخر تظهر للتوضيح ولا تُسحب منه.</p><div class="s143-pool-filters"><label>عرض المواد<select data-roster-filter><option value="all">كل مواد الجدول</option><option value="available">المتاحة للإضافة فقط</option><option value="current">مواد القسم المختار</option><option value="other">المواد المسندة لأقسام أخرى</option></select></label><label>بحث اختياري بالاسم أو المحاضر أو الكود<input type="search" data-roster-search placeholder="اكتب هنا فقط إذا أردت البحث"></label></div><p data-roster-count role="status"></p><div data-roster-pool></div>`);
  const draw=()=>{const q=d.querySelector('[data-roster-search]').value.trim().toLowerCase(),filter=d.querySelector('[data-roster-filter]').value;
   const found=pool.filter(o=>[o.course_name,o.course_code,...(o.teachers||[]).map(t=>t.name)].join(' ').toLowerCase().includes(q)&&(filter==='all'||filter==='available'&&eligible(o)||filter==='current'&&o.department_key===department||filter==='other'&&o.department_key&&o.department_key!==department)).sort((a,b)=>label(a).localeCompare(label(b),'ar')||a.course_name.localeCompare(b.course_name,'ar'));
   d.querySelector('[data-roster-count]').textContent=found.length+' مادة ظاهرة · '+pool.filter(eligible).length+' متاحة للإضافة أو الاستعادة';
   let group='';d.querySelector('[data-roster-pool]').innerHTML=found.length?`<div class="cm-table-wrap s143-pool-table"><table class="cm-table"><thead><tr><th>المادة</th><th>المحاضر من الجدول</th><th>الحالة</th><th>الاختيار</th></tr></thead><tbody>${found.map((o,i)=>{const dep=label(o),heading=dep!==group?`<tr class="s143-pool-group"><th colspan="4">${E(dep)}</th></tr>`:'';group=dep;return heading+`<tr><td data-label="المادة"><strong>${E(o.course_name)}</strong><small>${E(o.course_code)}</small></td><td data-label="المحاضر">${(o.teachers||[]).map(t=>E(t.name)).join('، ')||'غير محدد في الجدول'}</td><td data-label="الحالة">${E(state(o))}</td><td data-label="الاختيار">${eligible(o)?`<button class="cm-btn" data-roster-pick="${i}">${o.department_key?'إعادة إلى القسم':'اختيار المادة'}</button>`:'<span class="s135-tag">غير متاحة للإضافة</span>'}</td></tr>`;}).join('')}</tbody></table></div>`:'<p class="s135-note">لا توجد نتائج لهذا الفلتر أو البحث. جرّب «كل مواد الجدول» وامسح البحث. لا ننشئ مواد غير موجودة في الجدول.</p>';
   d.querySelectorAll('[data-roster-pick]').forEach(b=>b.onclick=()=>{const o=found[Number(b.dataset.rosterPick)];d.close();if(o.department_key)change(o,true,reload).catch(e=>document.getElementById('cm-status').textContent=e.message);else onReference(o);});
  };d.querySelector('[data-roster-search]').oninput=draw;d.querySelector('[data-roster-filter]').onchange=draw;draw();
 }

 function release(o,tid,reload){
  if(!ready||!flags.has(o.id))throw Error('حدّث قائمة المواد قبل تغيير القسم.');
  const f=flags.get(o.id),d=dialog('إتاحة المادة للاختيار في قسم آخر',`<p><strong>${E(o.course_name)}</strong> · ${E(o.course_code)}</p><p>ستُزال من قائمة القسم الحالي وتظهر ضمن «إضافة من جدول الفصل» في الأقسام. أول قسم تُضاف إليه يحجز هذا الطرح؛ لا تُنشأ نسخة مكررة.</p><p>يُنهى تكليف المنسقين والمستوفي الحالي لهذه المادة مع حفظ سجلهم. لا يتغير جدول المحاضر أو محاضراته. يلزم اعتماد القسم واللائحة وتعيين المنسقين من جديد بالقسم الآخر.</p>${o.reports?'<p role="alert">بدأت تقارير لهذه المادة؛ النقل غير متاح حفاظًا على قسمها وتاريخها. يمكنك استخدام الاستبعاد فقط.</p>':'<p role="alert"></p><button type="button" class="cm-btn" data-release-confirm>تأكيد الإتاحة لقسم آخر</button>'}`);
  const b=d.querySelector('[data-release-confirm]');if(!b)return;
  let busy=false;d.addEventListener('cancel',e=>{if(busy)e.preventDefault();});
  b.onclick=async()=>{if(busy)return;busy=true;d.querySelectorAll('button').forEach(x=>x.disabled=true);try{
   await root.CITLRequests.rpc(root.sb,'citl_course_release141',{p_payload:{term_id:tid,offering_id:o.id,revision:o.revision,department:o.department_key,expected_enabled:f.enabled,expected_updated_at:f.updated_at,confirmation:'RELEASE_DEPARTMENT_KEEP_HISTORY'}});
   d.close();await reload();
  }catch(e){d.querySelector('[role=alert]').textContent=/PGRST202|42883|Could not find|does not exist/.test(e.code+' '+e.message)?'خدمة تغيير القسم غير متاحة في هذه النسخة؛ راجع مسؤول النظام. لم تتغير المادة.':e.message;}finally{busy=false;d.querySelectorAll('button').forEach(x=>x.disabled=false);}};
 }
 root.CITLCourseRoster139={load,open,change,release,ready:()=>ready,warning:()=>warning,excluded:id=>flags.get(id)?.enabled===false,known:id=>ready&&flags.has(id)};
})(window);
