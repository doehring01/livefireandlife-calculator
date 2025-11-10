// src/calculators/contribution-optimizer/app.js

// ---------- utilities ----------
const $ = (s) => document.querySelector(s);
const toNum = (el) => {
  const v = $(el) ? $(el).value : 0;
  const n = Number.parseFloat(v);
  return Number.isFinite(n) ? n : 0;
};
const clamp = (n, lo, hi) => Math.min(Math.max(n, lo), hi);

function showNotice(html, tone="info"){
  const el = $("#callouts") || document.body;
  const border = tone === "error" ? "#f99" : tone === "warn" ? "#fd7" : "#eef2f7";
  el.innerHTML = `
    <div class="card" style="border:1px solid ${border};padding:1rem;border-radius:.5rem;margin-bottom:1rem;">
      ${html}
    </div>
  ` + el.innerHTML;
}

// ---------- data loader ----------
async function loadData() {
  const [brackets, stdDeduction, limits] = await Promise.all([
    fetch("/assets/data/tax_brackets_2025.json").then(r => r.json()),
    fetch("/assets/data/std_deduction_2025.json").then(r => r.json()),
    fetch("/assets/data/plan_limits_2025.json").then(r => r.json())
  ]);
  return { brackets, stdDeduction, limits };
}

let DATA = null;
let _loading = null;

async function ensureData(){
  if (DATA) return DATA;
  if (_loading) return _loading;
  _loading = loadData().then(d => (DATA = d)).catch(e => {
    console.error("Data load failed:", e);
    throw e;
  }).finally(()=>{ _loading = null; });
  return _loading;
}

// Wire button ASAP; load data opportunistically
document.addEventListener("DOMContentLoaded", () => {
  const runBtn = $("#runBtn");
  if (runBtn) runBtn.addEventListener("click", onRun);
  // start preloading, but don’t block UI
  ensureData().catch(() => {
    showNotice("<strong>Heads up:</strong> couldn’t preload tax data. We’ll retry when you run.", "warn");
  });
});

async function onRun(){
  try {
    if (!DATA) await ensureData();
  } catch {
    showNotice("<strong>Data load error.</strong> Please check your internet connection and refresh.", "error");
    return;
  }

  const i = readInputs();
  const bad = validateRequired();
  if (bad.length) {
    showNotice(`Please complete required fields: ${bad.map(id => `<code>${id}</code>`).join(", ")}.`, "warn");
    return;
  }

  const result = optimize(i);
  render(result);
  if (window.dataLayer) {
    window.dataLayer.push({ event: "calc_optimize_run", calc: "contribution-optimizer" });
  }
}

// ---------- required validation ----------
const REQUIRED_IDS = ["filingStatus","wages","savings","rNom","yearsToRet","retOrdRate","retCGRate"];

function validateRequired(){
  const missing = [];
  REQUIRED_IDS.forEach(id => {
    const el = document.getElementById(id);
    const ok = el && el.value !== "" && !(Number.isFinite(+el.value) && isNaN(+el.value));
    if (!ok) missing.push(id);
    el && el.classList.toggle("invalid", !ok);
  });
  // simple inline style for invalid fields
  const styleId = "calc-invalid-style";
  if (!document.getElementById(styleId)) {
    const s = document.createElement("style");
    s.id = styleId;
    s.textContent = `.invalid{outline:2px solid #c00;border-color:#c00}`;
    document.head.appendChild(s);
  }
  return missing;
}

// ---------- inputs ----------
function readInputs(){
  const i = {
    filing: ($("#filingStatus")?.value || "Single"),
    age: toNum("#age"),
    wages: toNum("#wages"),
    otherOrd: toNum("#otherOrd"),
    qdiv: toNum("#qdiv"),
    ltcg: toNum("#ltcg"),
    matchPolicy: ($("#matchPolicy")?.value || "").trim(),
    savings: toNum("#savings"),
    rNom: toNum("#rNom") / 100,
    divYield: toNum("#divYield") / 100,
    yearsToRet: toNum("#yearsToRet"),
    retOrdRate: toNum("#retOrdRate") / 100,
    retCGRate: toNum("#retCGRate") / 100,

    kLimit: 0,
    stdDeduction: {},
    brackets: {}
  };

  // Clamp/guards
  i.age = clamp(i.age || 35, 18, 100);
  i.wages = Math.max(i.wages || 0, 0);
  i.otherOrd = Math.max(i.otherOrd || 0, 0);
  i.qdiv = Math.max(i.qdiv || 0, 0);
  i.ltcg = Math.max(i.ltcg || 0, 0);
  i.savings = Math.max(i.savings || 0, 0);
  i.rNom = clamp(isFinite(i.rNom) ? i.rNom : 0.06, -0.5, 1.0);
  i.divYield = clamp(isFinite(i.divYield) ? i.divYield : 0.018, 0, 1.0);
  i.yearsToRet = clamp(i.yearsToRet || 25, 0, 70);
  i.retOrdRate = clamp(isFinite(i.retOrdRate) ? i.retOrdRate : 0.15, 0, 1.0);
  i.retCGRate = clamp(isFinite(i.retCGRate) ? i.retCGRate : 0.15, 0, 1.0);

  if (DATA) {
    i.kLimit = Number(DATA.limits?.employee_deferral || 0);
    i.stdDeduction = DATA.stdDeduction || {};
    i.brackets = DATA.brackets || {};
  }
  return i;
}

// ---------- employer match (unchanged) ----------
function calcEmployerMatch(salary, employeecntrb, policyStr){
  let match = 0;
  const nums = (String(policyStr).toLowerCase().match(/(\d+(\.\d+)?)/g) || []).map(Number);
  const t1rate = (nums[0] ?? 100) / 100;
  const t1cap  = (nums[1] ?? 3)   / 100;
  const t2rate = (nums[2] ?? 50)  / 100;
  const t2cap  = (nums[3] ?? 2)   / 100;
  const denom = Math.max(salary, 1);
  const cntrbPct = Math.min(employeecntrb / denom, 1);
  const tier1 = Math.min(cntrbPct, t1cap) * salary * t1rate;
  const tier2Base = Math.max(Math.min(cntrbPct - t1cap, t2cap), 0);
  const tier2 = tier2Base * salary * t2rate;
  match = tier1 + tier2;
  return Math.min(match, salary * (t1cap + t2cap));
}

// ---------- tax helpers (unchanged) ----------
function currentYearTax(i, employeecntrbPreTax){
  const agiOrd = Math.max(i.wages - employeecntrbPreTax, 0) + i.otherOrd;
  const taxableOrd = Math.max(agiOrd - (i.stdDeduction[i.filing] || 0), 0);
  const ordTax  = applyOrdTax(taxableOrd, i.brackets[i.filing]);
  const ltcgTax = applyCapGainsTax(taxableOrd, i.qdiv + i.ltcg, i.brackets[i.filing]);
  return { ordTax, ltcgTax, totalTax: ordTax + ltcgTax };
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
function applyCapGainsTax(taxableOrd, qd_ltcg, bracketTable){
  if (qd_ltcg <= 0 || !bracketTable || !bracketTable.capgains) return 0;
  const cg = bracketTable.capgains;
  let remaining = qd_ltcg, tax = 0;
  const room0 = Math.max(cg.zero_top - taxableOrd, 0);
  const at0 = Math.min(remaining, room0);
  remaining -= at0;
  if (remaining <= 0) return 0;
  const room15 = Math.max(cg.fifteen_top - (taxableOrd + at0), 0);
  const at15 = Math.min(remaining, room15);
  tax += at15 * 0.15;
  remaining -= at15;
  if (remaining > 0) tax += remaining * 0.20;
  return tax;
}

// ---------- forward simulation (unchanged) ----------
function growToRetirement(i, employeecntrbPreTax, rothCntrb, brokerageCntrb, employerMatch){
  const tax = currentYearTax(i, employeecntrbPreTax);
  const kTradNow = employeecntrbPreTax + employerMatch;
  const kRothNow = rothCntrb;
  const brokNow  = brokerageCntrb;
  const n = i.yearsToRet;
  const r = i.rNom;
  const taxDrag = (i.divYield) * 0.15; // MVP
  const brokEff = r - taxDrag;
  const kTradFV = kTradNow * Math.pow(1 + r, n);
  const kTradAfterTaxFV = kTradFV * (1 - i.retOrdRate);
  const kRothFV = kRothNow * Math.pow(1 + r, n);
  const brokFV = brokNow * Math.pow(1 + brokEff, n);
  const gains = Math.max(brokFV - brokNow, 0);
  const brokAfterTaxFV = brokNow + gains * (1 - i.retCGRate);
  const totalAfterTaxFV = kTradAfterTaxFV + kRothFV + brokAfterTaxFV;
  return { tax, totalAfterTaxFV, components: { kTradAfterTaxFV, kRothFV, brokAfterTaxFV } };
}

// ---------- optimizer (unchanged core + guards) ----------
function optimize(i){
  const salary = Math.max(i.wages, 0);
  const maxEmployee = Math.min(i.kLimit, salary);
  const results = [];
  const budget = Math.max(i.savings, 0);

  const empMax = Math.min(budget, maxEmployee);
  const empStep = Math.max(500, Math.round(budget * 0.05));
  const empStepFinal = Math.min(empStep, Math.max(empMax, 0) || empStep);
  const stepPct = 5;

  for (let emp = 0; emp <= empMax; emp += empStepFinal) {
    const match = calcEmployerMatch(salary, emp, i.matchPolicy);
    const remainder = Math.max(budget - emp, 0);

    for (let pRoth = 0; pRoth <= 100; pRoth += stepPct) {
      for (let pBrok = 0; pBrok <= 100 - pRoth; pBrok += stepPct) {
        const pTrad = 100 - pRoth - pBrok;
        const empTrad = emp * (pTrad / 100);
        const empRoth = emp * (pRoth / 100);
        const brok    = remainder * (pBrok / 100);
        const sim = growToRetirement(i, empTrad, empRoth, brok, match);
        results.push({
          empTotal: emp, empTrad, empRoth, brok, match,
          afterTaxFV: sim.totalAfterTaxFV, taxNow: sim.tax.totalTax
        });
      }
    }
  }

  if (!results.length) {
    const match = calcEmployerMatch(salary, 0, i.matchPolicy);
    const sim = growToRetirement(i, 0, 0, budget, match);
    results.push({ empTotal: 0, empTrad: 0, empRoth: 0, brok: budget, match,
      afterTaxFV: sim.totalAfterTaxFV, taxNow: sim.tax.totalTax });
  }

  results.sort((a,b) => b.afterTaxFV - a.afterTaxFV);
  const best = results[0];

  const allBrokerage = growToRetirement(i, 0, 0, budget, 0);
  const allTrad = (() => {
    const emp = Math.min(budget, maxEmployee);
    const match = calcEmployerMatch(salary, emp, i.matchPolicy);
    return growToRetirement(i, emp, 0, Math.max(budget - emp, 0), match);
  })();
  const allRoth = (() => {
    const emp = Math.min(budget, maxEmployee);
    const match = calcEmployerMatch(salary, emp, i.matchPolicy);
    return growToRetirement(i, 0, emp, Math.max(budget - emp, 0), match);
  })();

  return { best, allBrokerage, allTrad, allRoth, results };
}

// ---------- render (unchanged except analytics hook kept) ----------
function render(out){
  const fmt = (x) => (isFinite(x) ? x.toLocaleString(undefined,{maximumFractionDigits:0}) : "—");

  const callouts = $("#callouts");
  if (callouts) {
    callouts.innerHTML = `
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
  }

  const top = out.results.slice(0, 10);
  const labels = top.map((r,i)=>`#${i+1}`);
  const data = top.map(r=>r.afterTaxFV);
  const canvas = document.getElementById("chartOut");
  if (canvas && window.Chart) {
    const ctx = canvas.getContext("2d");
    if (window._optChart) window._optChart.destroy();
    window._optChart = new Chart(ctx, {
      type: "bar",
      data: { labels, datasets: [{ label: "After-tax FV", data }] },
      options: { responsive:true, plugins:{ legend:{display:false} } }
    });
  }

  const tbl = $("#resultsTable");
  if (tbl) {
    tbl.innerHTML = `
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

    const existing = document.getElementById("csvBtn");
    if (existing) existing.remove();
    const csvBtn = document.createElement("button");
    csvBtn.id = "csvBtn";
    csvBtn.textContent = "Download CSV";
    csvBtn.className = "btn btn-secondary";
    csvBtn.style.marginTop = "1rem";
    csvBtn.addEventListener("click", () => {
      const header = "Emp Total,Trad,Roth,Brokerage,Match,After-Tax FV,Tax Now\n";
      const rows = out.results.map(r =>
        [r.empTotal, r.empTrad, r.empRoth, r.brok, r.match, r.afterTaxFV, r.taxNow].join(",")
      ).join("\n");
      const blob = new Blob([header + rows], { type: "text/csv" });
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = "contribution-optimizer.csv";
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(a.href);
      if (window.dataLayer) {
        window.dataLayer.push({ event: "calc_csv_download", calc: "contribution-optimizer" });
      }
    });
    tbl.after(csvBtn);
  }
}
