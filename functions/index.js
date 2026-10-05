// Scheduled status scrapers. Each writes one public, read-only doc under status/ that the
// app watches. A parse failure is written as parseOk:false, never silently skipped, so the
// app shows "unavailable, check the source" instead of a stale "open".
import { onSchedule } from "firebase-functions/v2/scheduler";
import { logger } from "firebase-functions";
import { initializeApp } from "firebase-admin/app";
import { getFirestore, FieldValue } from "firebase-admin/firestore";
import { parseRitidianText, excerpt } from "./parse.js";

initializeApp();
const FWS_URL = "https://www.fws.gov/refuge/guam";

export const ritidianStatus = onSchedule(
  { schedule: "every 2 hours", timeZone: "Pacific/Guam", region: "us-east1", retryCount: 1 },
  async () => {
    let result;
    try {
      const res = await fetch(FWS_URL, { headers: { "user-agent": "trip-companion status check (techsavvy.dad)" } });
      const html = res.ok ? await res.text() : "";
      result = res.ok ? parseRitidianText(html) : { parseOk: false, httpStatus: res.status };
      // Keep a short excerpt of what the page said when the banner was not found, so a format
      // change shows up in the status document instead of only in the logs.
      if (res.ok && !result.parseOk) result = { ...result, httpStatus: res.status, pageLength: html.length, excerpt: excerpt(html) };
    } catch (err) {
      result = { parseOk: false, error: String(err) };
    }
    if (!result.parseOk) logger.warn("Ritidian status could not be parsed", result);
    await getFirestore().doc("status/ritidian").set({ ...result, sourceUrl: FWS_URL, fetchedAt: FieldValue.serverTimestamp() });
  }
);
