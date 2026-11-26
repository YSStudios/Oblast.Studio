import { presets, type Preset } from "./presets";

export type DebugSettings = Preset & {
  enabled: boolean;
  feedbackEnabled: boolean;
  view: "output" | "previous" | "mask";
};
export const defaultDebugSettings: DebugSettings = { ...presets.signal, enabled: true, feedbackEnabled: true, view: "output" };
let settings = defaultDebugSettings;
const listeners = new Set<() => void>();
export const getDebugSettings = () => settings;
export const subscribeDebugSettings = (listener: () => void) => {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
};
export function setDebugSettings(patch: Partial<DebugSettings>) {
  settings = { ...settings, ...patch };
  for (const listener of listeners) listener();
}
