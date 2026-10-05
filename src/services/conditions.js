// Live conditions from Open-Meteo (free, no key, CORS-enabled).
// Forecast: rain probability, wind, sunset. Marine: wave height at the trip's coastal points.
// Returns a plain object the UI renders, including how fresh it is, and never throws for "no data":
// callers get {status:"unavailable", reason} so the page can say so and link to official sources.

const FORECAST_URL = "https://api.open-meteo.com/v1/forecast";
const MARINE_URL = "https://marine-api.open-meteo.com/v1/marine";
const CACHE_KEY = "tc-conditions-v1";
const STALE_AFTER_MIN = 60;
const FORECAST_DAYS_AHEAD = 15;

function daysBetween(a, b) {
  return Math.round((Date.parse(b + "T00:00:00Z") - Date.parse(a + "T00:00:00Z")) / 864e5);
}

function readCache(key) {
  try { const all = JSON.parse(localStorage.getItem(CACHE_KEY) || "{}"); return all[key] || null; } catch { return null; }
}
function writeCache(key, value) {
  try {
    const all = JSON.parse(localStorage.getItem(CACHE_KEY) || "{}");
    all[key] = value;
    for (const k of Object.keys(all)) if (Date.now() - (all[k].fetchedAt || 0) > 3 * 864e5) delete all[k];
    localStorage.setItem(CACHE_KEY, JSON.stringify(all));
  } catch { /* storage is a convenience only */ }
}

// hours: Open-Meteo hourly block; pick values for local hours [from, to)
function windowMax(hourly, field, date, from, to) {
  let max = null;
  hourly.time.forEach((t, i) => {
    if (!t.startsWith(date)) return;
    const h = Number(t.slice(11, 13));
    const v = hourly[field]?.[i];
    if (h >= from && h < to && v != null) max = max == null ? v : Math.max(max, v);
  });
  return max;
}

async function getJson(url, signal) {
  const res = await fetch(url, { signal });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

export async function fetchConditions(trip, date, today, { signal, force = false } = {}) {
  const ahead = daysBetween(today, date);
  if (ahead < 0) return { status: "unavailable", reason: "past-date" };
  if (ahead > FORECAST_DAYS_AHEAD) return { status: "unavailable", reason: "too-far-ahead", daysAhead: ahead };

  const key = `${trip.slug}:${date}`;
  const cached = readCache(key);
  if (cached && !force && (Date.now() - cached.fetchedAt) / 6e4 < STALE_AFTER_MIN) return { ...cached, status: "fresh" };

  const c = trip.conditions, tz = encodeURIComponent(trip.timezone);
  const fUrl = `${FORECAST_URL}?latitude=${c.forecastPoint.lat}&longitude=${c.forecastPoint.lon}` +
    `&hourly=precipitation_probability,wind_speed_10m,wind_gusts_10m&daily=sunrise,sunset` +
    `&wind_speed_unit=mph&timezone=${tz}&start_date=${date}&end_date=${date}`;
  const mUrls = c.marinePoints.map(p => ({ p, url:
    `${MARINE_URL}?latitude=${p.lat}&longitude=${p.lon}&hourly=wave_height&timezone=${tz}&start_date=${date}&end_date=${date}` }));

  try {
    const [f, ...ms] = await Promise.all([getJson(fUrl, signal), ...mUrls.map(m => getJson(m.url, signal).catch(() => null))]);
    const rainAfternoon = windowMax(f.hourly, "precipitation_probability", date, 12, 18);
    const rainDay = windowMax(f.hourly, "precipitation_probability", date, 7, 19);
    const wind = windowMax(f.hourly, "wind_speed_10m", date, 7, 19);
    const gust = windowMax(f.hourly, "wind_gusts_10m", date, 7, 19);
    const waves = mUrls.map((m, i) => ({
      id: m.p.id, label: m.p.label,
      maxM: ms[i] ? windowMax(ms[i].hourly, "wave_height", date, 7, 17) : null
    }));
    const maxWave = Math.max(...waves.map(w => w.maxM ?? 0));
    const result = {
      date, fetchedAt: Date.now(),
      rain: { afternoonMaxPct: rainAfternoon, dayMaxPct: rainDay, likely: rainAfternoon != null ? rainAfternoon >= c.thresholds.rainProbabilityPct : null },
      wind: { maxMph: wind, gustMph: gust },
      sunset: f.daily?.sunset?.[0] ?? null,
      waves, rough: waves.some(w => w.maxM != null) ? maxWave >= c.thresholds.waveHeightM : null,
      sources: [{ name: "Open-Meteo forecast", url: "https://open-meteo.com/" }, { name: "Open-Meteo marine", url: "https://open-meteo.com/en/docs/marine-weather-api" }]
    };
    writeCache(key, result);
    return { ...result, status: "fresh" };
  } catch (err) {
    if (cached) return { ...cached, status: "stale", error: String(err) };
    return { status: "unavailable", reason: "fetch-failed", error: String(err) };
  }
}

export function minutesAgo(ts) { return Math.max(0, Math.round((Date.now() - ts) / 6e4)); }
export const metersToFeet = m => (m == null ? null : m * 3.28084);
