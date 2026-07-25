(function () {
  "use strict";

  const NOX_MODULE = "0x389B2Ae79D1207F7734bF8c43D34D841d13D1Cf6";
  const SEPOLIA_CHAIN_ID = "0xaa36a7"; // 11155111
  const NOX_GATEWAY = "https://gateway-testnets.noxprotocol.dev";

  // keccak256("submitIntent(address,bytes32,bytes32,bytes)").slice(0, 4)
  const SUBMIT_INTENT_SELECTOR = "0x7b5d186e";

  const SHIELD_SVG = `<svg width="18" height="18" fill="none" viewBox="0 0 24 24"><path d="M12 2L3 7v5c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V7l-9-5z" stroke="currentColor" stroke-width="2.5"/><path d="M9 12l2 2 4-4" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
  const STAR_SVG = `<svg width="20" height="20" viewBox="0 0 32 32" fill="none"><path d="M16 2L4 8v8c0 7.4 5.12 14.32 12 16 6.88-1.68 12-8.6 12-16V8L16 2z" fill="#ffe17c" stroke="#ffe17c" stroke-width="1"/><path d="M16 9l1.8 3.6H22l-3.4 2.5 1.3 4L16 16.6 12.1 19.1l1.3-4L10 12.6h4.2L16 9z" fill="#000"/></svg>`;

  let modalOpen = false;
  let detectedTx = null;

  // ── Helpers ──

  function extractSafeAddress() {
    const url = window.location.href;
    const match =
      url.match(/safe\/(sep):?(0x[a-fA-F0-9]{40})/i) ||
      url.match(/(0x[a-fA-F0-9]{40})/);
    if (match) return match[match.length - 1];
    return null;
  }

  function tryDetectTransaction() {
    const inputs = document.querySelectorAll(
      'input[name="to"], input[placeholder*="Address"], input[placeholder*="address"]'
    );
    const valueInputs = document.querySelectorAll(
      'input[name="value"], input[placeholder*="Amount"], input[placeholder*="ETH"]'
    );
    let target = "", value = "0", data = "0x";
    inputs.forEach((inp) => {
      if (inp.value && inp.value.startsWith("0x") && inp.value.length === 42)
        target = inp.value;
    });
    valueInputs.forEach((inp) => {
      if (inp.value && !isNaN(parseFloat(inp.value))) value = inp.value;
    });
    const dataInputs = document.querySelectorAll(
      'textarea, input[name="data"], input[placeholder*="Data"], input[placeholder*="0x"]'
    );
    dataInputs.forEach((inp) => {
      if (inp.value && inp.value.startsWith("0x") && inp.value.length > 2)
        data = inp.value;
    });
    return target ? { target, value, data } : null;
  }

  function parseEther(eth) {
    const parts = eth.split(".");
    const whole = parts[0] || "0";
    const frac = (parts[1] || "").padEnd(18, "0").slice(0, 18);
    return BigInt(whole + frac);
  }

  function randomHex32() {
    const bytes = crypto.getRandomValues(new Uint8Array(32));
    return "0x" + Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
  }

  // ── Nox gateway encryption (one call per field) ──
  // Calls the Nox TEE gateway directly with solidityType: "uint256".
  // target is passed as BigInt(address) (uint160 packed into uint256).
  // value is passed as wei (uint256).
  async function encryptUint256(owner, value) {
    const salt = randomHex32();
    const url = `${NOX_GATEWAY}/v0/secrets?chain_id=11155111&salt=${salt}`;
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        value: value.toString(), // decimal string representation of the uint256
        solidityType: "uint256",
        applicationContract: NOX_MODULE,
        owner,
      }),
    });
    const json = await res.json();
    const payload = json?.payload ?? json;
    const handle = payload?.handle;
    if (!handle || !/^0x[0-9a-fA-F]{64}$/.test(handle)) {
      throw new Error(
        `Nox gateway error (${res.status}): ${JSON.stringify(json)}`
      );
    }
    return handle;
  }

  // ── Manual ABI encoder for submitIntent(address,bytes32,bytes32,bytes) ──
  // Layout: selector (4) | safe (32) | targetHandle (32) | valueHandle (32)
  //         | bytes_offset (32=0xa0) | bytes_length (32) | bytes_data (padded)
  function buildSubmitIntentCalldata(safe, targetHandle, valueHandle, data) {
    const safePadded = safe.toLowerCase().replace("0x", "").padStart(64, "0");
    const targetClean = targetHandle.replace("0x", "");
    const valueClean = valueHandle.replace("0x", "");

    // bytes type: dynamic, offset points past the 4 static slots (4*32=128=0x80)
    const bytesOffset = (4 * 32).toString(16).padStart(64, "0");

    const dataBytes = data === "0x" ? "" : data.replace("0x", "");
    const dataLen = (dataBytes.length / 2).toString(16).padStart(64, "0");
    // Pad data to 32-byte boundary
    const dataPadded = dataBytes.length === 0
      ? ""
      : dataBytes.padEnd(Math.ceil(dataBytes.length / 64) * 64, "0");

    return (
      SUBMIT_INTENT_SELECTOR +
      safePadded +
      targetClean +
      valueClean +
      bytesOffset +
      dataLen +
      dataPadded
    );
  }

  // ── Step indicator ──

  function renderSteps(step) {
    const steps = ["Parameters", "Encrypt", "Submit"];
    return `
      <div class="nox-steps">
        ${steps
          .map((label, i) => {
            const active = i <= step;
            return `
            ${i > 0 ? `<div class="nox-step-line ${active ? "active" : "inactive"}"></div>` : ""}
            <div class="nox-step-dot ${active ? "active" : "inactive"}">${i + 1}</div>
            <span class="nox-step-label ${active ? "active" : "inactive"}">${label}</span>
          `;
          })
          .join("")}
      </div>
    `;
  }

  // ── Modal shell ──

  function showModal(prefill) {
    if (modalOpen) return;
    modalOpen = true;

    const safeAddr = extractSafeAddress() || "";
    const target = prefill?.target || "";
    const value = prefill?.value || "0";
    const data = prefill?.data || "0x";

    const overlay = document.createElement("div");
    overlay.className = "nox-overlay";
    overlay.id = "nox-modal-overlay";
    overlay.innerHTML = `
      <div class="nox-modal">
        <div class="nox-modal-header">
          <h2>${SHIELD_SVG} Shield with Nox</h2>
          <button class="nox-modal-close" id="nox-close">&times;</button>
        </div>
        <div class="nox-modal-body" id="nox-modal-content">
          ${renderStep1(safeAddr, target, value, data)}
        </div>
      </div>
    `;
    document.body.appendChild(overlay);
    overlay.addEventListener("click", (e) => {
      if (e.target === overlay) closeModal();
    });
    document.getElementById("nox-close").addEventListener("click", closeModal);
    bindStep1();
  }

  function closeModal() {
    const overlay = document.getElementById("nox-modal-overlay");
    if (overlay) overlay.remove();
    modalOpen = false;
  }

  function setContent(html) {
    const el = document.getElementById("nox-modal-content");
    if (el) el.innerHTML = html;
  }

  // ── Step 1: Parameters ──

  function renderStep1(safe, target, value, data) {
    const hasDetected = target !== "";
    return `
      ${renderSteps(0)}
      ${
        hasDetected
          ? `
        <div class="nox-detected-card">
          <div style="display:flex;align-items:center;gap:6px;margin-bottom:10px;">
            <span class="nox-badge nox-badge-success">Auto-detected</span>
            <span style="font-family:'DM Sans';font-size:12px;color:#666;">from Safe transaction form</span>
          </div>
          <div class="nox-detected-row">
            <span class="nox-detected-label">Target</span>
            <span class="nox-detected-value">${target}</span>
          </div>
          <div class="nox-detected-row">
            <span class="nox-detected-label">Value</span>
            <span class="nox-detected-value">${value} ETH</span>
          </div>
          <div class="nox-detected-row">
            <span class="nox-detected-label">Data</span>
            <span class="nox-detected-value">${data.length > 20 ? data.slice(0, 18) + "..." : data}</span>
          </div>
        </div>
      `
          : ""
      }
      <div class="nox-field">
        <label class="nox-label">Safe Address</label>
        <input class="nox-input" id="nox-safe" value="${safe}" placeholder="0x... Safe address" />
      </div>
      <div class="nox-field">
        <label class="nox-label">Target Address <span style="font-size:11px;color:#999;">(encrypted)</span></label>
        <input class="nox-input" id="nox-target" value="${target}" placeholder="0x... recipient" />
      </div>
      <div class="nox-field">
        <label class="nox-label">Value (ETH) <span style="font-size:11px;color:#999;">(encrypted)</span></label>
        <input class="nox-input" id="nox-value" value="${value}" placeholder="0.0" />
      </div>
      <div class="nox-field">
        <label class="nox-label">Calldata (hex) <span style="font-size:11px;color:#f59e0b;">cleartext — leave 0x for full privacy</span></label>
        <input class="nox-input" id="nox-data" value="${data}" placeholder="0x" />
      </div>
      <div id="nox-error"></div>
      <button class="nox-btn-primary" id="nox-go-btn">Encrypt &amp; Submit</button>
    `;
  }

  function bindStep1() {
    const btn = document.getElementById("nox-go-btn");
    if (!btn) return;
    btn.addEventListener("click", async () => {
      const safe = document.getElementById("nox-safe").value.trim();
      const target = document.getElementById("nox-target").value.trim();
      const value = document.getElementById("nox-value").value.trim();
      const data = document.getElementById("nox-data").value.trim() || "0x";
      const errEl = document.getElementById("nox-error");

      if (!safe || safe.length !== 42) {
        errEl.innerHTML = '<p class="nox-error">Invalid Safe address</p>';
        return;
      }
      if (!target || target.length !== 42) {
        errEl.innerHTML = '<p class="nox-error">Invalid target address</p>';
        return;
      }

      let valueWei;
      try {
        valueWei = parseEther(value || "0");
      } catch (err) {
        errEl.innerHTML = `<p class="nox-error">${err.message}</p>`;
        return;
      }

      detectedTx = { safe, target, value, data };
      await runEncryptAndSubmit(safe, target, valueWei, data);
    });
  }

  // ── Step 2: Encrypting ──

  async function runEncryptAndSubmit(safe, target, valueWei, data) {
    setContent(`
      ${renderSteps(1)}
      <div style="text-align:center;padding:32px 0;">
        <div class="nox-spinner"></div>
        <p style="font-family:'Space Grotesk';font-weight:700;font-size:16px;color:#000;margin-top:16px;">
          Encrypting via Nox TEE...
        </p>
        <p style="font-family:'DM Sans';font-size:13px;color:#666;margin-top:8px;">
          Sending target and value to Nox gateway. This takes a moment.
        </p>
      </div>
    `);

    try {
      if (typeof window.ethereum === "undefined") {
        throw new Error("No wallet detected. Install MetaMask or another Web3 wallet.");
      }

      const accounts = await window.ethereum.request({ method: "eth_requestAccounts" });
      if (!accounts || accounts.length === 0) throw new Error("No account connected");
      const owner = accounts[0];

      await window.ethereum
        .request({
          method: "wallet_switchEthereumChain",
          params: [{ chainId: SEPOLIA_CHAIN_ID }],
        })
        .catch(() => {});

      // Encrypt target address as uint256(uint160(address)).
      const targetUint256 = BigInt(target);
      const targetHandle = await encryptUint256(owner, targetUint256);

      // Encrypt ETH value in wei as uint256.
      const valueHandle = await encryptUint256(owner, valueWei);

      await runSubmit(safe, targetHandle, valueHandle, data, accounts[0]);
    } catch (err) {
      showError(err.message || "Encryption failed");
    }
  }

  // ── Step 3: Submit on-chain ──

  async function runSubmit(safe, targetHandle, valueHandle, data, from) {
    setContent(`
      ${renderSteps(2)}
      <div style="text-align:center;padding:32px 0;">
        <div class="nox-spinner"></div>
        <p style="font-family:'Space Grotesk';font-weight:700;font-size:16px;color:#000;margin-top:16px;" id="nox-status-text">
          Confirm in Wallet...
        </p>
        <p style="font-family:'DM Sans';font-size:13px;color:#666;margin-top:8px;" id="nox-status-sub">
          Submitting intent to NoxGuardModule
        </p>
      </div>
    `);

    try {
      // Build calldata: submitIntent(address safe, bytes32 targetHandle, bytes32 valueHandle, bytes data)
      const txData = buildSubmitIntentCalldata(safe, targetHandle, valueHandle, data);

      const txHash = await window.ethereum.request({
        method: "eth_sendTransaction",
        params: [{ from, to: NOX_MODULE, data: txData, chainId: SEPOLIA_CHAIN_ID }],
      });

      const statusText = document.getElementById("nox-status-text");
      const statusSub = document.getElementById("nox-status-sub");
      if (statusText) statusText.textContent = "Transaction submitted!";
      if (statusSub) statusSub.textContent = "Waiting for confirmation...";

      await waitForReceipt(txHash);
      showSuccess(txHash);
    } catch (err) {
      showError(err.message || "Transaction failed");
    }
  }

  async function waitForReceipt(txHash, maxAttempts = 60) {
    for (let i = 0; i < maxAttempts; i++) {
      try {
        const receipt = await window.ethereum.request({
          method: "eth_getTransactionReceipt",
          params: [txHash],
        });
        if (receipt) return receipt;
      } catch (_) {}
      await new Promise((r) => setTimeout(r, 2000));
    }
    return null;
  }

  // ── Result screens ──

  function showSuccess(txHash) {
    setContent(`
      ${renderSteps(2)}
      <div style="text-align:center;padding:24px 0;">
        <div class="nox-success-icon">
          <svg width="24" height="24" fill="none" viewBox="0 0 24 24">
            <path d="M5 13l4 4L19 7" stroke="#000" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
        </div>
        <p style="font-family:'Space Grotesk';font-weight:800;font-size:18px;color:#000;margin-bottom:8px;">Intent Submitted!</p>
        <p style="font-family:'DM Sans';font-size:14px;color:#666;margin-bottom:16px;">
          The Nox TEE oracle will process your intent shortly.
        </p>
        <div class="nox-info-card" style="text-align:left;">
          <p style="color:#ffe17c;font-family:'Space Grotesk';font-weight:700;font-size:13px;margin-bottom:4px;">Transaction Hash</p>
          <code>${txHash}</code>
        </div>
        <div style="display:flex;gap:10px;margin-top:16px;">
          <button class="nox-btn-accent" id="nox-done-btn" style="flex:1;">Done</button>
        </div>
      </div>
    `);
    document.getElementById("nox-done-btn").addEventListener("click", closeModal);
  }

  function showError(msg) {
    setContent(`
      ${renderSteps(1)}
      <div style="text-align:center;padding:24px 0;">
        <div style="width:48px;height:48px;background:#f87171;border:2px solid #000;border-radius:50%;display:flex;align-items:center;justify-content:center;margin:0 auto 16px;">
          <span style="font-family:'Space Grotesk';font-weight:800;font-size:22px;color:#fff;">&times;</span>
        </div>
        <p style="font-family:'Space Grotesk';font-weight:800;font-size:18px;color:#000;margin-bottom:8px;">Failed</p>
        <p style="font-family:'DM Sans';font-size:13px;color:#f87171;margin-bottom:16px;word-break:break-word;">${msg}</p>
        <button class="nox-btn-secondary" id="nox-retry-btn" style="width:100%;">Try Again</button>
      </div>
    `);
    document.getElementById("nox-retry-btn").addEventListener("click", () => {
      closeModal();
      setTimeout(() => showModal(detectedTx), 100);
    });
  }

  // ── URL guard — only activate on real Safe transactional pages ──
  // Safe is a SPA; URL changes without a page reload, so we check on every tick.

  function hasSafeInUrl() {
    // Require ?safe=<network>:0x<40hex> — present only when a real Safe is selected
    return /[?&]safe=\w+:0x[a-fA-F0-9]{40}/i.test(window.location.href);
  }

  function isTransactionalPage() {
    if (!hasSafeInUrl()) return false;
    // Exclude settings, creation, onboarding — never transactional
    const path = window.location.pathname;
    const blocked = ["/new-safe", "/welcome", "/cookie", "/settings"];
    return !blocked.some((p) => path.startsWith(p));
  }

  // ── Inject into Safe UI ──

  function injectShieldButton() {
    if (!isTransactionalPage()) return;
    if (document.getElementById("nox-shield-injected")) return;
    const reviewBtns = document.querySelectorAll(
      'button[type="submit"], button[data-testid="execute-btn"], button[data-testid="sign-btn"]'
    );
    reviewBtns.forEach((btn) => {
      if (btn.closest("[data-nox-wrapped]")) return;
      const wrapper = document.createElement("div");
      wrapper.setAttribute("data-nox-wrapped", "true");
      wrapper.style.cssText = "display:flex;gap:10px;align-items:center;margin-top:8px;";
      const shieldBtn = document.createElement("button");
      shieldBtn.type = "button";
      shieldBtn.className = "nox-shield-btn";
      shieldBtn.id = "nox-shield-injected";
      shieldBtn.innerHTML = `${SHIELD_SVG} Shield with Nox`;
      shieldBtn.addEventListener("click", (e) => {
        e.preventDefault();
        e.stopPropagation();
        showModal(tryDetectTransaction());
      });
      btn.parentElement.insertBefore(wrapper, btn);
      wrapper.appendChild(shieldBtn);
    });
  }

  // ── FAB — only visible when a real Safe is active ──

  function syncFAB() {
    const existing = document.getElementById("nox-fab");
    if (isTransactionalPage()) {
      if (existing) return; // already there
      const fab = document.createElement("button");
      fab.className = "nox-fab";
      fab.id = "nox-fab";
      fab.innerHTML = `
        <div style="width:28px;height:28px;background:#000;border-radius:6px;display:flex;align-items:center;justify-content:center;">
          ${STAR_SVG}
        </div>
        <span class="nox-fab-tooltip">Shield with Nox-Safe</span>
      `;
      fab.addEventListener("click", () => showModal(tryDetectTransaction()));
      document.body.appendChild(fab);
    } else {
      if (existing) existing.remove(); // navigated away from a Safe page
    }
  }

  // ── Observer — watches both DOM mutations and SPA URL changes ──

  function init() {
    syncFAB();
    injectShieldButton();

    // DOM mutations (Safe re-renders buttons dynamically)
    const observer = new MutationObserver(() => {
      syncFAB();
      injectShieldButton();
    });
    observer.observe(document.body, { childList: true, subtree: true });

    // SPA navigation: Safe uses history.pushState — intercept it
    const _push = history.pushState.bind(history);
    history.pushState = function (...args) {
      _push(...args);
      syncFAB();
      injectShieldButton();
    };
    window.addEventListener("popstate", () => {
      syncFAB();
      injectShieldButton();
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
