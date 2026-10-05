// Pure parser, kept apart from the Firebase imports so it can be unit tested.
export function parseRitidianText(html) {
  const text = html.replace(/<script[\s\S]*?<\/script>/gi, " ").replace(/<[^>]+>/g, " ").replace(/&amp;/g, "&").replace(/\s+/g, " ");
  const m = text.match(/RITIDIAN BEACH STATUS:\s*([A-Z][A-Z ,'&-]{2,60}?)\s+(?=[A-Z][a-z])/);
  if (!m) return { parseOk: false };
  const label = m[1].trim();
  const after = text.slice(m.index + m[0].length, m.index + m[0].length + 600);
  const summary = (after.match(/^(.*?\.)(\s|$)/) || [, after.slice(0, 200)])[1].trim();
  const updated = (text.match(/Updated(?: for)?\s+(\d{1,2}\/\d{1,2}\/\d{4})/i) || [])[1] || null;
  const open = !/CLOSED/.test(label);
  return { parseOk: true, label, open, summary, sourceUpdated: updated };
}
