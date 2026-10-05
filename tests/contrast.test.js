// WCAG 2.2 AA contrast for every text-on-fill pairing the components use, in all three themes:
// light, dark (phone setting) and day-of (on either phone setting). Values are read from the
// brand tokens file, so a token edit that breaks contrast fails CI.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const css = fs.readFileSync(new URL("../brands/techsavvy/tokens.css", import.meta.url), "utf8").replace(/\/\*[\s\S]*?\*\//g, "");
function block(selectorRe) {
  const m = css.match(selectorRe);
  if (!m) throw new Error("token block not found: " + selectorRe);
  const body = m[1], out = {};
  for (const [, k, v] of body.matchAll(/(--gcc-[\w-]+)\s*:\s*([^;]+);/g)) out[k] = v.trim();
  return out;
}
const light = block(/:root, \.gcc-light \{([\s\S]*?)\n\}/);
const dark = { ...light, ...block(/@media \(prefers-color-scheme: dark\) \{\s*:root \{([\s\S]*?)\n  \}/) };
const dayofOver = block(/\[data-mode="dayof"\] \{([\s\S]*?)\n\}/);
export const THEMES = { light, dark, "dayof-light": { ...light, ...dayofOver }, "dayof-dark": { ...dark, ...dayofOver } };

function lum(hex) {
  const h = hex.replace("#", "");
  const [r, g, b] = [0, 2, 4].map(i => parseInt(h.slice(i, i + 2), 16) / 255).map(c => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}
export function ratio(a, b) { const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05); }

// [foreground, background, minimum, what]
const TEXT = 4.5, LARGE = 3;
const pairs = [
  ["ink", "bg", TEXT, "body text"], ["ink", "surface", TEXT, "text on surface"], ["ink", "surface-2", TEXT, "text on shallows band"],
  ["ink-2", "bg", TEXT, "secondary text"], ["ink-2", "surface-2", TEXT, "secondary text on shallows"],
  ["ink-3", "bg", TEXT, "meta and credit lines"], ["ink-3", "surface", TEXT, "meta on surface"], ["ink-3", "surface-2", TEXT, "meta on shallows"],
  ["lagoon-text", "bg", TEXT, "kickers and links"], ["lagoon-text", "surface-2", LARGE, "lagoon number on a selected row (small lagoon text never sits on shallows)"],
  ["sunset-text", "surface-2", TEXT, "late flag on a meal band"], ["ok", "surface-2", TEXT, "positive note on shallows"],
  ["lagoon-display", "bg", LARGE, "large lagoon numerals"],
  ["sunset-text", "bg", TEXT, "late and error text"], ["sunset-text", "sunset-bg", TEXT, "advisory label"],
  ["ink", "sunset-bg", TEXT, "advisory body"],
  ["on-sunset", "sunset", TEXT, "plan changed alert text"], ["on-sunset", "sunset-chip", TEXT, "cause row in plan changed"],
  ["on-lagoon", "lagoon", TEXT, "Navigate and condition-on fills"],
  ["on-primary", "primary", TEXT, "primary buttons"], ["bg", "ink", TEXT, "selected chips and segments"],
  ["ok", "ok-bg", TEXT, "fit tags and logged state"], ["ok", "bg", TEXT, "positive numbers"],
  ["cat-food-text", "surface-2", TEXT, "meal kicker on shallows"], ["cat-food-text", "bg", TEXT, "meal kicker"],
  ["on-tabbar", "tabbar", TEXT, "tab labels"], ["on-tabbar-active", "tabbar", TEXT, "active tab label"],
  ["ink-3", "map-land", TEXT, "map labels and off-plan outline"],
  ["primary", "map-land", LARGE, "route line on land"], ["primary", "map-sea", LARGE, "route line over sea"]
];
for (const c of ["view", "nature", "swim", "ancient", "spanish", "wwii"]) pairs.push(["on-marker", "cat-" + c, TEXT, `marker number on ${c}`]);
for (const c of ["view", "nature", "swim", "ancient", "spanish", "wwii", "food"]) pairs.push(["cat-" + c, "map-land", LARGE, `${c} marker shape on land`]);

for (const [name, t] of Object.entries(THEMES)) {
  test(`contrast AA: ${name}`, () => {
    const fails = [];
    for (const [fg, bg, min, what] of pairs) {
      const a = t["--gcc-" + fg], b = t["--gcc-" + bg];
      assert.ok(a && b, `${name}: missing token ${fg} or ${bg}`);
      const r = ratio(a, b);
      if (r < min) fails.push(`${what}: ${fg} ${a} on ${bg} ${b} = ${r.toFixed(2)} (needs ${min})`);
    }
    assert.deepEqual(fails, [], fails.join("\n"));
  });
}

// The Next Stop bar is always the light set, on top of day-of navy.
test("contrast AA: Next Stop bar (light scope inside day-of)", () => {
  assert.ok(ratio(light["--gcc-on-lagoon"], light["--gcc-lagoon"]) >= TEXT);
  assert.ok(ratio(light["--gcc-on-primary"], light["--gcc-primary"]) >= TEXT);
  assert.ok(ratio(light["--gcc-lagoon-text"], light["--gcc-bg"]) >= TEXT);
});
