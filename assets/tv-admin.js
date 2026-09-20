function notifyTvMediaUpdate() {
    try {localStorage.setItem('citl-tv-media-update',String(Date.now()));} catch(_) {}
    window.dispatchEvent(new Event('citl-tv-media-update'));
}
// Shared classic script; uses the authenticated client and UI helpers of its host page.
const TV_DISPLAY_CONFIG_KEY = 'tv_display_config';

const TV_MASTER_ROOMS_LIST = [
    "G004", "H 001 Hall", "H 002 Lab", "H 101 L", "H 104",
    "H 106 L", "H 107", "H 108", "H 109", "H 205",
    "H 207 L", "H 208", "H 209", "H 210", "H 211",
    "IMO 001", "IMO 002", "IMO 003", "IMO 004", "IMO 005", "IMO 006",
    "M 124", "M 128", "M 130", "M 132", "M 135", "M 136",
    "PH 201", "PH 401", "PH 404", "PH 501"
];

let tvActiveRooms = [...TV_MASTER_ROOMS_LIST];
let tvConfigReady = false;
let tvPosterConfigReady = false, tvPosterSaving = false, tvPosterSavedEnabled = true;
function publishTvSetting(key, value) {
    const update = {key, value};
    try { localStorage.setItem('citl-tv-settings-update', JSON.stringify(update)); } catch (_) {}
    window.dispatchEvent(new CustomEvent('citl-tv-settings-update', {detail:update}));
}
document.addEventListener('change', event => {
    if (event.target?.id === 'poster-global-toggle') window.saveTvPosterGlobalConfig();
});

function clampTvSeconds(value) {
    const seconds = parseInt(value, 10);

    if (Number.isNaN(seconds)) return 10;

    return Math.min(120, Math.max(2, seconds));
}

function updateTvRoomCard(checkbox) {
    const card = checkbox.nextElementSibling;
    const circle = card.querySelector('.tv-check-circle');

    if (checkbox.checked) {
        card.className = "border-2 rounded-xl p-3 flex items-center justify-between transition-all bg-[#2A3475] text-white border-[#2A3475]";
        circle.innerHTML = '<i class="fas fa-check text-[10px]"></i>';
    } else {
        card.className = "border-2 rounded-xl p-3 flex items-center justify-between transition-all bg-white text-gray-700 border-gray-200 hover:border-[#2A3475]/50";
        circle.innerHTML = '';
    }
}

window.updateTvRoomCard = updateTvRoomCard;

function renderTvRoomsGrid() {
    const grid = document.getElementById('tv-rooms-selection-grid');

    if (!grid) return;

    grid.innerHTML = '';

    TV_MASTER_ROOMS_LIST.forEach(room => {
        const isChecked = tvActiveRooms.includes(room);

        const cardClass = isChecked
            ? "border-2 rounded-xl p-3 flex items-center justify-between transition-all bg-[#2A3475] text-white border-[#2A3475]"
            : "border-2 rounded-xl p-3 flex items-center justify-between transition-all bg-white text-gray-700 border-gray-200 hover:border-[#2A3475]/50";

        const iconHtml = isChecked ? '<i class="fas fa-check text-[10px]"></i>' : '';

        grid.innerHTML += `
            <label class="cursor-pointer group relative">
                <input type="checkbox"
                    class="tv-room-checkbox absolute opacity-0 w-0 h-0"
                    value="${room}"
                    ${isChecked ? 'checked' : ''}
                    onchange="updateTvRoomCard(this)">

                <div class="${cardClass}">
                    <span class="font-bold text-sm font-english">${room}</span>

                    <div class="w-5 h-5 rounded-full border-2 border-gray-300 flex items-center justify-center tv-check-circle">
                        ${iconHtml}
                    </div>
                </div>
            </label>
        `;
    });
}

function toggleTvRoomsSelection(state) {
    const checkboxes = document.querySelectorAll('.tv-room-checkbox');

    checkboxes.forEach(cb => {
        cb.checked = state;
        updateTvRoomCard(cb);
    });
}

window.toggleTvRoomsSelection = toggleTvRoomsSelection;

async function loadTvDisplayConfig() {
    try {
        const { data, error } = await supabase
            .from('site_settings')
            .select('setting_value')
            .eq('setting_key', TV_DISPLAY_CONFIG_KEY)
            .maybeSingle();
            
        if (error) throw error;
        
        const config = data && data.setting_value ? data.setting_value : null;
        window.CITLStudySettings.populate(config || {});
        if (config) {
            const secondsInput = document.getElementById('tv-slide-seconds');
            if (secondsInput) {
                secondsInput.value = clampTvSeconds(config.slideDurationSeconds || 10);
            }
            
            // 🔥 التقاط وقراءة مدة عرض الامتحان المستقلة
            const examSecondsInput = document.getElementById('tv-exam-slide-seconds');
            if (examSecondsInput) {
                examSecondsInput.value = clampTvSeconds(config.examSlideDurationSeconds || 15);
            }
            
            if (Array.isArray(config.activeRooms)) {
                tvActiveRooms = config.activeRooms.filter(room => TV_MASTER_ROOMS_LIST.includes(room));
            } else {
                tvActiveRooms = [...TV_MASTER_ROOMS_LIST];
            }
            
            if (document.getElementById('tv-exams-toggle')) {
                document.getElementById('tv-exams-toggle').checked = config.examsEnabled !== false;
            }

            if (document.getElementById('tv-test-exam-date')) {
                document.getElementById('tv-test-exam-date').value = config.testExamDate || '';
            }

        } else {
            tvActiveRooms = [...TV_MASTER_ROOMS_LIST];
        }
        renderTvRoomsGrid();
        tvConfigReady = true;
    } catch (e) {
        console.error('TV display config load error:', e);
    }
}

async function saveTvDisplayConfig() {
    if (!tvConfigReady) { showNotification('انتظر تحميل إعدادات الشاشة أو أعد فتح التبويب قبل الحفظ', 'error'); return; }
    const checked = document.querySelectorAll('.tv-room-checkbox:checked');
    const selectedRooms = Array.from(checked).map(cb => cb.value);
    
    const secondsInput = document.getElementById('tv-slide-seconds');
    const seconds = secondsInput ? parseInt(secondsInput.value) || 10 : 10;
    
    // التقاط إعدادات الامتحانات
    const examsEnabled = document.getElementById('tv-exams-toggle') ? document.getElementById('tv-exams-toggle').checked : true;
    const testExamDateInput = document.getElementById('tv-test-exam-date');
    const testExamDate = testExamDateInput ? testExamDateInput.value : '';
    
    // 🔥 التقاط مدة الامتحانات
    const examSecondsInput = document.getElementById('tv-exam-slide-seconds');
    const examSeconds = examSecondsInput ? parseInt(examSecondsInput.value) || 15 : 15;

    const {data: latestSetting, error: latestError} = await supabase.from('site_settings').select('setting_value').eq('setting_key', TV_DISPLAY_CONFIG_KEY).maybeSingle();
    if (latestError) { showNotification('تعذر قراءة إعدادات الشاشة؛ لم يتم الحفظ', 'error'); return; }
    const config = {
        ...(latestSetting?.setting_value || {}),
        ...window.CITLStudySettings.values(),
        updatedAt: Date.now(),
        activeRooms: selectedRooms,
        slideDurationSeconds: clampTvSeconds(seconds),
        studyEnabled: selectedRooms.length > 0, // Compatibility field; selected rooms are the only on/off control.
        examsEnabled: examsEnabled,
        testExamDate: testExamDate,
        examSlideDurationSeconds: Math.max(5,clampTvSeconds(examSeconds)) // 🔥 إضافة التوقيت المستقل
    };
    
    const { error } = await supabase
        .from('site_settings')
        .upsert({ 
            setting_key: TV_DISPLAY_CONFIG_KEY, 
            setting_value: config 
        }, { onConflict: 'setting_key' });
        
    if (!error) { publishTvSetting(TV_DISPLAY_CONFIG_KEY, config); showNotification('تم حفظ الإعدادات بنجاح', 'success'); }
    else showNotification('تعذر حفظ إعدادات الشاشة؛ راجع الاتصال والصلاحيات', 'error');
}

window.saveTvDisplayConfig = saveTvDisplayConfig;

// معادلة تحويل قيمة الشريط (0-100) إلى ثواني (60s - 5s)
// كل ما الرقم يزيد (سرعة)، الوقت يقل (ثواني)
function calculateDuration(sliderVal) {
    // المعادلة: 65 - (قيمة الشريط * 0.6)
    // لو 0 -> 65 ثانية (بطيء جداً)
    // لو 50 -> 35 ثانية (متوسط)
    // لو 100 -> 5 ثواني (صاروخ)
    return Math.max(5, 65 - (sliderVal * 0.6)) + 's';
}

// دالة لتحديث النص فوق الشريط أثناء السحب
function updateSpeedLabel(val) {
    const label = document.getElementById('speed-display');
    if(val < 20) { label.innerText = 'بطيء جداً'; label.className = 'text-xs font-bold text-gray-500 bg-gray-100 px-2 py-1 rounded-md'; }
    else if(val < 40) { label.innerText = 'بطيء'; label.className = 'text-xs font-bold text-blue-600 bg-blue-50 px-2 py-1 rounded-md'; }
    else if(val < 60) { label.innerText = 'سرعة متوسطة'; label.className = 'text-xs font-bold text-[#2A3475] bg-[#2A3475]/10 px-2 py-1 rounded-md'; }
    else if(val < 80) { label.innerText = 'سريع'; label.className = 'text-xs font-bold text-orange-600 bg-orange-50 px-2 py-1 rounded-md'; }
    else { label.innerText = 'سريع جداً'; label.className = 'text-xs font-bold text-red-600 bg-red-50 px-2 py-1 rounded-md'; }
}


// =========================================================================
// ⚡ المحرك الذكي لإدارة الشريط المزدوج (أخبار عامة / تعليمات لجان) ⚡
// =========================================================================

let currentNewsMode = 'general'; // الوضع النشط حالياً (general أو exams)

// كاش محلي لحفظ النصوص والسرعات أثناء التنقل بين التبويبات قبل الضغط على حفظ
let newsCache = {
    general: { text: '', sliderVal: 50 },
    exams: { text: '', sliderVal: 50 }
};

/**
 * 1. دالة التبديل اللحظي بين شريط الأخبار العامة وتعليمات اللجان
 * تقوم بحفظ التعديلات الحالية في الكاش أولاً، ثم قلب هوية الكارت (ألوان/أيقونات) وضخ البيانات البديلة
 */
function switchNewsMode(mode) {
    // أ. تأمين وحفظ ما يكتبه المستخدم حالياً في الكاش الخاص بالوضع الحالي
    const currentText = document.getElementById('news-input-multi') ? document.getElementById('news-input-multi').value : '';
    const currentSlider = document.getElementById('news-speed-slider') ? document.getElementById('news-speed-slider').value : 50;
    newsCache[currentNewsMode] = { text: currentText, sliderVal: currentSlider };

    // ب. تحديث المود النشط الجديد
    currentNewsMode = mode;

    // ج. الإمساك بعناصر الواجهة لقلب تصميمها بالمشرط
    const card = document.getElementById('news-config-card');
    const iconBox = document.getElementById('news-icon-box');
    const cardIcon = document.getElementById('news-card-icon');
    const title = document.getElementById('news-card-title');
    const desc = document.getElementById('news-card-desc');
    const labelText = document.getElementById('news-label-text');
    const saveBtn = document.getElementById('btn-save-news');
    const tabGen = document.getElementById('btn-news-gen');
    const tabEx = document.getElementById('btn-news-ex');

    if (mode === 'general') {
        // 🌟 العودة الفورية للهوية الكلاسيكية (الذهبي والكحلي)
        if (card) card.className = "premium-card p-6 md:p-8 border-r-4 border-[#F3A628] bg-white rounded-xl shadow-md transition-all duration-300";
        if (iconBox) iconBox.className = "w-14 h-14 rounded-2xl bg-[#2A3475]/5 text-[#2A3475] flex items-center justify-center text-2xl shadow-sm border border-[#2A3475]/10 transition-colors";
        if (cardIcon) cardIcon.className = "fas fa-bolt";
        if (title) title.textContent = "إعدادات السرعة والمحتوى (الأخبار العامة)";
        if (title) title.className = "font-black text-[#2A3475] text-sm md:text-base";
        if (desc) desc.textContent = "تحكم كامل في ظهور الأخبار العادية على الشاشات والداشبورد";
        if (labelText) labelText.textContent = "نصوص التنبيهات العامة (كل سطر هو خبر منفصل)";
        if (saveBtn) {
            saveBtn.className = "w-full md:w-auto h-[54px] bg-[#2A3475] text-white px-10 rounded-lg font-black text-xs uppercase tracking-widest hover:brightness-110 active:scale-95 transition-all shadow-lg shadow-[#2A3475]/20 flex items-center justify-center gap-3";
            saveBtn.innerHTML = '<i class="fas fa-cloud-arrow-up text-lg"></i> حفظ ونشر الأخبار العامة';
        }
        
        // ضبط أزرار التبويبات
        if (tabGen) tabGen.className = "px-4 py-2 text-xs font-black uppercase tracking-widest border-b-2 border-[#F3A628] text-[#2A3475] transition-all";
        if (tabEx) tabEx.className = "px-4 py-2 text-xs font-black uppercase tracking-widest border-b-2 border-transparent text-gray-400 hover:text-red-600 transition-all";
    } else {
        // 🚨 التحول الفوري للهوية الصارمة للامتحانات (اللون الأحمر التحذيري)
        if (card) card.className = "premium-card p-6 md:p-8 border-r-4 border-red-600 bg-white rounded-xl shadow-md transition-all duration-300";
        if (iconBox) iconBox.className = "w-14 h-14 rounded-2xl bg-red-50 text-red-600 flex items-center justify-center text-2xl shadow-sm border border-red-100 transition-colors";
        if (cardIcon) cardIcon.className = "fas fa-exclamation-triangle animate-pulse";
        if (title) title.textContent = "إعدادات السرعة والمحتوى (تعليمات اللجان)";
        if (title) title.className = "font-black text-red-700 text-sm md:text-base";
        if (desc) desc.textContent = "تحكم كامل في نصوص شريط التحذيرات والتعليمات الذي يظهر في وضع الامتحانات";
        if (labelText) labelText.textContent = "نصوص تعليمات اللجان (كل سطر هو تنبيه منفصل يظهر إجبارياً للطلاب)";
        if (saveBtn) {
            saveBtn.className = "w-full md:w-auto h-[54px] bg-red-600 text-white px-10 rounded-lg font-black text-xs uppercase tracking-widest hover:bg-red-700 active:scale-95 transition-all shadow-md flex items-center justify-center gap-3";
            saveBtn.innerHTML = '<i class="fas fa-save text-lg"></i> حفظ ونشر تعليمات اللجان';
        }
        
        // ضبط أزرار التبويبات
        if (tabGen) tabGen.className = "px-4 py-2 text-xs font-black uppercase tracking-widest border-b-2 border-transparent text-gray-400 hover:text-[#2A3475] transition-all";
        if (tabEx) tabEx.className = "px-4 py-2 text-xs font-black uppercase tracking-widest border-b-2 border-red-600 text-red-600 transition-all";
    }

    // د. استدعاء وضخ البيانات الخاصة بالمود الجديد من الكاش إلى عناصر الصفحة
    if (document.getElementById('news-input-multi')) {
        document.getElementById('news-input-multi').value = newsCache[mode].text || '';
    }
    if (document.getElementById('news-speed-slider')) {
        document.getElementById('news-speed-slider').value = newsCache[mode].sliderVal ?? 50;
    }
    if (typeof updateSpeedLabel === "function") {
        updateSpeedLabel(newsCache[mode].sliderVal ?? 50);
    }
}


/**
 * 2. دالة الحفظ الموحدة والذكية
 * تقوم بقراءة الداتا وتحديد الـ setting_key المناسب تلقائياً بناءً على التبويب المفتوح حالياً
 */
async function saveNewsConfig() {
    const text = document.getElementById('news-input-multi') ? document.getElementById('news-input-multi').value : '';
    const sliderVal = document.getElementById('news-speed-slider') ? document.getElementById('news-speed-slider').value : 50;
    const calculatedSpeed = typeof calculateDuration === "function" ? calculateDuration(sliderVal) : '35s';

    if (!text.trim()) {
        alert('فضلاً، اكتب نص التنبيه أو الخبر أولاً قبل إتمام الحفظ!');
        return;
    }

    const config = {
        text: text,
        speed: calculatedSpeed,
        sliderVal: sliderVal,
        updatedAt: Date.now()
    };

    // حسم الـ المفتاح المستهدف في قاعدة البيانات والـ LocalStorage بناءً على التبويب المفتوح
    const dbKey = currentNewsMode === 'general' ? 'news_config' : 'exam_news_config';

    // تحديث الكاش المحلي فوراً لضمان السرعة الاستجابة
    newsCache[currentNewsMode] = { text: text, sliderVal: sliderVal };


    // عمل الـ Upsert في السيرفر بضربة واحدة دقيقة
    const { error } = await supabase
        .from('site_settings')
        .upsert({ 
            setting_key: dbKey, 
            setting_value: config 
        }, { onConflict: 'setting_key' });

    if (!error) {
        window.CITLTicker.publish(dbKey,config);
        showNotification('تم حفظ البيانات وتحديث شريط الشاشة بنجاح ✅', 'success');
    } else {
        console.error(error);
        showNotification('تعذر حفظ الخبر على السيرفر؛ الإعدادات السابقة ما زالت مطبقة. أعد المحاولة.', 'error');
    }
}

/**
 * 3. دالة التحميل الثنائية الشاملة
 * تُستدعى تلقائياً عند فتح الصفحة لجلب الإعدادين (العام والامتحانات) معاً بضربة واحدة وتخزينهم في الكاش
 */
async function loadCurrentNews() {
    try {
        // جلب السطرين معاً لتسريع لود الصفحة ومنع الكويريز المتكررة
        const { data, error } = await supabase
            .from('site_settings')
            .select('*')
            .in('setting_key', ['news_config', 'exam_news_config']);

        if (!error && data) {
            const genSetting = data.find(r => r.setting_key === 'news_config');
            const exSetting = data.find(r => r.setting_key === 'exam_news_config');

            // تفكيك وضخ داتا الأخبار العامة في الذاكرة
            if (genSetting && genSetting.setting_value) {
                newsCache.general = {
                    text: genSetting.setting_value.text || '',
                    sliderVal: genSetting.setting_value.sliderVal ?? 50
                };
                localStorage.setItem('news_config', JSON.stringify(genSetting.setting_value));
            }
            
            // تفكيك وضخ داتا تعليمات لجان الامتحانات في الذاكرة
            if (exSetting && exSetting.setting_value) {
                newsCache.exams = {
                    text: exSetting.setting_value.text || '',
                    sliderVal: exSetting.setting_value.sliderVal ?? 50
                };
                localStorage.setItem('exam_news_config', JSON.stringify(exSetting.setting_value));
            }

            // عرض محتوى التبويب النشط حالياً (الافتراضي: عام) على شاشة المدخلات للتحكم
            if (document.getElementById('news-input-multi')) {
                document.getElementById('news-input-multi').value = newsCache[currentNewsMode].text || '';
            }
            if (document.getElementById('news-speed-slider')) {
                document.getElementById('news-speed-slider').value = newsCache[currentNewsMode].sliderVal ?? 50;
            }
            if (typeof updateSpeedLabel === "function") {
                updateSpeedLabel(newsCache[currentNewsMode].sliderVal ?? 50);
            }
        }
    } catch (e) {
        console.warn("حدث خطأ أثناء جلب التكوينات المزدوجة للأشرطة:", e);
    }
}

async function loadNewsConfig() {
    if (typeof loadCurrentNews === 'function') {
        await loadCurrentNews();
    }

    if (typeof loadTvDisplayConfig === 'function') {
        await loadTvDisplayConfig();
    }
    await fetchExamsVisitsCount();
}

window.loadNewsConfig = loadNewsConfig;

// تشغيل التحميل تلقائياً
document.addEventListener('DOMContentLoaded', loadNewsConfig);


// ========================================================================
// 🔥 نظام إدارة بوسترات لوحة التحكم المركزية (CITL Storage & SQL Engine) 🔥
// ========================================================================

// 1. تحديث اسم الملف المختار في الواجهة فورياً لراحة موظف المعمل
document.addEventListener('change', (e) => {
    if (e.target && e.target.id === 'poster-file-input') {
        const textEl = document.getElementById('file-chosen-text');
        if (textEl) {
            textEl.textContent = e.target.files[0] ? e.target.files[0].name : 'اختر صورة أو فيديو MP4';
        }
        updatePosterDurationControl();
    }
});

function updatePosterDurationControl() {
    const input = document.getElementById('poster-duration-input');
    if (!input) return;
    const file = document.getElementById('poster-file-input')?.files?.[0];
    const editId = document.getElementById('poster-edit-id')?.value;
    const row = (window.adminLoadedPosters || []).find(p => String(p.id) === editId);
    const isVideo = file ? window.CITLVideoConverter.isVideo(file) : row?.media_type === 'video' || /\.mp4(?:\?|$)/i.test(row?.image_url || '');
    input.disabled = !!isVideo;
    if (input.previousElementSibling) input.previousElementSibling.textContent = isVideo ? 'الفيديو يُعرض حتى نهايته تلقائيًا' : 'مدة عرض الصورة (ثواني)';
}

// 2. تحميل تفضيلات وجدول البوسترات بالكامل داخل لوحة التحكم
async function loadTvPosterAdminData() {
    const grid = document.getElementById('admin-posters-grid');
    const countBadge = document.getElementById('admin-posters-count');
    if (!grid) return;
    if (tvPosterSaving) return;
    tvPosterConfigReady = false;
    const toggle = document.getElementById('poster-global-toggle');
    if (toggle) toggle.disabled = true;

    grid.innerHTML = '<div class="col-span-full text-center py-10 opacity-60 text-xs font-bold"><i class="fas fa-spinner fa-spin text-xl ml-2"></i>جاري تحميل الإعلانات...</div>';

    try {
        // أ. جلب الإعدادات العامة للبوسترات من site_settings
        const { data: settingData, error: settingError } = await supabase
            .from('site_settings')
            .select('setting_value')
            .eq('setting_key', 'tv_poster_config')
            .maybeSingle();

        if (settingError) throw settingError;
        tvPosterSavedEnabled = settingData?.setting_value?.enabled !== false;
        if (toggle) { toggle.checked = tvPosterSavedEnabled; toggle.disabled = false; }
        tvPosterConfigReady = true;

        if (settingData && settingData.setting_value) {
            const config = settingData.setting_value;
            if (document.getElementById('poster-global-toggle')) 
                document.getElementById('poster-global-toggle').checked = config.enabled ?? true;
            if (document.getElementById('poster-rotation-input')) 
                document.getElementById('poster-rotation-input').value = config.rotationSeconds || 8;
        }

        // ب. جلب قائمة البوسترات الكاملة (مفعلة وغير مفعلة) لتمكين الأدمن من رؤية الكل
        const { data: posters, error } = await supabase
            .from('tv_posters')
            .select('*')
            .order('display_order', { ascending: true })
            .order('created_at', { ascending: false });

        if (error) throw error;
        window.adminLoadedPosters = posters; // 🔪 حفظناها عشان نقرأ منها في التعديل
        if (countBadge) countBadge.textContent = `${posters.length} بوستر`;

        if (posters.length === 0) {
            grid.innerHTML = `
                <div class="col-span-full text-center py-12 bg-gray-50 rounded-2xl border border-gray-100 text-gray-400 text-xs font-bold">
                    <i class="fas fa-images text-2xl mb-2 text-gray-300 block"></i>
                    شاشة التلفزيون لا تحتوي على بوسترات حالياً. ارفع أول بوستر من النموذج الجانبي!
                </div>
            `;
            return;
        }

        // ج. بناء كروت التحكم بالبوسترات بالكامل
        grid.innerHTML = posters.map(p => {
            const esc = value => String(value ?? '').replace(/[&<>\"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;',"'":'&#39;'}[c]));
            const statusChecked = p.is_active ? 'checked' : '';
            const fitText = p.fit_mode === 'contain' ? 'احتواء كامل' : 'ملء الشاشة';
            
            return `
                <div class="bg-white rounded-xl border border-gray-200 p-3 shadow-sm flex flex-col justify-between hover:shadow-md transition-shadow relative overflow-hidden">
                    <div class="flex gap-3">
                        <div class="w-16 h-20 rounded-lg bg-slate-900 border overflow-hidden shrink-0 flex items-center justify-center relative shadow-inner group">
                            ${p.media_type === 'video' ? `<video src="${esc(p.image_url)}" class="w-full h-full object-contain" muted playsinline preload="metadata"></video>` : `<img src="${esc(p.image_url)}" class="w-full h-full object-contain" loading="lazy" />`}
                            <a href="${esc(p.image_url)}" target="_blank" rel="noopener" class="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white text-[10px]"><i class="fas fa-eye"></i></a>
                        </div>
                        <div class="min-w-0 flex-1 text-right">
                            <h5 class="font-black text-xs text-[#2A3475] truncate" title="${esc(p.title || 'بدون عنوان')}">${esc(p.title || 'إعلان بدون عنوان')}</h5>
                                <div class="text-[10px] text-gray-400 font-bold mt-1 space-y-0.5">
                                <p><i class="fas fa-sort-numeric-down ml-1"></i> الترتيب: <span class="text-slate-700">${p.display_order}</span></p>
                                <p><i class="fas fa-expand-arrows-alt ml-1"></i> النمط: <span class="text-slate-700">${fitText}</span></p>
                                
                                <div class="flex items-center gap-2 mt-1.5 pt-1.5 border-t border-gray-100">
                                    ${p.media_type === 'video' || /\.mp4(?:\?|$)/i.test(p.image_url || '') ? '<span>حتى نهاية الفيديو</span>' : `<input type="number" value="${p.duration || 15}" onchange="updatePosterQuickSettings('${p.id}', this.value, null)" class="w-12 text-center border border-gray-200 rounded text-[9px] py-0.5 focus:border-[#2A3475] outline-none" title="مدة الصورة (ثواني)"> ثانية`}
                                    <label class="flex items-center gap-1 cursor-pointer ml-2">
                                        <input type="checkbox" ${p.play_sound ? 'checked' : ''} onchange="updatePosterQuickSettings('${p.id}', null, this.checked)" class="w-3 h-3 text-[#2A3475] rounded border-gray-300">
                                        صوت
                                    </label>
                                </div>
                                </div>
                        </div>
                    </div>
                    
                <div class="flex items-center justify-between border-t border-gray-100 pt-2.5 mt-3">
                                        <label class="flex items-center gap-2 cursor-pointer">
                                            <input type="checkbox" onchange="togglePosterActiveState('${p.id}', this.checked)" ${statusChecked} class="w-3.5 h-3.5 text-green-600 rounded border-gray-300 focus:ring-green-500 cursor-pointer">
                                            <span class="text-[10px] font-black text-gray-500">مظهر بالشاشة</span>
                                        </label>
                                        <div class="flex items-center gap-1">
                                            <button onclick="editTvPoster('${p.id}')" class="w-7 h-7 bg-blue-50 hover:bg-[#2A3475] text-blue-600 hover:text-white transition-colors rounded-lg flex items-center justify-center text-xs shadow-sm" title="تعديل البوستر">
                                                <i class="fas fa-pen"></i>
                                            </button>
                                            <button onclick="deleteTvPosterRecord('${p.id}')" class="w-7 h-7 bg-red-50 hover:bg-red-600 text-red-500 hover:text-white transition-colors rounded-lg flex items-center justify-center text-xs shadow-sm" title="حذف نهائي">
                                                <i class="fas fa-trash-can"></i>
                                            </button>
                                        </div>
                                    </div>
                </div>
            `;
        }).join('');

    } catch (err) {
        console.error('Error loading posters:', err);
        grid.innerHTML = '<div class="col-span-full text-center py-6 text-red-500 text-xs font-bold">فشل جلب ألبوم البوسترات</div>';
    }
}

// دالة تفريغ وإعادة الفورم لوضع الإضافة الجديد
window.resetPosterForm = function() {
    document.getElementById('poster-upload-form').reset();
    document.getElementById('poster-edit-id').value = '';
    updatePosterDurationControl();
    document.getElementById('poster-file-input').setAttribute('required', 'true');
    document.getElementById('file-chosen-text').textContent = 'اختر صورة أو فيديو MP4';
    
    const btn = document.querySelector('#poster-upload-form button[type="submit"]');
    btn.innerHTML = '<i class="fas fa-upload"></i> رفع ونشر البوستر';
    btn.classList.replace('bg-green-600', 'bg-[#2A3475]');
    
    document.getElementById('cancel-edit-poster-btn').classList.add('hidden');
};

// دالة تفعيل وضع التعديل عند الضغط على الكارت
window.editTvPoster = function(id) {
    if (!window.adminLoadedPosters) return;
    const p = window.adminLoadedPosters.find(x => String(x.id) === String(id));
    if (!p) return;

    // تعبئة البيانات
    document.getElementById('poster-edit-id').value = p.id;
    document.getElementById('poster-title-input').value = p.title || '';
    document.getElementById('poster-order-input').value = p.display_order || 1;
    document.getElementById('poster-fit-input').value = p.fit_mode || 'cover';
    document.getElementById('poster-duration-input').value = p.duration || 15;
    document.getElementById('poster-sound-input').checked = p.play_sound || false;
    document.getElementById('poster-file-input').value = '';
    updatePosterDurationControl();

    // الصورة لم تعد إجبارية في التعديل
    document.getElementById('poster-file-input').removeAttribute('required');
    document.getElementById('file-chosen-text').textContent = 'اختر ملفًا جديدًا (اختياري للاحتفاظ بالقديم)';

    // تغيير شكل الزر
    const btn = document.querySelector('#poster-upload-form button[type="submit"]');
    btn.innerHTML = '<i class="fas fa-save"></i> حفظ التعديلات';
    btn.classList.replace('bg-[#2A3475]', 'bg-green-600');
    
    document.getElementById('cancel-edit-poster-btn').classList.remove('hidden');
    document.getElementById('poster-upload-form').scrollIntoView({ behavior: 'smooth', block: 'center' });
    showNotification('وضع التعديل: يمكنك الآن تعديل إعدادات البوستر', 'info');
};

// Shared R2 upload/replace flow used by both administration pages.
const posterForm = document.getElementById('poster-upload-form');
let mediaFormBusy = false;
if (posterForm) posterForm.addEventListener('submit', async e => {
    e.preventDefault();
    if (mediaFormBusy) return;
    const editId = document.getElementById('poster-edit-id').value;
    const old = (window.adminLoadedPosters || []).find(p => String(p.id) === editId);
    const file = document.getElementById('poster-file-input').files?.[0];
    if ((editId && !old) || (!editId && !file)) return showNotification('حدّث القائمة واختر ملف الإعلان أولًا', 'error');
    const button = posterForm.querySelector('button[type="submit"]');
    const label = document.getElementById('file-chosen-text');
    mediaFormBusy = true; button.disabled = true;
    posterForm.setAttribute('aria-busy', 'true');
    const loader = document.getElementById('global-loader');
    const heading = loader?.querySelector('h3');
    const originalHeading = heading?.textContent;
    const preparation = new AbortController();
    const cancel = document.createElement('button');
    cancel.type='button'; cancel.textContent='إلغاء تجهيز الفيديو'; cancel.hidden=true;
    cancel.style.cssText='margin-top:14px;color:#2A3475;font-weight:700;font-size:13px';
    cancel.addEventListener('click',()=>{cancel.disabled=true;preparation.abort();});
    const stage = (text, phase) => { const el=document.getElementById('loader-text'); if(el)el.textContent=text; cancel.hidden=phase!=='prepare'; };
    if (heading) heading.textContent = file ? 'جاري رفع الإعلان' : 'جاري حفظ التعديلات';
    showLoader('جاري فحص الملف وتجهيز الرفع…');
    let uploadProgress = document.getElementById('media-overlay-progress');
    if (!uploadProgress && loader) {
        uploadProgress = document.createElement('progress'); uploadProgress.id='media-overlay-progress'; uploadProgress.max=100;
        uploadProgress.style.cssText='display:block;width:100%;height:8px;accent-color:#F3A628;margin-top:16px';
        uploadProgress.setAttribute('aria-label','تقدم رفع الإعلان');
        document.getElementById('loader-text')?.after(uploadProgress);
    }
    uploadProgress?.removeAttribute('value');
    uploadProgress?.after(cancel);
    const preventLeave = event => {event.preventDefault();event.returnValue='';};
    window.addEventListener('beforeunload',preventLeave);
    try {
        const metadata = {
            title:document.getElementById('poster-title-input').value.trim(),
            display_order:parseInt(document.getElementById('poster-order-input').value,10) || 1,
            fit_mode:document.getElementById('poster-fit-input').value,
            duration:Math.min(600,Math.max(2,parseInt(document.getElementById('poster-duration-input').value,10)||15)),
            play_sound:document.getElementById('poster-sound-input').checked
        };
        if (!old) metadata.created_by = currentUser?.full_name || 'إداري النظام';
        const result = await window.CITLMediaStorage.save(supabase, {old,metadata,file,stage,signal:preparation.signal,progress:percent => {
            label.textContent = percent < 100 ? `جاري الرفع إلى Cloudflare: ${percent}%` : 'اكتمل الرفع؛ جاري التحقق وحفظ الإعلان…';
            stage(label.textContent);
            if (uploadProgress) uploadProgress.value = percent;
            const progress = document.getElementById('media-upload-progress');
            if (progress) { progress.hidden = false; progress.value = percent; }
        }});
        resetPosterForm();
        await loadTvPosterAdminData();
        notifyTvMediaUpdate();
        showNotification(result.warning || 'تم حفظ الإعلان بنجاح', result.warning ? 'info' : 'success');
    } catch (error) { showNotification(error.message || 'تعذر حفظ الإعلان', 'error'); }
    finally {
        hideLoader();
        uploadProgress?.remove();
        cancel.remove();
        window.removeEventListener('beforeunload',preventLeave);
        if (heading) heading.textContent = originalHeading;
        mediaFormBusy = false; button.disabled = false; posterForm.removeAttribute('aria-busy');
        const progress = document.getElementById('media-upload-progress'); if (progress) progress.hidden = true;
    }
});

// 4. دالة تبديل حالة ظهور البوستر بلحظية تامة دون الحاجة لإعادة الرفع
async function togglePosterActiveState(id, isActive) {
    try {
        const { error } = await supabase
            .from('tv_posters')
            .update({ is_active: isActive })
            .eq('id', id);

        if (error) throw error;
        notifyTvMediaUpdate();
        showNotification(isActive ? 'تم تفعيل ظهور البوستر على الشاشة' : 'تم إخفاء البوستر مؤقتاً');
    } catch (err) {
        console.error('Error toggling poster status:', err);
        showNotification('تعذر تعديل حالة البوستر حالياً', 'error');
    }
}

// 5. جراحة الحذف النظيف الشامل (تنظيف فايل الـ Storage + مسح سجل الـ SQL معاً)
async function deleteTvPosterRecord(id) {
    if (mediaFormBusy) return;
    const row = (window.adminLoadedPosters || []).find(p => String(p.id) === String(id));
    if (!row) return showNotification('حدّث القائمة أولًا', 'error');
    if (!await showConfirmDialog('حذف هذا الإعلان وملفه نهائيًا من الشاشة والتخزين؟')) return;
    mediaFormBusy = true;
    showLoader('جاري حذف الإعلان…');
    try {
        await window.CITLMediaStorage.remove(supabase, row);
        showNotification('تم حذف الإعلان');
    } catch (error) { showNotification(error.message, 'error'); }
    finally { mediaFormBusy = false; hideLoader(); await loadTvPosterAdminData();
        notifyTvMediaUpdate(); }
}

// 6. دالة حفظ إعدادات تفعيل وسرعة دوران البوسترات الإعلانية في site_settings
async function saveTvPosterGlobalConfig() {
    const toggleInput = document.getElementById('poster-global-toggle');
    const rotationInput = document.getElementById('poster-rotation-input');
    if (tvPosterSaving) return;
    if (!tvPosterConfigReady) { showNotification('انتظر تحميل إعدادات البوسترات قبل تغييرها', 'error'); return; }
    
    const enabled = toggleInput ? toggleInput.checked : true;
    const rotationSeconds = parseInt(rotationInput ? rotationInput.value : 8, 10) || 8;
    tvPosterSaving = true;
    if (toggleInput) { toggleInput.disabled = true; toggleInput.setAttribute('aria-busy', 'true'); }

    try {
        const {data: latest, error: readError} = await supabase.from('site_settings').select('setting_value').eq('setting_key','tv_poster_config').maybeSingle();
        if (readError) throw readError;
        const config = { ...(latest?.setting_value || {}), enabled, rotationSeconds: clampTvSeconds(rotationSeconds), updatedAt: Date.now() };
        const { error } = await supabase
            .from('site_settings')
            .upsert({
                setting_key: 'tv_poster_config',
                setting_value: config
            }, { onConflict: 'setting_key' });

        if (error) throw error;
        tvPosterSavedEnabled = enabled;
        publishTvSetting('tv_poster_config', config);
        showNotification(enabled ? 'تم تفعيل البوسترات على الشاشة' : 'تم إيقاف جميع البوسترات على الشاشة');
    } catch (err) {
        console.error('Error saving global poster config:', err);
        if (toggleInput) toggleInput.checked = tvPosterSavedEnabled;
        showNotification('فشل تحديث تفضيلات البوسترات العامة', 'error');
    } finally {
        tvPosterSaving = false;
        if (toggleInput) { toggleInput.disabled = false; toggleInput.removeAttribute('aria-busy'); }
    }
}

// دالة التحديث السريع لوقت وصوت البوستر
window.updatePosterQuickSettings = async function(id, durationStr, playSoundBool) {
    let updates = {};
    if (durationStr !== null) updates.duration = parseInt(durationStr) || 15;
    if (playSoundBool !== null) updates.play_sound = playSoundBool;

    try {
        const { error } = await supabase.from('tv_posters').update(updates).eq('id', id);
        if (error) throw error;
        notifyTvMediaUpdate();
        showNotification('تم تحديث إعدادات البوستر بنجاح ✅');
    } catch (err) {
        console.error(err);
        showNotification('حدث خطأ أثناء التحديث', 'error');
    }
};

// دالة جلب عدد زيارات صفحة الامتحانات
async function fetchExamsVisitsCount() {
    const countEl = document.getElementById('exams-visits-count');
    if(!countEl) return;
    
    try {
        // 🔥 التعديل هنا: استخدمنا window.supabaseAdmin بدلاً من supabase العادي
        const { count, error } = await supabase
            .from('page_visits')
            .select('*', { count: 'exact', head: true });
        
        if (error) throw error;
        
        countEl.textContent = count || 0;
    } catch (err) {
        console.error('خطأ في جلب الزيارات:', err);
        countEl.textContent = 'خطأ';
    }
}

    
