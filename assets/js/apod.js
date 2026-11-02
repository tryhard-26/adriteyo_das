export async function initApod() {
  const link = document.getElementById("apod-link");
  const img = document.getElementById("apod-img");
  const placeholder = document.getElementById("apod-placeholder");
  const title = document.getElementById("apod-title");
  const date = document.getElementById("apod-date");
  const desc = document.getElementById("apod-desc");
  if (!link || !title) return;

  try {
    const response = await fetch("https://science.nasa.gov/wp-json/wp/v2/apod-basic?per_page=1");
    if (!response.ok) throw new Error(`HTTP ${response.status}`);

    const [data] = await response.json();
    const isImage = data?.media_type === "image" && data.hdurl;

    if (data) {
      if (img && isImage) {
        img.src = data.hdurl;
        img.alt = data.alt || data.title || "NASA Astronomy Picture of the Day";
        img.hidden = false;
        if (placeholder) placeholder.hidden = true;
      }
      title.textContent = data.title || "Untitled";
      if (date) date.textContent = data.date || "";
      if (desc) {
        const explanation = (data.explanation || "")
          .replace(/<[^>]*>/g, "")
          .replace(/^Explanation:\s*/, "")
          .trim();
        desc.textContent = explanation.length > 110 ? explanation.slice(0, 110) + "…" : explanation;
      }
      link.href = (isImage ? data.hdurl : data.url || data.permalink) || "#";
    } else {
      title.textContent = "Unavailable";
      if (desc) desc.textContent = "APOD data temporarily unavailable.";
    }
  } catch (err) {
    title.textContent = "Offline";
    if (desc) desc.textContent = "Could not reach the NASA APOD API.";
  }
}
