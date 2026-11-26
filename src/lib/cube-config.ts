// Hero shape configuration (spec §6.4). All values are tuning targets, not
// visually verified constants — tune in /dev/cube with the real footage.

/**
 * - `box`: baseline — BoxGeometry, conventional UVs, same video on every face.
 * - `wrap`: production — the front image unfolded continuously round the
 *   sides/top/bottom (each side shows what lies past that front edge).
 * - `front`: one front projection whose edge
 *   pixels stretch back across the sides/top/bottom (glass block, no copies).
 * - `triplanar`: rounded geometry, the video projected onto every face.
 * Extension point: `atlas` (cubemap-layout video with face-specific UVs) only if
 * the footage is authored for continuity across faces.
 */
export type MappingMode = "box" | "wrap" | "front" | "triplanar";

/**
 * - `chain`: production — a curved run of rounded glass blocks with the video
 *   projected across them in screen space and refracted by each block.
 * - `slab`: a single rounded block using `mappingMode`.
 */
export type HeroShape = "chain" | "slab";

export type CubeConfig = {
  shape: HeroShape;

  // ── Chain (shape = "chain"): glass blocks end-to-end along a 3D path,
  //    seen through a perspective camera so the run recedes into depth ──
  /** Control points of the path, near → far (world units). */
  chainPath: [number, number, number][];
  /** Block size: length along the path, height, and thickness. */
  blockLength: number;
  blockHeight: number;
  blockThickness: number;
  blockRadius: number;
  /** Space between blocks along the path (negative = overlap). */
  blockGap: number;
  /** Lean of every block around the path (tips its broad face toward camera). */
  blockLean: number;
  /** Extra twist added per block along the run (radians). */
  blockTwist: number;
  /** Per-block glass tint, cycled along the chain (near → far). */
  chainTints: string[];
  chainTintStrength: number;
  /** Screen-space shift of the projected video by surface angle (the "transposed" look). */
  refraction: number;
  /** Fake depth of field: extra blur per block away from the focus block. */
  defocus: number;
  /** Which block (0 = nearest) is in focus; fractional values allowed. */
  focusIndex: number;
  /** Soft, out-of-focus silhouettes: fades the grazing rim (0 = crisp). */
  edgeSoftness: number;
  cameraFov: number;
  cameraPosition: [number, number, number];
  cameraTarget: [number, number, number];

  /** Box dimensions in world units (X = width, Y = height, Z = depth). */
  width: number;
  height: number;
  depth: number;
  radius: number;
  segments: number;
  mappingMode: MappingMode;
  /** `wrap` only: how much image the sides get, as a fraction of their depth. */
  sideWrap: number;
  projectionSharpness: number;

  // ── Pose (static — no idle spin) ────────────────────────────────────
  /** Turn around Y in radians; positive reveals the left side. */
  yaw: number;
  /** Tilt around X in radians; positive tips the top toward the viewer. */
  pitch: number;

  // ── Glass edge ("lens") ─────────────────────────────────────────────
  /** Lens band reach from each edge, as a fraction of the smallest dimension. */
  lensWidth: number;
  /** Pull toward the face centre inside the band → magnified, bent edges. */
  lensStrength: number;
  /** Normal-driven swirl across the rounded bevel. */
  distortion: number;
  /** Frosted blur radius at the very edge (UV units). */
  edgeBlur: number;
  /** Milky white haze on the rounded edges. */
  haze: number;
  chromaticOffset: number;

  // ── Colour: a shadow behind the shape; the front stays neutral ──────
  topTint: string;
  bottomTint: string;
  /** Coloured shadow behind the shape (0 disables it). */
  shadowStrength: number;
  /** How far the shadow reaches past the back edges (world units). */
  shadowSpread: number;
  /** Shadow shift (world units, in the shape's own X/Y). The camera looks
   *  slightly down, so a negative Y keeps it from rising behind the headline. */
  shadowOffsetX: number;
  shadowOffsetY: number;
  /** Optional tint on the rounded edges (0 = none; seen from the front). */
  tintStrength: number;
  /** Optional halo ring around the outline (0 = none; seen from the front). */
  glowStrength: number;
  /** Halo reach, as a fraction of the smallest dimension. */
  glowSize: number;
  fresnelPower: number;
  /** Neutral white rim highlight. */
  rimStrength: number;

  /** Subtle view-space shading so the volume reads; 0 = fully flat footage. */
  shade: number;

  // ── Motion / playback ───────────────────────────────────────────────
  /** Idle spin around Y (rad/s). 0 = static. */
  rotationSpeed: number;
  /** Max turn toward the mouse while hovering the shape (radians). */
  pointerTilt: number;
  /** Video speed (1 = native). The loop file itself is seamless. */
  playbackRate: number;

  /** Dev only: also spin on X so the bottom face can be inspected. */
  tumble: boolean;
  /** Dev only: tint each projection axis/sign to verify orientation. */
  debugFaces: boolean;
};

export const defaultCubeConfig: CubeConfig = {
  shape: "chain",

  // Near block low-left and big (runs off frame); the run climbs to the
  // upper right and recedes, curving like a ribbon.
  chainPath: [
    [-13, -3.6, 3.5],
    [-7, -2.2, 1],
    [-1.5, -0.6, -1.8],
    [4, 1.2, -5],
    [9, 3.0, -9],
    [14, 5.0, -14],
  ],
  blockLength: 4.6,
  blockHeight: 3.4,
  blockThickness: 2.4,
  blockRadius: 1.1,
  blockGap: -0.35,
  blockLean: -0.35,
  blockTwist: 0.05,
  chainTints: ["#e6ecea", "#6fe05a", "#2fa8e8", "#5fe0b8", "#bfe9f7", "#9fe6c9"],
  chainTintStrength: 0.7,
  refraction: 0.06,
  defocus: 0.006,
  focusIndex: 1.5,
  edgeSoftness: 0.6,
  cameraFov: 34,
  cameraPosition: [0, 0, 12],
  cameraTarget: [0, 0.4, -2],

  width: 3.4,
  height: 1.75,
  depth: 2.2,
  radius: 0.5,
  segments: 8,
  mappingMode: "wrap",
  sideWrap: 0.55,
  projectionSharpness: 6,

  yaw: 0.32,
  pitch: 0.1,

  lensWidth: 0.3,
  lensStrength: 0.35,
  distortion: 0.06,
  edgeBlur: 0.022,
  haze: 0.06,
  chromaticOffset: 0.005,

  topTint: "#f0d54a",
  bottomTint: "#93e05c",
  // Off: the big CSS colour backdrop behind the stage replaces it.
  shadowStrength: 0,
  shadowSpread: 0.5,
  shadowOffsetX: 0.35,
  shadowOffsetY: -0.3,
  tintStrength: 0,
  glowStrength: 0,
  glowSize: 0.12,
  fresnelPower: 2.2,
  rimStrength: 0.15,

  shade: 0.08,

  rotationSpeed: 0,
  pointerTilt: 0.14,
  // cube.mp4 is 29.97fps: slowing it would make motion visibly steppy.
  playbackRate: 1,

  tumble: false,
  debugFaces: false,
};

export type CubeSource =
  | { kind: "debug" }
  | { kind: "video"; src: string };

// Hero footage: cube.mp4 → `pnpm loop ~/Desktop/cube.mp4 public/media/hero/cube-loop.mp4 1.0 0 450000`
// (native 480×360, silent, 30.1s @ 29.97fps with a 1s crossfaded seam, 1.7MB).
// Set to null to fall back to the static poster.
export const heroVideoSrc: string | null = "/media/hero/cube-loop.mp4";

/** Smallest box dimension — the unit for lens band and halo reach. */
export function minDimension(c: Pick<CubeConfig, "width" | "height" | "depth">) {
  return Math.min(c.width, c.height, c.depth);
}

/**
 * How far the WebGL canvas extends past its stage on each side (fraction of
 * the stage), so soft effects like the back shadow can fade out without being
 * clipped. The camera still fits the shape to the stage itself.
 */
export const CANVAS_BLEED = { x: 0.12, y: 0.2 } as const;
