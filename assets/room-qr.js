(function(root){
 'use strict';let loading=false,mutating=false;
 const buttonClass='px-3 py-2 rounded-lg bg-[#2A3475] text-white text-xs font-bold';
 const node=(tag,cls,text)=>{const el=document.createElement(tag);if(cls)el.className=cls;if(text)el.textContent=text;return el;};
 async function api(action,payload={}){await root.CITLAuth.session();return root.CITLRequests.rpc(root.sb,'citl_room_qr_admin',{p_action:action,p_payload:payload});}
 function skeleton(grid){grid.innerHTML=Array.from({length:3},()=>'<article class="citl-qr-card"><div class="citl-admin-placeholder"><span class="citl-skeleton-line"></span></div><div class="citl-qr-space citl-admin-placeholder"><span class="citl-skeleton-line" style="height:200px;width:100%"></span></div><div class="citl-admin-placeholder"><span class="citl-skeleton-line"></span><span class="citl-skeleton-line short"></span></div></article>').join('');}
 function shell(){
  const host=document.getElementById('fixed-room-qr');if(!host)return null;if(host.dataset.ready)return host;host.dataset.ready='true';
  const title=node('h4','font-black text-[#2A3475] mb-2','QR القاعات');
  const info=node('p','text-xs text-gray-500 mb-4','الكود ثابت مع تغيير الترم. تغيير الكود أو حذفه يُبطل النسخ القديمة ويحافظ على القاعة والمنتدبين وسجل الحضور.');
  const toolbar=node('div','citl-qr-toolbar'),all=node('label','flex gap-2 items-center text-xs font-bold'),input=node('input');input.type='checkbox';input.dataset.selectAll='';all.append(input,document.createTextNode('تحديد الكل'));toolbar.append(all);
  input.onchange=()=>host.querySelectorAll('[data-select-room]').forEach(c=>{c.checked=input.checked;});
  for(const [action,label] of [['disable','إيقاف المحدد'],['enable','تفعيل المحدد'],['rotate','تغيير أكواد المحدد'],['delete','حذف أكواد المحدد']]){
   const b=node('button',buttonClass,label);b.type='button';b.onclick=()=>change(action,[...host.querySelectorAll('[data-select-room]:checked')].map(c=>c.value));toolbar.append(b);
  }
  const refresh=node('button',buttonClass,'تحديث القاعات');refresh.type='button';refresh.onclick=load;toolbar.append(refresh);
  const status=node('p','text-xs mb-3');status.dataset.status='';status.setAttribute('role','status');
  const grid=node('div','citl-qr-grid');grid.dataset.grid='';grid.setAttribute('aria-label','أكواد القاعات');skeleton(grid);
  host.append(title,info,toolbar,status,grid);return host;
 }
 function busy(host,value){host.querySelectorAll('button,input').forEach(el=>el.disabled=value);host.setAttribute('aria-busy',String(value));}
 async function change(action,rooms){
  const host=shell(),status=host.querySelector('[data-status]');if(mutating||loading)return;
  if(!rooms.length){status.textContent='حدّد قاعة واحدة على الأقل.';return;}
  const labels={disable:'إيقاف',enable:'تفعيل',rotate:'تغيير',delete:'حذف'};
  const confirmFn=root.showConfirmDialog||root.showCustomConfirm||(async message=>confirm(message));
  if(!await confirmFn(`${labels[action]} أكواد ${rooms.length} قاعة؟${['rotate','delete'].includes(action)?' ستتوقف النسخ القديمة. القاعات والمنتدبون وسجل الحضور محفوظون.':''}`))return;
  mutating=true;busy(host,true);
  try{const data=await api(action,{rooms});await render(host,data);status.textContent='تم '+labels[action]+' أكواد القاعات المحددة.';}
  catch(error){status.textContent=error.message+' — حدّث القائمة للتحقق قبل إعادة المحاولة.';}
  finally{mutating=false;busy(host,false);}
 }
 async function render(host,data){
  const grid=host.querySelector('[data-grid]'),selected=new Set([...host.querySelectorAll('[data-select-room]:checked')].map(c=>c.value));
  const fragment=document.createDocumentFragment(),draw=[];
  for(const room of data.rooms){
   const card=node('article','citl-qr-card');card.dataset.room=room.room_name;
   const label=node('label','flex gap-2 items-center font-black text-[#2A3475] text-sm'),check=node('input');check.type='checkbox';check.dataset.selectRoom='';check.value=room.room_name;check.checked=selected.has(room.room_name);check.setAttribute('aria-label','تحديد '+room.room_name);
   check.onchange=()=>{const all=host.querySelector('[data-select-all]'),checks=[...host.querySelectorAll('[data-select-room]')];all.checked=checks.every(c=>c.checked);all.indeterminate=!all.checked&&checks.some(c=>c.checked);};
   label.append(check,document.createTextNode(room.room_name+(room.deleted?' — الكود محذوف':room.is_active?'':' — متوقف')));card.append(label);
   const space=node('div','citl-qr-space');card.append(space);
   if(room.url&&!room.deleted){
    const canvas=node('canvas');canvas.setAttribute('aria-label','QR '+room.room_name);space.append(canvas);
    draw.push(()=>root.QRCode.toCanvas(canvas,room.url,{width:1024,margin:4,errorCorrectionLevel:'H'}).then(()=>{canvas.style.cssText='display:block;width:100%;max-width:220px;height:auto;aspect-ratio:1;margin:0 auto';}));
    const download=node('button',buttonClass+' w-full mt-2','تنزيل QR فقط');download.type='button';
    download.onclick=()=>{const a=node('a');a.download='QR-'+room.room_name.replace(/[^\p{L}\p{N}_-]/gu,'_')+'.png';a.href=canvas.toDataURL('image/png');a.click();};card.append(download);
   }else space.append(node('p','text-xs text-gray-500 text-center','الكود محذوف. القاعة والمنتدبون محفوظون؛ أنشئ كودًا جديدًا عند الحاجة.'));
   const details=node('details','mt-3 text-xs'),summary=node('summary','cursor-pointer font-bold text-[#2A3475]','تحديد المنتدبين لهذه القاعة');details.append(summary);
   const choices=node('div','mt-2 space-y-2');choices.style.cssText='max-height:190px;overflow:auto';
   for(const visitor of data.visitors){const option=node('label','flex gap-2 items-center'),input=node('input');input.type='checkbox';input.value=visitor.id;input.checked=data.assignments.some(a=>a.room_name===room.room_name&&a.visitor_id===visitor.id);option.append(input,document.createTextNode(visitor.full_name));choices.append(option);}
   if(!data.visitors.length)choices.textContent='أضف المنتدبين واربطهم بحساباتهم المعتمدة أولًا.';
   const feedback=node('p','text-xs mt-2');feedback.setAttribute('role','status');const save=node('button',buttonClass+' mt-2','حفظ المنتدبين');save.type='button';
   save.onclick=async()=>{if(mutating||loading)return;mutating=true;busy(host,true);try{await api('assign',{room:room.room_name,visitors:[...choices.querySelectorAll('input:checked')].map(x=>x.value)});feedback.textContent='تم حفظ المنتدبين. رمز القاعة لم يتغير.';}catch(error){feedback.textContent=error.message;}finally{mutating=false;busy(host,false);}};
   details.append(choices,save);card.append(details,feedback);
   const actions=node('div','citl-qr-tools');
   for(const [action,text] of room.deleted?[['rotate','إنشاء كود جديد']]:[[room.is_active?'disable':'enable',room.is_active?'إيقاف':'تفعيل'],['rotate','تغيير الكود'],['delete','حذف الكود']]){
    const b=node('button','',text);b.type='button';if(action==='delete')b.dataset.danger='';b.onclick=()=>change(action,[room.room_name]);actions.append(b);
   }card.append(actions);fragment.append(card);
  }
  grid.replaceChildren(fragment);await Promise.all(draw.map(f=>f()));
  if(!data.rooms.length)grid.append(node('div','citl-admin-empty','لا توجد قاعات بعد. أضف القاعات أو ارفع الجدول.'));
  const checks=[...host.querySelectorAll('[data-select-room]')],all=host.querySelector('[data-select-all]');all.checked=checks.length>0&&checks.every(c=>c.checked);all.indeterminate=!all.checked&&checks.some(c=>c.checked);
 }
 async function load(){
  const host=shell();if(!host||loading||mutating)return;loading=true;busy(host,true);const status=host.querySelector('[data-status]');status.textContent='';
  try{await render(host,await api('list'));}catch(error){status.textContent=error.message+' — أعد المحاولة من تحديث القاعات.';}
  finally{loading=false;busy(host,false);}
 }
 root.CITLRoomQr=Object.freeze({load,mount:shell});shell();
})(window);
