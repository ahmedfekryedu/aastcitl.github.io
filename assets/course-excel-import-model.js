/* CITL exported XLSX contract v1. No writes or identity inference in this parser. */
(function(root){'use strict';
const M=typeof module==='object'&&module.exports?require('./course-excel-model.js'):root.CITLCourseExcelModel;
const fail=m=>{throw Error(m);},text=c=>String(c?.value??'').trim(),equal=(a,b)=>M.canonical(a)===M.canonical(b);
async function parse(bytes,{ExcelJS=root.ExcelJS,termId,department}={}){
 if(bytes.byteLength>8*1024*1024)fail('حجم الملف أكبر من 8 MB.');
 // Inspect ZIP central directory before decompression, including inflated size limits.
 const v=new DataView(bytes.buffer||bytes,bytes.byteOffset||0,bytes.byteLength),end=v.byteLength;let e=-1;
 for(let i=end-22;i>=Math.max(0,end-65557);i--)if(v.getUint32(i,true)===0x06054b50){e=i;break;}
 if(e<0)fail('الملف ليس XLSX صالحًا.');const count=v.getUint16(e+10,true);let off=v.getUint32(e+16,true),total=0;
 if(count>500||count===65535)fail('ملف Excel أكبر من حدود الفحص.');
 for(let i=0;i<count;i++){if(off+46>end||v.getUint32(off,true)!==0x02014b50)fail('أرشيف Excel تالف.');total+=v.getUint32(off+24,true);if(total>40*1024*1024)fail('حجم محتويات Excel أكبر من الحد الآمن.');const len=v.getUint16(off+28,true),name=new TextDecoder().decode(new Uint8Array(v.buffer,v.byteOffset+off+46,len));if(/vbaProject|externalLinks|connections\.xml/i.test(name))fail('ملف يحتوي ماكرو أو ارتباطات خارجية غير مسموحة.');off+=46+len+v.getUint16(off+30,true)+v.getUint16(off+32,true);}
 const wb=new ExcelJS.Workbook();await wb.xlsx.load(bytes);let cells=0;
 for(const ws of wb.worksheets){if(ws.rowCount>12000||ws.columnCount>30)fail('عدد الصفوف أو الأعمدة تجاوز الحد الآمن.');ws.eachRow(row=>row.eachCell(c=>{if(++cells>200000)fail('عدد الخلايا أكبر من الحد الآمن.');if(c.value&&typeof c.value==='object')fail('الصيغ والروابط والخلايا المركبة غير مسموحة: '+ws.name+' '+c.address);}));}
 const tech=wb.getWorksheet('_ربط');if(!tech)fail('اختر ملفًا صادرًا من CITL يحتوي بيانات الربط.');const chunks=new Map();
 tech.eachRow((r,n)=>{if(n===1)return;const k=text(r.getCell(1)),part=Number(r.getCell(3).value);if(!Number.isInteger(part)||part<0||part>1000)fail('بيانات الربط تالفة.');if(!chunks.has(k))chunks.set(k,new Map());if(chunks.get(k).has(part))fail('جزء ربط مكرر.');chunks.get(k).set(part,String(r.getCell(4).value??''));});
 const meta={};for(const [k,parts] of chunks){let s='';for(let n=0;n<parts.size;n++){if(!parts.has(n))fail('جزء ربط مفقود.');s+=parts.get(n);}meta[k]=JSON.parse(s);}
 if(meta.version!==M.VERSION||meta.term?.id!==termId||meta.department!==department)fail('الملف لا يطابق الفصل والقسم المختارين أو إصدار التصدير.');
 if(!Array.isArray(meta.offerings)||!meta.offerings.length||meta.offerings.length>1000)fail('قائمة طروحات غير صالحة.');
 const originals=new Map(meta.offerings.map(o=>[o.id,o]));if(originals.size!==meta.offerings.length)fail('هوية طرح مكررة.');
 const accounts=new Map((meta.accounts||[]).map(a=>[a.choice_label,a.id]));if(accounts.size!==(meta.accounts||[]).length)fail('قائمة الحسابات ملتبسة.');
 const account=s=>{if(!s)return null;const id=accounts.get(s);if(!id)fail('حساب غير معروف في قائمة الملف: '+s);return id;};
 const role=Object.fromEntries(Object.entries(M.roles).map(([k,v])=>[v,k]));const changes=[],rows=new Map(),conflicts=[];
 const addConflict=(id,message)=>conflicts.push({id,message});
 for(const [sheet,reg]of [['اللائحة القديمة','OLD'],['اللائحة الجديدة','NEW'],['مواد تحتاج تصنيف','UNKNOWN']]){
  const ws=wb.getWorksheet(sheet);if(!ws){if(reg!=='UNKNOWN')fail('الشيت الأساسي مفقود: '+sheet);continue;}
  for(let n=6;n<=ws.rowCount;n++){const r=ws.getRow(n),id=text(r.getCell(17));if(!id){if(r.values.slice(2).some(x=>x))addConflict('',sheet+' صف '+n+': معرّف طرح مفقود');continue;}
   const old=originals.get(id);if(!old||rows.has(id)){addConflict(id,'معرف طرح غير معروف أو مكرر');continue;}
   const ref=old.source.reference||{},official=old.official||{},name=String(r.getCell(2).value??'');
   if(name!==old.source.course_name)addConflict(id,'تغير اسم المادة من الجدول؛ لا يجوز ربطه بمادة أخرى.');
   if(String(r.getCell(10).value??'')!==[...new Set(old.schedule.map(s=>s.instructor).filter(Boolean))].join('\n'))addConflict(id,'تغير نص المحاضرين؛ المحاضرون مصدرهم الجدول فقط.');
   if(String(r.getCell(11).value??'')!==[...new Set(old.schedule.map(s=>s.course_code).filter(Boolean))].join('\n'))addConflict(id,'تغيرت رموز المجموعات.');
   const dlabel=text(r.getCell(8)),owner=Object.keys(M.departments).find(k=>M.departments[k]===dlabel)||null;
   const regulation=({'قديمة':'OLD','جديدة':'NEW','غير محددة':'UNKNOWN'})[text(r.getCell(6))],language=({'عربي':'ar','إنجليزي':'en','غير محددة':'UNKNOWN'})[text(r.getCell(7))];
   if(!owner&&dlabel!=='تحتاج تحديد القسم')addConflict(id,'القسم غير معروف؛ اختر قسم الملف من القائمة.');
   if(owner&&owner!==department)addConflict(id,'قسم المادة لا يطابق ملف القسم؛ النقل إلى قسم آخر ليس جزءًا من الاستيراد.');
   if(!regulation||!language)addConflict(id,'اختيار اللائحة أو اللغة غير صالح.');
   if(reg!=='UNKNOWN'&&regulation!==reg)addConflict(id,'اللائحة المختارة تتعارض مع الشيت؛ راجع التصنيف.');
   const baseReg=ref.review_status==='verified'?ref.regulation:'UNKNOWN',baseLang=ref.review_status==='verified'?ref.language:'UNKNOWN';
   const row={id,name,official_ar:text(r.getCell(3)),official_en:text(r.getCell(4)),official_code:text(r.getCell(5)),regulation,language,owner_department:owner,assignments:[]};
   const beforeOfficial={official_ar:official.official_ar||'',official_en:official.official_en||old.source.course_name,official_code:official.official_code||''};
   row.official_changed=Object.keys(beforeOfficial).some(k=>row[k]!==beforeOfficial[k]);
   row.first_placement=!old.source.department_key&&ref.review_status!=='verified'&&owner===department;
   row.reference_changed=regulation!==baseReg||language!==baseLang||owner!==(ref.review_status==='verified'?ref.owner_department:old.source.department_key||null);
   if(row.reference_changed&&(!owner||regulation==='UNKNOWN'||language==='UNKNOWN'))addConflict(id,'لاستكمال المرجع اختر القسم واللائحة واللغة معًا.');
   const primary=text(r.getCell(12)),existing=(old.source.assignments||[]).filter(a=>a.active&&a.is_primary&&a.responsibility==='coordinator');
   row.primary=primary?account(primary):null;row.primary_changed=!equal(existing.map(a=>a.profile_id).sort(),row.primary?[row.primary]:[]);
   // Summary columns are read-only views; edits must not be silently discarded.
   for(const [col,predicate]of [[13,a=>a.responsibility==='coordinator'&&!a.is_primary],[14,a=>a.responsibility==='assistant_coordinator'],[15,a=>a.responsibility==='group_lead']]){
    const expected=(old.source.assignments||[]).filter(a=>a.active&&predicate(a)).map(a=>meta.accounts.find(p=>p.id===a.profile_id)?.choice_label||(a.name||'حساب غير متاح للاختيار')+' — غير متاح للتكليف ['+a.profile_id+']').join('\n');
    if(text(r.getCell(col))!==expected)addConflict(id,'عدّل التكليفات المتعددة في شيت «تكليفات المقررات»؛ عمود الملخص تغير.');
   }
   rows.set(id,row);
  }
 }
 if(rows.size!==originals.size)addConflict('','بعض طروحات الملف مفقودة؛ لا يُفسر الحذف كإنهاء تكليف.');
 const aw=wb.getWorksheet('تكليفات المقررات'),sw=wb.getWorksheet('تكليفات القسم');if(!aw||!sw)fail('شيت التكليفات مفقود.');
 const seen=new Set(),sourceAssignments=new Map(meta.offerings.flatMap(o=>(o.source.assignments||[]).map(a=>[a.id,a])));
 for(let n=6;n<=aw.rowCount;n++){const r=aw.getRow(n),oid=text(r.getCell(6)),aid=text(r.getCell(7)),who=text(r.getCell(3)),rt=text(r.getCell(2)),primary=text(r.getCell(4));if(!who&&!rt&&!aid)continue;
  const row=rows.get(oid);if(!row){addConflict(oid,'تكليف لمقرر غير موجود في الملف');continue;}
  if(!who){if(aid)continue;addConflict(oid,'أكمل حساب التكليف');continue;}
  const a={profile_id:account(who),responsibility:role[rt],primary:primary==='نعم',existing_id:aid||null};
  if(!['coordinator','assistant_coordinator','group_lead'].includes(a.responsibility)||!['','نعم','لا'].includes(primary)||a.primary&&a.responsibility!=='coordinator'){addConflict(oid,'دور التكليف أو صفة الأساسي غير صالحة');continue;}
  const key=oid+'|'+a.profile_id+'|'+a.responsibility;if(seen.has(key)){addConflict(oid,'تكليف مكرر في الملف');continue;}seen.add(key);
  const prior=aid&&sourceAssignments.get(aid);if(aid&&(!prior||prior.offering_id!==oid)){addConflict(oid,'معرّف تكليف غير معروف');continue;}
  a.changed=!prior||prior.profile_id!==a.profile_id||prior.responsibility!==a.responsibility||!!prior.is_primary!==a.primary;
  row.assignments.push(a);
 }
 for(const row of rows.values()){
  const primaries=row.assignments.filter(a=>a.primary&&a.changed);
  if(primaries.length>1||row.primary_changed&&primaries.length&&primaries[0].profile_id!==row.primary)addConflict(row.id,'اختلاف المنسق الأساسي بين الشيت الرئيسي وشيت التكليفات.');
  if(row.primary_changed&&!row.primary)addConflict(row.id,'لا يُنهى التكليف الأساسي بمسح الخلية؛ استخدم إدارة التكليف.');
  const p=row.primary_changed?row.primary:primaries[0]?.profile_id;
  if(p&&!row.assignments.some(a=>a.profile_id===p&&a.responsibility==='coordinator'&&a.primary))row.assignments.push({profile_id:p,responsibility:'coordinator',primary:true,changed:true});
  if(row.primary_changed){const old=(originals.get(row.id).source.assignments||[]).filter(a=>a.active&&a.is_primary);if(old.some(a=>a.profile_id!==p))addConflict(row.id,'تغيير المنسق الأساسي الحالي يحتاج إجراء مستقل يحفظ مسار الاعتماد.');}
  row.assignments=row.assignments.filter(a=>a.changed).map(({changed,...a})=>a);
  if(row.official_changed||row.reference_changed||row.assignments.length)changes.push(row);
 }
 const seniors=[];for(let n=6;n<=sw.rowCount;n++){const r=sw.getRow(n),who=text(r.getCell(3)),aid=text(r.getCell(5));if(!who)continue;if(text(r.getCell(2))!=='كبير المنسقين')fail('تكليف القسم يجب أن يكون كبير المنسقين.');const id=account(who),old=(meta.seniors||[]).find(a=>a.id===aid);if(aid&&!old)fail('معرف كبير المنسقين غير معروف.');if(!old||old.profile_id!==id)seniors.push({profile_id:id,existing_id:aid||null});}
 if(new Set(seniors.map(s=>s.profile_id)).size!==seniors.length)addConflict('','تكليف كبير منسقين مكرر.');
 return {metadata:meta,rows:changes,seniors,conflicts,total:rows.size,requires_review_authorization:changes.some(r=>r.assignments.some(a=>a.primary)),file_sha256:await M.hash(Array.from(new Uint8Array(bytes.buffer||bytes,bytes.byteOffset||0,bytes.byteLength)))};
}
const api={parse};if(typeof module==='object'&&module.exports)module.exports=api;else root.CITLCourseExcelImportModel=api;
})(typeof window==='object'?window:globalThis);
