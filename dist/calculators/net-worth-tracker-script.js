document.getElementById("netWorthForm").addEventListener("submit", function (e) {
  e.preventDefault();

  const getValue = (id) => parseFloat(document.getElementById(id).value) || 0;
  const isChecked = (id) => document.getElementById(id).checked;

  const assets = {
    cash: getValue("cash"),
    savings: getValue("savings"),
    brokerage: getValue("brokerage"),
    retirement: getValue("retirement"),
    hsa: getValue("hsa"),
    home: getValue("home"),
    otherAssets: getValue("otherAssets"),
  };

  const liabilities = {
    mortgage: getValue("mortgage"),
    carLoans: getValue("carLoans"),
    studentLoans: getValue("studentLoans"),
    creditCards: getValue("creditCards"),
    otherLiabilities: getValue("otherLiabilities"),
  };

  const totalAssets = Object.values(assets).reduce((acc, val) => acc + val, 0);
  const totalLiabilities = Object.values(liabilities).reduce((acc, val) => acc + val, 0);
  const netWorth = totalAssets - totalLiabilities;

  let fiAssets = assets.cash + assets.savings + assets.brokerage;
  if (isChecked("includeRetirement")) fiAssets += assets.retirement;
  if (isChecked("includeHSA")) fiAssets += assets.hsa;
  if (isChecked("includeHome")) fiAssets += assets.home;
  if (isChecked("includeOtherAssets")) fiAssets += assets.otherAssets;
  const fiNetWorth = fiAssets - totalLiabilities;

  document.getElementById("netWorthResult").innerText = netWorth.toLocaleString();
  document.getElementById("fiNetWorthResult").innerText = fiNetWorth.toLocaleString();

  // Chart.js Pie Chart
  const ctx = document.getElementById("netWorthChart").getContext("2d");
  if (window.netWorthChart) window.netWorthChart.destroy(); // prevent duplicates
  window.netWorthChart = new Chart(ctx, {
    type: "pie",
    data: {
      labels: ["Net Worth", "FI Net Worth"],
      datasets: [{
        label: "Comparison",
        data: [netWorth, fiNetWorth],
        backgroundColor: ["#0077b6", "#90e0ef"],
        borderColor: "#ffffff",
        borderWidth: 2
      }]
    },
    options: {
      responsive: true,
      plugins: {
        legend: {
          position: 'bottom'
        },
        tooltip: {
          callbacks: {
            label: function (context) {
              return `$${context.parsed.toLocaleString()}`;
            }
          }
        }
      }
    }
  });
});
