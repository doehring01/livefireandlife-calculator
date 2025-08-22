// coastfi.js
console.log("🔵 CoastFI calculator loaded");

let coastChart;

// Helpers
const $ = (id) => document.getElementById(id);
const fmt0 = (n) => Number(n).toLocaleString(undefined, { maximumFractionDigits: 0 });
const toNum = (v) => {
  const n = parseFloat(v);
  return Number.isFinite(n) ? n : 0;
};
const clamp = (n, lo, hi) => Math.max(lo, Math.min(hi, n));
const yearsUntil = (cur, target) => Math.max(0, (toNum(target) - toNum(cur)));

// Soft-gate flag
const isUnlocked = () => localStorage.getItem("coastfiUnlocked") === "1";
const unlock = () => { try { localStorage.setItem("coastfiUnlocked", "1"); } catch(e) {} };

// Show/hide helpers
const show = (el, yes) => { if (!el) return; el.classList.toggle("hidden", !yes); };

// Core CoastFI math
function computeCoast(inputs) {
  const {
    currentAge,
    retireAge,
    currentPortfolio,
    retireSpend,
    passiveIncome,
    realReturnPct,
    swrPct,
  } = inputs;

  const nYears = yearsUntil(currentAge, retireAge);
  const r = toNum(realReturnPct) / 100; // real return
  const swr = toNum(swrPct) / 100;      // withdrawal rate

  // Required annual draw from portfolio after passive income
  const needFromPortfolio = Math.max(0, toNum(retireSpend) - toNum(passiveIncome));

  // Required portfolio at retirement to support spending shortfall
  const requiredAtRetirement = swr > 0 ? (needFromPortfolio / swr) : Infinity;

  // CoastFI "number today" = present value needed so that FV at retirement == requiredAtRetirement
  const denom = Math.pow(1 + r, nYears);
  const requiredToday = denom > 0 ? (requiredAtRetirement / denom) : requiredAtRetirement;

  const current = toNum(currentPortfolio);
  const progressPct = requiredToday <= 0 ? 100 : clamp((current / requiredToday) * 100, 0, 999);

  // If you truly stop adding, portfolio grows:
  const portfolioAtRetirement = current * Math.pow(1 + r, nYears);

  return {
    nYears, r, swr,
    needFromPortfolio,
    requiredAtRetirement,
    requiredToday,
    progressPct,
    portfolioAtRetirement
  };
}

// Render quick summary (always visible)
function renderQuickSummary(inputs, calc) {
  const q = $("quickSummary");
  const u = $("unlockBlock");
  if (!q || !u) return;

  if (!Number.isFinite(calc.requiredToday)) {
    q.innerHTML = `
      <div>We need a valid Safe Withdrawal Rate and return assumption.</div>
      <div class="help">Try SWR between 3–5% and real returns between 3–6%.</div>
    `;
    show(u, false);
    return;
  }

  if (calc.requiredToday <= 0) {
    q.innerHTML = `
      <div>With passive income covering your spending, your required portfolio is $0.</div>
      <div class="help">You’re effectively “beyond CoastFI.” Explore full results for details.</div>
    `;
  } else {
    const status = (toNum(inputs.currentPortfolio) >= calc.requiredToday)
      ? "✅ You’re at or beyond CoastFI."
      : "⏳ You’re not at CoastFI yet.";

    q.innerHTML = `
      <div>${status}</div>
      <div>CoastFI number today: <strong>$${fmt0(calc.requiredToday)}</strong></div>
      <div>Progress: <strong>${fmt0(calc.progressPct)}%</strong></div>
      <div class="help">Assumes ${toNum(inputs.realReturnPct)}% real return for ${calc.nYears} years.</div>
    `;
  }

  // Always show unlock CTA after calculation
  show(u, true);
}

// Full results (gated)
function renderFullResults(inputs, calc) {
  const full = $("fullResults");
  show(full, true);

  // Headline cards
  const headline = $("summaryHeadline");
  const detail = $("summaryDetail");
  if (headline && detail) {
    const status = (toNum(inputs.currentPortfolio) >= calc.requiredToday)
      ? "You’re at or beyond CoastFI."
      : "You haven’t reached CoastFI yet.";
    headline.textContent = status;

    detail.textContent =
      `CoastFI today: $${fmt0(calc.requiredToday)} · Progress: ${fmt0(calc.progressPct)}% · Years to target: ${calc.nYears}`;
  }

  // At-retirement card
  const atRet = $("atRetirement");
  if (atRet) {
    atRet.innerHTML = `
      Required portfolio: <strong>$${fmt0(calc.requiredAtRetirement)}</strong><br/>
      Projected portfolio (no more contributions): <strong>$${fmt0(calc.portfolioAtRetirement)}</strong>
    `;
  }

  // Table
  const tbody = $("resultsTableBody");
  if (tbody) {
    tbody.innerHTML = `
      <tr><td>Current age</td><td>${toNum(inputs.currentAge)}</td></tr>
      <tr><td>Target retirement age</td><td>${toNum(inputs.retireAge)}</td></tr>
      <tr><td>Current portfolio</td><td>$${fmt0(inputs.currentPortfolio)}</td></tr>
      <tr><td>Retirement spending (annual)</td><td>$${fmt0(inputs.retireSpend)}</td></tr>
      <tr><td>Passive income at retirement (annual)</td><td>$${fmt0(inputs.passiveIncome)}</td></tr>
      <tr><td>Needed from portfolio (annual)</td><td>$${fmt0(calc.needFromPortfolio)}</td></tr>
      <tr><td>Safe withdrawal rate</td><td>${toNum(inputs.swrPct)}%</td></tr>
      <tr><td>Required portfolio at retirement</td><td>$${fmt0(calc.requiredAtRetirement)}</td></tr>
      <tr><td>Expected real return</td><td>${toNum(inputs.realReturnPct)}%</td></tr>
      <tr><td>Years until retirement</td><td>${calc.nYears}</td></tr>
      <tr><td><strong>CoastFI “number today”</strong></td><td><strong>$${fmt0(calc.requiredToday)}</strong></td></tr>
      <tr><td>Progress</td><td>${fmt0(calc.progressPct)}%</td></tr>
    `;
  }

  // Chart
  const canvas = $("coastChart");
  if (!canvas) return;
  const ctx = canvas.getContext("2d");
  if (coastChart) coastChart.destroy();

  const n = calc.nYears;
  const r = calc.r;
  const seriesYears = Array.from({ length: n + 1 }, (_, i) => i);
  const start = toNum(inputs.currentPortfolio);
  const growth = seriesYears.map(i => start * Math.pow(1 + r, i));
  const reqLine = seriesYears.map(_ => calc.requiredAtRetirement);

  coastChart = new Chart(ctx, {
    type: "line",
    data: {
      labels: seriesYears.map(y => `+${y}y`),
      datasets: [
        { label: "Portfolio (no new contributions)", data: growth },
        { label: "Required at retirement", data: reqLine }
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

// Wire up UI
function init() {
  // Honor ?unlocked=1
  const params = new URLSearchParams(location.search);
  if (params.get("unlocked") === "1") unlock();

  const form = $("coastForm");
  if (!form) {
    console.warn("CoastFI: form not found");
    return;
  }

  form.addEventListener("submit", (e) => {
    e.preventDefault();

    const inputs = {
      currentAge: $("currentAge")?.value,
      retireAge: $("retireAge")?.value,
      currentPortfolio: $("currentPortfolio")?.value,
      retireSpend: $("retireSpend")?.value,
      passiveIncome: $("passiveIncome")?.value,
      realReturnPct: $("realReturn")?.value,
      swrPct: $("swr")?.value
    };

    const calc = computeCoast(inputs);
    renderQuickSummary(inputs, calc);

    if (isUnlocked()) {
      renderFullResults(inputs, calc);
      // Clean URL (remove ?unlocked=1 if present)
      if (params.has("unlocked")) {
        history.replaceState({}, "", location.pathname);
      }
    }
  });

  // Soft-gate modal
  const openBtn = $("unlockBtn");
  const modal = $("gateModal");
  const closeBtn = $("closeGate");

  openBtn?.addEventListener("click", () => { if (modal) modal.style.display = "flex"; });
  closeBtn?.addEventListener("click", () => { if (modal) modal.style.display = "none"; });
  modal?.addEventListener("click", (e) => { if (e.target === modal) modal.style.display = "none"; });

  // If already unlocked, we’ll show full panel right after any calc
  if (isUnlocked()) {
    show($("fullResults"), true);
  } else {
    show($("fullResults"), false);
  }
}

document.addEventListener("DOMContentLoaded", init);
