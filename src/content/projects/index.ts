// MOCK PROJECT ENTRIES — for layout testing only. Replace before launch.
// Titles, clients and copy are invented placeholders; no real clients or metrics.
// Spans are curated so auto-placement packs exactly at 6 / 3 / 2 columns:
//   desktop rows: [1·2][2·3×2][3·2×2] / [4·2×4][5·1×4][6·2×1][7·1×1] / [8·3×3]
import type { Media, ProjectInput } from "@/lib/content-schema";

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

type Seed = {
  slug: string;
  title: string;
  category: string;
  disciplines: string[];
  year: number;
  featured?: boolean;
  spans: ProjectInput["spans"];
  stack?: string[];
  role?: string;
};

const seeds: Seed[] = [
  {
    slug: "mock-signal-atlas",
    title: "Signal Atlas",
    category: "Interactive",
    disciplines: ["WebGL", "Realtime"],
    year: 2026,
    spans: { desktop: { x: 1, y: 2 }, tablet: { x: 1, y: 2 }, mobile: { x: 1, y: 2 } },
    stack: ["Three.js", "GLSL", "Next.js"],
    role: "Design & development",
  },
  {
    slug: "mock-field-notes",
    title: "Field Notes",
    category: "Web",
    disciplines: ["Editorial", "CMS"],
    year: 2026,
    spans: { desktop: { x: 3, y: 2 }, tablet: { x: 2, y: 2 }, mobile: { x: 1, y: 2 } },
    stack: ["Next.js", "Sanity"],
    role: "Art direction & build",
  },
  {
    slug: "mock-low-orbit",
    title: "Low Orbit",
    category: "Branding",
    disciplines: ["Identity", "Motion"],
    year: 2025,
    spans: { desktop: { x: 2, y: 2 }, tablet: { x: 1, y: 2 }, mobile: { x: 2, y: 2 } },
    role: "Identity system",
  },
  {
    slug: "mock-soft-machine",
    title: "Soft Machine",
    category: "Experiments",
    disciplines: ["Generative", "Shader"],
    year: 2025,
    spans: { desktop: { x: 2, y: 4 }, tablet: { x: 2, y: 2 }, mobile: { x: 1, y: 2 } },
    stack: ["GLSL", "TouchDesigner"],
  },
  {
    slug: "mock-terrain-index",
    title: "Terrain Index",
    category: "Interactive",
    disciplines: ["Data", "Mapping"],
    year: 2025,
    spans: { desktop: { x: 1, y: 4 }, tablet: { x: 1, y: 4 }, mobile: { x: 1, y: 2 } },
    stack: ["Mapbox", "D3"],
  },
  {
    slug: "mock-quiet-room",
    title: "Quiet Room",
    category: "Web",
    disciplines: ["E-commerce"],
    year: 2024,
    spans: { desktop: { x: 2, y: 1 }, tablet: { x: 2, y: 2 }, mobile: { x: 2, y: 2 } },
  },
  {
    slug: "mock-parallel",
    title: "Parallel",
    category: "Experiments",
    disciplines: ["Audio", "Realtime"],
    year: 2024,
    spans: { desktop: { x: 1, y: 1 }, tablet: { x: 2, y: 2 }, mobile: { x: 1, y: 2 } },
    stack: ["Web Audio", "WebGPU"],
  },
  {
    slug: "mock-north-light",
    title: "North Light",
    category: "Branding",
    disciplines: ["Identity", "Web"],
    year: 2024,
    spans: { desktop: { x: 3, y: 3 }, tablet: { x: 3, y: 2 }, mobile: { x: 1, y: 2 } },
  },
];

export const projectEntries: ProjectInput[] = seeds.map((s, i) => {
  const n = String(i + 1).padStart(2, "0");
  return {
    ...s,
    order: i + 1,
    featured: s.featured ?? true,
    placeholder: true,
    client: "Mock client",
    collaborators: ["Placeholder collaborator"],
    thumbnail: media(n, "thumb", `Placeholder poster for ${s.title} (mock project)`),
    hero: media(n, "hero", `Placeholder hero image for ${s.title} (mock project)`),
    summary: `Mock case study used to test layout and transitions. ${s.category} / ${s.disciplines.join(", ")}.`,
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
