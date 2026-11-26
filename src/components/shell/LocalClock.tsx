"use client";

import { useSyncExternalStore } from "react";

// Studio-local clock. Lives in its own store so the once-per-second tick
// re-renders only this component, never app state.

function subscribe(onTick: () => void) {
  const id = window.setInterval(onTick, 1000);
  return () => window.clearInterval(id);
}

const getSecond = () => Math.floor(Date.now() / 1000);
const getServerSecond = () => null;

export function LocalClock({ timeZone, label }: { timeZone: string; label: string }) {
  const second = useSyncExternalStore(subscribe, getSecond, getServerSecond);

  const time =
    second === null
      ? "--:--:--"
      : new Intl.DateTimeFormat("en-GB", {
          timeZone,
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit",
          hour12: false,
        }).format(second * 1000);

  return (
    <span>
      <span aria-hidden="true">{label} </span>
      {/* Fixed-width digits so ticking never shifts layout */}
      <time
        style={{ fontVariantNumeric: "tabular-nums" }}
        aria-label={`Studio local time, ${label}`}
        suppressHydrationWarning
      >
        {time}
      </time>
    </span>
  );
}
