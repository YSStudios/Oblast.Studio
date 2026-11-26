// Studio-wide configuration.
// PLACEHOLDER values are marked — confirm before publishing (spec §16).

export const site = {
  name: "OBLAST.STUDIO",
  shortName: "Oblast",
  url: "https://oblast.studio",
  // PLACEHOLDER copy — replace with approved studio line.
  descriptor: "Independent studio for design, technology and digital experiences.",
  email: "hello@oblast.studio", // PLACEHOLDER — confirm contact destination
  clock: {
    // PLACEHOLDER — set to the studio's real IANA timezone. Never infer visitor location.
    enabled: true,
    timeZone: "UTC",
    label: "UTC",
  },
  // While true, every page is noindex and robots.txt disallows crawling.
  // Flip to false only once mock projects are replaced with approved content.
  preLaunch: true,
} as const;

export const nav = [
  { href: "/work", label: "Work" },
  { href: "/about", label: "About" },
] as const;
