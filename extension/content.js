(function initGitHubJobFitPanel() {
  const PANEL_ID = "gh-job-fit-panel";
  const LAUNCHER_ID = "gh-job-fit-launcher";
  const STORAGE_KEY = "gh-job-fit-window-state";
  const DEFAULT_ROLES = ["backend", "frontend", "ml"];
  const DEFAULT_STATE = {
    top: 88,
    left: null,
    right: 24,
    width: 380,
    height: 620,
    minimized: false,
    maximized: false,
    closed: false,
  };
  let roleOptions = [...DEFAULT_ROLES];
  let lastUsername = "";
  let panelState = loadWindowState();
  let dragSession = null;
  let beforeMaximizeState = null;

  function runtimeRequest(message) {
    return new Promise((resolve, reject) => {
      chrome.runtime.sendMessage(message, (response) => {
        if (chrome.runtime.lastError) {
          reject(new Error(chrome.runtime.lastError.message));
          return;
        }
        if (!response) {
          reject(new Error("No response from extension background."));
          return;
        }
        if (!response.ok) {
          reject(new Error(response.error || "Request failed."));
          return;
        }
        resolve(response.data);
      });
    });
  }

  function extractUsername() {
    const path = window.location.pathname.replace(/^\/+/, "");
    if (!path) return "";
    const firstSegment = path.split("/")[0];
    const blocked = new Set([
      "settings",
      "orgs",
      "organizations",
      "explore",
      "topics",
      "marketplace",
      "notifications",
      "login",
      "signup",
      "features",
      "about",
      "pricing",
      "search",
    ]);
    if (blocked.has(firstSegment.toLowerCase())) return "";
    return firstSegment;
  }

  function loadWindowState() {
    try {
      const saved = JSON.parse(window.localStorage.getItem(STORAGE_KEY) || "{}");
      return { ...DEFAULT_STATE, ...saved };
    } catch (_) {
      return { ...DEFAULT_STATE };
    }
  }

  function saveWindowState() {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(panelState));
  }

  function clamp(value, min, max) {
    return Math.min(max, Math.max(min, value));
  }

  function getViewportMetrics() {
    return {
      width: window.innerWidth,
      height: window.innerHeight,
      margin: 16,
    };
  }

  function getPanelBounds() {
    const viewport = getViewportMetrics();
    const width = clamp(Number(panelState.width) || DEFAULT_STATE.width, 320, Math.max(320, viewport.width - viewport.margin * 2));
    const height = clamp(Number(panelState.height) || DEFAULT_STATE.height, 280, Math.max(280, viewport.height - viewport.margin * 2));
    let left = panelState.left;
    if (typeof left !== "number") {
      const right = typeof panelState.right === "number" ? panelState.right : DEFAULT_STATE.right;
      left = viewport.width - width - right;
    }
    left = clamp(left, viewport.margin, Math.max(viewport.margin, viewport.width - width - viewport.margin));
    const top = clamp(Number(panelState.top) || DEFAULT_STATE.top, viewport.margin, Math.max(viewport.margin, viewport.height - height - viewport.margin));
    return { left, top, width, height };
  }

  function createPanel() {
    let panel = document.getElementById(PANEL_ID);
    if (panel) return panel;

    panel = document.createElement("div");
    panel.id = PANEL_ID;
    panel.innerHTML = `
      <div class="gh-job-fit-window">
        <div class="gh-job-fit-titlebar" id="gh-job-fit-drag-handle">
          <div class="gh-job-fit-window-actions">
            <button type="button" class="gh-job-fit-window-btn gh-job-fit-close" id="gh-job-fit-close" aria-label="Close panel"></button>
            <button type="button" class="gh-job-fit-window-btn gh-job-fit-minimize" id="gh-job-fit-minimize" aria-label="Minimize panel"></button>
            <button type="button" class="gh-job-fit-window-btn gh-job-fit-maximize" id="gh-job-fit-maximize" aria-label="Maximize panel"></button>
          </div>
          <div class="gh-job-fit-window-heading">
            <span class="gh-job-fit-window-title">Job Fit Analyzer</span>
            <span class="gh-job-fit-window-subtitle">GitHub profile evaluator</span>
          </div>
        </div>
        <div class="gh-job-fit-body">
          <div class="gh-job-fit-controls">
            <label for="gh-job-fit-role">Target role</label>
            <select id="gh-job-fit-role"></select>
            <button id="gh-job-fit-run">Analyze</button>
          </div>
          <div id="gh-job-fit-status">Loading roles...</div>
          <div id="gh-job-fit-results"></div>
        </div>
      </div>
    `;
    document.body.appendChild(panel);
    applyWindowState();
    return panel;
  }

  function createLauncher() {
    let launcher = document.getElementById(LAUNCHER_ID);
    if (launcher) return launcher;
    launcher = document.createElement("button");
    launcher.id = LAUNCHER_ID;
    launcher.type = "button";
    launcher.textContent = "Open Job Fit";
    launcher.setAttribute("aria-label", "Open Job Fit Analyzer");
    document.body.appendChild(launcher);
    return launcher;
  }

  function applyWindowState() {
    const panel = document.getElementById(PANEL_ID);
    const launcher = document.getElementById(LAUNCHER_ID);
    if (!panel) return;

    panel.classList.toggle("is-minimized", !!panelState.minimized);
    panel.classList.toggle("is-maximized", !!panelState.maximized);
    panel.classList.toggle("is-closed", !!panelState.closed);

    if (panelState.maximized) {
      panel.style.top = "16px";
      panel.style.left = "16px";
      panel.style.width = `calc(100vw - 32px)`;
      panel.style.height = `calc(100vh - 32px)`;
    } else {
      const bounds = getPanelBounds();
      panel.style.top = `${bounds.top}px`;
      panel.style.left = `${bounds.left}px`;
      panel.style.width = `${bounds.width}px`;
      panel.style.height = panelState.minimized ? "auto" : `${bounds.height}px`;
      panelState.top = bounds.top;
      panelState.left = bounds.left;
      panelState.right = null;
      panelState.width = bounds.width;
      panelState.height = bounds.height;
    }

    panel.style.display = panelState.closed ? "none" : "block";
    if (launcher) {
      launcher.style.display = panelState.closed ? "inline-flex" : "none";
    }
    saveWindowState();
  }

  function setStatus(text) {
    const el = document.getElementById("gh-job-fit-status");
    if (el) el.textContent = text;
  }

  function renderRoleOptions(roles) {
    const select = document.getElementById("gh-job-fit-role");
    if (!select) return;
    select.innerHTML = roles.map((r) => `<option value="${r}">${r}</option>`).join("");
  }

  async function fetchRoles() {
    try {
      await runtimeRequest({ type: "health" });
      const payload = await runtimeRequest({ type: "roles" });
      if (Array.isArray(payload.roles) && payload.roles.length > 0) {
        roleOptions = payload.roles;
      }
      setStatus("Ready");
    } catch (_) {
      roleOptions = [...DEFAULT_ROLES];
      setStatus("Backend unreachable on http://127.0.0.1:8000");
    }
    renderRoleOptions(roleOptions);
  }

  function renderList(title, items) {
    return `
      <div class="gh-job-fit-section">
        <h4>${title}</h4>
        <ul>
          ${(items || []).map((item) => `<li>${item}</li>`).join("")}
        </ul>
      </div>
    `;
  }

  function renderInsights(insights) {
    if (!insights || !insights.length) return "";
    return `
      <div class="gh-job-fit-section">
        <h4>Repo Insights</h4>
        ${insights
          .map(
            (item) => `
              <div class="gh-job-fit-repo">
                <div><strong>${item.repo_name}</strong> (${item.language})</div>
                <div>Stars: ${item.stars} | Relevance: ${item.avg_relevance}</div>
              </div>
            `
          )
          .join("")}
      </div>
    `;
  }

  function getScoreTone(score) {
    if (score >= 80) return "good";
    if (score >= 60) return "warn";
    return "bad";
  }

  function renderScoreRing(score) {
    const safeScore = Math.max(0, Math.min(100, Number(score) || 0));
    const tone = getScoreTone(safeScore);
    return `
      <div class="gh-job-fit-score-card gh-job-fit-score-${tone}">
        <div class="gh-job-fit-score-ring" style="--score:${safeScore};" aria-label="Match score ${safeScore} percent">
          <div class="gh-job-fit-score-inner">
            <span class="gh-job-fit-score-number">${safeScore}%</span>
            <span class="gh-job-fit-score-label">Match</span>
          </div>
        </div>
        <div class="gh-job-fit-score-copy">
          <div class="gh-job-fit-score-title">Job Fit Score</div>
          <div class="gh-job-fit-score-subtitle">
            ${tone === "good" ? "Strong alignment for this role" : tone === "warn" ? "Moderate alignment with some gaps" : "Low alignment right now"}
          </div>
        </div>
      </div>
    `;
  }

  function renderResults(data) {
    const root = document.getElementById("gh-job-fit-results");
    if (!root) return;
    root.innerHTML = `
      ${renderScoreRing(data.match_score)}
      ${renderList("Strengths", data.strengths)}
      ${renderList("Weaknesses", data.weaknesses)}
      ${renderList("Suggestions", data.suggestions)}
      ${renderInsights(data.repo_insights)}
    `;
  }

  function closePanel() {
    panelState.closed = true;
    panelState.minimized = false;
    applyWindowState();
  }

  function reopenPanel() {
    panelState.closed = false;
    applyWindowState();
  }

  function toggleMinimize() {
    panelState.minimized = !panelState.minimized;
    applyWindowState();
  }

  function toggleMaximize() {
    if (panelState.maximized) {
      panelState.maximized = false;
      if (beforeMaximizeState) {
        panelState = { ...panelState, ...beforeMaximizeState };
      }
      beforeMaximizeState = null;
      applyWindowState();
      return;
    }
    beforeMaximizeState = {
      top: panelState.top,
      left: panelState.left,
      right: panelState.right,
      width: panelState.width,
      height: panelState.height,
      minimized: false,
    };
    panelState.maximized = true;
    panelState.minimized = false;
    applyWindowState();
  }

  function onDragStart(event) {
    const handle = event.target.closest("#gh-job-fit-drag-handle");
    const ignored = event.target.closest("button, select, option");
    if (!handle || ignored || panelState.maximized || panelState.closed) return;
    const panel = document.getElementById(PANEL_ID);
    if (!panel) return;
    const rect = panel.getBoundingClientRect();
    dragSession = {
      offsetX: event.clientX - rect.left,
      offsetY: event.clientY - rect.top,
    };
    panel.classList.add("is-dragging");
    document.addEventListener("pointermove", onDragMove);
    document.addEventListener("pointerup", onDragEnd);
  }

  function onDragMove(event) {
    if (!dragSession) return;
    const panel = document.getElementById(PANEL_ID);
    if (!panel) return;
    const viewport = getViewportMetrics();
    const rect = panel.getBoundingClientRect();
    const nextLeft = clamp(event.clientX - dragSession.offsetX, viewport.margin, Math.max(viewport.margin, viewport.width - rect.width - viewport.margin));
    const nextTop = clamp(event.clientY - dragSession.offsetY, viewport.margin, Math.max(viewport.margin, viewport.height - rect.height - viewport.margin));
    panelState.left = nextLeft;
    panelState.top = nextTop;
    panelState.right = null;
    panel.style.left = `${nextLeft}px`;
    panel.style.top = `${nextTop}px`;
  }

  function onDragEnd() {
    const panel = document.getElementById(PANEL_ID);
    if (panel) panel.classList.remove("is-dragging");
    dragSession = null;
    document.removeEventListener("pointermove", onDragMove);
    document.removeEventListener("pointerup", onDragEnd);
    saveWindowState();
  }

  function handleViewportResize() {
    if (panelState.maximized) {
      applyWindowState();
      return;
    }
    const bounds = getPanelBounds();
    panelState.left = bounds.left;
    panelState.top = bounds.top;
    panelState.width = bounds.width;
    panelState.height = bounds.height;
    applyWindowState();
  }

  async function analyzeUser(username) {
    const roleSelect = document.getElementById("gh-job-fit-role");
    const role = roleSelect ? roleSelect.value : "backend";
    setStatus(`Analyzing ${username} for ${role} role...`);
    try {
      const payload = await runtimeRequest({ type: "analyze", user: username, role });
      renderResults(payload);
      setStatus("Analysis complete");
    } catch (err) {
      setStatus(`Error: ${err.message}`);
    }
  }

  function bindActions() {
    const runBtn = document.getElementById("gh-job-fit-run");
    const closeBtn = document.getElementById("gh-job-fit-close");
    const minimizeBtn = document.getElementById("gh-job-fit-minimize");
    const maximizeBtn = document.getElementById("gh-job-fit-maximize");
    const handle = document.getElementById("gh-job-fit-drag-handle");
    const launcher = document.getElementById(LAUNCHER_ID);
    if (!runBtn || runBtn.dataset.bound === "1") return;
    runBtn.dataset.bound = "1";
    runBtn.addEventListener("click", () => {
      const username = extractUsername();
      if (!username) {
        setStatus("Open a GitHub user profile page.");
        return;
      }
      analyzeUser(username);
    });
    if (closeBtn) closeBtn.addEventListener("click", closePanel);
    if (minimizeBtn) minimizeBtn.addEventListener("click", toggleMinimize);
    if (maximizeBtn) maximizeBtn.addEventListener("click", toggleMaximize);
    if (launcher) launcher.addEventListener("click", reopenPanel);
    if (handle) handle.addEventListener("pointerdown", onDragStart);
  }

  function refreshPanelForPage() {
    createPanel();
    createLauncher();
    applyWindowState();
    bindActions();
    const username = extractUsername();
    if (!username) {
      setStatus("Navigate to a GitHub profile page.");
      return;
    }
    if (username !== lastUsername) {
      lastUsername = username;
      setStatus(`Detected profile: ${username}`);
      const results = document.getElementById("gh-job-fit-results");
      if (results) results.innerHTML = "";
    }
  }

  const observer = new MutationObserver(() => refreshPanelForPage());
  observer.observe(document.body, { childList: true, subtree: true });
  window.addEventListener("popstate", refreshPanelForPage);
  window.addEventListener("hashchange", refreshPanelForPage);
  window.addEventListener("resize", handleViewportResize);

  refreshPanelForPage();
  fetchRoles();
})();
