(function () {
  const HEARTBEAT_MS = 60 * 1000;
  const STALE_ON_UI_MS = 2 * 60 * 1000;

  let heartbeatTimer = null;
  let currentPage = "unknown";

  function getSessionId() {
    return localStorage.getItem("presence_session_id");
  }

  function setSessionId(id) {
    if (id) localStorage.setItem("presence_session_id", id);
  }

  function clearSessionId() {
    localStorage.removeItem("presence_session_id");
  }

  async function sendPresence(eventType) {
    if (!window.sb?.auth) {
      return null;
    }
    const { data: authData } = await window.sb.auth.getSession();
    if (!authData?.session) return null;
    const { data, error } = await window.sb.rpc('citl_presence_track', {
      p_event_type: eventType, p_session_id: getSessionId(), p_source_page: currentPage
    });
    if (error) throw new Error(error.message || "Presence request failed");
    if (data?.session_id) setSessionId(data.session_id);
    return data;
  }

  function markCurrentUserPresence(data) {
    const currentUserRaw = localStorage.getItem("currentUser");
    if (!currentUserRaw) return;

    try {
      const currentUser = JSON.parse(currentUserRaw);
      currentUser.last_seen_at = data?.last_seen_at || new Date().toISOString();
      currentUser.inside_campus = !!data?.inside_campus;
      currentUser.network_label = data?.network_label || "external";
      currentUser.public_ip = data?.public_ip || null;
      localStorage.setItem("currentUser", JSON.stringify(currentUser));
    } catch (_) {}
  }

  async function startForPage(pageName) {
    currentPage = pageName || "unknown";

    const data = await sendPresence(getSessionId() ? "heartbeat" : "start");
    markCurrentUserPresence(data);

    // الحضور والتواجد التشغيلي مخصصان للمنتدبين فقط.
    if (data?.ignored) {
      if (heartbeatTimer) clearInterval(heartbeatTimer);
      heartbeatTimer = null;
      clearSessionId();
      return data;
    }

    if (heartbeatTimer) clearInterval(heartbeatTimer);
    heartbeatTimer = setInterval(async () => {
      try {
        const hbData = await sendPresence("heartbeat");
        markCurrentUserPresence(hbData);
      } catch (e) {
        console.error("Heartbeat error:", e);
      }
    }, HEARTBEAT_MS);
  }

  async function logout() {
    try {
      await sendPresence("logout");
    } catch (e) {
      console.error("Presence logout error:", e);
    } finally {
      if (heartbeatTimer) clearInterval(heartbeatTimer);
      clearSessionId();
    }
  }

  function isOnline(lastSeenAt) {
    if (!lastSeenAt) return false;
    const diff = Date.now() - new Date(lastSeenAt).getTime();
    return diff <= STALE_ON_UI_MS;
  }

  function dotHtml(lastSeenAt) {
    const online = isOnline(lastSeenAt);
    return `
      <span
        class="inline-block w-2.5 h-2.5 rounded-full ${online ? "bg-green-500" : "bg-gray-300"}"
        title="${online ? "Online" : "Offline"}"
      ></span>
    `;
  }

  window.presenceTracker = {
    startForPage,
    logout,
    isOnline,
    dotHtml,
  };
})();
