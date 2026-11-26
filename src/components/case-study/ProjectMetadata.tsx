import type { Project } from "@/lib/content-schema";
import styles from "./CaseStudy.module.scss";

export function ProjectMetadata({ project }: { project: Project }) {
  // Only render fields that exist — never invent clients, roles or metrics.
  const fields: { term: string; value?: string }[] = [
    { term: "Project", value: project.title },
    { term: "Category", value: project.category },
    { term: "Year", value: String(project.year) },
    { term: "Client", value: project.client },
    { term: "Role", value: project.role },
    { term: "Disciplines", value: project.disciplines.join(", ") },
    { term: "Stack", value: project.stack?.join(", ") },
    { term: "Collaborators", value: project.collaborators?.join(", ") },
  ];

  return (
    <section className={styles.meta} aria-label="Project details">
      <dl className={styles.fields}>
        {fields
          .filter((f) => f.value)
          .map((f) => (
            <div key={f.term} className={styles.field}>
              <dt className="ui-muted">{f.term}</dt>
              <dd>{f.value}</dd>
            </div>
          ))}
      </dl>
      <div className={`${styles.description} prose`}>
        <p className="lead">{project.summary}</p>
        <p>{project.description}</p>
      </div>
    </section>
  );
}
