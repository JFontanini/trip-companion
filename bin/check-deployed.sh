#!/usr/bin/env bash
# Compare the live site with the local production build (dist/). Exit 1 on any difference.
# Checks index.html and sw.js, which together name every hashed asset, so a match means the
# live site is this build. Retries briefly because the CDN can take a minute to turn over.
set -euo pipefail
LIVE="${1:-https://guam.techsavvy.dad}"
[ -f dist/index.html ] || { echo "No dist/ build. Run npm run build first."; exit 2; }
for attempt in 1 2 3 4 5 6; do
  ok=1
  # cleanUrls is on, so /index.html redirects to /; fetch the page at / and compare it to index.html.
  for pair in "/:index.html" "/sw.js:sw.js"; do
    path="${pair%%:*}"; f="${pair#*:}"
    if ! curl -fsSL -H 'Cache-Control: no-cache' "$LIVE$path?cb=$(date +%s)" | diff -q - "dist/$f" >/dev/null; then ok=0; echo "  $path differs from dist/$f"; fi
  done
  if [ "$ok" = 1 ]; then echo "Live site at $LIVE matches this build."; exit 0; fi
  echo "Attempt $attempt: live differs from this build, waiting 20s"; sleep 20
done
echo "Live site at $LIVE does not match this build."; exit 1
