(function(root){
 'use strict';
 const btn='px-3 py-2 rounded-lg bg-[#2A3475] text-white text-xs font-bold';
 const label=key=>(typeof departments!=='undefined'?departments[key]?.name:null)||key;
 async function rpc(action,payload={}){await root.CITLAuth.session();return root.CITLRequests.rpc(root.sb,'citl_department_head_admin',{p_action:action,p_payload:payload});}
 async function save(department,profile,permissions={}){
  return rpc('save',{department_key:department,profile_id:profile,...permissions});
 }
 function feedback(result,host){host.textContent=result.message||(result.changed?'تم حفظ تعيين الجهة وصلاحياتها.':'لا توجد تغييرات جديدة.');}
 async function open(profile){return root.CITLAdminAccess?.openHeads(profile);}
 async function decorate(users){
  if(!root.CITLPermissions.full(root.currentUser))return;
  document.querySelectorAll('[data-head-action]').forEach(n=>n.remove());
  try{const data=await rpc('list');
   for(const user of users){const row=document.querySelector('tr[data-user-id="'+user.id+'"]');if(!row)continue;row.querySelectorAll('[data-head-badge]').forEach(n=>n.remove());
    const assigned=data.heads.filter(h=>h.profile_id===user.id);if(!assigned.length)continue;
    const badge=document.createElement('span');badge.dataset.headBadge='';badge.className='block text-[10px] text-[#2A3475] font-bold mt-1';badge.style.whiteSpace='nowrap';badge.textContent='رئيس قسم';badge.title=assigned.map(h=>label(h.department_key)).join('، ');row.children[4]?.append(badge);
   }
  }catch(error){root.showNotification?.('تعذر تحديث تعيينات رؤساء الأقسام: '+error.message,'error');}
 }
 root.CITLDepartmentHeads=Object.freeze({open,decorate,save,feedback,rpc,label});
 let accessBusy=false;
 async function showAttendanceLink(profile){
  if(!location.pathname.startsWith('/schedules/')||!profile||root.CITLPermissions.full(profile)||accessBusy||document.getElementById('department-attendance-link'))return;
  accessBusy=true;
  try{
   const result=await root.CITLRequests.rpc(root.sb,'citl_department_attendance',{p_action:'access',p_payload:{}});
   if(!result.is_head)return;
   const link=document.createElement('a');link.id='department-attendance-link';link.className=btn;link.textContent='متابعة منتدبي قسمي';link.href='/schedules/?open=attendance';
   const section=document.createElement('div');section.className='px-4 py-2 text-left';section.append(link);
   const header=document.querySelector('header');if(header)header.after(section);
  }catch(_){}finally{accessBusy=false;}
 }
 root.addEventListener('citl-profile-loaded',event=>showAttendanceLink(event.detail));
 if(root.currentUser)showAttendanceLink(root.currentUser);
})(window);
