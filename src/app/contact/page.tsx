import type { Metadata } from "next";
import { PageIntro } from "@/components/shell/PageIntro";
import { site } from "@/lib/site";
import styles from "../info.module.scss";

export const metadata: Metadata = {
  title: "Contact",
  description: "Start a project with Oblast.",
  alternates: { canonical: "/contact" },
};

export default function ContactPage() {
  return (
    <>
      <PageIntro eyebrow="Inquiries" title="Contact">
        <p>New projects, collaborations and studio visits.</p>
      </PageIntro>
      <section className={styles.section} aria-labelledby="channels">
        <h2 id="channels" className="ui-muted">
          Email
        </h2>
        <div>
          {/* PLACEHOLDER address — confirm contact destination before launch. */}
          <a href={`mailto:${site.email}`} className={`${styles.email} display`}>
            {site.email}
          </a>
          {site.clock.enabled && (
            <p className="ui-muted" style={{ marginTop: "var(--space-4)" }}>
              Studio time zone: {site.clock.label}
            </p>
          )}
        </div>
      </section>
    </>
  );
}
