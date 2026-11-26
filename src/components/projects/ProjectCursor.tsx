"use client";

import { usePathname } from "next/navigation";
import { useEffect, useRef, useSyncExternalStore } from "react";
import styles from "./ProjectCursor.module.scss";

// Content-aware cursor (spec §8). A dot follows the pointer; over a project it
// grows and a label stack opens from its right edge, first row level with it:
//   [ TITLE ][ CATEGORY ][ YEAR ][ N ]
//            [ DISCIPLINE ]
// Switching projects flips each box upward like a rolodex, swaps the text,
// then slides the new boxes in from the left with a staggered spring.
// Text and widths only change while every box is hidden.
//
// Everything is driven imperatively (refs, dataset, inline widths) from the
// pointer handler and one rAF loop — no React re-render while hovering.
// Purely decorative: aria-hidden, no focusable children; tiles keep their own
// accessible names and captions.

type Meta = {
  key: string;
  title: string;
  category: string;
  year: string;
  number: string;
  discipline: string;
};

const FINE = "(hover: hover) and (pointer: fine)";
const REDUCED = "(prefers-reduced-motion: reduce)";
const OUT_MS = 220;
const IN_MS = 360;
const STAGGER_MS = 35;
const EXIT_EASE = "cubic-bezier(0.4, 0, 1, 1)";
const ENTER_EASE = "cubic-bezier(0.22, 1.4, 0.36, 1)";
const CELL_PAD = 24; // horizontal padding of a label cell (12px each side)

function subscribeFine(onChange: () => void) {
  const mql = window.matchMedia(FINE);
  mql.addEventListener("change", onChange);
  return () => mql.removeEventListener("change", onChange);
}

function readMeta(el: HTMLElement): Meta {
  const d = el.dataset;
  return {
    key: `${d.cursorTitle}-${d.cursorNumber}`,
    title: d.cursorTitle ?? "",
    category: d.cursorCategory ?? "",
    year: d.cursorYear ?? "",
    number: d.cursorNumber ?? "",
    discipline: d.cursorDiscipline ?? "",
  };
}

const FIELDS = ["title", "category", "year", "number", "discipline"] as const;
type Field = (typeof FIELDS)[number];

export function ProjectCursor() {
  const enabled = useSyncExternalStore(
    subscribeFine,
    () => window.matchMedia(FINE).matches,
    () => false,
  );
  const pathname = usePathname();

  const rootRef = useRef<HTMLDivElement>(null);
  const labelsRef = useRef<HTMLDivElement>(null);
  const cellRefs = useRef<Partial<Record<Field, HTMLSpanElement | null>>>({});
  const textRefs = useRef<Partial<Record<Field, HTMLSpanElement | null>>>({});
  // Set by the main effect; lets the route effect clear the label stack.
  const resetRef = useRef<() => void>(() => {});

  // Hide the native cursor only while this cursor is active.
  useEffect(() => {
    if (!enabled) return;
    const html = document.documentElement;
    html.classList.add("has-custom-cursor");
    return () => html.classList.remove("has-custom-cursor");
  }, [enabled]);

  useEffect(() => {
    if (!enabled) return;
    const root = rootRef.current;
    const labels = labelsRef.current;
    if (!root || !labels) return;

    const reduced = window.matchMedia(REDUCED).matches;
    const target = { x: -100, y: -100 };
    const pos = { x: -100, y: -100 };
    let visible = false;
    let raf = 0;
    let last = performance.now();

    let tileEl: HTMLElement | null = null; // element under the pointer
    let shown: Meta | null = null; // what the label stack currently shows
    let sequence = 0;
    let exiting: Promise<void> | null = null;
    const animations = new Map<Field, Animation>();

    const setVisible = (v: boolean) => {
      if (v === visible) return;
      visible = v;
      root.dataset.hidden = v ? "false" : "true";
    };

    // Write the text, then size every box to it (category + discipline share
    // a column, so they share the wider of the two widths).
    const fill = (m: Meta) => {
      for (const f of FIELDS) {
        const t = textRefs.current[f];
        if (t) t.textContent = m[f];
      }
      const widthOf = (f: Field) => (textRefs.current[f]?.offsetWidth ?? 0) + CELL_PAD;
      const col = Math.max(widthOf("category"), m.discipline ? widthOf("discipline") : 0);
      const widths: Record<Field, number> = {
        title: widthOf("title"),
        category: col,
        year: widthOf("year"),
        number: Math.max(26, (textRefs.current.number?.offsetWidth ?? 0) + 12),
        discipline: m.discipline ? col : 0,
      };
      for (const f of FIELDS) {
        const c = cellRefs.current[f];
        if (c) c.style.width = `${widths[f]}px`;
      }
      labels.dataset.noDiscipline = m.discipline ? "false" : "true";
    };

    // Explicit keyframes keep the full duration even when an arrival is
    // interrupted. CSS transition reversal would shorten the next exit.
    const slide = (direction: "in" | "out") => {
      const finished: Promise<Animation>[] = [];
      for (const f of FIELDS) {
        const box = cellRefs.current[f]?.firstElementChild as HTMLElement | null;
        if (!box) continue;
        const current = getComputedStyle(box);
        const from = current.transform;
        const opacity = current.opacity;
        animations.get(f)?.cancel();
        const leaving = direction === "out";
        const to = leaving ? "translateY(-65%) rotateX(95deg)" : "translateX(0)";
        box.style.transform = to;
        box.style.opacity = leaving ? "0" : "1";
        if (reduced) continue;
        const column = f === "discipline" ? 1 : FIELDS.indexOf(f);
        const animation = box.animate(
          leaving
            ? [
                { transform: from, opacity },
                { transform: to, opacity: 0 },
              ]
            : [
                { transform: "translateX(-105%)", opacity: 1 },
                { transform: to, opacity: 1 },
              ],
          {
            duration: direction === "out" ? OUT_MS : IN_MS,
            delay: direction === "in" ? column * STAGGER_MS : 0,
            easing: direction === "out" ? EXIT_EASE : ENTER_EASE,
            fill: "backwards",
          },
        );
        animations.set(f, animation);
        finished.push(animation.finished);
      }
      return Promise.allSettled(finished).then(() => {});
    };

    // Every request waits for the same complete flip. Only the latest project
    // may enter, so rapid pointer changes cannot reveal stale text or widths.
    const show = async (m: Meta | null) => {
      const request = ++sequence;
      root.dataset.state = m ? "project" : "idle";
      if (shown && m?.key === shown.key && labels.dataset.phase === "in") return;

      if (labels.dataset.phase === "in") {
        labels.dataset.phase = "out";
        exiting = slide("out");
      }
      if (exiting) await exiting;
      if (request !== sequence) return;
      exiting = null;
      if (!m) return;

      fill(m);
      shown = m;
      labels.dataset.phase = "in";
      void slide("in");
    };

    // Check the actual text rectangles so blank space inside a paragraph
    // does not enlarge the ball. Links and buttons also get the larger ball.
    const isOverText = (el: Element | null) => {
      if (!el) return false;
      if (el.closest("a, button, [role='button']")) return true;
      const range = document.createRange();
      for (const node of el.childNodes) {
        if (node.nodeType !== Node.TEXT_NODE || !node.textContent?.trim()) continue;
        range.selectNodeContents(node);
        for (const rect of range.getClientRects()) {
          if (
            target.x >= rect.left && target.x <= rect.right &&
            target.y >= rect.top && target.y <= rect.bottom
          ) return true;
        }
      }
      return false;
    };

    // Resolve what is under the pointer: project tile or text.
    const resolve = (el: Element | null) => {
      const tile = (el?.closest("[data-cursor='project']") as HTMLElement | null) ?? null;
      if (tile !== tileEl) {
        tileEl = tile;
        show(tile ? readMeta(tile) : null);
      }
      root.dataset.text = String(isOverText(el));
      root.dataset.grid = String(Boolean(el?.closest(".project-grid")));
    };

    resetRef.current = () => {
      tileEl = null;
      root.dataset.text = "false";
      root.dataset.grid = "false";
      show(null);
    };

    const onMove = (e: PointerEvent) => {
      if (e.pointerType === "touch") {
        setVisible(false);
        return;
      }
      target.x = e.clientX;
      target.y = e.clientY;
      if (!visible) {
        // Appear in place rather than sliding in from the last position.
        pos.x = target.x;
        pos.y = target.y;
        setVisible(true);
      }
      resolve(e.target as Element);
    };

    // Content can move under a still pointer (scroll) — re-check the element.
    const onScroll = () => {
      if (!visible) return;
      resolve(document.elementFromPoint(target.x, target.y));
    };
    const onLeave = (e: MouseEvent) => {
      if (!e.relatedTarget) setVisible(false);
    };
    const onKey = () => setVisible(false);
    const onBlur = () => setVisible(false);

    const tick = (now: number) => {
      const dt = Math.min((now - last) / 1000, 0.1);
      last = now;
      // Softer trail behind the pointer (frame-rate independent).
      const k = reduced ? 1 : 1 - Math.exp(-dt * 14);
      pos.x += (target.x - pos.x) * k;
      pos.y += (target.y - pos.y) * k;
      root.style.transform = `translate3d(${pos.x}px, ${pos.y}px, 0)`;

      raf = requestAnimationFrame(tick);
    };

    root.dataset.hidden = "true";
    root.dataset.state = "idle";
    root.dataset.text = "false";
    root.dataset.grid = "false";
    labels.dataset.phase = "out";
    window.addEventListener("pointermove", onMove, { passive: true });
    window.addEventListener("scroll", onScroll, { passive: true });
    document.addEventListener("mouseout", onLeave);
    window.addEventListener("keydown", onKey);
    window.addEventListener("blur", onBlur);
    raf = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(raf);
      sequence++;
      for (const animation of animations.values()) animation.cancel();
      resetRef.current = () => {};
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("scroll", onScroll);
      document.removeEventListener("mouseout", onLeave);
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("blur", onBlur);
    };
  }, [enabled]);

  // New route: drop any label from the previous page.
  useEffect(() => {
    resetRef.current();
  }, [pathname]);

  if (!enabled) return null;

  // Slot (clips) › box (colour, slides vertically) › text.
  const cell = (f: Field, className: string) => (
    <span
      ref={(el) => {
        cellRefs.current[f] = el;
      }}
      className={`${styles.cell} ${className}`}
    >
      <span className={styles.box}>
        <span
          ref={(el) => {
            textRefs.current[f] = el;
          }}
          className={styles.text}
        />
      </span>
    </span>
  );

  return (
    <div ref={rootRef} className={`${styles.root} ui`} aria-hidden="true">
      <div className={styles.dot} />
      <div ref={labelsRef} className={styles.labels}>
        {cell("title", styles.title)}
        {cell("category", styles.category)}
        {cell("year", styles.year)}
        {cell("number", styles.number)}
        {cell("discipline", styles.discipline)}
      </div>
    </div>
  );
}
