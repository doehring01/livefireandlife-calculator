// src/calculators/take-home-pay-script.js
if (window.__THP_INIT__) {
  console.warn("THP: main script already initialized, skipping.");
} else {
  window.__THP_INIT__ = true;

  console.log("🚀 Take-Home Pay Calculator Loaded");

  // ───────────────────────── Helpers ─────────────────────────
  let chartInstance;

  // NOTE: Values below are approximate and should be reviewed yearly.
  // Standard Deduction (approx. 2024/25)
  const STD_DED = {
    single: 14600,        // Single
    married: 29200        // Married Filing Jointly
    // (You can add 'hoh' later if you add that status in the UI)
  };

  // Additional Medicare surtax thresholds (0.9%)
  const MED_SURTAX_THRESHOLD = {
    single: 200000,
    married: 250000
  };

  // Social Security wage base (cap for 6.2%).
  // Update annually when SSA publishes new base.
  const SS_WAGE_BASE = 168600; // approx. 2024

  const per = {
    annual:   (x) => x,
    monthly:  (x) => x / 12,
    biweekly: (x) => x / 26,
    weekly:   (x) => x / 52,
  };

  function fmt0(n)  { return Number(n).toLocaleString(undefined, { maximumFractionDigits: 0 }); }
  function toNum(v) { const n = parseFloat(v); return Number.isFinite(n) ? n : 0; }
  function clamp(n, min, max) { return Math.max(min, Math.min(max, n)); }
  function debounce(fn, ms = 150) { let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); }; }

  // ───────────────────────── Federal Income Tax (very rough) ─────────────────────────
  // Two bracket sets (single/married). These are simplified for illustration.
  function estFederalTax(taxable, status) {
    const s = status === "married" ? "married" : "single";

    // Very rough bracket cutoffs (based on 2024 vibe). Adjust annually for precision.
    const BRACKETS = {
      single: [
        { upTo: 11600,  rate: 0.00 },
        { upTo: 47150,  rate: 0.10 },
        { upTo: 100525, rate: 0.12 },
        { upTo: Infinity, rate: 0.22 }
      ],
      married: [
        { upTo: 23200,   rate: 0.00 },
        { upTo: 94300,   rate: 0.10 },
        { upTo: 201050,  rate: 0.12 },
        { upTo: Infinity, rate: 0.22 }
      ]
    };

    let tax = 0;
    let prevCut = 0;
    for (const b of BRACKETS[s]) {
      const sliceTop = Math.min(taxable, b.upTo);
      if (sliceTop > prevCut) {
        tax += (sliceTop - prevCut) * b.rate;
        prevCut = sliceTop;
      }
      if (taxable <= b.upTo) break;
    }
    return Math.max(0, tax);
  }

  // ───────────────────────── Core Calculation ─────────────────────────
  function calculateResults() {
    const gross      = toNum(document.getElementById("income")?.value);           // Gross Annual Income
    const k401PctRaw = toNum(document.getElementById("k401Percent")?.value);
    const k401Pct    = clamp(k401PctRaw, 0, 100);
    const ira        = toNum(document.getElementById("ira")?.value);
    const hsa        = toNum(document.getElementById("hsa")?.value);
    const health     = toNum(document.getElementById("health")?.value);
    const statusSel  = document.getElementById("filingStatus");
    const status     = (statusSel?.value === "married") ? "married" : "single";

    // 401(k) is % of gross; reduces FED taxable income, but NOT FICA wages.
    const k401 = (gross > 0 && k401Pct > 0) ? Math.round((gross * k401Pct) / 100) : 0;

    // Pre-tax reductions for FED (assumptions):
    // - 401k (traditional) reduces federal taxable income (yes)
    // - HSA salary reductions reduce federal taxable (yes)
    // - Section 125 health premiums reduce federal taxable (yes)
    // - IRA does NOT reduce paycheck withholding (generally after-tax; deduction is on return)
    const pretaxFED  = k401 + hsa + health;

    // Pre-tax reductions for FICA wages (assumptions):
    // - HSA & Section 125 health premiums reduce FICA wages (yes)
    // - 401k does NOT reduce FICA wages (still subject to SS/Medicare)
    // - IRA has no payroll impact
    const pretaxFICA = hsa + health;

    const ficaWages = Math.max(0, gross - pretaxFICA);

    // FICA: Social Security (6.2%) up to wage base, Medicare (1.45%) + surtax > threshold
    const socialSecurity = 0.062 * Math.min(ficaWages, SS_WAGE_BASE);
    const medicareBase   = 0.0145 * ficaWages;
    const surtaxThresh   = MED_SURTAX_THRESHOLD[status] || MED_SURTAX_THRESHOLD.single;
    const medicareSurtax = Math.max(0, ficaWages - surtaxThresh) * 0.009;
    const medicare       = medicareBase + medicareSurtax;
    const ficaTotal      = socialSecurity + medicare;

    // Federal taxable income after standard deduction
    const standardDeduction = STD_DED[status] ?? STD_DED.single;
    const federalTaxable    = Math.max(0, (gross - pretaxFED) - standardDeduction);

    const federalTax        = estFederalTax(federalTaxable, status);

    // Take-home is gross minus EVERYTHING withheld or paid:
    // - FICA (SS + Medicare)
    // - Federal tax
    // - Pre-tax deductions (401k/HSA/health) still reduce your paycheck (already withheld)
    // - IRA contribution (after-tax, you’re setting it aside from take-home)
    const takeHomeAnnual = Math.max(0, gross - (ficaTotal + federalTax + k401 + hsa + health + ira));

    // ───────────────── Results Table ─────────────────
    const resultsEl = document.getElementById("results");
    if (resultsEl) {
      resultsEl.innerHTML = `
        <div class="cards">
          <div class="card">
            <h3>Annual Summary</h3>
            <div class="mono" style="font-size:1.25rem">
              Take-Home: $${fmt0(takeHomeAnnual)}
            </div>
            <small>
              Federal Tax: $${fmt0(federalTax)} ·
              FICA (SS+Medicare): $${fmt0(ficaTotal)} ·
              Health: $${fmt0(health)} ·
              Contributions: $${fmt0(k401 + hsa + ira)}
            </small>
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
                <td><strong>Gross Income (${status === "married" ? "Married" : "Single"})</strong></td>
                <td>$${fmt0(per.annual(gross))}</td>
                <td>$${fmt0(per.monthly(gross))}</td>
                <td>$${fmt0(per.biweekly(gross))}</td>
                <td>$${fmt0(per.weekly(gross))}</td>
              </tr>
              <tr>
                <td>Pre-Tax Deductions (FED)</td>
                <td>$${fmt0(per.annual(pretaxFED))}</td>
                <td>$${fmt0(per.monthly(pretaxFED))}</td>
                <td>$${fmt0(per.biweekly(pretaxFED))}</td>
                <td>$${fmt0(per.weekly(pretaxFED))}</td>
              </tr>
              <tr>
                <td>Standard Deduction</td>
                <td>$${fmt0(per.annual(standardDeduction))}</td>
                <td>$${fmt0(per.monthly(standardDeduction))}</td>
                <td>$${fmt0(per.biweekly(standardDeduction))}</td>
                <td>$${fmt0(per.weekly(standardDeduction))}</td>
              </tr>
              <tr>
                <td>Federal Taxable Income</td>
                <td>$${fmt0(per.annual(federalTaxable))}</td>
                <td>$${fmt0(per.monthly(federalTaxable))}</td>
                <td>$${fmt0(per.biweekly(federalTaxable))}</td>
                <td>$${fmt0(per.weekly(federalTaxable))}</td>
              </tr>
              <tr>
                <td>Federal Income Tax (est.)</td>
                <td>$${fmt0(per.annual(federalTax))}</td>
                <td>$${fmt0(per.monthly(federalTax))}</td>
                <td>$${fmt0(per.biweekly(federalTax))}</td>
                <td>$${fmt0(per.weekly(federalTax))}</td>
              </tr>
              <tr>
                <td>FICA: Social Security</td>
                <td>$${fmt0(per.annual(socialSecurity))}</td>
                <td>$${fmt0(per.monthly(socialSecurity))}</td>
                <td>$${fmt0(per.biweekly(socialSecurity))}</td>
                <td>$${fmt0(per.weekly(socialSecurity))}</td>
              </tr>
              <tr>
                <td>FICA: Medicare</td>
                <td>$${fmt0(per.annual(medicare))}</td>
                <td>$${fmt0(per.monthly(medicare))}</td>
                <td>$${fmt0(per.biweekly(medicare))}</td>
                <td>$${fmt0(per.weekly(medicare))}</td>
              </tr>
              <tr>
                <td>Health Premiums</td>
                <td>$${fmt0(per.annual(health))}</td>
                <td>$${fmt0(per.monthly(health))}</td>
                <td>$${fmt0(per.biweekly(health))}</td>
                <td>$${fmt0(per.weekly(health))}</td>
              </tr>
              <tr>
                <td>Pre-Tax Contributions (401k + HSA)</td>
                <td>$${fmt0(per.annual(k401 + hsa))}</td>
                <td>$${fmt0(per.monthly(k401 + hsa))}</td>
                <td>$${fmt0(per.biweekly(k401 + hsa))}</td>
                <td>$${fmt0(per.weekly(k401 + hsa))}</td>
              </tr>
              <tr>
                <td>IRA Contributions (after-tax)</td>
                <td>$${fmt0(per.annual(ira))}</td>
                <td>$${fmt0(per.monthly(ira))}</td>
                <td>$${fmt0(per.biweekly(ira))}</td>
                <td>$${fmt0(per.weekly(ira))}</td>
              </tr>
              <tr>
                <td><strong>Take-Home Pay</strong></td>
                <td>$${fmt0(per.annual(takeHomeAnnual))}</td>
                <td>$${fmt0(per.monthly(takeHomeAnnual))}</td>
                <td>$${fmt0(per.biweekly(takeHomeAnnual))}</td>
                <td>$${fmt0(per.weekly(takeHomeAnnual))}</td>
              </tr>
            </tbody>
          </table>
        </div>`;
    }

    // ───────────────── Chart: breakdown of gross ─────────────────
    const canvas = document.getElementById("resultsChart");
    if (!canvas || typeof Chart === "undefined") return;

    const parts = [
      takeHomeAnnual,
      federalTax,
      ficaTotal,
      health,
      (k401 + hsa + ira)
    ].map(v => {
      const n = Number.isFinite(v) ? v : 0;
      return n < 0 ? 0 : n;
    });

    try {
      const ctx = canvas.getContext("2d");
      if (chartInstance) chartInstance.destroy();
      chartInstance = new Chart(ctx, {
        type: "doughnut",
        data: {
          labels: ["Take-Home", "Federal Tax", "FICA", "Health", "Contributions"],
          datasets: [{ data: parts }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: true,
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

  // Expose + debounced
  window.calculateResults = calculateResults;
  window.calculateResultsDebounced = debounce(calculateResults, 150);

  // Live UX
  const form = document.getElementById("calculator-form");
  if (form && !form.__thpSubmitBound) {
    form.__thpSubmitBound = true;
    form.addEventListener("submit", (e) => { e.preventDefault(); calculateResults(); });
    form.addEventListener("input", window.calculateResultsDebounced);
  }

  // First render on load
  document.addEventListener("DOMContentLoaded", () => {
    if (typeof window.calculateResults === "function") window.calculateResults();
  });
}