"use client";

import { type RefObject, useEffect, useState, useSyncExternalStore } from "react";

function subscribeDocument(onChange: () => void) {
  document.addEventListener("visibilitychange", onChange);
  window.addEventListener("oblast:transition", onChange);
  return () => {
    document.removeEventListener("visibilitychange", onChange);
    window.removeEventListener("oblast:transition", onChange);
  };
}

/**
 * True while the element is near the viewport AND the tab is visible.
 * Used to pause video decoding and the WebGL frame loop when nobody can see them.
 */
export function useVisibility(ref: RefObject<Element | null>, rootMargin = "100px") {
  const [inView, setInView] = useState(false);

  const docVisible = useSyncExternalStore(
    subscribeDocument,
    () => document.visibilityState === "visible" &&
      (document.documentElement.dataset.datamosh !== "active" ||
        (document.documentElement.dataset.datamoshReveal === "true" && document.documentElement.dataset.datamoshMobile !== "true")),
    () => false,
  );

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(([entry]) => setInView(entry.isIntersecting), {
      rootMargin,
    });
    io.observe(el);
    return () => io.disconnect();
  }, [ref, rootMargin]);

  return inView && docVisible;
}
