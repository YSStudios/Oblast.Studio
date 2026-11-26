import Link from "next/link";
import type { Project } from "@/lib/content-schema";
import styles from "./CaseStudy.module.scss";

export function ProjectPagination({ previous, next }: { previous: Project; next: Project }) {
  return (
    <nav className={styles.pagination} aria-label="More projects">
      <Link href={`/work/${previous.slug}`} className={styles.pageLink} rel="prev">
        <span className="ui-muted">← Previous</span>
        <span className="h2">{previous.title}</span>
      </Link>
      <Link
        href={`/work/${next.slug}`}
        className={`${styles.pageLink} ${styles.pageNext}`}
        rel="next"
      >
        <span className="ui-muted">Next project →</span>
        <span className="h2">{next.title}</span>
      </Link>
    </nav>
  );
}
