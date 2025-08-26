/* coastfi.js — CoastFI calculator with inline soft-gate (Mailchimp) + safe fallback */
(function () {
  "use strict";

  // ---------- Utilities ----------
  var $ = function (id) { return document.getElementById(id); };
  var fmt0 = function (n) { return Number(n || 0).toLocaleString(undefined, { maximumFractionDigits: 0 }); };
  var clamp = function (n, lo, hi) { return Math.max(lo, Math.min(hi, n)); };
  var yearsUntil = function (cur, target) { return Math.max(0, (Number(target) || 0) - (Number(cur) || 0)); };

  // ---------- Soft-gate state ----------
  var NEWS_KEY = "coastfiUnlocked";  // same idea as Net Worth CSV gate
  var isUnlocked = function () {
    try { return localStorage.getItem(NEWS_KEY) === "1"; } catch (e) { return false; }
  };
  var unlock = function () {
    try { localStorage.setItem(NEWS_KEY, "1"); } catch (e) {}
  };

  var show = function (el, yes) { if (el) el.classList.toggle("hidden", !yes); };

  // ---------- Math ----------
  function computeCoast(inputs) {
    var nYears = yearsUntil(inputs.currentAge, inputs.retireAge);
    var r = (Number(inputs.realReturnPct) || 0) / 100; // real return after inflation
    var swr = (Number(inputs.swrPct) || 0) / 100;

    var needFromPortfolio = Math.max(0, (Number(inputs.retireSpend) || 0) - (Number(inputs.passiveIncome) || 0));
    var requiredAtRetirement = swr > 0 ? (needFromPortfolio / swr) : Infinity;

    var denom = Math.pow(1 + r, nYears);
    var requiredToday = denom > 0 ? (requiredAtRetirement / denom) : requiredAtRetirement;

    var current = Number(inputs.currentPortfolio) || 0;
    var progressPct = requiredToday <= 0 ? 100 : clamp((current / requiredToday) * 100, 0, 999);
    var portfolioAtRetirement = current * Math.pow(1 + r, nYears);

    return {
      nYears: nYears,
      r: r,
      swr: swr,
      needFromPortfolio: needFromPortfolio,
      requiredAtRetirement: requiredAtRetirement,
      requiredToday: requiredToday,
      progressPct: progressPct,
      portfolioAtRetirement: portfolioAtRetirement
    };
  }

  // ---------- Rendering ----------
  function renderQuickSummary(inputs, calc) {
    var q = $("quickSummary");
    var u = $("unlockBlock");
    if (!q) return;

    if (calc.requiredToday <= 0) {
      q.innerHTML = '<div>With passive income covering your spending, your required portfolio is $0.</div>' +
                    '<div class="help">You’re effectively “beyond CoastFI.” Unlock to see full details.</div>';
    } else {
      var status = (Number(inputs.currentPortfolio) || 0) >= calc.requiredToday
        ? "✅ You’re at or beyond CoastFI."
        : "⏳ You’re not at CoastFI yet.";
      q.innerHTML =
        '<div>' + status + '</div>' +
        '<div>CoastFI number today: <strong>$' + fmt0(calc.requiredToday) + '</strong></div>' +
        '<div>Progress: <strong>' + fmt0(calc.progressPct) + '%</strong></div>' +
        '<div class="help">At your expected ' + (Number(inputs.realReturnPct) || 0) +
        '% real return for ' + calc.nYears + ' years.</div>';
    }

    if (u) show(u, !isUnlocked());   // show unlock CTA only if still gated
  }

  var coastChart = null;
  function renderFullResults(inputs, calc) {
    var full = $("fullResults");
    show(full, true);

    var headline = $("summaryHeadline");
    var detail = $("summaryDetail");
    if (headline && detail) {
      var status = (Number(inputs.currentPortfolio) || 0) >= calc.requiredToday
        ? "You’re at or beyond CoastFI."
        : "You haven’t reached CoastFI yet.";
      headline.textContent = status;
      detail.textContent = "CoastFI today: $" + fmt0(calc.requiredToday) +
        " · Progress: " + fmt0(calc.progressPct) + "% · Years to target: " + calc.nYears;
    }

    var atRet = $("atRetirement");
    if (atRet) {
      atRet.innerHTML =
        'Required portfolio: <strong>$' + fmt0(calc.requiredAtRetirement) + '</strong><br/>' +
        'Projected portfolio (no more contributions): <strong>$' + fmt0(calc.portfolioAtRetirement) + '</strong>';
    }

    var tbody = $("resultsTableBody");
    if (tbody) {
      tbody.innerHTML =
        '<tr><td>Current age</td><td>' + inputs.currentAge + '</td></tr>' +
        '<tr><td>Target retirement age</td><td>' + inputs.retireAge + '</td></tr>' +
        '<tr><td>Current portfolio</td><td>$' + fmt0(inputs.currentPortfolio) + '</td></tr>' +
        '<tr><td>Retirement spending (annual)</td><td>$' + fmt0(inputs.retireSpend) + '</td></tr>' +
        '<tr><td>Passive income at retirement (annual)</td><td>$' + fmt0(inputs.passiveIncome) + '</td></tr>' +
        '<tr><td>Needed from portfolio (annual)</td><td>$' + fmt0(calc.needFromPortfolio) + '</td></tr>' +
        '<tr><td>Safe withdrawal rate</td><td>' + inputs.swrPct + '%</td></tr>' +
        '<tr><td>Required portfolio at retirement</td><td>$' + fmt0(calc.requiredAtRetirement) + '</td></tr>' +
        '<tr><td>Expected real return</td><td>' + inputs.realReturnPct + '%</td></tr>' +
        '<tr><td>Years until retirement</td><td>' + calc.nYears + '</td></tr>' +
        '<tr><td><strong>CoastFI “number today”</strong></td><td><strong>$' + fmt0(calc.requiredToday) + '</strong></td></tr>' +
        '<tr><td>Progress</td><td>' + fmt0(calc.progressPct) + '%</td></tr>';
    }

    var canvas = $("coastChart");
    if (!canvas || !window.Chart) return;
    var ctx = canvas.getContext("2d");
    if (coastChart && coastChart.destroy) coastChart.destroy();

    var years = [];
    for (var i = 0; i <= calc.nYears; i++) years.push(i);
    var growth = years.map(function (i) {
      return (Number(inputs.currentPortfolio) || 0) * Math.pow(1 + calc.r, i);
    });
    var reqLine = years.map(function () { return calc.requiredAtRetirement; });

    coastChart = new Chart(ctx, {
      type: "line",
      data: {
        labels: years.map(function (y) { return "+" + y + "y"; }),
        datasets: [
          { label: "Portfolio (no new contributions)", data: growth, tension: 0.2, borderWidth: 2, pointRadius: 2 },
          { label: "Required at retirement", data: reqLine, borderDash: [6, 6], tension: 0, borderWidth: 2, pointRadius: 0 }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { position: "bottom" } },
        scales: { y: { ticks: { callback: function (v) { return "$" + fmt0(v); } } } }
      }
    });
  }

  // ---------- Form handling ----------
  var lastInputs = null;
  var lastCalc = null;

  function readInputs() {
    return {
      currentAge: ($("currentAge") || {}).value,
      retireAge: ($("retireAge") || {}).value,
      currentPortfolio: ($("currentPortfolio") || {}).value,
      retireSpend: ($("retireSpend") || {}).value,
      passiveIncome: ($("passiveIncome") || {}).value,
      realReturnPct: ($("realReturn") || {}).value,
      swrPct: ($("swr") || {}).value
    };
  }

  function handleCalculate(e) {
    if (e && e.preventDefault) e.preventDefault();
    lastInputs = readInputs();
    lastCalc = computeCoast(lastInputs);
    renderQuickSummary(lastInputs, lastCalc);
    if (isUnlocked()) renderFullResults(lastInputs, lastCalc);
  }

  // ---------- Gate (inline modal) ----------
  function openGate() {
    var gate = $("nlBackdropCF");
    if (gate) { gate.style.display = "flex"; return true; }
    return false;
  }
  function closeGate() {
    var gate = $("nlBackdropCF");
    if (gate) gate.style.display = "none";
  }
  function handleUnlockClick(e) {
    if (e && e.preventDefault) e.preventDefault();

    // If already unlocked, just show results (compute if needed)
    if (isUnlocked()) {
      if (!lastInputs) { lastInputs = readInputs(); lastCalc = computeCoast(lastInputs); }
      renderFullResults(lastInputs, lastCalc);
      show($("unlockBlock"), false);
      return;
    }

    // Try inline modal first; if missing, fall back to redirect page
    if (!openGate()) {
      window.location.href = "/calculators/coast-fi/unlock.html";
    }
  }

  // ---------- Init ----------
  function init() {
    // Support redirect flow: ?unlocked=1
    try {
      var params = new URLSearchParams(window.location.search);
      if (params.get("unlocked") === "1") {
        unlock();
        history.replaceState({}, "", window.location.pathname);
      }
    } catch (e) {}

    // Calculate handler
    var form = $("coastForm");
    if (form) form.addEventListener("submit", handleCalculate);

    // Unlock button
    var unlockBtn = $("unlockBtn");
    if (unlockBtn) {
      // Remove any prior listeners and rebind safely
      unlockBtn.onclick = null;
      unlockBtn.addEventListener("click", handleUnlockClick);
    }

    // Modal close (backdrop click)
    var modalBackdrop = $("nlBackdropCF");
    if (modalBackdrop) {
      modalBackdrop.addEventListener("click", function (e) {
        if (e.target === modalBackdrop) closeGate();
      });
    }

    // Modal controls
    var nlForm = $("nlFormCF");
    var nlSkip = $("nlSkipCF");
    var nlAlready = $("nlAlreadyCF");

    if (nlForm) {
      nlForm.addEventListener("submit", function () {
        // Let Mailchimp open/submit; unlock immediately here for UX
        unlock();
        setTimeout(function () {
          closeGate();
          if (!lastInputs) { lastInputs = readInputs(); lastCalc = computeCoast(lastInputs); }
          renderFullResults(lastInputs, lastCalc);
          show($("unlockBlock"), false);
        }, 150);
      });
    }
    if (nlSkip) {
      nlSkip.addEventListener("click", function () {
        unlock(); // Treat skip as soft unlock (same as Net Worth CSV pattern)
        closeGate();
        if (!lastInputs) { lastInputs = readInputs(); lastCalc = computeCoast(lastInputs); }
        renderFullResults(lastInputs, lastCalc);
        show($("unlockBlock"), false);
      });
    }
    if (nlAlready) {
      nlAlready.addEventListener("change", function () {
        if (nlAlready.checked) unlock();
      });
    }

    // Hide full results until unlocked + after at least one calculation
    show($("fullResults"), false);
  }

  document.addEventListener("DOMContentLoaded", init);
})();