// coastfi.js (hardened unlock + small UX polish)
console.log("🔵 CoastFI calculator loaded");

let coastChart;

// helpers
const $ = (id) => document.getElementById(id);
const fmt0 = (n) => Number(n).toLocaleString(undefined, { maximumFractionDigits: 0 });
const clamp = (n, lo, hi) => Math.max(lo, Math.min(hi, n));
const yearsUntil = (cur, target) => Math.max(0, (Number(target)||0) - (Number(cur)||0));

// gate state
const isUnlocked = () => {
  try { return localStorage.getItem("coastfiUnlocked") === "1"; } catch(e){ return false; }
};
const unlock = () => { try { localStorage.setItem("coastfiUnlocked", "1"); } catch(e) {} };

// show/hide
const show = (el, yes) => { if (!el) return; el.classList.toggle("hidden", !yes); };

// math
function computeCoast(inputs) {
  const {
    currentAge, retireAge, currentPortfolio,
    retireSpend, passiveIncome, realReturnPct, swrPct,
  } = inputs;

  const nYears = yearsUntil(currentAge, retireAge);
  const r = (Number(realReturnPct) || 0) / 100; // real return after inflation
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

// quick summary
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

  // show unlock CTA only if still gated
  show(u, !isUnlocked());
}

// full results
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

  const tbody = $("resultsTableBody");
  if (tbody) {
    tbody.innerHTML = `
      <tr><td>Current age</td><td>${inputs.currentAge}</td></tr>
      <tr><td>Target retirement age</td><td>${inputs.retireAge}</td></tr>
      <tr><td>Current portfolio</td><td>$${fmt0(inputs.currentPortfolio)}</td></tr>
      <tr><td>Retirement spending (annual)</td><td>$${fmt0(inputs.retireSpend)}</td></tr>
      <tr><td>Passive income at retirement (annual)</td><td>$${fmt0(inputs.passiveIncome)}</td></tr>
      <tr><td>Needed from portfolio (annual)</td><td>$${fmt0(calc.needFromPortfolio)}</td></tr>
      <tr><td>Safe withdrawal rate</td><td>${inputs.swrPct}%</td></tr>
      <tr><td>Required portfolio at retirement</td><td>$${fmt0(calc.requiredAtRetirement)}</td></tr>
      <tr><td>Expected real return</td><td>${inputs.realReturnPct}%</td></tr>
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

// init
function init() {
  // support redirect back with ?unlocked=1
  const params = new URLSearchParams(location.search);
  if (params.get("unlocked") === "1") {
    unlock();
    history.replaceState({}, "", location.pathname); // clean the URL
  }

  // form submit -> compute + render quick (and full if unlocked)
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
      // remember last calc so unlock button can render immediately if already unlocked
      window._coastLast = { inputs, calc };

      renderQuickSummary(inputs, calc);
      if (isUnlocked()) renderFullResults(inputs, calc);
    });
  }

  // 🔒 Soft-gate: robust unlock handler
  const unlockBtn = $("unlockBtn");
  if (unlockBtn) {
    unlockBtn.addEventListener("click", (e) => {
      e.preventDefault();

      // If already unlocked, just show full results from the last calc
      if (isUnlocked() && window._coastLast) {
        console.log("➡️ Already unlocked: rendering full results immediately");
        const { inputs, calc } = window._coastLast;
        renderFullResults(inputs, calc);
        return;
      }

      const modal = $("gateModal");
      if (modal) {
        console.log("➡️ Opening inline modal gate");
        modal.style.display = "flex";
      } else {
        console.log("➡️ No modal present; redirecting to unlock page");
        window.location.href = "/calculators/coast-fi/unlock.html";
      }
    });
  }

  // If already unlocked from a prior visit, keep full results hidden until a fresh calc
  show($("fullResults"), false);
}

document.addEventListener("DOMContentLoaded", init);