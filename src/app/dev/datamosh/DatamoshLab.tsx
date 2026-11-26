"use client";

import { useEffect, useRef, useState } from "react";
import type { DatamoshEngine } from "@/components/transitions/DatamoshEngine";
import type { TransitionVisual } from "@/components/transitions/capture";
import { presets, type Preset } from "@/components/transitions/presets";
import styles from "./DatamoshLab.module.scss";

export function DatamoshLab() {
  const canvas = useRef<HTMLCanvasElement>(null);
  const video = useRef<HTMLVideoElement>(null);
  const engine = useRef<DatamoshEngine | null>(null);
  const owned = useRef<TransitionVisual[]>([]);
  const [preset, setPreset] = useState<keyof typeof presets>("signal");
  const [controls, setControls] = useState<Preset>({ ...presets.signal });
  const [hold, setHold] = useState(false);
  const [feedback, setFeedback] = useState(true);
  const [useVideo, setUseVideo] = useState(false);
  const [debug, setDebug] = useState<DatamoshEngine["debug"]>("output");
  const [status, setStatus] = useState("Ready. Run a transition, or hold feedback to inspect temporal trails.");
  const runId = useRef({ value: 0 });

  const clear = () => {
    runId.current.value++;
    engine.current?.stop();
    for (const visual of owned.current) visual.dispose();
    owned.current = [];
  };

  useEffect(() => {
    const token = runId.current;
    return () => {
      token.value++;
      engine.current?.dispose();
      for (const visual of owned.current) visual.dispose();
    };
  }, []);

  const run = async () => {
    clear();
    const id = runId.current.value;
    setStatus("Preparing local media…");
    try {
      const [{ DatamoshEngine }, a, b] = await Promise.all([
        import("@/components/transitions/DatamoshEngine"),
        load("/media/projects/ls-graphics/mockup-01.webp"),
        load("/media/projects/ls-graphics/mockup-09.webp"),
      ]);
      if (id !== runId.current.value || !canvas.current) return;
      const visual = (image: HTMLImageElement | HTMLVideoElement): TransitionVisual => {
        const c = document.createElement("canvas"); c.width = 1000; c.height = 700;
        const ctx = c.getContext("2d")!;
        ctx.drawImage(image, 0, 0, c.width, c.height);
        return { image: c, viewport: { width: innerWidth, height: innerHeight }, origin: { x: 0.3, y: 0.5 }, dispose() { c.width = c.height = 1; } };
      };
      const source = visual(a);
      const incoming = visual(useVideo && video.current && video.current.readyState >= 2 ? video.current : b);
      owned.current.push(source, incoming);
      engine.current ??= new DatamoshEngine(canvas.current, () => { clear(); setStatus("WebGL unavailable or context lost. Reset to retry."); });
      await engine.current.prewarm();
      if (id !== runId.current.value) return;
      engine.current.feedbackEnabled = feedback;
      engine.current.debug = debug;
      engine.current.start(source, () => {
        if (id !== runId.current.value) return;
        if (hold) {
          engine.current?.hold(incoming);
          setStatus("Frozen incoming image + moving history. Toggle feedback off and run again to compare.");
        } else {
          engine.current?.resolve(incoming, () => { clear(); setStatus("Resolved. Both history targets can be reset and replayed."); });
          setStatus("Resolving destination…");
        }
      }, controls);
      setStatus("Feedback running…");
    } catch {
      clear(); setStatus("Preview unavailable; normal site navigation remains usable.");
    }
  };

  return <section className={styles.lab}>
    <canvas ref={canvas} className={styles.preview} aria-label="Datamosh feedback preview" />
    <div className={styles.controls}>
      <h1 className="h2">Datamosh lab</h1>
      <p className="ui">{status}</p>
      <div className={styles.options}>
        <label>Preset <select value={preset} onChange={(e) => { const p = e.target.value as keyof typeof presets; setPreset(p); setControls({ ...presets[p] }); }}>{Object.keys(presets).map((p) => <option key={p}>{p}</option>)}</select></label>
        <label>View <select value={debug} onChange={(e) => setDebug(e.target.value as typeof debug)}><option value="output">Output / current history</option><option value="previous">Previous buffer</option><option value="mask">Injection mask</option></select></label>
        <label><input type="checkbox" checked={hold} onChange={(e) => setHold(e.target.checked)} /> Hold feedback</label>
        <label><input type="checkbox" checked={feedback} onChange={(e) => setFeedback(e.target.checked)} /> Feedback enabled</label>
        <label><input type="checkbox" checked={useVideo} onChange={(e) => setUseVideo(e.target.checked)} /> Use decoded video frame</label>
        {([ ["duration", 300, 1200, 50], ["block", 8, 64, 1], ["trail", 0, 50, 1], ["feedback", 0.8, 0.995, 0.005], ["holdHz", 2, 20, 1] ] as const).map(([key, min, max, step]) => <label key={key}>{key}: {controls[key]}<input type="range" min={min} max={max} step={step} value={controls[key]} onChange={(e) => setControls((c) => ({ ...c, [key]: Number(e.target.value) }))} /></label>)}
        <button onClick={() => void run()}>Run / reseed</button><button onClick={() => { clear(); setStatus("Reset. No running RAF."); }}>Reset</button>
      </div>
      <video ref={video} className={styles.video} src="/media/hero/cube-loop.mp4" muted loop controls playsInline preload="metadata" />
      <p className="ui">Local test imagery: ls.graphics free mockup previews. Video: existing hero loop. Controls apply on Run. Development only.</p>
    </div>
  </section>;
}

function load(src: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image(); image.onload = () => resolve(image); image.onerror = reject; image.src = src;
  });
}
