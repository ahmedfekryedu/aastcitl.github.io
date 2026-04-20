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

  async function getAccessToken() {
    const direct = localStorage.getItem("sessionToken");
    if (direct) return direct;

    if (window.sb && window.sb.auth) {
      const { data } = await window.sb.auth.getSession();
      return data?.session?.access_token || null;
    }

    return null;
  }

  async function sendPresence(eventType) {
    const token = await getAccessToken();
    if (!token || !window.PRESENCE_SUPABASE_URL || !window.PRESENCE_SUPABASE_ANON_KEY) {
      return null;
    }

    const res = await fetch(
      `${window.PRESENCE_SUPABASE_URL}/functions/v1/presence-track`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "apikey": window.PRESENCE_SUPABASE_ANON_KEY,
          "Authorization": `Bearer ${token}`,
        },
        body: JSON.stringify({
          event_type: eventType,
          session_id: getSessionId(),
          source_page: currentPage,
        }),
      }
    );

    if (!res.ok) {
      const txt = await res.text();
      throw new Error(txt || "Presence request failed");
    }

    const data = await res.json();
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