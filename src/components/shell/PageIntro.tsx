import type { ReactNode } from "react";
import styles from "./PageIntro.module.scss";

export function PageIntro({
  eyebrow,
  title,
  children,
}: {
  eyebrow: string;
  title: string;
  children?: ReactNode;
}) {
  return (
    <header className={styles.intro}>
      <p className="ui-muted">{eyebrow}</p>
      <h1 className="display">{title}</h1>
      {children && <div className={`${styles.body} lead`}>{children}</div>}
    </header>
  );
}
