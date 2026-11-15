# VitalOrbit: Astronaut Health Monitor (NASA Space Apps 2026)

Self-assessment, trend tracking, rule-based early warning and education for long-duration spaceflight.
Vanilla JS + Tailwind (CDN) + Chart.js (CDN). No build step. Data stays in the browser (localStorage).

## Run
1. Open `index.html` directly, or serve the folder: `python3 -m http.server 8000` then visit http://localhost:8000
2. Click "Load 14-day demo" on the Log tab to see charts, alerts and badges.

## Modules
- Body status: clickable Brain / Heart / Metabolic / Legs map, green-yellow-red.
- Log and trends: daily form, selectable metric chart with normal band, sleep/mood/fatigue chart, CSV export.
- Early warning: threshold rules (RULES) and 3-5 day pattern detection (trends) with countermeasures.
- Learn and rewards: spaceflight risk guides, streaks, XP, badges.

Thresholds are illustrative and not clinical. Edit RULES in app.js to tune them.

## Added in v2
- Radiation exposure: daily dosimeter input, a "Rad" zone on the body map, an alert rule, and cumulative dose.
- Ground station tab: simulated downlink packet, signal delay for ISS, Moon and Mars, a 7-day range table, and a simulated flight-surgeon reply.
