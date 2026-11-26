"use client";

import { Leva, button, folder, useControls } from "leva";
import { type ChangeEvent, useEffect, useState } from "react";
import { HeroCube } from "@/components/hero/HeroCube";
import { type CubeConfig, type CubeSource, defaultCubeConfig, heroVideoSrc } from "@/lib/cube-config";
import styles from "./CubeLab.module.scss";

const d = defaultCubeConfig;

const FOLDERS = {
  chain: "Chain",
  geometry: "Slab",
  lens: "Glass edge",
  glow: "Colour",
  motion: "Motion",
} as const;

// Not tunable in the lab (dev-only toggles, or an array leva can't edit).
type Untuned = "tumble" | "debugFaces" | "chainTints" | "chainPath";

// Leva paths for "Copy config" (folder.key).
const FOLDER_OF: Record<Exclude<keyof CubeConfig, Untuned>, string> = {
  shape: FOLDERS.chain,
  blockLength: FOLDERS.chain,
  blockHeight: FOLDERS.chain,
  blockThickness: FOLDERS.chain,
  blockRadius: FOLDERS.chain,
  blockGap: FOLDERS.chain,
  blockLean: FOLDERS.chain,
  blockTwist: FOLDERS.chain,
  chainTintStrength: FOLDERS.chain,
  refraction: FOLDERS.chain,
  defocus: FOLDERS.chain,
  focusIndex: FOLDERS.chain,
  edgeSoftness: FOLDERS.chain,
  cameraFov: FOLDERS.chain,
  cameraPosition: FOLDERS.chain,
  cameraTarget: FOLDERS.chain,
  mappingMode: FOLDERS.geometry,
  sideWrap: FOLDERS.geometry,
  width: FOLDERS.geometry,
  height: FOLDERS.geometry,
  depth: FOLDERS.geometry,
  yaw: FOLDERS.geometry,
  pitch: FOLDERS.geometry,
  radius: FOLDERS.geometry,
  segments: FOLDERS.geometry,
  projectionSharpness: FOLDERS.geometry,
  lensWidth: FOLDERS.lens,
  lensStrength: FOLDERS.lens,
  distortion: FOLDERS.lens,
  edgeBlur: FOLDERS.lens,
  haze: FOLDERS.lens,
  chromaticOffset: FOLDERS.lens,
  topTint: FOLDERS.glow,
  bottomTint: FOLDERS.glow,
  shadowStrength: FOLDERS.glow,
  shadowSpread: FOLDERS.glow,
  shadowOffsetX: FOLDERS.glow,
  shadowOffsetY: FOLDERS.glow,
  tintStrength: FOLDERS.glow,
  glowStrength: FOLDERS.glow,
  glowSize: FOLDERS.glow,
  rimStrength: FOLDERS.glow,
  fresnelPower: FOLDERS.glow,
  shade: FOLDERS.glow,
  playbackRate: FOLDERS.motion,
  rotationSpeed: FOLDERS.motion,
  pointerTilt: FOLDERS.motion,
};

export function CubeLab() {
  const [fileUrl, setFileUrl] = useState<string | null>(null);

  // Release object URLs for picked files.
  useEffect(() => () => {
    if (fileUrl) URL.revokeObjectURL(fileUrl);
  }, [fileUrl]);

  const [controls, set] = useControls(() => ({
    Source: folder({
      source: { value: heroVideoSrc ? "video" : "debug", options: ["debug", "video"] },
      videoUrl: { value: heroVideoSrc ?? "", label: "video url" },
      showReference: { value: true, label: "DOM reference" },
    }),
    [FOLDERS.chain]: folder({
      shape: { value: d.shape, options: ["chain", "slab"] },
      blockLength: { value: d.blockLength, min: 0.5, max: 8, step: 0.05, label: "block length" },
      blockHeight: { value: d.blockHeight, min: 0.5, max: 6, step: 0.05, label: "block height" },
      blockThickness: { value: d.blockThickness, min: 0.3, max: 5, step: 0.05, label: "block thickness" },
      blockRadius: { value: d.blockRadius, min: 0, max: 2, step: 0.01, label: "block radius" },
      blockGap: { value: d.blockGap, min: -2, max: 2, step: 0.01, label: "gap" },
      blockLean: { value: d.blockLean, min: -1.5, max: 1.5, step: 0.01, label: "lean" },
      blockTwist: { value: d.blockTwist, min: -0.5, max: 0.5, step: 0.005, label: "twist / block" },
      refraction: { value: d.refraction, min: 0, max: 0.3, step: 0.005, label: "refraction" },
      chainTintStrength: { value: d.chainTintStrength, min: 0, max: 1, step: 0.01, label: "glass tint" },
      defocus: { value: d.defocus, min: 0, max: 0.03, step: 0.0005, label: "defocus / block" },
      focusIndex: { value: d.focusIndex, min: 0, max: 8, step: 0.1, label: "focus block" },
      edgeSoftness: { value: d.edgeSoftness, min: 0, max: 1, step: 0.01, label: "soft outline" },
      cameraFov: { value: d.cameraFov, min: 15, max: 75, step: 1, label: "camera fov" },
      cameraPosition: { value: d.cameraPosition, step: 0.1, label: "camera pos" },
      cameraTarget: { value: d.cameraTarget, step: 0.1, label: "camera target" },
    }),
    [FOLDERS.geometry]: folder({
      mappingMode: { value: d.mappingMode, options: ["wrap", "front", "triplanar", "box"] },
      sideWrap: { value: d.sideWrap, min: 0, max: 1, step: 0.01, label: "side wrap" },
      width: { value: d.width, min: 0.5, max: 5, step: 0.05 },
      height: { value: d.height, min: 0.5, max: 5, step: 0.05 },
      depth: { value: d.depth, min: 0.3, max: 5, step: 0.05 },
      yaw: { value: d.yaw, min: -1.2, max: 1.2, step: 0.01 },
      pitch: { value: d.pitch, min: -0.8, max: 0.8, step: 0.01 },
      radius: { value: d.radius, min: 0, max: 1.5, step: 0.01 },
      segments: { value: d.segments, min: 1, max: 16, step: 1 },
      projectionSharpness: { value: d.projectionSharpness, min: 1, max: 16, step: 0.5 },
    }),
    [FOLDERS.lens]: folder({
      lensWidth: { value: d.lensWidth, min: 0, max: 0.5, step: 0.01, label: "band width" },
      lensStrength: { value: d.lensStrength, min: 0, max: 0.6, step: 0.01, label: "lens warp" },
      distortion: { value: d.distortion, min: 0, max: 0.3, step: 0.005, label: "bevel swirl" },
      edgeBlur: { value: d.edgeBlur, min: 0, max: 0.05, step: 0.001, label: "frost blur" },
      haze: { value: d.haze, min: 0, max: 1, step: 0.01 },
      chromaticOffset: { value: d.chromaticOffset, min: 0, max: 0.02, step: 0.0005, label: "chroma" },
    }),
    [FOLDERS.glow]: folder({
      topTint: d.topTint,
      bottomTint: d.bottomTint,
      shadowStrength: { value: d.shadowStrength, min: 0, max: 2, step: 0.01, label: "back shadow" },
      shadowSpread: { value: d.shadowSpread, min: 0.1, max: 2.5, step: 0.05, label: "shadow spread" },
      shadowOffsetX: { value: d.shadowOffsetX, min: -1.5, max: 1.5, step: 0.01, label: "shadow x" },
      shadowOffsetY: { value: d.shadowOffsetY, min: -1.5, max: 1.5, step: 0.01, label: "shadow y" },
      tintStrength: { value: d.tintStrength, min: 0, max: 1, step: 0.01, label: "edge tint (front)" },
      glowStrength: { value: d.glowStrength, min: 0, max: 2, step: 0.01, label: "halo (front)" },
      glowSize: { value: d.glowSize, min: 0, max: 0.3, step: 0.005, label: "halo size" },
      rimStrength: { value: d.rimStrength, min: 0, max: 1, step: 0.01, label: "white rim" },
      fresnelPower: { value: d.fresnelPower, min: 0.5, max: 6, step: 0.1, label: "rim power" },
      shade: { value: d.shade, min: 0, max: 0.6, step: 0.01 },
    }),
    [FOLDERS.motion]: folder({
      playbackRate: { value: d.playbackRate, min: 0.1, max: 2, step: 0.05, label: "video speed" },
      rotationSpeed: { value: d.rotationSpeed, min: 0, max: 1.5, step: 0.01 },
      pointerTilt: { value: d.pointerTilt, min: 0, max: 0.4, step: 0.01 },
      tumble: { value: false, label: "tumble (see bottom)" },
    }),
    Debug: folder({
      debugFaces: { value: false, label: "tint faces" },
    }),
  }));

  useControls({
    "Copy config": button((get) => {
      const out = Object.fromEntries(
        (Object.keys(d) as (keyof CubeConfig)[])
          .filter((k): k is Exclude<keyof CubeConfig, Untuned> => k in FOLDER_OF)
          .map((k) => [k, get(`${FOLDER_OF[k]}.${k}`)]),
      );
      void navigator.clipboard.writeText(JSON.stringify(out, null, 2));
    }),
  });

  const { source: sourceKind, videoUrl, showReference, ...rest } = controls;
  // Leva only re-renders on a control change, so a fresh object here is cheap.
  const config = { ...d, ...rest } as CubeConfig;

  const activeVideo = fileUrl ?? (videoUrl || null);
  const source: CubeSource =
    sourceKind === "video" && activeVideo ? { kind: "video", src: activeVideo } : { kind: "debug" };
  const sourceKey = source.kind === "video" ? source.src : "debug";

  const onFile = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileUrl(URL.createObjectURL(file));
    set({ source: "video" });
  };

  return (
    <div className={styles.lab}>
      <Leva collapsed={false} titleBar={{ title: "Cube" }} />

      <header className={styles.head}>
        <h1 className="ui">Cube lab · development only</h1>
        <p className="ui-muted">
          Source: {source.kind === "debug" ? "debug pattern" : activeVideo} · mode: {config.mappingMode}
        </p>
        <label className={`${styles.file} ui`}>
          Load local video…
          <input type="file" accept="video/*" onChange={onFile} />
        </label>
      </header>

      <div className={styles.stage}>
        {/* Keyed by source so a failed video can be retried with another file. */}
        <HeroCube key={sourceKey} source={source} config={config} />
      </div>

      {showReference && source.kind === "video" && (
        <figure className={styles.reference}>
          <video src={source.src} muted loop autoPlay playsInline />
          <figcaption className="ui-muted">DOM reference — compare colour and contrast</figcaption>
        </figure>
      )}

      <section className={`${styles.checklist} ui-muted`}>
        <h2 className="ui">Acceptance checks</h2>
        <ul>
          <li>All six faces readable — enable “tumble” to see the bottom.</li>
          <li>“F” never mirrored; “▲ TOP” points up on the sides, toward −Z on the top.</li>
          <li>Red side-fill never visible (cover crop keeps the centre square).</li>
          <li>No black seams on bevels; sweep keeps moving (texture updating).</li>
          <li>Greyscale ramp matches the DOM reference (no double tone mapping).</li>
          <li>Pause stops rotation + video; reduced motion shows the poster.</li>
        </ul>
      </section>
    </div>
  );
}
