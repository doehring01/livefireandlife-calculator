// src/calculators/take-home-pay-script.js
if (window.__THP_INIT__) {
  console.warn("THP: main script already initialized, skipping.");
} else {
  window.__THP_INIT__ = true;

  console.log("🚀 Take-Home Pay Calculator Loaded");

  let chartInstance;
  const K401_MAX_2025 = 23000; // TODO: confirm current-year limit

  const per = {
    annual:   (x) => x,
    monthly:  (x) => x / 12,
    biweekly: (x) => x / 26,
    weekly:   (x) => x / 52,
  };

  function fmt0(n) { return Number(n).toLocaleString(undefined, { maximumFractionDigits: 0 }); }
  function toNum(v) { const n = parseFloat(v); return Number.isFinite(n) ? n : 0; }
  function debounce(fn, ms = 150) { let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); }; }

  function calculateResults() {
    const income = toNum(document.getElementById("income")?.value);
    const k401   = toNum(document.getElementById("k401")?.value);
    const ira    = toNum(document.getElementById("ira")?.value);
    const hsa    = toNum(document.getElementById("hsa")?.value);
    const health = toNum(document.getElementById("health")?.value);

    const totalContrib  = k401 + ira + hsa;
    const taxableIncome = income - totalContrib;

    // Simple federal tax (2024 single filer)
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

    const takeHomeAnnual = income - federalTax - health - totalContrib;

    // Summary + table
    const resultsEl = document.getElementById("results");
    if (resultsEl) {
      const table = `
        <div class="cards">
          <div class="card">
            <h3>Annual Summary</h3>
            <div class="mono" style="font-size:1.25rem">Take-Home: $${fmt0(takeHomeAnnual)}</div>
            <small>Federal Tax: $${fmt0(federalTax)} · Health: $${fmt0(health)} · Contributions: $${fmt0(totalContrib)}</small>
          </div>
        </div>
        <div class="table-wrap">
          <table class="results-table">
            <thead>
              <tr>
                <th>Item</th>
                <th>Annual</th>
                <th>Monthly</th>
                <th>Biweekly</th>
                <th>Weekly</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td><strong>Take-Home Pay</strong></td>
                <td>$${fmt0(per.annual(takeHomeAnnual))}</td>
                <td>$${fmt0(per.monthly(takeHomeAnnual))}</td>
                <td>$${fmt0(per.biweekly(takeHomeAnnual))}</td>
                <td>$${fmt0(per.weekly(takeHomeAnnual))}</td>
              </tr>
              <tr>
                <td>Federal Tax (est.)</td>
                <td>$${fmt0(per.annual(federalTax))}</td>
                <td>$${fmt0(per.monthly(federalTax))}</td>
                <td>$${fmt0(per.biweekly(federalTax))}</td>
                <td>$${fmt0(per.weekly(federalTax))}</td>
              </tr>
              <tr>
                <td>Health Premiums</td>
                <td>$${fmt0(per.annual(health))}</td>
                <td>$${fmt0(per.monthly(health))}</td>
                <td>$${fmt0(per.biweekly(health))}</td>
                <td>$${fmt0(per.weekly(health))}</td>
              </tr>
              <tr>
                <td>Pre-Tax Contributions</td>
                <td>$${fmt0(per.annual(totalContrib))}</td>
                <td>$${fmt0(per.monthly(totalContrib))}</td>
                <td>$${fmt0(per.biweekly(totalContrib))}</td>
                <td>$${fmt0(per.weekly(totalContrib))}</td>
              </tr>
            </tbody>
          </table>
        </div>`;
      resultsEl.innerHTML = table;
    }

    // Chart (safe values)
    const canvas = document.getElementById("resultsChart");
    if (!canvas || typeof Chart === "undefined") return;

    const parts = [takeHomeAnnual, federalTax, health, totalContrib].map(v => {
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
          maintainAspectRatio: true,
          plugins: {
            legend: { position: "bottom" },
            tooltip: { callbacks: { label: (c) => `${c.label}: $${fmt0(c.parsed)} / yr` } }
          }
        }
      });
    } catch (err) {
      console.error("Chart render failed:", err);
    }
  }

  // Expose + debounced
  window.calculateResults = calculateResults;
  window.calculateResultsDebounced = debounce(calculateResults, 150);

  // Form events: submit and live input
  const form = document.getElementById("calculator-form");
  if (form && !form.__thpSubmitBound) {
    form.__thpSubmitBound = true;
    form.addEventListener("submit", (e) => { e.preventDefault(); calculateResults(); });
    form.addEventListener("input", window.calculateResultsDebounced);
  }

  // Inline 401k max button support (and top button if present)
  (function wireMaxButtons(){
    const k401El   = document.getElementById("k401");
    const incomeEl = document.getElementById("income");
    function set401kMax() {
      if (!k401El) return;
      k401El.value = K401_MAX_2025;
      const pctMode  = document.getElementById("k401PercentMode");
      const pctInput = document.getElementById("k401Percent");
      const income   = toNum(incomeEl && incomeEl.value);
      if (pctMode && pctMode.checked && pctInput && income > 0) {
        pctInput.value = Math.round(((K401_MAX_2025 / income) * 100) * 10) / 10;
      }
      window.calculateResultsDebounced();
    }
    const btnTop = document.getElementById("set401kMax");
    if (btnTop && !btnTop.__thpBound) { btnTop.__thpBound = true; btnTop.addEventListener("click", set401kMax); }
    if (!document.__thpClickDelegate) {
      document.__thpClickDelegate = true;
      document.addEventListener("click", (e) => { if (e.target && e.target.id === "apply401kMaxInline") set401kMax(); });
    }
  })();

  document.addEventListener("DOMContentLoaded", () => {
    if (typeof window.calculateResults === "function") window.calculateResults();
  });
}