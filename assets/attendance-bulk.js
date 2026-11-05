/* Explicit multi-selection of verified timetable identities. The server owns linkage and QR permissions. */
(function(root){
 'use strict';
 const node=(tag,text,cls)=>{const n=document.createElement(tag);if(text)n.textContent=text;if(cls)n.className=cls;return n;};
 const style='citl-ac-button';
 async function rpc(action,payload){await root.CITLAuth.session();return root.CITLRequests.rpc(root.sb,'citl_visitors_bulk',{p_action:action,p_payload:payload});}
 // Each server transaction is atomic; confirmed chunks are removed from the selection.
 // A failed/uncertain chunk remains selected and can be retried through the idempotent server path.
 async function applySelection(term_id,revision,selected,onProgress){
  const keys=[...selected],total=keys.length;let completed=0;
  for(let offset=0;offset<keys.length;offset+=20){
   const chunk=keys.slice(offset,offset+20);
   onProgress?.(completed,total);
   const result=await rpc('apply',{term_id,revision,keys:chunk});
   if(result?.ok!==true||Number(result.count)!==chunk.length)throw new Error('لم يؤكد الخادم اكتمال الدفعة؛ حدّث البيانات قبل إعادة المحاولة.');
   chunk.forEach(key=>selected.delete(key));completed+=chunk.length;onProgress?.(completed,total);
  }
  return {count:completed};
 }
 root.CITLAttendanceBulk=Object.freeze({applySelection});
 function mount(){
  const form=document.getElementById('am-visitor-form');if(!form||document.getElementById('citl-bulk-visitors'))return !!form;
  const host=node('section',null,'citl-bulk-visitors');host.id='citl-bulk-visitors';
  const button=node('button','اختيار عدة منتدبين',style);button.type='button';const info=node('p','اختيار حسابات معتمدة من جدول الترم الحالي لإتاحة الحضور بـQR وGPS حسب جاهزية المبنى.','citl-ac-muted');
  host.append(button,info);form.after(host);button.onclick=async()=>{
   const term_id=document.getElementById('am-visitor-term')?.value||form.elements.term_id?.value;
   if(!term_id){root.showNotification?.('اختر الترم أولًا','error');return;}
   button.disabled=true;let dialog;
   try{
    const preview=await rpc('preview',{term_id});dialog=node('dialog',null,'citl-bulk-dialog');dialog.dir='rtl';
    const heading=node('h3','اختيار المنتدبين من جدول الترم'),intro=node('p','تُحفظ الأسماء المحددة على دفعات صغيرة. عند تعذر دفعة تبقى الأسماء غير المؤكدة محددة لإعادة المحاولة؛ الربط غير المعتمد يحتاج تصحيحًا أولًا.','citl-ac-muted');
    const search=node('input');search.type='search';search.placeholder='بحث بالاسم';search.setAttribute('aria-label','بحث بالاسم');
    const selectAll=node('label',null,'citl-bulk-all'),all=node('input');all.type='checkbox';selectAll.append(all,document.createTextNode('تحديد المؤهلين الظاهرين'));
    const list=node('div',null,'citl-bulk-list'),status=node('p');status.setAttribute('role','status');
    const controls=node('div',null,'citl-ac-buttons'),save=node('button','حفظ التكليفات',style),close=node('button','إلغاء',style+' secondary');save.type=close.type='button';
    const department=node('select');department.setAttribute('aria-label','تصفية حسب القسم');department.add(new Option('جميع الأقسام',''));for(const [k,v]of [['transport-logistics','قسم إدارة لوجستيات النقل'],['trade-logistics','قسم إدارة لوجستيات التجارة الدولية'],['supply-chain','قسم إدارة لوجستيات سلاسل الإمداد'],['energy-logistics','قسم إدارة لوجستيات الطاقة والبترول']])department.add(new Option(v,k));department.value=document.getElementById('ar8-visitor-department')?.value||'';const selected=new Set(),draw=()=>{list.replaceChildren();const visible=preview.rows.filter(r=>(!department.value||r.department===department.value)&&r.full_name.toLocaleLowerCase().includes(search.value.trim().toLocaleLowerCase())).sort((a,b)=>Number(b.eligible)-Number(a.eligible));let lastGroup=null,group=list;
     for(const r of visible){if(lastGroup!==r.eligible){if(r.eligible){group=list;list.append(node('h4','حسابات معتمدة متاحة للاختيار'));}else{group=node('details',null,'ar8-unregistered');group.append(node('summary','أسماء تحتاج تسجيلًا أو تصحيح الربط ('+visible.filter(x=>!x.eligible).length+')'));list.append(group);}lastGroup=r.eligible;}const label=node('label',null,'citl-bulk-option'),box=node('input');box.type='checkbox';box.value=r.key;box.disabled=!r.eligible;box.checked=selected.has(r.key);box.onchange=()=>{if(box.checked)selected.add(r.key);else selected.delete(r.key);status.textContent='المحدد: '+selected.size;};const text=node('span');text.append(node('strong',r.full_name),node('small',r.eligible?'القاعات: '+r.rooms.join('، '):r.reason));label.append(box,text);group.append(label);}
     if(!visible.length)list.append(node('p','لا توجد أسماء مطابقة.'));all.checked=visible.some(r=>r.eligible)&&visible.filter(r=>r.eligible).every(r=>selected.has(r.key));status.textContent='المحدد: '+selected.size;
    };
    department.onchange=draw;search.oninput=draw;all.onchange=()=>{for(const r of preview.rows.filter(r=>r.eligible&&(!department.value||r.department===department.value)&&r.full_name.toLocaleLowerCase().includes(search.value.trim().toLocaleLowerCase())))if(all.checked)selected.add(r.key);else selected.delete(r.key);draw();};
    let saving=false;dialog.addEventListener('cancel',event=>{if(saving)event.preventDefault();});close.onclick=()=>dialog.close();save.onclick=async()=>{if(!selected.size){status.textContent='اختر اسمًا مؤهلًا واحدًا على الأقل.';return;}saving=true;dialog.querySelectorAll('button,input,select').forEach(n=>n.disabled=true);try{const result=await applySelection(term_id,preview.revision,selected,(done,total)=>{status.textContent='تم تأكيد '+done+' من '+total+' — جارٍ حفظ الدفعة التالية…';});dialog.close();await root.amLoadData?.();root.showNotification?.('تم تعيين '+result.count+' منتدب بنجاح؛ QR متاح وGPS حسب المبنى المعتمد.','success');}catch(error){saving=false;status.textContent=error.message;dialog.querySelectorAll('button,input,select').forEach(n=>n.disabled=false);draw();status.textContent=error.message+' — المتبقي غير المؤكد: '+selected.size;}};
    const icon=(button,cls)=>{const i=node('i',null,'fas '+cls);i.setAttribute('aria-hidden','true');button.prepend(i);};icon(save,'fa-check');icon(close,'fa-times');controls.append(save,close);const header=node('header',null,'ar8-dialog-header');header.append(heading);dialog.append(header,intro,search,department,selectAll,list,status,controls);document.body.append(dialog);dialog.addEventListener('close',()=>dialog.remove(),{once:true});draw();dialog.showModal();
   }catch(error){root.showNotification?.(error.message,'error');dialog?.remove();}finally{button.disabled=false;}
  };return true;
 }
 root.CITLAttendanceBulkMount=mount;
 if(!mount()){const observer=new MutationObserver(()=>{if(mount())observer.disconnect();});observer.observe(document.body,{subtree:true,childList:true});}
})(window);
