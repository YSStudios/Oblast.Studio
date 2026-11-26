"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { defaultDebugSettings, getDebugSettings, setDebugSettings, subscribeDebugSettings } from "./debug-settings";
import { presets } from "./presets";
import styles from "./DatamoshDebug.module.scss";

const sliders = [
  ["duration", "Duration", 500, 1600, 50, "ms"],
  ["trail", "Trail distance", 0, 70, 1, "px"],
  ["feedback", "History retention", 0.85, 0.998, 0.001, ""],
  ["inject", "Incoming patches", 0.005, 0.18, 0.005, ""],
  ["crossover", "Opposing flow", 0, 1, 0.05, ""],
  ["strength", "Motion strength", 0, 2, 0.05, ""],
  ["block", "Block size", 8, 64, 1, "px"],
  ["holdHz", "Flow update rate", 2, 20, 1, "Hz"],
] as const;

export default function DatamoshDebug() {
  const settings = useSyncExternalStore(subscribeDebugSettings, getDebugSettings, () => defaultDebugSettings);
  const root = useRef<HTMLDetailsElement>(null);
  const [copied, setCopied] = useState(false);
  const presetName = Object.entries(presets).find(([, values]) =>
    Object.entries(values).every(([key, value]) => settings[key as keyof typeof values] === value),
  )?.[0] ?? "custom";
  useEffect(() => {
    const shortcut = (e: KeyboardEvent) => {
      if (e.altKey && e.code === "KeyD" && root.current) { e.preventDefault(); root.current.open = !root.current.open; }
    };
    window.addEventListener("keydown", shortcut);
    return () => window.removeEventListener("keydown", shortcut);
  }, []);

  return <details ref={root} className={styles.menu} data-datamosh-debug>
    <summary><span className={styles.indicator} />Datamosh <span className={styles.shortcut}>⌥ D</span></summary>
    <div className={styles.panel}>
      <div className={styles.heading}><strong>Signal controls</strong><span>DEV</span></div>
      <p>Follow any page link to test. Settings carry across pages. Duration applies to the next transition.</p>
      <label className={styles.row}>Preset<select aria-label="Datamosh preset" value={presetName} onChange={(e) => setDebugSettings(presets[e.target.value as keyof typeof presets])}><option value="custom" disabled>custom</option>{Object.keys(presets).map((key) => <option key={key}>{key}</option>)}</select></label>
      <label className={styles.toggle}><input type="checkbox" checked={settings.enabled} onChange={(e) => setDebugSettings({ enabled: e.target.checked })} />Transitions enabled</label>
      <label className={styles.toggle}><input type="checkbox" checked={settings.feedbackEnabled} onChange={(e) => setDebugSettings({ feedbackEnabled: e.target.checked })} />Temporal feedback</label>
      <div className={styles.sliders}>{sliders.map(([key, label, min, max, step, unit]) => <label key={key}>
        <span>{label}<output>{Number((settings[key] ?? defaultDebugSettings[key])?.toFixed(3))} {unit}</output></span>
        <input aria-label={label} type="range" min={min} max={max} step={step} value={settings[key] ?? defaultDebugSettings[key]} onChange={(e) => setDebugSettings({ [key]: Number(e.target.value) })} />
      </label>)}</div>
      <label className={styles.row}>Buffer view<select aria-label="Datamosh buffer view" value={settings.view} onChange={(e) => setDebugSettings({ view: e.target.value as typeof settings.view })}><option value="output">Composite</option><option value="previous">Previous history</option><option value="mask">Injection mask</option></select></label>
      <div className={styles.actions}>
        <button onClick={() => setDebugSettings(defaultDebugSettings)}>Reset</button>
        <button onClick={() => { void navigator.clipboard.writeText(JSON.stringify(settings, null, 2)).then(() => setCopied(true)).catch(() => setCopied(false)); }}>{copied ? "Copied" : "Copy settings"}</button>
        <a href="/dev/datamosh">Open lab ↗</a>
      </div>
    </div>
  </details>;
}
