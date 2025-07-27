
document.getElementById("fiForm").addEventListener("submit", function (e) {
  e.preventDefault();

  const age = parseInt(document.getElementById("age").value);
  const currentSavings = parseFloat(document.getElementById("currentSavings").value);
  const income = parseFloat(document.getElementById("income").value);
  const expenses = parseFloat(document.getElementById("expenses").value);
  const growthRate = (parseFloat(document.getElementById("growthRate").value) || 7) / 100;
  const fiMultiplier = parseFloat(document.getElementById("fiMultiplier").value) || 25;

  const annualSavings = income - expenses;
  const fiTarget = expenses * fiMultiplier;

  let savings = currentSavings;
  let years = 0;
  const savingsHistory = [];

  while (savings < fiTarget && years < 100) {
    savings += annualSavings;
    savings *= (1 + growthRate);
    savingsHistory.push(savings);
    years++;
  }

  const ageAtFI = age + years;

  document.getElementById("fiTarget").textContent = fiTarget.toLocaleString();
  document.getElementById("yearsFI").textContent = years;
  document.getElementById("ageFI").textContent = ageAtFI;

  const ctx = document.getElementById("fiChart").getContext("2d");
  if (window.fiChart) window.fiChart.destroy();

  window.fiChart = new Chart(ctx, {
    type: "line",
    data: {
      labels: Array.from({ length: years }, (_, i) => `Year ${i + 1}`),
      datasets: [{
        label: "Projected Savings",
        data: savingsHistory,
        borderColor: "#0077b6",
        fill: false,
        tension: 0.1
      }]
    },
    options: {
      responsive: true,
      plugins: {
        tooltip: {
          callbacks: {
            label: function (context) {
              return `$${context.parsed.y.toLocaleString()}`;
            }
          }
        }
      },
      scales: {
        y: {
          beginAtZero: true,
          ticks: {
            callback: function (value) {
              return `$${value.toLocaleString()}`;
            }
          }
        }
      }
    }
  });
});
