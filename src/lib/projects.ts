import "server-only";
import { projectEntries } from "@/content/projects";
import { projectSchema, type Project, type Media } from "./content-schema";

// Parse + validate once at module load: a bad entry fails the build, not the visitor.
function load(): Project[] {
  const projects = projectEntries.map((entry, i) => {
    const result = projectSchema.safeParse(entry);
    if (!result.success) {
      throw new Error(
        `Invalid project entry #${i} (${entry.slug ?? "no slug"}):\n${result.error.issues
          .map((issue) => `  ${issue.path.join(".")}: ${issue.message}`)
          .join("\n")}`,
      );
    }
    return result.data;
  });

  const errors: string[] = [];
  const seenSlugs = new Set<string>();
  const seenOrders = new Set<number>();

  for (const p of projects) {
    if (seenSlugs.has(p.slug)) errors.push(`duplicate slug "${p.slug}"`);
    if (seenOrders.has(p.order)) errors.push(`duplicate order ${p.order} (${p.slug})`);
    seenSlugs.add(p.slug);
    seenOrders.add(p.order);

    // Thumbnails, heroes and block media are informative — they need alt text.
    const informative: Media[] = [p.thumbnail, p.hero];
    for (const b of p.blocks) {
      if (b.type === "full" || b.type === "mediaText") informative.push(b.media);
      if (b.type === "split") informative.push(b.left, b.right);
    }
    for (const m of informative) {
      if (!m.alt.trim()) errors.push(`${p.slug}: missing alt text for ${m.src}`);
    }
  }

  if (errors.length) throw new Error(`Project content errors:\n  ${errors.join("\n  ")}`);

  return projects.sort((a, b) => a.order - b.order);
}

const projects = load();

export function getProjects(): Project[] {
  return projects;
}

export function getFeaturedProjects(): Project[] {
  return projects.filter((p) => p.featured);
}

export function getProject(slug: string): Project | undefined {
  return projects.find((p) => p.slug === slug);
}

/** Stable ordering drives project numbers and prev/next navigation. */
export function getProjectNumber(project: Project): string {
  return String(projects.indexOf(project) + 1).padStart(2, "0");
}

export function getAdjacentProjects(project: Project) {
  const i = projects.indexOf(project);
  const n = projects.length;
  return {
    previous: projects[(i - 1 + n) % n],
    next: projects[(i + 1) % n],
  };
}

export function getCategories(): string[] {
  return [...new Set(projects.map((p) => p.category))];
}
