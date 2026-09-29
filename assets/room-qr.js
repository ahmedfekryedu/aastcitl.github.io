(function(root){
 'use strict';let loading=false;
 const buttonClass='px-3 py-2 rounded-lg bg-[#2A3475] text-white text-xs font-bold';
 async function api(action,payload={}){await root.CITLAuth.session();return root.CITLRequests.rpc(root.sb,'citl_room_qr_admin',{p_action:action,p_payload:payload});}
 async function load(){
  const host=document.getElementById('fixed-room-qr');if(!host||loading)return;loading=true;
  host.replaceChildren();
  const header=document.createElement('div');header.className='flex justify-between items-center gap-2 mb-3';
  const title=document.createElement('h4');title.className='font-black text-[#2A3475]';title.textContent='QR ثابت لكل قاعة';
  const refresh=document.createElement('button');refresh.type='button';refresh.className=buttonClass;refresh.textContent='تحديث القاعات';refresh.onclick=load;header.append(title,refresh);
  const info=document.createElement('p');info.className='text-xs text-gray-500 mb-4';info.textContent='الرمز ثابت عند تغيير الترم والمنتدبين. حدّد المنتدبين لكل قاعة، ويُحتسب المسح فقط أثناء موعد محاضرتهم في الترم النشط.';
  const status=document.createElement('p');status.setAttribute('role','status');status.className='text-xs mb-3';status.textContent='جاري تحميل الرموز…';host.append(header,info,status);
  try{
   const data=await api('list');
   const grid=document.createElement('div');grid.style.cssText='display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,240px),1fr));gap:12px';host.append(grid);
   for(const room of data.rooms){
    const card=document.createElement('article');card.className='p-3 border border-gray-200 rounded-xl bg-white';card.style.minWidth='0';card.dataset.room=room.room_name;
    const name=document.createElement('h5');name.className='text-center font-black text-[#2A3475] mb-2';name.textContent=room.room_name+(room.is_active?'':' — متوقف');
    const canvas=document.createElement('canvas');canvas.setAttribute('aria-label','QR '+room.room_name);
    card.append(name,canvas);grid.append(card);
    await root.QRCode.toCanvas(canvas,room.url,{width:1024,margin:4,errorCorrectionLevel:'H'});
    // qrcode writes inline pixel dimensions; constrain display AFTER rendering.
    canvas.style.cssText='display:block;width:100%;max-width:220px;height:auto;aspect-ratio:1;margin:0 auto';
    const download=document.createElement('button');download.type='button';download.className=buttonClass+' w-full mt-2';download.textContent='تنزيل QR فقط';
    download.onclick=()=>{const a=document.createElement('a');a.download='QR-'+room.room_name.replace(/[^\p{L}\p{N}_-]/gu,'_')+'.png';a.href=canvas.toDataURL('image/png');a.click();};card.append(download);
    const details=document.createElement('details');details.className='mt-3 text-xs';const summary=document.createElement('summary');summary.className='cursor-pointer font-bold text-[#2A3475]';summary.textContent='تحديد المنتدبين لهذه القاعة';details.append(summary);
    const choices=document.createElement('div');choices.className='mt-2 space-y-2';choices.style.cssText='max-height:190px;overflow:auto';
    for(const visitor of data.visitors){const label=document.createElement('label');label.className='flex gap-2 items-center';const input=document.createElement('input');input.type='checkbox';input.value=visitor.id;input.checked=data.assignments.some(a=>a.room_name===room.room_name&&a.visitor_id===visitor.id);label.append(input,document.createTextNode(visitor.full_name));choices.append(label);}
    if(!data.visitors.length)choices.textContent='أضف المنتدبين أولًا من تبويب المنتدبين.';
    const save=document.createElement('button');save.type='button';save.className=buttonClass+' mt-2';save.textContent='حفظ المنتدبين';
    const feedback=document.createElement('p');feedback.className='text-xs mt-2';feedback.setAttribute('role','status');
    save.onclick=async()=>{save.disabled=true;try{await api('assign',{room:room.room_name,visitors:[...choices.querySelectorAll('input:checked')].map(x=>x.value)});feedback.textContent='تم حفظ المنتدبين. رمز القاعة لم يتغير.';}catch(error){feedback.textContent=error.message;}finally{save.disabled=false;}};
    details.append(choices,save);card.append(details,feedback);
    const toggle=document.createElement('button');toggle.type='button';toggle.className='text-xs mt-3 text-gray-500 underline';toggle.textContent=room.is_active?'إيقاف رمز القاعة':'إعادة تفعيل نفس الرمز';toggle.onclick=async()=>{toggle.disabled=true;try{await api(room.is_active?'disable':'enable',{room:room.room_name});await load();}catch(error){feedback.textContent=error.message;toggle.disabled=false;}};card.append(toggle);
   }
   status.textContent=data.rooms.length?'':'لا توجد قاعات بعد. أضف القاعات أو ارفع الجدول ثم حدّث القائمة.';
  }catch(error){status.textContent=error.message+' — أعد المحاولة من تحديث القاعات.';}
  finally{loading=false;}
 }
 root.CITLRoomQr=Object.freeze({load});
})(window);
