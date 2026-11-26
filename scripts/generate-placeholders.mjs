// Generates clearly-labelled MOCK posters for layout testing.
// Output: public/media/projects/mock-XX-{thumb,hero,detail-a,detail-b}.svg
// Replace with real, licensed media before launch.
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const out = join(process.cwd(), "public/media/projects");
mkdirSync(out, { recursive: true });

// Muted, footage-like duotones so the neutral UI isn't fighting loud colour.
// A mixed wall like a real archive: light greys, near-black, high-contrast
// black/white, one saturated red, soft greens. [dark, light] per poster.
const palettes = [
  ["#8f8f8b", "#e4e4e0"],
  ["#050505", "#f2f2f0"],
  ["#9a9a96", "#d8d8d4"],
  ["#0b0b0b", "#8e8e8e"],
  ["#7d7466", "#c9c1b3"],
  ["#000000", "#ffffff"],
  ["#5f6460", "#c6cbc8"],
  ["#b9b9b5", "#ecece8"],
  ["#c0369f", "#f6d64a"],
  ["#c40000", "#ff6b6b"],
  ["#6f9a86", "#cfe6dc"],
  ["#c9c9c5", "#f1f1ee"],
  ["#3a3a38", "#bdbdb8"],
  ["#2b4a3c", "#a9d1bf"],
  ["#141414", "#6e6e6e"],
  ["#4a4a48", "#d0d0cc"],
];

const variants = {
  thumb: [1200, 1200],
  hero: [2400, 1350],
  "detail-a": [1600, 1000],
  "detail-b": [1200, 1500],
};

function svg(w, h, [dark, light], label, variant, seed) {
  const cx = (seed * 137) % 100;
  const cy = (seed * 59) % 100;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">
  <defs>
    <radialGradient id="g" cx="${cx}%" cy="${cy}%" r="85%">
      <stop offset="0" stop-color="${light}"/>
      <stop offset="1" stop-color="${dark}"/>
    </radialGradient>
  </defs>
  <rect width="100%" height="100%" fill="url(#g)"/>
  <g fill="none" stroke="${light}" stroke-opacity="0.25">
    <line x1="0" y1="${h / 2}" x2="${w}" y2="${h / 2}"/>
    <line x1="${w / 2}" y1="0" x2="${w / 2}" y2="${h}"/>
    <rect x="${w * 0.08}" y="${h * 0.08}" width="${w * 0.84}" height="${h * 0.84}"/>
  </g>
  <text x="${w * 0.08}" y="${h * 0.08 + Math.min(w, h) * 0.06}" fill="${dark}" fill-opacity="0.85"
    font-family="ui-monospace, monospace" font-size="${Math.round(Math.min(w, h) * 0.045)}" letter-spacing="2">MOCK ${label} · ${variant.toUpperCase()}</text>
</svg>
`;
}

palettes.forEach((palette, i) => {
  const n = String(i + 1).padStart(2, "0");
  for (const [variant, [w, h]] of Object.entries(variants)) {
    writeFileSync(join(out, `mock-${n}-${variant}.svg`), svg(w, h, palette, n, variant, i + 3));
  }
});

console.log(`Wrote ${palettes.length * Object.keys(variants).length} placeholder posters to ${out}`);
