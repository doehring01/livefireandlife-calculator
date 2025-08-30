/* projections.js — FIREandLife deterministic (real $) projection */
(function () {
  "use strict";

  // ---------- helpers ----------
  const $ = (id) => document.getElementById(id);
  const fmt = (n, d = 0) =>
    Number(n || 0).toLocaleString(undefined, { minimumFractionDigits: d, maximumFractionDigits: d });
  const clamp = (n, lo, hi) => Math.max(lo, Math.min(hi, n));

  // persist inputs
  const STORAGE_KEY = "proj.inputs.v1";
  const loadInputs = () => {
    try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}"); } catch { return {}; }
  };
  const saveInputs = (obj) => { try { localStorage.setItem(STORAGE_KEY, JSON.stringify(obj)); } catch {} };

  // ---------- core math (real dollars) ----------
  function runProjection(i) {
    const startAge = +i.curAge;
    const retAge   = +i.retAge;
    const endAge   = +i.endAge;

    const preR  = (+i.preReturn || 0) / 100;
    const postR = (+i.postReturn || 0) / 100;

    const annualSave = +i.annualSave || 0;
    const spendReal  = Math.max(0, (+i.retSpend || 0) - (+i.passive || 0));

    let bal = +i.startBal || 0;
    const rows = [];
    let brokeAt = null;

    for (let age = startAge; age <= endAge; age++) {
      const start = bal;

      // growth
      const r = age < retAge ? preR : postR;
      const growth = start * r;

      // flow (contribution before retirement; spending after)
      const flow = age < retAge ? annualSave : -spendReal;

      // end balance
      bal = start + growth + flow;

      rows.push({
        age, start, growth, flow, end: bal
      });

      if (brokeAt === null && bal <= 0 && age >= retAge) brokeAt = age;
    }

    const atRet = rows.find(r => r.age === retAge) || rows[0];
    const last  = rows[rows.length - 1];
    return { rows, atRet, last, brokeAt, spendReal };
  }

  // ---------- nominal transform (for the chart only) ----------
  function toNominalSeries(rows, inflPct) {
    const infl = (+inflPct || 0) / 100;
    let mult = 1;
    const nominal = [];
    for (let idx = 0; idx < rows.length; idx++) {
      if (idx > 0) mult *= (1 + infl);        // inflate by one year
      nominal.push(rows[idx].end * mult);
    }
    return nominal;
  }

  // ---------- rendering ----------
  let chart;
  function renderAll(i, result, showNominal) {
    // quick summary
    const q = $("quick");
    const broke = result.brokeAt != null;
    const msg = broke
      ? `At age ${result.atRet.age}, projected portfolio is $${fmt(result.atRet.end)}. 
         With spending of $${fmt(result.spendReal)}/yr, funds are projected to run out around age ${result.brokeAt}.`
      : `At age ${result.atRet.age}, projected portfolio is $${fmt(result.atRet.end)}. 
         With spending of $${fmt(result.spendReal)}/yr, your portfolio lasts through age ${result.last.age} (no depletion).`;
    q.textContent = msg.replace(/\s+/g, " ");

    // table
    const tb = $("rows");
    tb.innerHTML = result.rows.map(r => `
      <tr>
        <td>${r.age}</td>
        <td>$${fmt(r.start)}</td>
        <td>$${fmt(r.growth)}</td>
        <td>${r.flow >= 0 ? "" : "("}$${fmt(Math.abs(r.flow))}${r.flow >= 0 ? "" : ")"}</td>
        <td><strong>$${fmt(r.end)}</strong></td>
      </tr>
    `).join("");

    // chart
    const labels = result.rows.map(r => r.age);
    const realSeries = result.rows.map(r => r.end);
    const nominalSeries = toNominalSeries(result.rows, i.infl);

    const ctx = $("projChart").getContext("2d");
    if (chart) chart.destroy();
    chart = new Chart(ctx, {
      type: "line",
      data: {
        labels,
        datasets: [
          {
            label: showNominal ? "End balance (nominal)" : "End balance (real $)",
            data: showNominal ? nominalSeries : realSeries,
            tension: 0.2,
            borderWidth: 2,
            pointRadius: 0
          },
          {
            label: "Zero",
            data: labels.map(() => 0),
            borderDash: [6,6],
            borderWidth: 1,
            pointRadius: 0
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { position: "bottom" } },
        scales: {
          y: { ticks: { callback: v => "$" + fmt(v) } },
          x: { ticks: { callback: v => labels[v] } }
        }
      }
    });
  }

  // ---------- CSV ----------
  function toCsv(rows) {
    const header = "Age,Start Balance,Growth,Contrib/(Spend),End Balance\n";
    const body = rows.map(r =>
      [r.age, r.start, r.growth, r.flow, r.end].join(",")
    ).join("\n");
    return header + body;
  }
  function download(filename, text) {
    const blob = new Blob([text], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = filename; document.body.appendChild(a);
    a.click(); a.remove(); URL.revokeObjectURL(url);
  }

  // ---------- init ----------
  function readInputs() {
    return {
      curAge:     +$("curAge").value,
      retAge:     +$("retAge").value,
      endAge:     +$("endAge").value,
      startBal:   +$("startBal").value,
      annualSave: +$("annualSave").value,
      retSpend:   +$("retSpend").value,
      passive:    +$("passive").value,
      preReturn:  +$("preReturn").value,
      postReturn: +$("postReturn").value,
      infl:       +$("infl").value
    };
  }
  function writeInputs(obj) {
    for (const [k,v] of Object.entries(obj)) {
      if ($(k) && v != null && $(k).type !== "checkbox") $(k).value = v;
    }
  }

  function init() {
    // restore saved inputs if present
    const saved = loadInputs();
    if (saved && Object.keys(saved).length) writeInputs(saved);

    const form = $("projForm");
    const nominalToggle = $("nominalToggle");

    let lastInputs = null;
    let lastResult = null;

    form.addEventListener("submit", (e) => {
      e.preventDefault();

      const i = readInputs();
      // sanity
      i.retAge = clamp(i.retAge, i.curAge + 1, 100);
      i.endAge = Math.max(i.retAge, i.endAge);

      saveInputs(i);
      lastInputs = i;
      lastResult = runProjection(i);
      renderAll(i, lastResult, nominalToggle.checked);
    });

    nominalToggle.addEventListener("change", () => {
      if (lastInputs && lastResult) renderAll(lastInputs, lastResult, nominalToggle.checked);
    });

    $("exportCsv").addEventListener("click", () => {
      const i = lastInputs || readInputs();
      const res = lastResult || runProjection(i);
      download("projections.csv", toCsv(res.rows));
    });
  }

  document.addEventListener("DOMContentLoaded", init);
})();