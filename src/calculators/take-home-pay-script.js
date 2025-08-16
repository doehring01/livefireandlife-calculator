// src/calculators/take-home-pay-script.js
if (window.__THP_INIT__) {
  console.warn("THP: main script already initialized, skipping.");
} else {
  window.__THP_INIT__ = true;

  console.log("🚀 Take-Home Pay Calculator Loaded");

  /** ─────────────────────────────────────────
   * Globals / helpers
   * ─────────────────────────────────────────*/
  let chartInstance;

  // Update yearly (employee elective deferral limit)
  const K401_MAX_2025 = 23000; // TODO: confirm current-year amount

  function perPeriod(amountAnnual, freq) {
    switch (freq) {
      case "monthly":  return amountAnnual / 12;
      case "biweekly": return amountAnnual / 26;
      case "weekly":   return amountAnnual / 52;
      default:         return amountAnnual; // annual
    }
  }
  function fmt0(n)   { return Number(n).toLocaleString(undefined, { maximumFractionDigits: 0 }); }
  function toNum(v)  { const n = parseFloat(v); return Number.isFinite(n) ? n : 0; }
  function debounce(fn, ms = 150) {
    let t; return (...args) => { clearTimeout(t); t = setTimeout(() => fn(...args), ms); };
  }

  /** ─────────────────────────────────────────
   * Core calculation (your logic, refactored)
   * ─────────────────────────────────────────*/
  function calculateResults() {
    const income = toNum(document.getElementById("income")?.value);
    const k401   = toNum(document.getElementById("k401")?.value);
    const ira    = toNum(document.getElementById("ira")?.value);
    const hsa    = toNum(document.getElementById("hsa")?.value);
    const health = toNum(document.getElementById("health")?.value);

    // Display frequency (defaults to annual)
    const freqSel = document.getElementById("displayFrequency");
    const freq = freqSel ? freqSel.value : "annual";

    const totalContributions = k401 + ira + hsa;
    const taxableIncome = income - totalContributions;

    // Simple federal tax estimation (2024 single filer)
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
    const resultsEl = document.getElementById("results");
    if (resultsEl) resultsEl.innerHTML = resultsHtml;

    // --- SAFE CHART RENDER (no NaNs/negatives) ---
    const canvas = document.getElementById("resultsChart");
    if (!canvas || typeof Chart === "undefined") return;

    const parts = [takeHomeAnnual, federalTax, health, totalContributions].map(v => {
      const n = Number.isFinite(v) ? v : 0;
      return n < 0 ? 0 : n;
    });

    try {
      const ctx = canvas.getContext("2d");
      if (chartInstance) chartInstance.destroy();
      chartInstance = new Chart(ctx, {
        type: "doughnut",
        data: {
          labels: ["Take-Home", "Federal Tax", "Health", "Contributions"],
          datasets: [{ data: parts }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: { position: "bottom" },
            tooltip: {
              callbacks: { label: (c) => `${c.label}: $${fmt0(c.parsed)} / yr` }
            }
          }
        }
      });
    } catch (err) {
      console.error("Chart render failed:", err);
    }
  }

  // Expose for other scripts (toggle) and provide debounced version
  window.calculateResults = calculateResults;
  window.calculateResultsDebounced = debounce(calculateResults, 150);

  /** ─────────────────────────────────────────
   * UI wiring: submit, frequency, 401k max
   * ─────────────────────────────────────────*/
  const form = document.getElementById("calculator-form");
  if (form && !form.__thpSubmitBound) {
    form.__thpSubmitBound = true;
    form.addEventListener("submit", (e) => {
      e.preventDefault();
      calculateResults();
    });
  }

  (function attachUiHelpers(){
    const freqSel  = document.getElementById("displayFrequency");
    const k401El   = document.getElementById("k401");
    const incomeEl = document.getElementById("income");

    if (freqSel && !freqSel.__thpBound) {
      freqSel.__thpBound = true;
      freqSel.addEventListener("change", () => {
        window.calculateResultsDebounced();
      });
    }

    function set401kMax() {
      if (!k401El) return;
      k401El.value = K401_MAX_2025;

      // keep percent input in sync if Percent mode is active
      const pctMode  = document.getElementById("k401PercentMode");
      const pctInput = document.getElementById("k401Percent");
      const income   = toNum(incomeEl && incomeEl.value);
      if (pctMode && pctMode.checked && pctInput && income > 0) {
        pctInput.value = Math.round(((K401_MAX_2025 / income) * 100) * 10) / 10;
      }
      window.calculateResultsDebounced();
    }

    const btnTop = document.getElementById("set401kMax");
    if (btnTop && !btnTop.__thpBound) {
      btnTop.__thpBound = true;
      btnTop.addEventListener("click", set401kMax);
    }

    // Inline card button (rendered dynamically) — delegate once
    if (!document.__thpClickDelegate) {
      document.__thpClickDelegate = true;
      document.addEventListener("click", (e) => {
        if (e.target && e.target.id === "apply401kMaxInline") {
          set401kMax();
        }
      });
    }
  })();

  // Auto-calc once on load so the page doesn’t look empty
  document.addEventListener("DOMContentLoaded", () => {
    if (typeof window.calculateResults === "function") {
      window.calculateResults();
    }
  });
}

