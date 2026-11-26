"use client";

import Lenis from "lenis";
import "lenis/dist/lenis.css";
import { useEffect, useRef } from "react";

// Momentum (inertial) scrolling for mouse wheels and trackpads, via Lenis.
// The page still scrolls natively underneath (window scroll position, focus,
// find-in-page and browser history behave normally); Lenis only smooths wheel
// input. Touch keeps the device's own native momentum. Reduced motion → off.
export function SmoothScroll() {
  const lenisRef = useRef<Lenis | null>(null);

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    const lenis = new Lenis({
      autoRaf: true,
      lerp: 0.1,
      smoothWheel: true,
      syncTouch: false,
      // In-page anchor links glide too. Lenis honours the page's
      // scroll-padding-top (= nav height, globals.scss), so no extra offset.
      anchors: true,
      // A new page shouldn't inherit the previous page's inertia.
      stopInertiaOnNavigate: true,
    });
    lenisRef.current = lenis;
    const onTransitionScroll = (event: Event) => lenis.scrollTo((event as CustomEvent<number>).detail, { immediate: true, force: true });
    window.addEventListener("oblast:scroll", onTransitionScroll);

    return () => {
      window.removeEventListener("oblast:scroll", onTransitionScroll);
      lenis.destroy();
      lenisRef.current = null;
    };
  }, []);

  // Next owns normal navigation and native history restoration. The transition
  // controller explicitly synchronizes Lenis only for its covered navigations.
  return null;
}
