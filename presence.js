(function () {
  'use strict';
  const HEARTBEAT_MS = 30000, STALE_MS = 120000;
  let timer, currentPage = 'unknown', stopped = true, running, legacyIgnored = false;
  let authSubscription, lastAttempt = 0, lastLegacyAttempt = 0, clockOffset = 0, generation = 0;

  async function rpc(name, args) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);
    try {
      const { data, error } = await window.sb.rpc(name, args).abortSignal(controller.signal);
      if (error) throw error;
      return data;
    } finally { clearTimeout(timeout); }
  }
  async function getSession() {
    let timeout;
    try {
      return await Promise.race([
        window.sb.auth.getSession(),
        new Promise((_, reject) => { timeout = setTimeout(() => reject(new Error('Presence session timeout')), 8000); })
      ]);
    } finally { clearTimeout(timeout); }
  }
  function stop() { stopped = true; generation++; clearInterval(timer); timer = null; }
  async function legacy(eventType, session) {
    if (eventType !== 'logout' && (!['login', 'dashboard', 'smrm', 'schedules'].includes(currentPage) || Date.now() - lastLegacyAttempt < 60000)) return;
    if (legacyIgnored && eventType !== 'logout') return;
    lastLegacyAttempt = Date.now();
    const key = 'citl-visiting-session:' + session.user.id;
    const id = localStorage.getItem(key);
    if (eventType === 'logout' && !id) return;
    const data = await rpc('citl_presence_track', {
      p_event_type: eventType === 'logout' ? 'logout' : id ? 'heartbeat' : 'start',
      p_session_id: id, p_source_page: currentPage
    });
    if (data?.ignored) legacyIgnored = true;
    if (data?.session_id && !stopped) localStorage.setItem(key, data.session_id);
    if (eventType === 'logout') localStorage.removeItem(key);
    // Ignored/failed attendance calls must not fabricate a last-seen time.
  }
  async function beat() {
    if (stopped || running || !window.sb?.auth) return;
    const epoch = generation;
    lastAttempt = Date.now();
    running = (async () => {
      const { data } = await getSession();
      const session = data?.session;
      if (stopped || epoch !== generation) return;
      if (!session) { stop(); return; }
      const results = await Promise.allSettled([
        rpc('citl_web_presence', { p_action: 'heartbeat' }).then(result => {
          if (result?.stopped && epoch === generation) stop();
        }),
        legacy('heartbeat', session)
      ]);
      results.forEach(result => { if (result.status === 'rejected') console.warn('Presence update unavailable:', result.reason?.message || result.reason); });
    })().catch(error => console.warn('Presence session unavailable:', error?.message || error))
      .finally(() => { running = null; });
    return running;
  }
  function startForPage(pageName) {
    currentPage = pageName || 'unknown';
    if (!window.sb?.auth) return Promise.resolve();
    if (!authSubscription && window.sb.auth.onAuthStateChange) {
      authSubscription = window.sb.auth.onAuthStateChange(event => {
        // Do not call Supabase APIs inside the auth lock.
        if (event === 'SIGNED_OUT') stop();
      }).data?.subscription;
    }
    if (stopped) { stopped = false; generation++; legacyIgnored = false; }
    clearInterval(timer);
    // Install retry first: an initial network failure must not disable tracking.
    timer = setInterval(() => { void beat(); }, HEARTBEAT_MS);
    return beat();
  }
  async function logout() {
    stop();
    if (!window.sb?.auth) return;
    try {
      const { data } = await getSession();
      if (!data?.session) return;
      await Promise.allSettled([
        rpc('citl_web_presence', { p_action: 'logout' }),
        legacy('logout', data.session)
      ]);
    } catch (_) { /* Tracking failure must never prevent actual Auth logout. */ }
  }
  async function users() {
    const data = await rpc('citl_web_presence', { p_action: 'list' });
    if (!Array.isArray(data?.users) || !Number.isFinite(Date.parse(data.server_time))) {
      throw new Error('تعذر قراءة حالة اتصال المستخدمين');
    }
    clockOffset = Date.parse(data.server_time) - Date.now();
    return data.users;
  }
  function isOnline(lastSeenAt, status) {
    if (status !== 'online' || !lastSeenAt) return false;
    const age = Date.now() + clockOffset - Date.parse(lastSeenAt);
    return Number.isFinite(age) && age >= -5000 && age < STALE_MS;
  }
  function formatLastSeen(value) {
    if (!value) return 'لم يُسجّل ظهور بعد';
    const date = new Date(value), age = Date.now() + clockOffset - date.getTime();
    if (!Number.isFinite(age)) return 'غير متاح';
    return date.toLocaleString('ar-EG', { timeZone: 'Africa/Cairo', year:'numeric', day: 'numeric', month: 'numeric', hour: 'numeric', minute: '2-digit', second:'2-digit' });
  }
  function dotHtml(lastSeenAt, status) {
    const online = isOnline(lastSeenAt, status);
    return `<span class="inline-flex w-2.5 h-2.5 rounded-full ${online ? 'bg-green-500' : 'bg-gray-300'}" title="${status === 'unknown' ? 'تعذر التحقق' : online ? 'Online' : 'Offline'}"></span>`;
  }
  function wake() { if (!stopped && Date.now() - lastAttempt > 3000) void beat(); }
  window.addEventListener('online', wake);
  window.addEventListener('pageshow', wake);
  document.addEventListener('visibilitychange', () => { if (!document.hidden) wake(); });
  // No logout on unload: navigation or closing one tab must not disconnect others.
  window.presenceTracker = { startForPage, logout, users, isOnline, dotHtml, formatLastSeen };
})();
