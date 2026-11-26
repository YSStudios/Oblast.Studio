"use client";

import { createContext, type ReactNode, useCallback, useContext, useEffect, useMemo, useRef } from "react";
import { useRouter } from "next/navigation";
import dynamic from "next/dynamic";
import { getDebugSettings, subscribeDebugSettings } from "./debug-settings";
import { captureViewport, waitForPrimaryMedia, type TransitionVisual } from "./capture";
import type { DatamoshEngine } from "./DatamoshEngine";
import { DatamoshOverlay } from "./DatamoshOverlay";
import { transitionConfig } from "./presets";

const DatamoshDebug = dynamic(() => import("./DatamoshDebug"), { ssr: false });

let engineModule: Promise<typeof import("./DatamoshEngine")> | undefined;
function loadEngine() {
  return engineModule ??= import("./DatamoshEngine").catch((error) => { engineModule = undefined; throw error; });
}
function allowed() {
  const connection = (navigator as Navigator & { connection?: { saveData?: boolean } }).connection;
  return transitionConfig.enabled && (process.env.NODE_ENV !== "development" || getDebugSettings().enabled) && !connection?.saveData && !matchMedia("(prefers-reduced-motion: reduce)").matches;
}

type Request = { id: number; href: string; path: string; source: string; pushed: boolean; resolving: boolean; timer: number; visuals: TransitionVisual[] };
type Controller = { navigate(href: string, link: HTMLAnchorElement): boolean; warm(): void; ready(path: string): void };
const Context = createContext<Controller | null>(null);
export const usePageTransition = () => useContext(Context);

export function TransitionProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const canvas = useRef<HTMLCanvasElement>(null);
  const overlay = useRef<HTMLDivElement>(null);
  const engine = useRef<DatamoshEngine | null>(null);
  const active = useRef<Request | null>(null);
  const counter = useRef(0);
  const idleTimer = useRef(0);
  const archiveScroll = useRef(new Map<string, number>());

  const releaseEngine = useCallback(() => {
    engine.current?.dispose(); engine.current = null;
  }, []);

  const finish = useCallback((focus = false) => {
    const request = active.current;
    active.current = null;
    engine.current?.stop();
    if (request) {
      clearTimeout(request.timer);
      for (const visual of request.visuals) visual.dispose();
    }
    if (overlay.current) overlay.current.dataset.active = "false";
    delete document.documentElement.dataset.datamosh;
    delete document.documentElement.dataset.datamoshReveal;
    window.dispatchEvent(new CustomEvent("oblast:transition", { detail: false }));
    if (focus && request?.pushed && location.pathname === request.path) {
      const heading = [...document.querySelectorAll<HTMLElement>("main h1")].find((el) => el.getClientRects().length > 0) ?? document.getElementById("main");
      heading?.setAttribute("tabindex", "-1");
      heading?.focus({ preventScroll: true });
    }
    clearTimeout(idleTimer.current);
    idleTimer.current = window.setTimeout(releaseEngine, transitionConfig.idleRelease);
  }, [releaseEngine]);

  const warm = useCallback(() => {
    if (!allowed()) return;
    void loadEngine().then(({ DatamoshEngine }) => {
      if (engine.current || !canvas.current || active.current) return;
      try {
        engine.current = new DatamoshEngine(canvas.current, () => { finish(); releaseEngine(); });
        engine.current.prewarm();
        clearTimeout(idleTimer.current);
        idleTimer.current = window.setTimeout(releaseEngine, transitionConfig.idleRelease);
      } catch { releaseEngine(); }
    }).catch(() => {});
  }, [finish, releaseEngine]);

  const navigate = useCallback((href: string, link: HTMLAnchorElement) => {
    if (!allowed() || !canvas.current) return false;
    if (active.current) return true; // One request; repeated clicks never push twice.
    const url = new URL(href, location.href);
    if (url.origin !== location.origin || url.hash || url.pathname === location.pathname || url.pathname.startsWith("/dev/")) return false;
    clearTimeout(idleTimer.current);
    const request: Request = { id: ++counter.current, href: url.pathname + url.search, path: url.pathname, source: location.pathname, pushed: false, resolving: false, timer: 0, visuals: [] };
    active.current = request;
    if (request.source === "/" || request.source === "/work") archiveScroll.current.set(request.source, scrollY);
    const current = () => active.current?.id === request.id;
    const fallback = () => {
      if (!current()) return;
      const push = !request.pushed;
      finish();
      if (push) router.push(request.href);
    };
    const started = performance.now();
    request.timer = window.setTimeout(fallback, transitionConfig.captureBudget);
    void loadEngine().then(({ DatamoshEngine }) => {
      if (!current()) return;
      if (performance.now() - started > transitionConfig.captureBudget) { fallback(); return; }
      const visual = captureViewport(link.closest("[data-cursor='project']"));
      request.visuals.push(visual);
      engine.current ??= new DatamoshEngine(canvas.current!, () => { fallback(); releaseEngine(); });
      if (!current()) return;
      const tuning = process.env.NODE_ENV === "development" ? getDebugSettings() : undefined;
      if (tuning) {
        engine.current.feedbackEnabled = tuning.feedbackEnabled;
        engine.current.debug = tuning.view;
      }
      engine.current.start(visual, () => {
        if (!current() || request.pushed) return;
        request.pushed = true;
        clearTimeout(request.timer);
        request.timer = window.setTimeout(() => finish(), transitionConfig.deadline);
        router.push(request.href, { scroll: false });
      }, tuning);
      clearTimeout(request.timer);
      // Preparing/covering has its own safety deadline as well as navigation.
      request.timer = window.setTimeout(fallback, 500);
      if (overlay.current) overlay.current.dataset.active = "true";
      document.documentElement.dataset.datamosh = "active";
      window.dispatchEvent(new CustomEvent("oblast:transition", { detail: true }));
    }).catch(fallback);
    return true;
  }, [finish, releaseEngine, router]);

  const ready = useCallback((path: string) => {
    const request = active.current;
    if (!request) return;
    if (path !== request.path) {
      if (path !== request.source) finish(); // Redirect/error/unexpected route.
      return;
    }
    if (!request.pushed || request.resolving) return;
    request.resolving = true;
    const y = archiveScroll.current.get(path) ?? 0;
    window.scrollTo({ top: y, behavior: "instant" });
    window.dispatchEvent(new CustomEvent("oblast:scroll", { detail: y }));
    void waitForPrimaryMedia().then(() => {
      if (active.current?.id !== request.id || location.pathname !== path) return;
      try {
        const incoming = captureViewport();
        request.visuals.push(incoming);
        engine.current?.resolve(incoming,
          () => { if (active.current?.id === request.id) finish(true); },
          () => {
            if (active.current?.id !== request.id) return;
            document.documentElement.dataset.datamoshReveal = "true";
            // Resume destination video/hero behind the dissolving canvas so
            // its first live frame does not wait for the overlay to disappear.
            window.dispatchEvent(new CustomEvent("oblast:transition", { detail: true }));
          },
        );
      } catch { finish(true); }
    });
  }, [finish]);

  useEffect(() => {
    const cancel = () => {
      if (active.current) finish();
      releaseEngine();
    };
    const visibility = () => { if (document.hidden) cancel(); };
    const key = (e: KeyboardEvent) => { if (e.key === "Escape") cancel(); };
    const guard = (e: Event) => {
      if ((e.target as Element | null)?.closest("[data-datamosh-debug]")) return;
      if (!active.current?.pushed) return;
      e.preventDefault();
      if (e.type === "click") e.stopImmediatePropagation();
    };
    const unsubscribeTuning = subscribeDebugSettings(() => {
      const tuning = getDebugSettings();
      if (!tuning.enabled) { cancel(); return; }
      engine.current?.configure(tuning, tuning.feedbackEnabled, tuning.view);
    });
    const motion = matchMedia("(prefers-reduced-motion: reduce)");
    const motionChanged = () => { if (motion.matches) cancel(); };
    window.addEventListener("popstate", cancel);
    window.addEventListener("resize", cancel);
    window.addEventListener("keydown", key);
    window.addEventListener("error", cancel);
    document.addEventListener("visibilitychange", visibility);
    document.addEventListener("click", guard, true);
    document.addEventListener("wheel", guard, { passive: false });
    document.addEventListener("touchmove", guard, { passive: false });
    motion.addEventListener("change", motionChanged);
    return () => {
      unsubscribeTuning();
      finish(); clearTimeout(idleTimer.current); releaseEngine();
      window.removeEventListener("popstate", cancel);
      window.removeEventListener("resize", cancel);
      window.removeEventListener("keydown", key);
      window.removeEventListener("error", cancel);
      document.removeEventListener("visibilitychange", visibility);
      document.removeEventListener("click", guard, true);
      document.removeEventListener("wheel", guard);
      document.removeEventListener("touchmove", guard);
      motion.removeEventListener("change", motionChanged);
    };
  }, [finish, releaseEngine]);

  const value = useMemo(() => ({ navigate, warm, ready }), [navigate, warm, ready]);
  return <Context.Provider value={value}>{children}<DatamoshOverlay canvasRef={canvas} overlayRef={overlay} />{process.env.NODE_ENV === "development" && <DatamoshDebug />}</Context.Provider>;
}
