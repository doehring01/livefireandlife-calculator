console.log("✅ Net Worth Tracker Script Loaded");

document.getElementById("netWorthForm").addEventListener("submit", function (e) {
  e.preventDefault();
  console.log("✅ Form submitted");

  const getValue = (id) => parseFloat(document.getElementById(id).value) || 0;
  const isChecked = (id) => document.getElementById(id).checked;

  // Assets
  const assets = {
    cash: getValue("cash"),
    savings: getValue("savings"),
    brokerage: getValue("brokerage"),
    retirement: getValue("retirement"),
    hsa: getValue("hsa"),
    home: getValue("home"),
    otherAssets: getValue("otherAssets"),
  };

  // Liabilities
  const liabilities = {
    mortgage: getValue("mortgage"),
    carLoans: getValue("carLoans"),
    studentLoans: getValue("studentLoans"),
    creditCards: getValue("creditCards"),
    otherDebts: getValue("otherDebts"),
  };

  const totalAssets = Object.values(assets).reduce((a, b) => a + b, 0);
  const totalLiabilities = Object.values(liabilities).reduce((a, b) => a + b, 0);
  const netWorth = totalAssets - totalLiabilities;

  let fiAssets = 0;
  if (isChecked("cashFI")) fiAssets += assets.cash;
  if (isChecked("savingsFI")) fiAssets += assets.savings;
  if (isChecked("brokerageFI")) fiAssets += assets.brokerage;
  if (isChecked("retirementFI")) fiAssets += assets.retirement;
  if (isChecked("hsaFI")) fiAssets += assets.hsa;
  if (isChecked("homeFI")) fiAssets += assets.home;
  if (isChecked("otherAssetsFI")) fiAssets += assets.otherAssets;

  const fiNetWorth = fiAssets - totalLiabilities;

  console.log("Calculated:", { netWorth, fiNetWorth });

  document.getElementById("netWorthResult").textContent = netWorth.toLocaleString();
  document.getElementById("fiNetWorthResult").textContent = fiNetWorth.toLocaleString();

  const ctx = document.getElementById("netWorthChart");
  if (!ctx) {
    console.error("❌ Canvas element not found!");
    return;
  }

  if (typeof Chart === "undefined") {
    console.error("❌ Chart.js not loaded");
    return;
  }

  if (window.netWorthChart && typeof window.netWorthChart.destroy === "function") {
    window.netWorthChart.destroy();
  }

  window.netWorthChart = new Chart(ctx, {
    type: "pie",
    data: {
      labels: ["Total Net Worth", "FI Net Worth"],
      datasets: [{
        data: [netWorth, fiNetWorth],
        backgroundColor: ["#0077b6", "#90e0ef"]
      }]
    },
    options: {
      responsive: true,
      plugins: {
        legend: { position: "bottom" },
        tooltip: {
          callbacks: {
            label: (context) => `$${context.parsed.toLocaleString()}`
          }
        }
      }
    }
  });

  console.log("✅ Chart rendered successfully");
});
