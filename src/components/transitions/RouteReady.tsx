"use client";

import { usePathname } from "next/navigation";
import { useEffect } from "react";
import { usePageTransition } from "./TransitionProvider";

export function RouteReady() {
  const pathname = usePathname();
  const transition = usePageTransition();
  useEffect(() => {
    let second = 0;
    const first = requestAnimationFrame(() => {
      second = requestAnimationFrame(() => transition?.ready(pathname));
    });
    return () => { cancelAnimationFrame(first); cancelAnimationFrame(second); };
  }, [pathname, transition]);
  return null;
}
