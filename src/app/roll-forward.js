// A saved plan whose date has passed moves to today when the page opens, so the planner and the
// live conditions follow the calendar. A future date the person picked stays. A day-of session
// left running from an earlier day ends, since its stops and times belong to that day.
export function rollForward(s, today) {
  if (!s.date || s.date >= today) return { state: s, moved: false };
  const next = { ...s, date: today };
  if (s.trip && s.trip.on) next.trip = { on: false, status: {}, doneAt: {}, extra: {}, last: null, lunchDone: false, dinnerDone: false };
  return { state: next, moved: true };
}
