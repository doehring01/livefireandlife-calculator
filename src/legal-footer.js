// src/legal-footer.js
document.addEventListener("DOMContentLoaded", () => {
  const footer = document.querySelector("footer");
  if (!footer) return;

  // Avoid duplicates if a page already includes the links
  if (footer.querySelector(".legal-links")) return;

  const p = document.createElement("p");
  p.className = "legal-links";
  p.innerHTML = `<a href="/terms/">Terms</a> · <a href="/privacy/">Privacy</a>`;
  footer.appendChild(p);
});