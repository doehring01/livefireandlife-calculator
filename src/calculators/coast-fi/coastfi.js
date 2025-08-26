// coastfi.js — soft-gated unlock (Mailchimp-style), with safe fallbacks
console.log("🔵 CoastFI calculator loaded");

let coastChart;

// ---------- helpers ----------
const $ = (id) => document.getElementById(id);
const fmt0 = (n) => Number(n).toLocaleString(undefined, { maximumFractionDigits: 0 });
const clamp = (n, lo, hi) => Math.max(lo, Math.min(hi, n));
const yearsUntil = (cur, target) => Math.max(0, (Number(target)||0) - (Number(cur)||0));

// ---------- gate state ----------
const NEWS_KEY = "coastfiUnlocked"; // same idea as CSV gate; page-specific key
const isUnlocked = () => { try { return localStorage.getItem(NEWS_KEY) === "1"; } catch(e){ return false; } };
const unlock = () => { try { localStorage.setItem(NEWS_KEY, "1"); } catch(e){} };

// ---------- show/hide ----------
const show = (el, yes) => { if (!el) return; el.classList.toggle("hidden", !yes); };

// ---------- math ----------
function computeCoast(inputs) {
  const { currentAge, retireAge, currentPortfolio, retireSpend, passiveIncome, realReturnPct, swrPct } = inputs;

  const nYears = yearsUntil(currentAge, retireAge);
  const r = (Number(realReturnPct) || 0) / 100; // real return (after inflation)
  const swr = (Number(swrPct) || 0) / 100;

  const needFromPortfolio = Math.max(0, (Number(retireSpend)||0) - (Number(passiveIncome)||0));
  const requiredAtRetirement = swr > 0 ? (needFromPortfolio / swr) : Infinity;

  const denom = Math.pow(1 + r, nYears);
  const requiredToday = denom > 0 ? (requiredAtRetirement / denom) : requiredAtRetirement;

  const current = Number(currentPortfolio) || 0;
  const progressPct = requiredToday <= 0 ? 100 : clamp((current / requiredToday) * 100, 0, 999);

  const portfolioAtRetirement = current * Math.pow(1 + r, nYears);

  return { nYears, r, swr, needFromPortfolio, requiredAtRetirement, requiredToday, progressPct, portfolioAtRetirement };
}

// ---------- renderers ----------
function renderQuickSummary(inputs, calc) {
  const q = $("quickSummary");
  const u = $("unlockBlock");
  if (!q || !u) return;

  if (calc.requiredToday <= 0) {
    q.innerHTML = `
      <div>With passive income covering your spending, your required portfolio is $0.</div>
      <div class="help">You’re effectively “beyond CoastFI.” Unlock to see full details.</div>
    `;
  } else {
    const status = (Number(inputs.currentPortfolio)||0) >= calc.requiredToday
      ? "✅ You’re at or beyond CoastFI."
      : "⏳ You’re not at CoastFI yet.";

    q.innerHTML = `
      <div>${status}</div>
      <div>CoastFI number today: <strong>$${fmt0(calc.requiredToday)}</strong></div>
      <div>Progress: <strong>${fmt0(calc.progressPct)}%</strong></div>
      <div class="help">At your expected ${Number(inputs.realReturnPct)||0}% real return for ${calc.nYears} years.</div>
    `;
  }

  show(u, !isUnlocked());
}

function renderFullResults(inputs, calc) {
  const full = $("fullResults");
  show(full, true);

  const headline = $("summaryHeadline");
  const detail = $("summaryDetail");
  if (headline && detail) {
    const status = (Number(inputs.currentPortfolio)||0) >= calc.requiredToday
      ? "You’re at or beyond CoastFI."
      : "You haven’t reached CoastFI yet.";
    headline.textContent = status;
    detail.textContent = `CoastFI today: $${fmt0(calc.requiredToday)} · Progress: ${fmt0(calc.progressPct)}% · Years to target: ${calc.nYears}`;
  }

  const atRet = $("atRetirement");
  if (atRet) {
    atRet.innerHTML = `
      Required portfolio: <strong>$${fmt0(calc.requiredAtRetirement)}</strong><br/>
      Projected portfolio (no more contributions): <strong>$${fmt0(calc.portfolioAtRetirement)}</strong>
    `;
  }

  // Chart
  const canvas = $("coastChart");
  if (!canvas) return;
  const ctx = canvas.getContext("2d");
  if (coastChart) coastChart.destroy();

  const n = calc.nYears;
  const r = calc.r;
  const seriesYears = [...Array(n+1)].map((_,i)=>i);
  const growth = seriesYears.map(i => (Number(inputs.currentPortfolio)||0) * Math.pow(1+r, i));
  const reqLine = seriesYears.map(_ => calc.requiredAtRetirement);

  coastChart = new Chart(ctx, {
    type: "line",
    data: {
      labels: seriesYears.map(y => `+${y}y`),
      datasets: [
        { label: "Portfolio (no new contributions)", data: growth, tension: 0.2 },
        { label: "Required at retirement", data: reqLine, borderDash: [6,6], tension: 0 }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { position: "bottom" } },
      scales: { y: { ticks: { callback: v => "$" + fmt0(v) } } }
    }
  });
}

// ---------- soft-gate modal helpers (like CSV gate) ----------
function openGate() {
  const el = $("nlBackdropCF");
  if (el) el.style.display = "flex";
}
function closeGate() {
  const el = $("nlBackdropCF");
  if (el) el.style.display = "none";
}
function attachGateHandlers() {
  const form = $("nlFormCF");
  const skip = $("nlSkipCF");
  const already = $("nlAlreadyCF");
  const backdrop = $("nlBackdropCF");

  if (form) {
    form.addEventListener("submit", () => {
      try { localStorage.setItem(NEWS_KEY, "1"); } catch(e){}
      // Give the form a moment to open Mailchimp tab, then unlock & show results
      setTimeout(() => {
        closeGate();
        unlock();
        if (window._coastLast) {
          const { inputs, calc } = window._coastLast;
          renderFullResults(inputs, calc);
        }
      }, 150);
    });
  }

  if (skip) {
    skip.addEventListener("click", () => {
      closeGate();
      unlock(); // allow “skip this time” → unlock
      if (window._coastLast) {
        const { inputs, calc } = window._coastLast;
        renderFullResults(inputs, calc);
      }
    });
  }

  if (already) {
    already.addEventListener("change", () => {
      if (already.checked) {
        try { localStorage.setItem(NEWS_KEY, "1"); } catch(e){}
      }
    });
  }

  if (backdrop) {
    backdrop.addEventListener("click", (e) => {
      if (e.target === backdrop) closeGate();
    });
  }
}

// ---------- init ----------
function init() {
  // Support redirect back with ?unlocked=1 (future-proof)
  const params = new URLSearchParams(location.search);
  if (params.get("unlocked") === "1") {
    unlock();
    history.replaceState({}, "", location.pathname);
  }

  // Form submit -> compute
  const form = $("coastForm");
  if (form) {
    form.addEventListener("submit", (e) => {
      e.preventDefault();
      const inputs = {
        currentAge: $("currentAge").value,
        retireAge: $("retireAge").value,
        currentPortfolio: $("currentPortfolio").value,
        retireSpend: $("retireSpend").value,
        passiveIncome: $("passiveIncome").value,
        realReturnPct: $("realReturn").value,
        swrPct: $("swr").value
      };
      const calc = computeCoast(inputs);
      window._coastLast = { inputs, calc }; // cache last calc

      renderQuickSummary(inputs, calc);
      if (isUnlocked()) renderFullResults(inputs, calc);
    });
  }

  // Unlock button behavior (CSV-like gate)
  const unlockBtn = $("unlockBtn");
  if (unlockBtn) {
    unlockBtn.addEventListener("click", (e) => {
      e.preventDefault();
      if (isUnlocked() && window._coastLast) {
        const { inputs, calc } = window._coastLast;
        renderFullResults(inputs, calc);
        return;
      }
      // Use inline modal if present; otherwise fallback to redirect
      if ($("nlBackdropCF")) {
        openGate();
      } else {
        window.location.href = "/calculators/coast-fi/unlock.html";
      }
    });
  }

  // Wire up modal (if present)
  attachGateHandlers();

  // Keep full results hidden until user calculates (and possibly unlocks)
  show($("fullResults"), false);
}

document.addEventListener("DOMContentLoaded", init);