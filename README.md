# trip-companion

Interactive trip apps on one codebase. The first trip is the Guam Coastal Circuit at
guam.techsavvy.dad. The structure is built for more trips and more brands, including
Distinguished Travelers group trips, without forking the code.

## How it fits together

| Layer | Where | What it holds |
|---|---|---|
| Trip content pack | `trips/<slug>/` | Stops, restaurants, sources with access dates, road model, calendar, approved photos. Canonical content. |
| Brand | `brands/<brand>/tokens.css` | Colors, type, spacing and radii for a brand. `techsavvy` carries Claude Design's Reef Atlas tokens (light, dark and day-of); `distinguished-travelers` is staged from the DT site's Tailwind config. |
| Engine | `src/engine/` | The loop-drive timing engine, moved out of v0 unchanged and fed by the content pack. A parity test runs it against v0 on every push. |
| App | `index.html`, `src/app/`, `src/styles/` | The Reef Atlas build: Today, Map, Stops, Eat, Journal and Safety, plus day-of mode. `v0.html` is the frozen first planner, kept for reference and the parity test. |
| Services | `src/services/` | Live conditions (Open-Meteo forecast and marine), Ritidian status (Firestore), trip journal (Firestore and Cloud Storage). |
| Backend | `functions/`, `*.rules` | Scheduled status scrapers, and default-deny rules for the journal. |

Everything runs on Firebase, the platform every other site in the portfolio uses
(chief-os.app, catalyst-academy.ai, proven.work, jayfontanini.com). New consumer-facing
pieces are deliberate and few: Open-Meteo for live conditions (free, no key), Cloud Storage
for journal photos, a service worker for offline use and install-to-home-screen, and
Wikimedia Commons as the licensed photo source. The Reef Atlas design kept the drawn SVG map, so
MapLibre is not in use; the CSP still allows OpenFreeMap if a tile map is added later.

## One project per business

`techsavvy-dad` is the Firebase project for Jay's consumer trip apps. Distinguished Travelers
trips get their own project when the first one is built, so a client's journal photos and
traveler emails never share rules, data or credentials with anything else. Same isolation
as `chief-os-3a357` and `catalyst-academy-68557`.

## Working on it

    npm install
    npm run dev          # local, http://localhost:5173
    npm run check        # writing rules (no em or en dashes, straight quotes) and no colors outside tokens
    npm test             # engine parity with v0, WCAG contrast for all three themes, parsers
    npm run build        # production build to dist/

The journal works on its own, stored in the browser's IndexedDB. With the Firebase web config
(committed in `.env.production` and `.env.development`; it is a public identifier), signing in
adds photo backup and a shared trip journal, and the Litekyan status feed comes alive.

Deploying is described in `DEPLOY.md`. Session rules are in `CLAUDE.md`.
