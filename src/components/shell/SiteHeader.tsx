import { TransitionLink as Link } from "@/components/transitions/TransitionLink";
import { site } from "@/lib/site";
import { LocalClock } from "./LocalClock";
import { NavLinks } from "./NavLinks";
import styles from "./SiteHeader.module.scss";

function PinIcon() {
  return (
    <svg className={styles.icon} viewBox="0 0 12 12" aria-hidden="true" focusable="false">
      <circle cx="6" cy="6" r="5" fill="none" stroke="currentColor" strokeWidth="1" />
      <circle cx="6" cy="6" r="1.6" fill="currentColor" />
    </svg>
  );
}

function ClockIcon() {
  return (
    <svg className={styles.icon} viewBox="0 0 12 12" aria-hidden="true" focusable="false">
      <circle cx="6" cy="6" r="5" fill="none" stroke="currentColor" strokeWidth="1" />
      <path d="M6 3.2V6l2 1.3" fill="none" stroke="currentColor" strokeWidth="1" strokeLinecap="round" />
    </svg>
  );
}

// Thin segmented bar on the same 12-column grid as the work below:
// brand (1) · projects/about (2–6) · location + studio time (7–11) · contact (12).
// Phase 3 morphs these same elements from a centred strip — keep one stable
// set of semantic links.
export function SiteHeader() {
  return (
    <header className={styles.header} data-cursor-invert>
      <nav className={`${styles.bar} ui`} aria-label="Primary">
        <Link href="/" className={`${styles.segment} ${styles.brand}`}>
          {site.name}
        </Link>

        <div className={`${styles.segment} ${styles.navSegment}`}>
          <NavLinks />
        </div>

        {site.clock.enabled && (
          <div className={`${styles.segment} ${styles.clockSegment}`}>
            <span className={styles.location}>
              <PinIcon />
              {site.clock.label}
            </span>
            <span className={styles.time}>
              <LocalClock timeZone={site.clock.timeZone} label={site.clock.label} />
              <ClockIcon />
            </span>
          </div>
        )}

        <Link href="/contact" className={`${styles.segment} ${styles.contact}`}>
          Contact
        </Link>
      </nav>
    </header>
  );
}
