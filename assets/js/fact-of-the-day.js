export function initFactOfTheDay() {
  const factText = document.getElementById("fact-text");
  const refreshBtn = document.getElementById("refresh-fact");
  if (!factText || !refreshBtn) return;

  async function fetchFact() {
    factText.textContent = "Fetching a new fact…";
    try {
      const response = await fetch("https://uselessfacts.jsph.pl/api/v2/facts/random?language=en");
      const data = await response.json();
      factText.textContent = data.text;
    } catch (err) {
      factText.textContent = "The only capital letter in the Roman alphabet with exactly one end point is P.";
    }
  }

  refreshBtn.addEventListener("click", fetchFact);
}
