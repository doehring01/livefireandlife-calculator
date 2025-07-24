console.log("🚀 Script loaded!");

let chart; // Store the chart instance globally

function calculate() {
  const income = parseFloat(document.getElementById('income').value || 0);
  const k401 = parseFloat(document.getElementById('k401').value || 0);
  const ira = parseFloat(document.getElementById('ira').value || 0);
  const hsa = parseFloat(document.getElementById('hsa').value || 0);
  const health = parseFloat(document.getElementById('health').value || 0);

  const totalContributions = k401 + ira + hsa;
  const taxableIncome = income - totalContributions;

  // Simple federal tax estimation using 2024 single filer brackets
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

  // Display results
  const results = `
    <strong>Taxable Income:</strong> $${taxableIncome.toFixed(2)}<br/>
    <strong>Federal Tax (Estimate):</strong> $${federalTax.toFixed(2)}<br/>
    <strong>Total Contributions:</strong> $${totalContributions.toFixed(2)}<br/>
    <strong>Health Insurance Premiums:</strong> $${health.toFixed(2)}<br/>
    <strong>Estimated Take-Home Pay:</strong> $${takeHomePay.toFixed(2)}<br/>
  `;
  document.getElementById('results').innerHTML = results;

  // Build chart
  const ctx = document.getElementById('resultsChart').getContext('2d');

  const data = {
    labels: ['Gross Income', 'Federal Tax', 'Contributions', 'Health Premiums', 'Take-Home Pay'],
    datasets: [{
      label: 'Income Breakdown',
      data: [
        income,
        federalTax,
        totalContributions,
        health,
        takeHomePay
      ],
      backgroundColor: [
        '#4CAF50',
        '#F44336',
        '#FFC107',
        '#03A9F4',
        '#9C27B0'
      ]
    }]
  };

  const config = {
    type: 'bar',
    data: data,
    options: {
      responsive: true,
      plugins: {
        legend: { display: false },
        tooltip: { callbacks: { label: ctx => `$${ctx.raw.toFixed(2)}` } }
      },
      scales: {
        y: {
          beginAtZero: true,
          ticks: {
            callback: (value) => '$' + value
          }
        }
      }
    }
  };

  // Destroy previous chart instance if it exists
  if (chart) {
    chart.destroy();
  }

  chart = new Chart(ctx, config);
}

document.getElementById("calculator-form").addEventListener("submit", function (e) {
  e.preventDefault();
  calculate();
});

