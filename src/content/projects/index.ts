// MOCK PROJECT ENTRIES — for layout testing only. Replace before launch.
// Titles, clients and copy are invented placeholders; no real clients or metrics.
//
// Desktop spans reproduce the reference grid (6 cols, rows = half a column):
//   rows 1–2  [1·1×2][2·3×2      ][3·2×2   ]
//   rows 3–4  [4·2×2   ][5·1×3][6·1×2][7·1×2][8·1×2]
//   row  5    [9·2×1   ][  5  ][10·1×1][11·2×2  ]
//   rows 6–7  [12·2×2  ][13·2×2      ][  11 ↓ / 14·2×2]
//   row  8    [15·2×1  ][16·2×1      ][  14    ]
// Source order = visual order = keyboard order (no dense packing).
import type { Media, ProjectInput } from "@/lib/content-schema";
import { mockupThumbnails } from "./mockup-thumbnails";

const media = (n: string, variant: "thumb" | "hero" | "detail-a" | "detail-b", alt: string): Media => {
  const size = {
    thumb: [1200, 1200],
    hero: [2400, 1350],
    "detail-a": [1600, 1000],
    "detail-b": [1200, 1500],
  }[variant];
  return {
    kind: "image",
    src: `/media/projects/mock-${n}-${variant}.svg`,
    width: size[0],
    height: size[1],
    alt,
  };
};

type Span = { x: number; y: number };
type Seed = {
  slug: string;
  title: string;
  category: string;
  disciplines: string[];
  year: number;
  spans: { desktop: Span; tablet: Span; mobile: Span };
  stack?: string[];
  role?: string;
};

const s = (dx: number, dy: number, tx: number, ty: number, mx: number, my: number) => ({
  desktop: { x: dx, y: dy },
  tablet: { x: tx, y: ty },
  mobile: { x: mx, y: my },
});

const seeds: Seed[] = [
  { slug: "mock-signal-atlas", title: "Signal Atlas", category: "Interactive", disciplines: ["Reactive", "WebGL"], year: 2026, spans: s(1, 2, 1, 2, 1, 2), stack: ["Three.js", "GLSL"], role: "Design & development" },
  { slug: "mock-field-notes", title: "Field Notes", category: "Web", disciplines: ["Editorial", "CMS"], year: 2026, spans: s(3, 2, 2, 2, 1, 2), stack: ["Next.js", "Sanity"], role: "Art direction & build" },
  { slug: "mock-low-orbit", title: "Low Orbit", category: "Branding", disciplines: ["Identity", "Motion"], year: 2025, spans: s(2, 2, 3, 2, 2, 2), role: "Identity system" },
  { slug: "mock-soft-machine", title: "Soft Machine", category: "Interactive", disciplines: ["Generative", "Audio"], year: 2025, spans: s(2, 2, 2, 2, 2, 2), stack: ["GLSL", "Web Audio"] },
  { slug: "mock-terrain-index", title: "Terrain Index", category: "Interactive", disciplines: ["Kinetic", "Hardware"], year: 2025, spans: s(1, 3, 1, 2, 1, 2), stack: ["OSC", "TouchDesigner"] },
  { slug: "mock-quiet-room", title: "Quiet Room", category: "Experiments", disciplines: ["Generative"], year: 2024, spans: s(1, 2, 1, 2, 1, 2) },
  { slug: "mock-parallel", title: "Parallel", category: "Installation", disciplines: ["Hardware", "Display"], year: 2024, spans: s(1, 2, 1, 2, 1, 2), stack: ["Raspberry Pi"] },
  { slug: "mock-north-light", title: "North Light", category: "Interactive", disciplines: ["Tracking", "Pose"], year: 2024, spans: s(1, 2, 1, 2, 1, 2), stack: ["MediaPipe"] },
  { slug: "mock-glass-spheres", title: "Glass Spheres", category: "Experiments", disciplines: ["Shader", "Colour"], year: 2024, spans: s(2, 1, 2, 1, 2, 1), stack: ["GLSL"] },
  { slug: "mock-red-shift", title: "Red Shift", category: "Experiments", disciplines: ["Noise", "Motion"], year: 2023, spans: s(1, 1, 1, 1, 2, 1) },
  { slug: "mock-radio-field", title: "Radio Field", category: "Interactive", disciplines: ["Reactive", "Audio"], year: 2024, spans: s(2, 2, 3, 2, 2, 2), stack: ["Web Audio", "Canvas"] },
  { slug: "mock-blank-page", title: "Blank Page", category: "Web", disciplines: ["Typography"], year: 2023, spans: s(2, 2, 2, 2, 1, 2) },
  { slug: "mock-archive-wall", title: "Archive Wall", category: "Web", disciplines: ["Editorial", "Archive"], year: 2023, spans: s(2, 2, 1, 2, 1, 2) },
  { slug: "mock-contour", title: "Contour", category: "Branding", disciplines: ["Identity", "Print"], year: 2022, spans: s(2, 2, 1, 2, 2, 2) },
  { slug: "mock-dial-tone", title: "Dial Tone", category: "Installation", disciplines: ["Kinetic"], year: 2022, spans: s(2, 1, 2, 1, 1, 1) },
  { slug: "mock-after-hours", title: "After Hours", category: "Experiments", disciplines: ["Generative", "Type"], year: 2021, spans: s(2, 1, 2, 1, 1, 1) },
];

// Mix device and print previews across the grid; reuse four for the 16 mock tiles.
const MOCKUP_ORDER = [2, 0, 8, 9, 3, 10, 1, 4, 11, 5, 6, 7, 0, 8, 9, 11];

export const projectEntries: ProjectInput[] = seeds.map((seed, i) => {
  const n = String(i + 1).padStart(2, "0");
  return {
    ...seed,
    order: i + 1,
    featured: true,
    placeholder: true,
    client: "Mock client",
    collaborators: ["Placeholder collaborator"],
    thumbnail: mockupThumbnails[MOCKUP_ORDER[i]],
    hero: media(n, "hero", `Placeholder hero image for ${seed.title} (mock project)`),
    summary: `Mock case study used to test layout and transitions. ${seed.category} / ${seed.disciplines.join(", ")}.`,
    description:
      "Placeholder description. This paragraph stands in for the project story and context: the brief, the constraints, what the studio built and why. Replace with approved copy, credits and outcomes — do not invent clients or metrics.",
    blocks: [
      { type: "full", media: media(n, "hero", "Placeholder full-bleed media") },
      {
        type: "text",
        heading: "Approach",
        body: "Placeholder text section. Keep real copy within a readable measure of roughly 65–75 characters per line and describe the process, the technical decisions and the result.",
      },
      {
        type: "split",
        left: media(n, "detail-b", "Placeholder detail image, left"),
        right: media(n, "detail-b", "Placeholder detail image, right"),
      },
      {
        type: "mediaText",
        media: media(n, "detail-a", "Placeholder process image"),
        body: "Placeholder process notes alongside media. Use this block for prototypes, sketches or technical detail.",
        side: i % 2 === 0 ? "left" : "right",
      },
    ],
  };
});
