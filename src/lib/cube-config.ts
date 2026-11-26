// Video cube configuration (spec §6.4). All values are initial tuning targets,
// not visually verified constants — tune in /dev/cube with real footage.

/**
 * - `box`: baseline — BoxGeometry, conventional UVs, same video on every face.
 * - `triplanar`: production — rounded geometry, object-space triplanar projection.
 * Extension point: `atlas` (cubemap-layout video with face-specific UVs) only if
 * the footage is authored for continuity across faces.
 */
export type MappingMode = "box" | "triplanar";

export type CubeConfig = {
  size: number;
  radius: number;
  segments: number;
  mappingMode: MappingMode;
  projectionSharpness: number;
  distortion: number;
  edgeBlur: number;
  fresnelPower: number;
  rimStrength: number;
  topTint: string;
  bottomTint: string;
  tintStrength: number;
  chromaticOffset: number;
  /** Subtle view-space shading so the volume reads; 0 = fully flat footage. */
  shade: number;
  rotationSpeed: number;
  pointerTilt: number;
  /** Dev only: also spin on X so the bottom face can be inspected. */
  tumble: boolean;
  /** Dev only: tint each projection axis/sign to verify orientation. */
  debugFaces: boolean;
};

export const defaultCubeConfig: CubeConfig = {
  size: 2.4,
  radius: 0.2,
  segments: 6,
  mappingMode: "triplanar",
  projectionSharpness: 6,
  distortion: 0.035,
  edgeBlur: 0.004,
  fresnelPower: 2.5,
  rimStrength: 0.18,
  topTint: "#e8dfab",
  bottomTint: "#c8edaa",
  tintStrength: 0.12,
  chromaticOffset: 0.001,
  shade: 0.12,
  rotationSpeed: 0.16,
  pointerTilt: 0.12,
  tumble: false,
  debugFaces: false,
};

export type CubeSource =
  | { kind: "debug" }
  | { kind: "video"; src: string };

// PLACEHOLDER — no hero footage supplied yet. Set to a 6–12s seamless, silent
// H.264 loop (1024–1440px square crop, 24–30fps, ≤2MB) in public/media/hero/.
export const heroVideoSrc: string | null = null;
