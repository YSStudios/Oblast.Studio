"use client";

// Client-only module: load with dynamic(() => import(...), { ssr: false }).
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { type PointerEvent as ReactPointerEvent, type RefObject, useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { type VideoStatus, useVideoSource } from "@/hooks/useVideoSource";
import { CANVAS_BLEED, type CubeConfig, type CubeSource, minDimension } from "@/lib/cube-config";
import { DEBUG_H, DEBUG_W, drawDebugFrame } from "./debugTexture";
import { VideoChain } from "./VideoChain";
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

/** World-space corners of the posed slab (its glow shell included). */
function slabCorners(c: CubeConfig) {
  const grow = c.glowStrength > 0 ? minDimension(c) * c.glowSize * 2 : 0;
  const pose = new THREE.Euler(c.pitch, c.yaw, 0);
  const pts: THREE.Vector3[] = [];
  for (const sx of [-1, 1])
    for (const sy of [-1, 1])
      for (const sz of [-1, 1])
        pts.push(
          new THREE.Vector3(
            (sx * (c.width + grow)) / 2,
            (sy * (c.height + grow)) / 2,
            (sz * (c.depth + grow)) / 2,
          ).applyEuler(pose),
        );
  return pts;
}

/**
 * Fit the orthographic frustum to a set of world-space points: project them
 * onto the camera's right/up axes and fit width and height independently,
 * centred on the points' middle. With `spinRadius`, fit a circle of that
 * radius instead (shape rotating freely).
 */
function FitCamera({ points, spinRadius }: { points: THREE.Vector3[]; spinRadius?: number }) {
  const get = useThree((s) => s.get);
  const width = useThree((s) => s.size.width);
  const height = useThree((s) => s.size.height);

  useEffect(() => {
    const { camera, invalidate } = get();
    camera.lookAt(0, 0, 0);
    camera.updateMatrixWorld();
    const right = new THREE.Vector3().setFromMatrixColumn(camera.matrixWorld, 0);
    const up = new THREE.Vector3().setFromMatrixColumn(camera.matrixWorld, 1);

    let halfX: number;
    let halfY: number;
    if (spinRadius) {
      halfX = halfY = spinRadius;
    } else {
      let minX = Infinity;
      let maxX = -Infinity;
      let minY = Infinity;
      let maxY = -Infinity;
      for (const p of points) {
        const x = p.dot(right);
        const y = p.dot(up);
        minX = Math.min(minX, x);
        maxX = Math.max(maxX, x);
        minY = Math.min(minY, y);
        maxY = Math.max(maxY, y);
      }
      // Symmetric about the origin (the shape is centred there).
      halfX = Math.max(Math.abs(minX), Math.abs(maxX));
      halfY = Math.max(Math.abs(minY), Math.abs(maxY));
    }

    const margin = 1.05; // headroom for pointer tilt + float
    // Fit to the stage, not the bleed area around it.
    const stageW = width / (1 + 2 * CANVAS_BLEED.x);
    const stageH = height / (1 + 2 * CANVAS_BLEED.y);
    camera.zoom = Math.min(stageW / (2 * halfX * margin), stageH / (2 * halfY * margin));
    camera.updateProjectionMatrix();
    invalidate();
  }, [get, width, height, points, spinRadius]);

  return null;
}

/**
 * Perspective camera for the chain: placed and aimed from config (so the lab
 * can tune it live). No fitting — the run deliberately bleeds off the frame.
 */
function CameraRig({
  fov,
  position,
  target,
}: {
  fov: number;
  position: [number, number, number];
  target: [number, number, number];
}) {
  const get = useThree((s) => s.get);
  const [px, py, pz] = position;
  const [tx, ty, tz] = target;

  useEffect(() => {
    const { camera, invalidate } = get();
    camera.position.set(px, py, pz);
    camera.lookAt(tx, ty, tz);
    if (camera instanceof THREE.PerspectiveCamera) {
      camera.fov = fov;
      camera.updateProjectionMatrix();
    }
    invalidate();
  }, [get, fov, px, py, pz, tx, ty, tz]);

  return null;
}

/** The hero shape for the current config: the glass chain or the single slab. */
function HeroShape(props: InnerProps & { textureRef: RefObject<THREE.Texture | null>; onTextured?: () => void }) {
  return props.config.shape === "chain" ? <VideoChain {...props} /> : <VideoCube {...props} />;
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
  return <HeroShape textureRef={textureRef} onTextured={onReady} {...props} />;
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
    playbackRate: props.config.playbackRate,
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

  return <HeroShape textureRef={textureRef} {...props} />;
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

  // Hover turn: while a mouse/pen is over the shape's stage, aim toward it
  // (-1…1 across the stage); on leave, ease back to rest. Touch never steers it.
  const onPointerMove = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (e.pointerType === "touch") return;
    const rect = e.currentTarget.getBoundingClientRect();
    pointerRef.current.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
    pointerRef.current.y = ((e.clientY - rect.top) / rect.height) * 2 - 1;
  };
  const onPointerLeave = () => {
    pointerRef.current.x = 0;
    pointerRef.current.y = 0;
  };

  const animate = active && !paused;
  // Running while animated; on demand while paused (still frame, re-renders on
  // resize/config); fully stopped while offscreen or the tab is hidden.
  const frameloop = !active ? "never" : paused ? "demand" : "always";

  const inner: InnerProps = { config, animate, lowQuality, pointerRef };

  const isChain = config.shape === "chain";

  // Slab only: points the orthographic camera must keep in view (glow shell
  // included). A freely rotating slab fits its diagonal instead.
  const fitPoints = useMemo(() => slabCorners(config), [config]);
  const spinRadius =
    !isChain && (config.rotationSpeed > 0 || config.tumble)
      ? Math.hypot(config.width, config.height, config.depth) / 2
      : undefined;

  return (
    <Canvas
      // R3F picks the camera type on mount, so remount when the shape changes.
      key={isChain ? "perspective" : "orthographic"}
      orthographic={!isChain}
      camera={
        isChain
          ? // Perspective: the chain recedes into depth and runs off the frame.
            { position: config.cameraPosition, fov: config.cameraFov, near: 0.1, far: 80 }
          : // Near-frontal, slightly above: the slab's front reads like a screen of glass.
            { position: [0, 0.9, 8], zoom: 100, near: 0.1, far: 50 }
      }
      dpr={lowQuality ? [1, 1.25] : [1, 1.5]}
      flat
      gl={{ alpha: true, antialias: true, powerPreference: "high-performance" }}
      frameloop={frameloop}
      aria-hidden="true"
      onPointerMove={onPointerMove}
      onPointerLeave={onPointerLeave}
      onCreated={({ gl }) => {
        gl.setClearColor(0x000000, 0);
        gl.domElement.addEventListener("webglcontextlost", onContextLost, { once: true });
      }}
    >
      {isChain ? (
        <CameraRig
          fov={config.cameraFov}
          position={config.cameraPosition}
          target={config.cameraTarget}
        />
      ) : (
        <FitCamera points={fitPoints} spinRadius={spinRadius} />
      )}
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
