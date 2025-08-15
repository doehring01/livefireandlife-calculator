// Keeps #k401 (dollars) as the canonical value your existing math already uses.
(function () {
  const incomeEl = document.getElementById('income');   // annual gross income ($)
  const k401El   = document.getElementById('k401');     // existing 401k dollar input
  const kPctEl   = document.getElementById('k401Percent');

  const pctMode  = document.getElementById('k401PercentMode');
  const $Mode    = document.getElementById('k401DollarMode');
  const pctGroup = document.getElementById('k401PercentGroup');
  const $Group   = document.getElementById('k401DollarGroup');

  if (!incomeEl || !k401El || !kPctEl || !pctMode || !$Mode) return;

  const toNumber = n => {
    const v = parseFloat(n);
    return Number.isFinite(v) ? v : 0;
  };
  const clamp = (n, min, max) => Math.max(min, Math.min(max, n));

  function syncFromPercent() {
    const income = toNumber(incomeEl.value);
    const pct    = clamp(toNumber(kPctEl.value), 0, 100);
    const annual = Math.round((income * pct) / 100);
    k401El.value = annual;
    triggerRecalc();
  }

  function syncFromDollar() {
    const income = toNumber(incomeEl.value);
    const annual = Math.max(0, toNumber(k401El.value));
    const pct    = income > 0 ? (annual / income) * 100 : 0;
    kPctEl.value = (Math.round(pct * 10) / 10).toFixed(1);
    triggerRecalc();
  }

  function switchMode(mode) {
    if (mode === 'percent') {
      pctGroup.style.display = '';
      $Group.style.display   = 'none';
      syncFromPercent();
    } else {
      pctGroup.style.display = 'none';
      $Group.style.display   = '';
      syncFromDollar();
    }
  }

  // Wire events
  pctMode.addEventListener('change', () => switchMode('percent'));
  $Mode.addEventListener('change',   () => switchMode('dollar'));
  kPctEl.addEventListener('input',   syncFromPercent);
  k401El.addEventListener('input',   syncFromDollar);
  incomeEl.addEventListener('input', () => (pctMode.checked ? syncFromPercent() : syncFromDollar()));

  // Notify your existing calc logic
  function triggerRecalc() {
    if (typeof window.calculateResults === 'function') {
      window.calculateResults();
    } else {
      // Fallback: trigger typical input/change listeners on the $ field
      k401El.dispatchEvent(new Event('input',  { bubbles: true }));
      k401El.dispatchEvent(new Event('change', { bubbles: true }));
    }
  }

  // Optional: read ?income= and ?k401pct= from URL for shareable scenarios
  try {
    const params = new URLSearchParams(location.search);
    if (params.has('income')) incomeEl.value = params.get('income');
    if (params.has('k401pct')) {
      pctMode.checked = true; $Mode.checked = false; switchMode('percent');
      kPctEl.value = params.get('k401pct');
      syncFromPercent();
    } else if (params.has('k401')) {
      pctMode.checked = false; $Mode.checked = true; switchMode('dollar');
      k401El.value = params.get('k401');
      syncFromDollar();
    } else {
      switchMode('percent'); // default
    }
  } catch (e) {
    switchMode('percent');
  }
})();

