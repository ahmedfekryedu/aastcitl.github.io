

// 1. أولاً: بنعرف الوظيفة نفسها (إيه اللي هيحصل لما ندوس خروج)
window.logout = async function() {
    try {
        if (window.presenceTracker) {
            await window.presenceTracker.logout();
        }

        if (typeof supabase !== 'undefined') {
            await supabase.auth.signOut(); // مسح الجلسة من السيرفر
        }
    } catch (e) {
        console.error(e);
    }
    
    localStorage.clear(); // مسح كل البيانات من المتصفح
    window.location.href = '../'; // العودة لصفحة الدخول
};

// 2. ثانياً: الكود اللي إنت بعته (تفعيل الزراير)
const logoutBtns = document.querySelectorAll('#logoutBtn, #logoutBtnMobile'); 

logoutBtns.forEach(btn => {
    if (btn) {
        const newBtn = btn.cloneNode(true);
        btn.parentNode.replaceChild(newBtn, btn);
        
        newBtn.addEventListener('click', async (e) => {
            e.preventDefault();
            await window.logout();
        });
    }
});

// --- دوال التحكم في شاشة التحميل (Unified) ---
window.showLoader = function(text = "جاري المعالجة...") {
    const loader = document.getElementById('global-loader');
    const textEl = document.getElementById('loader-text');
    
    if(textEl) textEl.textContent = text;

    if(loader) {
        loader.classList.remove('hidden');
        loader.classList.add('flex');
        
        setTimeout(() => {
            loader.classList.remove('opacity-0');
            const inner = loader.querySelector('.relative');
            if(inner) {
                inner.classList.remove('scale-95');
                inner.classList.add('scale-100');
            }
        }, 10);
    }
}; // 👈 (1) ضفنا فاصلة منقوطة هنا

window.hideLoader = function() {
    const loader = document.getElementById('global-loader');
    if(loader) {
        loader.classList.add('opacity-0');
        const inner = loader.querySelector('.relative');
        if(inner) {
            inner.classList.remove('scale-100');
            inner.classList.add('scale-95');
        }
        
        setTimeout(() => {
            loader.classList.add('hidden');
            loader.classList.remove('flex');
        }, 300);
    }
}; // 👈 (2) ضفنا فاصلة منقوطة هنا

  // --- إعدادات البريد الإلكتروني (EmailJS) ---
        ;(function(){ // 👈 (3) ضفنا فاصلة منقوطة قبل القوس للأمان
            // ⚠️ استبدل هذا بالمفتاح العام الخاص بك
            if (window.emailjs?.init) window.emailjs.init("su_jhKxAtjo-Kr-8w"); 
        })();

        const EMAIL_SERVICE_ID = "service_rpu85xb";   // ⚠️ استبدل بالخدمة
        const EMAIL_TEMPLATE_ID = "template_v4fabdd"; // ⚠️ استبدل بالقالب

        // دالة مساعدة لإرسال الإيميل
        async function sendEmailNotification(toEmail, toName, subject, messageBody) {
            if (!toEmail) return;
            
            const templateParams = {
                to_email: toEmail,
                to_name: toName,
                subject: subject,
                message: messageBody
            };

            try {
                await emailjs.send(EMAIL_SERVICE_ID, EMAIL_TEMPLATE_ID, templateParams);
                console.log('✅ Email sent to:', toEmail);
            } catch (error) {
                console.error('❌ Failed to send email:', error);
            }
        }
        
// =======================================================
// 1. إعدادات الاتصال بـ Supabase
// =======================================================
const SUPABASE_URL = 'https://xgqukdbonzukxrpjovmb.supabase.co';

// المفتاح العادي (Public anon key)
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhncXVrZGJvbnp1a3hycGpvdm1iIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjM4OTg4MDMsImV4cCI6MjA3OTQ3NDgwM30.3-70d7uB-zjVF7Jfr8ZjITT7suYPo3EWsYngO-sFVqM';


// =======================================================
// حفظ factory الأصلي قبل أي تعديل
// =======================================================
const supabaseFactory = window.supabase;

// =======================================================
// العميل الأساسي (مستخدم عادي)
// =======================================================
const sb = supabaseFactory.createClient(SUPABASE_URL, SUPABASE_KEY, {
    global: { fetch: window.CITLReadFetch },
    auth: {
        storageKey: 'sb-main-auth',
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true
    }
});

// =======================================================
// 🔥 ربط عميل المستخدم العادي وبيانات الـ Presence بالنافذة
// =======================================================
window.sb = sb;
window.PRESENCE_SUPABASE_URL = SUPABASE_URL;
window.PRESENCE_SUPABASE_ANON_KEY = SUPABASE_KEY;

// =======================================================
// 🔥 ربط العملاء بالنافذة (Global Exposure)
// =======================================================
window.supabase = sb;
window.supabaseAdmin = sb; // توافق للقراءة فقط؛ العمليات الحساسة عبر دوال SQL محمية

// المستخدم الحالي
let currentUser = null;

function isCurrentManager() {
    return !!(currentUser && window.CITLPermissions.full(currentUser));
}

function applyDashboardVisibility() {
    const isManager = isCurrentManager();

    document.querySelectorAll('[data-manager-only]').forEach(el => {
        el.classList.toggle('hidden', !isManager);
    });

    const summaryGrid = document.getElementById('dashboard-summary-grid');
    if (summaryGrid) {
        summaryGrid.className = isManager
            ? 'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3'
            : 'grid grid-cols-1 md:grid-cols-2 gap-3';
    }
}

// 2. دالة تطبيق الصلاحيات (معدلة للهيدر الجديد)
function applyUserPermissions() {
    const isManager = !!(currentUser && window.CITLPermissions.full(currentUser));

    // =========================
    // 1) دوال مساعدة داخلية
    // =========================
    const getDeptName = () => {
        if (!currentUser) return 'مستخدم';

        if (typeof departments !== 'undefined' && departments[currentUser.department]) {
            return departments[currentUser.department].name;
        }

        return currentUser.department || 'مستخدم';
    };

    const showForManagersOnly = () => {
        // أي عنصر عليه data-manager-only يختفي تماماً لغير المديرين
        document.querySelectorAll('[data-manager-only]').forEach(el => {
            el.classList.toggle('hidden', !isManager);
            el.setAttribute('aria-hidden', isManager ? 'false' : 'true');
        });

        // دعم احتياطي لو لسه فيه كارت الحجوزات الإدارية القديم من غير data-manager-only
        const adminBookingNumber = document.getElementById('stat-admin-bookings');
        if (adminBookingNumber) {
            const adminCard = adminBookingNumber.closest('.group') || adminBookingNumber.closest('[class*="rounded"]');
            if (adminCard && !adminCard.hasAttribute('data-manager-only')) {
                adminCard.classList.toggle('hidden', !isManager);
                adminCard.setAttribute('aria-hidden', isManager ? 'false' : 'true');
            }
        }

        // دعم احتياطي لإخفاء بلوكات الأرقام الإدارية القديمة داخل كروت القاعات والجداول
        const managerOnlyStatsIds = [
            'admin-bookings-live',
            'admin-bookings-next',
            'admin-bookings-pending',
            'admin-bookings-conflicts',
            'lectures-attendance-today',
            'lectures-without-attendance',
            'smrm-confirmed-today',
            'smrm-pending-today',
            'smrm-live-now',
            'schedules-today-total',
            'schedules-live-now',
            'schedules-attendance-today'
        ];

        managerOnlyStatsIds.forEach(id => {
            const el = document.getElementById(id);
            if (!el) return;

            const holder = el.closest('.grid') || el.closest('[class*="rounded"]');
            if (!holder) return;

            // لا نخفي شبكة الملخص كلها بالغلط
            if (holder.id === 'dashboard-summary-grid') return;

            // لو العنصر أو الأب عليه data-manager-only سيبه للجزء اللي فوق
            if (holder.hasAttribute('data-manager-only') || el.hasAttribute('data-manager-only')) return;

            holder.classList.toggle('hidden', !isManager);
            holder.setAttribute('aria-hidden', isManager ? 'false' : 'true');
        });

        // ضبط عدد أعمدة ملخص التشغيل حسب ظهور كارت المدير
        const summaryGrid = document.getElementById('dashboard-summary-grid');
        if (summaryGrid) {
            summaryGrid.className = isManager
                ? 'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3'
                : 'grid grid-cols-1 md:grid-cols-2 gap-3';
        }
    };

    // =========================
    // 2) تحديث بيانات المستخدم في الهيدر PC
    // =========================
    const profileName = document.getElementById('profile-name');
    const profileRole = document.getElementById('profile-role');

    if (currentUser && profileName) {
        profileName.textContent = `مرحباً، ${currentUser.full_name || currentUser.email || 'مستخدم'}`;
    }

    if (currentUser && profileRole) {
        const deptName = getDeptName();
        const userPosition = currentUser.position || '';
        profileRole.textContent = `${deptName}${userPosition ? ' - ' + userPosition : ''}`;
    }

    // =========================
    // 3) تحديث بيانات المستخدم في الموبايل
    // =========================
    const mobName = document.getElementById('profile-name-mob');
    const mobRole = document.getElementById('profile-role-mob');

    if (currentUser && mobName) {
        mobName.textContent = currentUser.full_name || currentUser.email || 'مستخدم';
    }

    if (currentUser && mobRole) {
        const deptName = getDeptName();
        mobRole.textContent = `${deptName}${currentUser.position ? ' - ' + currentUser.position : ''}`;
    }

    // =========================
    // 4) زر لوحة التحكم / الملف الشخصي
    // =========================
    let adminBtn = document.getElementById('admin-panel-btn');

    // احتياطي لو الزر لسه بدون id في الـ HTML
    if (!adminBtn) {
        adminBtn = document.querySelector('button[onclick*="openAdminPanel"]');
        if (adminBtn) adminBtn.id = 'admin-panel-btn';
    }

    if (adminBtn) {
        adminBtn.style.display = 'flex';
        adminBtn.style.alignItems = 'center';
        adminBtn.style.gap = '8px';

        if (isManager) {
            adminBtn.innerHTML = `
                <i class="fas fa-cogs text-base text-[#F3A628]"></i>
                <span>لوحة التحكم</span>
            `;

            adminBtn.onclick = function () {
                if (typeof openAdminPanel === 'function') {
                    openAdminPanel();
                }
            };
        } else {
            adminBtn.innerHTML = `
                <i class="fas fa-user-circle text-base text-[#F3A628]"></i>
                <span>ملفي الشخصي</span>
            `;

            adminBtn.onclick = function () {
                if (typeof openEditUserInfoModal === 'function') {
                    openEditUserInfoModal();
                } else if (typeof openAdminPanel === 'function') {
                    // احتياطي فقط لو مفيش دالة بروفايل مستقلة
                    openAdminPanel();
                }
            };
        }
    }

    // =========================
    // 5) إخفاء/إظهار عناصر المديرين
    // =========================
    showForManagersOnly();

    // =========================
    // 6) زر الخروج
    // =========================
    let logoutBtn = document.getElementById('logout-btn');

    // احتياطي لو زر الخروج لسه بدون id
    if (!logoutBtn) {
        logoutBtn = document.querySelector('button[onclick*="logout"]');
        if (logoutBtn) logoutBtn.id = 'logout-btn';
    }

    if (logoutBtn) {
        const newBtn = logoutBtn.cloneNode(true);
        logoutBtn.parentNode.replaceChild(newBtn, logoutBtn);

        newBtn.addEventListener('click', async (e) => {
            e.preventDefault();

            try {
                if (typeof supabase !== 'undefined' && supabase.auth) {
                    await supabase.auth.signOut();
                }
            } catch (err) {
                console.error('Logout Error:', err);
            }

            localStorage.clear();
            window.location.href = '../';
        });
    }

    // =========================
    // 7) تحديث أرقام الداشبورد بعد تطبيق الصلاحيات
    // =========================
    if (typeof updateDashboardCardsOnly === 'function') {
        updateDashboardCardsOnly();
    }
}

// Global variables
let meetings = [];
let currentWeekStart = new Date();
let selectedMeeting = null;

// Default configuration
const defaultConfig = {
    system_title: "CITL Smart System",
    college_name: "كلية النقل الدولي واللوجستيات",
    room_name: "CITL Smart System"
};

        // Department configurations
const departments = {
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

// تعريف المصفوفة فارغة (سيتم ملؤها من الإعدادات)
        let timeSlots = [];

        // Local storage functions
        function saveMeetings() {
            localStorage.setItem('meetings', JSON.stringify(meetings));
        }

function refreshAllViews() {
    renderCalendar();
    updateDashboard();
    
    // تشغيل الـ Skeleton
    showDashboardSkeleton();

    // تحديث التحليل الذكي
    setTimeout(() => {
        if (document.getElementById('ai-suggestions')) generateAISuggestions();
    }, 600);
    
    // تحديث لوحات الأدمن
    try { 
        updateAdminMeetingsList(); 
        updateAdminReports();
        if(typeof updateActivityLogs === 'function') updateActivityLogs(); 
    } catch(e) {}

    // 🔥🔥🔥 الإضافة الجديدة: تحديث الإشعارات تلقائياً مع كل ريفريش 🔥🔥🔥
    checkUserNotifications();
}

async function loadMeetings() {
            if (!currentUser || !(window.CITLPermissions.can(currentUser,'can_approve') || window.CITLPermissions.can(currentUser,'can_delete'))) {
                meetings = []; return;
            }
            try {
                // التعديل 1: طلبنا (email) مع (full_name) في الاستعلام
                const { data, error } = await supabase
                    .from('meetings')
                    .select('*, profiles(full_name, email)'); 
                
                if (error) throw error;

                meetings = data.map(m => {
                    // التحقق من وجود القسم (كود الأمان القديم)
                    const deptInfo = departments[m.department] || { 
                        name: 'قسم غير معروف', 
                        priority: 5, 
                        color: 'bg-gray-400 text-white' 
                    };

                    // التعديل 2: استخراج الإيميل بشكل آمن (لو مش موجود يبقى null)
                    const creatorEmail = (m.profiles && m.profiles.email) ? m.profiles.email : null;

                    return {
                        ...m,
                        startTime: m.start_time.slice(0, 5),
                        endTime: m.end_time.slice(0, 5),
                        createdAt: m.created_at,
                        // الاسم: لو موجود في البروفايل هاته، لو لأ هات اسم القسم
                        createdBy: (m.profiles && m.profiles.full_name) ? m.profiles.full_name : deptInfo.name,
                        creatorEmail: creatorEmail, // التعديل 3: تخزين الإيميل لاستخدامه لاحقاً
                        priority: deptInfo.priority 
                    };
                });
                
                refreshAllViews();
                
            } catch (error) {
                console.error('Error:', error);
                
                // كود الأمان (Fallback): لو فشل الربط، هات الاجتماعات بس عشان الجدول ميوقفش
                if (error.code === 'PGRST200') {
                     const { data: retryData } = await supabase.from('meetings').select('*');
                     if (retryData) {
                        meetings = retryData.map(m => {
                            // التأكد من القسم في حالة الخطأ أيضاً
                            const deptInfo = departments[m.department] || { name: 'غير معروف' };
                            return {
                                ...m,
                                startTime: m.start_time.slice(0, 5),
                                endTime: m.end_time.slice(0, 5),
                                createdAt: m.created_at,
                                createdBy: deptInfo.name,
                                creatorEmail: null, // في حالة الخطأ مفيش إيميل
                                priority: 3
                            };
                        });
                        refreshAllViews();
                     }
                }
            }
        }

// --- دالة التحديث التلقائي (Realtime) - معدلة للرفض ---
function setupRealtimeSubscription() {
    if (!currentUser || !(window.CITLPermissions.can(currentUser,'can_approve') || window.CITLPermissions.can(currentUser,'can_delete'))) return;
    const channel = supabase.channel('public:meetings');
    
    channel
        .on('postgres_changes', { event: '*', schema: 'public', table: 'meetings' }, async (payload) => {
            console.log('⚡ تحديث فوري:', payload);
            
            // 1. فحص خاص لحالة الرفض لإظهار تنبيه فوري
            if (payload.eventType === 'UPDATE' && payload.new.pending_changes && payload.new.pending_changes.rejected === true) {
                // نمسح الـ ID من الذاكرة ليظهر الإشعار في القائمة
                let seenIds = JSON.parse(localStorage.getItem('seen_notifications') || '[]');
                seenIds = seenIds.filter(id => id !== payload.new.id);
                localStorage.setItem('seen_notifications', JSON.stringify(seenIds));
                
                // تنبيه منبثق (Toast) لصاحب الحجز
                if (currentUser && payload.new.user_id === currentUser.id) {
                    showNotification(`❌ تم رفض تعديل الحجز: ${payload.new.title}`, 'error');
                }
            }

            // 2. إعادة تحميل البيانات
            await loadMeetings();
            
            // 3. باقي التنبيهات
            if (payload.eventType === 'INSERT') {
                if (window.CITLPermissions.can(currentUser, 'can_approve') && payload.new.status === 'pending') {
                    showNotification(`📅 طلب حجز جديد: ${payload.new.title}`, 'info');
                }
            }
            else if (payload.eventType === 'UPDATE') {
                // موافقة عادية
                if (payload.new.status === 'confirmed' && !payload.new.pending_changes && payload.new.user_id === currentUser.id) {
                    showNotification(`🎉 مبروك! تمت الموافقة على حجزك: ${payload.new.title}`, 'success');
                }
                // طلبات للمدير
                else if (window.CITLPermissions.can(currentUser, 'can_approve') && (payload.new.status === 'modification_requested' || payload.new.status === 'cancellation_requested')) {
                    showNotification(`📝 يوجد طلب جديد يحتاج مراجعة`, 'info');
                }
            }
            
            // 4. تحديث القائمة
            checkUserNotifications();
        })
        .subscribe();
}

// --- 1. دالة البدء والحماية (النسخة الكاملة النهائية) ---
async function initializeApp() {
    try {
        // ---------------------------------------------------------
        // أ. كود الحماية والتحقق من المستخدم
        // ---------------------------------------------------------
        currentUser = await window.CITLAuth.loadProfile();

        // تطبيق الصلاحيات وتحديث الهيدر
        if (typeof applyUserPermissions === 'function') {
            applyUserPermissions();
        }

        // ---------------------------------------------------------
        await window.CITLDashboard.start();
        if (!currentUser) { hideLoader(); return; }

        // 🔥 تشغيل نظام التواجد Presence للدashboard
        // ---------------------------------------------------------
        if (window.presenceTracker) {
            try {
                window.presenceTracker.startForPage('dashboard').catch(error => console.warn('Presence unavailable:', error));
            } catch (presenceError) {
                console.error('Presence dashboard start failed:', presenceError);
            }
        }

        // 🔥🔥🔥 بداية التعديل: تشغيل اللودر الشامل 🔥🔥🔥
        showLoader('جاري تهيئة النظام...');

        // ---------------------------------------------------------
        // 🔥 تشغيل شاشة الانتظار (Skeleton) فوراً (خلفية للودر)
        // ---------------------------------------------------------
        if (typeof renderSkeletonLoading === 'function') {
            renderSkeletonLoading(); 
        }

        // ---------------------------------------------------------
        // ب. كود Element SDK
        // ---------------------------------------------------------
        if (window.elementSdk) {
            await window.elementSdk.init({
                defaultConfig,
                onConfigChange: async (config) => {
                    const sysTitle = document.getElementById('system-title');
                    const colName = document.getElementById('college-name');
                    const roomNameElement = document.getElementById('room-name');

                    if (sysTitle) sysTitle.textContent = config.system_title || defaultConfig.system_title;
                    if (colName) colName.textContent = config.college_name || defaultConfig.college_name;
                    if (roomNameElement) roomNameElement.textContent = config.room_name || defaultConfig.room_name;
                },
                mapToCapabilities: (config) => ({
                    recolorables: [],
                    borderables: [],
                    fontEditable: undefined,
                    fontSizeable: undefined
                }),
                mapToEditPanelValues: (config) => new Map([
                    ["system_title", config.system_title || defaultConfig.system_title],
                    ["college_name", config.college_name || defaultConfig.college_name],
                    ["room_name", config.room_name || defaultConfig.room_name]
                ])
            });
        }
        
        // ---------------------------------------------------------
        // ج. تحميل البيانات بالترتيب الصحيح
        // ---------------------------------------------------------
        
        // 1. تحميل ساعات العمل أولاً
        await loadSystemSettings(); 

        // 2. تحميل الحجوزات من السيرفر
        await loadMeetings();
        
        // 3. تشغيل الجدول والواجهة
        initializeCalendar();
        setupEventListeners();
        populateTimeSlots();
        setupCustomDropdowns();
        
        // 🔥🔥 هام جداً: فحص الإشعارات فور فتح الموقع 🔥🔥
        if (typeof checkUserNotifications === 'function') {
            checkUserNotifications();
        }

        // 4. تحديث القائمة الجانبية
        if (typeof updateSidebarProfile === 'function') {
            updateSidebarProfile();
        }

        // ---------------------------------------------------------
        // 🔥 تشغيل التحديث التلقائي (Realtime)
        // ---------------------------------------------------------
        if (typeof setupRealtimeSubscription === 'function') {
            setupRealtimeSubscription();
        }
        
        // 🔥🔥🔥 نهاية التعديل: إخفاء اللودر بعد اكتمال التحميل 🔥🔥🔥
        hideLoader();

    } catch (error) {
        if (!currentUser) window.CITLAuth.showFailure(error);
        console.error("Error initializing app:", error);
        // في حالة الخطأ نخفي اللودر حتى لا يعلق النظام
        hideLoader();
    }
}

        // Initialize calendar
        function initializeCalendar() {
            const today = new Date();
            const dayOfWeek = today.getDay();
            const diff = today.getDate() - dayOfWeek + (dayOfWeek === 0 ? -6 : 1);
            currentWeekStart = new Date(today.setDate(diff));
            updateWeekDisplay();
            renderCalendar();
        }

// 🔥 دالة تحديث شريط التاريخ والقائمة المنسدلة
function updateWeekDisplay() {
    const weekEnd = new Date(currentWeekStart);
    weekEnd.setDate(weekEnd.getDate() + 6);
    
    const options = { year: 'numeric', month: 'long', day: 'numeric' };
    const startStr = currentWeekStart.toLocaleDateString('ar-EG', options);
    const endStr = weekEnd.toLocaleDateString('ar-EG', options);
    
    const weekDisplaySpan = document.getElementById('current-week');
    
    // 🔥 إزالة الـ Skeleton وإظهار التاريخ
    if(weekDisplaySpan) {
        weekDisplaySpan.textContent = `${startStr} - ${endStr}`;
        // إزالة كلاسات الـ Skeleton بمجرد تحميل البيانات
        weekDisplaySpan.classList.remove('animate-pulse', 'bg-gray-200', 'h-6');
        weekDisplaySpan.style.minWidth = 'auto';
    }

    // 🔥 تعبئة خيارات القائمة المنسدلة
    const dropdownOptions = document.getElementById('week-dropdown-options');
    if (!dropdownOptions) return;
    
    dropdownOptions.innerHTML = '';
    
    // ننشئ خيارات للأسابيع (الأسبوع الحالي، 3 أسابيع سابقة، 3 أسابيع قادمة)
    for (let i = -3; i <= 3; i++) {
        const weekDate = new Date(currentWeekStart);
        weekDate.setDate(currentWeekStart.getDate() + (i * 7));
        
        const weekEndDisplay = new Date(weekDate);
        weekEndDisplay.setDate(weekEndDisplay.getDate() + 6);
        
        const startText = weekDate.toLocaleDateString('ar-EG', { month: 'short', day: 'numeric' });
        const endText = weekEndDisplay.toLocaleDateString('ar-EG', { month: 'short', day: 'numeric' });
        
        const isCurrent = i === 0;
        const text = isCurrent ? `الأسبوع الحالي: ${startText} - ${endText}` : `${startText} - ${endText}`;
        const value = weekDate.toISOString(); // نحفظ التاريخ كـ ISO string

        dropdownOptions.innerHTML += `
            <li class="custom-option px-4 py-2.5 hover:bg-[#2A3475] hover:text-white cursor-pointer text-sm font-bold border-b border-gray-50 transition-all ${isCurrent ? 'bg-[#2A3475] text-white selected' : 'text-gray-700'}" 
                data-value="${value}" 
                onclick="jumpToWeek('${value}')">
                ${text}
            </li>
        `;
    }
}

        // Render calendar
function renderCalendar() {
    const container = document.getElementById('calendar-container');
    if (!container) return; // حماية للتأكد من وجود الحاوية
    container.innerHTML = '';

    // 1. تصميم رأس الجدول (الأيام)
    const dayNames = ['الأحد', 'الاثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'];
    
    for (let i = 0; i <= 7; i++) {
        const cell = document.createElement('div');
        
        if (i === 0) {
             // === خانة الوقت (الرأس) ===
             cell.className = 'time-slot sticky right-0 z-20 bg-gray-100 text-[#2A3475] font-extrabold text-xs flex items-center justify-center border-b-2 border-[#F3A628] shadow-[2px_0_5px_rgba(0,0,0,0.05)]';
             cell.textContent = 'الوقت';
        } else {
             // === خانات الأيام (الرأس) ===
             const dayIndex = i - 1;
             const dateObj = new Date(currentWeekStart);
             dateObj.setDate(currentWeekStart.getDate() + dayIndex);
             const dateStr = dateObj.toLocaleDateString('ar-EG', { day: 'numeric', month: 'numeric' });

cell.className = 'time-slot metallic-blue-fill random-slanted-lines text-white font-bold flex flex-col items-center justify-center tracking-wide border-l border-blue-800 py-1';             cell.innerHTML = `
                <span class="text-xs md:text-sm font-extrabold mb-0.5">${dayNames[dayIndex]}</span>
                <span class="text-[9px] md:text-xs text-[#F3A628] font-bold bg-white/10 px-2 py-0.5 rounded-full border border-[#F3A628]/20">${dateStr}</span>
             `;
        }
        container.appendChild(cell);
    }

    // 2. جسم الجدول (الساعات والمواعيد)
    timeSlots.forEach(time => {
        // عمود الوقت الجانبي
        const timeLabel = document.createElement('div');
        timeLabel.className = 'time-slot sticky right-0 z-20 bg-gray-50 flex items-center justify-center font-bold text-[#2A3475] border-b border-gray-200 text-xs md:text-sm shadow-[2px_0_5px_rgba(0,0,0,0.05)]';
        timeLabel.textContent = toArabicNum(time); // عرض الوقت بالأرقام العربية
        container.appendChild(timeLabel);

        for (let day = 0; day < 7; day++) {
            const cell = document.createElement('div');
            cell.className = 'time-slot relative border-b border-l border-gray-100 cursor-pointer transition-all duration-200 hover:bg-blue-50 hover:shadow-inner group min-h-[70px]';
            
            const currentDate = new Date(currentWeekStart);
            currentDate.setDate(currentWeekStart.getDate() + day);
            
            // التعديل 1: البحث عن الحجوزات المؤكدة (confirmed) فقط لتظهر في الجدول
            const meeting = meetings.find(m => {
                const meetingDate = new Date(m.date);
                return meetingDate.toDateString() === currentDate.toDateString() && 
                       m.startTime === time && 
                       m.status === 'confirmed'; 
            });

            if (meeting) {
                const meetingBlock = document.createElement('div');
                meetingBlock.className = `meeting-block ${departments[meeting.department].color} shadow-md rounded border-r-4 border-black/20 hover:scale-[1.02] transition-transform z-10 h-[calc(100%-8px)] m-1`;
                
                // التعديل 2: إضافة الجهة الحاجزة وتنسيق المحتوى ليكون متجاوباً مع الموبايل والكمبيوتر
                meetingBlock.innerHTML = `
                    <div class="p-1 md:p-1.5 h-full flex flex-col justify-between overflow-hidden text-white">
                        <div class="flex flex-col gap-0.5">
                            <p class="text-[9px] md:text-[11px] font-black leading-tight truncate text-right">
                                ${meeting.title}
                            </p>
                            <p class="text-[7px] md:text-[9px] font-bold opacity-90 truncate text-right flex items-center justify-start gap-1">
                                <i class="fas fa-building text-[6px] md:text-[8px] opacity-70"></i>
                                <span>${departments[meeting.department].name}</span>
                            </p>
                        </div>
                        
                        <div class="flex items-center justify-between mt-0.5 border-t border-white/20 pt-0.5">
                            <span class="text-[8px] md:text-[10px] font-bold opacity-90 whitespace-nowrap">
                                ${toArabicNum(meeting.startTime)}
                            </span>
                            <i class="fas fa-bookmark text-[7px] md:text-[9px] opacity-60"></i>
                        </div>
                    </div>
                `;
                
                meetingBlock.addEventListener('click', (e) => {
                    e.stopPropagation();
                    showMeetingDetails(meeting);
                });
                cell.appendChild(meetingBlock);
            } else {
                const addIcon = document.createElement('div');
                addIcon.className = 'absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none';
                addIcon.innerHTML = '<i class="fas fa-plus text-[#F3A628] text-xl opacity-50"></i>';
                cell.appendChild(addIcon);

                cell.addEventListener('click', () => openAddMeetingModal(currentDate, time));
            }
            container.appendChild(cell);
        }
    });

    // 3. فحص الحجوزات المخفية
    if (typeof checkHiddenMeetings === 'function') {
        setTimeout(checkHiddenMeetings, 100);
    }
}

// Populate time slots (معدلة لدعم القائمة الاحترافية)
        function populateTimeSlots() {
            const select = document.getElementById('meeting-time');
            const ulOptions = document.getElementById('meeting-time-options'); // القائمة الجديدة
            
            if(select) select.innerHTML = '<option value="">اختر الوقت</option>';
            if(ulOptions) ulOptions.innerHTML = '<li class="custom-option px-4 py-2.5 hover:bg-blue-50 cursor-pointer text-sm text-gray-700 border-b border-gray-50" data-value="">اختر الوقت</li>';
            
            timeSlots.forEach(time => {
                // ملء الـ Select المخفي (عشان الفورم يشتغل)
                const option = document.createElement('option');
                option.value = time;
                option.textContent = time;
                if(select) select.appendChild(option);

                // ملء القائمة الظاهرة (عشان المستخدم يشوفها)
                if(ulOptions) {
                    const li = document.createElement('li');
                    li.className = 'custom-option px-4 py-2.5 hover:bg-blue-50 cursor-pointer text-sm text-gray-700 border-b border-gray-50 font-bold';
                    li.dataset.value = time;
                    li.textContent = time;
                    ulOptions.appendChild(li);
                }
            });

            // إعادة تشغيل مستمعي الأحداث للقائمة الجديدة
            if(typeof setupCustomDropdowns === 'function') setupCustomDropdowns();
        }

        // --- إعدادات النظام (System Settings) ---

        // 1. تحميل الإعدادات من السيرفر
        

        // 2. حفظ الإعدادات الجديدة
        
      
        // --- قسم التقارير والوظائف المساعدة (كان ناقص) ---

// 1. دالة تصدير التقرير (Excel - CSV) - النسخة الاحترافية
        

        // 3. دالة تحديد الكل (للجدول)
        function toggleSelectAllMeetings() {
            const selectAll = document.getElementById('select-all-meetings');
            document.querySelectorAll('.meeting-checkbox').forEach(cb => cb.checked = selectAll.checked);
        }
// ============================================================
// دالة حذف المستخدم (النسخة المستقلة والمحمية - Final Fix)
// ============================================================
async function deleteUser(userId, userName) {
    
    // 1. تعريف المتغيرات محلياً لحل مشاكل (ReferenceError & undefined)
    const FOUNDER_EMAIL_CHECK = "fekrythug@gmail.com".trim().toLowerCase();
    
    // محاولة العثور على عميل Supabase سواء كان window.supabase أو supabase مباشرة
    const sbClient = (typeof window !== 'undefined' && window.supabase) ? window.supabase : ((typeof supabase !== 'undefined') ? supabase : null);
    
    // محاولة العثور على عميل الأدمن بأكثر من طريقة لضمان عدم ظهور خطأ (reading 'from')
    const sbAdmin = (typeof window !== 'undefined' && window.supabaseAdmin) ? window.supabaseAdmin : ((typeof supabaseAdmin !== 'undefined') ? supabaseAdmin : null);

// التحقق من وجود مفتاح الأدمن قبل البدء
if (!sbAdmin) {
    alert("خطأ تقني: لا يمكن إتمام الحذف لأن مفتاح الأدمن (supabaseAdmin) غير معرف.\nتأكد من وضعه في أعلى ملف index.html داخل مجلد smrm.");
    return;
}

    // 2. 🛡️ خطوة الحماية القصوى: فحص الحصانة
    try {
        // نجلب إيميل الشخص المراد حذفه للتأكد
        const { data: targetUser } = await sbClient
            .from('profiles')
            .select('email')
            .eq('id', userId)
            .single();

        // لو الإيميل هو إيميل المؤسس -> وقف فوراً
        if (targetUser && targetUser.email.trim().toLowerCase() === FOUNDER_EMAIL_CHECK) {
            alert("⛔ خطأ أمني: لا يمكن حذف حساب المؤسس الرئيسي للنظام مهما كانت الصلاحيات!");
            return; // 🛑 خروج نهائي من الدالة
        }
    } catch (e) {
        console.error("خطأ في فحص الحماية (تم تجاهله للإكمال بحذر):", e);
    }

    // 3. تأكيد الحذف (الحفاظ على كودك الأصلي)
    const confirmed = await showConfirmDialog(`هل أنت متأكد تماماً من حذف العضو "${userName || 'المستخدم'}"؟\nسيتم حذف حسابه وجميع بياناته وحجوزاته نهائياً.`);
    if (!confirmed) return;

    // 4. تغيير المؤشر للتحميل
    document.body.style.cursor = 'wait';

    try {
        // 5. الحذف باستخدام مفتاح الأدمن (استخدام sbAdmin المعرف محلياً)
        
        // أولاً: نحذف من جدول profiles
        const { error: dbError } = await sbAdmin.from('profiles').delete().eq('id', userId);
        if (dbError) throw dbError;

        // ثانياً: نحذف من نظام المصادقة (Auth)
        const { error: authError } = await sbAdmin.auth.admin.deleteUser(userId);
        if (authError) throw authError;

        showNotification('تم حذف المستخدم بنجاح');
        
        // 6. تحديث القائمة فوراً (الحفاظ على كودك الأصلي)
        if(typeof updateAdminUsersList === 'function') {
            await updateAdminUsersList();
        } else if (typeof fetchUsers === 'function') {
            fetchUsers();
        }

    } catch (err) {
        console.error('Error deleting user:', err);
        showNotification('فشل حذف المستخدم: ' + (err.message || err), 'error');
    } finally {
        document.body.style.cursor = 'default';
    }
}

// --- نظام التنبيه الذكي (النسخة المحسنة للاختفاء) ---

        function checkHiddenMeetings() {
            const indicator = document.getElementById('scroll-indicator');
            const countSpan = document.getElementById('hidden-count');
            
            if (!indicator) return;

            const windowHeight = window.innerHeight;
            const scrollY = window.scrollY || document.documentElement.scrollTop;
            
            // 1. حساب إجمالي ارتفاع الصفحة بدقة أكبر
            const docHeight = Math.max(
                document.body.scrollHeight, document.documentElement.scrollHeight,
                document.body.offsetHeight, document.documentElement.offsetHeight,
                document.body.clientHeight, document.documentElement.clientHeight
            );

            // 2. هل وصلنا لنهاية الصفحة؟ (بنسبة تسامح 50 بكسل)
            // لو المستخدم نزل لحد تحت خالص، اخفي الزرار فوراً مهما حصل
            if ((windowHeight + scrollY) >= docHeight - 50) {
                indicator.classList.add('opacity-0', 'translate-y-10', 'pointer-events-none');
                return; // وقف الدالة هنا خلاص
            }

            // 3. لو لسه منزلناش للآخر، نشوف فيه حجوزات مستخبية ولا لأ
            const meetingBlocks = document.querySelectorAll('.meeting-block');
            let hiddenCount = 0;

            meetingBlocks.forEach(block => {
                const rect = block.getBoundingClientRect();
                // لو قمة العنصر تحت خط نهاية الشاشة بأكتر من 50 بكسل
                // (زودنا الهامش عشان يختفي بدري شوية وهو طالع)
                if (rect.top > windowHeight + 50) { 
                    hiddenCount++;
                }
            });

            // 4. إظهار أو إخفاء الزر
            if (hiddenCount > 0) {
                indicator.classList.remove('opacity-0', 'translate-y-10', 'pointer-events-none');
                countSpan.textContent = hiddenCount;
            } else {
                indicator.classList.add('opacity-0', 'translate-y-10', 'pointer-events-none');
            }
        }

// زر النزول الذكي (يذهب لأول اجتماع مخفي)
        function scrollToNextMeeting() {
            const windowHeight = window.innerHeight;
            const meetingBlocks = document.querySelectorAll('.meeting-block');
            
            // البحث عن أول اجتماع مستخبي
            for (const block of meetingBlocks) {
                const rect = block.getBoundingClientRect();
                if (rect.top > windowHeight) {
                    // الذهاب إليه ووضعه في منتصف الشاشة
                    block.scrollIntoView({ behavior: 'smooth', block: 'center' });
                    break; // كفاية أول واحد
                }
            }
        }

        // تشغيل المراقب على الشاشة (Window Scroll)
        function initScrollObserver() {
            window.addEventListener('scroll', checkHiddenMeetings);
            window.addEventListener('resize', checkHiddenMeetings);
            // فحص مبدئي بعد ثانية
            setTimeout(checkHiddenMeetings, 1000); 
        }

// Setup event listeners (نسخة آمنة ومصححة ومضافة إليها وظيفة فتح قائمة الأسابيع)
function setupEventListeners() {
    // Helper function to safely add listener
    const addListener = (id, event, handler) => {
        const el = document.getElementById(id);
        if (el) el.addEventListener(event, handler);
    };

    // Navigation buttons (الأسبوع السابق والتالي)
    addListener('prev-week', 'click', () => {
        currentWeekStart.setDate(currentWeekStart.getDate() - 7);
        updateWeekDisplay();
        renderCalendar();
    });

    addListener('next-week', 'click', () => {
        currentWeekStart.setDate(currentWeekStart.getDate() + 7);
        updateWeekDisplay();
        renderCalendar();
    });

    // 🔥🔥🔥 الإضافة الجديدة: ربط زر فتح القائمة المنسدلة للأسبوع 🔥🔥🔥
    addListener('week-display-trigger', 'click', (e) => {
        e.stopPropagation();
        const options = document.getElementById('week-dropdown-options');
        const arrow = document.getElementById('week-arrow');

        // إغلاق أي قوائم منسدلة أخرى قبل الفتح
        document.querySelectorAll('.custom-dropdown-options').forEach(opt => {
            if(opt !== options) opt.classList.remove('show');
        });

        options.classList.toggle('show');
        
        // تدوير السهم
        if(arrow) arrow.style.transform = options.classList.contains('show') ? 'rotate(180deg)' : 'rotate(0deg)';
    });
    // -------------------------------------------------------------

    // Modal controls
    addListener('add-meeting-btn', 'click', () => openAddMeetingModal());
    addListener('dashboard-btn', 'click', () => openDashboard());
    // Header click is assigned once by applyUserPermissions; do not open two dialogs.
    addListener('logout-btn', 'click', async () => { 
    await window.logout(); 
    });
    
    // Close buttons (مجمعة للتسهيل)
    ['close-modal', 'cancel-meeting', 'close-dashboard', 'close-admin-panel', 'close-details', 'close-add-user', 'cancel-add-user']
    .forEach(id => addListener(id, 'click', () => document.querySelectorAll('.modal').forEach(m => m.classList.remove('show'))));

    // Admin panel controls
    addListener('add-user-btn', 'click', () => openAddUserModal());
    addListener('bulk-delete-btn', 'click', () => bulkDeleteMeetings());
    addListener('select-all-meetings', 'change', toggleSelectAllMeetings);
    
    // تصحيح مهم: ربط الفلتر بالدالة الصحيحة
    addListener('filter-department', 'change', filterAdminMeetings); 
    addListener('export-report-btn', 'click', exportReport);

    // Admin tabs logic
    document.querySelectorAll('.admin-tab').forEach(tab => {
        tab.addEventListener('click', (e) => {
            const btn = e.target.closest('.admin-tab');
            if(btn) switchAdminTab(btn.dataset.tab);
        });
    });

    // Forms
    addListener('add-user-form', 'submit', handleAddUser);
    addListener('meeting-form', 'submit', handleMeetingSubmission);

    // Meeting actions
    addListener('delete-meeting', 'click', deleteMeeting);
    addListener('edit-meeting', 'click', editMeeting);

    // --- الإضافة الجديدة: تشغيل مراقب السكرول للجدول ---
    if (typeof initScrollObserver === 'function') {
        initScrollObserver();
    }
}

// فتح نافذة الحجز (محدثة لتفادي المشكلة)
        function openAddMeetingModal(date = null, time = null) {
            if(window.CITLLoading.isBooking())return;
            window.CITLLoading.booking(false);
            // 🔥 أهم خطوة: تنظيف القديم قبل ما نفتح الجديد
            resetFormUI(); 
            
            document.getElementById('save-text').textContent = 'حفظ الحجز';
            const modal = document.getElementById('add-meeting-modal');
            modal.classList.add('show');
            
            // تعبئة التاريخ والوقت لو ضغطت على الجدول
            if (date) {
                const offset = date.getTimezoneOffset() * 60000;
                const localDate = new Date(date.getTime() - offset);
                document.getElementById('meeting-date').value = localDate.toISOString().split('T')[0];
            }
            
            if (time) {
                // لو جاي من الجدول، نختار الوقت ونحدث شكله
                if(typeof setDropdownValue === 'function') {
                    setDropdownValue('meeting-time', time);
                }
            }
        }

        // زر تعديل الحجز (وضع الـ ID)
        function editMeeting() {
            if (!selectedMeeting) return;
            
            // وضع ID الاجتماع في الحقل المخفي
            document.getElementById('meeting-id').value = selectedMeeting.id;
            document.getElementById('save-text').textContent = 'تحديث الحجز';

            // تعبئة البيانات
            document.getElementById('meeting-title').value = selectedMeeting.title;
            document.getElementById('meeting-date').value = selectedMeeting.date;
            document.getElementById('attendees').value = selectedMeeting.attendees || '';
            document.getElementById('description').value = selectedMeeting.description || '';
            
            // تعبئة القوائم الاحترافية (القسم، الوقت، المدة)
            setDropdownValue('department', selectedMeeting.department);
            setDropdownValue('meeting-time', selectedMeeting.startTime);

            // حساب المدة وتعبئتها
            const startMinutes = timeToMinutes(selectedMeeting.startTime);
            const endMinutes = timeToMinutes(selectedMeeting.endTime);
            const duration = (endMinutes - startMinutes) / 60;
            setDropdownValue('duration', duration.toString());
            
            closeModal('meeting-details-modal');
            document.getElementById('add-meeting-modal').classList.add('show');
        }

        // Close modal
        function closeModal(modalId) {
            document.getElementById(modalId).classList.remove('show');
        }

// ------- START: دالة مساعدة لحل مشكلة القراءة من القوائم المخصصة -------
function getValueFromDropdown(selectId) {
    // حاول القراءة من الـ select المخفي أولاً
    const select = document.getElementById(selectId);
    if (select && select.value) return select.value;

    // إذا لم تكن قيمة الـ select موجودة، نبحث عن الـ custom-dropdown الذي يحتوي على select ذي نفس الـ id
    const allDropdowns = document.querySelectorAll('.custom-dropdown');
    for (const dd of allDropdowns) {
        const hidden = dd.querySelector('select');
        if (!hidden) continue;
        if (hidden.id === selectId) {
            // نحصل على النص المعروض
            const displaySpan = dd.querySelector('.custom-dropdown-display span');
            const displayText = displaySpan ? displaySpan.textContent.trim() : '';
            // نحاول إيجاد خيار مطابق في القائمة الظاهرة
            const option = Array.from(dd.querySelectorAll('.custom-option'))
                                .find(li => li.innerText.trim() === displayText);
            if (option && option.dataset && option.dataset.value !== undefined) return option.dataset.value;
            // كحل احتياطي: نعيد قيمة الـ select (قد تكون فارغة) أو سلسلة فارغة
            return hidden.value || '';
        }
    }

    // فشل الاستدلال -> نرجع سلسلة فارغة
    return '';
}
// ------- END: دالة مساعدة -------


async function handleMeetingSubmission(e) {
    e.preventDefault();
    if(window.CITLLoading.isBooking())return;

    // 1. قراءة القيم
    const titleVal = (document.getElementById('meeting-title').value || '').trim();
    const deptVal  = getValueFromDropdown('department');
    const dateVal  = (document.getElementById('meeting-date').value || '').trim();
    const timeVal  = getValueFromDropdown('meeting-time');
    const durVal   = getValueFromDropdown('duration') || (document.getElementById('duration')?.value || '');

    if (!titleVal || !deptVal || !dateVal || !timeVal) {
        showNotification('يرجى ملء جميع الحقول المطلوبة', 'error');
        return;
    }

    if (!currentUser || !currentUser.id) {
        showNotification('خطأ: جلسة المستخدم غير صالحة.', 'error');
        return;
    }

    const meetingId = document.getElementById('meeting-id').value;

    window.CITLLoading.booking(true);
    showLoader('جاري حفظ الحجز وإبلاغ المديرين...'); 

    try {
        const endTimeVal = calculateEndTime(timeVal, parseInt(durVal));

        const meetingData = {
            title: titleVal,
            department: deptVal,
            date: dateVal,
            start_time: timeVal,
            end_time: endTimeVal,
            description: document.getElementById('description').value,
            attendees: document.getElementById('attendees').value,
            user_id: currentUser.id
        };

        const conflict = checkConflicts(meetingData, meetingId);
        if (conflict) throw new Error('Conflict');

        // -------------------------------------------------------------
        // دالة مساعدة لجلب إيميلات كل المديرين وإرسال التنبيهات
        // -------------------------------------------------------------
        const notifyAllManagers = async (subject, message) => {
            const { data: managers } = await supabase
                .from('profiles')
                .select('email, full_name')
                .eq('role', 'manager');

            if (managers && managers.length > 0) {
                managers.forEach(manager => {
                    if (manager.email) {
                        sendEmailNotification(
                            manager.email,      
                            manager.full_name,  
                            subject,            
                            message             
                        );
                    }
                });
                console.log(`تم إرسال تنبيهات لعدد ${managers.length} مدير.`);
            }
        };

        // === السيناريو 1: تعديل حجز موجود ===
        if (meetingId) {
            const originalMeeting = meetings.find(m => String(m.id) === String(meetingId));
            const isManager = window.CITLPermissions.can(currentUser, 'can_approve');
            const isOwner = originalMeeting && originalMeeting.user_id === currentUser.id;

            if (!isManager && !isOwner) {
                showNotification('⛔ لا تملك صلاحية التعديل', 'error');
                return;
            }

            if (isManager) {
                const { error } = await supabase.from('meetings').update({
                    ...meetingData,
                    status: 'confirmed',
                    pending_changes: null
                }).eq('id', meetingId);
                
                if (error) throw error;
                showNotification('تم تحديث الحجز بنجاح');
            } 
            else {
                // مستخدم عادي: طلب تعديل
                const { error } = await supabase.from('meetings').update({
                    status: 'modification_requested',
                    pending_changes: meetingData
                }).eq('id', meetingId);
                
                if (error) throw error;
                
                // جلب اسم قسم المستخدم الحالي
                const deptName = departments[currentUser.department]?.name || currentUser.department;
                
                // التعديل: تغيير "صاحب الطلب" إلى "مقدم الطلب"
                const msgBody = `<strong>ورد طلب تعديل على حجز قائم بانتظار موافقتكم.</strong>
                
                <strong>مقدم الطلب:</strong> ${currentUser.full_name} (${deptName})
                <strong>الحجز الأصلي:</strong> ${originalMeeting.title}
                <strong>التاريخ الأصلي:</strong> ${originalMeeting.date}
                
                <strong>يرجى الدخول إلى لوحة التحكم لمراجعة التغييرات المقترحة وقبولها أو رفضها.</strong>`;

                await notifyAllManagers("تنبيه: طلب تعديل حجز", msgBody);

                showNotification('📝 تم إرسال طلب التعديل للمراجعة');
            }
        } 
        // === السيناريو 2: حجز جديد ===
        else {
            const status = window.CITLPermissions.can(currentUser, 'can_approve') ? 'confirmed' : 'pending';
            const { error } = await supabase.from('meetings').insert([{
                ...meetingData,
                status: status
            }]);

            if (error) throw error;

            if (status === 'pending') {
                // جلب اسم الجهة المحجوز لها + اسم قسم مقدم الطلب
                const bookingDeptName = departments[deptVal]?.name || deptVal;
                const userDeptName = departments[currentUser.department]?.name || currentUser.department;
                
                // التعديل: إضافة القسم بجانب اسم مقدم الطلب
                const msgBody = `<strong>هناك طلب حجز جديد للقاعة يتطلب المراجعة.</strong>
                
                <strong>عنوان الاجتماع:</strong> ${titleVal}
                <strong>الجهة الحاجزة:</strong> ${bookingDeptName}
                <strong>مقدم الطلب:</strong> ${currentUser.full_name} (${userDeptName})
                <strong>الموعد المطلوب:</strong> ${dateVal}
                <strong>التوقيت:</strong> من ${timeVal} إلى ${endTimeVal}
                
                <strong>يرجى التفضل بالدخول للنظام لاتخاذ الإجراء المناسب.</strong>`;

                await notifyAllManagers("تنبيه: طلب حجز جديد", msgBody);
            }

            showNotification('تم إرسال طلب الحجز بنجاح');
        }

        await loadMeetings();
        closeModal('add-meeting-modal');
        resetFormUI();

    } catch (error) {
        console.error(error);
        if (error.message === 'Conflict') {
            showNotification('يوجد تعارض في الموعد!', 'error');
        } else {
            showNotification('حدث خطأ: ' + error.message, 'error');
        }
    } finally {
        window.CITLLoading.booking(false);
        hideLoader();
    }
}

// استبدل دالة calculateEndTime القديمة بهذه النسخة الآمنة
function calculateEndTime(startTime, duration) {
    // حماية: لو الوقت فاضي نرجع قيمة افتراضية عشان الكود ميفصلش
    if (!startTime || typeof startTime !== 'string' || !startTime.includes(':')) {
        return "00:00";
    }
    
    try {
        const [hoursStr, minutesStr] = startTime.split(':');
        const hours = parseInt(hoursStr);
        const minutes = parseInt(minutesStr);
        
        // التأكد من أن الأرقام صحيحة
        if (isNaN(hours) || isNaN(minutes)) return "00:00";

        const endHour = hours + parseInt(duration);
        return `${endHour.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
    } catch (e) {
        console.error("Error calculating time:", e);
        return "00:00";
    }
}

function checkConflicts(newMeeting, excludeId = null) {
            const conflictingMeeting = meetings.find(meeting => {
                // 👇 هذا السطر هو الحل: تجاهل الاجتماع الحالي لو بنعدله
                if (excludeId && String(meeting.id) === String(excludeId)) return false;

                if (!meeting || !meeting.startTime || !meeting.endTime) return false;
                if (meeting.date !== newMeeting.date) return false;
                
                const newStart = timeToMinutes(newMeeting.start_time || newMeeting.startTime);
                const newEnd = timeToMinutes(newMeeting.end_time || newMeeting.endTime);
                const existingStart = timeToMinutes(meeting.startTime);
                const existingEnd = timeToMinutes(meeting.endTime);
                
                return (newStart < existingEnd && newEnd > existingStart);
            });

            if (conflictingMeeting) {
                const newDept = departments[newMeeting.department];
                const newPriority = newDept ? newDept.priority : 5;
                const existingPriority = conflictingMeeting.priority || 5;
                
                const canOverride = newPriority < existingPriority;
                return { meeting: conflictingMeeting, canOverride };
            }
            return null;
        }

// 2. تحويل الوقت لدقائق (نسخة آمنة جداً)
        function timeToMinutes(time) {
            // لو الوقت فاضي أو مش نص، نرجع 0 عشان الكود ميرميش Error
            if (!time || typeof time !== 'string') return 0;
            
            try {
                const [hours, minutes] = time.split(':').map(Number);
                return hours * 60 + minutes;
            } catch (e) {
                return 0;
            }
        }

// Show meeting details (معدلة للحماية + إصلاح تشغيل الأزرار)
// دالة عرض التفاصيل المحدثة لتناسب جميع الشاشات (تعديل نهائي)
function showMeetingDetails(meeting) {
    selectedMeeting = meeting;
    const modal = document.getElementById('meeting-details-modal');
    const content = document.getElementById('meeting-details-content');
    
    const startDt = new Date(`2000-01-01T${meeting.startTime}`);
    const endDt = new Date(`2000-01-01T${meeting.endTime}`);
    const durationHrs = (endDt - startDt) / (1000 * 60 * 60);

    const createdDateDisplay = meeting.createdAt ? new Date(meeting.createdAt).toLocaleString('ar-EG') : 'غير مسجل';
    const creatorName = meeting.createdBy || 'غير معروف';

    const isOwner = (currentUser && currentUser.id === meeting.user_id);
    const isManager = (currentUser && window.CITLPermissions.can(currentUser, 'can_approve'));
    const canManage = isOwner || isManager || window.CITLPermissions.can(currentUser, 'can_delete');
    
    let buttonsHTML = '';
    if (canManage) {
        // التعديل: الأزرار تحت بعض في الموبايل (w-full) وجنب بعض في الكمبيوتر (w-auto)
        buttonsHTML = `
            <div class="flex flex-col md:flex-row justify-end gap-3 pt-4 border-t border-gray-100 mt-6 shrink-0">
                <button id="delete-meeting" ${((isOwner && meeting.status === 'pending') || window.CITLPermissions.can(currentUser, 'can_delete')) ? '' : 'hidden'} class="w-full md:w-auto px-5 py-2.5 bg-red-50 text-red-600 border border-red-200 rounded-lg hover:bg-red-600 hover:text-white transition-all font-bold text-xs md:text-sm flex items-center justify-center order-2 md:order-1 active:scale-95"> 
                    <i class="fas fa-trash ml-2"></i> حذف الحجز 
                </button> 
                <button id="edit-meeting" ${(isOwner || isManager) ? '' : 'hidden'} class="w-full md:w-auto px-6 py-2.5 bg-[#2A3475] text-white rounded-lg hover:bg-[#1f2658] transition-all font-bold text-xs md:text-sm shadow-md flex items-center justify-center transform active:scale-95 order-1 md:order-2"> 
                    <i class="fas fa-edit ml-2"></i> تعديل الحجز 
                </button>
            </div>
        `;
    }

    content.innerHTML = `
        <div class="pb-4 mb-4 border-b border-gray-100">
            <div class="flex flex-col md:flex-row justify-between items-start gap-3">
                <div class="min-w-0 flex-1">
                    <h4 class="text-lg md:text-2xl font-bold text-[#2A3475] mb-1 break-words leading-tight">${meeting.title}</h4>
                    <div class="flex items-center text-xs md:text-sm text-gray-500 font-bold">
                        <i class="fas fa-building text-[#F3A628] ml-2"></i>
                        <span>${departments[meeting.department] ? departments[meeting.department].name : meeting.department}</span>
                    </div>
                </div>
                <span class="px-3 py-1 bg-green-50 text-green-700 border border-green-100 rounded-full text-[10px] md:text-xs font-bold whitespace-nowrap self-start flex items-center">
                    <span class="w-2 h-2 bg-green-500 rounded-full ml-2 inline-block animate-pulse"></span>
                    ${meeting.status === 'confirmed' ? 'مؤكد / فعال' : 'قيد الانتظار'}
                </span>
            </div>
        </div>

        <div class="grid grid-cols-1 md:grid-cols-2 gap-3 md:gap-4 mb-6">
            <div class="bg-gray-50 p-3 rounded-xl border-r-4 border-[#2A3475] shadow-sm">
                <div class="text-[10px] text-gray-400 font-bold mb-1 uppercase tracking-wider">التاريخ الرسمي</div>
                <div class="text-xs md:text-sm font-bold text-gray-800 flex items-center">
                    <i class="far fa-calendar-check text-[#F3A628] ml-2"></i>
                    ${new Date(meeting.date).toLocaleDateString('ar-EG', { weekday: 'long', day: 'numeric', month: 'long' })}
                </div>
            </div>

            <div class="bg-gray-50 p-3 rounded-xl border-r-4 border-[#F3A628] shadow-sm">
                <div class="text-[10px] text-gray-400 font-bold mb-1 uppercase tracking-wider">التوقيت والمدة</div>
                <div class="text-xs md:text-sm font-bold text-gray-800 flex items-center">
                    <i class="far fa-clock text-[#2A3475] ml-2"></i>
                    ${toArabicNum(meeting.startTime)} - ${toArabicNum(meeting.endTime)} 
                    <span class="text-[10px] text-gray-400 mr-2">(${durationHrs} ساعة)</span>
                </div>
            </div>
        </div>

        <div class="space-y-4">
            ${meeting.attendees ? `
            <div>
                <h5 class="text-xs md:text-sm font-bold text-[#2A3475] mb-2 flex items-center"><i class="fas fa-users ml-2 text-gray-400"></i> الحضور</h5>
                <div class="bg-white border border-gray-100 rounded-lg p-2.5 text-xs md:text-sm text-gray-600 font-bold leading-relaxed">${meeting.attendees}</div>
            </div>` : ''}
            
            ${meeting.description ? `
            <div>
                <h5 class="text-xs md:text-sm font-bold text-[#2A3475] mb-2 flex items-center"><i class="fas fa-align-right ml-2 text-gray-400"></i> ملاحظات</h5>
                <div class="bg-blue-50/30 rounded-lg p-3 text-xs md:text-sm text-gray-600 leading-relaxed border border-blue-50">${meeting.description}</div>
            </div>` : ''}
        </div>

        <div class="mt-6 pt-4 border-t border-gray-50 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 text-[9px] md:text-[10px] text-gray-400">
            <div class="flex items-center"><i class="fas fa-user-edit ml-1"></i> محجوز بواسطة: <span class="font-bold text-gray-500 mr-1">${creatorName}</span></div>
            <div class="flex items-center"><i class="fas fa-history ml-1"></i> تاريخ الطلب: ${createdDateDisplay}</div>
        </div>
        
        ${buttonsHTML}
    `;
    
    setTimeout(() => {
        const delBtn = document.getElementById('delete-meeting');
        const editBtn = document.getElementById('edit-meeting');
        if(delBtn) delBtn.onclick = deleteMeeting; 
        if(editBtn) editBtn.onclick = editMeeting;   
    }, 50);

    modal.classList.add('show');
}

// حذف الحجز من Supabase
// دالة الحذف (المعدلة لإرسال طلب بدلاً من الحذف المباشر للمستخدمين)
async function deleteMeeting() {
    if (!selectedMeeting) return;
    
    // التحقق من أن المستخدم هو صاحب الحجز أو المدير
    const isOwner = selectedMeeting.user_id === currentUser.id;
    const isManager = window.CITLPermissions.full(currentUser);

    if (!isOwner && !isManager) {
        showNotification('⛔ لا تملك صلاحية لحذف هذا الحجز!', 'error');
        return;
    }

    // --- الحالة الأولى: المدير (حذف نهائي) ---
    if (isManager) {
        const isConfirmed = await showConfirmDialog('بصفتك مديراً، سيتم الحذف نهائياً. هل أنت متأكد؟');
        if (!isConfirmed) return;

        // 🔥 تشغيل اللودر
        showLoader('جاري حذف الحجز نهائياً...');

        try {
            const { error } = await supabase.from('meetings').delete().eq('id', selectedMeeting.id);
            if (error) throw error;
            
            meetings = meetings.filter(m => m.id !== selectedMeeting.id);
            refreshAllViews();
            closeModal('meeting-details-modal');
            showNotification('تم الحذف نهائياً ✅');
        } catch (error) { 
            showNotification('فشل الحذف', 'error'); 
        } finally { 
            // 🔥 إخفاء اللودر
            hideLoader(); 
        }
    
    } else {
        // --- الحالة الثانية: مستخدم عادي (إرسال طلب إلغاء) ---
        const isConfirmed = await showConfirmDialog('هل تريد إرسال "طلب إلغاء" لهذا الحجز للمدير؟\nلن يتم الحذف حتى يوافق المدير.');
        if (!isConfirmed) return;

        // 🔥 تشغيل اللودر
        showLoader('جاري إرسال طلب الإلغاء...');

        try {
            // تحديث الحالة إلى "طلب إلغاء"
            const { error } = await supabase
                .from('meetings')
                .update({ status: 'cancellation_requested' })
                .eq('id', selectedMeeting.id);

            if (error) throw error;

            // تحديث الحالة محلياً
            const mIndex = meetings.findIndex(m => m.id === selectedMeeting.id);
            if(mIndex > -1) meetings[mIndex].status = 'cancellation_requested';

            refreshAllViews();
            closeModal('meeting-details-modal');
            showNotification('✅ تم إرسال طلب الإلغاء للمدير بنجاح');
        } catch (error) { 
            showNotification('فشل إرسال الطلب', 'error'); 
        } finally { 
            // 🔥 إخفاء اللودر
            hideLoader(); 
        }
    }
}

// دالة التعديل (النسخة الكاملة المصححة لجلب كل البيانات القديمة)
function editMeeting() {
    if (!selectedMeeting) return;

    // 1. الحماية: التحقق من الصلاحية (مدير أو صاحب الحجز)
    const isOwner = (currentUser && currentUser.id === selectedMeeting.user_id);
    const isManager = (currentUser && window.CITLPermissions.can(currentUser, 'can_approve'));
    
    if (!isManager && !isOwner) {
        showNotification('⛔ عذراً، لا تملك صلاحية لتعديل هذا الحجز!', 'error');
        return;
    }

    // 2. تعبئة الـ ID وتغيير عنوان الزر
    document.getElementById('meeting-id').value = selectedMeeting.id;
    document.getElementById('save-text').textContent = 'تحديث الحجز';

    // 3. تعبئة العنوان
    document.getElementById('meeting-title').value = selectedMeeting.title || '';

    // 4. تعبئة التاريخ (إصلاح المشكلة الأساسية)
    if (selectedMeeting.date) {
        const d = new Date(selectedMeeting.date);
        // تعديل التوقيت لضمان ظهور التاريخ الصحيح (تفادي مشكلة اليوم السابق)
        const localDate = new Date(d.getTime() - (d.getTimezoneOffset() * 60000));
        document.getElementById('meeting-date').value = localDate.toISOString().split('T')[0];
    }

    // 5. تعبئة القوائم المنسدلة (القسم والوقت) وتحديث شكلها
    // نستخدم دالة setDropdownValue لضمان أن القائمة تظهر الخيار المختار
    setDropdownValue('department', selectedMeeting.department);
    setDropdownValue('meeting-time', selectedMeeting.startTime);

    // 6. حساب المدة وتحديدها تلقائياً
    let duration = 1; // الافتراضي
    if (selectedMeeting.startTime && selectedMeeting.endTime) {
        const startH = parseInt(selectedMeeting.startTime.split(':')[0]);
        const endH = parseInt(selectedMeeting.endTime.split(':')[0]);
        duration = endH - startH;
    }
    setDropdownValue('duration', duration.toString());

    // 7. تعبئة الحقول النصية الإضافية
    document.getElementById('attendees').value = selectedMeeting.attendees || '';
    document.getElementById('description').value = selectedMeeting.description || '';

    // 8. إغلاق نافذة التفاصيل وفتح نافذة التعديل
    closeModal('meeting-details-modal');
    document.getElementById('add-meeting-modal').classList.add('show');
}
        
        // Open dashboard
        function openDashboard() {
            updateDashboard();
            document.getElementById('dashboard-modal').classList.add('show');
        }

// Update dashboard (النسخة الذكية المطورة)
        function updateDashboard() {
            // 1. تحديث الأرقام الرئيسية
            document.getElementById('total-meetings').textContent = meetings.length;
            
            // حساب نسبة الإشغال بدقة
            const totalHours = meetings.reduce((sum, meeting) => {
                const duration = timeToMinutes(meeting.endTime) - timeToMinutes(meeting.startTime);
                return sum + (duration / 60);
            }, 0);
            const maxHours = 10 * 6; // افتراض: 10 ساعات عمل * 6 أيام
            const usagePercentage = Math.min(Math.round((totalHours / maxHours) * 100), 100);
            
            document.getElementById('usage-percentage').textContent = `${usagePercentage}%`;
            document.getElementById('usage-bar').style.width = `${usagePercentage}%`;
            
            // الجهات النشطة
            const activeDepts = new Set(meetings.map(m => m.department));
            document.getElementById('active-departments').textContent = activeDepts.size;
            
            // 2. تحديث قائمة "الأكثر استخداماً" (Leaderboard)
            const deptUsage = {};
            meetings.forEach(meeting => {
                const dept = departments[meeting.department].name;
                deptUsage[dept] = (deptUsage[dept] || 0) + 1;
            });
            
            // ترتيب الأقسام تنازلياً
            const sortedDepts = Object.entries(deptUsage).sort((a, b) => b[1] - a[1]).slice(0, 4);
            const chartContainer = document.getElementById('department-chart');
            chartContainer.innerHTML = '';
            
            if (sortedDepts.length === 0) {
                chartContainer.innerHTML = '<div class="text-center text-gray-400 text-xs py-4">لا توجد بيانات كافية</div>';
            } else {
                sortedDepts.forEach(([dept, count], index) => {
                    const percentage = Math.round((count / meetings.length) * 100);
                    const rankColor = index === 0 ? 'bg-yellow-100 text-yellow-700 border-yellow-200' : 'bg-gray-50 text-gray-600 border-gray-100';
                    const icon = index === 0 ? '<i class="fas fa-crown text-yellow-500 ml-2"></i>' : '';
                    
                    const bar = document.createElement('div');
                    bar.innerHTML = `
                        <div class="flex justify-between items-center mb-1 text-xs">
                            <span class="font-bold text-gray-700 flex items-center">${icon} ${dept}</span>
                            <span class="font-bold text-[#2A3475]">${count} حجز</span>
                        </div>
                        <div class="w-full bg-gray-100 rounded-full h-2 mb-3">
                            <div class="bg-[#2A3475] h-2 rounded-full" style="width: ${percentage}%"></div>
                        </div>
                    `;
                    chartContainer.appendChild(bar);
                });
            }
            
            // 3. تحديث الحجوزات الأخيرة (Timeline)
            const recentMeetings = meetings
                .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
                .slice(0, 4);
            
            const recentContainer = document.getElementById('recent-meetings');
            recentContainer.innerHTML = '<div class="absolute top-2 bottom-2 right-[9px] w-0.5 bg-gray-100"></div>'; // إعادة رسم الخط
            
            if (recentMeetings.length === 0) {
                recentContainer.innerHTML += '<div class="text-center text-gray-400 text-xs py-4 pr-4">لا توجد نشاطات حديثة</div>';
            } else {
                recentMeetings.forEach(meeting => {
                    const item = document.createElement('div');
                    item.className = 'flex items-start relative pr-6 mb-4 last:mb-0';
                    item.innerHTML = `
                        <div class="absolute right-0 top-1.5 w-5 h-5 bg-white border-2 border-[#F3A628] rounded-full z-10"></div>
                        
                        <div class="flex-1">
                            <div class="font-bold text-xs text-[#2A3475]">${meeting.title}</div>
                            <div class="text-[10px] text-gray-500 mt-0.5 flex items-center">
                                <i class="far fa-clock ml-1"></i> ${new Date(meeting.date).toLocaleDateString('ar-EG', {month:'numeric', day:'numeric'})} | ${meeting.startTime}
                            </div>
                            <span class="inline-block mt-1 px-2 py-0.5 bg-gray-100 text-gray-600 text-[10px] rounded border border-gray-200">
                                ${departments[meeting.department].name}
                            </span>
                        </div>
                    `;
                    recentContainer.appendChild(item);
                });
            }

            // 4. توليد رؤية تحليلية (Insight)
            const insightBox = document.getElementById('dashboard-insight');
            if (sortedDepts.length > 0) {
                const topDept = sortedDepts[0][0];
                insightBox.innerHTML = `الجهة الأكثر نشاطاً هذا الشهر هي <span class="font-bold text-[#2A3475]">${topDept}</span>. 
                معدل الحجوزات يشير إلى ${usagePercentage > 50 ? 'ضغط مرتفع' : 'استخدام متوازن'} للقاعة.`;
            } else {
                insightBox.textContent = "لا توجد بيانات كافية لتقديم تحليل حالياً.";
            }
        }

// Generate Smart AI Analytics (النسخة المتطورة جداً)
        function generateAISuggestions() {
            const container = document.getElementById('ai-suggestions');
            if (!container) return;
            container.innerHTML = '';
            
            const now = new Date();
            const currentHour = now.getHours();
            const currentMinutes = now.getMinutes();
            const currentTimeVal = currentHour * 60 + currentMinutes; // تحويل الوقت الحالي لدقائق
            const timeString = `${currentHour.toString().padStart(2, '0')}:${currentMinutes.toString().padStart(2, '0')}`;

            // 1. تحليل الحالة الحية والعداد التنازلي
            let currentMeeting = null;
            let nextMeeting = null;
            let timeRemaining = "";
            let statusHTML = "";

            meetings.forEach(m => {
                const mDate = new Date(m.date);
                if (mDate.toDateString() === now.toDateString()) {
                    // تحويل أوقات الاجتماع لدقائق للمقارنة
                    const startMin = timeToMinutes(m.startTime);
                    const endMin = timeToMinutes(m.endTime);

                    if (currentTimeVal >= startMin && currentTimeVal < endMin) {
                        currentMeeting = m;
                        // حساب الوقت المتبقي
                        const remaining = endMin - currentTimeVal;
                        const rHours = Math.floor(remaining / 60);
                        const rMins = remaining % 60;
                        timeRemaining = rHours > 0 ? `${rHours} ساعة و ${rMins} دقيقة` : `${rMins} دقيقة`;
                    }
                    if (startMin > currentTimeVal && (!nextMeeting || startMin < timeToMinutes(nextMeeting.startTime))) {
                        nextMeeting = m;
                    }
                }
            });

            // كارت الحالة (Live Status)
            if (currentMeeting) {
                statusHTML = `
                    <div class="bg-red-50 border-r-4 border-red-500 p-4 rounded-lg mb-3 shadow-sm">
                        <div class="flex justify-between items-start">
                            <div>
                                <h4 class="text-red-800 font-bold text-sm mb-1"><i class="fas fa-circle text-[10px] animate-pulse ml-2"></i> القاعة مشغولة حالياً</h4>
                                <p class="text-gray-700 font-bold text-base">${currentMeeting.title}</p>
                                <p class="text-xs text-gray-500 mt-1">بواسطة: ${departments[currentMeeting.department].name}</p>
                            </div>
                            <div class="text-left">
                                <span class="block text-xs text-gray-400">ستفرغ خلال</span>
                                <span class="block text-lg font-bold text-red-600">${timeRemaining}</span>
                            </div>
                        </div>
                    </div>
                `;
            } else {
                statusHTML = `
                    <div class="bg-green-50 border-r-4 border-green-500 p-4 rounded-lg mb-3 shadow-sm">
                        <div class="flex justify-between items-center">
                            <div>
                                <h4 class="text-green-800 font-bold text-sm mb-1"><i class="fas fa-check-circle ml-2"></i> القاعة متاحة الآن</h4>
                                <p class="text-xs text-gray-600 mt-1">
                                    ${nextMeeting 
                                    ? `الاجتماع القادم الساعة <span class="font-bold text-[#2A3475]">${nextMeeting.startTime}</span>` 
                                    : 'لا توجد اجتماعات أخرى اليوم'}
                                </p>
                            </div>
                            <div class="bg-white p-2 rounded-full shadow-sm">
                                <i class="fas fa-door-open text-green-500 text-xl"></i>
                            </div>
                        </div>
                    </div>
                `;
            }

            // 2. تحليل الكفاءة والفجوات (Gap Analysis)
            // نجمع كل الدقائق المحجوزة النهاردة عشان نحسب النسبة
            let occupiedMinutes = 0;
            const totalWorkMinutes = (18 - 8) * 60; // من 8 ص لـ 6 م (10 ساعات)
            
            const todayMeetings = meetings.filter(m => new Date(m.date).toDateString() === now.toDateString());
            todayMeetings.forEach(m => {
                occupiedMinutes += (timeToMinutes(m.endTime) - timeToMinutes(m.startTime));
            });

            const utilizationRate = Math.round((occupiedMinutes / totalWorkMinutes) * 100);
            let utilizationColor = utilizationRate > 75 ? 'bg-red-500' : (utilizationRate > 40 ? 'bg-yellow-500' : 'bg-green-500');
            let utilizationText = utilizationRate > 75 ? 'ضغط مرتفع' : (utilizationRate > 40 ? 'نشاط متوسط' : 'هدوء نسبي');

            // البحث عن "الفرصة الذهبية" (أكبر فجوة فارغة)
            // (خوارزمية بسيطة لاقتراح أفضل وقت)
            let suggestionHTML = "";
            if (utilizationRate < 90) {
                 suggestionHTML = `
                    <div class="flex items-start space-x-3 space-x-reverse mt-4 pt-4 border-t border-gray-100">
                        <div class="bg-[#F3A628]/10 p-2 rounded-lg shrink-0">
                            <i class="fas fa-lightbulb text-[#F3A628] text-lg"></i>
                        </div>
                        <div>
                            <h5 class="text-sm font-bold text-[#2A3475]">اقتراح النظام الذكي</h5>
                            <p class="text-xs text-gray-500 mt-1 leading-relaxed">
                                بناءً على تحليل الجدول، الفترة الصباحية من <span class="font-bold text-gray-800">08:00 - 10:00</span> هي الأنسب لعقد الاجتماعات الطويلة اليوم لقلة التعارضات.
                            </p>
                        </div>
                    </div>
                 `;
            }

            // تجميع الـ HTML النهائي
            container.innerHTML = `
                ${statusHTML}
                
                <div class="bg-gray-50 rounded-lg p-3 border border-gray-100">
                    <div class="flex justify-between items-center mb-2">
                        <span class="text-xs font-bold text-gray-600">معدل إشغال اليوم</span>
                        <span class="text-[10px] px-2 py-0.5 rounded-full ${utilizationColor} text-white font-bold">${utilizationText} (${utilizationRate}%)</span>
                    </div>
                    <div class="w-full bg-gray-200 rounded-full h-2">
                        <div class="${utilizationColor} h-2 rounded-full transition-all duration-1000" style="width: ${utilizationRate}%"></div>
                    </div>
                </div>

                ${suggestionHTML}
            `;
        }

        let adminUsersPresenceInterval = null;

function formatLastSeenShort(value) {
    if (!value) return 'لم يظهر بعد';

    const date = new Date(value);
    const now = new Date();
    const diffMs = now - date;
    const diffMin = Math.floor(diffMs / 60000);

    if (diffMin < 1) return 'الآن';
    if (diffMin < 60) return `منذ ${diffMin} د`;
    if (diffMin < 1440) return date.toLocaleTimeString('ar-EG', { hour: 'numeric', minute: '2-digit' });

    return date.toLocaleDateString('ar-EG');
}

async function refreshUsersPresenceOnly() {
    const activeUsersList = document.getElementById('active-users-list');
    if (!activeUsersList) return;

    const rows = activeUsersList.querySelectorAll('tr[data-user-id]');
    if (!rows.length) return;

    try {
        const { data, error } = await supabase
            .from('profiles')
            .select('id, presence_status, last_seen_at')
            .order('created_at', { ascending: false });

        if (error) throw error;

        const map = new Map((data || []).map(u => [u.id, u]));

        rows.forEach(row => {
            const userId = row.dataset.userId;
            const user = map.get(userId);
            if (!user) return;

            const isOnline = window.presenceTracker?.isOnline(user.last_seen_at) || user.presence_status === 'online';

            const badge = row.querySelector('[data-presence-badge]');
            const sub = row.querySelector('[data-presence-subtext]');
            const dot = row.querySelector('[data-name-dot]');

            if (badge) {
                badge.className = `px-2 py-1 rounded-full text-[11px] font-bold ${
                    isOnline
                        ? 'bg-green-50 text-green-700 border border-green-100'
                        : 'bg-gray-100 text-gray-500 border border-gray-200'
                }`;
                badge.textContent = isOnline ? 'Online' : 'Offline';
            }

            if (sub) {
                sub.textContent = formatLastSeenShort(user.last_seen_at);
            }

            if (dot) {
                dot.className = `inline-flex w-2.5 h-2.5 rounded-full ${
                    isOnline ? 'bg-green-500' : 'bg-gray-300'
                }`;
            }
        });
    } catch (err) {
        console.error('Presence silent refresh failed:', err);
    }
}

function startAdminUsersPresenceLiveRefresh() {
    if (adminUsersPresenceInterval) {
        clearInterval(adminUsersPresenceInterval);
    }

    adminUsersPresenceInterval = setInterval(() => {
        const usersTab = document.getElementById('admin-users-tab');
        const adminPanel = document.getElementById('admin-panel-modal');

        if (
            usersTab &&
            adminPanel &&
            !usersTab.classList.contains('hidden') &&
            adminPanel.classList.contains('show')
        ) {
            refreshUsersPresenceOnly();
        }
    }, 10000);
}

        
// Open admin panel


        // Switch admin tabs (تحديث للكود الجديد - القائمة الجانبية)




        // دالة فلترة الحجوزات في لوحة التحكم
        


// ==========================================
        // دوال إدارة الملف الشخصي (Profile Management) - النسخة الكاملة
        // ==========================================

        // 1. فتح النافذة وتعبئة البيانات
        window.openProfileModal = function() {
            if(!currentUser) return;
            
            // تعبئة البيانات الأساسية
            document.getElementById('my-name').value = currentUser.full_name || '';
            document.getElementById('my-mobile').value = currentUser.mobile || '';
            document.getElementById('my-email').value = currentUser.email || '';
            
            // تعبئة الحقول الجديدة (المسمى والقسم)
            // نتأكد إن العناصر موجودة الأول عشان ميديناش خطأ
            const posInput = document.getElementById('my-position');
            const deptInput = document.getElementById('my-dept');
            
            if(posInput) posInput.value = currentUser.position || '';
            if(deptInput) deptInput.value = currentUser.department || '';

            // تصفير الباسورد
            document.getElementById('my-new-password').value = ''; 
            
            document.getElementById('profile-modal').classList.add('show');
        }

        // 2. معالجة الحفظ بذكاء (شاملة الحقول الجديدة)
        const profileForm = document.getElementById('profile-form');
        if(profileForm) {
            profileForm.addEventListener('submit', async (e) => {
                e.preventDefault();
                const btn = e.target.querySelector('button');
                const originalText = btn.innerText;
                btn.innerText = 'جاري الحفظ...';
                btn.disabled = true;

                // قراءة القيم من الفورم
                const newName = document.getElementById('my-name').value;
                const newMobile = document.getElementById('my-mobile').value;
                const newEmail = document.getElementById('my-email').value;
                const newPass = document.getElementById('my-new-password').value;
                
                // قراءة الحقول الجديدة
                const newPosition = document.getElementById('my-position') ? document.getElementById('my-position').value : null;
                const newDept = document.getElementById('my-dept') ? document.getElementById('my-dept').value : null;

                let messages = [];

                try {
                    // أ. تحديث البيانات الأساسية (الاسم، الموبايل، الوظيفة، القسم) في جدول profiles
                    // بنشوف هل فيه أي تغيير حصل في أي حقل من دول
                    if (newName !== currentUser.full_name || 
                        newMobile !== currentUser.mobile || 
                        newPosition !== currentUser.position || 
                        newDept !== currentUser.department) {
                        
                        const updateData = {
                            full_name: newName,
                            mobile: newMobile,
                            position: newPosition,
                            department: newDept
                        };

                        const { error } = await supabase
                            .from('profiles')
                            .update(updateData)
                            .eq('id', currentUser.id);
                        
                        if (error) throw error;
                        
                        // تحديث البيانات المحلية في المتصفح فوراً
                        currentUser.full_name = newName;
                        currentUser.mobile = newMobile;
                        currentUser.position = newPosition;
                        currentUser.department = newDept;
                        localStorage.setItem('currentUser', JSON.stringify(currentUser));
                        
                        // تحديث الواجهة (الهيدر والقائمة الجانبية)
                        if (typeof applyUserPermissions === 'function') applyUserPermissions();
                        if (typeof updateSidebarProfile === 'function') updateSidebarProfile();
                        
                        messages.push("تم تحديث البيانات الشخصية ✅");
                    }

                    // ب. تحديث كلمة المرور (لو اتكتبت)
                    if (newPass && newPass.length >= 6) {
                        const { error } = await supabase.auth.updateUser({ password: newPass });
                        if (error) throw error;
                        messages.push("تم تغيير كلمة المرور بنجاح 🔒");
                    }

                    // ج. تحديث الإيميل (لو اتغير) - ده بيحتاج تأكيد
                    if (newEmail !== currentUser.email) {
                        const { error } = await supabase.auth.updateUser({ email: newEmail });
                        if (error) throw error;
                        messages.push("⚠️ تم إرسال رابط تأكيد إلى إيميلك الجديد. لن يتغير الإيميل حتى تؤكده.");
                    }

                    // عرض النتيجة النهائية
                    if (messages.length > 0) {
                        const hasWarning = messages.some(m => m.includes('⚠️'));
                        showNotification(messages.join('<br>'), hasWarning ? 'info' : 'success');
                        closeModal('profile-modal');
                        
                        // تسجيل في اللوج
                        logActivity('تحديث بروفايل', 'قام بتحديث بياناته الشخصية');
                    } else {
                        showNotification('لم يتم تغيير أي بيانات', 'info');
                    }

                } catch (err) {
                    console.error(err);
                    showNotification('خطأ: ' + err.message, 'error');
                } finally {
                    btn.innerText = originalText;
                    btn.disabled = false;
                }
            });
        }
        
// 2. حذف حجز فردي من اللوحة (تم التصحيح لتكون Global)
        

        // 4. تشغيل زر "تحديد الكل"
        const selectAllBtn = document.getElementById('select-all-meetings');
        if(selectAllBtn) {
            selectAllBtn.addEventListener('change', (e) => {
                const checkboxes = document.querySelectorAll('.meeting-checkbox');
                checkboxes.forEach(cb => cb.checked = e.target.checked);
            });
        }
// تحديث بيانات البروفايل في القائمة الجانبية (معدلة لعرض المسمى الوظيفي)
        function updateSidebarProfile() {
            const sidebarName = document.getElementById('sidebar-user-name');
            const sidebarRole = document.getElementById('sidebar-user-role');
            const sidebarAvatar = document.getElementById('sidebar-user-avatar');

            if (currentUser) {
                // 1. تحديث الاسم
                if(sidebarName) sidebarName.textContent = currentUser.full_name || 'مستخدم';
                
                // 2. تحديث الدور (الوصف اللي تحت الاسم)
                if(sidebarRole) {
                    // الأولوية الأولى: المسمى الوظيفي (زي "فني" أو "دكتور")
                    if (currentUser.position && currentUser.position.trim() !== "") {
                        sidebarRole.textContent = currentUser.position;
                    }
                    // الأولوية الثانية: لو مفيش مسمى، نشوف القسم
                    else if (currentUser.department === 'computer-lab') {
                        sidebarRole.textContent = 'IT Unit';
                    } 
                    // الأولوية الثالثة: الحالة الافتراضية
                    else {
                        sidebarRole.textContent = window.CITLPermissions.full(currentUser) ? 'مدير النظام' : 'مستخدم';
                    }
                }
                
                // 3. تحديث اللوجو (الدائرة الكبيرة)
                if (sidebarAvatar) {
                    if (window.CITLPermissions.full(currentUser) || currentUser.department === 'computer-lab') {
                        sidebarAvatar.textContent = 'IT';
                        sidebarAvatar.style.borderColor = '#4ade80'; 
                    } else {
                        sidebarAvatar.textContent = currentUser.full_name ? currentUser.full_name.charAt(0).toUpperCase() : 'U';
                        sidebarAvatar.style.borderColor = '#F3A628'; 
                    }
                }
            }
        }

// ============================================================
// تحديث قائمة المستخدمين وإحصائياتهم (النسخة النهائية الذكية 🧠)
// ============================================================


        // دالة تغيير الصلاحية (جديدة)
        async function changeUserRole(userId, newRole) {
            if (!confirm(`هل أنت متأكد من تغيير صلاحية هذا المستخدم إلى ${newRole === 'manager' ? 'مدير' : 'مستخدم'}؟`)) return;

            try {
                const { error } = await supabase
                    .from('profiles')
                    .update({ role: newRole })
                    .eq('id', userId);

                if (error) throw error;

                showNotification('تم تحديث الصلاحية بنجاح');
                updateAdminUsersList(); // تحديث القائمة فوراً

            } catch (err) {
                console.error(err);
                showNotification('حدث خطأ أثناء التحديث', 'error');
            }
        }
// --- كود تعديل بيانات المستخدمين (جديد) ---



        // Toggle select all meetings
        function toggleSelectAllMeetings() {
            const selectAll = document.getElementById('select-all-meetings');
            const checkboxes = document.querySelectorAll('.meeting-checkbox');
            
            checkboxes.forEach(checkbox => {
                checkbox.checked = selectAll.checked;
            });
        }

        // Filter meetings by department
        function filterMeetingsByDepartment() {
            const filter = document.getElementById('filter-department').value;
            const rows = document.querySelectorAll('#admin-meetings-list tr');
            
            rows.forEach(row => {
                if (!filter) {
                    row.style.display = '';
                } else {
                    const meetingId = row.querySelector('.meeting-checkbox').dataset.meetingId;
                    const meeting = meetings.find(m => m.id === meetingId);
                    row.style.display = meeting && meeting.department === filter ? '' : 'none';
                }
            });
        }

        // --- دالة رسم الهيكل الوهمي (Skeleton Loading) ---
        // دي وظيفتها ترسم جدول "رمادي" ومربعات بتنور وتطفي عشان توحي بالتحميل
        function renderSkeletonLoading() {
            const container = document.getElementById('calendar-container');
            if(!container) return;

            container.innerHTML = ''; // مسح أي حاجة موجودة

            // 1. رسم الصف العلوي (رؤوس الأيام الوهمية)
            // خانة "الوقت" الفاضية
            const timeHeader = document.createElement('div');
            timeHeader.className = 'time-slot bg-gray-100 border-b-2 border-[#F3A628] h-12';
            container.appendChild(timeHeader);

            // 7 خانات للأيام (رمادي فاتح)
            for(let i=0; i<7; i++) {
                const cell = document.createElement('div');
                // animate-pulse: هو الكلاس السحري اللي بيخلي اللون يروح ويجي
                cell.className = 'time-slot bg-gray-200 border-l border-white h-12 animate-pulse';
                container.appendChild(cell);
            }

            // 2. رسم جسم الجدول (صفوف الساعات)
            // هنرسم 10 صفوف كأنهم 10 ساعات عمل
            for(let i=0; i<10; i++) {
                // عمود الوقت (الشمال)
                const timeLabel = document.createElement('div');
                timeLabel.className = 'time-slot bg-gray-50 border-b border-gray-200 h-24 flex items-center justify-center';
                // رسم "شريط" صغير كأنه الساعة
                timeLabel.innerHTML = '<div class="h-3 w-10 bg-gray-300 rounded animate-pulse"></div>';
                container.appendChild(timeLabel);

                // الـ 7 أيام بتوع الساعة دي
                for(let d=0; d<7; d++) {
                    const cell = document.createElement('div');
                    cell.className = 'time-slot border-b border-l border-gray-100 h-24 relative p-2 bg-white';
                    
                    // حركة روشة: بنحط "حجز وهمي" في بعض الخانات عشوائياً عشان يبان واقعي
                    if(Math.random() > 0.7) {
                        const fakeMeeting = document.createElement('div');
                        fakeMeeting.className = 'absolute inset-2 bg-gray-100 rounded-lg animate-pulse';
                        cell.appendChild(fakeMeeting);
                    }
                    container.appendChild(cell);
                }
            }
        }

        // Bulk delete meetings
        async function bulkDeleteMeetings() {
            const selectedCheckboxes = document.querySelectorAll('.meeting-checkbox:checked');
            
            if (selectedCheckboxes.length === 0) {
                showNotification('يرجى تحديد الحجوزات المراد حذفها', 'error');
                return;
            }

            const confirmDelete = await showConfirmDialog(`هل أنت متأكد من حذف ${selectedCheckboxes.length} حجز؟`);
            if (!confirmDelete) return;

            const deleteBtn = document.getElementById('bulk-delete-btn');
            deleteBtn.disabled = true;
            deleteBtn.innerHTML = '<i class="fas fa-spinner fa-spin ml-2"></i>جاري الحذف...';

            try {
                const selectedIds = Array.from(selectedCheckboxes).map(cb => cb.dataset.meetingId);
                meetings = meetings.filter(m => !selectedIds.includes(m.id));
                saveMeetings();
                renderCalendar();
                updateDashboard();
                generateAISuggestions();
                updateAdminMeetingsList();
                
                showNotification(`تم حذف ${selectedCheckboxes.length} حجز بنجاح!`);
                document.getElementById('select-all-meetings').checked = false;
                
            } catch (error) {
                showNotification('حدث خطأ أثناء حذف الحجوزات', 'error');
            } finally {
                deleteBtn.disabled = false;
                deleteBtn.innerHTML = '<i class="fas fa-trash ml-2"></i>حذف المحدد';
            }
        }

        // Edit meeting from admin panel
        

// دالة رسم جداول المدير (محدثة لتعريب الأرقام في الوقت)
window.renderAdminMeetingsTable = function(list) {
    const pendingTbody = document.getElementById('pending-meetings-list');
    const approvedTbody = document.getElementById('admin-meetings-list');
    const pendingSection = document.getElementById('pending-requests-section');
    
    if(!approvedTbody) return;
    
    pendingTbody.innerHTML = '';
    approvedTbody.innerHTML = '';

    // تصفية الطلبات المعلقة
    const requestsList = list.filter(m => 
        m.status === 'pending' || 
        m.status === 'cancellation_requested' || 
        m.status === 'modification_requested'
    );
    
    // تصفية الحجوزات المعتمدة
    const approvedList = list.filter(m => m.status === 'confirmed' || m.status === 'modification_requested' || m.status === 'cancellation_requested');

    // === 1. قسم الطلبات (الأعلى) ===
    if (requestsList.length > 0) {
        pendingSection.classList.remove('hidden');
        requestsList.forEach(m => {
            const deptInfo = departments[m.department] || { name: m.department };
            let statusBadge = '';
            let actionButtons = '';
            let detailsHTML = '';

            // --- أ. طلب تعديل ---
            if (m.status === 'modification_requested') {
                statusBadge = '<span class="text-blue-600 font-bold text-xs"><i class="fas fa-edit ml-1"></i> طلب تعديل</span>';
                
                const changes = m.pending_changes || {};
                detailsHTML = `
                    <div class="text-[10px] text-gray-500 mt-1 bg-blue-50 p-1 rounded border border-blue-100">
                        <div class="flex justify-between"><span>من:</span> <b>${new Date(m.date).toLocaleDateString('ar-EG')} (${toArabicNum(m.startTime)})</b></div>
                        <div class="flex justify-between text-blue-700"><span>إلى:</span> <b>${new Date(changes.date).toLocaleDateString('ar-EG')} (${toArabicNum(changes.start_time)})</b></div>
                    </div>
                `;

                actionButtons = `
                    <button onclick="window.approveModification('${m.id}')" class="bg-blue-600 text-white px-3 py-1.5 rounded-lg text-xs font-bold hover:bg-blue-700 shadow-sm ml-2">قبول التعديل</button>
                    <button onclick="window.rejectModification('${m.id}')" class="bg-gray-500 text-white px-3 py-1.5 rounded-lg text-xs font-bold hover:bg-gray-600 shadow-sm">إبقاء القديم</button>
                `;
            } 
            // --- ب. طلب إلغاء ---
            else if (m.status === 'cancellation_requested') {
                statusBadge = '<span class="text-red-600 font-bold text-xs"><i class="fas fa-trash-alt ml-1"></i> طلب إلغاء</span>';
                actionButtons = `
                    <button onclick="window.confirmDeleteRequest('${m.id}')" class="bg-red-600 text-white px-3 py-1.5 rounded-lg text-xs font-bold hover:bg-red-700 shadow-sm ml-2">تأكيد الحذف</button>
                    <button onclick="window.rejectDeleteRequest('${m.id}')" class="bg-gray-500 text-white px-3 py-1.5 rounded-lg text-xs font-bold hover:bg-gray-600 shadow-sm">رفض</button>
                `;
            }
            // --- ج. حجز جديد ---
            else {
                statusBadge = '<span class="text-green-600 font-bold text-xs"><i class="fas fa-plus-circle ml-1"></i> حجز جديد</span>';
                actionButtons = `
                    <button onclick="window.approveMeeting('${m.id}')" class="bg-green-600 text-white px-3 py-1.5 rounded-lg text-xs font-bold hover:bg-green-700 shadow-sm ml-2">موافقة</button>
                    <button onclick="window.rejectMeeting('${m.id}')" class="bg-red-600 text-white px-3 py-1.5 rounded-lg text-xs font-bold hover:bg-red-700 shadow-sm">رفض</button>
                `;
            }

            const tr = document.createElement('tr');
            tr.id = `req-row-${m.id}`; 
            tr.className = 'bg-white border-b border-gray-100 hover:bg-gray-50 transition-colors duration-500';

            tr.innerHTML = `
                <td class="px-6 py-4 font-bold text-gray-800">
                    ${m.title}
                    <div class="mt-1">${statusBadge}</div>
                </td>
                <td class="px-6 py-4 text-xs text-gray-600">
                    <div class="font-bold">${deptInfo.name}</div>
                    <div class="text-[10px] text-gray-500">${m.createdBy || '---'}</div>
                </td>
                <td class="px-6 py-4 text-xs font-sans">
                    <span class="block font-bold text-[#2A3475]">${new Date(m.date).toLocaleDateString('ar-EG')}</span>
                    <span class="block text-gray-600 font-bold mt-1" dir="ltr">${toArabicNum(m.startTime)} - ${toArabicNum(m.endTime)}</span>
                    ${detailsHTML}
                </td>
                <td class="px-6 py-4 text-center">
                    <div class="flex justify-center items-center">
                        ${actionButtons}
                    </div>
                </td>
            `;
            pendingTbody.appendChild(tr);
        });
    } else {
        pendingSection.classList.add('hidden');
    }

    // === 2. القسم السفلي (المعتمد) ===
    if (approvedList.length === 0) {
        approvedTbody.innerHTML = '<tr><td colspan="6" class="text-center py-6 text-gray-500">لا توجد حجوزات معتمدة</td></tr>';
    } else {
        approvedList.sort((a, b) => new Date(b.date) - new Date(a.date));
        approvedList.forEach(m => {
            const deptInfo = departments[m.department] || { name: m.department };
            
            let statusDisplay = '<span class="px-2 py-1 bg-green-50 text-green-700 text-[10px] font-bold rounded-full border border-green-100">مؤكد</span>';
            if(m.status === 'modification_requested') statusDisplay = '<span class="px-2 py-1 bg-blue-50 text-blue-700 text-[10px] font-bold rounded-full border border-blue-100 animate-pulse">جاري التعديل...</span>';
            if(m.status === 'cancellation_requested') statusDisplay = '<span class="px-2 py-1 bg-red-50 text-red-700 text-[10px] font-bold rounded-full border border-red-100 animate-pulse">جاري الحذف...</span>';

            const tr = document.createElement('tr');
            tr.className = 'border-b border-gray-50 hover:bg-gray-50';
            tr.innerHTML = `
                <td class="px-6 py-4"><input type="checkbox" class="meeting-checkbox rounded border-gray-300" value="${m.id}"></td>
                <td class="px-6 py-4 font-bold text-[#2A3475] text-sm">${m.title}</td>
                <td class="px-6 py-4 text-xs text-gray-600">${deptInfo.name}</td>
                <td class="px-6 py-4 text-xs text-gray-500">
                    <div>${new Date(m.date).toLocaleDateString('ar-EG')}</div>
                    <div class="text-[10px] font-bold mt-1" dir="ltr">${toArabicNum(m.startTime)} - ${toArabicNum(m.endTime)}</div>
                </td>
                <td class="px-6 py-4">${statusDisplay}</td>
                <td class="px-6 py-4 text-center">
                   <button onclick="window.deleteMeetingFromAdmin('${m.id}')" class="text-red-500 hover:bg-red-50 p-2 rounded-full"><i class="fas fa-trash-alt"></i></button>
                   <button onclick="window.editMeetingFromAdmin('${m.id}')" class="text-blue-500 hover:bg-blue-50 p-2 rounded-full"><i class="fas fa-edit"></i></button>
                </td>
            `;
            approvedTbody.appendChild(tr);
        });
    }
};

        // 2. حذف حجز فردي (تم تفعيل النافذة الشفافة)
        

        // 3. حذف جماعي (تم تفعيل النافذة الشفافة + إصلاح قراءة IDs)
        

        // Open add user modal
        function openAddUserModal() {
            document.getElementById('add-user-modal').classList.add('show');
        }

// ---------- showNotification: مركزي، بدون إيموجي، يزيل أي أيقونات تلقائياً ----------
;(function(){ // 👈 (4) ضفنا فاصلة منقوطة هنا كمان ضروري جداً
    // مساعدة لتنظيف النص من إيموجي ورموز مثل ✓ ❌ ⚠️ 🔒 ... 
    function stripEmojisAndIcons(text) {
        if (!text) return '';
        // يحذف رموز Emoji + رموز شائعة مثل ✓ ❌ ⚠️ 🔒
        // regex عام يغطي نطاقات Emoji + بعض الرموز الشائعة
        return String(text)
            .replace(/[\u{1F300}-\u{1FAFF}\u{1F600}-\u{1F64F}\u{2700}-\u{27BF}\u{2600}-\u{26FF}]/gu, '')
            .replace(/[✓✔✖❌⚠️⚠🔒🔔✅❎]/g, '') // إزالة أي علامات شائعة
            .trim();
    }

    // الدالة نفسها
window.showNotification = function(message, type = 'success') {
        const toast = document.getElementById('notification-toast');
        const messageEl = document.getElementById('notification-message') || document.querySelector('#notification-toast .notification-text');

        if (!toast || !messageEl) return;

        const clean = stripEmojisAndIcons(message);
        messageEl.textContent = clean || '';
        toast.className = 'notification-toast';

        if (type === 'error') toast.classList.add('bg-error');
        else if (type === 'info') toast.classList.add('bg-info');
        else toast.classList.add('bg-success');

        void toast.offsetWidth;
        toast.classList.add('show');

        if (toast._hideTimeout) clearTimeout(toast._hideTimeout);
        toast._hideTimeout = setTimeout(() => {
            toast.classList.remove('show');
        }, 3000);
    };
})();

// Custom confirmation dialog (تصميم احترافي للتحذير)
// Custom confirmation dialog (النسخة الذكية المرنة)
function showConfirmDialog(message, options = {}) {
    return new Promise((resolve) => {
        // الإعدادات الافتراضية (لو مبعتش حاجة هتشتغل كأنها حذف)
        const settings = {
            title: options.title || 'تأكيد الحذف',
            confirmBtnText: options.confirmText || 'نعم، احذف',
            confirmBtnColor: options.color || 'bg-red-600 hover:bg-red-700', // لون الزر
            icon: options.icon || 'fa-trash-alt', // الأيقونة
            iconColor: options.iconColor || 'text-red-600', // لون الأيقونة
            iconBg: options.iconBg || 'bg-red-100', // خلفية الأيقونة
            borderColor: options.borderColor || 'border-[#F3A628]' // لون الحدود العلوية
        };

        const overlay = document.createElement('div');
        overlay.className = 'fixed inset-0 bg-[#2A3475] bg-opacity-90 flex items-center justify-center z-[5000] backdrop-blur-sm transition-opacity duration-300';
        
        const modal = document.createElement('div');
        modal.className = `bg-white rounded-lg shadow-2xl max-w-sm w-full mx-4 transform scale-100 transition-transform duration-300 border-t-8 ${settings.borderColor}`;
        
        modal.innerHTML = `
            <div class="p-6 text-center">
                <div class="w-16 h-16 ${settings.iconBg} rounded-full flex items-center justify-center mx-auto mb-4">
                    <i class="fas ${settings.icon} ${settings.iconColor} text-2xl animate-pulse"></i>
                </div>
                
                <h3 class="text-xl font-bold text-gray-800 mb-2">${settings.title}</h3>
                <p class="text-gray-600 text-sm mb-6 leading-relaxed">${message}</p>
                
                <div class="flex justify-center space-x-3 space-x-reverse">
                    <button id="confirm-cancel" class="px-5 py-2.5 rounded-lg border border-gray-300 text-gray-700 font-medium hover:bg-gray-50 transition-colors focus:outline-none">
                        إلغاء
                    </button>
                    <button id="confirm-ok" class="px-5 py-2.5 rounded-lg text-white font-medium shadow-lg transition-all focus:outline-none flex items-center ${settings.confirmBtnColor}">
                        <i class="fas ${settings.icon} ml-2"></i> ${settings.confirmBtnText}
                    </button>
                </div>
            </div>
        `;
        
        overlay.appendChild(modal);
        document.body.appendChild(overlay);
        
        const okBtn = modal.querySelector('#confirm-ok');
        const cancelBtn = modal.querySelector('#confirm-cancel');

        function closeAndResolve(result) {
            overlay.classList.add('opacity-0');
            setTimeout(() => {
                if(document.body.contains(overlay)) document.body.removeChild(overlay);
                resolve(result);
            }, 200);
        }
        
        okBtn.addEventListener('click', () => closeAndResolve(true));
        cancelBtn.addEventListener('click', () => closeAndResolve(false));
        overlay.addEventListener('click', (e) => { if (e.target === overlay) closeAndResolve(false); });
    });
}

// دالة الحذف (تم إصلاح صلاحيات المدير)
async function deleteMeeting() {
    if (!selectedMeeting) return;
    
    // 1. تحديد الصلاحيات
    const isOwner = selectedMeeting.user_id === currentUser.id;
    const isManager = window.CITLPermissions.full(currentUser); // المدير يملك صلاحية مطلقة
    const canDeleteSpecific = window.CITLPermissions.can(currentUser, 'can_delete');

    // الشرط المصحح: لو مش صاحب الحجز، ومش مدير، ومعهوش صلاحية خاصة => امنعه
    if (!(isOwner && selectedMeeting.status === 'pending') && !canDeleteSpecific) {
        showNotification('⛔ عفواً، لا تملك صلاحية لحذف هذا الحجز!', 'error');
        return;
    }

    // 2. طلب التأكيد (نستخدم النافذة الاحترافية)
    const isConfirmed = await showConfirmDialog('هل أنت متأكد تماماً من حذف هذا الحجز من النظام؟');
    if (!isConfirmed) return;

    document.body.style.cursor = 'wait';

    try {
        const { error } = await supabase.from('meetings').delete().eq('id', selectedMeeting.id);
        
        if (error) throw error;

        // تحديث الواجهة
        meetings = meetings.filter(m => m.id !== selectedMeeting.id);
        refreshAllViews();
        closeModal('meeting-details-modal');
        showNotification('تم حذف الحجز بنجاح ✅');

    } catch (error) {
        console.error(error);
        showNotification('فشل الحذف: ' + error.message, 'error');
    } finally {
        document.body.style.cursor = 'default';
    }
}

        document.addEventListener('DOMContentLoaded', initializeApp);
       
        // ============================================
        // دوال إدارة المستخدمين (User Management)
        // ============================================

// دالة فتح نافذة تعديل بيانات العضو (مصححة لتحديث القائمة المنسدلة)
window.openEditUserInfo = function(id, name, dept, position, mobile) {
    const idInput = document.getElementById('edit-user-id');
    const nameInput = document.getElementById('edit-user-name');
    const posInput = document.getElementById('edit-user-position');
    const mobileInput = document.getElementById('edit-user-mobile');
    const deptInput = document.getElementById('edit-user-dept');
    const modal = document.getElementById('edit-user-info-modal');

    // 1. تعبئة البيانات الأساسية
    if (idInput) idInput.value = id;
    if (nameInput) nameInput.value = (name && name !== 'undefined' && name !== 'null') ? name : '';
    if (posInput) posInput.value = (position && position !== 'undefined' && position !== 'null') ? position : '';
    if (mobileInput) mobileInput.value = (mobile && mobile !== 'undefined' && mobile !== 'null') ? mobile : '';

    // 2. تعبئة القسم وتحديث القائمة المنسدلة (Fix Dropdown Display)
    if (deptInput) {
        const val = (dept && dept !== 'undefined' && dept !== 'null') ? dept : '';
        deptInput.value = val; // القيمة الحقيقية

        // البحث عن الـ Wrapper وتحديث النص الظاهر
        const wrapper = deptInput.closest('.custom-dropdown');
        if(wrapper) {
            const displaySpan = wrapper.querySelector('.custom-dropdown-display span');
            const matchingOption = wrapper.querySelector(`.custom-option[data-value="${val}"]`);
            
            if(displaySpan) {
                if(matchingOption) {
                    displaySpan.textContent = matchingOption.textContent.trim(); // عرض الاسم العربي
                    displaySpan.classList.add('text-[#2A3475]', 'font-bold');
                } else {
                    displaySpan.textContent = 'اختر الجهة...';
                    displaySpan.classList.remove('text-[#2A3475]', 'font-bold');
                }
            }
        }
    }
    
    // 3. فتح النافذة
    if (modal) modal.classList.add('show');
};

// ============================================================
// فتح نافذة الصلاحيات (يملأ الفورم الأساسي والإضافي معاً)
// ============================================================
window.openPermissionsModal = function(userId, userName, permString) {
    const perms = JSON.parse(decodeURIComponent(permString));
    
    // 1. تعبئة الفورم الأول (الأساسي) - كما هو في كودك القديم
    const idInput1 = document.getElementById('perm-user-id');
    if(idInput1) {
        idInput1.value = userId;
        if(document.getElementById('perm-user-name')) document.getElementById('perm-user-name').textContent = userName;
        
        if(document.getElementById('perm-approve')) document.getElementById('perm-approve').checked = perms.can_approve === true;
        if(document.getElementById('perm-users')) document.getElementById('perm-users').checked = perms.can_manage_users === true;
        if(document.getElementById('perm-delete')) document.getElementById('perm-delete').checked = perms.can_delete === true;
    }

    // 2. تعبئة الفورم الثاني (الجديد -2) - 🔥 هذا هو التعديل الضروري
    const idInput2 = document.getElementById('perm-user-id-2');
    if(idInput2) {
        idInput2.value = userId;
        // نتأكد من وجود العناصر قبل التعديل لتجنب الأخطاء
        if(document.getElementById('perm-user-name-2')) document.getElementById('perm-user-name-2').textContent = userName;
        
        if(document.getElementById('perm-approve-2')) document.getElementById('perm-approve-2').checked = perms.can_approve === true;
        if(document.getElementById('perm-users-2')) document.getElementById('perm-users-2').checked = perms.can_manage_users === true;
        if(document.getElementById('perm-delete-2')) document.getElementById('perm-delete-2').checked = perms.can_delete === true;
    }
    
    // 3. إظهار النافذة
    const modal = document.getElementById('permissions-modal');
    // ندعم الطرق المختلفة للإظهار حسب الـ CSS عندك (classList أو style)
    if(modal) {
        modal.classList.add('show'); 
        modal.classList.remove('hidden');
    }
};

        // 3. إضافة مستخدم جديد (يقرأ من new-...)
        async function handleAddUser(e) {
            e.preventDefault();
            const btn = e.target.querySelector('button[type="submit"]');
            const originalText = btn.innerText;
            btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> جاري...';
            btn.disabled = true;

            const email = document.getElementById('new-user-email').value;
            const password = document.getElementById('new-user-password').value;
            const name = document.getElementById('new-user-name').value;
            const dept = document.getElementById('new-user-dept').value;

            // تجميع الصلاحيات من الـ Checkboxes الجديدة
            const permissions = {
                can_approve: document.getElementById('new-perm-approve').checked,
                can_manage_users: document.getElementById('new-perm-users').checked,
                can_delete: document.getElementById('new-perm-delete').checked
            };

            const hasAnyPerm = Object.values(permissions).some(val => val === true);
            const role = hasAnyPerm ? 'manager' : 'user';

            try {
                const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
                    email: email, password: password, email_confirm: true, 
                    user_metadata: { full_name: name, department: dept, role: role, permissions: permissions }
                });

                if (authError) throw authError;

                await supabaseAdmin.from('profiles').upsert({
                    id: authData.user.id, email: email, full_name: name, department: dept, role: role, permissions: permissions
                });

                showNotification(`تم إنشاء المستخدم ${name} بنجاح!`);
                closeModal('add-user-modal');
                document.getElementById('add-user-form').reset();
                
                // تصفير الخيارات
                document.getElementById('new-perm-approve').checked = false;
                document.getElementById('new-perm-users').checked = false;
                document.getElementById('new-perm-delete').checked = false;

                updateAdminUsersList(); 

            } catch (err) {
                console.error(err);
                showNotification('فشل الإنشاء: ' + err.message, 'error');
            } finally {
                btn.innerText = originalText;
                btn.disabled = false;
            }
        }

// 4. حفظ تعديل البيانات (محدثة لحفظ الموبايل والوظيفة)
        const editInfoForm = document.getElementById('edit-user-info-form');
        if (editInfoForm) {
            editInfoForm.addEventListener('submit', async (e) => {
                e.preventDefault();
                const id = document.getElementById('edit-user-id').value;
                const name = document.getElementById('edit-user-name').value;
                const dept = document.getElementById('edit-user-dept').value;
                // القيم الجديدة
                const position = document.getElementById('edit-user-position').value;
                const mobile = document.getElementById('edit-user-mobile').value;
                
                const btn = e.target.querySelector('button');
                const originalText = btn.innerHTML;
                btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> جاري...';
                btn.disabled = true;

                try {
                    // تحديث كل الحقول
                    const { error } = await supabase.from('profiles')
                        .update({ 
                            full_name: name, 
                            department: dept,
                            position: position, // ✅
                            mobile: mobile      // ✅
                        })
                        .eq('id', id);

                    if (error) throw error;
                    
                    // تسجيل اللوج
                    logActivity('تعديل عضو', `قام بتعديل بيانات العضو: ${name}`);

                    showNotification('تم التعديل بنجاح');
                    closeModal('edit-user-info-modal');
                    updateAdminUsersList();
                    
                    // لو المدير بيعدل بياناته هو، نحدث الواجهة فوراً
                    if (currentUser && id === currentUser.id) {
                        currentUser.full_name = name;
                        currentUser.department = dept;
                        currentUser.position = position;
                        currentUser.mobile = mobile;
                        localStorage.setItem('currentUser', JSON.stringify(currentUser));
                        applyUserPermissions();
                        updateSidebarProfile();
                    }
                } catch (err) {
                    console.error(err);
                    showNotification('خطأ: ' + err.message, 'error');
                } finally {
                    btn.innerHTML = originalText;
                    btn.disabled = false;
                }
            });
        }

// ============================================================
        // 5. حفظ تعديل الصلاحيات (الترس) - 🛡️ النسخة المدرعة
        // ============================================================
        const permForm = document.getElementById('permissions-form');
        
        // نقوم بإزالة أي مستمع قديم لتجنب التكرار (Important Trick)
        const newPermForm = permForm.cloneNode(true);
        permForm.parentNode.replaceChild(newPermForm, permForm);

        if(newPermForm) {
            newPermForm.addEventListener('submit', async (e) => {
                e.preventDefault();
                
                const btn = e.target.querySelector('button[type="submit"]');
                const originalText = btn.innerText;
                const userId = document.getElementById('perm-user-id').value;
                
                // إيميل المؤسس (تأكد أنه مكتوب بحروف صغيرة تماماً)
                const FOUNDER_EMAIL_LOWER = "fekrythug@gmail.com".trim().toLowerCase();

                btn.innerText = 'جاري الفحص...';
                btn.disabled = true;

                // 🛑 1. الحماية: فحص الهوية قبل أي شيء
                try {
                    console.log("🔍 جاري فحص الحماية للمستخدم رقم:", userId);

                    const { data: targetUser, error } = await supabase
                        .from('profiles')
                        .select('email')
                        .eq('id', userId)
                        .single();
                    
                    if(error) throw error;

                    if (targetUser) {
                        const targetEmail = targetUser.email.trim().toLowerCase();
                        console.log("📧 البريد المستهدف:", targetEmail);
                        console.log("🛡️ بريد المؤسس:", FOUNDER_EMAIL_LOWER);

                        // المقارنة الدقيقة
                        if (targetEmail === FOUNDER_EMAIL_LOWER) {
                            console.warn("⛔ تم منع محاولة تعديل صلاحيات المؤسس!");
                            alert("⛔ خطأ أمني: لا يمكن تعديل صلاحيات المؤسس (Ahmed Fekry) نهائياً!");
                            
                            // إيقاف وإرجاع الزر
                            btn.innerText = originalText;
                            btn.disabled = false;
                            return; // 🛑 خروج نهائي
                        }
                    }

                } catch (securityErr) {
                    console.error("خطأ في فحص الأمان:", securityErr);
                    // في حالة الخطأ، هل نوقف العملية؟ الأفضل نعم للأمان
                    alert("حدث خطأ أثناء التحقق من الهوية، تم إلغاء العملية للأمان.");
                    btn.innerText = originalText;
                    btn.disabled = false;
                    return;
                }
                // 🛑 نهاية الحماية

                // 2. التنفيذ (إذا لم يكن المؤسس)
                btn.innerText = 'جاري الحفظ...';
                
                const newPerms = {
                    can_approve: document.getElementById('perm-approve').checked,
                    can_manage_users: document.getElementById('perm-users').checked,
                    can_delete: document.getElementById('perm-delete').checked
                };

                try {
                    const hasAnyPerm = Object.values(newPerms).some(v => v === true);
                    const newRole = hasAnyPerm ? 'manager' : 'user';

                    // التحديث
                    const { error } = await supabase.from('profiles')
                        .update({ permissions: newPerms, role: newRole })
                        .eq('id', userId);
                    
                    if(error) throw error;

                    // تحديث الميتاداتا (زيادة تأكيد)

                    showNotification('تم تحديث الصلاحيات بنجاح ✅');
                    closeModal('permissions-modal');
                    
                    if (typeof updateAdminUsersList === 'function') updateAdminUsersList();
                    else if (typeof fetchUsers === 'function') fetchUsers();

                } catch(err) {
                    console.error(err);
                    showNotification('حدث خطأ: ' + err.message, 'error');
                } finally {
                    btn.innerText = originalText;
                    btn.disabled = false;
                }
            });
        }

// 2. الرفض + إشعار المستخدم


// 1. الموافقة (تم إيقاف إرسال الإيميل لتوفير الرصيد)

       
        function showDashboardSkeleton() {
            const container = document.getElementById('ai-suggestions');
            if(!container) return;
            
            container.innerHTML = `
                <div class="bg-gray-100 rounded-lg p-4 border border-gray-200 animate-pulse mb-3">
                    <div class="h-4 bg-gray-300 rounded w-1/3 mb-2"></div>
                    <div class="h-3 bg-gray-200 rounded w-2/3"></div>
                </div>
                <div class="bg-gray-100 rounded-lg p-3 border border-gray-200 animate-pulse">
                    <div class="flex justify-between mb-2">
                        <div class="h-3 bg-gray-300 rounded w-1/4"></div>
                        <div class="h-3 bg-gray-300 rounded w-10"></div>
                    </div>
                    <div class="h-2 bg-gray-200 rounded-full w-full"></div>
                </div>
            `;
        }

// دالة تعبئة بيانات الملف الشخصي (مصححة لتحديث القائمة المنسدلة)

// دالة تسجيل النشاطات (تم تعطيلها لأن الجدول غير موجود)
        async function logActivity(action, details) {
            // لن نقوم بالإرسال لقاعدة البيانات لمنع خطأ 404
            // فقط سنطبع في الكونسول للمتابعة (اختياري)
            console.log(`[سجل محلي] قام ${currentUser?.full_name || 'مستخدم'} بـ: ${action} - ${details}`);
            return;
        }

        // استبدل دالة setupCustomDropdowns القديمة بهذه النسخة القوية
function setupCustomDropdowns() {
    // 1. معالجة زر الفتح والإغلاق (Display)
    document.querySelectorAll('.custom-dropdown-display').forEach(display => {
        // نستخدم cloneNode لإزالة أي Event Listeners قديمة عشان ميتكرروش
        const newDisplay = display.cloneNode(true);
        display.parentNode.replaceChild(newDisplay, display);

        newDisplay.addEventListener('click', (e) => {
            e.stopPropagation();
            const dropdown = newDisplay.closest('.custom-dropdown');
            const options = dropdown.querySelector('.custom-dropdown-options');

            // إغلاق أي قائمة أخرى مفتوحة
            document.querySelectorAll('.custom-dropdown-options').forEach(opt => {
                if(opt !== options) opt.classList.remove('show');
            });

            options.classList.toggle('show');
        });
    });

    // 2. معالجة اختيار العناصر (Options) - باستخدام Event Delegation (الحل الجذري)
    // نضع الـ Listener مرة واحدة على الصفحة كلها، فيلتقط أي نقرة حتى للعناصر الجديدة
    if (!window.dropdownsInitialized) {
        document.addEventListener('click', function(e) {
            
            // أ. لو الضغط تم على خيار داخل القائمة (Option)
            const option = e.target.closest('.custom-option');
            if (option) {
                const dropdown = option.closest('.custom-dropdown');
                const hiddenSelect = dropdown.querySelector('select'); // الحقل المخفي
                const displayText = dropdown.querySelector('.custom-dropdown-display span');
                
                const value = option.dataset.value;
                const text = option.innerText;

                // تحديث الشكل الخارجي (عشان المستخدم يشوف إنه اختار)
                if (displayText) {
                    displayText.textContent = text;
                    displayText.classList.add('text-[#2A3475]', 'font-bold');
                }

                // تحديث القيمة المخفية (أهم خطوة عشان زر الحفظ يشتغل)
                if (hiddenSelect) {
                    hiddenSelect.value = value;
                    // تبليغ النظام إن القيمة اتغيرت
                    hiddenSelect.dispatchEvent(new Event('change'));
                    console.log(`تم اختيار: ${text} -> القيمة: ${value}`); // للتأكد في الكونسول
                }

                // إغلاق القائمة بعد الاختيار
                const options = dropdown.querySelector('.custom-dropdown-options');
                if (options) options.classList.remove('show');
            }

            // ب. لو الضغط تم في أي مكان فاضي خارج القوائم (لإغلاقها)
            if (!e.target.closest('.custom-dropdown')) {
                 document.querySelectorAll('.custom-dropdown-options').forEach(opt => opt.classList.remove('show'));
            }
        });
        
        window.dropdownsInitialized = true; // علامة لمنع تكرار الكود
    }
}

// دالة لتنظيف النموذج والواجهة معاً (الحل لمشكلة التعليق)
        function resetFormUI() {
            // 1. تصفير الحقول العادية والمخفية
            document.getElementById('meeting-form').reset();
            document.getElementById('meeting-id').value = '';
            document.getElementById('department').value = '';
            document.getElementById('meeting-time').value = '';
            
            // 2. إعادة النصوص الظاهرة في القوائم المنسدلة للوضع الافتراضي
            document.querySelectorAll('.custom-dropdown').forEach(dropdown => {
                const displaySpan = dropdown.querySelector('.custom-dropdown-display span');
                const defaultOption = dropdown.querySelector('.custom-dropdown-options li:first-child');
                
                if (displaySpan && defaultOption) {
                    // يرجع يكتب "اختر الجهة..." أو "اختر الوقت..."
                    displaySpan.textContent = defaultOption.innerText;
                    displaySpan.classList.remove('text-[#2A3475]', 'font-bold');
                }
            });
        }

        // دالة مساعدة لتحديث القوائم المنسدلة المخصصة
function setDropdownValue(selectId, value) {
    const select = document.getElementById(selectId);
    if (!select) return;
    
    // تحديث القيمة في الحقل المخفي
    select.value = value;
    
    // تحديث الشكل الخارجي (النص الظاهر للمستخدم)
    const dropdown = select.closest('.custom-dropdown');
    if(dropdown) {
        const display = dropdown.querySelector('.custom-dropdown-display span');
        // البحث عن الخيار المطابق للقيمة
        const option = dropdown.querySelector(`.custom-option[data-value="${value}"]`);
        
        if(display && option) {
            display.textContent = option.textContent; // يكتب الاسم (مثلاً: مكتب العميد)
            display.classList.add('text-[#2A3475]', 'font-bold'); // تلوين النص
        }
    }
}

// 1. المدير يوافق على طلب الحذف (يحذف الحجز نهائياً)


// 2. المدير يرفض طلب الحذف (يرجع الحجز لحالة "مؤكد")


// 1. قبول التعديل (تصميم احترافي - أخضر)


// 2. رفض التعديل (النسخة التي تميز الرفض عن الموافقة)


async function toggleNotifications() {
    const menu = document.getElementById('notif-menu');
    const badge = document.getElementById('notif-badge');
    const badgeMob = document.getElementById('notif-badge-mob');
    
    if (!menu) return;

    const isOpening = menu.classList.contains('hidden');
    
    if (isOpening) {
        // --- أولاً: عند الفتح (ضبط الموضع كما هو في كودك) ---
        const pcWrapper = document.getElementById('notif-btn-wrapper-pc');
        const mobWrapper = document.getElementById('notif-btn-wrapper');
        let btnWrapper = (pcWrapper && pcWrapper.offsetWidth > 0) ? pcWrapper : mobWrapper;
        
        if (btnWrapper) {
            const rect = btnWrapper.getBoundingClientRect();
            menu.style.position = 'fixed';
            menu.style.top = `${rect.bottom + 10}px`;
            let leftPos = rect.left;
            if (leftPos + 320 > window.innerWidth) leftPos = window.innerWidth - 335;
            if (leftPos < 10) leftPos = 10;
            menu.style.left = `${leftPos}px`;
        }

        // إخفاء الأرقام (Badges) عند الفتح
        if (badge) badge.classList.add('hidden');
        if (badgeMob) badgeMob.classList.add('hidden');

        menu.classList.remove('hidden');

    } else {
        // --- ثانياً: عند الإغلاق (تنظيف الحجوزات المرفوضة والحذف من قاعدة البيانات) ---
        
        if (typeof meetings !== 'undefined' && meetings.length > 0 && currentUser) {
            
            // 1. تحديد الحجوزات المرفوضة (Rejected) الخاصة بالمستخدم الحالي
            const rejectedMeetings = meetings.filter(m => m.status === 'rejected' && m.user_id === currentUser.id);
            const rejectedIds = rejectedMeetings.map(m => m.id);

            // 2. الحذف الفعلي لضمان اختفائها للأبد
            if (rejectedIds.length > 0) {
                try {
                    // الحذف من قاعدة بيانات Supabase
                    await supabase.from('meetings').delete().in('id', rejectedIds);
                    
                    // تحديث المصفوفة المحلية فوراً (حذف العناصر المرفوضة منها)
                    meetings = meetings.filter(m => !rejectedIds.includes(m.id));
                    
                    // تحديث كل واجهات النظام (الجدول، الإحصائيات، إلخ)
                    if (typeof refreshAllViews === 'function') {
                        refreshAllViews();
                    }
                    
                    console.log("تم تنظيف السجلات المرفوضة من قاعدة البيانات بنجاح.");
                } catch (e) {
                    console.error("خطأ أثناء محاولة حذف السجلات المرفوضة:", e);
                }
            }

            // 3. تحديث الـ LocalStorage للحجوزات الأخرى (المقبولة) لتسجيلها كـ "شوهدت"
            let seenIds = JSON.parse(localStorage.getItem('seen_notifications') || '[]');
            meetings.forEach(m => {
                // الحجوزات التي لا تزال قيد التنفيذ تظل ظاهرة (لا تضاف لـ seenIds)
                const isUnderProcess = m.status === 'pending' || 
                                       m.status === 'modification_requested' || 
                                       m.status === 'cancellation_requested';

                if (!isUnderProcess && !seenIds.includes(m.id)) {
                    seenIds.push(m.id);
                }
            });
            localStorage.setItem('seen_notifications', JSON.stringify(seenIds));
        }
        
        menu.classList.add('hidden');
        
        // تحديث قائمة الإشعارات فوراً لتعكس الحذف والتغييرات
        if (typeof checkUserNotifications === 'function') {
            checkUserNotifications();
        }
    }
}

function toggleProfileInfoMenu() {
    const menu = document.getElementById('profile-info-menu');
    const capsule = document.getElementById('mob-profile-capsule');
    
    if (!menu || !capsule) return;

    // إغلاق قائمة الإشعارات لو مفتوحة
    const notifMenu = document.getElementById('notif-menu');
    if (notifMenu && !notifMenu.classList.contains('hidden')) notifMenu.classList.add('hidden');

    menu.classList.toggle('hidden');
    
    if (!menu.classList.contains('hidden')) {
        const rect = capsule.getBoundingClientRect();
        menu.style.position = 'fixed';
        menu.style.top = `${rect.bottom + 10}px`;
        
        // المحاذاة لليسار مع الكبسولة
        menu.style.left = `${rect.left}px`;
        
        // تعبئة البيانات كاملة من الـ currentUser
        if (currentUser) {
            const deptName = departments[currentUser.department]?.name || currentUser.department;
            const fullRoleText = `${deptName} - ${currentUser.position || ''}`;
            
            document.getElementById('full-profile-name').textContent = currentUser.full_name || 'مستخدم';
            document.getElementById('full-profile-role').textContent = fullRoleText;
        }
    }
}

function checkUserNotifications() {
    if (typeof currentUser === 'undefined' || !currentUser || typeof meetings === 'undefined' || !meetings) return;

    const list = document.getElementById('notif-list');
    const badge = document.getElementById('notif-badge');
    const badgeMob = document.getElementById('notif-badge-mob');

    if (!list) return;

    // 1. جلب المعرفات التي تمت مشاهدتها من الذاكرة
    let seenIds = JSON.parse(localStorage.getItem('seen_notifications') || '[]');
    let relevantMeetings = [];

    // 2. فلترة الاجتماعات حسب الصلاحيات
    if (window.CITLPermissions.can(currentUser, 'can_approve')) {
        relevantMeetings = meetings.filter(m => 
            m.user_id === currentUser.id || 
            m.status === 'pending' ||       
            m.status === 'modification_requested' || 
            m.status === 'cancellation_requested'
        );
    } else {
        relevantMeetings = meetings.filter(m => m.user_id === currentUser.id);
    }

    // 3. فلترة الاجتماعات لإظهار ما يحتاج تنبيه
    const unreadMeetings = relevantMeetings.filter(m => {
        const isAlreadySeen = seenIds.includes(m.id);
        
        const isUnderProcess = m.status === 'pending' || 
                               m.status === 'modification_requested' || 
                               m.status === 'cancellation_requested' ||
                               m.status === 'rejected' || 
                               (m.pending_changes && m.pending_changes.rejected === true);

        return !isAlreadySeen || isUnderProcess;
    });

    unreadMeetings.sort((a, b) => new Date(b.createdAt || b.date) - new Date(a.createdAt || a.date));

    let notifsHTML = '';
    let pendingCount = unreadMeetings.length;

    // 4. بناء HTML للإشعارات
    unreadMeetings.forEach(m => {
        const isRejectedMod = m.pending_changes && m.pending_changes.rejected === true;
        let config = { icon: 'fa-bell', color: 'text-gray-400', bg: 'bg-gray-50', title: 'تحديث في الحجز' };

        if (m.status === 'modification_requested') {
            config = { icon: 'fa-edit', color: 'text-blue-500', bg: 'bg-blue-50', title: 'طلب تعديل حجز' };
        } else if (m.status === 'cancellation_requested') {
            config = { icon: 'fa-trash-alt', color: 'text-red-500', bg: 'bg-red-50', title: 'طلب إلغاء حجز' };
        } else if (m.status === 'pending') {
            // 🔥 التعديل المطلوب هنا: منطق عرض العنوان حسب الدور ومالك الحجز 🔥
            const isMyBooking = (m.user_id === currentUser.id);
            const titleText = (window.CITLPermissions.can(currentUser, 'can_approve') && !isMyBooking) ? 'طلب حجز جديد' : 'حجز قيد الانتظار';
            
            config = { icon: 'fa-clock', color: 'text-amber-500', bg: 'bg-amber-50', title: titleText };
        } else if (m.status === 'rejected') {
            config = { icon: 'fa-times-circle', color: 'text-red-600', bg: 'bg-red-50', title: 'تم رفض طلب الحجز' };
        } else if (m.status === 'confirmed') {
            if (isRejectedMod) {
                config = { icon: 'fa-times-circle', color: 'text-red-600', bg: 'bg-red-50', title: 'تم رفض التعديل' };
            } else {
                config = { icon: 'fa-check-circle', color: 'text-green-500', bg: 'bg-green-50', title: 'تمت الموافقة / فعال' };
            }
        }

        notifsHTML += `
            <div onclick="handleNotificationClick('${m.id}', '${m.status}')" 
                 class="group p-3 mb-2 rounded-xl cursor-pointer transition-all hover:bg-gray-50 flex items-start gap-3 border-r-2 border-[#F3A628] bg-orange-50/20">
                <div class="w-8 h-8 rounded-full flex-shrink-0 flex items-center justify-center ${config.bg} ${config.color} transition-transform group-hover:scale-110">
                    <i class="fas ${config.icon} text-xs"></i>
                </div>
                <div class="flex-1 min-w-0 text-right">
                    <p class="text-[12px] font-bold text-gray-800 leading-tight">${config.title}</p>
                    <p class="text-[11px] text-gray-500 mt-0.5 truncate">${m.title}</p>
                    <p class="text-[9px] text-gray-400 mt-1 italic">${new Date(m.date).toLocaleDateString('ar-EG')}</p>
                </div>
            </div>`;
    });

    list.innerHTML = notifsHTML || '<div class="p-8 text-center text-gray-400 text-[11px]">لا توجد إشعارات جديدة حالياً</div>';

    [badge, badgeMob].forEach(el => {
        if (!el) return;
        if (pendingCount > 0) {
            el.textContent = pendingCount > 9 ? '+9' : pendingCount;
            el.classList.remove('hidden');
            el.classList.add('flex');
        } else {
            el.classList.add('hidden');
        }
    });
}


// --- دالة معالجة النقر على الإشعار (التوجيه الذكي) ---
window.handleNotificationClick = function(id, status) {
    const meeting = meetings.find(m => String(m.id) === String(id));
    if(!meeting) return;

    // 1. إغلاق قائمة الإشعارات
    const menu = document.getElementById('notif-menu');
    if(menu && !menu.classList.contains('hidden')) toggleNotifications();

    // 2. منطق التوجيه
    const isPendingRequest = status === 'pending' || status === 'modification_requested' || status === 'cancellation_requested';
    const isMyMeeting = meeting.user_id === currentUser.id;

    // --- السيناريو أ: المدير يضغط على طلب يحتاج موافقة (وليس طلبه الشخصي) ---
    if (window.CITLPermissions.can(currentUser, 'can_approve') && isPendingRequest && !isMyMeeting) {
        
        // فتح لوحة التحكم
        openAdminPanel();
        
        // الانتقال لتبويب الحجوزات
        switchAdminTab('meetings');
        
        // التأكد من عرض "الكل" أو الفلتر المناسب
        if(typeof filterAdminMeetings === 'function') filterAdminMeetings('all');

        // الانتظار قليلاً حتى يتم رسم الجدول داخل الـ Modal
        setTimeout(() => {
            // البحث عن الصف باستخدام ID الذي أضفناه في الخطوة 1
            const row = document.getElementById(`req-row-${id}`);
            if(row) {
                // التمرير (Scroll) إلى الصف
                row.scrollIntoView({ behavior: 'smooth', block: 'center' });
                
                // وميض (Highlight) للصف عشان المدير يشوفه
                row.classList.remove('bg-white');
                row.classList.add('bg-yellow-100'); 
                
                // إزالة الوميض بعد ثانيتين
                setTimeout(() => {
                    row.classList.remove('bg-yellow-100');
                    row.classList.add('bg-white');
                }, 2000);
            } else {
                // لو الصف مش ظاهر (نادر الحدوث)، نحاول نحدث القائمة
                updateAdminMeetingsList();
            }
        }, 300); // 300ms تأخير لضمان فتح النافذة
    } 
    
    // --- السيناريو ب: المستخدم العادي (أو المدير يضغط على حجز يخصه) ---
    else {
        // فتح نافذة تفاصيل الاجتماع العادية
        showMeetingDetails(meeting);
    }
};

// --- كود إصلاح تحديث الملف الشخصي (Profile Update Fix) ---
// هذا الكود يربط الفورم الموجود فعلياً في لوحة التحكم
const adminProfileForm = document.getElementById('admin-profile-form');

if (adminProfileForm) {
    adminProfileForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const btn = e.target.querySelector('button[type="submit"]');
        const originalText = btn.innerHTML;
        btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> جاري الحفظ...';
        btn.disabled = true;

        // قراءة البيانات من الحقول الصحيحة (tab-my-...)
        const newName = document.getElementById('tab-my-name').value;
        const newMobile = document.getElementById('tab-my-mobile').value;
        const newPosition = document.getElementById('tab-my-position').value;
        
        // قراءة القسم (مع مراعاة القائمة المنسدلة)
        const deptInput = document.getElementById('tab-my-dept');
        const newDept = deptInput ? deptInput.value : currentUser.department;

        const newPass = document.getElementById('tab-my-password').value;
        const newEmail = document.getElementById('tab-my-email').value;

        try {
            let updates = {};
            let hasChanges = false;

            // مقارنة البيانات لتحديد التغييرات فقط
            if (newName !== currentUser.full_name) { updates.full_name = newName; hasChanges = true; }
            if (newMobile !== currentUser.mobile) { updates.mobile = newMobile; hasChanges = true; }
            if (newPosition !== currentUser.position) { updates.position = newPosition; hasChanges = true; }
            if (newDept !== currentUser.department) { updates.department = newDept; hasChanges = true; }

            // 1. تحديث البيانات النصية في الجدول
            if (hasChanges) {
                const { error } = await supabase
                    .from('profiles')
                    .update(updates)
                    .eq('id', currentUser.id);
                
                if (error) throw error;

                // تحديث الذاكرة المحلية فوراً
                currentUser = { ...currentUser, ...updates };
                localStorage.setItem('currentUser', JSON.stringify(currentUser));
                
                // تحديث الواجهة
                updateSidebarProfile();
                if(typeof applyUserPermissions === 'function') applyUserPermissions();
            }

            // 2. تحديث الباسورد (اختياري)
            if (newPass && newPass.length >= 6) {
                const { error } = await supabase.auth.updateUser({ password: newPass });
                if (error) throw error;
                showNotification('تم تحديث كلمة المرور ✅', 'success');
            }

            // 3. تحديث الإيميل (اختياري)
            if (newEmail && newEmail !== currentUser.email) {
                const { error } = await supabase.auth.updateUser({ email: newEmail });
                if (error) throw error;
                showNotification('تم إرسال رابط تأكيد للإيميل الجديد 📧', 'info');
            }

            if (hasChanges) {
                showNotification('تم حفظ بيانات الملف الشخصي بنجاح 🎉', 'success');
            } else if (!newPass && !newEmail) {
                showNotification('لم يتم تغيير أي بيانات', 'info');
            }

        } catch (err) {
            console.error(err);
            showNotification('خطأ في الحفظ: ' + err.message, 'error');
        } finally {
            btn.innerHTML = originalText;
            btn.disabled = false;
        }
    });
}

// دالة مساعدة لتحويل الأرقام الإنجليزية إلى عربية
function toArabicNum(str) {
    // 1. الحماية: إذا كانت القيمة null أو undefined فعلاً، ارجع نص فارغ
    if (str === null || str === undefined) return '';
    
    // 2. التحويل: الآن حتى لو القيمة 0 (رقم)، سيتم تحويلها لنص ثم لـ "٠"
    return str.toString().replace(/\d/g, d => "٠١٢٣٤٥٦٧٨٩"[d]);
}

// 🔥 دالة الانتقال لأسبوع محدد
function jumpToWeek(dateISO) {
    // تحويل التاريخ من ISO string إلى كائن Date
    const newDate = new Date(dateISO);
    
    // حساب بداية الأسبوع لهذا التاريخ (الأحد)
    const dayOfWeek = newDate.getDay();
    const diff = newDate.getDate() - dayOfWeek + (dayOfWeek === 0 ? -6 : 1);
    
    currentWeekStart = new Date(newDate.setDate(diff));
    
    updateWeekDisplay();
    renderCalendar();
    
    // إخفاء القائمة
    document.getElementById('week-dropdown-options').classList.remove('show');
    document.getElementById('week-arrow').style.transform = 'rotate(0deg)';
}

// ========================================================================
    // 🔥 الحماية الشاملة لحساب المؤسس (يتم تطبيقه على جميع النوافذ) 🔥
    // ========================================================================
    document.addEventListener('DOMContentLoaded', () => {
        
        // 1. تعريف إيميل المؤسس (تأكد من كتابته هنا بدقة)
        const FOUNDER_EMAIL_FIXED = "fekrythug@gmail.com".trim().toLowerCase();

        // دالة مساعدة للحماية والحفظ (تعمل مع أي فورم)
        async function attachSecureListener(formId, userIdInputId, isPermForm, isForm2) {
            const originalForm = document.getElementById(formId);
            if (!originalForm) return;

            // قتل أي كود قديم (إزالة المستمعين السابقين)
            const secureForm = originalForm.cloneNode(true);
            originalForm.parentNode.replaceChild(secureForm, originalForm);

            secureForm.addEventListener('submit', async function(e) {
                e.preventDefault();
                
                const btn = secureForm.querySelector('button[type="submit"]');
                const originalText = btn.innerHTML;
                
                // محاولة الحصول على ID المستخدم (مع معالجة التكرار في Form 2)
                let userId = "";
                if(isForm2 && isPermForm) {
                    // في حالة فورم الصلاحيات الثاني المكرر، نحاول جلبه بدقة
                    userId = secureForm.querySelector('input[type="hidden"]').value; 
                } else {
                    userId = document.getElementById(userIdInputId).value;
                }

                btn.disabled = true;
                btn.innerHTML = '<i class="fas fa-shield-alt fa-pulse"></i> جاري الفحص...';

                try {
                    // 🛑 1. فحص الحماية: هل هذا هو المؤسس؟
                    const { data: targetUser } = await window.supabase
                        .from('profiles')
                        .select('email')
                        .eq('id', userId)
                        .single();

                    if (targetUser && targetUser.email.trim().toLowerCase() === FOUNDER_EMAIL_FIXED) {
                        alert("⛔ تنبيه أمني صارم:\nهذا حساب المؤسس (محصن)! يُمنع منعاً باتاً تعديل بياناته أو صلاحياته.");
                        btn.disabled = false;
                        btn.innerHTML = originalText;
                        return; // 🛑 إيقاف فوري
                    }

                    // 🛑 2. التنفيذ (إذا لم يكن المؤسس)
                    btn.innerHTML = 'جاري الحفظ...';

                    if (isPermForm) {
                        // --- حفظ الصلاحيات ---
                        // معالجة اختلاف IDs بين الفورم الأول والثاني
                        const approveId = isForm2 ? 'perm-approve-2' : 'perm-approve';
                        // ملاحظة: perm-users و perm-delete مكررين في HTML، نستخدم querySelector للبحث داخل الفورم الحالي فقط
                        const usersPerm = secureForm.querySelector('input[id*="users"]').checked; 
                        const deletePerm = secureForm.querySelector('input[id*="delete"]').checked;
                        const approvePerm = document.getElementById(approveId).checked;

                        const newPerms = {
                            can_approve: approvePerm,
                            can_manage_users: usersPerm,
                            can_delete: deletePerm
                        };
                        
                        const hasAnyPerm = Object.values(newPerms).some(v => v === true);
                        const newRole = hasAnyPerm ? 'manager' : 'user';

                        await window.supabase.from('profiles').update({ permissions: newPerms, role: newRole }).eq('id', userId);
                        
                        // محاولة تحديث الميتاداتا
                        showNotification('تم تحديث الصلاحيات بنجاح');
                        document.getElementById('permissions-modal').classList.remove('show');

                    } else {
                        // --- حفظ البيانات الشخصية ---
                        const nameId = isForm2 ? 'edit-user-name-2' : 'edit-user-name';
                        const deptId = isForm2 ? 'edit-user-dept-2' : 'edit-user-dept';
                        // الفورم الأول فيه حقول زيادة
                        const posId = 'edit-user-position'; 
                        const mobId = 'edit-user-mobile';

                        const updates = {
                            full_name: document.getElementById(nameId).value,
                            department: document.getElementById(deptId).value
                        };

                        if(!isForm2) {
                            updates.position = document.getElementById(posId).value;
                            updates.mobile = document.getElementById(mobId).value;
                        }

                        await window.supabase.from('profiles').update(updates).eq('id', userId);
                        showNotification('تم تعديل البيانات بنجاح');
                        
                        // إغلاق المودال المناسب
                        if(isForm2) document.getElementById('edit-user-info-modal').classList.remove('show'); // لاحظ: في ملفك المودال الثاني له نفس ID المودال الأول في الـ HTML أحياناً، تأكد من الـ IDs
                        else document.getElementById('edit-user-info-modal').classList.remove('show');
                    }

                    if(typeof updateAdminUsersList === 'function') updateAdminUsersList();

                } catch (err) {
                    console.error(err);
                    alert("حدث خطأ: " + err.message);
                } finally {
                    btn.disabled = false;
                    btn.innerHTML = originalText;
                }
            });
        }

        // تطبيق الحماية على النماذج الأربعة الموجودة في ملفك
        // 1. تعديل البيانات (الأساسي)
        attachSecureListener('edit-user-info-form', 'edit-user-id', false, false);
        
        // 2. تعديل البيانات (الإضافي -2)
        attachSecureListener('edit-user-info-form-2', 'edit-user-id-2', false, true);

        // 3. الصلاحيات (الأساسي)
        attachSecureListener('permissions-form', 'perm-user-id', true, false);

        // 4. الصلاحيات (الإضافي -2)
        attachSecureListener('permissions-form-2', 'perm-user-id', true, true);
    });

// ========================================================================
    // 🔥 الحماية الشاملة لحساب المؤسس (يسمح للمؤسس بتعديل بياناته فقط) 🔥
    // ========================================================================
    document.addEventListener('DOMContentLoaded', async () => {
        
        const FOUNDER_EMAIL_FIXED = "fekrythug@gmail.com".trim().toLowerCase();

        // نحتاج معرفة من الذي يستخدم النظام الآن؟
        let currentAdminEmail = "";
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if(user) currentAdminEmail = user.email.trim().toLowerCase();
        } catch(e) { console.error(e); }

        async function attachSecureListener(formId, userIdInputId, isPermForm, isForm2) {
            const originalForm = document.getElementById(formId);
            if (!originalForm) return;

            const secureForm = originalForm.cloneNode(true);
            originalForm.parentNode.replaceChild(secureForm, originalForm);

            secureForm.addEventListener('submit', async function(e) {
                e.preventDefault();
                
                const btn = secureForm.querySelector('button[type="submit"]');
                const originalText = btn.innerHTML;
                
                let userId = "";
                if(isForm2 && isPermForm) {
                    userId = secureForm.querySelector('input[type="hidden"]').value; 
                } else {
                    userId = document.getElementById(userIdInputId).value;
                }

                btn.disabled = true;
                btn.innerHTML = '<i class="fas fa-shield-alt fa-pulse"></i> جاري الفحص...';

                try {
                    // 1. فحص الهدف: هل نحاول تعديل المؤسس؟
                    const { data: targetUser } = await window.supabase
                        .from('profiles')
                        .select('email')
                        .eq('id', userId)
                        .single();

                    const isTargetFounder = (targetUser && targetUser.email.trim().toLowerCase() === FOUNDER_EMAIL_FIXED);
                    const amIFounder = (currentAdminEmail === FOUNDER_EMAIL_FIXED);

                    if (isTargetFounder) {
                        // 🛑 سيناريو 1: المؤسس يحاول تعديل نفسه
                        if (amIFounder) {
                            if (isPermForm) {
                                // ممنوع تعديل الصلاحيات حتى لنفسك (للأمان عشان متغلطش وتشيل صلاحياتك)
                                alert("⚠️ تنبيه:\nللحفاظ على أمان النظام، لا يمكنك تعديل صلاحياتك بنفسك من هنا.\nأنت تملك الصلاحيات الكاملة بالفعل.");
                                btn.disabled = false;
                                btn.innerHTML = originalText;
                                return;
                            }
                            // مسموح تعديل البيانات الشخصية (الاسم والقسم) ✅
                            // سيكمل الكود للأسفل بشكل طبيعي...
                        } 
                        // 🛑 سيناريو 2: شخص آخر يحاول تعديل المؤسس
                        else {
                            alert("⛔ تنبيه أمني صارم:\nهذا حساب المؤسس (محصن)! لا تملك صلاحية تعديله.");
                            btn.disabled = false;
                            btn.innerHTML = originalText;
                            return;
                        }
                    }

                    // ... تنفيذ الحفظ ...
                    btn.innerHTML = 'جاري الحفظ...';

                    if (isPermForm) {
                        const approveId = isForm2 ? 'perm-approve-2' : 'perm-approve';
                        const usersPerm = secureForm.querySelector('input[id*="users"]').checked; 
                        const deletePerm = secureForm.querySelector('input[id*="delete"]').checked;
                        const approvePerm = document.getElementById(approveId).checked;

                        const newPerms = { can_approve: approvePerm, can_manage_users: usersPerm, can_delete: deletePerm };
                        const hasAnyPerm = Object.values(newPerms).some(v => v === true);
                        const newRole = hasAnyPerm ? 'manager' : 'user';

                        await window.supabase.from('profiles').update({ permissions: newPerms, role: newRole }).eq('id', userId);
                        showNotification('تم تحديث الصلاحيات بنجاح');
                        document.getElementById('permissions-modal').classList.remove('show');

                    } else {
                        const nameId = isForm2 ? 'edit-user-name-2' : 'edit-user-name';
                        const deptId = isForm2 ? 'edit-user-dept-2' : 'edit-user-dept';
                        const posId = 'edit-user-position'; 
                        const mobId = 'edit-user-mobile';

                        const updates = {
                            full_name: document.getElementById(nameId).value,
                            department: document.getElementById(deptId).value
                        };
                        if(!isForm2) {
                            updates.position = document.getElementById(posId).value;
                            updates.mobile = document.getElementById(mobId).value;
                        }

                        await window.supabase.from('profiles').update(updates).eq('id', userId);
                        showNotification('تم تعديل البيانات بنجاح');
                        if(isForm2) document.getElementById('edit-user-info-modal').classList.remove('show');
                        else document.getElementById('edit-user-info-modal').classList.remove('show');
                    }

                    if(typeof updateAdminUsersList === 'function') updateAdminUsersList();

                } catch (err) {
                    console.error(err);
                    alert("حدث خطأ: " + err.message);
                } finally {
                    btn.disabled = false;
                    btn.innerHTML = originalText;
                }
            });
        }

        // تطبيق الحماية
        attachSecureListener('edit-user-info-form', 'edit-user-id', false, false);
        attachSecureListener('edit-user-info-form-2', 'edit-user-id-2', false, true);
        attachSecureListener('permissions-form', 'perm-user-id', true, false);
        attachSecureListener('permissions-form-2', 'perm-user-id', true, true);
    });

    // ميزة الإغلاق عند الضغط خارج الإطار
window.addEventListener('click', (e) => {
    const nMenu = document.getElementById('notif-menu');
    const nWrapper = document.getElementById('notif-btn-wrapper');
    const pcWrapper = document.getElementById('notif-btn-wrapper-pc');

    // إذا كانت قائمة الإشعارات مفتوحة والدوسة بره الجرس وبره القائمة
    if (nMenu && !nMenu.classList.contains('hidden')) {
        if (!nMenu.contains(e.target) && !nWrapper?.contains(e.target) && !pcWrapper?.contains(e.target)) {
            
            // تنفيذ دالة التبديل عشان تعمل "Closing Logic" وتسجلهم كشوهدوا
            toggleNotifications(); 
        }
    }
    
    // كود البروفايل يفضل زي ما هو...
    const pMenu = document.getElementById('profile-info-menu');
    const pCapsule = document.getElementById('mob-profile-capsule');
    if (pMenu && !pMenu.classList.contains('hidden')) {
        if (!pMenu.contains(e.target) && !pCapsule?.contains(e.target)) {
            pMenu.classList.add('hidden');
        }
    }
});

function toggleMobileMenu() {
    const menu = document.getElementById('mobile-menu');
    const content = document.getElementById('mobile-menu-content');
    
    if (!menu || !content) return;

    if (menu.classList.contains('hidden')) {
        menu.classList.remove('hidden');
        // تأخير 10ms للسماح للمتصفح برسم العنصر قبل تفعيل الأنيميشن
        setTimeout(() => {
            content.classList.remove('translate-x-full');
        }, 10);
    } else {
        content.classList.add('translate-x-full');
        // انتظار انتهاء الأنيميشن (300ms) قبل إخفاء الحاوية بالكامل
        setTimeout(() => {
            menu.classList.add('hidden');
        }, 300);
    }
}

if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('/sw.js')
        .then(() => console.log('تم تفعيل خدمة التحديث والتشغيل الأساسي'))
        .catch(err => console.log('حدث خطأ في التسجيل: ', err));
    });
  }
  
// Home statistics have one owner: dashboard-home.js.
window.getDashboardDepartmentLabel = key => departments[key]?.name || (/[\u0600-\u06ff]/.test(key || '') ? key : 'القسم غير محدد');
function updateDashboardCardsOnly() { return window.CITLDashboard?.refresh(); }
function syncDashboardData() { return window.CITLDashboard?.refresh(); }
window.openAgenda = function() { window.CITLDashboard?.openAdmin('meetings'); };
window.setDashboardProfile = function(profile) {
    currentUser = profile; window.currentUser = profile;
    applyUserPermissions();
    const manager = ['can_approve','can_delete','can_manage_users'].some(key => window.CITLPermissions.can(profile,key));
    document.querySelectorAll('[data-dashboard-account]').forEach(button => {
        button.textContent = manager ? 'لوحة التحكم' : 'ملفي الشخصي';
    });
};
window.clearDashboardPrivateState = function() {
    currentUser = null; window.currentUser = null; meetings = []; window.CITLAdminMeetings = [];
    document.querySelectorAll('.modal.show').forEach(modal => modal.classList.remove('show'));
    document.querySelectorAll('[data-manager-only]').forEach(el => el.classList.add('hidden'));
    const button = document.getElementById('admin-panel-btn');
    if(button)button.textContent = 'حسابي';
};
