// ============================================================
//  UPI Scam Detection – App Logic  (app.js)
// ============================================================

// ── State ─────────────────────────────────────────────────────
let chartTrend = null;
let chartCategory = null;
let chartAmount = null;
let liveFeedInterval = null;
let feedItems = [];
let activeSection = "dashboard";
let scanHistory = [];
let feedEventCount = 0;

// ── DOM Helpers ───────────────────────────────────────────────
const $ = (id) => document.getElementById(id);
const $$ = (sel) => document.querySelectorAll(sel);

// ── Initialise App ────────────────────────────────────────────
document.addEventListener("DOMContentLoaded", () => {
  renderStats();
  initCharts();
  renderPatternLibrary();
  renderTransactionHistory();
  startLiveFeed();
  setupNavigation();
  setupScannerForm();
  setupBulkAnalyzer();
  setupModals();
  animateCounters();
  updateLiveTime();
  setInterval(updateLiveTime, 1000);
});

// ── Live Clock ────────────────────────────────────────────────
function updateLiveTime() {
  const el = $("live-time");
  if (el) el.textContent = new Date().toLocaleTimeString("en-IN", { hour12: false });
}

// ── Stats Counters ────────────────────────────────────────────
function renderStats() {
  $("stat-scanned").textContent  = SYSTEM_STATS.totalScanned;
  $("stat-blocked").textContent  = SYSTEM_STATS.scamsBlocked;
  $("stat-saved").textContent    = SYSTEM_STATS.amountSaved;
  $("stat-accuracy").textContent = SYSTEM_STATS.accuracyRate;
}

function animateCounters() {
  $$(".stat-value[data-target]").forEach((el) => {
    const target = parseInt(el.dataset.target, 10);
    let current = 0;
    const step = Math.ceil(target / 60);
    const timer = setInterval(() => {
      current = Math.min(current + step, target);
      el.textContent = current.toLocaleString("en-IN");
      if (current >= target) clearInterval(timer);
    }, 25);
  });
}

// ── Navigation ────────────────────────────────────────────────
function setupNavigation() {
  $$(".nav-item").forEach((item) => {
    item.addEventListener("click", () => {
      const section = item.dataset.section;
      switchSection(section);
    });
  });
}

function switchSection(section) {
  activeSection = section;
  $$(".nav-item").forEach((i) => i.classList.toggle("active", i.dataset.section === section));
  $$(".section").forEach((s) => s.classList.toggle("active", s.id === `section-${section}`));
}

// ── Scanner Form ──────────────────────────────────────────────
function setupScannerForm() {
  const form = $("scanner-form");
  if (!form) return;

  const upiInput    = $("input-upi");
  const nameInput   = $("input-name");
  const amountInput = $("input-amount");

  // Real-time UPI ID validation hint
  upiInput && upiInput.addEventListener("input", () => {
    const val = upiInput.value.trim();
    const hint = $("upi-hint");
    if (!hint) return;
    if (!val) { hint.textContent = ""; return; }
    const isValid = /^[\w.\-]+@[\w]+$/.test(val);
    hint.textContent = isValid ? "✓ Valid UPI ID format" : "⚠ Invalid UPI ID format";
    hint.className = "input-hint " + (isValid ? "valid" : "invalid");
  });

  form.addEventListener("submit", (e) => {
    e.preventDefault();
    const payload = {
      upiId:   upiInput.value.trim(),
      name:    nameInput.value.trim(),
      amount:  parseFloat(amountInput.value) || 0,
      remarks: ($("input-remarks") || {}).value || "",
    };
    if (!payload.upiId) {
      showToast("Please enter a UPI ID to scan.", "error");
      return;
    }
    runScan(payload);
  });

  // Clear button
  const clearBtn = $("btn-clear-scan");
  clearBtn && clearBtn.addEventListener("click", () => {
    form.reset();
    $("scan-result").classList.add("hidden");
    $("upi-hint") && ($("upi-hint").textContent = "");
  });
}

function runScan(payload) {
  const resultEl = $("scan-result");
  resultEl.classList.remove("hidden");
  resultEl.innerHTML = `<div class="scan-loading"><div class="spinner"></div><p>Analysing transaction…</p></div>`;

  setTimeout(() => {
    const result = calculateRiskScore(payload);
    renderScanResult(payload, result);

    // Add to history
    scanHistory.unshift({
      ...payload,
      ...result,
      timestamp: new Date().toLocaleTimeString("en-IN"),
    });
    renderTransactionHistory();

    // Update live feed count
    feedEventCount++;
  }, 1200 + Math.random() * 800);
}

function renderScanResult(payload, result) {
  const resultEl = $("scan-result");
  const gaugeRotation = (result.score / 100) * 180 - 90;

  const flagsHtml = result.flags.length
    ? result.flags
        .map(
          (f) => `<div class="flag flag-${f.type}">
          <span class="flag-icon">${f.type === "critical" ? "🚨" : f.type === "warning" ? "⚠️" : "ℹ️"}</span>
          <span>${f.message}</span>
        </div>`
        )
        .join("")
    : `<div class="flag flag-info"><span class="flag-icon">✅</span><span>No immediate red flags detected.</span></div>`;

  const patternHtml = result.matchedPattern
    ? `<div class="matched-pattern">
        <div class="pattern-badge">${result.matchedPattern.icon} ${result.matchedPattern.name}</div>
        <p>${result.matchedPattern.description}</p>
        <button class="btn-link" onclick="openPatternModal('${result.matchedPattern.id}')">View full details →</button>
      </div>`
    : "";

  resultEl.innerHTML = `
    <div class="result-card" style="--risk-color: ${result.color}">
      <div class="result-header">
        <div class="result-title">
          <h3>Scan Result</h3>
          <span class="timestamp">${new Date().toLocaleTimeString("en-IN")}</span>
        </div>
        <div class="risk-badge risk-${result.level.toLowerCase()}">${result.level} RISK</div>
      </div>

      <div class="result-body">
        <div class="gauge-container">
          <div class="gauge">
            <div class="gauge-fill" style="transform: rotate(${gaugeRotation}deg)"></div>
            <div class="gauge-cover">
              <div class="score-number" style="color:${result.color}">${result.score}</div>
              <div class="score-label">Risk Score</div>
            </div>
          </div>
          <div class="gauge-scale">
            <span>0</span><span>50</span><span>100</span>
          </div>
        </div>

        <div class="result-details">
          <div class="detail-row"><span class="detail-label">UPI ID</span><span class="detail-value mono">${payload.upiId}</span></div>
          <div class="detail-row"><span class="detail-label">Payee Name</span><span class="detail-value">${payload.name || "Not provided"}</span></div>
          <div class="detail-row"><span class="detail-label">Amount</span><span class="detail-value">₹${Number(payload.amount).toLocaleString("en-IN")}</span></div>
          <div class="detail-row"><span class="detail-label">Risk Level</span>
            <span class="detail-value" style="color:${result.color};font-weight:700">${result.level}</span>
          </div>
        </div>
      </div>

      <div class="recommendation-box" style="border-color:${result.color}">
        <div class="rec-icon">${result.level === "CRITICAL" ? "🛑" : result.level === "HIGH" ? "⛔" : result.level === "MEDIUM" ? "⚠️" : "✅"}</div>
        <p>${result.recommendation}</p>
      </div>

      <div class="flags-section">
        <h4>Risk Indicators</h4>
        <div class="flags-list">${flagsHtml}</div>
      </div>

      ${patternHtml}

      <div class="result-actions">
        <button class="btn-secondary" onclick="reportTransaction('${payload.upiId}')">🚩 Report Scam</button>
        <button class="btn-ghost" onclick="exportResult()">📋 Copy Report</button>
      </div>
    </div>
  `;
}

// ── Charts ────────────────────────────────────────────────────
function initCharts() {
  initTrendChart();
  initCategoryChart();
  initAmountChart();
}

function initTrendChart() {
  const ctx = $("chart-trend");
  if (!ctx) return;
  chartTrend = new Chart(ctx, {
    type: "line",
    data: {
      labels: TREND_DATA.labels,
      datasets: [
        { label: "Phishing",    data: TREND_DATA.phishing,    borderColor: "#ff4d6d", backgroundColor: "rgba(255,77,109,0.1)", tension: 0.4, fill: true },
        { label: "Marketplace", data: TREND_DATA.marketplace, borderColor: "#ff8c42", backgroundColor: "rgba(255,140,66,0.1)",  tension: 0.4, fill: true },
        { label: "Investment",  data: TREND_DATA.investment,  borderColor: "#ffd166", backgroundColor: "rgba(255,209,102,0.1)", tension: 0.4, fill: true },
        { label: "Lottery",     data: TREND_DATA.lottery,     borderColor: "#06d6a0", backgroundColor: "rgba(6,214,160,0.1)",   tension: 0.4, fill: true },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { labels: { color: "#a8b3cf", font: { family: "Inter" } } },
      },
      scales: {
        x: { ticks: { color: "#a8b3cf" }, grid: { color: "rgba(168,179,207,0.1)" } },
        y: { ticks: { color: "#a8b3cf" }, grid: { color: "rgba(168,179,207,0.1)" } },
      },
    },
  });
}

function initCategoryChart() {
  const ctx = $("chart-category");
  if (!ctx) return;
  chartCategory = new Chart(ctx, {
    type: "doughnut",
    data: {
      labels: CATEGORY_DATA.labels,
      datasets: [{
        data: CATEGORY_DATA.values,
        backgroundColor: CATEGORY_DATA.colors,
        borderColor: "#0a0e1a",
        borderWidth: 3,
        hoverOffset: 8,
      }],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          position: "right",
          labels: { color: "#a8b3cf", font: { family: "Inter" }, padding: 16 },
        },
      },
    },
  });
}

function initAmountChart() {
  const ctx = $("chart-amount");
  if (!ctx) return;
  chartAmount = new Chart(ctx, {
    type: "bar",
    data: {
      labels: AMOUNT_RANGE_DATA.labels,
      datasets: [{
        label: "No. of Scam Attempts",
        data: AMOUNT_RANGE_DATA.counts,
        backgroundColor: [
          "rgba(255,77,109,0.7)", "rgba(255,140,66,0.7)",
          "rgba(255,209,102,0.7)", "rgba(6,214,160,0.7)", "rgba(168,85,247,0.7)"
        ],
        borderColor: [
          "#ff4d6d", "#ff8c42", "#ffd166", "#06d6a0", "#a855f7"
        ],
        borderWidth: 2,
        borderRadius: 6,
      }],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
      },
      scales: {
        x: { ticks: { color: "#a8b3cf" }, grid: { color: "rgba(168,179,207,0.1)" } },
        y: { ticks: { color: "#a8b3cf" }, grid: { color: "rgba(168,179,207,0.1)" } },
      },
    },
  });
}

// ── Live Feed ─────────────────────────────────────────────────
function startLiveFeed() {
  // Seed with some initial items
  for (let i = 0; i < 6; i++) {
    addFeedItem(LIVE_FEED_POOL[i % LIVE_FEED_POOL.length], true);
  }

  liveFeedInterval = setInterval(() => {
    const item = LIVE_FEED_POOL[Math.floor(Math.random() * LIVE_FEED_POOL.length)];
    const modified = {
      ...item,
      amount: item.amount + Math.floor(Math.random() * 1000),
    };
    addFeedItem(modified, false);
    feedEventCount++;
    const badge = $("feed-badge");
    if (badge) badge.textContent = feedEventCount;
  }, 3500 + Math.random() * 2000);
}

function addFeedItem(item, silent) {
  const feed = $("live-feed-list");
  if (!feed) return;

  const riskClass = item.risk >= 90 ? "critical" : item.risk >= 75 ? "high" : "medium";
  const timeStr = new Date().toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", second: "2-digit" });

  const div = document.createElement("div");
  div.className = `feed-item feed-${riskClass} ${silent ? "" : "feed-new"}`;
  div.innerHTML = `
    <div class="feed-item-left">
      <div class="feed-risk-indicator"></div>
      <div class="feed-info">
        <div class="feed-upi">${item.upiId}</div>
        <div class="feed-meta">
          <span class="feed-type">${item.type}</span>
          <span class="feed-location">📍 ${item.location}</span>
        </div>
      </div>
    </div>
    <div class="feed-item-right">
      <div class="feed-amount">₹${Number(item.amount).toLocaleString("en-IN")}</div>
      <div class="feed-score" style="color:${item.risk >= 90 ? "#ff4d6d" : item.risk >= 75 ? "#ff8c42" : "#ffd166"}">
        ${item.risk}% risk
      </div>
      <div class="feed-time">${timeStr}</div>
    </div>
  `;

  feed.insertBefore(div, feed.firstChild);

  // Keep feed trimmed to 30 items
  while (feed.children.length > 30) {
    feed.removeChild(feed.lastChild);
  }

  // Pulse animation for new items
  if (!silent) {
    setTimeout(() => div.classList.remove("feed-new"), 1000);
  }
}

// ── Pattern Library ───────────────────────────────────────────
function renderPatternLibrary() {
  const grid = $("pattern-grid");
  if (!grid) return;

  grid.innerHTML = SCAM_PATTERNS.map(
    (p) => `
    <div class="pattern-card pattern-${p.severity}" onclick="openPatternModal('${p.id}')">
      <div class="pattern-icon">${p.icon}</div>
      <div class="pattern-content">
        <div class="pattern-header-row">
          <h4>${p.name}</h4>
          <span class="severity-badge severity-${p.severity}">${p.severity.toUpperCase()}</span>
        </div>
        <p class="pattern-category">${p.category}</p>
        <p class="pattern-desc">${p.description.substring(0, 90)}…</p>
        <div class="pattern-stats">
          <span>💸 Avg loss: ₹${p.avgLoss.toLocaleString("en-IN")}</span>
          <span>📊 ${p.frequency.toLocaleString()} cases</span>
        </div>
      </div>
    </div>`
  ).join("");
}

// ── Transaction History ───────────────────────────────────────
function renderTransactionHistory() {
  const tbody = $("tx-history-body");
  if (!tbody) return;

  const combined = [
    ...scanHistory.map((s) => ({
      id: "SCAN-" + Math.random().toString(36).substr(2, 6).toUpperCase(),
      upiId: s.upiId, name: s.name, amount: s.amount,
      time: s.timestamp, risk: s.score,
      status: s.level === "CRITICAL" || s.level === "HIGH" ? "blocked" : "safe",
      category: s.matchedPattern ? s.matchedPattern.category : "Scanned",
    })),
    ...MOCK_TRANSACTIONS,
  ].slice(0, 20);

  tbody.innerHTML = combined
    .map(
      (tx) => `
    <tr class="tx-row">
      <td class="mono text-dim">${tx.id}</td>
      <td class="mono">${tx.upiId}</td>
      <td>${tx.name}</td>
      <td>₹${Number(tx.amount).toLocaleString("en-IN")}</td>
      <td>${tx.time}</td>
      <td>
        <div class="risk-bar-cell">
          <div class="risk-bar-bg">
            <div class="risk-bar-fill" style="width:${tx.risk}%;background:${getRiskColor(tx.risk)}"></div>
          </div>
          <span style="color:${getRiskColor(tx.risk)}">${tx.risk}%</span>
        </div>
      </td>
      <td><span class="status-badge status-${tx.status}">${tx.status.toUpperCase()}</span></td>
    </tr>`
    )
    .join("");
}

function getRiskColor(score) {
  if (score >= 80) return "#ff4d6d";
  if (score >= 55) return "#ff8c42";
  if (score >= 30) return "#ffd166";
  return "#06d6a0";
}

// ── Bulk Analyzer ─────────────────────────────────────────────
function setupBulkAnalyzer() {
  const btn = $("btn-bulk-analyze");
  if (!btn) return;
  btn.addEventListener("click", runBulkAnalysis);

  const clearBtn = $("btn-bulk-clear");
  clearBtn && clearBtn.addEventListener("click", () => {
    $("bulk-input").value = "";
    $("bulk-results").innerHTML = "";
  });
}

function runBulkAnalysis() {
  const raw = $("bulk-input").value.trim();
  if (!raw) { showToast("Please paste transaction data first.", "error"); return; }

  const lines = raw.split("\n").filter((l) => l.trim());
  const resultsEl = $("bulk-results");
  resultsEl.innerHTML = '<div class="bulk-loading"><div class="spinner"></div><p>Analysing transactions…</p></div>';

  setTimeout(() => {
    const results = lines.map((line) => {
      const parts = line.split(",").map((p) => p.trim());
      const payload = { upiId: parts[0] || "", name: parts[1] || "", amount: parseFloat(parts[2]) || 0 };
      const result = calculateRiskScore(payload);
      return { payload, result };
    });

    const high = results.filter((r) => r.result.score >= 55).length;

    resultsEl.innerHTML = `
      <div class="bulk-summary">
        <div class="bulk-stat"><span class="bs-val">${results.length}</span><span class="bs-lbl">Total</span></div>
        <div class="bulk-stat danger"><span class="bs-val">${high}</span><span class="bs-lbl">Risky</span></div>
        <div class="bulk-stat safe"><span class="bs-val">${results.length - high}</span><span class="bs-lbl">Safe</span></div>
      </div>
      <div class="bulk-table-wrap">
        <table class="bulk-table">
          <thead><tr><th>UPI ID</th><th>Name</th><th>Amount</th><th>Score</th><th>Level</th></tr></thead>
          <tbody>
            ${results.map(({ payload, result }) => `
              <tr class="tx-row">
                <td class="mono">${payload.upiId || "—"}</td>
                <td>${payload.name || "—"}</td>
                <td>₹${Number(payload.amount).toLocaleString("en-IN")}</td>
                <td style="color:${result.color};font-weight:700">${result.score}</td>
                <td><span class="status-badge status-${result.level === "CRITICAL" || result.level === "HIGH" ? "blocked" : "safe"}">${result.level}</span></td>
              </tr>
            `).join("")}
          </tbody>
        </table>
      </div>`;
  }, 1500);
}

// ── Modals ────────────────────────────────────────────────────
function setupModals() {
  // Close on overlay click
  $$(".modal-overlay").forEach((overlay) => {
    overlay.addEventListener("click", (e) => {
      if (e.target === overlay) closeModal(overlay.id);
    });
  });

  $$(".modal-close").forEach((btn) => {
    btn.addEventListener("click", () => {
      const modal = btn.closest(".modal-overlay");
      if (modal) closeModal(modal.id);
    });
  });
}

function openPatternModal(patternId) {
  const pattern = SCAM_PATTERNS.find((p) => p.id === patternId);
  if (!pattern) return;

  const content = $("pattern-modal-content");
  content.innerHTML = `
    <div class="modal-pattern-header">
      <span class="modal-icon">${pattern.icon}</span>
      <div>
        <h2>${pattern.name}</h2>
        <span class="severity-badge severity-${pattern.severity}">${pattern.severity.toUpperCase()}</span>
        <span class="category-tag">${pattern.category}</span>
      </div>
    </div>
    <p class="modal-description">${pattern.description}</p>
    <div class="modal-stats">
      <div class="mstat"><span class="mstat-val">₹${pattern.avgLoss.toLocaleString("en-IN")}</span><span class="mstat-lbl">Avg. Loss</span></div>
      <div class="mstat"><span class="mstat-val">${pattern.frequency.toLocaleString()}</span><span class="mstat-lbl">Reported Cases</span></div>
      <div class="mstat"><span class="mstat-val">${pattern.indicators.length}</span><span class="mstat-lbl">Indicators</span></div>
    </div>
    <h4>Indicators</h4>
    <div class="indicator-tags">${pattern.indicators.map((i) => `<span class="tag">${i}</span>`).join("")}</div>
    <h4>Protection Tips</h4>
    <ul class="tips-list">${pattern.tips.map((t) => `<li>${t}</li>`).join("")}</ul>
  `;

  openModal("pattern-modal");
}

function openModal(id) {
  const modal = $(id);
  if (modal) { modal.classList.add("open"); document.body.style.overflow = "hidden"; }
}

function closeModal(id) {
  const modal = $(id);
  if (modal) { modal.classList.remove("open"); document.body.style.overflow = ""; }
}

// ── Report / Export Helpers ───────────────────────────────────
function reportTransaction(upiId) {
  showToast(`🚩 Report submitted for ${upiId}. Thank you for keeping UPI safe!`, "success");
}

function exportResult() {
  const card = document.querySelector(".result-card");
  if (!card) return;
  const text = card.innerText;
  navigator.clipboard.writeText(text).then(() => {
    showToast("📋 Report copied to clipboard!", "success");
  }).catch(() => {
    showToast("Could not copy — please select and copy manually.", "error");
  });
}

// ── Toast Notifications ───────────────────────────────────────
function showToast(message, type = "info") {
  const container = $("toast-container");
  if (!container) return;

  const toast = document.createElement("div");
  toast.className = `toast toast-${type}`;
  toast.innerHTML = `<span>${message}</span><button onclick="this.parentElement.remove()">✕</button>`;
  container.appendChild(toast);

  setTimeout(() => toast.classList.add("toast-visible"), 10);
  setTimeout(() => {
    toast.classList.remove("toast-visible");
    setTimeout(() => toast.remove(), 400);
  }, 4000);
}
