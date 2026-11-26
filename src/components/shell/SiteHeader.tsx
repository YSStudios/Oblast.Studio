import Link from "next/link";
import { site } from "@/lib/site";
import { LocalClock } from "./LocalClock";
import { NavLinks } from "./NavLinks";
import styles from "./SiteHeader.module.scss";

// Final header state. Phase 3 morphs these same elements from a centred
// strip via GSAP Flip — keep this a single, stable set of semantic links.
export function SiteHeader() {
  return (
    <header className={styles.header}>
      <nav className={`${styles.bar} ui`} aria-label="Primary">
        <Link href="/" className={`${styles.segment} ${styles.mark}`}>
          {site.name}
        </Link>
        <div className={`${styles.segment} ${styles.nav}`}>
          <NavLinks />
        </div>
        {site.clock.enabled && (
          <div className={`${styles.segment} ${styles.clock}`}>
            <LocalClock timeZone={site.clock.timeZone} label={site.clock.label} />
          </div>
        )}
        <Link href="/contact" className={`${styles.segment} ${styles.contact}`}>
          Contact
        </Link>
      </nav>
    </header>
  );
}
