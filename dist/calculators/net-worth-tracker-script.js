document.getElementById('net-worth-form').addEventListener('submit', function (e) {
  e.preventDefault();

  const assets = {
    checking: parseFloat(document.getElementById('checking').value) || 0,
    savings: parseFloat(document.getElementById('savings').value) || 0,
    brokerage: parseFloat(document.getElementById('brokerage').value) || 0,
    retirement: parseFloat(document.getElementById('retirement').value) || 0,
    realEstate: parseFloat(document.getElementById('realEstate').value) || 0,
    otherAssets: parseFloat(document.getElementById('otherAssets').value) || 0,
  };

  const liabilities = {
    mortgage: parseFloat(document.getElementById('mortgage').value) || 0,
    studentLoans: parseFloat(document.getElementById('studentLoans').value) || 0,
    carLoans: parseFloat(document.getElementById('carLoans').value) || 0,
    creditCards: parseFloat(document.getElementById('creditCards').value) || 0,
    otherDebts: parseFloat(document.getElementById('otherDebts').value) || 0,
  };

  const includeRealEstate = document.getElementById('realEstateFI').checked;
  const includeOtherAssets = document.getElementById('otherAssetsFI').checked;

  const totalAssets = Object.values(assets).reduce((a, b) => a + b, 0);
  const totalLiabilities = Object.values(liabilities).reduce((a, b) => a + b, 0);
  const netWorth = totalAssets - totalLiabilities;

  const fiAssets = 
    assets.checking +
    assets.savings +
    assets.brokerage +
    assets.retirement +
    (includeRealEstate ? assets.realEstate : 0) +
    (includeOtherAssets ? assets.otherAssets : 0);

  const fiNetWorth = fiAssets - totalLiabilities;

  // Update results
  document.getElementById('results').innerHTML = `
    <h2>Results</h2>
    <p><strong>Total Net Worth:</strong> $${netWorth.toLocaleString()}</p>
    <p><strong>FI Net Worth:</strong> $${fiNetWorth.toLocaleString()}</p>
  `;

  // Chart
  const ctx = document.getElementById('netWorthChart').getContext('2d');
  if (window.netWorthChart) {
    window.netWorthChart.destroy();
  }

  window.netWorthChart = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: ['Total Net Worth', 'FI Net Worth'],
      datasets: [{
        label: 'Value in USD',
        data: [netWorth, fiNetWorth],
        backgroundColor: ['#6ac259', '#3478f6']
      }]
    },
    options: {
      responsive: true,
      plugins: {
        legend: { display: false }
      },
      scales: {
        y: {
          beginAtZero: true,
          ticks: {
            callback: function(value) {
              return '$' + value.toLocaleString();
            }
          }
        }
      }
    }
  });
});
