import test from "node:test";
import assert from "node:assert/strict";
import { rollForward } from "../src/app/roll-forward.js";

test("a past date moves to today", () => {
  const { state, moved } = rollForward({ date: "2026-10-05", trip: { on: false } }, "2026-10-06");
  assert.equal(state.date, "2026-10-06"); assert.equal(moved, true);
});
test("today and future dates stay", () => {
  assert.equal(rollForward({ date: "2026-10-06" }, "2026-10-06").state.date, "2026-10-06");
  assert.equal(rollForward({ date: "2026-10-20" }, "2026-10-06").state.date, "2026-10-20");
});
test("a day-of session from an earlier day ends", () => {
  const { state } = rollForward({ date: "2026-10-05", trip: { on: true, status: { cetti: "done" }, last: "cetti" } }, "2026-10-06");
  assert.equal(state.trip.on, false); assert.deepEqual(state.trip.status, {});
});
test("a day-of session today keeps going", () => {
  const s = { date: "2026-10-06", trip: { on: true, status: { cetti: "done" } } };
  assert.equal(rollForward(s, "2026-10-06").state.trip.on, true);
});
