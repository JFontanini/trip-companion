import { test } from "node:test";
import assert from "node:assert/strict";
import { parseRitidianText } from "../functions/parse.js";

test("normal hours reads as open", () => {
  const r = parseRitidianText("<h2>RITIDIAN BEACH STATUS: NORMAL HOURS</h2><p>The Guam National Wildlife Refuge, including Ritidian Beach, is open during normal operational hours. Normal operational hours are Wednesday to Sunday.</p><p>Updated for 06/20/2026</p>");
  assert.equal(r.parseOk, true); assert.equal(r.open, true); assert.equal(r.label, "NORMAL HOURS"); assert.equal(r.sourceUpdated, "06/20/2026");
});
test("closed reads as closed", () => {
  const r = parseRitidianText("<b>RITIDIAN BEACH STATUS: CLOSED</b> The Guam National Wildlife Refuge, including Ritidian Beach, is closed due to hazardous ocean conditions.");
  assert.equal(r.parseOk, true); assert.equal(r.open, false);
  assert.match(r.summary, /hazardous ocean conditions\.$/);
});
test("missing banner fails visibly", () => {
  assert.deepEqual(parseRitidianText("<p>Welcome to the refuge</p>"), { parseOk: false });
});
