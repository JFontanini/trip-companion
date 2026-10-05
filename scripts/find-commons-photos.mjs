// Find openly licensed photo candidates on Wikimedia Commons for each stop in a trip pack.
// Usage: node scripts/find-commons-photos.mjs guam
// Writes trips/<trip>/photo-candidates.json for a person to review. Nothing here publishes a photo:
// a human picks heroes and details into trips/<trip>/photos.json, with the attribution carried over.
import fs from "node:fs";

const trip = process.argv[2] || "guam";
const dir = new URL(`../trips/${trip}/`, import.meta.url);
const stops = JSON.parse(fs.readFileSync(new URL("stops.json", dir)));
const ALLOWED = /^(CC0|CC BY(-SA)? \d|CC BY(-SA)?$|Public domain|PD)/i;
const API = "https://commons.wikimedia.org/w/api.php";
const strip = html => String(html || "").replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim();

async function search(q) {
  const params = new URLSearchParams({
    action: "query", format: "json", origin: "*", generator: "search", gsrsearch: `${q} filetype:bitmap`,
    gsrnamespace: "6", gsrlimit: "20", prop: "imageinfo", iiprop: "url|size|extmetadata", iiurlwidth: "1600"
  });
  const res = await fetch(`${API}?${params}`, { headers: { "user-agent": "trip-companion photo finder (techsavvy.dad)" } });
  if (!res.ok) throw new Error(`Commons ${res.status}`);
  const pages = Object.values((await res.json()).query?.pages || {});
  return pages.map(p => {
    const ii = p.imageinfo?.[0] || {}, m = ii.extmetadata || {};
    return {
      file: p.title, pageUrl: ii.descriptionurl, imageUrl: ii.thumburl || ii.url, width: ii.thumbwidth || ii.width, height: ii.thumbheight || ii.height,
      license: m.LicenseShortName?.value || "", licenseUrl: m.LicenseUrl?.value || "",
      artist: strip(m.Artist?.value), credit: strip(m.Credit?.value), description: strip(m.ImageDescription?.value).slice(0, 240)
    };
  }).filter(c => ALLOWED.test(c.license) && c.width >= 1200 && c.width > c.height);
}

const out = { generatedAt: new Date().toISOString(), note: "Candidates only. Review each file page before use; copy license and artist into photos.json.", stops: {} };
for (const s of stops) {
  if (s.kind === "meal") continue;
  const queries = [s.name + " Guam", ...(s.alt || []).slice(0, 1).map(a => a + " Guam")];
  const seen = new Set(), found = [];
  for (const q of queries) {
    try { for (const c of await search(q)) if (!seen.has(c.file)) { seen.add(c.file); found.push(c); } }
    catch (e) { console.warn(`${s.id}: ${e.message}`); }
  }
  out.stops[s.id] = found.slice(0, 8);
  console.log(`${s.id}: ${found.length} candidate(s)`);
}
fs.writeFileSync(new URL("photo-candidates.json", dir), JSON.stringify(out, null, 2) + "\n");
