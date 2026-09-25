export function initGithubGraph() {
  const card = document.querySelector(".github-graph-card");
  if (!card) return;

  const scrollContainer = card.querySelector(".github-graph__scroll");
  if (scrollContainer) {
    // Scroll to the latest contributions on mobile/narrow screens
    scrollContainer.scrollLeft = scrollContainer.scrollWidth;
  }

  const tooltip = card.querySelector(".github-graph__tooltip");
  const days = card.querySelectorAll(".gh-day");
  if (!tooltip || !days.length) return;

  days.forEach((day) => {
    day.addEventListener("mouseenter", () => {
      const text = day.getAttribute("data-tooltip");
      if (!text) return;

      tooltip.textContent = text;
      tooltip.classList.add("is-visible");

      const cardRect = card.getBoundingClientRect();
      const dayRect = day.getBoundingClientRect();

      const left = dayRect.left - cardRect.left + dayRect.width / 2;
      const top = dayRect.top - cardRect.top;

      tooltip.style.left = `${left}px`;
      tooltip.style.top = `${top}px`;
    });

    day.addEventListener("mouseleave", () => {
      tooltip.classList.remove("is-visible");
    });
  });
}
