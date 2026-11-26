import type { Metadata } from "next";
import { ProjectGrid } from "@/components/projects/ProjectGrid";
import { getProjectNumber, getProjects } from "@/lib/projects";
import styles from "./work.module.scss";

export const metadata: Metadata = {
  title: "Work",
  description: "Archive of projects by Oblast — web, interactive, branding and experiments.",
  alternates: { canonical: "/work" },
};

// The grid starts just under the nav; the page intro ("Index · N" + "Work")
// keeps its original typographic look but is laid over the grid.
// Category filters (GSAP Flip reflow, shareable ?category=) arrive in Phase 2.
export default function WorkPage() {
  const projects = getProjects();

  return (
    <div className={styles.archive}>
      <header className={styles.intro}>
        <p className="ui">Index · {String(projects.length).padStart(2, "0")}</p>
        <h1 className="display">Work</h1>
      </header>
      <ProjectGrid
        label="All projects"
        projects={projects}
        numbers={projects.map(getProjectNumber)}
      />
    </div>
  );
}
