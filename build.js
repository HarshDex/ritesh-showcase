// Builds the site into dist/ for Vercel (see vercel.json). Run locally with: node build.js
// - Scans images/ and writes designs.js (file name + width/height, so the grid never jumps while loading)
// - Makes WhatsApp/Instagram link previews use the full site address when built on Vercel
const fs = require("fs");
const path = require("path");

const root = __dirname;
const imgDir = path.join(root, "images");

// Read width/height from a JPEG/PNG/WebP header without any dependencies.
function size(file) {
  const b = fs.readFileSync(file);
  if (b[0] === 0x89 && b.toString("ascii", 1, 4) === "PNG") return { w: b.readUInt32BE(16), h: b.readUInt32BE(20) };
  if (b.toString("ascii", 0, 4) === "RIFF" && b.toString("ascii", 8, 12) === "WEBP") {
    const t = b.toString("ascii", 12, 16);
    if (t === "VP8X") return { w: 1 + b.readUIntLE(24, 3), h: 1 + b.readUIntLE(27, 3) };
    if (t === "VP8 ") return { w: b.readUInt16LE(26) & 0x3fff, h: b.readUInt16LE(28) & 0x3fff };
    if (t === "VP8L") { const n = b.readUInt32LE(21); return { w: (n & 0x3fff) + 1, h: ((n >> 14) & 0x3fff) + 1 }; }
  }
  let i = 2; // JPEG
  while (i < b.length) {
    if (b[i] !== 0xff) { i++; continue; }
    const m = b[i + 1];
    if (m >= 0xc0 && m <= 0xcf && m !== 0xc4 && m !== 0xc8 && m !== 0xcc) return { w: b.readUInt16BE(i + 7), h: b.readUInt16BE(i + 5) };
    i += 2 + b.readUInt16BE(i + 2);
  }
  return { w: 3, h: 4 };
}

const designs = fs
  .readdirSync(imgDir)
  .filter((f) => /\.(jpe?g|png|webp)$/i.test(f))
  .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }))
  .map((f) => ({ f, ...size(path.join(imgDir, f)) }));

const js = "window.DESIGNS = " + JSON.stringify(designs) + ";\n";
fs.writeFileSync(path.join(root, "designs.js"), js); // for local preview

// ---- dist/ for Vercel ----
const dist = path.join(root, "dist");
fs.rmSync(dist, { recursive: true, force: true });
fs.mkdirSync(path.join(dist, "images"), { recursive: true });
for (const d of designs) fs.copyFileSync(path.join(imgDir, d.f), path.join(dist, "images", d.f));
fs.writeFileSync(path.join(dist, "designs.js"), js);

let html = fs.readFileSync(path.join(root, "index.html"), "utf8");
const host = process.env.VERCEL_PROJECT_PRODUCTION_URL || process.env.VERCEL_URL;
if (host) html = html.replace(/(property="og:(?:image|url)" content=")\//g, `$1https://${host}/`);
fs.writeFileSync(path.join(dist, "index.html"), html);

console.log(`Built dist/ with ${designs.length} designs${host ? " for " + host : ""}`);
