"use client";

import dynamic from "next/dynamic";
import { Component, type ReactNode, useCallback, useRef, useState, useSyncExternalStore } from "react";
import { useReducedMotion } from "@/hooks/useReducedMotion";
import type { VideoStatus } from "@/hooks/useVideoSource";
import { useVisibility } from "@/hooks/useVisibility";
import { type CubeConfig, type CubeSource, defaultCubeConfig } from "@/lib/cube-config";
import { HeroPoster } from "./HeroPoster";
import styles from "./HeroCube.module.scss";

// WebGL stays out of the server bundle and off the critical path.
const VideoCubeCanvas = dynamic(() => import("./VideoCubeCanvas"), { ssr: false });

// ── Capability checks (client snapshots; server always says "static") ──────
let webglSupport: boolean | undefined;
function hasWebGL() {
  if (webglSupport === undefined) {
    try {
      const gl = document.createElement("canvas").getContext("webgl2");
      webglSupport = !!gl;
      gl?.getExtension("WEBGL_lose_context")?.loseContext();
    } catch {
      webglSupport = false;
    }
  }
  return webglSupport;
}

function prefersSaveData() {
  const nav = navigator as Navigator & { connection?: { saveData?: boolean } };
  return nav.connection?.saveData === true;
}

const noopSubscribe = () => () => {};

function useCanRender3D() {
  return useSyncExternalStore(
    noopSubscribe,
    () => hasWebGL() && !prefersSaveData(),
    () => false,
  );
}

// ── Error boundary: any WebGL/three failure leaves the poster in place ─────
class CubeBoundary extends Component<{ children: ReactNode; onError: () => void }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  componentDidCatch(error: unknown) {
    console.warn("[HeroCube] WebGL cube failed; showing poster.", error);
    this.props.onError();
  }
  render() {
    return this.state.failed ? null : this.props.children;
  }
}

type Props = {
  source: CubeSource;
  config?: CubeConfig;
  className?: string;
};

/**
 * Signature hero cube. The static poster renders first (and on the server);
 * the live canvas fades in over it only once it has a real frame.
 * Falls back to the poster for reduced motion, data saver, no WebGL,
 * context loss, render errors and video errors.
 */
export function HeroCube({ source, config = defaultCubeConfig, className }: Props) {
  const root = useRef<HTMLDivElement>(null);
  const reducedMotion = useReducedMotion();
  const canRender3D = useCanRender3D();
  const active = useVisibility(root);

  const [userPaused, setUserPaused] = useState(false);
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(false);
  const [videoStatus, setVideoStatus] = useState<VideoStatus | null>(null);

  const live = canRender3D && !reducedMotion && !failed && videoStatus !== "error";
  const blocked = videoStatus === "blocked";
  const paused = userPaused || blocked;
  const showCanvas = live && ready;

  const handleReady = useCallback(() => setReady(true), []);
  const handleFail = useCallback(() => setFailed(true), []);
  const handleVideoStatus = useCallback((s: VideoStatus) => setVideoStatus(s), []);

  const togglePause = () => {
    if (blocked) {
      // Autoplay was refused: this click is the user gesture that allows play().
      setVideoStatus(null);
      setUserPaused(false);
      return;
    }
    setUserPaused((p) => !p);
  };

  return (
    <div ref={root} className={`${styles.root} ${className ?? ""}`} data-state={showCanvas ? "live" : "poster"}>
      <div className={styles.poster} aria-hidden="true">
        <HeroPoster />
      </div>

      {live && (
        <div className={styles.canvas}>
          <CubeBoundary onError={handleFail}>
            <VideoCubeCanvas
              source={source}
              config={config}
              active={active}
              paused={paused}
              onReady={handleReady}
              onVideoStatus={handleVideoStatus}
              onContextLost={handleFail}
            />
          </CubeBoundary>
        </div>
      )}

      {/* Ongoing motion > 5s needs a visible pause control (WCAG 2.2.2). */}
      {showCanvas && (
        <button
          type="button"
          className={`${styles.toggle} ui`}
          onClick={togglePause}
          aria-pressed={blocked ? undefined : userPaused}
        >
          {blocked ? "Play" : userPaused ? "Play motion" : "Pause motion"}
        </button>
      )}
    </div>
  );
}
