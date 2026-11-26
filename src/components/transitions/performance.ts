export type TransitionPerformance = {
  mobile: boolean;
  scale: number;
  maxDimension: number;
  fps: number;
  captureMs: number;
  maxWords: number;
  idleRelease: number;
};

// CSS pixels, never devicePixelRatio: a high-DPI phone must not allocate a
// full-resolution postprocessing surface just to show compression blocks.
export function chooseTransitionPerformance(coarse: boolean, cores = 8, memory = 8): TransitionPerformance {
  const lowEnd = coarse && (cores <= 4 || memory <= 4);
  return {
    mobile: coarse,
    scale: lowEnd ? 0.32 : coarse ? 0.4 : 0.65,
    maxDimension: lowEnd ? 480 : coarse ? 640 : 1280,
    fps: coarse ? 30 : 60,
    captureMs: coarse ? 10 : 24,
    maxWords: coarse ? 180 : 1200,
    idleRelease: coarse ? 5000 : 12000,
  };
}

export function getTransitionPerformance() {
  const memory = (navigator as Navigator & { deviceMemory?: number }).deviceMemory;
  return chooseTransitionPerformance(matchMedia("(pointer: coarse)").matches, navigator.hardwareConcurrency, memory);
}

export function transitionSize(profile: TransitionPerformance, width: number, height: number) {
  const scale = Math.min(profile.scale, profile.maxDimension / Math.max(width, height));
  return { width: Math.max(1, Math.round(width * scale)), height: Math.max(1, Math.round(height * scale)) };
}

export class TransitionFrameBudget {
  private frames = 0;
  private pressure = 0;
  private reductions = 0;
  constructor(private fps: number) {}
  sample(gapMs: number, submissionMs: number): "reduce" | "dissolve" | null {
    if (++this.frames <= 3 || this.reductions >= 2) return null;
    const budget = 1000 / this.fps;
    const slow = gapMs > budget * 1.65 || submissionMs > budget * 0.8;
    this.pressure = Math.max(0, this.pressure + (slow ? 1 : -0.5));
    if (this.pressure < 4) return null;
    this.pressure = 0;
    return ++this.reductions === 1 ? "reduce" : "dissolve";
  }
}
