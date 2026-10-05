# CLAUDE.md: trip-companion

Interactive trip apps on Firebase. Read `README.md` for the layers. These rules come from
what already went wrong in the sibling repos; follow them rather than rediscovering why.

## Canon and ownership

- `trips/<slug>/*.json` is the canonical content. Every factual claim carries a source in
  `sources.json` with an access date. Hours, fees and status are time-sensitive: never present
  them as current without a "last checked" date.
- `index.html` is the v0 planner, frozen. Fix bugs in it; do not grow it. New views are built in
  `src/` from Claude Design's tokens and component specs, then replace v0 screen by screen.
- Brand styling comes from `brands/<brand>/tokens.css`. No colors outside the tokens.
- Photos come only from `trips/<slug>/photos.json`, which holds human-approved, licensed images
  with their attribution. `photo-candidates.json` is a review queue, never a source.

## Writing rules

The canonical source is `knowledge/working-method/writing-conventions.md` in fontanini-advisor-os.

- No em dashes and no en dashes, in copy, data or comments. Use "to" for ranges.
- Straight quotes and apostrophes only.
- No exclamation points in body copy. No emojis.
- CHamoru place names first, with English names as alternates (Inalåhan, Humåtak, Malesso', Hågat, Hagåtña).
- Villages are communities, not exhibits. Memorial and WWII content stays factual and includes
  the civilian and CHamoru experience.

## Checks

Run before every commit; CI runs them on every push:

    npm run check && npm test && npm run build

## Deploys

- A push to `main` deploys hosting and both rules files, then verifies the live site matches
  the build (`bin/check-deployed.sh`). A scheduled job repeats that check every six hours.
- Before branching or pushing, `git fetch` and confirm you are level with `origin/main`.
- Cloud Functions deploy by hand (`firebase deploy --only functions`), from The Beast, and the
  deploy is recorded in the commit message or a journal.
- Never hand-edit the live Firestore `status/*` docs; the scheduled functions own them.

## Live data

- Live conditions only set the rain and surf toggles the person has not set by hand, and the
  UI labels them as forecast-derived. A forecast never asserts an official advisory.
- Any feed that fails shows as unavailable, with links to NWS Guam and Guam EPA. Never fall back
  to a silent default.
