const BACKEND_BASE = "http://127.0.0.1:8000";

async function callBackend(path) {
  const response = await fetch(`${BACKEND_BASE}${path}`, { method: "GET" });
  let payload = {};
  try {
    payload = await response.json();
  } catch (_) {
    payload = {};
  }
  if (!response.ok) {
    throw new Error(payload.detail || `HTTP ${response.status}`);
  }
  return payload;
}

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  (async () => {
    try {
      if (message?.type === "health") {
        const data = await callBackend("/health");
        sendResponse({ ok: true, data });
        return;
      }
      if (message?.type === "roles") {
        const data = await callBackend("/roles");
        sendResponse({ ok: true, data });
        return;
      }
      if (message?.type === "analyze") {
        const user = encodeURIComponent(message.user || "");
        const role = encodeURIComponent(message.role || "backend");
        const data = await callBackend(`/analyze?user=${user}&role=${role}`);
        sendResponse({ ok: true, data });
        return;
      }
      sendResponse({ ok: false, error: "Unsupported message type." });
    } catch (err) {
      sendResponse({ ok: false, error: err?.message || "Request failed." });
    }
  })();
  return true;
});

