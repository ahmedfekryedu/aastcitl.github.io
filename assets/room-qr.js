(function(root){
 'use strict';let loading=false,mutating=false,exporting=false,exportRooms=[];
 const selectedRooms=new Set();let qrPage=0;const qrPageSize=24;
 function pageRooms(host){const term=host.querySelector('input[type=search]').value.trim().toLocaleLowerCase(),matches=[...host.querySelectorAll('[data-room]')].filter(c=>c.dataset.room.toLocaleLowerCase().includes(term));qrPage=Math.min(qrPage,Math.max(0,Math.ceil(matches.length/qrPageSize)-1));host.querySelectorAll('[data-room]').forEach(c=>c.hidden=true);for(const c of matches.slice(qrPage*qrPageSize,(qrPage+1)*qrPageSize)){c.hidden=false;c._drawQr?.();}host.querySelectorAll('[data-room][hidden] canvas').forEach(c=>{c.width=0;c.height=0;delete c.dataset.drawn;});host.querySelector('[data-qr-page]').textContent=(qrPage+1)+' / '+Math.max(1,Math.ceil(matches.length/qrPageSize));host.querySelector('[data-qr-prev]').disabled=qrPage===0;host.querySelector('[data-qr-next]').disabled=(qrPage+1)*qrPageSize>=matches.length;selectionStatus(host);}
 const buttonClass='px-3 py-2 rounded-lg bg-[#2A3475] text-white text-xs font-bold';
 const node=(tag,cls,text)=>{const el=document.createElement(tag);if(cls)el.className=cls;if(text)el.textContent=text;return el;};
 async function api(action,payload={}){await root.CITLAuth.session();return root.CITLRequests.rpc(root.sb,'citl_room_qr_admin',{p_action:action,p_payload:payload});}
 function skeleton(grid){grid.innerHTML=Array.from({length:3},()=>'<article class="citl-qr-card"><div class="citl-admin-placeholder"><span class="citl-skeleton-line"></span></div><div class="citl-qr-space citl-admin-placeholder"><span class="citl-skeleton-line" style="height:200px;width:100%"></span></div><div class="citl-admin-placeholder"><span class="citl-skeleton-line"></span><span class="citl-skeleton-line short"></span></div></article>').join('');}
 function shell(){
  const host=document.getElementById('fixed-room-qr');if(!host)return null;if(host.dataset.ready)return host;host.dataset.ready='true';
  const title=node('h4','font-black text-[#2A3475] mb-2','QR القاعات');
  const info=node('p','text-xs text-gray-500 mb-4','رمز القاعة مثبت عبر تحديثات الجداول والترمات. لكل رمز مرجع ثابت ونسخة استعادة؛ الإيقاف والتفعيل لا يغيّران الرابط المطبوع.');
  const toolbar=node('div','citl-qr-toolbar'),all=node('label','flex gap-2 items-center text-xs font-bold'),input=node('input');input.type='checkbox';input.dataset.selectAll='';all.append(input,document.createTextNode('تحديد القاعات الظاهرة'));toolbar.append(all);
  input.onchange=()=>{host.querySelectorAll('[data-select-room]').forEach(c=>{if(c.closest('[data-room]').hidden)return;c.checked=input.checked;if(c.checked)selectedRooms.add(c.value);else selectedRooms.delete(c.value);});selectionStatus(host);};
  const filter=node('input');filter.type='search';filter.placeholder='بحث باسم القاعة';filter.setAttribute('aria-label','بحث باسم القاعة');filter.oninput=()=>{qrPage=0;pageRooms(host);};toolbar.append(filter);
  const count=node('span','text-xs font-bold');count.dataset.selectionCount='';toolbar.append(count);
  for(const [action,label] of [['disable','إيقاف المحدد'],['enable','تفعيل المحدد']]){
   const b=node('button',buttonClass,label);b.type='button';b.onclick=()=>change(action,[...selectedRooms]);toolbar.append(b);
  }
  const refresh=node('button',buttonClass,'تحديث القاعات');refresh.type='button';refresh.onclick=load;toolbar.append(refresh);
  const backup=node('button',buttonClass,'نسخة استعادة الرموز');backup.type='button';backup.dataset.qrBackup='';backup.onclick=async()=>{if(loading||mutating||exporting)return;mutating=true;busy(host,true);try{const data=await api('backup'),url=URL.createObjectURL(new Blob([JSON.stringify(data,null,2)],{type:'application/json'})),a=node('a');a.href=url;a.download='CITL-FIXED-QR-BACKUP.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);host.querySelector('[data-status]').textContent='تم تنزيل نسخة المراجع والروابط الحالية.';}catch(error){host.querySelector('[data-status]').textContent=error.message;}finally{mutating=false;busy(host,false);}};toolbar.append(backup);
  const restoreFile=node('input');restoreFile.type='file';restoreFile.accept='.json,application/json';restoreFile.hidden=true;
  const restore=node('button',buttonClass,'استعادة نسخة معروفة');restore.type='button';restore.onclick=()=>restoreFile.click();
  restoreFile.onchange=async()=>{const file=restoreFile.files[0];if(!file||loading||mutating||exporting)return;mutating=true;busy(host,true);try{if(file.size>2000000)throw Error('ملف الاستعادة أكبر من الحد المسموح');const saved=JSON.parse(await file.text());if(saved.format!=='CITL-FIXED-QR-1'||!Array.isArray(saved.codes))throw Error('ملف الاستعادة غير صالح');const codes=saved.codes.filter(c=>typeof c.token==='string'&&c.token);if(!codes.length)throw Error('لا توجد روابط محفوظة قابلة للاستعادة في هذا الملف');const confirmFn=root.showConfirmDialog||root.showCustomConfirm||(async message=>confirm(message));if(!await confirmFn('مطابقة واستعادة '+codes.length+' رمز معروف؟ لن تتغير هوية القاعات أو حالات تفعيلها الحالية.'))return;const result=await api('restore',{codes,confirm:'RESTORE_KNOWN_QR'});await render(host,await api('list'));host.querySelector('[data-status]').textContent='تم التحقق واستعادة '+result.restored+' رمزًا بنفس المراجع والروابط.';}catch(error){host.querySelector('[data-status]').textContent=error.message;}finally{mutating=false;restoreFile.value='';busy(host,false);}};toolbar.append(restore,restoreFile);
  for(const [selected,text] of [[false,'تنزيل جميع الأكواد PDF'],[true,'تنزيل المحدد PDF']]){const download=node('button',buttonClass,text);download.type='button';download.dataset.qrPdf=selected?'selected':'all';download.onclick=()=>runExport(()=>root.CITLRoomQrExport.pdf(selected?exportRooms.filter(r=>selectedRooms.has(r.room_name)):exportRooms,(i,total)=>{host.querySelector('[data-status]').textContent='جاري تجهيز PDF: '+i+' / '+total;}));toolbar.append(download);}
  const status=node('p','text-xs mb-3');status.dataset.status='';status.setAttribute('role','status');
  const grid=node('div','citl-qr-grid');grid.dataset.grid='';grid.setAttribute('aria-label','أكواد القاعات');skeleton(grid);
  const paging=node('div','citl-qr-toolbar'),previous=node('button',buttonClass,'السابق'),next=node('button',buttonClass,'التالي'),page=node('span');previous.type=next.type='button';previous.dataset.qrPrev='';next.dataset.qrNext='';page.dataset.qrPage='';previous.onclick=()=>{qrPage=Math.max(0,qrPage-1);pageRooms(host);};next.onclick=()=>{qrPage++;pageRooms(host);};paging.append(previous,page,next);host.append(title,info,toolbar,status,grid,paging);return host;
 }
 function busy(host,value){host.querySelectorAll('button,input').forEach(el=>el.disabled=value);host.setAttribute('aria-busy',String(value));if(!value&&host.querySelector('[data-room]'))pageRooms(host);}
 async function runExport(task){const host=shell();if(loading||mutating||exporting)return;exporting=true;busy(host,true);const status=host.querySelector('[data-status]');status.textContent='جاري تجهيز القالب…';try{if(!root.CITLRoomQrExport)throw Error('أداة تنزيل القالب غير متاحة؛ حدّث الصفحة');await task();status.textContent='تم تجهيز التنزيل. الأكواد المحذوفة لا تُضمّن في الملف.';}catch(error){status.textContent=error.message;}finally{exporting=false;busy(host,false);}}
 function selectionStatus(host){
  const checks=[...host.querySelectorAll('[data-select-room]')].filter(c=>!c.closest('[data-room]').hidden),all=host.querySelector('[data-select-all]');
  all.checked=checks.length>0&&checks.every(c=>c.checked);all.indeterminate=!all.checked&&checks.some(c=>c.checked);
  host.querySelector('[data-selection-count]').textContent='المحدد: '+selectedRooms.size+' | الظاهر: '+checks.length;
 }
 async function change(action,rooms){
  const host=shell(),status=host.querySelector('[data-status]');if(mutating||loading||exporting)return;
  if(!rooms.length){status.textContent='حدّد قاعة واحدة على الأقل.';return;}
  const labels={disable:'إيقاف',enable:'تفعيل'};
  if(!labels[action])return;
  const confirmFn=root.showConfirmDialog||root.showCustomConfirm||(async message=>confirm(message));
  mutating=true;busy(host,true);
  try{
   if(!await confirmFn(`${labels[action]} ${rooms.length} قاعة: ${rooms.join('، ')}؟ لن تتغير روابط QR المطبوعة. اختيار الصفوف وحده لا يغيّر حالة القاعات.`))return;
   const data=await api(action,{rooms});await render(host,data);status.textContent='تم '+labels[action]+' القاعات المحددة.';
  }catch(error){status.textContent=error.message+' — حدّث القائمة للتحقق قبل إعادة المحاولة. التحديد محفوظ.';}
  finally{mutating=false;busy(host,false);}
 }
 async function render(host,data){
  exportRooms=data.rooms.map(r=>({...r}));
  const grid=host.querySelector('[data-grid]'),selected=selectedRooms;
  for(const name of selectedRooms)if(!data.rooms.some(r=>r.room_name===name))selectedRooms.delete(name);
  const fragment=document.createDocumentFragment(),draw=[];
  for(const room of data.rooms){
   const card=node('article','citl-qr-card');card.dataset.room=room.room_name;
   const label=node('label','flex gap-2 items-center font-black text-[#2A3475] text-sm'),check=node('input');check.type='checkbox';check.dataset.selectRoom='';check.value=room.room_name;check.checked=selected.has(room.room_name);check.setAttribute('aria-label','تحديد '+room.room_name);
   check.onchange=()=>{if(check.checked)selectedRooms.add(check.value);else selectedRooms.delete(check.value);selectionStatus(host);};
   label.append(check,document.createTextNode(room.room_name+(room.deleted?' — الكود محذوف':room.is_active?'':' — متوقف')));card.append(label);
   if(room.reference_code){const reference=node('p','text-xs text-gray-500',room.reference_code);reference.dir='ltr';reference.dataset.qrReference='';reference.style.cssText='text-align:center;overflow-wrap:anywhere;margin:6px 0';card.append(reference);}
   const space=node('div','citl-qr-space');card.append(space);
   if(room.url&&!room.deleted){
    const canvas=node('canvas');canvas.setAttribute('aria-label','QR '+room.room_name);space.append(canvas);
    card._drawQr=()=>{if(canvas.dataset.drawn)return;canvas.dataset.drawn='true';root.QRCode.toCanvas(canvas,room.url,{width:512,margin:4,errorCorrectionLevel:'H'}).then(()=>{canvas.style.cssText='display:block;width:100%;max-width:220px;height:auto;aspect-ratio:1;margin:0 auto';}).catch(error=>{delete canvas.dataset.drawn;host.querySelector('[data-status]').textContent=error.message;});};
    const roomNumber=node('div','citl-room-qr-number',room.room_name);roomNumber.style.cssText='font:700 12px Cairo,sans-serif;text-align:center;color:#2a3475;margin:8px 0';card.append(roomNumber);
    const download=node('button',buttonClass+' w-full mt-2','تنزيل QR فقط');download.type='button';
    download.onclick=async()=>{await root.QRCode.toCanvas(canvas,room.url,{width:1024,margin:4,errorCorrectionLevel:'H'});const a=node('a');a.download='QR-'+room.room_name.replace(/[^\p{L}\p{N}_-]/gu,'_')+'.png';a.href=canvas.toDataURL('image/png');a.click();};card.append(download);
    const templateDownload=node('button',buttonClass+' w-full mt-2','تنزيل QR بالقالب');templateDownload.type='button';templateDownload.dataset.qrTemplate='';templateDownload.onclick=()=>runExport(()=>root.CITLRoomQrExport.png(room));card.append(templateDownload);
   }else space.append(node('p','text-xs text-gray-500 text-center','الكود محذوف. القاعة والمنتدبون محفوظون؛ أنشئ كودًا جديدًا عند الحاجة.'));
   const details=node('details','mt-3 text-xs'),summary=node('summary','cursor-pointer font-bold text-[#2A3475]','تحديد المنتدبين لهذه القاعة');details.append(summary);
   const choices=node('div','mt-2 space-y-2');choices.style.cssText='max-height:190px;overflow:auto';
   for(const visitor of data.visitors){const option=node('label','flex gap-2 items-center'),input=node('input');input.type='checkbox';input.value=visitor.id;input.checked=data.assignments.some(a=>a.room_name===room.room_name&&a.visitor_id===visitor.id);option.append(input,document.createTextNode(visitor.full_name));choices.append(option);}
   if(!data.visitors.length)choices.textContent='أضف المنتدبين واربطهم بحساباتهم المعتمدة أولًا.';
   const feedback=node('p','text-xs mt-2');feedback.setAttribute('role','status');const save=node('button',buttonClass+' mt-2','حفظ المنتدبين');save.type='button';
   save.onclick=async()=>{if(mutating||loading)return;mutating=true;busy(host,true);try{await api('assign',{room:room.room_name,visitors:[...choices.querySelectorAll('input:checked')].map(x=>x.value)});feedback.textContent='تم حفظ المنتدبين. رمز القاعة لم يتغير.';}catch(error){feedback.textContent=error.message;}finally{mutating=false;busy(host,false);}};
   details.append(choices,save);card.append(details,feedback);
   const actions=node('div','citl-qr-tools');
   for(const [action,text] of room.deleted?[]:[[room.is_active?'disable':'enable',room.is_active?'إيقاف':'تفعيل']]){
    const b=node('button','',text);b.type='button';if(action==='delete')b.dataset.danger='';b.onclick=()=>change(action,[room.room_name]);actions.append(b);
   }card.append(actions);fragment.append(card);
  }
  grid.replaceChildren(fragment);
  if(!data.rooms.length)grid.append(node('div','citl-admin-empty','لا توجد قاعات بعد. أضف القاعات أو ارفع الجدول.'));
  pageRooms(host);
 }
 async function load(){
  const host=shell();if(!host||loading||mutating||exporting)return;loading=true;busy(host,true);const status=host.querySelector('[data-status]');status.textContent='';
  try{await render(host,await api('list'));}catch(error){status.textContent=error.message+' — أعد المحاولة من تحديث القاعات.';}
  finally{loading=false;busy(host,false);}
 }
 root.CITLRoomQr=Object.freeze({load,mount:shell});shell();
})(window);
