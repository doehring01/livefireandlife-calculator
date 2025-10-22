import brackets from "/_data/tax_brackets_2025.json" assert { type: "json" };
import stdDeduction from "/_data/std_deduction_2025.json" assert { type: "json" };
import limits from "/_data/plan_limits_2025.json" assert { type: "json" };

const $ = (s) => document.querySelector(s);

$("#runBtn").addEventListener("click", () => {
  const i = readInputs();
  const result = optimize(i);
  render(result);
});

function readInputs(){
  return {
    filing: $("#filingStatus").value,
    age: +$("#age").value,
    wages: +$("#wages").value,
    otherOrd: +$("#otherOrd").value,
    qdiv: +$("#qdiv").value,
    ltcg: +$("#ltcg").value,
    matchPolicy: $("#matchPolicy").value,  // parse simple pattern
    savings: +$("#savings").value,
    rNom: (+$("#rNom").value)/100,
    divYield: (+$("#divYield").value)/100,
    yearsToRet: +$("#yearsToRet").value,
    retOrdRate: (+$("#retOrdRate").value)/100,
    retCGRate: (+$("#retCGRate").value)/100,
    // plan limits:
    kLimit: limits.employee_deferral,          // e.g., 23000 (fill in JSON)
    kCompLimit: limits.compensation_limit,     // if needed later
    stdDeduction,
    brackets
  };
}

// Parse a simple match string like "100% up to 3%; 50% of next 2%"
function calcEmployerMatch(salary, employeecntrb, policyStr){
  const pct = (x) => x/100;
  // naive parse: support common two-tier pattern
  // tier1: 100% up to 3%
  // tier2: 50% of next 2%
  let match = 0;
  const m = policyStr.toLowerCase();
  // Extract numbers in order
  const nums = (m.match(/(\d+(\.\d+)?)/g) || []).map(Number);
  // fallback: 100% up to 3%
  const t1rate = (nums[0] ?? 100) / 100;
  const t1cap = (nums[1] ?? 3) / 100;
  const t2rate = (nums[2] ?? 50) / 100;
  const t2cap = (nums[3] ?? 2) / 100;

  const salaryCntrbPct = Math.min(employeecntrb / salary, 1);
  const tier1 = Math.min(salaryCntrbPct, t1cap) * salary * t1rate;
  const tier2Base = Math.max(Math.min(salaryCntrbPct - t1cap, t2cap), 0);
  const tier2 = tier2Base * salary * t2rate;
  match = tier1 + tier2;
  return Math.min(match, salary * (t1cap + t2cap)); // conservative cap
}

// Compute current-year tax for a scenario
function currentYearTax(i, employeecntrbPreTax, rothCntrb, brokerageCntrb, salary){
  // Traditional 401k reduces wages
  const agiOrd = Math.max(salary - employeecntrbPreTax, 0) + i.otherOrd;
  const agi = agiOrd + i.qdiv + i.ltcg;
  const taxableOrd = Math.max(agiOrd - i.stdDeduction[i.filing], 0);

  // Ordinary tax on taxableOrd
  const ordTax = applyOrdTax(taxableOrd, i.brackets[i.filing]);

  // LTCG/QDIV stacked on top of ordinary
  const ltcgTax = applyCapGainsTax(taxableOrd, i.qdiv + i.ltcg, i.brackets[i.filing]);

  return {
    agi, ordTax, ltcgTax,
    totalTax: ordTax + ltcgTax
  };
}

// Apply ordinary brackets
function applyOrdTax(taxable, bracketTable){
  let tax = 0, remaining = taxable;
  for(const b of bracketTable.ordinary){
    const width = Math.max(Math.min(remaining, b.top - b.bottom), 0);
    if(width <= 0) break;
    tax += width * b.rate;
    remaining -= width;
  }
  return tax;
}

// Cap gains stacking: if taxableOrd < threshold, part of CG/QDIV taxed at 0%
function applyCapGainsTax(taxableOrd, qd_ltcg, bracketTable){
  if(qd_ltcg <= 0) return 0;
  const cg = bracketTable.capgains;
  let remaining = qd_ltcg, tax = 0;

  // 0% band
  const room0 = Math.max(cg.zero_top - taxableOrd, 0);
  const at0 = Math.min(remaining, room0);
  remaining -= at0; // taxed at 0%

  if(remaining <= 0) return 0;

  // 15% band
  const room15 = Math.max(cg.fifteen_top - (taxableOrd + at0), 0);
  const at15 = Math.min(remaining, room15);
  tax += at15 * 0.15;
  remaining -= at15;

  // 20% band
  if(remaining > 0) tax += remaining * 0.20;

  return tax;
}

// Forward simulation to retirement (after-tax values)
function growToRetirement(i, employeecntrbPreTax, rothCntrb, brokerageCntrb, employerMatch, salary){
  // current-year tax:
  const tax = currentYearTax(i, employeecntrbPreTax, rothCntrb, brokerageCntrb, salary);

  // Account contributions this year:
  const kTradNow = employeecntrbPreTax + employerMatch; // both pre-tax
  const kRothNow = rothCntrb;                            // post-tax source
  const brokNow = brokerageCntrb;                        // post-tax source

  // Assume tax is paid from cash flow (outside “savings”); savings is after-tax budget.
  // Grow balances for N years:
  const n = i.yearsToRet, r = i.rNom;
  const brokYield = i.divYield;

  // Traditional 401k grows tax-deferred; later taxed at retOrdRate
  const kTradFV = kTradNow * Math.pow(1 + r, n);
  const kTradAfterTaxFV = kTradFV * (1 - i.retOrdRate);

  // Roth grows tax-free
  const kRothFV = kRothNow * Math.pow(1 + r, n);

  // Brokerage: tax drag from dividends each year (simplified)
  // Approximate with an effective growth: (1 + r - brokYield) * (1) + brokYield*(1 - current QD rate)
  // For MVP, drag at current LTCG/qdiv blended (reuse applyCapGainsTax? keep simple %)
  const taxDrag = brokYield * 0.15; // simple assumption; refine later
  const brokEff = r - taxDrag;
  const brokFV = brokNow * Math.pow(1 + brokEff, n);
  // At liquidation, pay LTCG on gains only:
  const gains = Math.max(brokFV - brokNow, 0);
  const brokAfterTaxFV = brokNow + gains * (1 - i.retCGRate);

  const totalAfterTaxFV = kTradAfterTaxFV + kRothFV + brokAfterTaxFV;

  return { tax, totalAfterTaxFV, components: { kTradAfterTaxFV, kRothFV, brokAfterTaxFV } };
}

// Brute-force allocation search
function optimize(i){
  const salary = i.wages; // simple for MVP
  const maxEmployee = i.kLimit;

  // First: sweep employee contribution amount from 0..min(budget,maxEmployee)
  // For each amount, add employer match (based on salary %), then decide split between Trad vs Roth vs Brokerage:
  // Strategy: capture match → split remainder across (Trad, Roth, Brokerage) in 5% steps.
  const stepPct = 5; // %
  const results = [];

  // Convert annual savings into employee 401k + brokerage/roth pool
  const budget = i.savings;

  // We'll try employee deferral from 0..min(budget,maxEmployee) in 5% of budget steps
  for(let emp = 0; emp <= Math.min(budget, maxEmployee); emp += Math.max(500, Math.round(budget*0.05))){
    const match = calcEmployerMatch(salary, emp, i.matchPolicy);

    const remainder = Math.max(budget - emp, 0);

    for(let pRoth = 0; pRoth <= 100; pRoth += stepPct){
      for(let pBrok = 0; pBrok <= 100 - pRoth; pBrok += stepPct){
        const pTrad = 100 - pRoth - pBrok;

        const empTrad = emp * (pTrad/100);
        const empRoth = emp * (pRoth/100);
        const brok = remainder * (pBrok/100) + emp * 0 * (pBrok/100); // keep brokerage separate from emp split

        // NOTE: employee deferral “emp” is already bounded by 401k limit; we split emp between Trad/Roth.
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

  // Pick max after-tax FV
  results.sort((a,b) => b.afterTaxFV - a.afterTaxFV);
  const best = results[0];

  // Build quick comparison set
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

function render(out){
  const fmt = (x) => x.toLocaleString(undefined,{maximumFractionDigits:0});
  $("#callouts").innerHTML = `
    <div class="card">
      <h3>Recommended split (MVP)</h3>
      <p><strong>Employee 401k:</strong> $${fmt(out.best.empTotal)} 
         → Trad $${fmt(out.best.empTrad)}, Roth $${fmt(out.best.empRoth)} 
         &nbsp;|&nbsp; <strong>Brokerage:</strong> $${fmt(out.best.brok)} 
         &nbsp;|&nbsp; <strong>Employer Match (est):</strong> $${fmt(out.best.match)}</p>
      <p><strong>Projected after-tax value at retirement:</strong> $${fmt(out.best.afterTaxFV)}</p>
      <p><small>Note: MVP uses simplified dividend tax drag and retirement rates. Refine in Phase 2.</small></p>
    </div>
  `;

  // Chart: top 10 allocations by after-tax FV
  const top = out.results.slice(0, 10);
  const labels = top.map((r,i)=>`#${i+1}`);
  const data = top.map(r=>r.afterTaxFV);
  const ctx = document.getElementById("chartOut").getContext("2d");
  if(window._optChart) window._optChart.destroy();
  window._optChart = new Chart(ctx, {
    type: "bar",
    data: { labels, datasets: [{ label: "After-tax FV", data }] },
    options: { responsive:true, plugins:{ legend:{display:false} } }
  });

  // Comparison table
  $("#resultsTable").innerHTML = `
    <table class="table">
      <thead><tr>
        <th>Strategy</th><th>After-tax FV</th>
      </tr></thead>
      <tbody>
        <tr><td>All Brokerage</td><td>$${fmt(out.allBrokerage.totalAfterTaxFV)}</td></tr>
        <tr><td>All Traditional 401k to limit</td><td>$${fmt(out.allTrad.totalAfterTaxFV)}</td></tr>
        <tr><td>All Roth 401k to limit</td><td>$${fmt(out.allRoth.totalAfterTaxFV)}</td></tr>
        <tr><td><strong>Optimal (MVP)</strong></td><td><strong>$${fmt(out.best.afterTaxFV)}</strong></td></tr>
      </tbody>
    </table>
  `;
}
