import { TransitionLink as Link } from "@/components/transitions/TransitionLink";
import { nav, site } from "@/lib/site";
import styles from "./SiteFooter.module.scss";

// Cached so the prerendered shell stays static (Cache Components forbids
// uncached `new Date()` during prerender).
async function CopyrightYear() {
  "use cache";
  return <>{new Date().getFullYear()}</>;
}

export function SiteFooter() {
  return (
    <footer className={styles.footer}>
      <div className={styles.inner}>
        <p className={`${styles.statement} lead`}>{site.descriptor}</p>
        <div className={`${styles.cols} ui`}>
          <div>
            <p className="ui-muted">Inquiries</p>
            <a href={`mailto:${site.email}`} className={styles.mail}>
              {site.email}
            </a>
          </div>
          <div>
            <p className="ui-muted">Index</p>
            <ul className={styles.list}>
              <li>
                <Link href="/">Home</Link>
              </li>
              {nav.map((item) => (
                <li key={item.href}>
                  <Link href={item.href}>{item.label}</Link>
                </li>
              ))}
              <li>
                <Link href="/contact">Contact</Link>
              </li>
            </ul>
          </div>
          <p className="ui-muted">
            © <CopyrightYear /> {site.name}
          </p>
        </div>
      </div>
    </footer>
  );
}
