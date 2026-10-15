(function(root){'use strict';
const url='https://xgqukdbonzukxrpjovmb.supabase.co',key='eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhncXVrZGJvbnp1a3hycGpvdm1iIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjM4OTg4MDMsImV4cCI6MjA3OTQ3NDgwM30.3-70d7uB-zjVF7Jfr8ZjITT7suYPo3EWsYngO-sFVqM';
root.sb=root.supabase.createClient(url,key,{global:{fetch:root.CITLReadFetch},auth:{storageKey:'sb-main-auth',persistSession:true,autoRefreshToken:true,detectSessionInUrl:true}});
root.supabase=root.sb;root.PRESENCE_SUPABASE_URL=url;root.PRESENCE_SUPABASE_ANON_KEY=key;
root.CITLCourseDepartments={
            // ================================
            // 1. الأكواد الجديدة (التي ستظهر في القوائم)
            // ================================
            'dean': { name: 'مكتب العميد', priority: 1, color: 'dean-priority' },
            
            'transport-logistics': { name: 'قسم إدارة لوجستيات النقل', priority: 3, color: 'department-priority' },
            'trade-logistics': { name: 'قسم إدارة لوجستيات التجارة الدولية', priority: 3, color: 'department-priority' },
            'supply-chain': { name: 'قسم إدارة لوجستيات سلاسل الإمداد', priority: 3, color: 'department-priority' },
            'energy-logistics': { name: 'قسم إدارة لوجستيات الطاقة والبترول', priority: 3, color: 'department-priority' },
            'admin-followup': { name: 'قسم المتابعة الإدارية', priority: 3, color: 'department-priority' },

            'training-agency': { name: 'وكالة شؤون التدريب وخدمة المجتمع', priority: 2, color: 'vice-dean-priority' },
            'postgrad-agency': { name: 'وكالة الدراسات العليا والبحث العلمي', priority: 2, color: 'vice-dean-priority' },
            'education-agency': { name: 'وكالة شؤون التعليم', priority: 2, color: 'vice-dean-priority' },
            'students-agency': { name: 'وكالة شؤون الطلاب', priority: 2, color: 'vice-dean-priority' },

            'assistants-office': { name: 'مكتب المعيدين', priority: 4, color: 'assistant-priority' },
            'visitor': { name: 'زائر خارجي', priority: 5, color: 'bg-gray-500 text-white' },
            'computer-lab': { name: 'معمل الحاسب', priority: 3, color: 'department-priority' },

            // ================================
            // 2. الأكواد القديمة (Legacy Support)
            // (هامة جداً لمنع الخطأ - لا تحذفها حتى لو لم تستخدمها)
            // ================================
            'vice-dean-academic': { name: 'وكالة شؤون التعليم (سابقاً)', priority: 2, color: 'vice-dean-priority' },
            'vice-dean-graduate': { name: 'وكالة الدراسات العليا (سابقاً)', priority: 2, color: 'vice-dean-priority' },
            'vice-dean-community': { name: 'وكالة خدمة المجتمع (سابقاً)', priority: 2, color: 'vice-dean-priority' },
            'vice-dean-development': { name: 'وكالة التطوير (سابقاً)', priority: 2, color: 'vice-dean-priority' },
            'logistics-dept': { name: 'قسم اللوجستيات (سابقاً)', priority: 3, color: 'department-priority' },
            'transport-dept': { name: 'قسم النقل (سابقاً)', priority: 3, color: 'department-priority' },
            'supply-dept': { name: 'قسم سلاسل الإمداد (سابقاً)', priority: 3, color: 'department-priority' },
            'business-dept': { name: 'قسم إدارة الأعمال (سابقاً)', priority: 3, color: 'department-priority' },
            'assistant': { name: 'معيد (سابقاً)', priority: 4, color: 'assistant-priority' }
        };
let menuReturnFocus=null,menuScroll='';
function closeMobileMenu(){const menu=document.getElementById('cm-mobile-nav');if(menu.hidden)return;menu.hidden=true;document.body.style.overflow=menuScroll;document.querySelectorAll('[onclick="toggleMobileMenu()"]').forEach(b=>b.setAttribute('aria-expanded','false'));menuReturnFocus?.focus();}
root.toggleMobileMenu=()=>{const menu=document.getElementById('cm-mobile-nav');if(!menu.hidden){closeMobileMenu();return;}menuReturnFocus=document.activeElement;menuScroll=document.body.style.overflow;menu.hidden=false;document.body.style.overflow='hidden';document.querySelectorAll('[onclick="toggleMobileMenu()"]').forEach(b=>{b.setAttribute('aria-expanded','true');b.setAttribute('aria-controls','cm-mobile-nav');});menu.querySelector('[data-close][type=button]').focus();};
document.addEventListener('keydown',e=>{const menu=document.getElementById('cm-mobile-nav');if(menu.hidden)return;if(e.key==='Escape'){e.preventDefault();closeMobileMenu();}if(e.key==='Tab'){const list=[...menu.querySelectorAll('a,button')].filter(x=>x.getClientRects().length),first=list[0],last=list[list.length-1];if(e.shiftKey&&document.activeElement===first){e.preventDefault();last.focus();}else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first.focus();}}});
root.addEventListener('resize',()=>{if(innerWidth>=1024)closeMobileMenu();});
root.toggleProfileInfoMenu=()=>{const d=document.createElement('dialog');d.className='cm-dialog';d.innerHTML='<header><strong>الملف الشخصي</strong><button data-close aria-label="إغلاق">×</button></header><div class="cm-body"><strong data-name></strong><span data-position></span><span data-department></span><span data-email dir="ltr"></span><a class="cm-btn secondary" href="/dashboard/">لوحة التحكم والملف الشخصي</a><button class="cm-btn" data-logout>تسجيل الخروج</button></div>';const p=root.currentUser;d.querySelector('[data-name]').textContent=p.full_name||p.email;d.querySelector('[data-position]').textContent=p.position||'';d.querySelector('[data-department]').textContent=root.CITLCourseDepartments[p.department]?.name||p.department||'';d.querySelector('[data-email]').textContent=p.email;d.querySelector('[data-logout]').onclick=()=>root.logout();d.onclick=e=>{if(e.target===d||e.target.closest('[data-close]'))d.close();};d.onclose=()=>d.remove();document.body.append(d);d.showModal();};
root.showNotification=(message)=>{const el=document.getElementById('cm-status');el.textContent=message;};
root.CITLOversight={openRegistrationNotice:item=>{if(['faculty_registration','account_registered'].includes(item.kind)&&['approved','rejected'].includes(item.payload?.status)){location.assign('/dashboard/?open=activity');return true;}return false;}};
root.CITLAdminAccess={openHistory:()=>location.assign('/dashboard/?open=activity')};
root.addEventListener('citl-profile-loaded',e=>{const p=e.detail||root.currentUser;document.querySelectorAll('[data-cm-personal]').forEach(el=>{el.hidden=!(p.faculty_verification_status==='approved'&&(['faculty','visiting_lecturer'].includes(p.account_type)||p.is_visiting_lecturer===true));});for(const suffix of['','-mob']){
 const name=document.getElementById('profile-name'+suffix),role=document.getElementById('profile-role'+suffix);
 if(name)name.textContent=p.full_name||p.email;if(role)role.textContent=[root.CITLCourseDepartments[p.department]?.name||p.department,p.position].filter(Boolean).join(' — ');
}});
document.getElementById('cm-mobile-nav').addEventListener('click',e=>{if(e.target.closest('[data-close],a'))closeMobileMenu();});
document.addEventListener('click',e=>{if(!e.target.closest('#notif-menu,#notif-btn-wrapper,#notif-btn-wrapper-pc'))document.getElementById('notif-menu').classList.add('hidden');});
if('serviceWorker' in navigator)navigator.serviceWorker.register('/sw.js').catch(()=>{});
})(window);
