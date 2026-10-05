# trip-companion

Interactive trip apps on one codebase. The first trip is the Guam Coastal Circuit at
guam.techsavvy.dad. The structure is built for more trips and more brands, including
Distinguished Travelers group trips, without forking the code.

## How it fits together

| Layer | Where | What it holds |
|---|---|---|
| Trip content pack | `trips/<slug>/` | Stops, restaurants, sources with access dates, road model, calendar, approved photos. Canonical content. |
| Brand | `brands/<brand>/tokens.css` | Colors and type for a brand. `techsavvy` is live; `distinguished-travelers` is staged from the DT site's Tailwind config. |
| App shell | `index.html`, `src/` | `index.html` is the v0 planner, frozen as the reference build. `src/` adds live services on top and is where the redesigned views land after Claude Design's handoff. |
| Services | `src/services/` | Live conditions (Open-Meteo forecast and marine), Ritidian status (Firestore), trip journal (Firestore and Cloud Storage). |
| Backend | `functions/`, `*.rules` | Scheduled status scrapers, and default-deny rules for the journal. |

Everything runs on Firebase, the platform every other site in the portfolio uses
(chief-os.app, catalyst-academy.ai, proven.work, jayfontanini.com). New consumer-facing
pieces are deliberate and few: Open-Meteo for live conditions (free, no key), Cloud Storage
for journal photos, a service worker for offline use and install-to-home-screen, and
Wikimedia Commons as the licensed photo source. MapLibre with OpenFreeMap tiles is planned
for the map redesign; the CSP already allows it.

## One project per business

`techsavvy-dad` is the Firebase project for Jay's consumer trip apps. Distinguished Travelers
trips get their own project when the first one is built, so a client's journal photos and
traveler emails never share rules, data or credentials with anything else. Same isolation
as `chief-os-3a357` and `catalyst-academy-68557`.

## Working on it

    npm install
    npm run dev          # local, http://localhost:5173
    npm run check        # writing rules: no em or en dashes, straight quotes
    npm test             # unit tests
    npm run build        # production build to dist/

The journal and Ritidian status stay dormant until `.env.local` has the Firebase web
config (see `.env.example`). The planner and live weather work without it.

Deploying is described in `DEPLOY.md`. Session rules are in `CLAUDE.md`.
