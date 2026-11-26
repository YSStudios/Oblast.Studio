"use client";

import { Leva, button, folder, useControls } from "leva";
import { type ChangeEvent, useEffect, useState } from "react";
import { HeroCube } from "@/components/hero/HeroCube";
import { type CubeConfig, type CubeSource, defaultCubeConfig, heroVideoSrc } from "@/lib/cube-config";
import styles from "./CubeLab.module.scss";

const d = defaultCubeConfig;

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
    Geometry: folder({
      mappingMode: { value: d.mappingMode, options: ["triplanar", "box"] },
      size: { value: d.size, min: 1, max: 3.5, step: 0.05 },
      radius: { value: d.radius, min: 0, max: 0.6, step: 0.01 },
      segments: { value: d.segments, min: 1, max: 12, step: 1 },
    }),
    Material: folder({
      projectionSharpness: { value: d.projectionSharpness, min: 1, max: 16, step: 0.5 },
      distortion: { value: d.distortion, min: 0, max: 0.2, step: 0.005 },
      edgeBlur: { value: d.edgeBlur, min: 0, max: 0.03, step: 0.001 },
      chromaticOffset: { value: d.chromaticOffset, min: 0, max: 0.01, step: 0.0005 },
      fresnelPower: { value: d.fresnelPower, min: 0.5, max: 6, step: 0.1 },
      rimStrength: { value: d.rimStrength, min: 0, max: 1, step: 0.01 },
      shade: { value: d.shade, min: 0, max: 0.6, step: 0.01 },
      topTint: d.topTint,
      bottomTint: d.bottomTint,
      tintStrength: { value: d.tintStrength, min: 0, max: 1, step: 0.01 },
    }),
    Motion: folder({
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
      const keys = Object.keys(d) as (keyof CubeConfig)[];
      const out = Object.fromEntries(
        keys.filter((k) => k !== "tumble" && k !== "debugFaces").map((k) => {
          const folderName = ["mappingMode", "size", "radius", "segments"].includes(k)
            ? "Geometry"
            : ["rotationSpeed", "pointerTilt"].includes(k)
              ? "Motion"
              : "Material";
          return [k, get(`${folderName}.${k}`)];
        }),
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
