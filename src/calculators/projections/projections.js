/* projections.js — FI simulator with life events (real dollars) */
(function () {
  "use strict";

  // ---------- helpers ----------
  const $ = id => document.getElementById(id);
  const fmt0 = n => Number(n||0).toLocaleString(undefined,{maximumFractionDigits:0});
  const clamp = (n, lo, hi) => Math.max(lo, Math.min(hi, n));

  // Event = { id, label, age, onetime, recurring, years }
  let EVENTS = [];

  function addEvent(preset) {
    const id = cryptoRandom();
    const row = document.createElement('div');
    row.className = 'event-row';
    row.dataset.id = id;

    const e = {
      id,
      label: preset?.label || 'Custom',
      age: preset?.age || Number($('#age').value) + 2,
      onetime: preset?.onetime || 0,
      recurring: preset?.recurring || 0,
      years: preset?.years || 0
    };
    EVENTS.push(e);

    row.innerHTML = `
      <div>
        <label>Event</label>
        <input type="text" value="${e.label}">
        <small>e.g., Child, Car, Home</small>
      </div>
      <div>
        <label>Age</label>
        <input type="number" min="0" value="${e.age}">
      </div>
      <div>
        <label>One-time ($)</label>
        <input type="number" step="500" value="${e.onetime}">
        <small>Down payment, car cash, etc.</small>
      </div>
      <div>
        <label>Recurring Δ ($/yr)</label>
        <input type="number" step="500" value="${e.recurring}">
        <small>Change in annual spend</small>
      </div>
      <div>
        <label>Years</label>
        <input type="number" min="0" value="${e.years}">
        <button type="button" class="btn btn-secondary" style="margin-top:.5rem">Remove</button>
      </div>
    `;
    $('#events').appendChild(row);

    // wire inputs
    const [labelI, ageI, oneI, recI, yrsI, rmBtn] = row.querySelectorAll('input,button');
    labelI.addEventListener('input',  () => e.label = labelI.value);
    ageI.addEventListener('input',    () => e.age = Number(ageI.value));
    oneI.addEventListener('input',    () => e.onetime = Number(oneI.value));
    recI.addEventListener('input',    () => e.recurring = Number(recI.value));
    yrsI.addEventListener('input',    () => e.years = Number(yrsI.value));
    rmBtn.addEventListener('click',   () => { EVENTS = EVENTS.filter(x=>x.id!==id); row.remove(); });
  }

  // Presets
  function addChildPreset() {
    addEvent({
      label: 'Child',
      age: Number($('#age').value) + 2,
      onetime: 0,
      recurring: 12000, // ballpark incremental/yr (childcare + misc)
      years: 18
    });
  }
  function addCarPreset() {
    addEvent({
      label: 'Car',
      age: Number($('#age').value) + 3,
      onetime: 30000, // cash purchase
      recurring: 0,
      years: 0
    });
  }
  function addHomePreset() {
    addEvent({
      label: 'Home (mortgage – rent)',
      age: Number($('#age').value) + 1,
      onetime: 80000, // down payment/closing
      recurring: 18000, // net change in annual housing cost (mortgage - prior rent)
      years: 30
    });
  }

  // ---------- core simulation ----------
  function run() {
    const cur = Number($('#age').value);
    const retireAge = Number($('#retireAge').value);
    const endAge = Number($('#planThrough').value);

    let bal = Number($('#balance').value);
    const contrib = Number($('#contrib').value);
    const spendRet = Number($('#retSpend').value);
    const passive = Number($('#passive').value);
    const rPre = Number($('#rPre').value)/100;
    const rPost = Number($('#rPost').value)/100;
    const swr = Number($('#swr').value)/100;

    const rows = [];
    let fiAge = null;

    for (let age = cur; age <= endAge; age++) {
      const isRet = age >= retireAge;

      // event impacts
      let oneTimeHit = 0;
      let recurringDelta = 0;
      EVENTS.forEach(ev => {
        if (ev.age === age) oneTimeHit += ev.onetime;
        if (ev.years > 0 && age >= ev.age && age < ev.age + ev.years) {
          recurringDelta += ev.recurring;
        }
      });

      // flows (real)
      let inflow = 0, outflow = 0, note = '';

      if (!isRet) {
        // contributions reduced by recurring event deltas (treat as extra spending)
        const netContrib = Math.max(0, contrib - Math.max(0, recurringDelta));
        inflow += netContrib;
        if (recurringDelta > 0 && netContrib === 0) note = 'High event costs; contributions fully offset';
      } else {
        const need = Math.max(0, (spendRet + recurringDelta) - passive);
        outflow += need; // spending from portfolio
      }

      if (oneTimeHit > 0) {
        outflow += oneTimeHit;
        note += (note ? ' · ' : '') + 'One-time event';
      }

      // growth
      const r = isRet ? rPost : rPre;
      bal = (bal + inflow - outflow) * (1 + r);

      rows.push({ age, bal, net: inflow - outflow, note });

      // detect FI age (first year your portfolio >= (spend - passive)/swr)
      const req = Math.max(0, (spendRet - passive)) / Math.max(0.0001, swr);
      if (fiAge === null && bal >= req) fiAge = age;
    }

    return { rows, fiAge };
  }

  // ---------- UI render ----------
  let chart;
  function render(res) {
    // quick summary
    const req = Math.max(0, (Number($('#retSpend').value) - Number($('#passive').value))) / Math.max(0.0001, Number($('#swr').value)/100);
    const q = $('#quick');
    if (res.fiAge) {
      q.innerHTML = `Estimated FI at <strong>age ${res.fiAge}</strong> (needs ~$${fmt0(req)}). 
        <br><span class="help">Life events are included in the timeline.</span>`;
    } else {
      q.innerHTML = `Not reaching FI by age ${$('#planThrough').value} with these inputs. 
        <br><span class="help">Try raising savings, lowering spend, or delaying retirement.</span>`;
    }

    // table
    const tb = $('#tbody');
    tb.innerHTML = res.rows.map(r =>
      `<tr>
        <td style="text-align:left;padding:.5rem">${r.age}</td>
        <td style="text-align:right;padding:.5rem">$${fmt0(r.bal)}</td>
        <td style="text-align:right;padding:.5rem">${r.net>=0?'+':''}$${fmt0(r.net)}</td>
        <td style="text-align:right;padding:.5rem;opacity:.75">${r.note||''}</td>
      </tr>`).join('');

    // chart
    const ctx = $('#projChart').getContext('2d');
    const labels = res.rows.map(r => r.age);
    const data = res.rows.map(r => r.bal);
    if (chart) chart.destroy();
    chart = new Chart(ctx, {
      type: 'line',
      data: { labels, datasets: [{ label: 'Portfolio (real $)', data, tension: .2 }] },
      options: {
        responsive:true, maintainAspectRatio:false,
        plugins:{ legend:{ position:'bottom' } },
        scales:{ y:{ ticks:{ callback:v => '$'+fmt0(v) } } }
      }
    });
  }

  // ---------- CSV ----------
  function toCSV(rows){
    const header = ['Age','Balance_real_$','Net_Flow_$','Notes'];
    const body = rows.map(r => [r.age, r.bal, r.net, (r.note||'').replace(/,/g,';')]);
    return [header].concat(body).map(a => a.join(',')).join('\n');
  }
  function downloadCSV(rows){
    const blob = new Blob([toCSV(rows)], {type:'text/csv'});
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'projections.csv';
    a.click();
    URL.revokeObjectURL(a.href);
  }

  // ---------- boot ----------
  function cryptoRandom(){
    // short id that works in older browsers too
    return Math.random().toString(36).slice(2,9);
  }

  function init(){
    // starter presets to show the feature
    addChildPreset();
    addCarPreset();

    $('#addChild').addEventListener('click', addChildPreset);
    $('#addCar').addEventListener('click', addCarPreset);
    $('#addHome').addEventListener('click', addHomePreset);

    $('#projForm').addEventListener('submit', (e)=>{ e.preventDefault(); const res = run(); render(res); });
    $('#runBtn').addEventListener('click', (e)=>{ e.preventDefault(); const res = run(); render(res); });
    $('#csvBtn').addEventListener('click', ()=>{ const res = run(); downloadCSV(res.rows); });
  }

  document.addEventListener('DOMContentLoaded', init);
})();