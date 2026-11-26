"use client";

import { TransitionLink as Link } from "@/components/transitions/TransitionLink";
import { usePathname } from "next/navigation";
import { nav } from "@/lib/site";
import styles from "./SiteHeader.module.scss";

function isActive(pathname: string, href: string) {
  // The home page is the project index, so "Projects" is current there too.
  if (href === "/work" && pathname === "/") return true;
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function NavLinks() {
  const pathname = usePathname();

  return (
    <ul className={styles.links}>
      {nav.map((item) => (
        <li key={item.href}>
          <Link
            href={item.href}
            className={styles.link}
            aria-current={isActive(pathname, item.href) ? "page" : undefined}
          >
            {item.label}
          </Link>
        </li>
      ))}
    </ul>
  );
}
