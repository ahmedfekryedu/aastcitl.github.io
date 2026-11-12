/* Locally bundled ExcelJS 4.4.0. Export only: no network, macros, formulas or database writes. */
(function(root){
 'use strict';
 async function createV1(model,selected,{ExcelJS=root.ExcelJS,now=new Date()}={}){
  const M=typeof module==='object'&&module.exports?require('./course-excel-model.js'):root.CITLCourseExcelModel;
  if(!ExcelJS)throw Error('تعذر تحميل مكتبة Excel المحلية؛ أعد المحاولة.');
  const chosen=new Set(selected),rows=model.rows.filter(r=>chosen.has(r.id));
  if(!rows.length||rows.length!==chosen.size)throw Error('اختر مواد صالحة من المعاينة الحالية.');
  const workbook=new ExcelJS.Workbook();workbook.creator='CITL Smart System';workbook.created=now;workbook.modified=now;
  const navy='25316A',gold='F4A820',ink='243454',muted='64748B',line='DEE5F0',auto='F1F5FA',editable='FFF6DE';
  const text=v=>{const s=M.safe(v);if(s.length>32767)throw Error('نص أطول من حد خلية Excel؛ لم يُنتج ملف ناقص.');return s;};
  const date=now.toLocaleString('ar-EG',{timeZone:'Africa/Cairo'}),ref='CX1-'+model.snapshotHash.slice(0,12);
  const lists=workbook.addWorksheet('_قوائم',{state:'veryHidden'}),tech=workbook.addWorksheet('_ربط',{state:'veryHidden'});
  const labels=new Map(),labelOwners=new Map();
  for(const a of model.accounts){const short=a.id.replaceAll('-','').slice(-8);let label=a.name+' — '+(M.departments[a.department]||'قسم غير محدد')+' ['+short+']';if(labelOwners.has(label))label+=' ['+a.id+']';labels.set(a.id,label);labelOwners.set(label,a.id);}
  const accountLabel=a=>labels.get(a.profile_id)||(a.name||'حساب غير متاح للاختيار')+' — غير متاح للتكليف ['+a.profile_id+']';
  const courseOptions=[...new Set(model.rows.map(r=>r.name))].sort((a,b)=>a.localeCompare(b,'ar'));
  const assignmentOptions=rows.map((r,i)=>`${i+1}. ${r.displayName||r.name} | ${r.groups.join(' / ')} [${r.id}]`);
  const listValues=[courseOptions,['قديمة','جديدة'],['عربي','إنجليزي'],[...labels.values()],Object.values(M.roles).filter(r=>r!==M.roles.senior_coordinator),assignmentOptions,['كبير المنسقين'],[model.departmentLabel]];
  const named=['CITLCourses','CITLRegulation','CITLLanguage','CITLAccounts','CITLRoles','CITLOfferings','CITLSenior','CITLDepartment'];
  listValues.forEach((values,i)=>{values.forEach((v,j)=>{lists.getCell(j+1,i+1).value=text(v);});const col=lists.getColumn(i+1).letter;workbook.definedNames.add(`'_قوائم'!$${col}$1:$${col}$${Math.max(1,values.length)}`,named[i]);});
  function validation(cell,name,message){cell.dataValidation={type:'list',allowBlank:true,formulae:[name],showInputMessage:true,promptTitle:'استكمال الملف فقط',prompt:message||'الاختيار لا يغيّر التكليف أو الاعتماد داخل النظام.',showErrorMessage:true,errorStyle:'stop',errorTitle:'اختر من القائمة',error:'استخدم قيمة من القائمة المتاحة.'};}
  function base(name,headers,widths,description){
   const ws=workbook.addWorksheet(name,{views:[{rightToLeft:true,state:'frozen',ySplit:5,xSplit:2,showGridLines:false}],properties:{tabColor:{argb:navy}},pageSetup:{paperSize:9,orientation:'landscape',fitToPage:false,scale:85,horizontalDpi:300,verticalDpi:300,printTitlesRow:'1:5',printTitlesColumn:'A:B',margins:{left:.25,right:.25,top:.4,bottom:.4,header:.18,footer:.18}},headerFooter:{oddFooter:'&RCITL — '+ref+'&Cصفحة &P من &N&L'+now.toISOString().slice(0,10)}});
   ws.columns=widths.map(width=>({width}));const end=ws.getColumn(headers.length).letter;
   for(let r=1;r<=4;r++)ws.mergeCells(`A${r}:${end}${r}`);
   ws.getCell('A1').value='CITL | '+name+' — قائمة مقررات ومنسقي القسم';ws.getRow(1).height=34;
   ws.getCell('A2').value=text(model.departmentLabel+' | '+model.term.name);ws.getRow(2).height=28;
   ws.getCell('A3').value=text(description);ws.getRow(3).height=32;
   ws.getCell('A4').value='الأصفر: قابل للاستكمال في الملف فقط • الرمادي: بيانات المصدر | '+date+' | '+ref;ws.getRow(4).height=26;
   for(let r=1;r<=4;r++){const cell=ws.getCell(r,1);cell.font={name:'Arial',size:r===1?16:11,bold:r<3,color:{argb:r===1?'FFFFFF':ink}};cell.fill={type:'pattern',pattern:'solid',fgColor:{argb:r===1?navy:r===2?'FFF0D4':'F5F7FB'}};cell.alignment={horizontal:'right',vertical:'middle',wrapText:true,readingOrder:'rtl'};}
   headers.forEach((h,i)=>{const c=ws.getCell(5,i+1);c.value=h;c.font={name:'Arial',size:11,bold:true,color:{argb:'FFFFFF'}};c.fill={type:'pattern',pattern:'solid',fgColor:{argb:navy}};c.alignment={wrapText:true,horizontal:'right',vertical:'middle',readingOrder:'rtl'};});ws.getRow(5).height=38;
   return ws;
  }
  function dataRow(ws,values,inputs=[]){const row=ws.addRow(values.map(v=>typeof v==='number'?v:text(v)));row.height=66;row.eachCell({includeEmpty:true},(cell,col)=>{cell.font={name:'Arial',size:11,color:{argb:inputs.includes(col)?ink:muted}};cell.alignment={horizontal:'right',vertical:'middle',wrapText:true,readingOrder:/[\u0600-\u06ff]/.test(String(cell.value))?'rtl':'ltr'};cell.fill={type:'pattern',pattern:'solid',fgColor:{argb:inputs.includes(col)?editable:auto}};cell.border={bottom:{style:'hair',color:{argb:line}}};cell.protection={locked:!inputs.includes(col)};});return row;}
  function finish(ws,headers,count,hiddenCol){
   if(count){const data=[];for(let n=6;n<6+count;n++)data.push(ws.getRow(n).values.slice(1,headers.length+1));
    ws.addTable({name:'CITLTable'+ws.id,ref:'A5',headerRow:true,totalsRow:false,style:{theme:'TableStyleMedium2',showRowStripes:false},columns:headers.map(name=>({name,filterButton:true})),rows:data});
   }else{ws.getCell('A6').value='لا توجد مواد مصنفة في هذا الشيت وقت التصدير.';ws.getRow(6).height=30;}
   ws.pageSetup.printArea=`A1:${ws.getColumn(hiddenCol?hiddenCol-1:headers.length).letter}${Math.max(6,5+count)}`;
   if(hiddenCol)ws.getColumn(hiddenCol).hidden=true;
  }
  const headers=['م','اسم المادة الخام من الجدول — لا يعدل','الاسم الرسمي بالعربية','الاسم بالإنجليزية','كود المقرر الرسمي','اللائحة','اللغة','قسم المادة','حالة القسم','المحاضرون — نص الجدول','رموز المجموعات','المنسق الأساسي','منسقون آخرون','المنسق المساعد','رئيس المجموعة','المصدر والملاحظات','معرّف الصف — لا يعدّل'];
  let rowNumber=0;
  for(const [reg,name] of [['OLD','اللائحة القديمة'],['NEW','اللائحة الجديدة'],['UNKNOWN','مواد تحتاج تصنيف']]){
   const group=rows.filter(r=>r.regulation===reg);if(reg==='UNKNOWN'&&!group.length)continue;
   const ws=base(name,headers,[6,32,30,32,18,14,14,30,27,38,24,34,32,32,32,50,40],'البيانات من جدول الفصل المحدد؛ رموز المجموعات ليست أكوادًا أكاديمية. التعديلات هنا لا تُحفظ في CITL.');
   for(const r of group){const a=r.assignments,people=fn=>a.filter(fn).map(accountLabel).join('\n');
    const row=dataRow(ws,[++rowNumber,r.name,r.officialArabic,r.officialEnglish,r.officialCode,({OLD:'قديمة',NEW:'جديدة'})[r.regulation]||'غير محددة',({ar:'عربي',en:'إنجليزي'})[r.language]||'غير محددة',r.departmentLabel,r.departmentStatus,r.teachersRaw.join('\n'),r.groups.join('\n'),people(x=>x.responsibility==='coordinator'&&x.is_primary),people(x=>x.responsibility==='coordinator'&&!x.is_primary),people(x=>x.responsibility==='assistant_coordinator'),people(x=>x.responsibility==='group_lead'),[r.source,...r.notes,'التكليفات المتعددة: شيت تكليفات المقررات'].join('\n'),r.id],[3,4,5,6,7,8,12]);
    row.height=Math.max(80,Math.min(260,24*(Math.max(r.teachersRaw.length,a.length,5))));
    validation(row.getCell(8),'CITLDepartment','اختر قسم الملف للمادة غير المسكنة. اعتماد قسم آخر أو تغيير ملكية معتمدة غير مسموح.');validation(row.getCell(6),'CITLRegulation');validation(row.getCell(7),'CITLLanguage');validation(row.getCell(12),'CITLAccounts');
    // Multiple assignments are edited in their own visible sheet, one account/role per row.
   }
   finish(ws,headers,group.length,17);
  }
  const ph=['م','المادة','الكود الرسمي','المجموعات','المحاضرون','المنسقون','المساعد ورئيس المجموعة','اللائحة واللغة','معرّف الطرح'];
  const pw=base('ملخص للطباعة',ph,[5,29,12,15,26,26,24,17,40],'ملخص وقت التصدير. للاستكمال استخدم شيتات اللوائح والتكليفات؛ الملخص لا يتغير تلقائيًا عند تعديلها في Excel.');
  rows.forEach((r,i)=>{const names=fn=>r.assignments.filter(fn).map(a=>(model.accounts.find(p=>p.id===a.profile_id)?.name||a.name||'حساب غير متاح')+(a.is_primary?' (أساسي)':'')).join('\n');const row=dataRow(pw,[i+1,r.displayName||r.name,r.officialCode||'غير متاح',r.groups.join('\n'),r.teachersRaw.join('\n'),names(a=>a.responsibility==='coordinator')||'لم يعيّن',names(a=>a.responsibility==='assistant_coordinator'||a.responsibility==='group_lead')||'لم يعيّن',(({OLD:'قديمة',NEW:'جديدة'})[r.regulation]||'تحتاج تصنيف')+'\n'+(({ar:'عربي',en:'إنجليزي'})[r.language]||'غير محددة'),r.id]);row.height=84;row.eachCell(c=>{c.font={...c.font,size:12};});});
  finish(pw,ph,rows.length,9);pw.pageSetup.fitToPage=true;pw.pageSetup.fitToWidth=1;pw.pageSetup.fitToHeight=0;
  const ah=['المادة — معرّف اختيار ثابت','التكليف','الحساب الأكاديمي','منسق أساسي؟','الحالة وقت التصدير','معرّف الطرح الأصلي','معرّف التكليف الأصلي'];
  const aw=base('تكليفات المقررات',ah,[55,25,60,18,29,40,40],'صف مستقل لكل حساب ودور. صفوف فارغة لكل مادة لإضافة تكليفات مقترحة؛ لا تُرسل أو تعتمد تلقائيًا.');
  let an=0;
  rows.forEach((r,i)=>{
   const assignments=r.assignments.filter(a=>['coordinator','assistant_coordinator','group_lead'].includes(a.responsibility));
   for(const a of [...assignments,null,null,null]){const row=dataRow(aw,[assignmentOptions[i],a?M.roles[a.responsibility]:'',a?accountLabel(a):'',a?.is_primary?'نعم':a?'لا':'',a?'تكليف حالي — لقطة وقت التصدير':'مساحة استكمال داخل Excel',r.id,a?.id||''],[2,3,4]);validation(row.getCell(2),'CITLRoles');validation(row.getCell(3),'CITLAccounts');row.getCell(4).dataValidation={type:'list',allowBlank:true,formulae:['"نعم,لا"'],showErrorMessage:true,errorStyle:'stop',error:'اختر نعم أو لا.'};an++;}
  });finish(aw,ah,an,6);aw.getColumn(7).hidden=true;aw.pageSetup.fitToWidth=1;
  const sh=['القسم والفصل','التكليف','الحساب الأكاديمي','الحالة وقت التصدير','معرّف التكليف الأصلي'];
  const sw=base('تكليفات القسم',sh,[50,26,64,40,40],'كبير المنسقين تكليف للقسم والفصل، وليس لكل مادة. يمكن أن توجد عدة تكليفات؛ لا نختار واحدًا بدلًا من الآخر.');
  for(const a of [...model.seniors,null,null,null]){const row=dataRow(sw,[model.departmentLabel+' — '+model.term.name,'كبير المنسقين',a?accountLabel(a):'',a?(a.can_review?'تكليف حالي؛ المراجعة مفعلة':'تكليف حالي؛ المراجعة موقوفة'):'مقترح للاستكمال فقط',a?.id||''],[3]);validation(row.getCell(2),'CITLSenior');validation(row.getCell(3),'CITLAccounts');}
  finish(sw,sh,model.seniors.length+3,5);sw.pageSetup.fitToWidth=1;
  // One chunk per metadata record; never put credentials, profile permissions or report answers here.
  const metadata={version:model.version,export_id:ref,exported_at:now.toISOString(),term:model.term,department:model.department,source_sha256:model.sourceHash,snapshot_sha256:model.snapshotHash,
   note:'Untrusted client snapshot, not a signature. Future import must validate current server term/source, offering/account IDs, permissions and revisions. Never match by row number or name.',
   accounts:model.accounts.map(a=>({...a,choice_label:labels.get(a.id)})),seniors:model.seniors,
   offerings:rows.map(r=>({id:r.id,source:r.original,official:r.official||null,official_suggestion:r.officialSuggestion||null,schedule:r.schedule,teachers_separated:r.teachersSeparated,flag:r.flag}))};
  tech.addRow(['type','id','part','json']);
  for(const [type,value] of Object.entries(metadata)){const json=JSON.stringify(value);for(let offset=0;offset<json.length;offset+=20000)tech.addRow([type,ref,offset/20000,json.slice(offset,offset+20000)]);}
  await tech.protect(root.crypto.randomUUID(),{spinCount:1000});await lists.protect(root.crypto.randomUUID(),{spinCount:1000});
  // Main sheets first; technical sheets remain veryHidden. Protection is accidental-edit prevention only.
  workbook.worksheets.filter(s=>s!==tech&&s!==lists).forEach((s,i)=>{s.orderNo=i;});lists.orderNo=100;tech.orderNo=101;
  const bytes=await workbook.xlsx.writeBuffer();
  return {bytes,filename:`CITL-${model.department}-${model.term.starts_on||model.term.id}-${ref}.xlsx`,rowCount:rows.length,metadata};
 }
 async function create(model,selected,options={}){const legacy=await createV1(model,selected,options);const X=options.ExcelJS||root.ExcelJS,V=typeof module==='object'&&module.exports?require('./course-excel-v2.js'):root.CITLCourseExcelV2;if(!V)throw Error('أعد تحميل الصفحة لتحميل نموذج التسكين المبسط');const w=new X.Workbook();await w.xlsx.load(legacy.bytes);const result=await V.simplify(w,{ExcelJS:X});return {...legacy,bytes:await result.workbook.xlsx.writeBuffer(),metadata:result.metadata,rowCount:result.rowCount,offeringCount:result.offeringCount,filename:legacy.filename.replace('CX1-','CX2-')};}
 const api=Object.freeze({create,createV1});if(typeof module==='object'&&module.exports)module.exports=api;else root.CITLCourseExcelWorkbook=api;
})(typeof window==='object'?window:globalThis);
