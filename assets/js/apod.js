export async function initApod() {
  const link = document.getElementById("apod-link");
  const img = document.getElementById("apod-img");
  const placeholder = document.getElementById("apod-placeholder");
  const title = document.getElementById("apod-title");
  const date = document.getElementById("apod-date");
  const desc = document.getElementById("apod-desc");
  if (!link || !title) return;

  const apiKey = "63XVlWsjpTsBQWnbpwpmWzNP64UVxc7t2IMv0zVw";

  try {
    const response = await fetch(`https://api.nasa.gov/planetary/apod?api_key=${apiKey}&thumbs=true`);
    if (!response.ok) {
      if (response.status === 429) {
        title.textContent = "Rate limited";
        if (desc) desc.textContent = "NASA APOD API rate limit reached. Try again shortly.";
        return;
      }
      throw new Error(`HTTP ${response.status}`);
    }

    const data = await response.json();

    if (data && (data.url || data.thumbnail_url)) {
      const displayUrl = data.thumbnail_url || data.url;
      if (img && displayUrl) {
        img.src = displayUrl;
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
      link.href = data.hdurl || data.url || "#";
    } else {
      title.textContent = "Unavailable";
      if (desc) desc.textContent = data.error?.message || "APOD data temporarily unavailable.";
    }
  } catch (err) {
    title.textContent = "Offline";
    if (desc) desc.textContent = "Could not reach the NASA APOD API.";
  }
}
