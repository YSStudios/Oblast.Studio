import type { Project } from "@/lib/content-schema";
import { ProjectTile } from "./ProjectTile";

// Curated layout: explicit spans + source order. No `grid-auto-flow: dense`,
// so visual order and keyboard order always match.
export function ProjectGrid({
  projects,
  numbers,
  label,
  id,
}: {
  projects: Project[];
  numbers: string[];
  label: string;
  id?: string;
}) {
  return (
    <section id={id} className="project-archive" aria-label={label}>
      <ul className="project-grid">
        {projects.map((project, i) => (
          <ProjectTile
            key={project.slug}
            project={project}
            number={numbers[i]}
            priority={i < 2}
          />
        ))}
      </ul>
    </section>
  );
}
