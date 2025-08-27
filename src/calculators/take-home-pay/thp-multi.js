/* Multi-income Take-Home Pay Calculator (simplified model)
   - Federal tax: standard deduction + 2024-ish brackets
   - FICA per person: 6.2% SS to cap, 1.45% Medicare
   - Pre-tax: 401k % of gross (traditional), HSA $ (pre-tax)
   - Health premiums: household-level annual $
*/

console.log("🟧 THP multi-income loaded");

// DOM helpers
const $ = (id) => document.getElementById(id);
const $$ = (sel) => Array.from(document.querySelectorAll(sel));
const fmt0 = (n) => Number(n||0).toLocaleString(undefined,{maximumFractionDigits:0});
const per = { annual:x=>x, monthly:x=>x/12, biweekly:x=>x/26, weekly:x=>x/52 };

// Standard deduction (2024 approx)
const STD_DED = { single:14600, mfj:29200, hoh:21900 };

// Brackets (taxable income)
const BRACKETS = {
  single: [
    [0,0.10],[11600,0.12],[47150,0.22],[100525,0.24],[191950,0.32],[243725,0.35],[609350,0.37]
  ],
  mfj: [
    [0,0.10],[23200,0.12],[94300,0.22],[201050,0.24],[383900,0.32],[487450,0.35],[731200,0.37]
  ],
  hoh: [
    [0,0.10],[16550,0.12],[63100,0.22],[100500,0.24],[191950,0.32],[243700,0.35],[609350,0.37]
  ]
};

// FICA (2024)
const SS_CAP = 168600, SS_RATE = 0.062, MEDI_RATE = 0.0145;

// Income stream UI
let streamCounter = 0;
function makeStreamCard(preset={}) {
  streamCounter++;
  const id = streamCounter;
  const el = document.createElement("div");
  el.className = "income-card";
  el.dataset.streamId = id;
  el.innerHTML = `
    <h3>Income Stream ${id}</h3>
    <div class="field">
      <label>Gross Annual Income ($)</label>
      <input type="number" class="gross" min="0" step="1000" value="${preset.gross ?? 95000}">
    </div>
    <div class="field">
      <label>401(k) Contribution (%)</label>
      <input type="number" class="k401" min="0" max="100" step="0.5" value="${preset.k401 ?? 10}">
      <div class="help">Traditional 401(k) % of gross (pre-tax)</div>
    </div>
    <div class="field">
      <label>HSA Contributions ($)</label>
      <input type="number" class="hsa" min="0" step="100" value="${preset.hsa ?? 0}">
    </div>
    <div class="field" style="display:flex;gap:.75rem;align-items:center;">
      <button type="button" class="btn btn-secondary clone">Duplicate</button>
      <button type="button" class="btn-link remove">Remove</button>
    </div>
  `;
  el.querySelector(".clone").addEventListener("click", () => addStream(readStreamCard(el)));
  el.querySelector(".remove").addEventListener("click", () => { el.remove(); updateSnapshot(); });
  return el;
}
function readStreamCard(card){ return {
  gross:+(card.querySelector(".gross").value||0),
  k401:+(card.querySelector(".k401").value||0),
  hsa:+(card.querySelector(".hsa").value||0)
};}
function addStream(preset){ $("streamsWrap").appendChild(makeStreamCard(preset)); }

// Tax helpers
function taxFromBrackets(taxable, filing){
  const b = BRACKETS[filing]; if (!b) return 0;
  let tax = 0;
  for (let i=0;i<b.length;i++){
    const [floor, rate] = b[i];
    const next = (i<b.length-1) ? b[i+1][0] : Infinity;
    if (taxable>floor){ tax += (Math.min(taxable,next)-floor)*rate; } else break;
  }
  return Math.max(0,tax);
}

// Compute household
function compute(inputs){
  const streams = inputs.streams.map(s=>{
    const k401 = s.gross * (s.k401/100);
    const hsa  = s.hsa;
    const pretax = k401 + hsa;
    const ss   = Math.min(s.gross - hsa, SS_CAP) * SS_RATE;   // HSA reduces FICA wages
    const medi = (s.gross - hsa) * MEDI_RATE;
    const fica = Math.max(0, ss + medi);
    return {...s, k401, hsa, pretax, fica};
  });

  const grossHH  = streams.reduce((a,s)=>a+s.gross,0);
  const pretaxHH = streams.reduce((a,s)=>a+s.pretax,0);
  const ficaHH   = streams.reduce((a,s)=>a+s.fica,0);
  const health   = inputs.health;

  const agiLike  = Math.max(0, grossHH - pretaxHH - health);
  const std      = STD_DED[inputs.filing] ?? STD_DED.single;
  const taxable  = Math.max(0, agiLike - std);
  const fedTax   = taxFromBrackets(taxable, inputs.filing);

  const takeHome = Math.max(0, grossHH - pretaxHH - health - fedTax - ficaHH);

  return {streams, grossHH, pretaxHH, health, std, taxable, fedTax, ficaHH, takeHome};
}

// Render
let chart;
function render(r, filing){
  $("snapshot").innerHTML = `Household Gross: $${fmt0(r.grossHH)}<br>Est. Take-Home: <strong>$${fmt0(r.takeHome)}</strong>`;

  $("sumLine").textContent = `Take-Home: $${fmt0(r.takeHome)}`;
  $("sumSmall").textContent = `Federal Tax: $${fmt0(r.fedTax)} · FICA: $${fmt0(r.ficaHH)} · Health: $${fmt0(r.health)} · Pre-Tax: $${fmt0(r.pretaxHH)} · Std Deduction: $${fmt0(r.std)}`;

  $("byPerson").innerHTML = r.streams.map((s,i)=>{
    const fedShare = r.grossHH ? r.fedTax * (s.gross/r.grossHH) : 0;
    const healthShare = r.grossHH ? r.health * (s.gross/r.grossHH) : 0;
    const net = s.gross - s.pretax - s.fica - fedShare - healthShare;
    return `Person ${i+1}: Gross $${fmt0(s.gross)} → Net ~$${fmt0(net)}`;
  }).join("<br>");

  const tb = $("tableBody");
  tb.innerHTML = `
    <tr><td><strong>Gross Household Income</strong></td>
      <td>$${fmt0(per.annual(r.grossHH))}</td>
      <td>$${fmt0(per.monthly(r.grossHH))}</td>
      <td>$${fmt0(per.biweekly(r.grossHH))}</td>
      <td>$${fmt0(per.weekly(r.grossHH))}</td></tr>

    <tr><td>Pre-Tax Deductions (401k + HSA)</td>
      <td>$${fmt0(r.pretaxHH)}</td>
      <td>$${fmt0(per.monthly(r.pretaxHH))}</td>
      <td>$${fmt0(per.biweekly(r.pretaxHH))}</td>
      <td>$${fmt0(per.weekly(r.pretaxHH))}</td></tr>

    <tr><td>Health Premiums</td>
      <td>$${fmt0(r.health)}</td>
      <td>$${fmt0(per.monthly(r.health))}</td>
      <td>$${fmt0(per.biweekly(r.health))}</td>
      <td>$${fmt0(per.weekly(r.health))}</td></tr>

    <tr><td>Standard Deduction (${(filing||"single").toUpperCase()})</td>
      <td>$${fmt0(r.std)}</td><td>—</td><td>—</td><td>—</td></tr>

    <tr><td>Federal Taxable Income (est.)</td>
      <td>$${fmt0(r.taxable)}</td><td>—</td><td>—</td><td>—</td></tr>

    <tr><td>Federal Income Tax (est.)</td>
      <td>$${fmt0(r.fedTax)}</td>
      <td>$${fmt0(per.monthly(r.fedTax))}</td>
      <td>$${fmt0(per.biweekly(r.fedTax))}</td>
      <td>$${fmt0(per.weekly(r.fedTax))}</td></tr>

    <tr><td>FICA (SS + Medicare)</td>
      <td>$${fmt0(r.ficaHH)}</td>
      <td>$${fmt0(per.monthly(r.ficaHH))}</td>
      <td>$${fmt0(per.biweekly(r.ficaHH))}</td>
      <td>$${fmt0(per.weekly(r.ficaHH))}</td></tr>

    <tr><td><strong>Take-Home Pay</strong></td>
      <td><strong>$${fmt0(r.takeHome)}</strong></td>
      <td><strong>$${fmt0(per.monthly(r.takeHome))}</strong></td>
      <td><strong>$${fmt0(per.biweekly(r.takeHome))}</strong></td>
      <td><strong>$${fmt0(per.weekly(r.takeHome))}</strong></td></tr>
  `;

  // Chart
  const ctx = $("resultsChart").getContext("2d");
  if (chart) chart.destroy();
  chart = new Chart(ctx, {
    type: "doughnut",
    data: {
      labels: ["Take-Home","Federal Tax","FICA","Health","Pre-Tax"],
      datasets: [{ data: [r.takeHome, r.fedTax, r.ficaHH, r.health, r.pretaxHH] }]
    },
    options: { plugins:{ legend:{ position:"bottom" } } }
  });

  $("results").style.display = "block";
}

// Form orchestration
function getInputs(){
  const filing = $("filing").value || "single";
  const health = +($("health").value||0);
  const streams = $$("#streamsWrap .income-card").map(readStreamCard);
  return { filing, health, streams };
}
function calculate(e){
  e?.preventDefault();
  const inputs = getInputs();
  if (inputs.streams.length === 0){
    $("snapshot").textContent = "Add at least one income stream.";
    $("results").style.display = "none";
    return;
  }
  const r = compute(inputs);
  render(r, inputs.filing);
}
function updateSnapshot(){
  const {streams} = getInputs();
  const gross = streams.reduce((a,s)=>a+s.gross,0);
  $("snapshot").innerHTML = `Household Gross (entered): $${fmt0(gross)}<br>Click Calculate to see take-home.`;
}
function resetAll(){
  $("streamsWrap").innerHTML = "";
  streamCounter = 0;
  addStream();
  $("filing").value = "single";
  $("health").value = 7200;
  $("snapshot").textContent = "Add incomes and click Calculate.";
  $("results").style.display = "none";
}

// Init
function init(){
  addStream(); // one by default

  $("filing").addEventListener("change", () => {
    if ($("filing").value === "mfj" && $$("#streamsWrap .income-card").length < 2){
      addStream({gross:75000,k401:8,hsa:0});
    }
    updateSnapshot();
  });

  $("addIncome").addEventListener("click", () => { addStream(); updateSnapshot(); });
  $("streamsWrap").addEventListener("input", updateSnapshot);
  $("health").addEventListener("input", updateSnapshot);

  $("thpForm").addEventListener("submit", calculate);
  $("resetBtn").addEventListener("click", resetAll);
}
document.addEventListener("DOMContentLoaded", init);
