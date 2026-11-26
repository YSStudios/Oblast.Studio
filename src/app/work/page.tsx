import type { Metadata } from "next";
import { ProjectGrid } from "@/components/projects/ProjectGrid";
import { PageIntro } from "@/components/shell/PageIntro";
import { getProjectNumber, getProjects } from "@/lib/projects";

export const metadata: Metadata = {
  title: "Work",
  description: "Archive of projects by Oblast — web, interactive, branding and experiments.",
  alternates: { canonical: "/work" },
};

// Category filters (GSAP Flip reflow, shareable ?category=) arrive in Phase 2.
export default function WorkPage() {
  const projects = getProjects();

  return (
    <>
      <PageIntro eyebrow={`Index · ${String(projects.length).padStart(2, "0")}`} title="Work" />
      <ProjectGrid
        label="All projects"
        projects={projects}
        numbers={projects.map(getProjectNumber)}
      />
    </>
  );
}
