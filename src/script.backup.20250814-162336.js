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

  const results = `
    <strong>Taxable Income:</strong> $${taxableIncome.toFixed(2)}<br/>
    <strong>Federal Tax (Estimate):</strong> $${federalTax.toFixed(2)}<br/>
    <strong>Total Contributions:</strong> $${totalContributions.toFixed(2)}<br/>
    <strong>Health Insurance Premiums:</strong> $${health.toFixed(2)}<br/>
    <strong>Estimated Take-Home Pay:</strong> $${takeHomePay.toFixed(2)}<br/>
  `;

  document.getElementById('results').innerHTML = results;
}