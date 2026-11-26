export const transitionConfig = { enabled: true, captureBudget: 120, deadline: 2400, idleRelease: 12000 };

export const presets = {
  signal: { duration: 1000, block: 14, trail: 44, feedback: 0.912, holdHz: 13, inject: 0.04, crossover: 0.5, strength: 0.25 },
  drag: { duration: 1250, block: 28, trail: 42, feedback: 0.99, holdHz: 7, inject: 0.025, crossover: 0.65, strength: 1.1 },
  fracture: { duration: 950, block: 36, trail: 22, feedback: 0.975, holdHz: 10, inject: 0.07, crossover: 0.9, strength: 1 },
  reverse: { duration: 850, block: 20, trail: 24, feedback: 0.98, holdHz: 8, inject: 0.04, crossover: 0.6, strength: 0.85 },
  mobile: { duration: 750, block: 24, trail: 16, feedback: 0.97, holdHz: 8, inject: 0.055, crossover: 0.6, strength: 0.7 },
} as const;
export type Preset = { duration: number; block: number; trail: number; feedback: number; holdHz: number; inject?: number; crossover?: number; strength?: number };
