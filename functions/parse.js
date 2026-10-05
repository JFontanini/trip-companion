// Pure parser, kept apart from the Firebase imports so it can be unit tested.
// The FWS page carries a banner like "RITIDIAN BEACH STATUS: CLOSED" followed by a sentence.
// The live HTML uses entities (&nbsp;, &#39;) and can change case, so text is decoded and the
// banner is matched without regard to case.
const ENTITIES = { amp: "&", nbsp: " ", quot: '"', apos: "'", rsquo: "'", lsquo: "'", ldquo: '"', rdquo: '"', ndash: " to ", mdash: ", ", lt: "<", gt: ">" };

export function htmlToText(html) {
  return html
    .replace(/<(script|style|noscript)[\s\S]*?<\/\1>/gi, " ")
    .replace(/<\/(h[1-6]|p|div|li|tr|section|header)>|<br\s*\/?>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(Number(d)))
    .replace(/&([a-z]+);/gi, (m, n) => ENTITIES[n.toLowerCase()] ?? m)
    .replace(/[ \t\r\f\v\u00a0\u200b]+/g, " ")
    .replace(/ *\n\s*/g, "\n")
    .trim();
}

export function parseRitidianText(html) {
  const text = htmlToText(html);
  const at = text.search(/ritidian beach status\s*:/i);
  if (at < 0) return { parseOk: false };
  const after = text.slice(at).replace(/^ritidian beach status\s*:\s*/i, "");
  // The label is usually its own element, so it ends at a block boundary (newline) or a period.
  // When the page runs it into the next sentence, an all-caps label ends where that sentence starts.
  let label = (after.match(/^([^\n.]{1,60})(?:\n|\.|$)/) || [])[1];
  if (!label) label = (after.match(/^([A-Z][A-Z ,'&/-]{1,60}?)(?=\s+[A-Z][a-z])/) || [])[1];
  if (!label || !/[A-Za-z]/.test(label)) return { parseOk: false };
  const rest = after.slice(after.indexOf(label) + label.length).replace(/^[\s.:]+/, "").replace(/\n/g, " ");
  label = label.trim().toUpperCase();
  const summary = ((rest.match(/^(.*?\.)(\s|$)/) || [, rest.slice(0, 200)])[1] || "").trim();
  const updated = (text.match(/Updated(?: for| on)?\s*:?\s+(\d{1,2}\/\d{1,2}\/\d{4})/i) || [])[1] || null;
  const open = !/CLOSED/.test(label);
  return { parseOk: true, label, open, summary, sourceUpdated: updated };
}

// For a failed parse: a short excerpt so the stored status shows what the page actually said.
export function excerpt(html) {
  const text = htmlToText(html);
  const at = text.search(/ritidian/i);
  return text.slice(Math.max(0, at < 0 ? 0 : at - 40), (at < 0 ? 0 : at) + 260).replace(/\n/g, " | ");
}
