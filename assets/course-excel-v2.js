/* V2 presentation contract. Expands explicit decisions to unchanged V1 server payloads. */
(function(root){'use strict';
const V2='CITL-COURSES144-EXCEL-2',V1='CITL-COURSES144-EXCEL-1';
const names=['اللائحة القديمة','اللائحة الجديدة','مواد تحتاج تصنيف'];
const ALL='كل المجموعات المعروضة',SEPARATE='مراجعة المجموعات منفصلة';
const headers=['م','اسم المقرر من جدول الفصل','المجموعات — ملخص','المحاضرون — للعلم فقط','اللائحة','اللغة','الكود الأكاديمي الرسمي','الاسم الرسمي بالعربية','المنسق الأساسي','المنسق المساعد','ملاحظات القسم — اختيارية','نطاق القرار'];
const fail=m=>{throw Error(m);},txt=v=>String(v??'').trim(),copy=v=>JSON.parse(JSON.stringify(v)),same=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
function readMeta(w){const ws=w.getWorksheet('_ربط');if(!ws)fail('بيانات الربط مفقودة');const chunks={};ws.eachRow((r,n)=>{if(n===1)return;const k=txt(r.getCell(1).value),p=Number(r.getCell(3).value);if(!Number.isInteger(p)||p<0||p>1000)fail('بيانات الربط تالفة');if(!chunks[k])chunks[k]={};if(chunks[k][p]!==undefined)fail('جزء ربط مكرر');chunks[k][p]=String(r.getCell(4).value??'');});const m={};for(const [k,ps]of Object.entries(chunks)){let s='';for(let i=0;i<Object.keys(ps).length;i++){if(ps[i]===undefined)fail('جزء ربط مفقود');s+=ps[i];}m[k]=JSON.parse(s);}return m;}
function writeMeta(w,m){let ws=w.getWorksheet('_ربط');if(ws)w.removeWorksheet(ws.id);ws=w.addWorksheet('_ربط',{state:'veryHidden'});ws.addRow(['type','id','part','json']);for(const [k,v]of Object.entries(m)){const s=JSON.stringify(v);for(let i=0;i<s.length;i+=20000)ws.addRow([k,m.export_id,i/20000,s.slice(i,i+20000)]);}return ws;}
function snapshot(w){return w.worksheets.filter(s=>s.name!=='_ربط').map(s=>({name:s.name,state:s.state,rows:Array.from({length:s.rowCount},(_,i)=>Array.from({length:s.columnCount},(_,j)=>s.getCell(i+1,j+1).value??null))}));}
function restore(meta,X){const w=new X.Workbook();for(const s of meta.v1_sheets){const ws=w.addWorksheet(s.name);for(const r of s.rows){if(!Array.isArray(r)||r.some(v=>v!==null&&!['string','number','boolean'].includes(typeof v)))fail('قيمة ربط غير صالحة');ws.addRow(r);}}const m={...meta,version:V1};delete m.v1_sheets;delete m.v2_groups;writeMeta(w,m);return w;}
function records(w,meta){const out=[];for(const name of names){const ws=w.getWorksheet(name);if(!ws)continue;for(let n=6;n<=ws.rowCount;n++){const r=ws.getRow(n),id=txt(r.getCell(17).value);if(!id)continue;const o=meta.offerings.find(o=>o.id===id);if(!o)fail('هوية طرح غير معروفة');out.push({id,o,row:r,values:Array.from({length:17},(_,i)=>r.getCell(i+1).value??''),sheet:name,n});}}return out;}
function groups(w,meta){const m=new Map();for(const r of records(w,meta)){const v=r.values;const roles=(r.o.source.assignments||[]).filter(a=>a.active).map(a=>[a.profile_id,a.responsibility,!!a.is_primary,!!a.can_review]).sort((a,b)=>JSON.stringify(a).localeCompare(JSON.stringify(b)));
 const key=JSON.stringify([v[1],v[2],v[3],v[4],v[5],v[6],v[7],r.o.source.reference?.review_status,roles]);if(!m.has(key))m.set(key,[]);m.get(key).push(r);}
 return [...m.values()].map((rs,i)=>({key:'G'+(i+1),records:rs,ids:rs.map(r=>r.id)}));}
function summary(a,n=3){a=[...new Set(a.filter(Boolean).map(x=>txt(x).replace(/\s+/g,' ')))];const joined=a.slice(0,n).join(' / '),short=joined.length>36?joined.slice(0,33)+'…':joined;return short+(a.length>n?' (الإجمالي '+a.length+')':'');}
function readableSummary(a,n=2){a=[...new Set(a.filter(Boolean).map(x=>txt(x).replace(/\s+/g,' ')))];return a.slice(0,n).join('\n')+(a.length>n?'\n+ '+(a.length-n)+' — البقية في التفاصيل':'');}
function values(g,owner,modern=false){const v=g.records[0].values,rs=g.records;return [g.key.slice(1),v[1],(modern?readableSummary(rs.flatMap(r=>txt(r.values[10]).split('\n')),1):summary(rs.flatMap(r=>txt(r.values[10]).split('\n'))))+' — '+rs.length+' طرح'+(modern&&rs.some(r=>!txt(r.values[10])||txt(r.values[10]).split('\n').some(t=>!/^\d+\/[A-Z0-9]/i.test(t.trim())))?'\nرموز المصدر تحتاج مراجعة':'')+(modern&&rs.length>1?'\nاختر: كل المجموعات / مراجعة منفصلة':''),(modern?readableSummary:summary)(rs.flatMap(r=>txt(r.values[9]).split('\n')),2),v[5]==='غير محددة'?'':v[5],v[6]==='غير محددة'?'':v[6],v[4],v[2],v[11],v[13],'',rs.length>1?'':ALL,...(owner?[v[7]]:[])];}
function styleSheet(w,name,head,meta){
 const ws=w.addWorksheet(name,{views:[{rightToLeft:true,state:'frozen',ySplit:5,xSplit:2,showGridLines:false}],pageSetup:{orientation:'landscape',fitToPage:true,fitToWidth:1,fitToHeight:0,printTitlesRow:'1:5'}});
 const extra=name==='تكليفات إضافية',widths=extra?[48,22,40,40]:[6,40,34,38,13,13,21,27,30,30,28,29,30];
 ws.columns=head.map((h,i)=>({width:widths[i]||28}));
 for(let n=1;n<5;n++){ws.mergeCells(n,1,n,head.length);ws.getCell(n,1).value=[name,meta.departmentLabel+' — '+meta.term.name,'استكمل الخانات الملوّنة. الاسم العربي اختياري. للمادة متعددة المجموعات اختر نطاق تطبيق القرار قبل الحفظ.','البرتقالي: اختر نطاق القرار في العمود L. عند اختيار مراجعة منفصلة، استكمل الطروحات المقصودة في شيت تفاصيل المجموعات.'][n-1];ws.getRow(n).height=[0,38,30,30,30][n];}
 ws.getRow(5).values=head;ws.getRow(5).height=38;
 for(let n=1;n<=5;n++)ws.getRow(n).eachCell(c=>{
  c.font={name:'Arial',size:n===1?17:n===2?13:11,bold:n===1||n===2||n===5,color:{argb:n===1||n===5?'FFFFFFFF':'FF25316A'}};
  c.fill={type:'pattern',pattern:'solid',fgColor:{argb:n===1||n===5?'FF25316A':n===2?'FFE7AA3A':n===3?'FFFFFFFF':'FFF1F5FA'}};
  c.alignment={horizontal:n===1||n===5?'center':'right',vertical:'middle',wrapText:true};
  c.border=n===5?{left:{style:'thin',color:{argb:'FF7280A2'}},right:{style:'thin',color:{argb:'FF7280A2'}},bottom:{style:'medium',color:{argb:'FFE7AA3A'}}}:{bottom:{style:'thin',color:{argb:n===2?'FFD29A31':'FFD4DDE9'}}};
 });return ws;
}
function paint(ws,n,editable,multipleOfferings=false){
 const r=ws.getRow(n),extra=ws.name==='تكليفات إضافية',stripe=n%2===0?'FFFFFFFF':'FFF0F4F9';r.height=extra?42:ws.name==='تفاصيل المجموعات'?70:80;
 if(extra)for(let i=1;i<=4;i++)r.getCell(i);
 r.eachCell({includeEmpty:true},(c,i)=>{
  c.style={...c.style};
  const input=editable.includes(i),source=!extra&&i>=2&&i<=4,scope=!extra&&i===12&&multipleOfferings;
  c.font={name:'Arial',size:11,bold:extra?i===1:i===2,color:{argb:scope?'FF874600':'FF25316A'}};
  c.fill={type:'pattern',pattern:'solid',fgColor:{argb:scope?'FFFCE0B2':input?'FFFFF2CC':source?(n%2===0?'FFF4F7FB':'FFE8EFF7'):stripe}};
  c.alignment={horizontal:!extra&&[1,5,6].includes(i)?'center':'right',vertical:'middle',wrapText:true};
  c.border={left:{style:'thin',color:{argb:'FFD4DDE9'}},right:{style:'thin',color:{argb:'FFD4DDE9'}},bottom:{style:'thin',color:{argb:'FFBBC8D9'}}};
  c.protection={locked:!input};
 });
 if(!extra)ws.addConditionalFormatting({ref:'E'+n,rules:[
  {type:'cellIs',operator:'equal',formulae:['"قديمة"'],style:{fill:{type:'pattern',pattern:'solid',fgColor:{argb:'FFEDE8F5'},bgColor:{argb:'FFEDE8F5'}},font:{color:{argb:'FF51416F'},bold:true}}},
  {type:'cellIs',operator:'equal',formulae:['"جديدة"'],style:{fill:{type:'pattern',pattern:'solid',fgColor:{argb:'FFE4F1E9'},bgColor:{argb:'FFE4F1E9'}},font:{color:{argb:'FF245A3C'},bold:true}}}
 ]});
}
function usageGuide(w,meta){
 const s=w.addWorksheet('دليل الاستخدام والشرح',{views:[{rightToLeft:true,showGridLines:false}],pageSetup:{orientation:'landscape',fitToPage:true,fitToWidth:1,fitToHeight:0,margins:{left:.25,right:.25,top:.3,bottom:.3,header:.15,footer:.15}}});
 s.columns=[{width:8},{width:30},{width:28},{width:85}];
 s.headerFooter={oddFooter:'&Rدليل تسكين المقررات — CITL&C&P / &N'};
 function row(values,height=38,kind='body'){
  const r=s.addRow(values);r.height=height;r.eachCell({includeEmpty:true},(c,i)=>{c.font={name:'Arial',size:12,bold:kind!=='body'||i===2,color:{argb:kind==='title'||kind==='head'?'FFFFFFFF':'FF25316A'}};c.fill={type:'pattern',pattern:'solid',fgColor:{argb:kind==='title'||kind==='head'?'FF25316A':kind==='gold'?'FFE7AA3A':r.number%2?'FFF1F5FA':'FFFFFFFF'}};c.alignment={horizontal:i===1?'center':'right',vertical:'middle',wrapText:true};c.border={bottom:{style:'thin',color:{argb:'FFCCD6E5'}},left:{style:'thin',color:{argb:'FFCCD6E5'}}};});return r;
 }
 function band(text,kind='gold',height=30){const r=row([text,'','',''],height,kind);s.mergeCells(r.number,1,r.number,4);if(kind==='title')r.getCell(1).font={name:'Arial',size:17,bold:true,color:{argb:'FFFFFFFF'}};return r;}
 function page(title){if(s.rowCount){s.getRow(s.rowCount).addPageBreak();}band(title,'title',38);band(meta.departmentLabel+' — '+meta.term.name,'gold',28);}
 page('دليل الاستخدام والشرح — أعمدة تسكين المقررات');
 band('املأ الخانات الملوّنة فقط. أسماء المحاضرين من الجدول لا تمنحهم تكليف منسق تلقائيًا.','body',32);
 const legend=row(['اللون','أزرق فاتح: قراءة فقط','أصفر: إدخال أو اختيار','اختياري: الاسم العربي والمساعد والملاحظات؛ البرتقالي ينبه لنطاق القرار.'],38);legend.getCell(2).fill={type:'pattern',pattern:'solid',fgColor:{argb:'FFE8EFF7'}};legend.getCell(3).fill={type:'pattern',pattern:'solid',fgColor:{argb:'FFFFF2CC'}};legend.getCell(4).fill={type:'pattern',pattern:'solid',fgColor:{argb:'FFFCE0B2'}};
 row(['العمود','العنوان في النموذج','طريقة التعامل','وظيفته ببساطة'],28,'head');
 const explanations=[
 ['تلقائي — لا تعدله','رقم لترتيب صفوف المواد، وليس كودًا أكاديميًا.'],
 ['قراءة فقط','اسم المادة كما ورد في جدول الفصل. لا تستبدله بمادة أخرى.'],
 ['قراءة فقط','ملخص المجموعات المشمولة بالصف. افتح تفاصيل المجموعات لقراءة كل طرح.'],
 ['للعلم فقط','أسماء المحاضرين من جدول الفصل؛ المحاضر ليس منسقًا تلقائيًا.'],
 ['اختر من القائمة','اختر قديمة أو جديدة وفق التصنيف الأكاديمي الصحيح. عند تعديل المرجع استكمل القسم واللائحة واللغة معًا.'],
 ['اختر من القائمة','اختر لغة تدريس المقرر: عربي أو إنجليزي.'],
 ['كتابة يدوية','اكتب الكود الرسمي المعتمد إذا توفر؛ رمز المجموعة أو القاعة ليس كود المقرر الرسمي.'],
 ['اختياري — كتابة يدوية','يُكتب إن توفر، ويجوز تركه فارغًا دون منع الاستيراد.'],
 ['اختر حسابًا من القائمة','المنسق الأساسي مسؤول عن تنسيق المادة ضمن تكليفه وصلاحياته الفعلية؛ لا تكتب اسمًا بديلًا يدويًا.'],
 ['اختياري — من القائمة','حساب مساعد عند الحاجة. اختياره لا يمنحه جميع صلاحيات المنسق الأساسي تلقائيًا.'],
 ['اختياري — كتابة يدوية','توضيح للقسم يظهر أثناء المراجعة؛ لا يستبدل بيانات التسكين.'],
 ['اختر نطاقًا صريحًا','يحدد هل القرار لِكل الطروحات المشمولة بهذا الصف، أم لطروحات تراجعها منفصلة.']
 ];
 explanations.forEach(([how,why],i)=>row([String.fromCharCode(65+i),headers[i],how,why],i===4||i===8?46:38));
 band('إذا ظهر «القسم المالك»: إدراج مادة لقسم آخر لا ينقل ملكيتها. المستورد الحالي يرفضها في ملف قسم مختلف؛ راجعها مع المسؤول.','body',40);
 page('نطاق القرار والشيتات والتكليفات');
 row(['','الاختيار / المهمة','أين تستخدمه؟','شرح ومثال'],28,'head');
 row(['1',ALL,'صف المادة في تسكين المقررات','مثال: مادة تضم 8 مجموعات في الصف؛ اختيار هذا النطاق صراحة يطبّق بيانات الصف على طروحاته الثمانية فقط، ما لم يمنع النظام تعارضًا.'],56);
 row(['2',SEPARATE,'ثم شيت تفاصيل المجموعات','مثال: تريد تغيير مجموعة واحدة من الثماني؛ اختر المراجعة المنفصلة ثم عدّل سطرها في التفاصيل فقط، واترك بيانات صف المادة الرئيسي دون تعديل.'],56);
 band('كل المجموعات المعروضة لا تعني جميع مقررات القسم ولا أي طروحات خارج الملف. عند الشك في تطابق البيانات اختر المراجعة المنفصلة.','body',40);
 row(['','لماذا قد يكون النطاق فارغًا؟','لا اختيار جماعي تلقائي','متعدد الطروحات يبقى بلا قرار حتى تختار عند تعديل بياناته. للطرح الواحد يضع النموذج نطاقه مسبقًا غالبًا؛ إن مُسح فاختره قبل تعديل البيانات.'],48);
 row(['','تفاصيل المجموعات','لتعديل طرح بعينه','صفِّ القائمة باسم المادة، ثم راجع رموز المجموعة وأسماء محاضريها. كل سطر طرح مستقل؛ لا تحذف الصفوف ولا تغيّر أعمدة الجدول المقروءة.'],48);
 row(['','المنسق الأساسي','العمود I','حساب واحد أساسي لكل طرح. تغيير الأساسي الحالي أو إنهاء تكليفه قد يحتاج إجراءً مستقلًا في الموقع يحفظ مسار الاعتماد.'],44);
 row(['','المنسق المساعد','العمود J أو تكليفات إضافية','يساعد في التنسيق وفق تكليفه. لا يُفترض أنه الأساسي أو مخوّل بالاعتماد لمجرد إضافته.'],40);
 row(['','رئيس المجموعة','تكليفات إضافية','اختر المجموعة المقصودة ثم دور رئيس مجموعة والحساب المعتمد. لا يتغير رئيس القسم بهذا الاختيار.'],40);
 row(['','كبير المنسقين','تكليفات إضافية','تكليف على مستوى القسم: اختر كبير المنسقين واترك خانة المادة فارغة. يراجع المرحلة المخصصة له وفق الصلاحيات؛ ليس بديلًا لرئيس القسم.'],44);
 row(['','متى أستخدم تكليفات إضافية؟','حسابات وأدوار موجودة','لإضافة منسق مقرر أو مساعد أو رئيس مجموعة لطرح محدد، أو كبير منسقين للقسم. لا تكرر نفس التكليف، ولا تستخدم مسح الخلية لإنهائه.'],48);
 page('خطوات العمل وعلاقة التسكين بالاستيفاء');
 row(['الخطوة','الإجراء','','ما الذي تفعله؟'],28,'head');
 const steps=[['التنزيل والمراجعة','1–2','نزّل الملف بعد اختيار الفصل والقسم والمواد. راجع أسماء المواد والمحاضرين والمجموعات.'],['التعبئة والنطاق','3–4','استكمل الخانات الملوّنة فقط. حدد نطاق القرار صراحة للمواد متعددة الطروحات.'],['الحسابات والحفظ','5–6','اختر المنسقين من الحسابات المتاحة. احفظ بصيغة XLSX دون حذف الشيتات أو تغيير الأعمدة.'],['الرفع والاعتماد','7–8','ارفع الملف للموقع. راجع التغييرات والتعارضات قبل الاعتماد؛ رفع الملف لا يعني اعتماده تلقائيًا.']];
 for(const [title,n,text]of steps)row([n,title,'',text],44);
 band('Excel لتسكين المقررات وتكليف المنسقين، وليس لتعبئة معايير الاستيفاء. الاستيفاء يتم داخل الموقع.','gold',38);
 row(['','الأسئلة','من يستكملها؟','العلاقة بالمسؤوليات الفعلية'],28,'head');
 row(['','Q1–7','بيانات النظام','تُعرض تلقائيًا وفق بيانات النظام والجدول والتكليفات.']);
 row(['','Q8–36','عضو هيئة التدريس','يستكملها المحاضر أو المكلف بالاستيفاء وفق التكليف والصلاحيات القائمة.']);
 row(['','Q37–40','منسق المقرر','يكمل الجزء المخصص للتنسيق؛ التدريس وحده لا يمنح صلاحيات المنسق.']);
 row(['','Q41','رئيس القسم','يسجل ملاحظاته في المرحلة المخصصة له.']);
 row(['','Q42–43','التوقيعات والاعتمادات','توقيع منسق المقرر ثم رئيس القسم عبر إجراءات الاعتماد داخل الموقع، وليس داخل Excel.']);
 band('Q26: التنمية المستدامة تُستوفى داخل الموقع فقط. المرجع مساعد للقراءة؛ لا يكتب إجابتك ولا يثبت التطبيق تلقائيًا.','body',40);
 s.eachRow(r=>{r.height=Math.round(r.height*.9);});
 s.pageSetup.printArea='A1:D'+s.rowCount;
 return s;
}

async function simplify(w,{ExcelJS:X=root.ExcelJS}={}){
 const meta=readMeta(w);if(meta.version!==V1)fail('هذا التحويل لملف V1 فقط');
 // Registered account identity stays hidden; visible labels do not contain UUIDs or staff numbers.
 const replacements=new Map(),seen=new Map();for(const a of meta.accounts){const label=a.name+' — '+((typeof module==='object'&&module.exports?require('./course-excel-model.js'):root.CITLCourseExcelModel).departments[a.department]||'حساب معتمد');const n=(seen.get(label)||0)+1;seen.set(label,n);const readable=label+(n>1?' (اختيار '+n+')':'');replacements.set(a.choice_label,readable);a.choice_label=readable;}
 for(const ws of w.worksheets)if(ws.name!=='_ربط')ws.eachRow(r=>r.eachCell(c=>{if(typeof c.value==='string'){let v=c.value;for(const [a,b]of replacements)v=v.split(a).join(b);c.value=v;}}));
 meta.departmentLabel=(w.getWorksheet(names[0])?.getCell('A2').value||'').split(' | ')[0];const gs=groups(w,meta),owner=gs.some(g=>g.records.some(r=>r.values[7]==='تحتاج تحديد القسم'));
 meta.v1_sheets=snapshot(w);meta.v2_groups=gs.map(g=>({key:g.key,ids:g.ids}));meta.version=V2;meta.v2_display_version=2;
 const out=new X.Workbook();out.creator='CITL Smart System';out.views=[{activeTab:0}];const main=styleSheet(out,'تسكين المقررات',[...headers,...(owner?['القسم المالك']:[])],meta);const detail=styleSheet(out,'تفاصيل المجموعات',[...headers,...(owner?['القسم المالك']:[])],meta);const lists=out.addWorksheet('_قوائم',{state:'veryHidden'});
 detail.getCell('A3').value='كل سطر طرح مستقل. استكمل الخانات الملوّنة للطروحات المقصودة فقط؛ الاسم العربي اختياري.';detail.getCell('A4').value='أولًا: اختر مراجعة المجموعات منفصلة أمام المادة في شيت تسكين المقررات. استخدم فلتر اسم المقرر للوصول إلى طروحاته.';
 const listDefs={V2Reg:['قديمة','جديدة'],V2Lang:['عربي','إنجليزي'],V2Accounts:meta.accounts.map(a=>a.choice_label),V2Scope:[ALL,SEPARATE],V2Dept:[meta.departmentLabel],V2Roles:['منسق مقرر','منسق مساعد','رئيس مجموعة','كبير المنسقين'],V2Targets:[]};
 const idCol=owner?14:13;let ix=0;for(const g of gs){const n=main.addRow([...values(g,owner,true),g.key]).number;paint(main,n,[5,6,7,8,9,10,11,12,...(owner?[13]:[])],g.ids.length>1);if(g.ids.length>1){main.getCell(n,2).fill={type:'pattern',pattern:'solid',fgColor:{argb:'FFFFECD1'}};main.getCell(n,3).font={name:'Arial',size:11,color:{argb:'FF874600'}};}for(const rec of g.records){const item={key:g.key+'-'+(++ix),records:[rec]};const vals=values(item,owner,true);vals[0]=g.key+' / '+ix;vals[2]=txt(rec.values[10]);vals[3]=txt(rec.values[9]);vals[11]='';const dn=detail.addRow([...vals,rec.id]).number;paint(detail,dn,[5,6,7,8,9,10,11,...(owner?[13]:[])]);if(rec===g.records[0])detail.getRow(dn).eachCell(c=>{c.border={...c.border,top:{style:'medium',color:{argb:'FFE7AA3A'}}};});listDefs.V2Targets.push(g.key+' / '+ix+' — '+rec.values[1]+' — '+txt(rec.values[10]).replaceAll('\n',' / '));}}
 for(const ws of [main,detail]){ws.getColumn(idCol).hidden=true;ws.autoFilter={from:'A5',to:{row:Math.max(5,ws.rowCount),column:idCol-1}};if(ws.rowCount>=6)for(const [col,list] of [['E','V2Reg'],['F','V2Lang'],['I','V2Accounts'],['J','V2Accounts'],...(owner?[['M','V2Dept']]:[]),...(ws===main?[['L','V2Scope']]:[])]){const rule={type:'list',allowBlank:true,formulae:[list],showErrorMessage:true,errorStyle:'stop',error:'اختر قيمة من القائمة.'};if(list==='V2Scope')Object.assign(rule,{showInputMessage:true,promptTitle:'نطاق تطبيق القرار',prompt:'اختر: كل المجموعات / مراجعة منفصلة. للمراجعة المنفصلة استكمل الطروحات في شيت تفاصيل المجموعات.'});ws.dataValidations.add(col+'6:'+col+ws.rowCount,rule);}ws.pageSetup.printArea='A1:'+ws.getColumn(idCol-1).letter+ws.rowCount;}
 const extra=styleSheet(out,'تكليفات إضافية',['المجموعة / المادة','الدور','الحساب المعتمد','ملاحظات'],meta);extra.getCell('A3').value='اختر المجموعة والدور والحساب المعتمد من القوائم. لا تكتب أسماء حسابات بديلة يدويًا.';extra.getCell('A4').value='للإضافة فقط: اختر مجموعة محددة. لكبير المنسقين اترك المادة فارغة. لا يؤدي مسح الخانة إلى إنهاء تكليف.';extra.getColumn(1).width=48;extra.getColumn(3).width=40;
 for(const [col,list] of [['A','V2Targets'],['B','V2Roles'],['C','V2Accounts']])extra.dataValidations.add(col+'6:'+col+'1005',{type:'list',allowBlank:true,formulae:[list],showErrorMessage:true,errorStyle:'stop',error:'اختر من القائمة'});paint(extra,6,[1,2,3,4]);
 let col=0;for(const [key,vals]of Object.entries(listDefs)){col++;vals.forEach((v,i)=>lists.getCell(i+1,col).value=v);const letter=lists.getColumn(col).letter;out.definedNames.add("'_قوائم'!$"+letter+'$1:$'+letter+'$'+Math.max(1,vals.length),key);}
 meta.v2_owner=owner;meta.v2_targets=listDefs.V2Targets;writeMeta(out,meta);usageGuide(out,meta);return {workbook:out,metadata:meta,rowCount:gs.length,offeringCount:meta.offerings.length};
}
function expand(w,{ExcelJS:X=root.ExcelJS}={}){
 const meta=readMeta(w);if(meta.version!==V2)return null;if(!Array.isArray(meta.v1_sheets)||!Array.isArray(meta.offerings)||meta.offerings.length>1000)fail('ربط V2 غير صالح');
 const legacy=restore(meta,X),gs=groups(legacy,meta);let targetIndex=0;const expectedTargets=gs.flatMap(g=>g.records.map(rec=>g.key+' / '+(++targetIndex)+' — '+rec.values[1]+' — '+txt(rec.values[10]).replaceAll('\n',' / ')));if(!same(expectedTargets,meta.v2_targets))fail('تغير ربط خيارات التكليفات');if(!same(gs.map(g=>({key:g.key,ids:g.ids})),meta.v2_groups))fail('تم تغيير ربط مجموعات الملف');
 const main=w.getWorksheet('تسكين المقررات'),detail=w.getWorksheet('تفاصيل المجموعات'),extra=w.getWorksheet('تكليفات إضافية');if(!main||!detail||!extra)fail('شيت أساسي مفقود');
 const owner=!!meta.v2_owner,idCol=owner?14:13,conflicts=[],scopes=[],notes=[],seen=new Set(),details=new Map();const recordsById=new Map(records(legacy,meta).map(r=>[r.id,r]));
 for(let n=6;n<=detail.rowCount;n++){const row=detail.getRow(n),id=txt(row.getCell(idCol).value);if(!id){if(row.values.slice(1).some(Boolean))fail('صف مجموعة بدون ربط');continue;}if(details.has(id)||!recordsById.has(id))fail('هوية مجموعة مكررة أو مختلفة');details.set(id,row);}
 if(details.size!==recordsById.size)fail('بعض المجموعات مفقودة');
 const editable=[5,6,7,8,9,10,...(owner?[13]:[])];
 const changed=(row,base)=>editable.some(c=>txt(row.getCell(c).value)!==txt(base[c-1]));
 function apply(row,rec){const v=rec.values,r=rec.row;for(const [c,vc]of [[5,6],[6,7],[7,5],[8,3],[9,12]]){let val=txt(row.getCell(c).value);if(c===9&&!val)continue;r.getCell(vc).value=val||((c===5||c===6)?'غير محددة':'');}if(owner)r.getCell(8).value=txt(row.getCell(13).value)||v[7];
 const assistant=txt(row.getCell(10).value);if(assistant&&!txt(v[13]).split('\n').includes(assistant))legacy.getWorksheet('تكليفات المقررات').addRow(['','منسق مساعد',assistant,'لا','',rec.id,'']);}
 for(let n=6;n<=main.rowCount;n++){const row=main.getRow(n),key=txt(row.getCell(idCol).value);if(!key){if(row.values.slice(1).some(Boolean))fail('صف مادة بدون ربط');continue;}const g=gs.find(g=>g.key===key);if(!g||seen.has(key))fail('صف مادة مكرر أو غير معروف');seen.add(key);const b=values(g,owner,meta.v2_display_version===2);if(txt(row.getCell(11).value))notes.push({name:b[1],note:txt(row.getCell(11).value)});
 for(const c of [2,3,4])if(txt(row.getCell(c).value)!==txt(b[c-1]))fail('تم تعديل بيانات الجدول المقروءة فقط');
 let detailChanged=false;for(const rec of g.records){const dr=details.get(rec.id),db=values({key:g.key,records:[rec]},owner,meta.v2_display_version===2);if(txt(dr.getCell(11).value))notes.push({id:rec.id,name:b[1],note:txt(dr.getCell(11).value)});for(const [c,expected]of [[2,rec.values[1]],[3,rec.values[10]],[4,rec.values[9]]])if(txt(dr.getCell(c).value)!==txt(expected))fail('تغيرت بيانات مصدر المجموعة');if(changed(dr,db))detailChanged=true;}
 const scope=txt(row.getCell(12).value);if(scope&&!([ALL,SEPARATE].includes(scope)))fail('نطاق القرار غير صالح');
 if(scope===ALL){if(detailChanged)fail('يوجد تعديل بالتفاصيل مع اختيار كل المجموعات؛ اختر مراجعتها منفصلة');if(changed(row,b)){for(const rec of g.records)apply(row,rec);scopes.push({name:b[1],ids:g.ids,groups:g.records.map(r=>txt(r.values[10])),mode:ALL});}}
 else if(scope===SEPARATE){if(changed(row,b))fail('عند المراجعة المنفصلة عدّل شيت تفاصيل المجموعات فقط');for(const rec of g.records){const dr=details.get(rec.id),db=values({key:g.key,records:[rec]},owner,meta.v2_display_version===2);if(changed(dr,db)){apply(dr,rec);scopes.push({name:b[1],ids:[rec.id],groups:[txt(rec.values[10])],mode:SEPARATE});}}}
 else if(changed(row,b)||detailChanged)fail('اختر نطاق القرار للمادة '+b[1]+'؛ لن نطبق قرارًا جماعيًا ضمنيًا');
 }
 if(seen.size!==gs.length)fail('بعض المواد مفقودة؛ الحذف ليس إنهاء تكليف');
 const drs=gs.flatMap(g=>g.ids);for(let n=6;n<=extra.rowCount;n++){const r=extra.getRow(n),target=txt(r.getCell(1).value),role=txt(r.getCell(2).value),who=txt(r.getCell(3).value);if(!who&&!role&&!target)continue;if(!who||!role)fail('أكمل الحساب والدور في التكليف الإضافي');if(role==='كبير المنسقين'){if(target)fail('كبير المنسقين للقسم؛ اترك خانة المادة فارغة');legacy.getWorksheet('تكليفات القسم').addRow(['','كبير المنسقين',who,'','']);}else{const i=meta.v2_targets.indexOf(target);if(i<0||!['منسق مقرر','منسق مساعد','رئيس مجموعة'].includes(role))fail('اختر المجموعة والدور من القوائم');const oid=drs[i];legacy.getWorksheet('تكليفات المقررات').addRow(['',role,who,'لا','',oid,'']);scopes.push({name:recordsById.get(oid).values[1],ids:[oid],groups:[txt(recordsById.get(oid).values[10])],mode:'تكليف إضافي'});}}
 return {workbook:legacy,scopes,notes};
}
const api={VERSION:V2,ALL,SEPARATE,readMeta,simplify,expand};if(typeof module==='object'&&module.exports)module.exports=api;else root.CITLCourseExcelV2=api;
})(typeof window==='object'?window:globalThis);
