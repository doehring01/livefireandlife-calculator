document.getElementById("netWorthForm").addEventListener("submit", function (e) {
  e.preventDefault();

  // Helper functions
  const getValue = (id) => parseFloat(document.getElementById(id).value) || 0;
  const isChecked = (id) => document.getElementById(id).checked;

  // Get assets
  const assets = {
    cash: getValue("cash"),
    savings: getValue("savings"),
    brokerage: getValue("brokerage"),
    retirement: getValue("retirement"),
    hsa: getValue("hsa"),
    home: getValue("home"),
    otherAssets: getValue("otherAssets"),
  };

  // Get liabilities
  const liabilities = {
    mortgage: getValue("mortgage"),
    carLoans: getValue("carLoans"),
    studentLoans: getValue("studentLoans"),
    creditCards: getValue("creditCards"),
    otherDebts: getValue("otherDebts"),
  };

  // Calculate totals
  const totalAssets = Object.values(assets).reduce((sum, val) => sum + val, 0);
  const totalLiabilities = Object.values(liabilities).reduce((sum, val) => sum + val, 0);
  const netWorth = totalAssets - totalLiabilities;

  // Calculate FI Net Worth (only include selected assets)
  let fiAssets = 0;
  if (isChecked("cashFI")) fiAssets += assets.cash;
  if (isChecked("savingsFI")) fiAssets += assets.savings;
  if (isChecked("brokerageFI")) fiAssets += assets.brokerage;
  if (isChecked("retirementFI")) fiAssets += assets.retirement;
  if (isChecked("hsaFI")) fiAssets += assets.hsa;
  if (isChecked("homeFI")) fiAssets += assets.home;
  if (isChecked("otherAssetsFI")) fiAssets += assets.otherAssets;

  const fiNetWorth = fiAssets - totalLiabilities;

  // Update result text
  document.getElementById("netWorthResult").textContent = netWorth.toLocaleString();
  document.getElementById("fiNetWorthResult").textContent = fiNetWorth.toLocaleString();

  // Render Pie Chart
  const ctx = document.getElementById("netWorthChart").getContext("2d");
  if (window.netWorthChart) {
    window.netWorthChart.destroy(); // Avoid duplicate charts
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
});
