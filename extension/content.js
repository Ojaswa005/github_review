(function initGitHubJobFitPanel() {
  const PANEL_ID = "gh-job-fit-panel";
  const DEFAULT_ROLES = ["backend", "frontend", "ml"];
  let roleOptions = [...DEFAULT_ROLES];
  let lastUsername = "";

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

  function createPanel() {
    let panel = document.getElementById(PANEL_ID);
    if (panel) return panel;

    panel = document.createElement("div");
    panel.id = PANEL_ID;
    panel.innerHTML = `
      <div class="gh-job-fit-header">Job Fit Analyzer</div>
      <div class="gh-job-fit-controls">
        <label for="gh-job-fit-role">Role</label>
        <select id="gh-job-fit-role"></select>
        <button id="gh-job-fit-run">Analyze</button>
      </div>
      <div id="gh-job-fit-status">Loading roles...</div>
      <div id="gh-job-fit-results"></div>
    `;
    document.body.appendChild(panel);
    return panel;
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
  }

  function refreshPanelForPage() {
    createPanel();
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

  refreshPanelForPage();
  fetchRoles();
})();
