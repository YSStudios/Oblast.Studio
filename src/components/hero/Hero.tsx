import { site } from "@/lib/site";
import { HeroPoster } from "./HeroPoster";
import styles from "./Hero.module.scss";

export function Hero({ projectCount }: { projectCount: number }) {
  return (
    <section className={styles.hero} aria-labelledby="hero-title">
      <div className={styles.copy}>
        <h1 id="hero-title" className="display">
          <span className="visually-hidden">{site.shortName} — </span>
          Independent studio
          <br />
          Design / Technology
          <br />
          Digital experiences
        </h1>
        <p className={`${styles.descriptor} lead`}>{site.descriptor}</p>
      </div>

      {/* Decorative: meaningful text lives outside the canvas. */}
      <div className={styles.stage} aria-hidden="true">
        <HeroPoster />
      </div>

      <div className={`${styles.footer} ui`}>
        <a href="#selected-work" className={styles.cue}>
          Selected work <span aria-hidden="true">↓</span>
        </a>
        <span className="ui-muted">
          {String(projectCount).padStart(2, "0")} projects
        </span>
      </div>
    </section>
  );
}
