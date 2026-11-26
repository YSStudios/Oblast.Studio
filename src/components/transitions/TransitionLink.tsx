"use client";

import Link from "next/link";
import type { ComponentProps } from "react";
import { usePageTransition } from "./TransitionProvider";

type Props = Omit<ComponentProps<typeof Link>, "href"> & { href: string };

// Keep a real Next Link, SSR href, native modified clicks and automatic prefetch.
export function TransitionLink({ href, onClick, onMouseEnter, onFocus, ...props }: Props) {
  const transition = usePageTransition();
  return <Link {...props} href={href}
    onMouseEnter={(e) => { onMouseEnter?.(e); transition?.warm(); }}
    onFocus={(e) => { onFocus?.(e); transition?.warm(); }}
    onClick={(e) => {
      onClick?.(e);
      const link = e.currentTarget;
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey ||
          link.hasAttribute("download") || (link.target && link.target !== "_self") || props.replace || props.scroll === false || props.onNavigate) return;
      if (transition?.navigate(href, link)) e.preventDefault();
    }}
  />;
}
