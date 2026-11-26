import Image from "next/image";
import Link from "next/link";
import type { CSSProperties } from "react";
import type { Project } from "@/lib/content-schema";
import styles from "./ProjectTile.module.scss";

// Approximate rendered width per breakpoint so Next Image picks the right source.
function sizesFor(spans: Project["spans"]) {
  const pct = (span: number, cols: number) => `${Math.ceil((span / cols) * 100)}vw`;
  return [
    `(max-width: 420px) 100vw`,
    `(max-width: 720px) ${pct(spans.mobile.x, 2)}`,
    `(max-width: 1100px) ${pct(spans.tablet.x, 3)}`,
    pct(spans.desktop.x, 6),
  ].join(", ");
}

export function ProjectTile({
  project,
  number,
  priority = false,
}: {
  project: Project;
  number: string;
  priority?: boolean;
}) {
  const { spans, thumbnail } = project;

  const style = {
    "--span-x-desktop": spans.desktop.x,
    "--span-y-desktop": spans.desktop.y,
    "--span-x-tablet": spans.tablet.x,
    "--span-y-tablet": spans.tablet.y,
    "--span-x-mobile": spans.mobile.x,
    "--span-y-mobile": spans.mobile.y,
  } as CSSProperties;

  return (
    <li className={styles.tile} style={style} data-project={project.slug}>
      <Link href={`/work/${project.slug}`} className={styles.link}>
        {/* Decorative here: the caption text below is the link's accessible name. */}
        <Image
          src={thumbnail.poster ?? thumbnail.src}
          alt=""
          fill
          sizes={sizesFor(spans)}
          priority={priority}
          className={styles.media}
          style={{ objectPosition: thumbnail.objectPosition }}
        />
        {/* Always-present caption: visible on touch, keyboard focus and hover.
            Hover must never be required to identify a project. */}
        <span className={`${styles.caption} ui`}>
          <span className={styles.title}>{project.title}</span>{" "}
          <span className={styles.meta}>
            {project.category} · {project.year}
          </span>
          <span className={styles.num} aria-hidden="true">
            {number}
          </span>
        </span>
      </Link>
    </li>
  );
}
