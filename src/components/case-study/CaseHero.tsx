import Image from "next/image";
import type { Project } from "@/lib/content-schema";
import styles from "./CaseStudy.module.scss";

// The persistent transition compositor measures this primary media region.
export function CaseHero({ project, number }: { project: Project; number: string }) {
  const { hero } = project;
  return (
    <header className={styles.hero}>
      <p className={`${styles.kicker} ui`}>
        <span>{project.title}</span>
        <span aria-hidden="true">/</span>
        <span>{project.category}</span>
        <span aria-hidden="true">/</span>
        <span>{project.year}</span>
        <span className="ui-muted">{number}</span>
        {project.placeholder && <span className={styles.mock}>Mock project</span>}
      </p>
      <h1 className={`${styles.title} display`} tabIndex={-1}>
        {project.title}
      </h1>
      <div data-transition-media className={styles.heroMedia} style={{ aspectRatio: `${hero.width} / ${hero.height}` }}>
        <Image
          src={hero.poster ?? hero.src}
          alt={hero.alt}
          fill
          priority
          sizes="100vw"
          style={{ objectFit: "cover", objectPosition: hero.objectPosition }}
        />
      </div>
    </header>
  );
}
