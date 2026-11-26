import { site } from "@/lib/site";
import styles from "./Hero.module.scss";

// The video glass shapes (HeroCube / VideoChain) are parked for now — the
// code stays in components/hero and /dev/cube. The hero keeps the statement
// over the big out-of-focus colour backdrop.
export function Hero({ projectCount }: { projectCount: number }) {
  return (
    <section className={styles.hero} aria-labelledby="hero-title">
      <div className={styles.backdrop} aria-hidden="true" />

      <h1 id="hero-title" className={`${styles.title} display`}>
        <span className="visually-hidden">{site.shortName} — </span>
        {site.descriptor}
      </h1>

      <div className={`${styles.footer} ui`}>
        <a href="#selected-work" className={styles.cue}>
          Selected work <span aria-hidden="true">↓</span>
        </a>
        <span className="ui-muted">{String(projectCount).padStart(2, "0")} projects</span>
      </div>
    </section>
  );
}
