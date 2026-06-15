(function () {
  const HEARTBEAT_MS = 60 * 1000;
  let heartbeatTimer = null;
  let currentPage = "unknown";

  function getSessionId() { return localStorage.getItem("presence_session_id"); }
  function setSessionId(id) { if (id) localStorage.setItem("presence_session_id", id); }
  function clearSessionId() { localStorage.removeItem("presence_session_id"); }

  async function processDirectPresence(eventType) {
    const sb = window.sb || window.supabase;
    if (!sb) return;

    const userRaw = localStorage.getItem('currentUser');
    if (!userRaw) return;
    const user = JSON.parse(userRaw);

    // هناخد التوقيت من كمبيوتر المستخدم نفسه (عشان نتفادى أي لغبطة في السيرفر)
    const now = new Date();
    const nowIso = now.toISOString();
    let currentSessionId = getSessionId();

    try {
        if (eventType === 'start' || !currentSessionId) {
            const { data: sessionData, error } = await sb.from('user_presence_sessions').insert([{
                user_id: user.id,
                user_email: user.email,
                user_name: user.full_name,
                account_type: user.account_type || 'user',
                user_role: user.role || 'user',
                started_at: nowIso,
                last_seen_at: nowIso,
                is_online: true,
                source_page: currentPage,
                linked_instructors_snapshot: user.linked_instructors || [],
                public_ip: 'Local/Web',
                network_label: 'external',
                inside_campus: false
            }]).select('id').single();

            if (!error && sessionData) {
                currentSessionId = sessionData.id;
                setSessionId(currentSessionId);
                // هنا بنسجل المحاضرة بمجرد ما يفتح
                await logLectureAttendance(sb, user, currentSessionId, now);
            }
        } else if (eventType === 'heartbeat' && currentSessionId) {
            await sb.from('user_presence_sessions').update({
                last_seen_at: nowIso,
                is_online: true
            }).eq('id', currentSessionId);
        } else if (eventType === 'logout' && currentSessionId) {
            await sb.from('user_presence_sessions').update({
                ended_at: nowIso,
                last_seen_at: nowIso,
                is_online: false
            }).eq('id', currentSessionId);
            clearSessionId();
        }

        if (eventType === 'logout') {
            await sb.from('profiles').update({ presence_status: 'offline', last_logout_at: nowIso }).eq('id', user.id);
        } else {
            await sb.from('profiles').update({ presence_status: 'online', last_seen_at: nowIso }).eq('id', user.id);
        }
    } catch(e) {
        console.error("Presence Error:", e);
    }
  }

  async function logLectureAttendance(sb, user, sessionId, now) {
    // لغينا شرط الـ account_type خالص، وبنعتمد بس على إن الدكتور عنده اسم مرتبط
    if (!user.linked_instructors || user.linked_instructors.length === 0) return;

    const daysEn = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const todayName = daysEn[now.getDay()];

    const todayDateISO = now.getFullYear() + '-' + String(now.getMonth() + 1).padStart(2, '0') + '-' + String(now.getDate()).padStart(2, '0');

    const { data: schedules } = await sb.from('academic_schedule')
        .select('*')
        .eq('status', 'active')
        .eq('day_of_week', todayName);

    if (!schedules || schedules.length === 0) {
        await saveLog(sb, user, sessionId, todayDateISO, null, 'no_lecture_today');
        return;
    }

    const myLectures = schedules.filter(s => {
        const scheduleInst = (s.instructor || '').toLowerCase();
        return user.linked_instructors.some(linked => scheduleInst.includes(linked.toLowerCase()));
    });

    if (myLectures.length === 0) {
        await saveLog(sb, user, sessionId, todayDateISO, null, 'no_lecture_today');
        return;
    }

    let bestLecture = myLectures[0];
    let bestStatus = 'no_lecture_today';
    let minDiff = 9999;

    for (let lec of myLectures) {
        const timeSlot = lec.time_slot || '';
        const match = timeSlot.match(/(\d{1,2}):(\d{2})/);
        if (match) {
            let sh = parseInt(match[1], 10);
            let sm = parseInt(match[2], 10);
            if (sh >= 1 && sh <= 7) sh += 12; // تظبيط الـ 12 ساعة

            const start = new Date(now.getFullYear(), now.getMonth(), now.getDate(), sh, sm, 0);
            const end = new Date(start.getTime() + 110 * 60000);

            const diffMinutes = Math.round((now.getTime() - start.getTime()) / 60000);
            
            let currentStatus;
            if (diffMinutes < -20) currentStatus = 'before_lecture';
            else if (diffMinutes <= 10) currentStatus = 'on_time';
            else if (now <= end) currentStatus = 'late';
            else currentStatus = 'after_lecture';

            if (Math.abs(diffMinutes) < minDiff) {
                minDiff = Math.abs(diffMinutes);
                bestLecture = lec;
                bestStatus = currentStatus;
            }
        }
    }

    await saveLog(sb, user, sessionId, todayDateISO, bestLecture, bestStatus);
  }

  async function saveLog(sb, user, sessionId, dateIso, lecture, status) {
    await sb.from('lecture_presence_logs').insert([{
        session_id: sessionId,
        user_id: user.id,
        profile_name: user.full_name,
        account_type: user.account_type,
        linked_instructor: user.linked_instructors[0] || null,
        lecture_date: dateIso,
        schedule_id: lecture ? lecture.id : null,
        room_name: lecture ? lecture.room_name : null,
        day_of_week: lecture ? lecture.day_of_week : null,
        time_slot: lecture ? lecture.time_slot : null,
        course_name_snapshot: lecture ? lecture.course_name : null,
        instructor_name_snapshot: lecture ? lecture.instructor : null,
        schedule_status: status,
        public_ip: 'Local/Web',
        network_label: 'external',
        inside_campus: false
    }]);
  }

  async function startForPage(pageName) {
    currentPage = pageName || "unknown";
    await processDirectPresence(getSessionId() ? 'heartbeat' : 'start');

    if (heartbeatTimer) clearInterval(heartbeatTimer);
    heartbeatTimer = setInterval(() => {
        processDirectPresence('heartbeat').catch(console.error);
    }, HEARTBEAT_MS);
  }

  async function logout() {
    await processDirectPresence('logout');
    if (heartbeatTimer) clearInterval(heartbeatTimer);
  }

  window.presenceTracker = {
    startForPage,
    logout,
    isOnline: (lastSeenAt) => {
        if (!lastSeenAt) return false;
        return (Date.now() - new Date(lastSeenAt).getTime()) <= (2 * 60 * 1000);
    }
  };
})();
