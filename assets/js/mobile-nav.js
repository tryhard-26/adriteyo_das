export function initMobileNav() {
  const toggle = document.getElementById("mobile-nav-toggle");
  const sidebar = document.getElementById("sidebar");
  const backdrop = document.getElementById("sidebar-backdrop");
  if (!toggle || !sidebar || !backdrop) return;

  function close() {
    sidebar.classList.remove("is-open");
    backdrop.classList.remove("is-visible");
    toggle.setAttribute("aria-expanded", "false");
  }

  function open() {
    sidebar.classList.add("is-open");
    backdrop.classList.add("is-visible");
    toggle.setAttribute("aria-expanded", "true");
  }

  toggle.addEventListener("click", () => {
    const isOpen = sidebar.classList.contains("is-open");
    isOpen ? close() : open();
  });

  backdrop.addEventListener("click", close);

  sidebar.querySelectorAll("a").forEach((link) => {
    link.addEventListener("click", close);
  });

  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") close();
  });
}
