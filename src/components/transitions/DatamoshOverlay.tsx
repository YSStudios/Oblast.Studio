import type { RefObject } from "react";
import styles from "./DatamoshOverlay.module.scss";

export function DatamoshOverlay({ canvasRef, overlayRef }: {
  canvasRef: RefObject<HTMLCanvasElement | null>;
  overlayRef: RefObject<HTMLDivElement | null>;
}) {
  return <div ref={overlayRef} className={styles.overlay} data-active="false" aria-hidden="true"><canvas ref={canvasRef} /></div>;
}
