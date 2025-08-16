console.log("🚀 Take-Home Pay Calculator Loaded");

/** ─────────────────────────────────────────────────────────────
 * Globals / helpers
 * ────────────────────────────────────────────────────────────*/
let chartInstance;

// Update this to the correct year’s IRS 401(k) employee deferral limit.
const K401_MAX_2025 = 23000; // TODO: confirm and bump annually

function perPeriod(amountAnnual, freq) {
  switch (freq) {
    case "monthly":  return amountAnnual / 12;
    case "biweekly": return amountAnnual / 26;
    case "weekly":   return amountAnnual / 52;
    default:         return amountAnnual; // annual
  }
}
function fmt0(n) { return Number(n).toLocaleString(undefined, { maximumFractionDigits: 0 }); }
function toNum(v) { const n = parseFloat(v); return Number.isFinite(n) ? n : 0; }

/** ─────────────────────────────────────────────────────────────
 * Core calculation (refactor of your submit handler)
 * ────────────────────────────────────────────────────────────*/
function calculateResults() {
  const income = toNum(document.getElementById("income").value);
  const k401   = toNum(document.getElementById("k401").value);
  const ira    = toNum(document.getElementById("ira").value);
  const hsa    = toNum(document.getElementById("hsa").value);
  const health = toNum(document.getElementById("health").value);

  // Display frequency (defaults to annual if missing)
  const freqSel = document.getElementById("displayFrequency");
  const freq = freqSel ? freqSel.value : "annual";

  const totalContributions = k401 + ira + hsa;
  const taxableIncome = income - totalContributions;

  // Simple federal tax estimation (2024 single filer) — unchanged from your code
  let federalTax = 0;
  if (taxableIncome <= 11600) {
    federalTax = 0;
  } else if (taxableIncome <= 47150) {
    federalTax = (taxableIncome - 11600) * 0.1;
  } else if (taxableIncome <= 100525) {
    federalTax = (47150 - 11600) * 0.1 + (taxableIncome - 47150) * 0.12;
  } else {
    federalTax = (47150 - 11600) * 0.1 + (100525 - 47150) * 0.12 + (taxableIncome - 100525) * 0.22;
  }

  const takeHomeAnnual = income - federalTax - health - totalContributions;
  const takeHomePer    = perPeriod(takeHomeAnnual, freq);

  // Render results (cards)
  const resultsHtml = `
    <div class="cards">
      <div class="card">
        <h3>Total Take-Home (${freq.charAt(0).toUpperCase() + freq.slice(1)})</h3>
        <div class="mono" style="font-size:1.6rem">$${fmt0(takeHomePer)}</div>
        <small>Annual: $${fmt0(takeHomeAnnual)}</small>
      </div>
      <div class="card">
        <h3>Pre-Tax Contributions</h3>
        <div>$${fmt0(totalContributions)} / yr</div>
        <small>401(k): $${fmt0(k401)} · IRA: $${fmt0(ira)} · HSA: $${fmt0(hsa)}</small>
        <div style="margin-top:.5rem">
          <button type="button" class="btn" id="apply401kMaxInline">Set 401(k) to annual max</button>
        </div>
      </div>
      <div class="card">
        <h3>Federal Taxes (est.)</h3>
        <div class="mono">$${fmt0(federalTax)} / yr</div>
        <small>Taxable Income: $${fmt0(taxableIncome)}</small>
      </div>
      <div class="card">
        <h3>Health Premiums</h3>
        <div class="mono">$${fmt0(health)} / yr</div>
      </div>
    </div>
  `;
  document.getElementById("results").innerHTML = resultsHtml;

  // Render/update chart
  const ctx = document.getElementById("resultsChart").getContext("2d");
  if (chartInstance) chartInstance.destroy();
  chartInstance = new Chart(ctx, {
    type: "doughnut",
    data: {
      labels: ["Take-Home", "Federal Tax", "Health", "Contributions"],
      datasets: [{
        data: [takeHomeAnnual, federalTax, health, totalContributions]
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { position: "bottom" },
        tooltip: {
          callbacks: {
            label: (ctx) => `${ctx.label}: $${fmt0(ctx.parsed)} / yr`
          }
        }
      }
    }
  });
}

// Expose for other scripts (e.g., toggle) to call
window.calculateResults = calculateResults;

/** ─────────────────────────────────────────────────────────────
 * UI wiring (submit handler, frequency, 401k max buttons)
 * ────────────────────────────────────────────────────────────*/
document.getElementById("calculator-form").addEventListener("submit", function (e) {
  e.preventDefault();
  calculateResults();
});

// Change display frequency → re-render using the same inputs
(function attachUiHelpers(){
  const freqSel  = document.getElementById("displayFrequency");
  const form     = document.getElementById("calculator-form");
  const k401El   = document.getElementById("k401");
  const incomeEl = document.getElementById("income");

  if (freqSel) {
    freqSel.addEventListener("change", () => {
      calculateResults();
    });
  }

  // Top toolbar button
  const btnTop = document.getElementById("set401kMax");
  function set401kMax() {
    // set $ field to max
    k401El.value = K401_MAX_2025;

    // If using percent mode, keep UI in sync
    const pctMode  = document.getElementById("k401PercentMode");
    const pctInput = document.getElementById("k401Percent");
    const income   = toNum(incomeEl.value);
    if (pctMode && pctMode.checked && pctInput && income > 0) {
      pctInput.value = Math.round(((K401_MAX_2025 / income) * 100) * 10) / 10;
    }
    calculateResults();
  }
  if (btnTop) btnTop.addEventListener("click", set401kMax);

  // Inline card button (rendered dynamically each time)
  document.addEventListener("click", (e) => {
    if (e.target && e.target.id === "apply401kMaxInline") {
      set401kMax();
    }
  });
})();

