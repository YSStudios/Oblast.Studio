import Link from "next/link";
import { Hero } from "@/components/hero/Hero";
import { ProjectGrid } from "@/components/projects/ProjectGrid";
import { getFeaturedProjects, getProjectNumber } from "@/lib/projects";
import styles from "./home.module.scss";

export default function Home() {
  const projects = getFeaturedProjects();

  return (
    <>
      <Hero projectCount={projects.length} />
      <ProjectGrid
        id="selected-work"
        label="Selected work"
        projects={projects}
        numbers={projects.map(getProjectNumber)}
      />
      <section className={styles.statement} aria-labelledby="studio-title">
        <h2 id="studio-title" className="ui-muted">
          Studio
        </h2>
        {/* PLACEHOLDER copy — replace with the approved studio statement. */}
        <p className="h2">
          Oblast is an independent studio working across design, technology and interactive
          media — building websites, tools and experiences with care for craft and performance.
        </p>
        <Link href="/about" className={`${styles.more} ui`}>
          About the studio →
        </Link>
      </section>
    </>
  );
}
