export async function initApod() {
  const link = document.getElementById("apod-link");
  const img = document.getElementById("apod-img");
  const placeholder = document.getElementById("apod-placeholder");
  const title = document.getElementById("apod-title");
  const date = document.getElementById("apod-date");
  const desc = document.getElementById("apod-desc");
  if (!link || !title) return;

  try {
    const response = await fetch("https://api.nasa.gov/planetary/apod?api_key=DEMO_KEY");
    const data = await response.json();

    if (data && data.url) {
      if (img) {
        img.src = data.url;
        img.alt = data.title || "NASA Astronomy Picture of the Day";
        img.hidden = false;
        if (placeholder) placeholder.hidden = true;
      }
      title.textContent = data.title || "Untitled";
      if (date) date.textContent = data.date || "";
      if (desc) {
        const explanation = data.explanation || "";
        desc.textContent = explanation.length > 110 ? explanation.slice(0, 110) + "…" : explanation;
      }
      link.href = data.hdurl || data.url;
    } else {
      title.textContent = "Rate limited";
      if (desc) desc.textContent = "NASA's public demo key is temporarily rate-limited. Try again shortly.";
    }
  } catch (err) {
    title.textContent = "Offline";
    if (desc) desc.textContent = "Could not reach the NASA APOD API.";
  }
}
