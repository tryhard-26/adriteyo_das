import { initTheme } from "./theme.js";
import { initMobileNav } from "./mobile-nav.js";
import { initScrollspy } from "./scrollspy.js";
import { initReveal } from "./reveal.js";
import { initFactOfTheDay } from "./fact-of-the-day.js";
import { initApod } from "./apod.js";
import { initCopyButtons } from "./copy-connect.js";
import { initGithubGraph } from "./github-graph.js";

document.addEventListener("DOMContentLoaded", () => {
  initTheme();
  initMobileNav();
  initScrollspy();
  initReveal();
  initFactOfTheDay();
  initApod();
  initCopyButtons();
  initGithubGraph();
});
