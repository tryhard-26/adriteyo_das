import urllib.request
import json
import datetime
import os
import sys

DATA_FILE = "data/github_contributions.json"
PARTIAL_FILE = "layouts/partials/widgets/github-graph.html"
USERNAME = "tryhard-26"

def fetch_data():
    url = f"https://github-contributions-api.jogruber.de/v4/{USERNAME}?y=last"
    try:
        req = urllib.request.Request(url, headers={"User-Agent": "Portfolio-Build-Script"})
        with urllib.request.urlopen(req, timeout=6) as response:
            if response.status == 200:
                data = json.loads(response.read().decode('utf-8'))
                with open(DATA_FILE, "w", encoding="utf-8") as f:
                    json.dump(data, f, indent=2)
                print(f"Successfully fetched fresh GitHub contributions for {USERNAME}")
                return data
    except Exception as e:
        print(f"Notice: Could not fetch fresh contributions ({e}). Using cached data.", file=sys.stderr)
    
    if os.path.exists(DATA_FILE):
        with open(DATA_FILE, "r", encoding="utf-8") as f:
            return json.load(f)
    else:
        raise RuntimeError("No cached contribution data found.")

def get_gh_day(dt):
    # Sunday = 0, Monday = 1, ..., Saturday = 6
    return (dt.weekday() + 1) % 7

def generate_svg(data):
    contribs = data.get("contributions", [])
    total = data.get("total", {}).get("lastYear", 0)
    
    weeks = []
    current_week = []
    months = []
    last_month = None

    for day in contribs:
        dt = datetime.date.fromisoformat(day["date"])
        gh_day = get_gh_day(dt)
        
        if gh_day == 0 and current_week:
            weeks.append(current_week)
            current_week = []
            
        week_idx = len(weeks)
        x = 32 + week_idx * 13
        y = 20 + gh_day * 13
        
        month_name = dt.strftime('%b')
        if month_name != last_month and dt.day <= 14:
            months.append({'name': month_name, 'x': x})
            last_month = month_name
            
        current_week.append({
            'date': day['date'],
            'count': day['count'],
            'level': day['level'],
            'x': x,
            'y': y,
            'formatted': dt.strftime('%A, %b %d, %Y')
        })

    if current_week:
        weeks.append(current_week)

    total_width = 32 + len(weeks) * 13 + 5
    total_height = 20 + 7 * 13 + 5

    svg_parts = []
    svg_parts.append(f'<svg class="github-graph__svg" viewBox="0 0 {total_width} {total_height}" width="{total_width}" height="{total_height}" aria-label="GitHub contribution calendar for {USERNAME}">')

    # Month labels
    for m in months:
        svg_parts.append(f'  <text x="{m["x"]}" y="12" class="gh-text gh-text--month">{m["name"]}</text>')

    # Day labels (Mon, Wed, Fri)
    svg_parts.append('  <text x="0" y="40" class="gh-text gh-text--day">Mon</text>')
    svg_parts.append('  <text x="0" y="66" class="gh-text gh-text--day">Wed</text>')
    svg_parts.append('  <text x="0" y="92" class="gh-text gh-text--day">Fri</text>')

    # Rectangles for days
    for w in weeks:
        for d in w:
            count = d['count']
            plural = "s" if count != 1 else ""
            tooltip_text = f"{count} contribution{plural} on {d['formatted']}" if count > 0 else f"No contributions on {d['formatted']}"
            svg_parts.append(
                f'  <rect class="gh-day gh-day--level-{d["level"]}" '
                f'x="{d["x"]}" y="{d["y"]}" width="10" height="10" rx="2" '
                f'data-date="{d["date"]}" data-count="{count}" data-tooltip="{tooltip_text}">'
                f'<title>{tooltip_text}</title></rect>'
            )

    svg_parts.append('</svg>')
    svg_html = "\n".join(svg_parts)

    partial_content = f"""<div class="github-graph-card">
  <div class="github-graph__header">
    <div class="github-graph__title-group">
      <span class="github-graph__icon" aria-hidden="true">
        <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor">
          <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0 0 24 12c0-6.63-5.37-12-12-12z"/>
        </svg>
      </span>
      <div>
        <h3 class="github-graph__title">GitHub Activity</h3>
        <p class="github-graph__subtitle"><span class="gh-total-count">{total}</span> contributions in the last year</p>
      </div>
    </div>
    <a href="https://github.com/{USERNAME}" target="_blank" rel="noopener" class="github-graph__profile-link">
      <span>@{USERNAME} ↗</span>
    </a>
  </div>

  <div class="github-graph__scroll">
{svg_html}
  </div>

  <div class="github-graph__footer">
    <span class="github-graph__note">Live data via GitHub API</span>
    <div class="github-graph__legend" aria-hidden="true">
      <span class="legend-label">Less</span>
      <span class="legend-box gh-day--level-0"></span>
      <span class="legend-box gh-day--level-1"></span>
      <span class="legend-box gh-day--level-2"></span>
      <span class="legend-box gh-day--level-3"></span>
      <span class="legend-box gh-day--level-4"></span>
      <span class="legend-label">More</span>
    </div>
  </div>

  <div id="github-graph-tooltip" class="github-graph__tooltip" role="tooltip" aria-hidden="true"></div>
</div>
"""
    os.makedirs(os.path.dirname(PARTIAL_FILE), exist_ok=True)
    with open(PARTIAL_FILE, "w", encoding="utf-8") as f:
        f.write(partial_content)
    print(f"Generated {PARTIAL_FILE} with {len(contribs)} days and total {total}")

if __name__ == "__main__":
    data = fetch_data()
    generate_svg(data)
