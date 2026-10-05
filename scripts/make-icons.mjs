// Render the PNG app icons from public/icons/icon.svg at build time, so the repo holds
// only the SVG source. Runs as the prebuild step locally and in CI.
import sharp from "sharp";
import fs from "node:fs";

const dir = new URL("../public/icons/", import.meta.url);
const svg = fs.readFileSync(new URL("icon.svg", dir));
const ground = "#073B5C";
const jobs = [
  { file: "icon-192.png", size: 192 },
  { file: "icon-512.png", size: 512 },
  { file: "apple-touch-icon.png", size: 180 },
  { file: "icon-512-maskable.png", size: 512, inset: 0.12 }
];
for (const j of jobs) {
  const inner = Math.round(j.size * (1 - 2 * (j.inset || 0)));
  const art = await sharp(svg, { density: 384 }).resize(inner, inner).png().toBuffer();
  const img = j.inset
    ? sharp({ create: { width: j.size, height: j.size, channels: 4, background: ground } }).composite([{ input: art, gravity: "center" }])
    : sharp(art);
  await img.png().toFile(new URL(j.file, dir).pathname);
}
console.log("icons:", jobs.map(j => j.file).join(", "));
