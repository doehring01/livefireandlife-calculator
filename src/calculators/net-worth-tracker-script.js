document.getElementById("netWorthForm").addEventListener("submit", function(e) {
  e.preventDefault();

  // Helpers
  const getValue = id => parseFloat(document.getElementById(id).value) || 0;
  const isChecked = id => document.getElementById(id).checked;

  // Gather inputs
  const assets = {
    cash: getValue("cash"),
    savings: getValue("savings"),
    brokerage: getValue("brokerage"),
    retirement: getValue("retirement"),
    hsa: getValue("hsa"),
    home: getValue("home"),
    otherAssets: getValue("otherAssets")
  };
  const liabilities = {
    mortgage: getValue("mortgage"),
    carLoans: getValue("carLoans"),
    studentLoans: getValue("studentLoans"),
    creditCards: getValue("creditCards"),
    otherDebts: getValue("otherDebts")
  };

  // Totals
  const totalAssets = Object.values(assets).reduce((sum, v) => sum + v, 0);
  const totalLiabilities = Object.values(liabilities).reduce((sum, v) => sum + v, 0);
  const netWorth = totalAssets - totalLiabilities;

  // FI Assets
  let fiAssets = 0;
  if (isChecked("cashFI")) fiAssets += assets.cash;
  if (isChecked("savingsFI")) fiAssets += assets.savings;
  if (isChecked("brokerageFI")) fiAssets += assets.brokerage;
  if (isChecked("retirementFI")) fiAssets += assets.retirement;
  if (isChecked("hsaFI")) fiAssets += assets.hsa;
  if (isChecked("homeFI")) fiAssets += assets.home;
  if (isChecked("otherAssetsFI")) fiAssets += assets.otherAssets;
  const fiNetWorth = fiAssets - totalLiabilities;

  // Display results
  document.getElementById("netWorthResult").textContent = netWorth.toLocaleString();
  document.getElementById("fiNetWorthResult").textContent = fiNetWorth.toLocaleString();

  // Render Pie Chart
  const ctx = document.getElementById("netWorthChart").getContext("2d");
  if (window.netWorthChart) window.netWorthChart.destroy();

  window.netWorthChart = new Chart(ctx, {
    type: "pie",
    data: {
      labels: ["Total Net Worth", "FI Net Worth"],
      datasets: [{
        data: [netWorth, fiNetWorth],
        backgroundColor: ["#FF6F61", "#FFD166"]  // Ember Orange & Sunrise Yellow
      }]
    },
    options: {
      responsive: true,
      plugins: {
        legend: { position: "bottom" },
        tooltip: {
          callbacks: {
            label: context => `$${context.parsed.toLocaleString()}`
          }
        }
      }
    }
  });
});
