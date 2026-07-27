(function () {
  "use strict";

  // ── Config ─────────────────────────────────────────────────────────────────

  const DRPC          = "https://sepolia.drpc.org";
  const NOX_MODULE    = "0x1Ba951E0883e5F4AFEdCdF88B76B8EeF34165a51";
  const POLICY_REG    = "0x1A86ed6a9739Ae24D089FaC892DeC2f09280Cce1";
  const DASHBOARD_URL = "https://noxsafe.website";
  const ZERO_ADDR     = "0x0000000000000000000000000000000000000000";

  // Pre-computed selectors (keccak256(sig).slice(0,10)):
  const SEL_ORACLE          = "0x079f583e"; // noxOracle()
  const SEL_GET_POLICY      = "0x3791dc6a"; // getPolicy(address)
  const SEL_DAILY_SPEND     = "0x2b291c2c"; // dailySpend(address,uint256)
  const SEL_MODULE_ENABLED  = "0x2d9ad53d"; // isModuleEnabled(address)

  // ── Helpers ────────────────────────────────────────────────────────────────

  function padAddr(addr) {
    return addr.toLowerCase().replace("0x", "").padStart(64, "0");
  }

  function padUint(n) {
    return BigInt(n).toString(16).padStart(64, "0");
  }

  async function ethCall(to, data) {
    const res = await fetch(DRPC, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0", id: 1,
        method: "eth_call",
        params: [{ to, data }, "latest"],
      }),
    });
    const json = await res.json();
    if (json.error) throw new Error(json.error.message);
    return json.result || "0x";
  }

  function fmtEth(wei) {
    if (wei === 0n) return "0";
    const eth = Number(wei) / 1e18;
    return eth < 0.001 ? "<0.001" : eth.toFixed(eth < 0.1 ? 4 : 3);
  }

  function shortAddr(addr) {
    return addr.slice(0, 6) + "…" + addr.slice(-4);
  }

  // ── RPC calls ──────────────────────────────────────────────────────────────

  async function fetchOracleStatus() {
    const result = await ethCall(NOX_MODULE, SEL_ORACLE);
    const addr = "0x" + result.slice(-40);
    return addr !== ZERO_ADDR && addr !== "0x" + "0".repeat(40);
  }

  async function fetchPolicy(safe) {
    const result = await ethCall(POLICY_REG, SEL_GET_POLICY + padAddr(safe));
    if (!result || result === "0x") return null;
    const hex = result.slice(2);
    // ABI layout: [offset-to-array(32)] [maxPerTx(32)] [maxPerDay(32)] [active(32)] [array...]
    const maxPerTx  = BigInt("0x" + hex.slice(64, 128));
    const maxPerDay = BigInt("0x" + hex.slice(128, 192));
    const active    = hex.slice(192, 256).endsWith("1");
    return { maxPerTx, maxPerDay, active };
  }

  async function fetchDailySpend(safe) {
    const utcDay = Math.floor(Date.now() / 86_400_000);
    const result = await ethCall(
      NOX_MODULE,
      SEL_DAILY_SPEND + padAddr(safe) + padUint(utcDay)
    );
    return result && result !== "0x" ? BigInt(result) : 0n;
  }

  async function fetchModuleEnabled(safe) {
    const result = await ethCall(safe, SEL_MODULE_ENABLED + padAddr(NOX_MODULE));
    return result === "0x" + "0".repeat(63) + "1";
  }

  // ── Safe address detection ─────────────────────────────────────────────────

  async function detectSafeAddress() {
    // 1. Check chrome.storage (saved by content script or manually)
    const stored = await new Promise((res) =>
      chrome.storage.local.get("safeAddress", (r) => res(r.safeAddress))
    );
    if (stored && /^0x[a-fA-F0-9]{40}$/.test(stored)) return stored;

    // 2. Scan open tabs for app.safe.global
    const tabs = await new Promise((res) =>
      chrome.tabs.query({ url: "https://app.safe.global/*" }, res)
    );
    for (const tab of tabs) {
      const match = tab.url && tab.url.match(/[?&]safe=\w+:(0x[a-fA-F0-9]{40})/i);
      if (match) {
        const addr = match[1];
        chrome.storage.local.set({ safeAddress: addr });
        return addr;
      }
    }

    return null;
  }

  // ── Rendering ──────────────────────────────────────────────────────────────

  function setOracleBadge(active) {
    const dot  = document.getElementById("oracle-dot");
    const text = document.getElementById("oracle-text");
    dot.className  = "oracle-dot " + (active ? "active" : "offline");
    text.textContent = active ? "Oracle Active" : "Oracle Offline";
  }

  function renderSetup() {
    document.getElementById("main-content").innerHTML = `
      <div class="setup-card">
        <div class="setup-title">Connect your Safe</div>
        <div class="setup-desc">
          Open app.safe.global with your Safe selected — the extension auto-detects it.
          Or paste the address below.
        </div>
        <input class="nox-input-dark" id="manual-addr" placeholder="0x… Safe address" />
        <button class="btn-primary" id="save-addr-btn">Use this Safe</button>
      </div>
      <button class="btn-primary" id="open-safe-btn">
        <svg width="14" height="14" fill="none" viewBox="0 0 24 24"><path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6M15 3h6v6M10 14L21 3" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/></svg>
        Open Safe App
      </button>
    `;

    document.getElementById("open-safe-btn").addEventListener("click", () => {
      chrome.tabs.create({ url: "https://app.safe.global" });
      window.close();
    });

    document.getElementById("save-addr-btn").addEventListener("click", () => {
      const val = document.getElementById("manual-addr").value.trim();
      if (/^0x[a-fA-F0-9]{40}$/.test(val)) {
        chrome.storage.local.set({ safeAddress: val }, () => init());
      } else {
        document.getElementById("manual-addr").style.borderColor = "#f87171";
      }
    });
  }

  function renderDashboard(safe, policy, spend, moduleEnabled) {
    document.getElementById("change-safe-btn").style.display = "block";

    const cap     = policy?.maxPerDay ?? 0n;
    const maxTx   = policy?.maxPerTx ?? 0n;
    const pct     = cap > 0n ? Math.min(100, Number((spend * 10000n) / cap) / 100) : 0;
    const barClass = pct < 60 ? "green" : pct < 80 ? "orange" : "red";

    document.getElementById("main-content").innerHTML = `
      <!-- Safe card -->
      <div class="safe-card">
        <div class="safe-icon">
          <svg width="16" height="16" viewBox="0 0 32 32" fill="none">
            <path d="M16 2L4 8v8c0 7.4 5.12 14.32 12 16 6.88-1.68 12-8.6 12-16V8L16 2z" fill="#ffe17c" stroke="#ffe17c" stroke-width="1"/>
            <path d="M16 9l1.8 3.6H22l-3.4 2.5 1.3 4L16 16.6 12.1 19.1l1.3-4L10 12.6h4.2L16 9z" fill="#000"/>
          </svg>
        </div>
        <div class="safe-info">
          <div class="safe-label">Safe Address</div>
          <div class="safe-addr">${shortAddr(safe)}</div>
        </div>
        <div class="module-badge ${moduleEnabled ? "enabled" : "disabled"}">
          ${moduleEnabled ? "Module ✓" : "Module Off"}
        </div>
      </div>

      <!-- Daily spending -->
      <div class="spend-card">
        <div class="spend-header">
          <span class="spend-title">Today's Spending</span>
          <span class="spend-amount">${fmtEth(spend)} / ${cap > 0n ? fmtEth(cap) : "—"} ETH</span>
        </div>
        <div class="spend-bar-track">
          <div class="spend-bar-fill ${barClass}" style="width:${pct}%"></div>
        </div>
        <div class="spend-footer">
          <span>0 ETH</span>
          ${cap > 0n ? `<span>${Math.round(pct)}% of daily cap</span>` : "<span>No daily cap set</span>"}
        </div>
      </div>

      <!-- Policy stats -->
      <div class="stats-row">
        <div class="stat-box">
          <div class="stat-label">Max per tx</div>
          <div class="stat-value">${maxTx > 0n ? fmtEth(maxTx) + " ETH" : "—"}</div>
        </div>
        <div class="stat-box">
          <div class="stat-label">Daily cap</div>
          <div class="stat-value">${cap > 0n ? fmtEth(cap) + " ETH" : "—"}</div>
        </div>
      </div>

      <!-- Actions -->
      <button class="btn-primary" id="open-dashboard-btn">
        <svg width="14" height="14" fill="none" viewBox="0 0 24 24"><path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" stroke="currentColor" stroke-width="2.5"/><path d="M9 22V12h6v10" stroke="currentColor" stroke-width="2.5"/></svg>
        Open Dashboard
      </button>
      <button class="btn-secondary" id="submit-intent-btn">
        <svg width="14" height="14" fill="none" viewBox="0 0 24 24"><path d="M12 5v14M5 12l7-7 7 7" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/></svg>
        Send Private Tx
      </button>
    `;

    document.getElementById("open-dashboard-btn").addEventListener("click", () => {
      chrome.tabs.create({ url: DASHBOARD_URL + "/app/safe" });
      window.close();
    });
    document.getElementById("submit-intent-btn").addEventListener("click", () => {
      chrome.tabs.create({ url: DASHBOARD_URL + "/app/safe/submit" });
      window.close();
    });
  }

  function renderError(msg) {
    document.getElementById("main-content").innerHTML = `
      <p class="error-text">${msg}</p>
      <button class="btn-secondary" id="retry-btn">Retry</button>
    `;
    document.getElementById("retry-btn").addEventListener("click", init);
  }

  // ── Init ───────────────────────────────────────────────────────────────────

  async function init() {
    document.getElementById("main-content").innerHTML = `
      <div class="spinner"></div>
      <p class="loading-text">Fetching on-chain data…</p>
    `;
    document.getElementById("change-safe-btn").style.display = "none";

    try {
      // Detect Safe address
      const safe = await detectSafeAddress();
      if (!safe) { renderSetup(); return; }

      // Fire all reads in parallel
      const [oracleActive, policy, spend, moduleEnabled] = await Promise.all([
        fetchOracleStatus(),
        fetchPolicy(safe),
        fetchDailySpend(safe),
        fetchModuleEnabled(safe),
      ]);

      setOracleBadge(oracleActive);
      renderDashboard(safe, policy, spend, moduleEnabled);
    } catch (err) {
      renderError("Failed to load: " + err.message);
    }
  }

  // "Change Safe" button clears storage and re-shows setup
  document.addEventListener("DOMContentLoaded", () => {
    // Wire product card links
    document.getElementById("safe-product-card").href = DASHBOARD_URL + "/app/safe";
    document.getElementById("noxpay-product-card").href = DASHBOARD_URL + "/app/noxpay";

    document.getElementById("change-safe-btn").addEventListener("click", () => {
      chrome.storage.local.remove("safeAddress", () => {
        document.getElementById("change-safe-btn").style.display = "none";
        renderSetup();
      });
    });
    init();
  });
})();
