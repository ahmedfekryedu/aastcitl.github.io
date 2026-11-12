/* COURSES144 export only. Identities and roles remain owned by existing RPCs. */
(function(root){
 'use strict';
 const VERSION='CITL-COURSES144-EXCEL-1';
 const departments=Object.freeze({'supply-chain':'قسم إدارة لوجستيات سلاسل الإمداد','transport-logistics':'قسم إدارة لوجستيات النقل','trade-logistics':'قسم إدارة لوجستيات التجارة الدولية','energy-logistics':'قسم إدارة لوجستيات الطاقة والبترول'});
 const roles=Object.freeze({coordinator:'منسق مقرر',assistant_coordinator:'منسق مساعد',group_lead:'رئيس مجموعة',senior_coordinator:'كبير المنسقين'});
 // Same whitespace keys as citl_instructor_key / citl_course_key135. No fuzzy identity matching.
 const nameKey=v=>String(v??'').replace(/[\u00a0\u202f\ufeff]/g,' ').replace(/\s+/g,' ').trim();
 const titleKey=v=>nameKey(v).toLowerCase();
 const unknown=v=>['','غير محدد','غير محددة','غيرمحدد','غيرمحددة','لم يحدد','لم يُحدد','غير معين','unknown','tbd','not specified','unspecified','-','—'].includes(titleKey(v));
 const codeKey=v=>String(v??'').trim().toUpperCase();
 const group=s=>String(s.group_number||s.group_name||'').trim();
 const sourceKey=(code,title,grp)=>JSON.stringify([codeKey(code),titleKey(title),grp||'']);
 const unique=a=>[...new Set(a)];
 function canonical(v){if(Array.isArray(v))return '['+v.map(canonical).join(',')+']';if(v&&typeof v==='object')return '{'+Object.keys(v).sort().map(k=>JSON.stringify(k)+':'+canonical(v[k])).join(',')+'}';return JSON.stringify(v??null);}
 async function hash(v){const bytes=new TextEncoder().encode(canonical(v));return Array.from(new Uint8Array(await root.crypto.subtle.digest('SHA-256',bytes)),b=>b.toString(16).padStart(2,'0')).join('');}
 const safe=v=>String(v??'').replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g,'');
 const pick=(o,keys)=>Object.fromEntries(keys.filter(k=>o[k]!==undefined).map(k=>[k,o[k]]));
 const scheduleFields=['id','term_id','course_name','course_code','group_number','group_name','instructor','room_name','day_of_week','time_slot','period_order','period_span','effective_at','effective_from','term_starts_on','term_ends_on'];
 const assignmentFields=['id','term_id','offering_id','department_key','profile_id','responsibility','active','is_primary','can_review','revision','assigned_at','name'];
 function sanitizeSchedule(s){return pick(s,scheduleFields);}
 function sanitizeList(data){return {
  rows:(data.rows||[]).map(o=>({...pick(o,['id','course_name','course_code','group_key','department_key','source_active','revision','source_department']),reference:pick(o.reference||{},['review_status','review_department','owner_department','regulation','language','source','approved_at','scope_version']),teachers:(o.teachers||[]).map(t=>pick(t,['name','profile_id'])),assignments:(o.assignments||[]).map(a=>pick(a,assignmentFields))})).sort((a,b)=>a.id.localeCompare(b.id)),
  accounts:(data.accounts||[]).map(a=>pick(a,['id','name','department'])).sort((a,b)=>a.id.localeCompare(b.id)),
  seniors:(data.seniors||[]).map(a=>pick(a,assignmentFields)).sort((a,b)=>a.id.localeCompare(b.id))
 };}
 function assertScope(context,termId,department){
  const term=context.terms?.find(t=>t.id===termId);
  if(!term||!term.is_active||term.schedule_deleted_at)throw Error('اختر الفصل الحالي المتاح؛ لا يُصدَّر أرشيف الفصول.');
  if(!departments[department]||!context.departments?.includes(department))throw Error('تصدير هذا القسم غير متاح ضمن صلاحيات حسابك.');
  return pick(term,['id','name','code','starts_on','ends_on','is_active','schedule_deleted_at']);
 }
 function build({context,termId,department,listing,schedule,flags,registeredAccounts=[]}){
  const term=assertScope(context,termId,department),data=sanitizeList(listing);
  const registered=new Map(registeredAccounts.map(a=>[a.id,a.name]));
  data.accounts.forEach(a=>{if(registered.has(a.id))a.name=registered.get(a.id);});
  const accounts=new Map(data.accounts.map(a=>[a.id,a])),seen=new Map(),sources=new Map(),warnings=[];
  const sourceRows=schedule.filter(s=>s.term_id===termId).map(sanitizeSchedule).sort((a,b)=>String(a.id).localeCompare(String(b.id)));
  for(const s of sourceRows){if(seen.has(String(s.id)))throw Error('تكرر معرّف حصة أثناء القراءة؛ أعد فتح المعاينة.');seen.set(String(s.id),true);const key=sourceKey(s.course_code,s.course_name,group(s));if(!sources.has(key))sources.set(key,[]);sources.get(key).push(s);}
  const roster=new Map((flags.items||[]).map(f=>[f.id,f]));
  const byId=new Map();
  for(const o of data.rows){
   if(!o.source_active)continue;
   if(!context.technical&&o.department_key!==department)throw Error('أعاد المصدر طرحًا خارج نطاق القسم المخول؛ أوقفنا التصدير.');
   if(byId.has(o.id)){if(canonical(byId.get(o.id).original)!==canonical(o))throw Error('بيانات متعارضة لنفس هوية الطرح.');continue;}
   const teachers=new Set(o.teachers.map(t=>nameKey(t.name)));
   const live=(sources.get(sourceKey(o.course_code,o.course_name,o.group_key))||[]).filter(s=>teachers.has(nameKey(s.instructor))||(!teachers.size&&unknown(s.instructor)));
   if(!live.length){warnings.push({id:o.id,name:o.course_name,message:'استُبعد من التصدير: لا توجد حصة حالية مطابقة لهوية المصدر والمحاضر؛ راجع تحديث الصفحة.'});continue;}
   const ref=o.reference,verified=ref.review_status==='verified';
   const owner=verified&&departments[ref.owner_department]?ref.owner_department:null;
   const linked=departments[o.department_key]?o.department_key:null;
   const candidates=unique(o.teachers.map(t=>accounts.get(t.profile_id)?.department).filter(d=>departments[d]));
   const status=owner?'قسم معتمد':linked?'ارتباط حالي بالقسم — غير معتمد':candidates.includes(department)?'مرشح من قسم المحاضر — ليس ملكية':'تحتاج تحديد القسم';
   const match=(owner||linked)===department,rank=owner===department?0:!owner&&linked===department?1:!owner&&!linked&&candidates.includes(department)?2:3;
   const raw=unique(live.map(s=>s.instructor).filter(Boolean)),notes=[];
   if(raw.some(n=>/\/\s*(?:Dr\.?|Prof\.?|Ms\.?|Mrs\.?|Mr\.?)\s*$/i.test(n)))notes.push('اسم محاضر مركب غير مكتمل في المصدر؛ احتُفظ باسم المادة والنص كما وردا دون تخمين.');
   const separated=unique(raw.flatMap(n=>{const parts=n.split(/\s*\/\s*/);return parts.length>1&&parts.every(p=>/^(?:Dr\.?|Prof\.?|Ms\.?|Mrs\.?|Mr\.?)\s+\S.+/i.test(p))?parts:[n];}));
   if(!roster.has(o.id))throw Error('تعذر التحقق من حالة إحدى مواد الجدول؛ أعد فتح المعاينة.');
   if(roster.get(o.id).enabled===false)notes.push('مستبعدة من الاستيفاء حاليًا؛ تصديرها لا يعيد تفعيلها.');
   if(owner&&owner!==department||!owner&&linked&&linked!==department)notes.push('أضيفت لنطاق الملف فقط؛ لا يتغير قسم المادة في النظام.');
   if(!verified)notes.push('المرجع لم يُعتمد؛ استكمال Excel لا يعتمد البيانات داخل النظام.');
   const row={id:o.id,original:o,name:o.course_name,displayName:o.course_name,officialArabic:'',officialEnglish:o.course_name,officialCode:'',
    regulation:verified&&['OLD','NEW'].includes(ref.regulation)?ref.regulation:'UNKNOWN',language:verified&&['ar','en'].includes(ref.language)?ref.language:'UNKNOWN',
    departmentKey:owner||linked||null,departmentLabel:departments[owner||linked]||'تحتاج تحديد القسم',departmentStatus:status,candidateDepartments:candidates,
    teachersRaw:raw,teachersSeparated:separated,groups:unique(live.map(s=>s.course_code).filter(Boolean)),scheduleIds:live.map(s=>String(s.id)),schedule:live,
    assignments:o.assignments.filter(a=>a.active&&a.term_id===termId&&a.offering_id===o.id),rank,defaultSelected:match&&roster.get(o.id).enabled!==false,
    notes,source:'اسم الإنجليزية: جدول الفصل؛ الاسم العربي والكود الرسمي: للاستكمال من مرجع معتمد',flag:pick(roster.get(o.id),['enabled','updated_at'])};
   byId.set(o.id,row);
  }
  const rows=[...byId.values()].sort((a,b)=>a.rank-b.rank||a.name.localeCompare(b.name,'ar')||a.id.localeCompare(b.id));
  return {version:VERSION,term,department,departmentLabel:departments[department],technical:!!context.technical,rows,accounts:data.accounts,
   seniors:data.seniors.filter(a=>a.active&&a.term_id===termId&&a.department_key===department&&a.responsibility==='senior_coordinator'),warnings,
   sourceSnapshot:sourceRows,listingSnapshot:data,flagsSnapshot:(flags.items||[]).map(f=>pick(f,['id','enabled','updated_at'])).sort((a,b)=>a.id.localeCompare(b.id))};
 }
 async function stamp(model){model.sourceHash=await hash(model.sourceSnapshot);model.snapshotHash=await hash({version:VERSION,term:model.term,department:model.department,sourceHash:model.sourceHash,listing:model.listingSnapshot,flags:model.flagsSnapshot});return model;}
 async function load({rpc,client,termId,department}){
  const context=await rpc('citl_course_setup135',{p_action:'context',p_payload:{term_id:termId,department}});assertScope(context,termId,department);
  async function readSchedule(){const all=[];for(let offset=0;offset<50000;offset+=500){const {data,error}=await client.from('academic_schedule').select('*').eq('term_id',termId).order('id',{ascending:true}).range(offset,offset+499);if(error)throw error;if(!Array.isArray(data))throw Error('تعذر قراءة جدول الفصل.');all.push(...data);if(data.length<500)return all;}throw Error('تجاوز الجدول حد القراءة الآمن؛ لم نصدر ملفًا ناقصًا.');}
  const [listing,flags,names,schedule]=await Promise.all([
   rpc('citl_course_setup135',{p_action:'list',p_payload:{term_id:termId,department,include_inactive:false}}),
   rpc('citl_course_roster139',{p_action:'list',p_payload:{term_id:termId,department}}),
   rpc('citl_course_preparation_api',{p_action:'accounts',p_payload:{term_id:termId,department}}),readSchedule()]);
  const model=build({context,termId,department,listing,flags,registeredAccounts:names.accounts||[],schedule});
  try{const official=await rpc('citl_course_excel145',{p_action:'metadata',p_payload:{term_id:termId,department}});for(const value of official.items||[]){const row=model.rows.find(r=>r.id===value.offering_id);if(row){row.official=value;row.officialArabic=value.official_ar;row.officialEnglish=value.official_en;row.officialCode=value.official_code;row.displayName=value.official_en||value.official_ar||row.name;row.source='بيانات رسمية محفوظة للطرح الحالي؛ اسم الجدول الخام محفوظ في عموده المستقل';}}
   for(const value of official.suggestions||[]){const row=model.rows.find(r=>r.id===value.offering_id);if(row&&!row.official){row.officialSuggestion=value;row.officialArabic=value.official_ar;row.officialEnglish=value.official_en;row.officialCode=value.official_code;row.displayName=value.official_en||value.official_ar||row.name;row.source='مقترح من بيانات رسمية سابقة لنفس هوية المرجع والقسم واللائحة واللغة؛ اعتماده للطرح الحالي يتطلب معاينة الاستيراد';row.notes.push('مصدر المقترح: '+value.sources.map(s=>'فصل '+s.term_id+' — طرح '+s.offering_id).join('، '));}}
   for(const value of official.review||[]){const row=model.rows.find(r=>r.id===value.offering_id);if(row&&!row.official&&!row.officialSuggestion)row.notes.push(value.reason==='CONFLICTING_OFFICIAL_HISTORY'?'تعارض بيانات رسمية سابقة؛ لم يُختَر كود تلقائيًا.':'لا توجد هوية أكاديمية سابقة مثبتة لهذا الطرح؛ استكمل الكود من المرجع، ولا تستخدم رمز المجموعة.');}
   model.listingSnapshot.official=official.items||[];model.listingSnapshot.officialSuggestions=official.suggestions||[];}catch(e){if(!/PGRST202|42883|Could not find|does not exist/.test(e.code+' '+e.message))throw e;}
  return stamp(model);
 }
 const api=Object.freeze({VERSION,departments,roles,nameKey,titleKey,sourceKey,canonical,hash,safe,build,stamp,load,assertScope});
 if(typeof module==='object'&&module.exports)module.exports=api;else root.CITLCourseExcelModel=api;
})(typeof window==='object'?window:globalThis);
