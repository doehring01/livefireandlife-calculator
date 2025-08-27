// src/calculators/take-home-pay-toggle.js
if (window.__THP_TOGGLE_INIT__) {
  console.warn("THP: toggle already initialized, skipping.");
} else {
  window.__THP_TOGGLE_INIT__ = true;

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

  function triggerRecalc() {
    if (typeof window.calculateResultsDebounced === 'function') {
      window.calculateResultsDebounced();
    } else if (typeof window.calculateResults === 'function') {
      window.calculateResults();
    }
  }
  function clamp(n, min, max) { return Math.max(min, Math.min(max, n)); }

  function percentToDollar() {
    const income = parseFloat(incomeEl.value || '0') || 0;
    const pct    = clamp(parseFloat(k401PercentEl.value || '0') || 0, 0, 100);
    const dollars = income > 0 ? (income * pct / 100) : 0;
    k401El.value = Math.round(dollars);
    triggerRecalc();
  }
  function dollarToPercent() {
    const income  = parseFloat(incomeEl.value || '0') || 0;
    const dollars = parseFloat(k401El.value || '0') || 0;
    const pct = income > 0 ? (dollars / income * 100) : 0;
    k401PercentEl.value = Math.round(pct * 10) / 10;
    triggerRecalc();
  }

  function showPercentMode() {
    percentGroup.classList.remove('hidden'); percentGroup.classList.add('flex');
    dollarGroup.classList.remove('flex');    dollarGroup.classList.add('hidden');
    percentModeEl.checked = true; dollarModeEl.checked = false;
    percentToDollar();
  }
  function showDollarMode() {
    dollarGroup.classList.remove('hidden');  dollarGroup.classList.add('flex');
    percentGroup.classList.remove('flex');   percentGroup.classList.add('hidden');
    dollarModeEl.checked = true; percentModeEl.checked = false;
    dollarToPercent();
  }

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
    k401PercentEl.addEventListener('input',  percentToDollar);
    k401PercentEl.addEventListener('change', percentToDollar);
  }
  if (!k401El.__thpBound) {
    k401El.__thpBound = true;
    k401El.addEventListener('input',  dollarToPercent);
    k401El.addEventListener('change', dollarToPercent);
  }
  if (!incomeEl.__thpBound) {
    incomeEl.__thpBound = true;
    incomeEl.addEventListener('input', () => {
      if (percentModeEl.checked) percentToDollar();
      else dollarToPercent();
    });
  }

  // Initial state (matches HTML default)
  showPercentMode();
}
