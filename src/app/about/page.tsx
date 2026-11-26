import type { Metadata } from "next";
import { PageIntro } from "@/components/shell/PageIntro";
import styles from "../info.module.scss";

export const metadata: Metadata = {
  title: "About",
  description: "Oblast's approach, people and capabilities.",
  alternates: { canonical: "/about" },
};

// PLACEHOLDER — all copy on this page awaits approved studio text.
const capabilities = [
  { group: "Design", items: ["Art direction", "Identity systems", "Interface design", "Motion"] },
  { group: "Technology", items: ["Web development", "WebGL / realtime", "Creative tooling", "Prototyping"] },
  { group: "Experiences", items: ["Interactive installations", "Campaign sites", "Product launches"] },
];

const people = [
  { name: "Founder name", role: "Co-founder — placeholder" },
  { name: "Founder name", role: "Co-founder — placeholder" },
];

export default function AboutPage() {
  return (
    <>
      <PageIntro eyebrow="Studio" title="About">
        <p>
          Oblast is an independent two-person studio for design, technology and digital
          experiences. Placeholder — replace with the studio&apos;s approach in your own words.
        </p>
      </PageIntro>

      <section className={styles.section} aria-labelledby="capabilities">
        <h2 id="capabilities" className="ui-muted">
          Capabilities
        </h2>
        <div className={styles.columns}>
          {capabilities.map((c) => (
            <div key={c.group}>
              <h3 className="ui">{c.group}</h3>
              <ul className={styles.list}>
                {c.items.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </section>

      <section className={styles.section} aria-labelledby="people">
        <h2 id="people" className="ui-muted">
          People
        </h2>
        <ul className={styles.columns}>
          {people.map((p, i) => (
            <li key={i}>
              <p className="h2">{p.name}</p>
              <p className="ui-muted">{p.role}</p>
            </li>
          ))}
        </ul>
      </section>
    </>
  );
}
