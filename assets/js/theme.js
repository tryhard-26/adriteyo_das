export function initTheme() {
  const btn = document.getElementById("theme-toggle");
  if (!btn) return;

  function apply(theme) {
    if (theme === "light") {
      document.documentElement.setAttribute("data-theme", "light");
      btn.setAttribute("aria-label", "Switch to dark mode");
      btn.setAttribute("title", "Switch to dark mode");
    } else {
      document.documentElement.removeAttribute("data-theme");
      btn.setAttribute("aria-label", "Switch to light mode");
      btn.setAttribute("title", "Switch to light mode");
    }
    try {
      localStorage.setItem("theme_preference", theme);
    } catch (e) {}
  }

  const current = document.documentElement.getAttribute("data-theme") === "light" ? "light" : "dark";
  apply(current);

  btn.addEventListener("click", () => {
    const isLight = document.documentElement.getAttribute("data-theme") === "light";
    apply(isLight ? "dark" : "light");
  });
}
