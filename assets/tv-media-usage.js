/* Actual R2 TV object usage; isolated from upload/playback and Supabase storage. */
(function(root){
'use strict';
let client, busy=false, dirty=false, measured=0, owner='', last=null;
const allowed=()=>root.CITLPermissions?.can(root.currentUser,'can_manage_news');
const E=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const size=n=>{if(n===0)return '0 MB';const units=['B','KB','MB','GB','TB'],i=Math.min(4,Math.floor(Math.log10(n)/3));return (n/1000**i).toLocaleString('en-US',{maximumFractionDigits:2})+' '+units[i];};
function mount(){const grid=document.getElementById('admin-posters-grid');if(!grid||!allowed())return null;let host=document.getElementById('citl-media-usage');if(!host){host=document.createElement('section');host.id='citl-media-usage';host.className='citl-media-usage';host.innerHTML='<div class="citl-media-usage-head"><h4><i class="fas fa-cloud" aria-hidden="true"></i> مساحة ملفات الشاشة على Cloudflare</h4><button type="button">تحديث المساحة</button></div><div data-usage-body></div><p data-usage-status role="status"></p>';grid.parentElement.parentElement.after(host);host.querySelector('button').onclick=()=>refresh(client,true);}return host;}
function render(host,data){
 const budget=data.budgetBytes,remaining=budget?Math.max(0,budget-data.usedBytes):null,total=data.usedBytes;
 const card=(title,value)=>'<div><span>'+title+'</span><strong dir="ltr">'+E(value)+'</strong></div>';
 host.querySelector('[data-usage-body]').innerHTML='<div class="citl-media-usage-stats">'+card('المستخدم',size(total))+card('الصور · '+data.images.count+' ملف',size(data.images.bytes))+card('الفيديوهات · '+data.videos.count+' ملف',size(data.videos.bytes))+card(budget?'المتبقي من الحد المحدد':'المتبقي',budget?size(remaining):'غير محدد')+'</div><div class="citl-media-usage-bar" role="img" aria-label="توزيع المساحة المستخدمة: الصور ثم الفيديوهات وباقي ملفات الشاشة"><span style="width:'+(total?100*data.images.bytes/total:0)+'%"></span><span style="width:'+(total?100*data.videos.bytes/total:0)+'%"></span></div><p class="citl-media-usage-note">'+(budget?'الحد التنظيمي المحدد: '+E(size(budget))+(total>budget?' — تم تجاوز الحد.':'')+' هذا حد متابعة، وليس سعة حساب Cloudflare أو منعًا للرفع.':'لم يُحدد حد للمساحة؛ R2 لا يخصص سعة ثابتة للحاوية.')+'</p><p class="citl-media-usage-note">'+data.objects+' ملف داخل tv/، بما فيها الملفات غير النشطة. لا يشمل تخزين Supabase أو باقي الحساب.'+(data.other.count?' ملفات شاشة أخرى: '+data.other.count+' ('+E(size(data.other.bytes))+').':'')+'</p>';
 host.querySelector('[data-usage-status]').textContent='آخر قياس: '+new Date(data.measuredAt).toLocaleString('ar-EG',{timeZone:'Africa/Cairo'});
}
async function refresh(sb,force=false){
 if(sb)client=sb;if(!client||!allowed())return;const host=mount();if(!host)return;
 const id=root.currentUser?.id;if(owner!==id){owner=id;last=null;measured=0;host.querySelector('[data-usage-body]').replaceChildren();}
 if(busy){dirty=dirty||force;return;}if(!force&&last&&Date.now()-measured<60000){render(host,last);return;}
 busy=true;host.setAttribute('aria-busy','true');host.querySelector('button').disabled=true;
 if(!last)host.querySelector('[data-usage-body]').innerHTML='<div class="citl-admin-placeholder" aria-label="جاري قياس المساحة"><span class="citl-skeleton-line"></span><span class="citl-skeleton-line short"></span></div>';
 host.querySelector('[data-usage-status]').textContent=last?'جاري تحديث القياس…':'';
 try {const data=await root.CITLMediaStorage.usage(client);if(root.currentUser?.id!==id||!allowed())return;
  if(!Number.isSafeInteger(data.usedBytes)||data.usedBytes<0||!Number.isSafeInteger(data.objects)||data.objects<0||!['images','videos','other'].every(k=>Number.isSafeInteger(data[k]?.bytes)&&data[k].bytes>=0&&Number.isSafeInteger(data[k]?.count)&&data[k].count>=0)||!Number.isFinite(Date.parse(data.measuredAt)))throw new Error('خدمة قياس المساحة تحتاج تحديث Worker إلى النسخة المرفقة.');
  last=data;measured=Date.now();render(host,data);
 }catch(error){if(root.currentUser?.id===id&&allowed()){if(!last)host.querySelector('[data-usage-body]').replaceChildren();host.querySelector('[data-usage-status]').textContent=(last?'القياس السابق محفوظ. ':'')+'تعذر تحديث المساحة: '+error.message;}}
 finally{busy=false;host.setAttribute('aria-busy','false');host.querySelector('button').disabled=false;if(dirty){dirty=false;refresh(client,true);}}
}
root.CITLMediaUsage=Object.freeze({refresh});
root.addEventListener('citl-tv-media-update',()=>refresh(client,true));
root.addEventListener('citl-profile-loaded',()=>{if(!allowed()||owner!==root.currentUser?.id){last=null;measured=0;document.getElementById('citl-media-usage')?.remove();}});
})(window);
