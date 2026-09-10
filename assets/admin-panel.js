// Shared admin operations; host calendar/dashboard entrypoints stay separate.
let activeFacultyDirectoryDepartment = '';

let scheduleInstructorNames = [];

let facultyDirectoryEntries = [];

function openAdminPanel() {
    updateSidebarProfile();

    const allTabs = document.querySelectorAll('.admin-tab');

    if (window.CITLPermissions.full(currentUser)) {
        allTabs.forEach(tab => tab.style.display = 'flex');

        if (typeof updateAdminMeetingsList === 'function') {
            try { updateAdminMeetingsList(); } catch (e) { console.error(e); }
        }

        if (typeof updateAdminUsersList === 'function') {
            try { updateAdminUsersList(); } catch (e) { console.error(e); }
        }

        if (typeof updateAdminReports === 'function') {
            try { updateAdminReports(); } catch (e) {}
        }

        switchAdminTab('users');
        startAdminUsersPresenceLiveRefresh();

    } else {
        allTabs.forEach(tab => {
            if (tab.dataset.tab === 'profile') {
                tab.style.display = 'flex';
            } else {
                tab.style.display = 'none';
            }
        });

        switchAdminTab('profile');
    }

    document.getElementById('admin-panel-modal').classList.add('show');
}

function switchAdminTab(tabName) {
    document.querySelectorAll('.admin-tab').forEach(btn => {
        btn.classList.remove('active', 'bg-gray-100');

        const iconBox = btn.querySelector('div');
        if (iconBox) {
            iconBox.classList.remove('bg-[#2A3475]', 'text-white');
            iconBox.classList.add('bg-gray-100', 'text-gray-500');
        }

        const text = btn.querySelector('span');
        if (text) {
            text.classList.remove('text-[#2A3475]');
            text.classList.add('text-gray-600');
        }
    });

    if (tabName === 'profile' && typeof loadProfileTab === 'function') {
        loadProfileTab();
    }

    if (tabName === 'meetings') {
        if (typeof renderTodayAgenda === 'function') {
            try { renderTodayAgenda(); } catch (e) { console.error(e); }
        }
        if (typeof updateAdminMeetingsList === 'function') {
            try { updateAdminMeetingsList(); } catch (e) { console.error(e); }
        }
    }

    if (tabName === 'users') {
        if (typeof updateAdminUsersList === 'function') {
            try { updateAdminUsersList(); } catch (e) { console.error(e); }
        }
        startAdminUsersPresenceLiveRefresh();
    }

    if (tabName === 'directory' && typeof loadFacultyDirectoryTab === 'function') {
        try {
            loadFacultyDirectoryTab();
        } catch (e) {
            console.error(e);
        }
    }

if (tabName === 'news' && typeof loadNewsConfig === 'function') {
    try { loadNewsConfig(); } catch (e) { console.error(e); }
    // زرع جلب ميتاداتا البوسترات فوراً عند تفعيل التبويب للأدمن
    try { loadTvPosterAdminData(); } catch (e) { console.error(e); }
}

    if (tabName === 'rooms') { initRoomsTab(); }
    if (tabName === 'settings') { loadSystemSettings(); }
    if (tabName === 'reports' && typeof updateAdminReports === 'function') {
        try { updateAdminReports(); } catch (e) { console.error(e); }
    }

    const activeBtn = document.querySelector(`.admin-tab[data-tab="${tabName}"]`);
    if (activeBtn) {
        activeBtn.classList.add('active', 'bg-gray-100');

        const iconBox = activeBtn.querySelector('div');
        if (iconBox) {
            iconBox.classList.remove('bg-gray-100', 'text-gray-500');
            iconBox.classList.add('bg-[#2A3475]', 'text-white');
        }

        const text = activeBtn.querySelector('span');
        if (text) {
            text.classList.remove('text-gray-600');
            text.classList.add('text-[#2A3475]');
        }
    }

    document.querySelectorAll('.admin-tab-content').forEach(content => {
        content.classList.add('hidden');
    });

    const targetContent = document.getElementById(`admin-${tabName}-tab`);
    if (targetContent) {
        targetContent.classList.remove('hidden');
    }
}

async function updateAdminMeetingsList() {
            await loadAdminMeetingCatalog();
            filterAdminMeetings('all'); // افتراضياً يعرض الكل
        }

function filterAdminMeetings(type) {
            const meetings = window.CITLAdminMeetings || [];
            // 1. تحديث شكل الأزرار
            document.querySelectorAll('.filter-btn').forEach(btn => {
                btn.classList.remove('bg-[#2A3475]', 'text-white', 'shadow-sm');
                btn.classList.add('text-gray-500', 'hover:bg-gray-50');
            });
            
            const activeBtn = document.getElementById(`filter-${type}`);
            if(activeBtn) {
                activeBtn.classList.remove('text-gray-500', 'hover:bg-gray-50');
                activeBtn.classList.add('bg-[#2A3475]', 'text-white', 'shadow-sm');
            }

            // 2. الفلترة الفعلية
            const now = new Date();
            now.setHours(0,0,0,0); // تصفير الوقت للمقارنة باليوم

            let filteredMeetings = [];
            
            if (type === 'all') {
                filteredMeetings = meetings;
            } else if (type === 'upcoming') {
                filteredMeetings = meetings.filter(m => new Date(m.date) >= now);
            } else if (type === 'past') {
                filteredMeetings = meetings.filter(m => new Date(m.date) < now);
            }

            // 3. إعادة رسم الجدول بالبيانات المفلترة
            renderAdminMeetingsTable(filteredMeetings);
        }

async function updateAdminUsersList() {
    if (typeof updateSidebarProfile === 'function') updateSidebarProfile();

    const activeUsersList = document.getElementById('active-users-list');
    const countBadge = document.getElementById('users-count-badge');
    const filterDept = document.getElementById('filter-users-dept') ? document.getElementById('filter-users-dept').value : '';
    const deptStats = document.getElementById('department-stats');

    if (activeUsersList) {
        if (activeUsersList && !activeUsersList.querySelector('tr[data-user-id]')) {
    activeUsersList.innerHTML = '<tr><td colspan="6" class="text-center py-8"><i class="fas fa-spinner fa-spin text-[#2A3475] text-2xl"></i></td></tr>';
}
    }

    try {
        let { data: users, error } = await supabase
            .from('profiles')
            .select('*')
            .order('created_at', { ascending: false });

        if (error) throw error;

        const totalAdmins = users.filter(u => u.role === 'manager').length;
        const totalNormal = users.length - totalAdmins;

        if (document.getElementById('stats-total-users')) document.getElementById('stats-total-users').textContent = users.length;
        if (document.getElementById('stats-total-admins')) document.getElementById('stats-total-admins').textContent = totalAdmins;
        if (document.getElementById('stats-total-normal')) document.getElementById('stats-total-normal').textContent = totalNormal;

        if (filterDept) users = users.filter(u => u.department === filterDept);

        if (countBadge) countBadge.textContent = `${users.length} مستخدم`;

        if (activeUsersList) {
            activeUsersList.innerHTML = '';

            if (users.length === 0) {
                activeUsersList.innerHTML = '<tr><td colspan="6" class="text-center py-8 text-gray-400">لا توجد نتائج</td></tr>';
            } else {
                users.forEach(user => {
                    const isFounderRow = user.email?.trim().toLowerCase() === 'fekrythug@gmail.com';
                    const isMe = currentUser && user.id === currentUser.id;

                    let deptName = user.department;
                    if (typeof departments !== 'undefined' && departments[user.department]) {
                        deptName = departments[user.department].name;
                    }

                    const position = user.position || '---';

                    const mobileDisplay = user.mobile
                        ? `<div class="text-[10px] text-[#2A3475] font-bold font-sans mt-0.5 flex items-center gap-1" title="${user.mobile}">
                                <i class="fas fa-phone-alt text-gray-400 text-[9px]"></i> ${user.mobile}
                           </div>`
                        : '';

                    const roleBadge = user.role === 'manager'
                        ? '<span class="px-2 py-1 bg-red-50 text-red-700 text-[10px] font-bold rounded border border-red-100">مدير</span>'
                        : '<span class="px-2 py-1 bg-blue-50 text-blue-700 text-[10px] font-bold rounded border border-blue-100">مستخدم</span>';

                    const isOnline = window.presenceTracker?.isOnline(user.last_seen_at) || user.presence_status === 'online';
                    const presenceDot = window.presenceTracker?.dotHtml(user.last_seen_at)
                        || `<span class="inline-flex w-2.5 h-2.5 rounded-full ${isOnline ? 'bg-green-500' : 'bg-gray-300'}"></span>`;

                    const lastSeenText = user.last_seen_at
                        ? new Date(user.last_seen_at).toLocaleString('ar-EG')
                        : 'لم يظهر بعد';

                    const actionBtns = (() => {
                        if (isFounderRow) {
                            if (isMe) {
                                return `
                                    <div class="flex justify-center gap-1">
                                        <button onclick="openEditUserInfo('${user.id}', '${user.full_name || ''}', '${user.department || ''}', '${user.position || ''}', '${user.mobile || ''}')" class="w-7 h-7 flex items-center justify-center rounded-full bg-blue-50 hover:bg-blue-600 hover:text-white text-blue-600 transition-colors" title="تعديل بياناتي">
                                            <i class="fas fa-pen text-xs"></i>
                                        </button>
                                        <span class="text-[10px] text-gray-400 mx-1 bg-yellow-100 text-yellow-700 px-2 py-1 rounded border border-yellow-200 font-bold">أنت</span>
                                    </div>
                                `;
                            }
                            return `
                                <div class="flex justify-center items-center">
                                    <div class="px-3 py-1 bg-[#F3A628] text-white rounded-full shadow-sm flex items-center gap-2 cursor-help" title="حساب المؤسس">
                                        <i class="fas fa-shield-alt text-xs"></i>
                                        <span class="text-[10px] font-bold">المؤسس</span>
                                    </div>
                                </div>
                            `;
                        }

                        let html = `<div class="flex justify-center gap-1">`;
                        html += `<button onclick="openEditUserInfo('${user.id}', '${user.full_name || ''}', '${user.department || ''}', '${user.position || ''}', '${user.mobile || ''}')" class="w-7 h-7 flex items-center justify-center rounded-full bg-gray-100 hover:bg-[#2A3475] hover:text-white text-gray-500 transition-colors" title="تعديل"><i class="fas fa-pen text-xs"></i></button>`;

                        if (!isMe) {
                            const permString = encodeURIComponent(JSON.stringify(user.permissions || {}));
                            html += `<button onclick="openPermissionsModal('${user.id}', '${user.full_name}', '${permString}')" class="w-7 h-7 flex items-center justify-center rounded-full bg-gray-100 hover:bg-[#2A3475] hover:text-white text-gray-500 transition-colors" title="الصلاحيات"><i class="fas fa-user-cog text-xs"></i></button>`;
                            html += `<button onclick="deleteUser('${user.id}', '${user.full_name}')" class="w-7 h-7 flex items-center justify-center rounded-full bg-red-50 hover:bg-red-600 hover:text-white text-red-500 transition-colors" title="حذف"><i class="fas fa-trash-alt text-xs"></i></button>`;
                        } else {
                            html += `<span class="text-[10px] text-gray-400 mx-1 bg-gray-100 px-2 py-1 rounded">أنت</span>`;
                        }

                        html += `</div>`;
                        return html;
                    })();

                    const statusBlock = `
                        <div class="flex flex-col items-center justify-center text-center gap-1">
                            <span data-presence-badge class="px-2 py-1 rounded-full text-[11px] font-bold ${isOnline ? 'bg-green-50 text-green-700 border border-green-100' : 'bg-gray-100 text-gray-500 border border-gray-200'}">
                                ${isOnline ? 'Online' : 'Offline'}
                            </span>
                            <span data-presence-subtext class="text-[10px] text-gray-400 font-bold leading-4 text-center">
                                ${formatLastSeenShort(user.last_seen_at)}
                            </span>
                        </div>
                    `;

                    const tr = document.createElement('tr');
                    tr.dataset.userId = user.id || '';
                    tr.className = 'border-b border-gray-50 hover:bg-gray-50 transition-colors';

                    if (isFounderRow) {
                        tr.className += ' bg-yellow-50/30';
                        tr.style.borderRight = '3px solid #F3A628';
                    }

                    tr.innerHTML = `
<td class="px-4 py-3">
    <div class="min-w-0">
        <div class="font-bold text-gray-800 text-sm truncate max-w-[220px] flex items-center gap-2" title="${user.full_name || ''}">
            <span data-name-dot class="inline-flex w-2.5 h-2.5 rounded-full ${isOnline ? 'bg-green-500' : 'bg-gray-300'}"></span>
            <span>${user.full_name || 'مستخدم'}</span>
            ${isFounderRow ? '<i class="fas fa-crown text-[#F3A628] text-[10px]" title="المؤسس"></i>' : ''}
        </div>
        <div class="text-[10px] text-gray-400 truncate max-w-[220px] font-sans">${user.email || ''}</div>
        ${mobileDisplay}
    </div>
</td>

<td class="px-4 py-3 text-sm text-gray-700 font-medium max-w-[140px] truncate" title="${position}">
    ${position}
</td>

<td class="px-4 py-3 text-sm text-gray-600 max-w-[150px]">
    <div class="truncate" title="${deptName || ''}">${deptName || '—'}</div>
</td>

<td class="px-4 py-3 text-center align-middle">
    ${statusBlock}
</td>

<td class="px-4 py-3">
    ${roleBadge}
</td>

<td class="px-4 py-3 text-center">
    ${actionBtns}
</td>
`;

activeUsersList.appendChild(tr);
                });
            }
        }

        if (deptStats) {
            deptStats.innerHTML = '';
            const deptCounts = {};

            users.forEach(u => {
                if (u.department) {
                    const dName = departments[u.department] ? departments[u.department].name : u.department;
                    deptCounts[dName] = (deptCounts[dName] || 0) + 1;
                }
            });

            if (Object.keys(deptCounts).length === 0) {
                deptStats.innerHTML = '<div class="col-span-full text-center text-gray-400 py-4 text-xs">لا توجد بيانات نشطة</div>';
            } else {
                Object.entries(deptCounts)
                    .sort((a, b) => b[1] - a[1])
                    .forEach(([dName, count]) => {
                        deptStats.innerHTML += `
                            <div class="flex justify-between items-center p-3 bg-gray-50 rounded-lg border border-gray-100">
                                <span class="text-gray-700 font-bold text-xs truncate ml-2">${dName}</span>
                                <span class="bg-[#2A3475] text-white px-2 py-0.5 rounded text-xs font-bold">${count}</span>
                            </div>
                        `;
                    });
            }
        }

    } catch (err) {
        console.error(err);
        if (activeUsersList) {
            activeUsersList.innerHTML = '<tr><td colspan="6" class="text-center text-red-500 py-4">فشل التحميل</td></tr>';
        }
    }
}

async function updateAdminReports() {
    await loadAdminMeetingCatalog();
    const meetings = window.CITLAdminMeetings || [];
    
    /* ===============================
       Guards & Empty State
    ================================ */
    const monthlyChart = document.getElementById('monthly-usage-chart');
    const peakChart    = document.getElementById('peak-times-chart');
    const analytics    = document.getElementById('detailed-analytics');

    // دالة مساعدة لتحويل الوقت إلى دقائق (يجب التأكد من وجودها خارج هذه الدالة)
    const timeToMinutes = (time) => {
        if (!time) return 0;
        const [h, m] = time.split(':').map(Number);
        return h * 60 + m;
    };

    if (!Array.isArray(meetings) || meetings.length === 0) {
        monthlyChart.innerHTML = `<div class="text-center text-gray-400 text-sm py-6">لا توجد بيانات بعد</div>`;
        peakChart.innerHTML    = `<div class="text-center text-gray-400 text-sm py-6">لا توجد بيانات بعد</div>`;
        analytics.innerHTML    = `<div class="text-center text-gray-400 text-sm py-6">لا توجد بيانات لتحليلها</div>`;
        return;
    }

    /* ===============================
       Monthly usage chart - Fixed Dynamic Range
    ================================ */
    monthlyChart.innerHTML = '';
    
    const monthNames = [
        'يناير','فبراير','مارس','أبريل','مايو','يونيو',
        'يوليو','أغسطس','سبتمبر','أكتوبر','نوفمبر','ديسمبر'
    ];

    // 1. Pre-calc meetings by YYYY-MM key and find report start/max count
    const meetingsByMonth = {};
    let maxMonthlyCount = 0;
    let earliestDate = new Date(); // يبدأ من التاريخ الحالي
    let hasValidDate = false;

    meetings.forEach(m => {
        if (!m.date) return;
        const d = new Date(m.date);
        
        // تحديث أقدم تاريخ حقيقي للحجز
        if (d < earliestDate) earliestDate = d;
        hasValidDate = true;
        
        // Key is YYYY-MM (الأكثر دقة لحساب الشهور والسنين)
        const key = `${d.getFullYear()}-${d.getMonth()}`; 
        meetingsByMonth[key] = (meetingsByMonth[key] || 0) + 1;
        
        if (meetingsByMonth[key] > maxMonthlyCount) maxMonthlyCount = meetingsByMonth[key];
    });
    
    if (!hasValidDate) {
        monthlyChart.innerHTML = '<div class="text-center text-gray-400 text-sm py-6">لا توجد حجوزات في الفترة المحددة</div>';
        return;
    }

    // تحديد نطاق التقرير (من أقدم حجز حتى الشهر الحالي)
    let startMonth = earliestDate.getMonth();
    let startYear  = earliestDate.getFullYear();

    const now = new Date();
    let endMonth = now.getMonth();
    let endYear  = now.getFullYear();

    // 2. إنشاء الشرائح الشهرية
    let m = startMonth;
    let y = startYear;
    let chartHTML = '';
    const scale = maxMonthlyCount > 0 ? maxMonthlyCount : 10;
    let totalMonthsInReport = 0; 

    // الشرط: استمر في الحلقة طالما لم نصل إلى الشهر التالي للشهر الحالي (كحد أقصى 12 شهر)
    while ((y < endYear || (y === endYear && m <= endMonth)) && totalMonthsInReport < 12) {
        
        const key = `${y}-${m}`;
        const count = meetingsByMonth[key] || 0;
        const percentage = Math.min(Math.round((count / scale) * 100), 100);
        
        chartHTML += `
            <div class="flex items-center space-x-3 space-x-reverse">
                <div class="w-24 text-sm text-gray-600 font-bold">
                    ${monthNames[m]} ${y}
                </div>
                <div class="flex-1 bg-gray-200 rounded-full h-4">
                    <div class="bg-[#2A3475] hover:bg-[#1f2658] h-4 rounded-full transition-all"
                         style="width:${percentage}%"></div>
                </div>
                <div class="w-8 text-sm text-gray-600">${count}</div>
            </div>
        `;

        // الانتقال للشهر التالي
        m++;
        if (m > 11) {
            m = 0;
            y++;
        }
        totalMonthsInReport++; 
    }

    // 3. عرض النتيجة
    monthlyChart.innerHTML = chartHTML;


    /* ===============================
       Peak times chart - Hourly Occupancy (أوقات الذروة)
    ================================ */
    peakChart.innerHTML = '';

    const timeUsage = {};
    let maxHourlyCount = 0; 
    const confirmedMeetings = meetings.filter(m => m.status === 'confirmed'); 

    confirmedMeetings.forEach(meeting => {
        if (!meeting.startTime || !meeting.endTime) return;
        
        const startHour = parseInt(meeting.startTime.split(':')[0]);
        const endHour = parseInt(meeting.endTime.split(':')[0]);
        
        for(let h = startHour; h < endHour; h++) {
            timeUsage[h] = (timeUsage[h] || 0) + 1;
            if (timeUsage[h] > maxHourlyCount) maxHourlyCount = timeUsage[h];
        }
    });

    if (Object.keys(timeUsage).length === 0) {
        peakChart.innerHTML = `<div class="text-center text-gray-400 text-sm py-6">لا توجد بيانات لعرض أوقات الذروة</div>`;
    } else {
        const hourlyScale = maxHourlyCount > 0 ? maxHourlyCount : 10;
        
        Object.keys(timeUsage).sort((a,b) => a-b).forEach(hour => {
            const count = timeUsage[hour];
            const percentage = Math.round((count / hourlyScale) * 100);

            peakChart.innerHTML += `
                <div class="flex items-center space-x-3 space-x-reverse">
                    <div class="w-16 text-sm text-gray-600 font-bold">${hour}:00</div>
                    <div class="flex-1 bg-gray-200 rounded-full h-4">
                        <div class="bg-[#F3A628] h-4 rounded-full transition-all"
                             style="width:${percentage}%"></div>
                    </div>
                    <div class="w-8 text-sm text-gray-600">${count}</div>
                </div>
            `;
        });
    }

    /* ===============================
       Detailed analytics - Occupancy Rate (الإحصائيات المفصلة)
    ================================ */
    const uniqueDepts = new Set(meetings.map(m => m.department)).size;
    
    const totalHoursBooked = meetings.reduce((sum, meeting) => {
        const startMin = timeToMinutes(meeting.startTime);
        const endMin = timeToMinutes(meeting.endTime);
        const durationMin = endMin > startMin ? endMin - startMin : 0;
        return sum + (durationMin / 60); 
    }, 0);

    // حساب الفترة الزمنية للتقرير ديناميكياً
    const oneDay = 24 * 60 * 60 * 1000;
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const reportStartDate = new Date(startYear, startMonth, 1);
    const totalDays = Math.round((today.getTime() - reportStartDate.getTime()) / oneDay) + 1; // +1 لليوم الحالي

    // إجمالي ساعات العمل المتاحة (نفترض 10 ساعات عمل يومياً * 5 أيام أسبوعياً)
    // 10/7: متوسط ساعات العمل اليومية
    const availableWorkHours = totalDays * (10 * (5/7)); 
    
    const occupancyPercentage = availableWorkHours > 0 
                                ? Math.round((totalHoursBooked / availableWorkHours) * 100)
                                : 0;

    analytics.innerHTML = `
        <div class="bg-white p-4 rounded-lg border">
            <div class="text-2xl font-bold text-[#2A3475]">${meetings.length}</div>
            <div class="text-sm text-gray-600">إجمالي الحجوزات</div>
        </div>

        <div class="bg-white p-4 rounded-lg border">
            <div class="text-2xl font-bold text-green-600">${uniqueDepts}</div>
            <div class="text-sm text-gray-600">الأقسام النشطة</div>
        </div>

        <div class="bg-white p-4 rounded-lg border">
            <div class="text-2xl font-bold text-[#F3A628]">
                ${occupancyPercentage}%
            </div>
            <div class="text-sm text-gray-600">معدل الإشغال الكلي</div>
        </div>
    `;
}

function loadProfileTab() {
    if(!currentUser) return;
    
    // 1. تعبئة الخانات النصية العادية
    const nameInput = document.getElementById('tab-my-name');
    const mobileInput = document.getElementById('tab-my-mobile');
    const emailInput = document.getElementById('tab-my-email');
    const posInput = document.getElementById('tab-my-position');
    
    if(nameInput) nameInput.value = currentUser.full_name || '';
    if(mobileInput) mobileInput.value = currentUser.mobile || '';
    if(emailInput) emailInput.value = currentUser.email || '';
    if(posInput) posInput.value = currentUser.position || '';

    // 2. تعبئة القائمة المنسدلة للقسم (الجزء المهم للإصلاح)
    const deptInput = document.getElementById('tab-my-dept');
    if(deptInput) {
        const val = currentUser.department || '';
        deptInput.value = val; // وضع القيمة في الحقل المخفي

        // تحديث الشكل الخارجي (النص الظاهر)
        const wrapper = deptInput.closest('.custom-dropdown');
        if(wrapper) {
            const displaySpan = wrapper.querySelector('.custom-dropdown-display span');
            // البحث عن الخيار المطابق للقيمة لجلب اسمه العربي
            const matchingOption = wrapper.querySelector(`.custom-option[data-value="${val}"]`);
            
            if(displaySpan) {
                if(matchingOption) {
                    displaySpan.textContent = matchingOption.textContent.trim(); // يكتب "مكتب العميد" بدلاً من الكود
                    displaySpan.classList.add('text-[#2A3475]', 'font-bold');
                } else {
                    displaySpan.textContent = 'اختر الجهة...';
                    displaySpan.classList.remove('text-[#2A3475]', 'font-bold');
                }
            }
        }
    }
}

async function renderTodayAgenda() {
    const body = document.getElementById('agenda-list-body');
    const today = new Intl.DateTimeFormat('en-CA',{timeZone:'Africa/Cairo'}).format(new Date());
    document.getElementById('agenda-display-date').textContent = new Date().toLocaleDateString('ar-EG', {month:'long', day:'numeric'});

    body.innerHTML = '<tr><td colspan="3" class="text-center py-10 opacity-50">جاري التحميل...</td></tr>';

    try {
        const { data: meetings, error: agendaError } = await supabase
            .from('meetings')
            .select('*')
            .eq('date', today)
            .eq('status', 'confirmed')
            .order('start_time', { ascending: true });

        if (agendaError) throw agendaError;

        if (!meetings || meetings.length === 0) {
            body.innerHTML = '<tr><td colspan="3" class="text-center py-20 text-gray-400 font-bold">لا توجد اجتماعات مسجلة لليوم</td></tr>';
            return;
        }

        body.innerHTML = meetings.map(m => `
            <tr class="hover:bg-blue-50/30 transition-colors">
                <td class="px-6 py-5 font-black text-[#2A3475]">${m.start_time}</td>
                <td class="px-6 py-5">
                    <div class="font-bold text-slate-800">${m.title || 'اجتماع مجلس'}</div>
                    <div class="text-[9px] text-gray-400 uppercase">Council Chamber</div>
                </td>
                <td class="px-6 py-5 text-center">
                    <span class="px-3 py-1 bg-green-50 text-green-600 rounded-full text-[10px] font-black border border-green-100">مؤكد</span>
                </td>
            </tr>
        `).join('');
    } catch (e) { console.error(e); }
}

let rooms = [];
let currentRoomId = null;
let currentRoom = null;
let editingRoomId = null;

const ROOM_STORAGE_KEY = 'selected_room_id';

async function loadRooms() {
    const { data, error } = await supabase
        .from('rooms')
        .select('*')
        .order('created_at', { ascending: true });

    if (error) throw error;
    rooms = data || [];
}

function updateRoomHeaderUI() {
    const nameEl = document.getElementById('room-name');
    const capEl  = document.getElementById('room-capacity');
    const featEl = document.getElementById('room-features');

    if (!currentRoom) return;

    if (nameEl) nameEl.textContent = currentRoom.name ?? '—';
    if (capEl) capEl.innerHTML  = `<i class="fas fa-chair ml-1.5 text-[#F3A628]"></i> السعة: ${currentRoom.capacity ?? '—'} أشخاص`;
    if (featEl) featEl.innerHTML = `<i class="fas fa-wifi ml-1.5 text-[#F3A628]"></i> ${currentRoom.features ?? '—'}`;
}

function ensureRoomPickerUI() {
    if (document.getElementById('room-picker-modal')) return;

    const div = document.createElement('div');
    div.id = 'room-picker-modal';
    div.className = 'fixed inset-0 z-[3000] bg-black/40 hidden items-center justify-center p-4';

    div.innerHTML = `
        <div class="bg-white w-full max-w-3xl rounded-2xl shadow-2xl overflow-hidden">
            <div class="metallic-blue-fill random-slanted-lines px-5 py-4 text-white flex items-center justify-between">
                <div class="font-black text-base md:text-lg">
                    اختر القاعة
                    <div class="text-[11px] text-blue-100 font-bold mt-1">كل قاعة لها حجوزات وإحصائيات ولوحة تحكم مستقلة</div>
                </div>
                <button type="button" onclick="closeRoomPicker()" class="bg-white/10 hover:bg-white/20 px-3 py-2 rounded-xl font-bold">إغلاق</button>
            </div>

            <div class="p-5">
                <div id="rooms-grid" class="grid grid-cols-1 md:grid-cols-2 gap-4"></div>
            </div>
        </div>
    `;

    document.body.appendChild(div);
}

async function openRoomPicker() {
    ensureRoomPickerUI();

    // لو القاعات لسه متجابتش
    if (!rooms || rooms.length === 0) {
        try { await loadRooms(); } catch(e) {
            console.error(e);
            return showNotification('تعذر تحميل القاعات من قاعدة البيانات', 'error');
        }
    }

    const modal = document.getElementById('room-picker-modal');
    const grid  = document.getElementById('rooms-grid');

    grid.innerHTML = (rooms || []).map(r => `
        <button
            type="button"
            class="text-right bg-gray-50 hover:bg-white border border-gray-200 hover:border-[#2A3475]/40 rounded-2xl p-4 shadow-sm hover:shadow-md transition-all"
            onclick="selectRoom('${r.id}')"
        >
            <div class="text-[#2A3475] font-black text-base mb-2">${r.name}</div>
            <div class="text-gray-600 text-sm font-bold">
                السعة: ${r.capacity ?? '—'} أشخاص
                <span class="text-gray-300 mx-2">|</span>
                ${r.features ?? '—'}
            </div>
            ${String(r.id) === String(currentRoomId) ? `<div class="text-[10px] font-black text-green-700 mt-2">القــاعة الحالية</div>` : ``}
        </button>
    `).join('');

    modal.classList.remove('hidden');
    modal.classList.add('flex');
}

function closeRoomPicker() {
    const modal = document.getElementById('room-picker-modal');
    if (!modal) return;
    modal.classList.add('hidden');
    modal.classList.remove('flex');
}

async function selectRoom(roomId) {
    currentRoomId = roomId;
    localStorage.setItem(ROOM_STORAGE_KEY, roomId);

    currentRoom = rooms.find(r => String(r.id) === String(roomId)) || null;
    updateRoomHeaderUI();

    await loadMeetings();      // مهم: تحميل حجوزات القاعة فقط (بعد تعديل loadMeetings بالخطوة 2)
    refreshAllViews();         // يحدّث الإحصائيات/لوحة التحكم/التقارير
    closeRoomPicker();
}

function restoreSelectedRoom() {
    const saved = localStorage.getItem(ROOM_STORAGE_KEY);
    if (!saved) return false;

    const found = rooms.find(r => String(r.id) === String(saved));
    if (!found) return false;

    currentRoomId = found.id;
    currentRoom = found;
    updateRoomHeaderUI();
    return true;
}

// -------------------- Rooms Admin (CRUD) --------------------
function ensureRoomsManagerUI() {
    if (document.getElementById('rooms-manager-modal')) return;

    const div = document.createElement('div');
    div.id = 'rooms-manager-modal';
    div.className = 'fixed inset-0 z-[3500] bg-black/40 hidden items-center justify-center p-4';

    div.innerHTML = `
        <div class="bg-white w-full max-w-4xl rounded-2xl shadow-2xl overflow-hidden">
            <div class="metallic-blue-fill random-slanted-lines px-5 py-4 text-white flex items-center justify-between">
                <div class="font-black text-base md:text-lg">
                    إدارة القاعات
                    <div class="text-[11px] text-blue-100 font-bold mt-1">إضافة/تعديل/حذف + سعة + تجهيزات</div>
                </div>
                <button type="button" onclick="closeRoomsManager()" class="bg-white/10 hover:bg-white/20 px-3 py-2 rounded-xl font-bold">إغلاق</button>
            </div>

            <div class="p-5 grid grid-cols-1 md:grid-cols-2 gap-5">
                <div class="border rounded-2xl p-3">
                    <div class="font-black text-[#2A3475] mb-3">القاعات</div>
                    <div id="rooms-admin-list" class="space-y-2 max-h-[420px] overflow-auto"></div>
                </div>

                <div class="border rounded-2xl p-4">
                    <div class="font-black text-[#2A3475] mb-3">بيانات القاعة</div>

                    <div class="space-y-3">
                        <div>
                            <label class="block text-sm font-bold text-gray-600 mb-1">اسم القاعة</label>
                            <input id="room-edit-name" class="w-full border rounded-xl px-3 py-2 font-bold" placeholder="مثال: قاعة G004">
                        </div>

                        <div>
                            <label class="block text-sm font-bold text-gray-600 mb-1">السعة</label>
                            <input id="room-edit-capacity" type="number" class="w-full border rounded-xl px-3 py-2 font-bold" placeholder="مثال: 50">
                        </div>

                        <div>
                            <label class="block text-sm font-bold text-gray-600 mb-1">التجهيزات</label>
                            <textarea id="room-edit-features" class="w-full border rounded-xl px-3 py-2 font-bold" rows="3" placeholder="مثال: شاشة ذكية، بروجيكتور..."></textarea>
                        </div>

                        <div class="flex flex-wrap gap-2">
                            <button type="button" onclick="saveRoom()" class="px-4 py-2 rounded-xl font-black bg-[#2A3475] text-white hover:opacity-90">حفظ</button>
                            <button type="button" onclick="resetRoomForm()" class="px-4 py-2 rounded-xl font-black bg-gray-100 hover:bg-gray-200">جديد</button>
                            <button type="button" onclick="deleteRoom()" class="px-4 py-2 rounded-xl font-black bg-red-600 text-white hover:opacity-90">حذف</button>
                        </div>

                        <div class="text-[11px] text-gray-500 font-bold">
                            * لا يمكن حذف القاعة الحالية — اختر قاعة أخرى أولاً
                        </div>
                    </div>
                </div>
            </div>
        </div>
    `;

    document.body.appendChild(div);
}

async function openRoomsManager() {
  // بدلاً من مودال: افتح تبويب القاعات داخل لوحة التحكم
  switchAdminTab('rooms');
  await initRoomsTab();
}

async function initRoomsTab() {
  if (!rooms || rooms.length === 0) {
    try { await loadRooms(); }
    catch (e) {
      console.error(e);
      return showNotification('تعذر تحميل القاعات من قاعدة البيانات', 'error');
    }
  }

  renderRoomsAdminList();
  resetRoomForm();
}


function closeRoomsManager() {
    const modal = document.getElementById('rooms-manager-modal');
    if (!modal) return;
    modal.classList.add('hidden');
    modal.classList.remove('flex');
}

function renderRoomsAdminList() {
    const el = document.getElementById('rooms-admin-list');
    if (!el) return;

    el.innerHTML = (rooms || []).map(r => `
        <button type="button"
            class="w-full text-right p-3 rounded-xl border hover:bg-gray-50 transition-all"
            onclick="pickRoomForEdit('${r.id}')"
        >
            <div class="font-black text-[#2A3475]">${r.name}</div>
            <div class="text-xs font-bold text-gray-600">
                السعة: ${r.capacity ?? '—'} | ${r.features ?? '—'}
            </div>
            ${String(r.id) === String(currentRoomId) ? `<div class="text-[10px] font-black text-green-700 mt-1">القــاعة الحالية</div>` : ``}
        </button>
    `).join('');
}

function pickRoomForEdit(id) {
    const r = rooms.find(x => String(x.id) === String(id));
    if (!r) return;

    editingRoomId = r.id;
    document.getElementById('room-edit-name').value = r.name ?? '';
    document.getElementById('room-edit-capacity').value = r.capacity ?? '';
    document.getElementById('room-edit-features').value = r.features ?? '';
}

function resetRoomForm() {
    editingRoomId = null;
    document.getElementById('room-edit-name').value = '';
    document.getElementById('room-edit-capacity').value = '';
    document.getElementById('room-edit-features').value = '';
}

async function saveRoom() {
    const name = document.getElementById('room-edit-name').value.trim();
    const capacity = Number(document.getElementById('room-edit-capacity').value || 0);
    const features = document.getElementById('room-edit-features').value.trim();

    if (!name) return showNotification('اكتب اسم القاعة', 'error');

    if (editingRoomId) {
        const { error } = await supabase.from('rooms')
            .update({ name, capacity, features })
            .eq('id', editingRoomId);

        if (error) return showNotification('فشل التعديل', 'error');
    } else {
        const { error } = await supabase.from('rooms')
            .insert([{ name, capacity, features }]);

        if (error) return showNotification('فشل الإضافة', 'error');
    }

    await loadRooms();
    renderRoomsAdminList();

    // لو القاعة الحالية اتعدلت بياناتها → حدّث الهيدر فوراً
    if (currentRoomId) {
        currentRoom = rooms.find(r => String(r.id) === String(currentRoomId)) || currentRoom;
        updateRoomHeaderUI();
    }

    showNotification('تم الحفظ ✅', 'success');
}

async function deleteRoom() {
    // 1. التأكد من اختيار قاعة
    if (!editingRoomId) return showNotification('برجاء اختيار قاعة من القائمة أولاً لتعديلها أو حذفها', 'info');

    // 2. منع حذف القاعة النشطة حالياً لتجنب انهيار الواجهة
    if (String(editingRoomId) === String(currentRoomId)) {
        return showNotification('لا يمكن حذف القاعة التي تتصفحها حالياً. اختر قاعة أخرى من الواجهة الرئيسية أولاً.', 'error');
    }

    // 3. تأكيد الحذف من المستخدم
    const ok = await showConfirmDialog('⚠️ تحذير: هل أنت متأكد من حذف هذه القاعة نهائياً؟ (سيؤدي ذلك لفقدان بيانات القاعة)');
    if (!ok) return;

    if (typeof showLoader === 'function') showLoader('جاري حذف القاعة...');

    // 4. محاولة الحذف من Supabase
    const { error } = await supabase.from('rooms').delete().eq('id', editingRoomId);

    if (error) {
        if (typeof hideLoader === 'function') hideLoader();
        console.error('Database Delete Error:', error);

        // معالجة خطأ 23503 (وجود اجتماعات مرتبطة بالقاعة)
        if (error.code === '23503' || error.message.includes('foreign key constraint')) {
            return showNotification('فشل الحذف: القاعة تحتوي على اجتماعات مسجلة. يجب حذف الاجتماعات المرتبطة بها أولاً، أو تفعيل خيار الحذف التلقائي (CASCADE) من قاعدة البيانات.', 'error');
        }

        return showNotification('حدث خطأ أثناء الحذف: ' + error.message, 'error');
    }

    // 5. التحديث بعد النجاح
    resetRoomForm();
    
    // جلب البيانات الجديدة وتحديث القوائم
    if (typeof loadRooms === 'function') await loadRooms();
    if (typeof renderRoomsAdminList === 'function') renderRoomsAdminList();
    
    // تحديث القائمة المنسدلة في الواجهة الرئيسية إذا لزم الأمر
    const selector = document.getElementById('room-selector');
    if (selector && typeof rooms !== 'undefined') {
        selector.innerHTML = rooms.map(r => `<option value="${r.id}">${r.name}</option>`).join('');
    }

    if (typeof hideLoader === 'function') hideLoader();
    showNotification('تم حذف القاعة بنجاح ✅', 'success');
}




function getDepartmentDisplayName(deptKey) {
    if (typeof departments !== 'undefined' && departments[deptKey] && departments[deptKey].name) {
        return departments[deptKey].name;
    }
    return deptKey || '—';
}

function getDirectoryAvatarText(fullName) {
    const parts = String(fullName || '').trim().split(/\s+/).filter(Boolean);
    if (parts.length === 0) return '؟';
    if (parts.length === 1) return parts[0].substring(0, 1);
    return (parts[0][0] || '') + (parts[1][0] || '');
}

function getDirectoryAvatarColor(fullName) {
    const colors = [
        'bg-[#2A3475]',
        'bg-emerald-600',
        'bg-blue-600',
        'bg-purple-600',
        'bg-amber-500',
        'bg-rose-500'
    ];

    const name = String(fullName || '');
    let hash = 0;
    for (let i = 0; i < name.length; i++) {
        hash = name.charCodeAt(i) + ((hash << 5) - hash);
    }

    return colors[Math.abs(hash) % colors.length];
}

async function loadFacultyDirectoryEntries() {
    const { data, error } = await supabase
        .from('faculty_directory')
        .select('*')
        .order('full_name', { ascending: true });

    if (error) throw error;

    facultyDirectoryEntries = data || [];
}

function normalizeDirectoryName(value) {
    return String(value || '').trim().replace(/\s+/g, ' ');
}

function updateNativeSelectDisplay(selectId) {
    const select = document.getElementById(selectId);
    if (!select) return;

    const wrapper = select.closest('.native-select-shell');
    if (!wrapper) return;

    const textEl = wrapper.querySelector('.native-select-text');
    if (!textEl) return;

    const selectedText = select.options[select.selectedIndex]?.text || select.options[0]?.text || 'اختر...';
    textEl.textContent = selectedText;
}

const DIRECTORY_CUSTOM_VALUE = '__custom__';

function escapeDirectoryText(value) {
    return String(value || '')
        .replace(/&/g, '&amp;')
        .replace(/"/g, '&quot;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');
}

function setDirectoryOtherInput(inputId, show, value) {
    const input = document.getElementById(inputId);
    if (!input) return;

    input.classList.toggle('hidden', !show);
    input.disabled = !show;

    if (show && typeof value === 'string') {
        input.value = value;
    }

    if (!show) {
        input.value = '';
    }
}

function handleDirectoryNameChoice() {
    const select = document.getElementById('faculty-directory-name');
    const isCustom = select?.value === DIRECTORY_CUSTOM_VALUE;
    setDirectoryOtherInput('faculty-directory-name-other', isCustom);
}

function handleDirectoryPositionChoice() {
    const select = document.getElementById('faculty-directory-position');
    const isCustom = select?.value === DIRECTORY_CUSTOM_VALUE;
    setDirectoryOtherInput('faculty-directory-position-other', isCustom);
}

function handleDirectoryEditDepartmentChange() {
    const editDept = document.getElementById('faculty-directory-edit-department');
    const hiddenDept = document.getElementById('faculty-directory-department');

    if (hiddenDept && editDept) {
        hiddenDept.value = editDept.value || '';
    }
}

function getDirectorySelectOrOtherValue(selectId, otherInputId) {
    const select = document.getElementById(selectId);
    const otherInput = document.getElementById(otherInputId);

    const selectedValue = (select?.value || '').trim();

    if (selectedValue === DIRECTORY_CUSTOM_VALUE) {
        return (otherInput?.value || '').trim();
    }

    return selectedValue;
}

function resetFacultyDirectoryForm() {
    const activeDept = document.getElementById('faculty-directory-active-department')?.value || '';

    const idInput = document.getElementById('faculty-directory-id');
    const hiddenDept = document.getElementById('faculty-directory-department');
    const editDept = document.getElementById('faculty-directory-edit-department');
    const nameSelect = document.getElementById('faculty-directory-name');
    const positionSelect = document.getElementById('faculty-directory-position');
    const saveBtn = document.getElementById('faculty-directory-save-btn');

    if (idInput) idInput.value = '';

    if (hiddenDept) hiddenDept.value = activeDept;

    if (editDept) {
        editDept.value = activeDept;
        updateNativeSelectDisplay('faculty-directory-edit-department');
    }

    if (nameSelect) {
        nameSelect.value = '';
    }

    if (positionSelect) {
        positionSelect.value = '';
    }

    setDirectoryOtherInput('faculty-directory-name-other', false);
    setDirectoryOtherInput('faculty-directory-position-other', false);

    if (saveBtn) {
        saveBtn.innerHTML = 'حفظ الربط';
    }

    updateNativeSelectDisplay('faculty-directory-name');
    updateNativeSelectDisplay('faculty-directory-position');
}

async function loadScheduleInstructorNames() {
    const activeDept = document.getElementById('faculty-directory-active-department')?.value || '';
    const select = document.getElementById('faculty-directory-name');
    const hiddenDept = document.getElementById('faculty-directory-department');
    const editDept = document.getElementById('faculty-directory-edit-department');
    const activeLabel = document.getElementById('faculty-directory-active-label');
    const currentEditId = document.getElementById('faculty-directory-id')?.value || '';

    activeFacultyDirectoryDepartment = activeDept;

    if (hiddenDept && !hiddenDept.value) {
        hiddenDept.value = activeDept;
    }

    if (editDept && !editDept.value) {
        editDept.value = activeDept;
        updateNativeSelectDisplay('faculty-directory-edit-department');
    }

    if (activeLabel) {
        activeLabel.textContent = activeDept ? getDepartmentDisplayName(activeDept) : 'لم يتم الاختيار بعد';
    }

    if (!select) return;

    if (!activeDept) {
        select.disabled = true;
        select.classList.add('bg-gray-100', 'cursor-not-allowed');
        select.innerHTML = '<option value="">اختر القسم أولًا...</option>';
        scheduleInstructorNames = [];
        setDirectoryOtherInput('faculty-directory-name-other', false);
        updateNativeSelectDisplay('faculty-directory-name');
        return;
    }

    const { data, error } = await supabase
        .from('academic_schedule')
        .select('instructor')
        .not('instructor', 'is', null);

    if (error) throw error;

    const linkedNames = new Set(
        (facultyDirectoryEntries || [])
            .filter(item => String(item.id) !== String(currentEditId))
            .map(item => normalizeDirectoryName(item.full_name))
    );

    const uniqueNames = [...new Set(
        (data || [])
            .map(x => normalizeDirectoryName(x.instructor))
            .filter(Boolean)
            .filter(name => name !== 'غير محدد')
    )]
    .filter(name => !linkedNames.has(name))
    .sort((a, b) => a.localeCompare(b, 'ar'));

    scheduleInstructorNames = uniqueNames;

    select.disabled = false;
    select.classList.remove('bg-gray-100', 'cursor-not-allowed');

    const currentValue = select.value;

    select.innerHTML =
        '<option value="">اختر الاسم...</option>' +
        uniqueNames
            .map(name => `<option value="${escapeDirectoryText(name)}">${escapeDirectoryText(name)}</option>`)
            .join('') +
        `<option value="${DIRECTORY_CUSTOM_VALUE}">أخرى - كتابة اسم جديد</option>`;

    if (currentValue === DIRECTORY_CUSTOM_VALUE) {
        select.value = DIRECTORY_CUSTOM_VALUE;
    } else if (currentValue && uniqueNames.includes(currentValue)) {
        select.value = currentValue;
    } else {
        select.value = '';
    }

    handleDirectoryNameChoice();
    updateNativeSelectDisplay('faculty-directory-name');
}

function renderFacultyDirectoryTable() {
    const tbody = document.getElementById('faculty-directory-list');
    const count = document.getElementById('faculty-directory-count');
    const activeDept = document.getElementById('faculty-directory-active-department')?.value || '';

    if (!tbody) return;

    if (!activeDept) {
        if (count) count.textContent = '0 اسم';
        tbody.innerHTML = `
            <tr>
                <td colspan="4" class="text-center py-10 text-gray-400 font-bold">
                    اختر قسمًا أولًا لعرض الأسماء
                </td>
            </tr>
        `;
        return;
    }

    const filteredEntries = facultyDirectoryEntries.filter(item => item.department_key === activeDept);

    if (count) {
        count.textContent = `${filteredEntries.length} اسم`;
    }

    if (!filteredEntries.length) {
        tbody.innerHTML = `
            <tr>
                <td colspan="4" class="text-center py-10 text-gray-400 font-bold">
                    لا توجد أسماء مرتبطة بهذا القسم بعد
                </td>
            </tr>
        `;
        return;
    }

    tbody.innerHTML = filteredEntries.map(item => {
        const avatarText = getDirectoryAvatarText(item.full_name || '');
        const avatarColor = getDirectoryAvatarColor(item.full_name || '');

        return `
            <tr class="border-b border-gray-50 hover:bg-gray-50 transition-colors">
                <td class="px-4 py-3">
                    <div class="flex items-start gap-3">
                        <div class="w-8 h-8 rounded-full ${avatarColor} text-white flex items-center justify-center text-xs font-bold shrink-0 border border-gray-200 mt-1">
                            ${avatarText}
                        </div>
                        <div class="min-w-0">
                            <div class="font-bold text-gray-800 text-sm truncate max-w-[180px]" title="${item.full_name || ''}">
                                ${item.full_name || '—'}
                            </div>
                            <div class="text-[11px] text-gray-400 mt-1">
                                عضو داخل الهيكل الأكاديمي
                            </div>
                        </div>
                    </div>
                </td>

                <td class="px-4 py-3">
                    <span class="text-gray-700 font-bold text-sm">
                        ${getDepartmentDisplayName(item.department_key)}
                    </span>
                </td>

                <td class="px-4 py-3">
                    <span class="inline-flex items-center px-2.5 py-1 rounded-full bg-[#2A3475]/5 text-[#2A3475] text-[11px] font-bold border border-[#2A3475]/10">
                        ${item.position || '—'}
                    </span>
                </td>

                <td class="px-4 py-3 text-center">
                    <div class="flex justify-center gap-1">
                        <button onclick="editFacultyDirectoryEntry('${item.id}')" class="w-7 h-7 flex items-center justify-center rounded-full bg-gray-100 hover:bg-[#2A3475] hover:text-white text-gray-500 transition-colors" title="تعديل">
                            <i class="fas fa-pen text-xs"></i>
                        </button>

                        <button onclick="deleteFacultyDirectoryEntry('${item.id}')" class="w-7 h-7 flex items-center justify-center rounded-full bg-red-50 hover:bg-red-600 hover:text-white text-red-500 transition-colors" title="حذف">
                            <i class="fas fa-trash-alt text-xs"></i>
                        </button>
                    </div>
                </td>
            </tr>
        `;
    }).join('');
}

async function handleFacultyDirectoryDepartmentChange() {
    try {
        resetFacultyDirectoryForm();

        await loadFacultyDirectoryEntries();
        await loadScheduleInstructorNames();

        renderFacultyDirectoryTable();

        updateNativeSelectDisplay('faculty-directory-active-department');
        updateNativeSelectDisplay('faculty-directory-name');
        updateNativeSelectDisplay('faculty-directory-position');
    } catch (error) {
        console.error(error);
        showNotification('تعذر تحميل أسماء القسم المختار', 'error');
    }
}

async function loadFacultyDirectoryEntries() {
    const { data, error } = await supabase
        .from('faculty_directory')
        .select('*')
        .order('full_name', { ascending: true });

    if (error) throw error;

    facultyDirectoryEntries = data || [];
}

async function loadFacultyDirectoryTab() {
    try {
        const tbody = document.getElementById('faculty-directory-list');
        if (tbody) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="4" class="text-center py-8">
                        <i class="fas fa-spinner fa-spin text-[#2A3475] text-2xl"></i>
                    </td>
                </tr>
            `;
        }

        await loadFacultyDirectoryEntries();
        await loadScheduleInstructorNames();
        renderFacultyDirectoryTable();
        updateNativeSelectDisplay('faculty-directory-active-department');
        updateNativeSelectDisplay('faculty-directory-edit-department');
        updateNativeSelectDisplay('faculty-directory-name');
        updateNativeSelectDisplay('faculty-directory-position');
    } catch (error) {
        console.error(error);
        showNotification('تعذر تحميل بيانات توزيع الأسماء', 'error');
    }
}

async function saveFacultyDirectoryEntry() {
    const id = document.getElementById('faculty-directory-id').value.trim();

    const full_name = getDirectorySelectOrOtherValue(
        'faculty-directory-name',
        'faculty-directory-name-other'
    );

    const position = getDirectorySelectOrOtherValue(
        'faculty-directory-position',
        'faculty-directory-position-other'
    );

    const editDept = document.getElementById('faculty-directory-edit-department');
    const hiddenDept = document.getElementById('faculty-directory-department');
    const activeDept = document.getElementById('faculty-directory-active-department');

    const department_key = (
        editDept?.value ||
        hiddenDept?.value ||
        activeDept?.value ||
        ''
    ).trim();

    if (!department_key) {
        return showNotification('اختر القسم أولًا', 'error');
    }

    if (!full_name) {
        return showNotification('من فضلك اختر الاسم أو اكتب اسمًا جديدًا', 'error');
    }

    if (!position) {
        return showNotification('من فضلك اختر المسمى أو اكتب مسمى جديدًا', 'error');
    }

    try {
        let result;

        const payload = {
            full_name,
            department_key,
            position
        };

        if (id) {
            result = await supabase
                .from('faculty_directory')
                .update(payload)
                .eq('id', id);
        } else {
            result = await supabase
                .from('faculty_directory')
                .insert([payload]);
        }

        if (result.error) throw result.error;

        showNotification(id ? 'تم تعديل بيانات العضو بنجاح' : 'تم حفظ الربط بنجاح', 'success');

        resetFacultyDirectoryForm();
        await loadFacultyDirectoryEntries();
        await loadScheduleInstructorNames();
        renderFacultyDirectoryTable();

    } catch (error) {
        console.error(error);
        showNotification('حدث خطأ أثناء حفظ بيانات العضو', 'error');
    }
}

async function editFacultyDirectoryEntry(id) {
    const item = facultyDirectoryEntries.find(x => String(x.id) === String(id));
    if (!item) return;

    const deptSelect = document.getElementById('faculty-directory-active-department');
    const editDeptSelect = document.getElementById('faculty-directory-edit-department');
    const hiddenDept = document.getElementById('faculty-directory-department');
    const idInput = document.getElementById('faculty-directory-id');
    const nameSelect = document.getElementById('faculty-directory-name');
    const positionSelect = document.getElementById('faculty-directory-position');
    const saveBtn = document.getElementById('faculty-directory-save-btn');

    if (idInput) {
        idInput.value = item.id || '';
    }

    if (deptSelect) {
        deptSelect.value = item.department_key || '';
    }

    if (editDeptSelect) {
        editDeptSelect.value = item.department_key || '';
    }

    if (hiddenDept) {
        hiddenDept.value = item.department_key || '';
    }

    await loadScheduleInstructorNames();

    if (nameSelect) {
        const nameExists = Array.from(nameSelect.options)
            .some(option => option.value === item.full_name);

        if (nameExists) {
            nameSelect.value = item.full_name || '';
            setDirectoryOtherInput('faculty-directory-name-other', false);
        } else if (item.full_name) {
            nameSelect.value = DIRECTORY_CUSTOM_VALUE;
            setDirectoryOtherInput('faculty-directory-name-other', true, item.full_name);
        } else {
            nameSelect.value = '';
            setDirectoryOtherInput('faculty-directory-name-other', false);
        }
    }

    if (positionSelect) {
        const positionExists = Array.from(positionSelect.options)
            .some(option => option.value === item.position);

        if (positionExists) {
            positionSelect.value = item.position || '';
            setDirectoryOtherInput('faculty-directory-position-other', false);
        } else if (item.position) {
            positionSelect.value = DIRECTORY_CUSTOM_VALUE;
            setDirectoryOtherInput('faculty-directory-position-other', true, item.position);
        } else {
            positionSelect.value = '';
            setDirectoryOtherInput('faculty-directory-position-other', false);
        }
    }

    if (saveBtn) {
        saveBtn.innerHTML = '<i class="fas fa-save ml-2"></i> تحديث البيانات';
    }

    renderFacultyDirectoryTable();

    updateNativeSelectDisplay('faculty-directory-active-department');
    updateNativeSelectDisplay('faculty-directory-edit-department');
    updateNativeSelectDisplay('faculty-directory-name');
    updateNativeSelectDisplay('faculty-directory-position');

    document.getElementById('faculty-directory-name')?.scrollIntoView({
        behavior: 'smooth',
        block: 'center'
    });
}

function showCustomConfirm(message) {
    return new Promise((resolve) => {
        const oldModal = document.getElementById('custom-confirm-modal');
        if (oldModal) oldModal.remove();

        const modalHTML = `
        <div id="custom-confirm-modal" class="fixed inset-0 z-[2147483648] flex items-center justify-center bg-[#2A3475]/90 backdrop-blur-sm" style="font-family: 'Cairo', sans-serif;">
            <div class="bg-white rounded-2xl shadow-2xl w-full max-w-sm transform scale-100 transition-all overflow-hidden border-t-4 border-[#F3A628]">
                
                <div class="p-6 text-center">
                    <div class="w-16 h-16 bg-blue-50 rounded-full flex items-center justify-center mx-auto mb-4 shadow-sm">
                        <i class="fas fa-question text-3xl text-[#2A3475]"></i>
                    </div>
                    
                    <h3 class="text-xl font-bold text-gray-800 mb-2">تأكيد الإجراء</h3>
                    <p class="text-sm text-gray-600 leading-relaxed mb-6 font-semibold whitespace-pre-line">${message}</p>
                    
                    <div class="flex gap-3">
                        <button id="btn-confirm-yes" class="flex-1 bg-[#2A3475] text-white py-3 rounded-xl font-bold hover:bg-[#1f2658] shadow-lg transition-all">
                            نعم، متأكد
                        </button>
                        <button id="btn-confirm-no" class="flex-1 bg-white text-gray-500 py-3 rounded-xl font-bold hover:bg-gray-100 border border-gray-200 transition-all">
                            إلغاء
                        </button>
                    </div>
                </div>
            </div>
        </div>`;

        document.body.insertAdjacentHTML('beforeend', modalHTML);

        const modal = document.getElementById('custom-confirm-modal');
        const yesBtn = document.getElementById('btn-confirm-yes');
        const noBtn = document.getElementById('btn-confirm-no');

        function close(result) {
            if (modal) modal.remove();
            resolve(result);
        }

        yesBtn?.addEventListener('click', () => close(true));
        noBtn?.addEventListener('click', () => close(false));
        modal?.addEventListener('click', (e) => {
            if (e.target === modal) close(false);
        });
    });
}

async function deleteFacultyDirectoryEntry(id) {
    const item = facultyDirectoryEntries.find(x => x.id === id);
    if (!item) return;

    const isConfirmed = await showConfirmDialog(
        `هل أنت متأكد من حذف الربط الخاص بـ "${item.full_name}" نهائياً من الهيكل الأكاديمي؟`
    );
    if (!isConfirmed) return;

    try {
        const { error } = await supabase
            .from('faculty_directory')
            .delete()
            .eq('id', id);

        if (error) throw error;

        showNotification('تم حذف الربط بنجاح', 'success');
        await loadFacultyDirectoryEntries();
        await loadScheduleInstructorNames();
        renderFacultyDirectoryTable();

    } catch (error) {
        console.error(error);
        showNotification('تعذر حذف الربط', 'error');
    }
}


window.deleteMeetingFromAdmin = async function(id) {
 let meetings = window.CITLAdminMeetings || [];

            if(!id) return;

            // ✅ استخدام النافذة الاحترافية بدلاً من confirm العادية
            const isConfirmed = await showConfirmDialog('هل أنت متأكد تماماً من حذف هذا الحجز نهائياً من السجلات؟');
            
            if(!isConfirmed) return;

            document.body.style.cursor = 'wait';

            try {
                const { error } = await supabase.from('meetings').delete().eq('id', id);
                
                if(error) throw error;

                // حذف محلي وتحديث
                meetings = meetings.filter(m => String(m.id) !== String(id));
                
                updateAdminMeetingsList();
                renderCalendar();
                updateDashboard();
                generateAISuggestions();
                
                showNotification('تم حذف الحجز بنجاح ✅');

            } catch(err) {
                console.error(err);
                showNotification('فشل الحذف', 'error');
            } finally {
                document.body.style.cursor = 'default';
            }
        };

window.bulkDeleteMeetings = async function() {
 let meetings = window.CITLAdminMeetings || [];

            const checkboxes = document.querySelectorAll('.meeting-checkbox:checked');
            
            if (checkboxes.length === 0) {
                showNotification('يرجى تحديد حجز واحد على الأقل', 'info');
                return;
            }

            // قراءة القيم من value مباشرة
            const idsToDelete = Array.from(checkboxes).map(cb => cb.value);

            // ✅ استخدام النافذة الاحترافية مع عرض العدد
            const isConfirmed = await showConfirmDialog(`هل أنت متأكد من حذف <span class="text-red-600 font-bold text-lg">${idsToDelete.length}</span> حجز دفعة واحدة؟`);
            
            if(!isConfirmed) return;

            const btn = document.getElementById('bulk-delete-btn');
            const originalText = btn.innerHTML;
            btn.innerHTML = '<i class="fas fa-spinner fa-spin ml-2"></i> جاري...';
            btn.disabled = true;

            try {
                const { error } = await supabase
                    .from('meetings')
                    .delete()
                    .in('id', idsToDelete);

                if(error) throw error;

                // حذف من المصفوفة المحلية
                meetings = meetings.filter(m => !idsToDelete.includes(String(m.id)));

                updateAdminMeetingsList();
                renderCalendar();
                updateDashboard();
                
                showNotification(`تم حذف ${idsToDelete.length} حجز بنجاح ✅`);
                
                const selectAll = document.getElementById('select-all-meetings');
                if(selectAll) selectAll.checked = false;

            } catch(err) {
                console.error(err);
                showNotification('حدث خطأ أثناء الحذف الجماعي', 'error');
            } finally {
                btn.innerHTML = originalText;
                btn.disabled = false;
            }
        };

window.rejectMeeting = async function(id) {
 let meetings = window.CITLAdminMeetings || [];

    // التعديل: تغيير نص التنبيه ليكون أكثر دقة
    const confirmed = await showConfirmDialog('هل تريد رفض هذا الطلب؟\nسيتم إشعار المستخدم بالرفض وبقاء الحجز في سجلاته كمرفوض.');
    if(!confirmed) return;
    
    document.body.style.cursor = 'wait';
    try {
        // 1. الاحتفاظ بالبيانات قبل التحديث لإرسال الإيميل
        const meetingToReject = meetings.find(m => m.id == id);
        
        // 2. تحديث الحالة في قاعدة البيانات إلى 'rejected' بدلاً من الحذف النهائي
        const { error } = await supabase.from('meetings')
            .update({ status: 'rejected' })
            .eq('id', id);
            
        if(error) throw error;

        // 3. إرسال إيميل الرفض (كما هو في كودك)
        if (meetingToReject && meetingToReject.creatorEmail) {
            sendEmailNotification(
                meetingToReject.creatorEmail, 
                meetingToReject.createdBy, 
                "❌ تم رفض طلب الحجز", 
                `عفواً، تم رفض طلب حجز القاعة لاجتماع: "${meetingToReject.title}".
                
                يرجى مراجعة المواعيد المتاحة والمحاولة مرة أخرى.`
            );
        }

        showNotification('تم رفض الطلب وتنبيه المستخدم');
        
        // 4. إعادة تحميل البيانات لتحديث المصفوفة المحلية والواجهات فوراً
        await loadMeetings();

    } catch(err) {
        console.error(err);
        showNotification('خطأ في الرفض', 'error');
    } finally {
        document.body.style.cursor = 'default';
    }
};

window.approveMeeting = async function(id) {
 let meetings = window.CITLAdminMeetings || [];

    document.body.style.cursor = 'wait';
    try {
        // تحديث الحالة في قاعدة البيانات
        const { error } = await supabase.from('meetings').update({ status: 'confirmed' }).eq('id', id);
        if(error) throw error;

        // تحديث الحالة محلياً
        const mIndex = meetings.findIndex(m => m.id == id);
        if(mIndex > -1) {
            meetings[mIndex].status = 'confirmed';
            
            // ❌❌ تم إيقاف إرسال الإيميل هنا لتوفير الرصيد ❌❌
            /*
            const ownerEmail = meetings[mIndex].creatorEmail;
            const ownerName = meetings[mIndex].createdBy;
            
            if (ownerEmail) {
                sendEmailNotification(
                    ownerEmail, 
                    ownerName, 
                    "✅ تمت الموافقة على حجزك", 
                    `تهانينا! تمت الموافقة على حجز القاعة لاجتماع: "${meetings[mIndex].title}"\nالموعد: ${meetings[mIndex].date} الساعة ${meetings[mIndex].startTime}.`
                );
            }
            */
        }

        // تحديث الواجهة
        showNotification('تم اعتماد الحجز بنجاح ✅');
        refreshAllViews();

    } catch(err) {
        console.error(err);
        showNotification('خطأ في الاعتماد', 'error');
    } finally {
        document.body.style.cursor = 'default';
    }
};

window.confirmDeleteRequest = async function(id) {
 let meetings = window.CITLAdminMeetings || [];

    if(!confirm('هل أنت متأكد من الموافقة على حذف هذا الحجز؟')) return;
    
    document.body.style.cursor = 'wait';
    try {
        const { error } = await supabase.from('meetings').delete().eq('id', id);
        if(error) throw error;

        meetings = meetings.filter(m => m.id != id);
        refreshAllViews();
        showNotification('تم قبول طلب الحذف وإزالة الحجز');
    } catch(err) {
        showNotification('خطأ في العملية', 'error');
    } finally {
        document.body.style.cursor = 'default';
    }
};

window.rejectDeleteRequest = async function(id) {
 let meetings = window.CITLAdminMeetings || [];

    document.body.style.cursor = 'wait';
    try {
        // إرجاع الحالة إلى confirmed
        const { error } = await supabase.from('meetings').update({ status: 'confirmed' }).eq('id', id);
        if(error) throw error;

        const mIndex = meetings.findIndex(m => m.id == id);
        if(mIndex > -1) meetings[mIndex].status = 'confirmed';

        refreshAllViews();
        showNotification('تم رفض طلب الحذف واستعادة الحجز');
    } catch(err) {
        showNotification('خطأ في العملية', 'error');
    } finally {
        document.body.style.cursor = 'default';
    }
};

window.approveModification = async function(id) {
 let meetings = window.CITLAdminMeetings || [];

    const isConfirmed = await showConfirmDialog(
        'هل أنت متأكد من اعتماد التعديلات الجديدة وتحديث الجدول؟', 
        {
            title: 'اعتماد التعديل',          // العنوان
            confirmText: 'نعم، اعتمد',        // نص الزر
            color: 'bg-green-600 hover:bg-green-700', // لون الزر أخضر
            icon: 'fa-check-circle',          // أيقونة صح
            iconColor: 'text-green-600',      // لون الأيقونة
            iconBg: 'bg-green-100',           // خلفية الأيقونة
            borderColor: 'border-green-500'   // لون الحدود
        }
    );
    
    if(!isConfirmed) return;
    
    // ... (باقي كود الدالة كما هو بدون تغيير) ...
    document.body.style.cursor = 'wait';
    try {
        const meeting = meetings.find(m => m.id == id);
        if(!meeting || !meeting.pending_changes) return;
        const changes = meeting.pending_changes;
        const { error } = await supabase.from('meetings').update({
            title: changes.title, department: changes.department, date: changes.date,
            start_time: changes.start_time, end_time: changes.end_time,
            description: changes.description, attendees: changes.attendees,
            status: 'confirmed', pending_changes: null    
        }).eq('id', id);
        if(error) throw error;
        if(meeting.creatorEmail) sendEmailNotification(meeting.creatorEmail, meeting.createdBy, "✅ تمت الموافقة على تعديل الحجز", `تم تحديث موعد اجتماعك "${meeting.title}" بنجاح.`);
        showNotification('تم اعتماد التعديل وتحديث الجدول ✅');
        await loadMeetings(); 
    } catch(err) { console.error(err); showNotification('خطأ في العملية', 'error'); } 
    finally { document.body.style.cursor = 'default'; }
};

window.rejectModification = async function(id) {
 let meetings = window.CITLAdminMeetings || [];

    // نستخدم النافذة الاحترافية
    const isConfirmed = await showConfirmDialog(
        'هل تريد رفض التعديلات المقترحة وإبقاء الموعد القديم كما هو؟',
        {
            title: 'رفض التعديل',
            confirmText: 'نعم، ارفض',
            color: 'bg-gray-600 hover:bg-gray-700',
            icon: 'fa-times-circle',
            iconColor: 'text-gray-600',
            iconBg: 'bg-gray-100',
            borderColor: 'border-gray-500'
        }
    );

    if(!isConfirmed) return;

    document.body.style.cursor = 'wait';
    try {
        // 🔥🔥🔥 التعديل الجوهري هنا 🔥🔥🔥
        // بدلاً من حذف pending_changes، نضع فيه علامة أن التعديل مرفوض
        const { error } = await supabase.from('meetings').update({ 
            status: 'confirmed', 
            pending_changes: { rejected: true, timestamp: new Date().toISOString() } 
        }).eq('id', id);

        if(error) throw error;

        // إشعار بالإيميل
        const meeting = meetings.find(m => m.id == id);
        if(meeting && meeting.creatorEmail) {
            sendEmailNotification(meeting.creatorEmail, meeting.createdBy, "❌ تم رفض تعديل الحجز", `تم رفض طلب التعديل للاجتماع "${meeting.title}". الموعد الأصلي مازال قائماً.`);
        }

        showNotification('تم رفض التعديل وإبقاء الحجز الأصلي');
        await loadMeetings();

    } catch(err) {
        showNotification('خطأ في العملية', 'error');
    } finally {
        document.body.style.cursor = 'default';
    }
};

window.editMeetingFromAdmin = function(meetingId) {
 let meetings = window.CITLAdminMeetings || [];

            const meeting = meetings.find(m => String(m.id) === String(meetingId));
            if (meeting) {
                selectedMeeting = meeting;
                editMeeting();
                closeModal('admin-panel-modal');
            }
        };

function exportReport() {
 const meetings = window.CITLAdminMeetings || [];

            // العناوين (رأس الجدول)
            const headers = ['عنوان الاجتماع', 'الجهة الحاجزة', 'التاريخ', 'الوقت', 'الحالة', 'الحضور', 'الملاحظات'];
            
            // تجهيز البيانات
            const rows = meetings.map(m => {
                const deptName = departments[m.department] ? departments[m.department].name : m.department;
                const status = m.status === 'confirmed' ? 'مؤكد' : 'قيد الانتظار';
                
                // تنظيف النصوص من الفواصل عشان ملف الإكسيل ميبوظش
                const clean = (text) => `"${(text || '').replace(/"/g, '""')}"`;

                return [
                    clean(m.title),
                    clean(deptName),
                    clean(new Date(m.date).toLocaleDateString('ar-EG')),
                    clean(`${m.startTime} - ${m.endTime}`),
                    clean(status),
                    clean(m.attendees || 'لا يوجد'),
                    clean(m.description || 'لا يوجد')
                ];
            });

            // دمج العناوين مع البيانات
            const csvContent = [
                headers.join(','),
                rows.map(row => row.join(','))
                ].join('\n');

            // إضافة BOM لضمان ظهور اللغة العربية بشكل صحيح في الإكسيل
            const bom = '\uFEFF'; 
            const blob = new Blob([bom + csvContent], { type: 'text/csv;charset=utf-8;' });
            
            // إنشاء رابط التحميل
            const url = URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.download = `تقرير-الحجوزات-${new Date().toISOString().split('T')[0]}.csv`; // اسم الملف بالعربي
            
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            URL.revokeObjectURL(url);

            showNotification('تم تحميل تقرير الإكسيل بنجاح 📊');
        }

async function saveSystemSettings() {
            const start = parseInt(document.getElementById('setting-start-hour').value);
            const end = parseInt(document.getElementById('setting-end-hour').value);

            if (start >= end) {
                showNotification('وقت البداية يجب أن يكون قبل النهاية!', 'error');
                return;
            }

            try {
                // محاولة تحديث الصف الأول
                const { error } = await supabase
                    .from('settings')
                    .update({ start_hour: start, end_hour: end })
                    .eq('id', 1);

                // لو مفيش صف (أول مرة)، نعمل Insert
                if (error) throw error;

                showNotification('تم تحديث مواعيد العمل بنجاح');
                
                // إعادة تحميل التطبيق بالتوقيت الجديد فوراً
                await loadSystemSettings(); 

            } catch (err) {
                console.error(err);
                showNotification('حدث خطأ أثناء الحفظ', 'error');
            }
        }

// Admin lists are global on both hosts; the booking calendar keeps its selected-room scope.
window.CITLAdminMeetings = null;
let adminMeetingRead = null;
async function loadAdminMeetingCatalog() {
    if (!window.CITLPermissions.full(currentUser) && !window.CITLPermissions.can(currentUser,'can_approve') && !window.CITLPermissions.can(currentUser,'can_delete')) return;
    if (adminMeetingRead) return adminMeetingRead;
    adminMeetingRead = (async()=>{
        try {
            const all=[];
            for(let offset=0;;offset+=500){
                const {data,error}=await supabase.from('meetings').select('*, profiles(full_name, email)').order('id',{ascending:true}).range(offset,offset+499);
                if(error)throw error;
                all.push(...(data||[]));if(!data||data.length<500)break;
                if(offset>=100000)throw new Error('Too many administrative records');
            }
            window.CITLAdminMeetings=all.map(m=>({...m,startTime:(m.start_time||'').slice(0,5),endTime:(m.end_time||'').slice(0,5),createdAt:m.created_at,createdBy:m.profiles?.full_name||departments[m.department]?.name||'',creatorEmail:m.profiles?.email||null,priority:departments[m.department]?.priority||5}));
        } catch(error) { console.error('Admin meetings read failed:',error);showNotification('تعذر تحديث سجل الحجوزات؛ أعد فتح التبويب للمحاولة', 'error'); }
        finally {adminMeetingRead=null;}
    })();
    return adminMeetingRead;
}

async function loadSystemSettings() {
            try {
                const { data, error } = await supabase.from('settings').select('*').single();
                
                let start = 8;
                let end = 18;

                if (!error && data) {
                    start = data.start_hour;
                    end = data.end_hour;
                    
                    // تحديث القيم في لوحة التحكم
                    const startSelect = document.getElementById('setting-start-hour');
                    const endSelect = document.getElementById('setting-end-hour');
                    if(startSelect) { startSelect.value = start; if(typeof setDropdownValue==='function') setDropdownValue('setting-start-hour',String(start)); }
                    if(endSelect) { endSelect.value = end; if(typeof setDropdownValue==='function') setDropdownValue('setting-end-hour',String(end)); }
                }

                // إعادة بناء مصفوفة الوقت بناءً على الإعدادات
                timeSlots = [];
                for (let hour = start; hour < end; hour++) {
                    timeSlots.push(`${hour.toString().padStart(2, '0')}:00`);
                }

                // تحديث الجدول والقوائم بالمواعيد الجديدة
                renderCalendar();
                populateTimeSlots();

            } catch (err) {
                console.error("Error loading settings:", err);
                // قيم افتراضية في حالة الخطأ
                timeSlots = [];
                for (let hour = 8; hour < 18; hour++) timeSlots.push(`${hour}:00`);
            }
        }
