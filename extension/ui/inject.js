(function initGitHubJobFitPanel() {
  const PANEL_ID = "gh-job-fit-panel";
  const BACKEND_URL = "http://127.0.0.1:8000/analyze";

  const roleOptions = ["backend", "frontend", "ml"];
  let lastUsername = "";

  function extractUsername() {
    const path = window.location.pathname.replace(/^\/+/, "");
    if (!path) return "";
    const firstSegment = path.split("/")[0];
    const blocked = new Set(["settings", "orgs", "organizations", "explore", "topics", "marketplace", "notifications", "login", "signup", "features", "about", "pricing", "search"]);
    if (blocked.has(firstSegment.toLowerCase())) return "";
    return firstSegment;
  }

  function createPanel() {
    if (document.getElementById(PANEL_ID)) return document.getElementById(PANEL_ID);

    const panel = document.createElement("div");
    panel.id = PANEL_ID;
    panel.innerHTML = `
      <div class="gh-job-fit-header">Job Fit Analyzer</div>
      <div class="gh-job-fit-controls">
        <label for="gh-job-fit-role">Role</label>
        <select id="gh-job-fit-role">
          ${roleOptions.map((r) => `<option value="${r}">${r}</option>`).join("")}
        </select>
        <button id="gh-job-fit-run">Analyze</button>
      </div>
      <div id="gh-job-fit-status">Ready</div>
      <div id="gh-job-fit-results"></div>
    `;
    document.body.appendChild(panel);
    return panel;
  }

  function setStatus(text) {
    const el = document.getElementById("gh-job-fit-status");
    if (el) el.textContent = text;
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

  function renderResults(data) {
    const root = document.getElementById("gh-job-fit-results");
    if (!root) return;
    root.innerHTML = `
      <div class="gh-job-fit-score">Match Score: ${data.match_score}/100</div>
      ${renderList("Strengths", data.strengths)}
      ${renderList("Weaknesses", data.weaknesses)}
      ${renderList("Suggestions", data.suggestions)}
      ${renderInsights(data.repo_insights)}
    `;
  }

  async function analyzeUser(username) {
    const role = document.getElementById("gh-job-fit-role").value;
    setStatus(`Analyzing ${username} for ${role} role...`);
    try {
      const resp = await fetch(`${BACKEND_URL}?user=${encodeURIComponent(username)}&role=${encodeURIComponent(role)}`);
      const payload = await resp.json();
      if (!resp.ok) {
        throw new Error(payload.detail || "Backend request failed.");
      }
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
      document.getElementById("gh-job-fit-results").innerHTML = "";
    }
  }

  const observer = new MutationObserver(() => refreshPanelForPage());
  observer.observe(document.body, { childList: true, subtree: true });

  window.addEventListener("popstate", refreshPanelForPage);
  window.addEventListener("hashchange", refreshPanelForPage);
  refreshPanelForPage();
})();

