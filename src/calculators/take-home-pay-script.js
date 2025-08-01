console.log("🚀 Take-Home Pay Calculator Script Loaded");

let chart;

document.getElementById("calculator-form").addEventListener("submit", function (e) {
  e.preventDefault();

  const income = parseFloat(document.getElementById("income").value || 0);
  const k401 = parseFloat(document.getElementById("k401").value || 0);
  const ira = parseFloat(document.getElementById("ira").value || 0);
  const hsa = parseFloat(document.getElementById("hsa").value || 0);
  const health = parseFloat(document.getElementById("health").value || 0);

  const totalContributions = k401 + ira + hsa;
  const taxableIncome = income - totalContributions;

  // Federal tax brackets (simplified 2024 single filer)
  let federalTax = 0;
  if (taxableIncome <= 11600) {
    federalTax = 0;
  } else if (taxableIncome <= 47150) {
    federalTax = (taxableIncome - 11600) * 0.1;
  } else if (taxableIncome <= 100525) {
    federalTax = (47150 - 11600) * 0.1 + (taxableIncome - 47150) * 0.12;
  } else {
    federalTax = (47150 - 11600) * 0.1 + (100525 - 47150) * 0.12 + (taxableIncome - 100525) * 0.22;
  }

  const takeHomePay = income - federalTax - health - totalContributions;

  // Update results
  document.getElementById("taxableIncome").textContent = taxableIncome.toLocaleString();
  document.getElementById("federalTax").textContent = federalTax.toLocaleString();
  document.getElementById("totalContributions").textContent = totalContributions.toLocaleString();
  document.getElementById("takeHomePay").textContent = takeHomePay.toLocaleString();

  // Render Chart
  const ctx = document.getElementById("resultsChart").getContext("2d");
  if (chart) chart.destroy();

  chart = new Chart(ctx, {
    type: "pie",
    data: {
      labels: ["Federal Tax", "Contributions", "Health Premiums", "Take-Home Pay"],
      datasets: [{
        data: [federalTax, totalContributions, health, takeHomePay],
        backgroundColor: ["#FF6F61", "#FFD166", "#90E0EF", "#4CAF50"]
      }]
    },
    options: {
      responsive: true,
      plugins: {
        legend: { position: "bottom" },
        tooltip: {
          callbacks: {
            label: (context) => `$${context.raw.toLocaleString()}`
          }
        }
      }
    }
  });
});
