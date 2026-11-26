"use client";

// Client-only module: load with dynamic(() => import(...), { ssr: false }).
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { type RefObject, useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { type VideoStatus, useVideoSource } from "@/hooks/useVideoSource";
import type { CubeConfig, CubeSource } from "@/lib/cube-config";
import { DEBUG_H, DEBUG_W, drawDebugFrame } from "./debugTexture";
import { VideoCube } from "./VideoCube";

export type VideoCubeCanvasProps = {
  source: CubeSource;
  config: CubeConfig;
  /** Element is on screen and the tab is visible. */
  active: boolean;
  /** User pause / blocked autoplay: stop rotation and video together. */
  paused: boolean;
  onReady: () => void;
  onVideoStatus: (s: VideoStatus) => void;
  onContextLost: () => void;
};

type InnerProps = {
  config: CubeConfig;
  animate: boolean;
  lowQuality: boolean;
  pointerRef: RefObject<{ x: number; y: number }>;
};

/** Fit the orthographic frustum to the cube's worst-case silhouette. */
function FitCamera({ cubeSize }: { cubeSize: number }) {
  const get = useThree((s) => s.get);
  const width = useThree((s) => s.size.width);
  const height = useThree((s) => s.size.height);

  useEffect(() => {
    const { camera, invalidate } = get();
    // Silhouette ≤ size·√3 at any orientation, plus float/tilt headroom.
    camera.zoom = Math.min(width, height) / (cubeSize * 1.9);
    camera.lookAt(0, 0, 0);
    camera.updateProjectionMatrix();
    invalidate();
  }, [get, width, height, cubeSize]);

  return null;
}

function texturePrep(t: THREE.Texture) {
  t.colorSpace = THREE.SRGBColorSpace;
  t.generateMipmaps = false;
  t.minFilter = THREE.LinearFilter;
  return t;
}

function DebugSource({ onReady, ...props }: InnerProps & { onReady: () => void }) {
  const textureRef = useRef<THREE.Texture | null>(null);
  const ctxRef = useRef<CanvasRenderingContext2D | null>(null);
  const clockRef = useRef(0);
  const invalidate = useThree((s) => s.invalidate);

  useEffect(() => {
    const canvas = document.createElement("canvas");
    canvas.width = DEBUG_W;
    canvas.height = DEBUG_H;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const texture = texturePrep(new THREE.CanvasTexture(canvas));
    drawDebugFrame(ctx, 0);
    texture.needsUpdate = true;
    textureRef.current = texture;
    ctxRef.current = ctx;
    invalidate();
    return () => {
      texture.dispose();
      textureRef.current = null;
      ctxRef.current = null;
    };
  }, [invalidate]);

  useFrame((_, delta) => {
    const ctx = ctxRef.current;
    const texture = textureRef.current;
    if (!props.animate || !ctx || !texture) return;
    clockRef.current += Math.min(delta, 0.1);
    drawDebugFrame(ctx, clockRef.current);
    texture.needsUpdate = true;
  });

  // The pattern is "ready" on the first frame actually rendered with it.
  return <VideoCube textureRef={textureRef} onTextured={onReady} {...props} />;
}

function VideoSource({
  src,
  playing,
  onReady,
  onVideoStatus,
  ...props
}: InnerProps & {
  src: string;
  playing: boolean;
  onReady: () => void;
  onVideoStatus: (s: VideoStatus) => void;
}) {
  const textureRef = useRef<THREE.Texture | null>(null);
  const invalidate = useThree((s) => s.invalidate);
  // Video is "ready" on its `playing` event (a decoded frame exists), which
  // always follows the texture effect below.
  const videoRef = useVideoSource(src, {
    playing,
    onStatus: (s) => {
      onVideoStatus(s);
      if (s === "playing") onReady();
    },
  });

  // One VideoTexture for the one decoder; three refreshes it per video frame.
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    const texture = texturePrep(new THREE.VideoTexture(video));
    textureRef.current = texture;
    invalidate();
    return () => {
      texture.dispose();
      textureRef.current = null;
    };
  }, [videoRef, src, invalidate]);

  return <VideoCube textureRef={textureRef} {...props} />;
}

function detectLowTier() {
  const coarse = window.matchMedia("(pointer: coarse)").matches;
  const cores = navigator.hardwareConcurrency ?? 8;
  return coarse || cores <= 4;
}

export default function VideoCubeCanvas({
  source,
  config,
  active,
  paused,
  onReady,
  onVideoStatus,
  onContextLost,
}: VideoCubeCanvasProps) {
  const lowQuality = useMemo(() => detectLowTier(), []);
  const pointerRef = useRef({ x: 0, y: 0 });

  // Pointer parallax from the whole window (fine pointers only), via ref.
  useEffect(() => {
    if (!window.matchMedia("(pointer: fine)").matches) return;
    const onMove = (e: PointerEvent) => {
      pointerRef.current.x = (e.clientX / window.innerWidth) * 2 - 1;
      pointerRef.current.y = (e.clientY / window.innerHeight) * 2 - 1;
    };
    window.addEventListener("pointermove", onMove, { passive: true });
    return () => window.removeEventListener("pointermove", onMove);
  }, []);

  const animate = active && !paused;
  // Running while animated; on demand while paused (still frame, re-renders on
  // resize/config); fully stopped while offscreen or the tab is hidden.
  const frameloop = !active ? "never" : paused ? "demand" : "always";

  const inner: InnerProps = { config, animate, lowQuality, pointerRef };

  return (
    <Canvas
      orthographic
      camera={{ position: [4, 3, 6], zoom: 100, near: 0.1, far: 50 }}
      dpr={lowQuality ? [1, 1.25] : [1, 1.5]}
      flat
      gl={{ alpha: true, antialias: true, powerPreference: "high-performance" }}
      frameloop={frameloop}
      aria-hidden="true"
      onCreated={({ gl }) => {
        gl.setClearColor(0x000000, 0);
        gl.domElement.addEventListener("webglcontextlost", onContextLost, { once: true });
      }}
    >
      <FitCamera cubeSize={config.size} />
      {source.kind === "debug" ? (
        <DebugSource {...inner} onReady={onReady} />
      ) : (
        <VideoSource
          key={source.src}
          {...inner}
          src={source.src}
          playing={animate}
          onReady={onReady}
          onVideoStatus={onVideoStatus}
        />
      )}
    </Canvas>
  );
}
