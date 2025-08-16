// src/calculators/take-home-pay-toggle.js
if (window.__THP_TOGGLE_INIT__) {
  console.warn("THP: toggle already initialized, skipping.");
} else {
  window.__THP_TOGGLE_INIT__ = true;

  // Elements
  const incomeEl        = document.getElementById('income');
  const k401El          = document.getElementById('k401');
  const k401PercentEl   = document.getElementById('k401Percent');
  const percentModeEl   = document.getElementById('k401PercentMode');
  const dollarModeEl    = document.getElementById('k401DollarMode');
  const percentGroup    = document.getElementById('k401PercentGroup');
  const dollarGroup     = document.getElementById('k401DollarGroup');

  if (!incomeEl || !k401El || !k401PercentEl || !percentModeEl || !dollarModeEl || !percentGroup || !dollarGroup) {
    console.warn("THP toggle: required elements not found; aborting init.");
    return;
  }

  // Helper to trigger recalculation (debounced if available)
  function triggerRecalc() {
    if (typeof window.calculateResultsDebounced === 'function') {
      window.calculateResultsDebounced();
    } else if (typeof window.calculateResults === 'function') {
      window.calculateResults();
    }
  }

  function clamp(n, min, max) {
    return Math.max(min, Math.min(max, n));
  }

  // Sync percent -> dollars
  function percentToDollar() {
    const income = parseFloat(incomeEl.value || '0') || 0;
    const pct    = clamp(parseFloat(k401PercentEl.value || '0') || 0, 0, 100);
    const dollars = income > 0 ? (income * pct / 100) : 0;
    k401El.value = Math.round(dollars);
    triggerRecalc();
  }

  // Sync dollars -> percent
  function dollarToPercent() {
    const income = parseFloat(incomeEl.value || '0') || 0;
    const dollars = parseFloat(k401El.value || '0') || 0;
    const pct = income > 0 ? (dollars / income * 100) : 0;
    k401PercentEl.value = Math.round(pct * 10) / 10; // 1 decimal
    triggerRecalc();
  }

  // Toggle UI
  function showPercentMode() {
    percentGroup.style.display = 'flex';
    dollarGroup.style.display  = 'none';
    percentModeEl.checked = true;
    // when switching to percent mode, derive dollars from current percent
    percentToDollar();
  }
  function showDollarMode() {
    percentGroup.style.display = 'none';
    dollarGroup.style.display  = 'flex';
    dollarModeEl.checked = true;
    // when switching to dollar mode, derive percent from current dollars
    dollarToPercent();
  }

  // Event bindings (guard so we don’t double-bind)
  if (!percentModeEl.__thpBound) {
    percentModeEl.__thpBound = true;
    percentModeEl.addEventListener('change', () => { if (percentModeEl.checked) showPercentMode(); });
  }
  if (!dollarModeEl.__thpBound) {
    dollarModeEl.__thpBound = true;
    dollarModeEl.addEventListener('change', () => { if (dollarModeEl.checked) showDollarMode(); });
  }
  if (!k401PercentEl.__thpBound) {
    k401PercentEl.__thpBound = true;
    k401PercentEl.addEventListener('input', percentToDollar);
    k401PercentEl.addEventListener('change', percentToDollar);
  }
  if (!k401El.__thpBound) {
    k401El.__thpBound = true;
    k401El.addEventListener('input', dollarToPercent);
    k401El.addEventListener('change', dollarToPercent);
  }
  if (!incomeEl.__thpBound) {
    incomeEl.__thpBound = true;
    // Changing income should update the other field based on current mode
    incomeEl.addEventListener('input', () => {
      if (percentModeEl.checked) percentToDollar();
      else dollarToPercent();
    });
  }

  // Initial state: show Percent mode by default (matches your HTML)
  showPercentMode();
}

