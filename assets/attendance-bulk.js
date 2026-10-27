/* Explicit multi-selection of verified timetable identities. The server owns linkage and QR permissions. */
(function(root){
 'use strict';
 const node=(tag,text,cls)=>{const n=document.createElement(tag);if(text)n.textContent=text;if(cls)n.className=cls;return n;};
 const style='citl-ac-button';
 async function rpc(action,payload){await root.CITLAuth.session();return root.CITLRequests.rpc(root.sb,'citl_visitors_bulk',{p_action:action,p_payload:payload});}
 function mount(){
  const form=document.getElementById('am-visitor-form');if(!form||document.getElementById('citl-bulk-visitors'))return !!form;
  const host=node('section',null,'citl-bulk-visitors');host.id='citl-bulk-visitors';
  const button=node('button','اختيار عدة منتدبين',style);button.type='button';const info=node('p','اختيار جماعي من الجدول، مع ربط الحساب المعتمد وإتاحة QR قاعاته دون تغيير الرموز.','citl-ac-muted');
  host.append(button,info);form.before(host);button.onclick=async()=>{
   const term_id=document.getElementById('am-visitor-term')?.value||form.elements.term_id?.value;
   if(!term_id){root.showNotification?.('اختر الترم أولًا','error');return;}
   button.disabled=true;let dialog;
   try{
    const preview=await rpc('preview',{term_id});dialog=node('dialog',null,'citl-bulk-dialog');dialog.dir='rtl';
    const heading=node('h3','اختيار المنتدبين من جدول الترم'),intro=node('p','تُضاف الأسماء المحددة فقط. الأسماء غير المرتبطة بحساب معتمد تحتاج تصحيح الربط أولًا.','citl-ac-muted');
    const search=node('input');search.type='search';search.placeholder='بحث بالاسم';search.setAttribute('aria-label','بحث بالاسم');
    const selectAll=node('label',null,'citl-bulk-all'),all=node('input');all.type='checkbox';selectAll.append(all,document.createTextNode('تحديد المؤهلين الظاهرين'));
    const list=node('div',null,'citl-bulk-list'),status=node('p');status.setAttribute('role','status');
    const controls=node('div',null,'citl-ac-buttons'),save=node('button','تعيين المحددين وربط QR',style),close=node('button','إغلاق',style+' secondary');save.type=close.type='button';
    const selected=new Set(),draw=()=>{list.replaceChildren();const visible=preview.rows.filter(r=>r.full_name.toLocaleLowerCase().includes(search.value.trim().toLocaleLowerCase()));
     for(const r of visible){const label=node('label',null,'citl-bulk-option'),box=node('input');box.type='checkbox';box.value=r.key;box.disabled=!r.eligible;box.checked=selected.has(r.key);box.onchange=()=>{if(box.checked)selected.add(r.key);else selected.delete(r.key);status.textContent='المحدد: '+selected.size;};const text=node('span');text.append(node('strong',r.full_name),node('small',r.eligible?'القاعات: '+r.rooms.join('، '):r.reason));label.append(box,text);list.append(label);}
     if(!visible.length)list.append(node('p','لا توجد أسماء مطابقة.'));all.checked=visible.some(r=>r.eligible)&&visible.filter(r=>r.eligible).every(r=>selected.has(r.key));status.textContent='المحدد: '+selected.size;
    };
    search.oninput=draw;all.onchange=()=>{for(const r of preview.rows.filter(r=>r.eligible&&r.full_name.toLocaleLowerCase().includes(search.value.trim().toLocaleLowerCase())))if(all.checked)selected.add(r.key);else selected.delete(r.key);draw();};
    close.onclick=()=>dialog.close();save.onclick=async()=>{if(!selected.size){status.textContent='اختر اسمًا مؤهلًا واحدًا على الأقل.';return;}dialog.querySelectorAll('button,input').forEach(n=>n.disabled=true);try{const result=await rpc('apply',{term_id,revision:preview.revision,keys:[...selected]});dialog.close();await root.amLoadData?.();root.showNotification?.('تم تعيين '+result.count+' منتدب وربط QR القاعات بنجاح.','success');}catch(error){status.textContent=error.message;dialog.querySelectorAll('button,input').forEach(n=>n.disabled=false);draw();status.textContent=error.message;}};
    controls.append(save,close);dialog.append(heading,intro,search,selectAll,list,status,controls);document.body.append(dialog);dialog.addEventListener('close',()=>dialog.remove(),{once:true});draw();dialog.showModal();
   }catch(error){root.showNotification?.(error.message,'error');dialog?.remove();}finally{button.disabled=false;}
  };return true;
 }
 if(!mount()){const observer=new MutationObserver(()=>{if(mount())observer.disconnect();});observer.observe(document.body,{subtree:true,childList:true});}
})(window);
