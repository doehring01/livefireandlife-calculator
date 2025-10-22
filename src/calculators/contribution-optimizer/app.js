// src/calculators/contribution-optimizer/app.js

// ---------- utilities ----------
const $ = (s) => document.querySelector(s);
const toNum = (el) => Number($(el).value || 0);

// ---------- data loader (no bundler needed) ----------
async function loadData() {
  const [brackets, stdDeduction, limits] = await Promise.all([
    fetch("/assets/data/tax_brackets_2025.json").then(r => r.json()),
    fetch("/assets/data/std_deduction_2025.json").then(r => r.json()),
    fetch("/assets/data/plan_limits_2025.json").then(r => r.json())
  ]);
  return { brackets, stdDeduction, limits };
}

let DATA = null;

(async function init() {
  try {
    DATA = await loadData();
    const runBtn = $("#runBtn");
    if (runBtn) {
      runBtn.addEventListener("click", () => {
        const i = readInputs();
        const result = optimize(i);
        render(result);
      });
    }
  } catch (e) {
    console.error("Failed to load calculator data:", e);
    const container = $("#callouts") || document.body;
    container.insertAdjacentHTML("afterbegin", `
      <div class="card" style="border:1px solid #f99;padding:1rem;border-radius:.5rem;">
        <strong>Data load error.</strong> Please refresh the page.
      </div>
    `);
  }
})();

// ---------- inputs ----------
function readInputs(){
  return {
    filing: $("#filingStatus").value,                // "Single" | "MFJ"
    age: toNum("#age"),
    wages: toNum("#wages"),
    otherOrd: toNum("#otherOrd"),
    qdiv: toNum("#qdiv"),
    ltcg: toNum("#ltcg"),
    matchPolicy: $("#matchPolicy").value,
    savings: toNum("#savings"),
    rNom: toNum("#rNom") / 100,
    divYield: toNum("#divYield") / 100,
    yearsToRet: toNum("#yearsToRet"),
    retOrdRate: toNum("#retOrdRate") / 100,
    retCGRate: toNum("#retCGRate") / 100,

    // from JSON data
    kLimit: DATA.limits.employee_deferral,           // e.g. 23000
    stdDeduction: DATA.stdDeduction,                 // { Single: 14600, MFJ: 29200 }
    brackets: DATA.brackets                          // full bracket tables
  };
}

// ---------- employer match (simple 2-tier parser) ----------
function calcEmployerMatch(salary, employeecntrb, policyStr){
  // Supports "100% up to 3%; 50% of next 2%" style
  let match = 0;
  const nums = (policyStr.toLowerCase().match(/(\d+(\.\d+)?)/g) || []).map(Number);

  const t1rate = (nums[0] ?? 100) / 100;
  const t1cap  = (nums[1] ?? 3)   / 100;
  const t2rate = (nums[2] ?? 50)  / 100;
  const t2cap  = (nums[3] ?? 2)   / 100;

  const cntrbPct = Math.min(employeecntrb / Math.max(salary, 1), 1);
  const tier1 = Math.min(cntrbPct, t1cap) * salary * t1rate;
  const tier2Base = Math.max(Math.min(cntrbPct - t1cap, t2cap), 0);
  const tier2 = tier2Base * salary * t2rate;

  match = tier1 + tier2;
  // Conservative cap: employer only matches up to (t1cap+t2cap) of salary
  return Math.min(match, salary * (t1cap + t2cap));
}

// ---------- tax helpers ----------
function currentYearTax(i, employeecntrbPreTax, rothCntrb, brokerageCntrb, salary){
  // Traditional 401k reduces wages (ordinary)
  const agiOrd = Math.max(salary - employeecntrbPreTax, 0) + i.otherOrd;
  const agi = agiOrd + i.qdiv + i.ltcg;

  const taxableOrd = Math.max(agiOrd - (i.stdDeduction[i.filing] || 0), 0);

  const ordTax  = applyOrdTax(taxableOrd, i.brackets[i.filing]);
  const ltcgTax = applyCapGainsTax(taxableOrd, i.qdiv + i.ltcg, i.brackets[i.filing]);

  return { agi, ordTax, ltcgTax, totalTax: ordTax + ltcgTax };
}

function applyOrdTax(taxable, bracketTable){
  if (!bracketTable || !Array.isArray(bracketTable.ordinary)) return 0;
  let tax = 0, remaining = taxable;
  for (const b of bracketTable.ordinary) {
    const width = Math.max(Math.min(remaining, b.top - b.bottom), 0);
    if (width <= 0) break;
    tax += width * b.rate;
    remaining -= width;
  }
  return tax;
}

// LTCG/QDIV stacked above ordinary income
function applyCapGainsTax(taxableOrd, qd_ltcg, bracketTable){
  if (qd_ltcg <= 0 || !bracketTable || !bracketTable.capgains) return 0;
  const cg = bracketTable.capgains;
  let remaining = qd_ltcg, tax = 0;

  // 0% band
  const room0 = Math.max(cg.zero_top - taxableOrd, 0);
  const at0 = Math.min(remaining, room0);
  remaining -= at0;

  if (remaining <= 0) return 0;

  // 15% band
  const room15 = Math.max(cg.fifteen_top - (taxableOrd + at0), 0);
  const at15 = Math.min(remaining, room15);
  tax += at15 * 0.15;
  remaining -= at15;

  // 20% band
  if (remaining > 0) tax += remaining * 0.20;

  return tax;
}

// ---------- forward simulation ----------
function growToRetirement(i, employeecntrbPreTax, rothCntrb, brokerageCntrb, employerMatch, salary){
  const tax = currentYearTax(i, employeecntrbPreTax, rothCntrb, brokerageCntrb, salary);

  // Contributions this year
  const kTradNow = employeecntrbPreTax + employerMatch; // pre-tax bucket
  const kRothNow = rothCntrb;                            // post-tax bucket
  const brokNow  = brokerageCntrb;                       // taxable bucket

  const n = i.yearsToRet;
  const r = i.rNom;
  const brokYield = i.divYield;

  // Traditional: tax-deferred growth, taxed at retirement rate
  const kTradFV = kTradNow * Math.pow(1 + r, n);
  const kTradAfterTaxFV = kTradFV * (1 - i.retOrdRate);

  // Roth: tax-free growth
  const kRothFV = kRothNow * Math.pow(1 + r, n);

  // Brokerage: apply simple dividend drag each year (approx)
  const taxDrag = brokYield * 0.15; // MVP assumption; refine with current-year bracket if desired
  const brokEff = r - taxDrag;
  const brokFV = brokNow * Math.pow(1 + brokEff, n);
  const gains = Math.max(brokFV - brokNow, 0);
  const brokAfterTaxFV = brokNow + gains * (1 - i.retCGRate);

  const totalAfterTaxFV = kTradAfterTaxFV + kRothFV + brokAfterTaxFV;

  return {
    tax,
    totalAfterTaxFV,
    components: { kTradAfterTaxFV, kRothFV, brokAfterTaxFV }
  };
}

// ---------- optimizer ----------
function optimize(i){
  const salary = i.wages;
  const maxEmployee = i.kLimit;
  const stepPct = 5; // sweep in 5% increments
  const results = [];

  const budget = i.savings; // total dollars available to save this year

  // Sweep employee deferral from 0..min(budget, 401k limit)
  const empStep = Math.max(500, Math.round(budget * 0.05));
  for (let emp = 0; emp <= Math.min(budget, maxEmployee); emp += empStep) {
    const match = calcEmployerMatch(salary, emp, i.matchPolicy);
    const remainder = Math.max(budget - emp, 0);

    for (let pRoth = 0; pRoth <= 100; pRoth += stepPct) {
      for (let pBrok = 0; pBrok <= 100 - pRoth; pBrok += stepPct) {
        const pTrad = 100 - pRoth - pBrok;

        const empTrad = emp * (pTrad / 100);
        const empRoth = emp * (pRoth / 100);
        const brok    = remainder * (pBrok / 100);

        const sim = growToRetirement(i, empTrad, empRoth, brok, match, salary);
        results.push({
          empTotal: emp,
          empTrad, empRoth, brok,
          match,
          afterTaxFV: sim.totalAfterTaxFV,
          taxNow: sim.tax.totalTax
        });
      }
    }
  }

  results.sort((a,b) => b.afterTaxFV - a.afterTaxFV);
  const best = results[0];

  // Quick comparisons
  const allBrokerage = growToRetirement(i, 0, 0, i.savings, 0, salary);
  const allTrad = (() => {
    const emp = Math.min(i.savings, maxEmployee);
    const match = calcEmployerMatch(salary, emp, i.matchPolicy);
    return growToRetirement(i, emp, 0, Math.max(i.savings - emp, 0), match, salary);
  })();
  const allRoth = (() => {
    const emp = Math.min(i.savings, maxEmployee);
    const match = calcEmployerMatch(salary, emp, i.matchPolicy);
    return growToRetirement(i, 0, emp, Math.max(i.savings - emp, 0), match, salary);
  })();

  return { best, allBrokerage, allTrad, allRoth, results };
}

// ---------- render ----------
function render(out){
  const fmt = (x) => (isFinite(x) ? x.toLocaleString(undefined,{maximumFractionDigits:0}) : "—");

  $("#callouts").innerHTML = `
    <div class="card" style="border:1px solid #eef2f7;padding:1rem;border-radius:.5rem;">
      <h3>Recommended split (MVP)</h3>
      <p><strong>Employee 401k:</strong> $${fmt(out.best.empTotal)}
         → Trad $${fmt(out.best.empTrad)}, Roth $${fmt(out.best.empRoth)}
         &nbsp;|&nbsp; <strong>Brokerage:</strong> $${fmt(out.best.brok)}
         &nbsp;|&nbsp; <strong>Employer Match (est):</strong> $${fmt(out.best.match)}</p>
      <p><strong>Projected after-tax value at retirement:</strong> $${fmt(out.best.afterTaxFV)}</p>
      <p><small>Assumptions are simplified for MVP (dividend drag = 15%, retirement tax rates user-provided).</small></p>
    </div>
  `;

  // Chart: top 10 allocations by after-tax FV
  const top = out.results.slice(0, 10);
  const labels = top.map((r,i)=>`#${i+1}`);
  const data = top.map(r=>r.afterTaxFV);
  const canvas = document.getElementById("chartOut");
  if (canvas) {
    const ctx = canvas.getContext("2d");
    if (window._optChart) window._optChart.destroy();
    window._optChart = new Chart(ctx, {
      type: "bar",
      data: { labels, datasets: [{ label: "After-tax FV", data }] },
      options: { responsive:true, plugins:{ legend:{display:false} } }
    });
  }

  // Comparison table + CSV export button
  $("#resultsTable").innerHTML = `
    <table class="table" style="width:100%;border-collapse:collapse;">
      <thead><tr>
        <th style="text-align:left;padding:.5rem;border-bottom:1px solid #eee;">Strategy</th>
        <th style="text-align:right;padding:.5rem;border-bottom:1px solid #eee;">After-tax FV</th>
      </tr></thead>
      <tbody>
        <tr><td style="padding:.5rem;">All Brokerage</td><td style="padding:.5rem;text-align:right;">$${fmt(out.allBrokerage.totalAfterTaxFV)}</td></tr>
        <tr><td style="padding:.5rem;">All Traditional 401k to limit</td><td style="padding:.5rem;text-align:right;">$${fmt(out.allTrad.totalAfterTaxFV)}</td></tr>
        <tr><td style="padding:.5rem;">All Roth 401k to limit</td><td style="padding:.5rem;text-align:right;">$${fmt(out.allRoth.totalAfterTaxFV)}</td></tr>
        <tr><td style="padding:.5rem;"><strong>Optimal (MVP)</strong></td><td style="padding:.5rem;text-align:right;"><strong>$${fmt(out.best.afterTaxFV)}</strong></td></tr>
      </tbody>
    </table>
  `;

  // CSV export
  const existing = document.getElementById("csvBtn");
  if (existing) existing.remove();
  const csvBtn = document.createElement("button");
  csvBtn.id = "csvBtn";
  csvBtn.textContent = "Download CSV";
  csvBtn.className = "btn btn-secondary";
  csvBtn.style.marginTop = "1rem";
  csvBtn.onclick = () => {
    const header = "Emp Total,Trad,Roth,Brokerage,Match,After-Tax FV,Tax Now\n";
    const rows = out.results.map(r =>
      [r.empTotal, r.empTrad, r.empRoth, r.brok, r.match, r.afterTaxFV, r.taxNow].join(",")
    ).join("\n");
    const blob = new Blob([header + rows], { type: "text/csv" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "contribution-optimizer.csv";
    a.click();
  };
  $("#resultsTable").after(csvBtn);
}
