// Object-space triplanar video projection for a rounded cube (spec §6.3B, §6.4).
// Kept as TS template strings to avoid a GLSL loader in the Next bundler.
//
// Pipeline: planar UVs per axis (signed per face, aspect-cover) → bevel factor
// from the local normal → small normal-driven lens displacement + frosted taps
// near bevels → normalised pow(|n|) blend → shade, edge tint, Fresnel rim →
// tone mapping + colour space conversion exactly once (Three.js chunks).

export const cubeVertexShader = /* glsl */ `
varying vec3 vLocalPos;
varying vec3 vLocalNormal;
varying vec3 vViewNormal;
varying vec3 vViewPos;

void main() {
  vLocalPos = position;
  vLocalNormal = normal;
  vViewNormal = normalize(normalMatrix * normal);
  vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
  vViewPos = mvPosition.xyz;
  gl_Position = projectionMatrix * mvPosition;
}
`;

export const cubeFragmentShader = /* glsl */ `
uniform sampler2D uMap;
uniform float uTexAspect;   // texture width / height
uniform vec2 uTexel;        // 1 / texture size
uniform float uSize;
uniform float uSharpness;
uniform float uDistortion;
uniform float uEdgeBlur;
uniform float uFresnelPower;
uniform float uRimStrength;
uniform vec3 uTopTint;
uniform vec3 uBottomTint;
uniform float uTintStrength;
uniform float uChroma;
uniform float uShade;
uniform float uDebug;

varying vec3 vLocalPos;
varying vec3 vLocalNormal;
varying vec3 vViewNormal;
varying vec3 vViewPos;

// Crop the texture to a centred square (cover, never stretch).
vec2 cover(vec2 uv) {
  if (uTexAspect > 1.0) {
    uv.x = (uv.x - 0.5) / uTexAspect + 0.5;
  } else {
    uv.y = (uv.y - 0.5) * uTexAspect + 0.5;
  }
  return uv;
}

// Clamp with half-texel padding so edges never sample outside the frame.
vec3 tap(vec2 uv) {
  vec2 pad = uTexel * 0.5;
  return texture2D(uMap, clamp(uv, pad, 1.0 - pad)).rgb;
}

vec3 soft(vec2 uv, float amount) {
  vec3 c = tap(uv);
#ifndef LOW_QUALITY
  // 4 extra taps only near bevels — never a uniform blur across every face.
  if (amount > 0.001 && uEdgeBlur > 0.0) {
    float o = uEdgeBlur * amount;
    c += tap(uv + vec2(o, 0.0));
    c += tap(uv - vec2(o, 0.0));
    c += tap(uv + vec2(0.0, o));
    c += tap(uv - vec2(0.0, o));
    c *= 0.2;
  }
#endif
  return c;
}

// Sample one projection. tangentN = local normal expressed in this plane's UV axes,
// which drives the curvature-dependent lens displacement around the bevel.
vec3 project(vec2 uv, vec2 tangentN, float bevel) {
  uv += tangentN * uDistortion * bevel;
  uv = cover(uv);
  vec3 c = soft(uv, bevel);
#ifndef LOW_QUALITY
  if (uChroma > 0.0 && bevel > 0.001) {
    vec2 co = tangentN * uChroma * bevel;
    c.r = tap(uv + co).r;
    c.b = tap(uv - co).b;
  }
#endif
  return c;
}

void main() {
  vec3 n = normalize(vLocalNormal);
  vec3 an = abs(n);
  vec3 p = vLocalPos / uSize + 0.5;

  // 0 on flat faces, rising across the rounded edges (independent of view angle).
  float flatness = max(an.x, max(an.y, an.z));
  float bevel = smoothstep(0.0, 0.3, 1.0 - flatness);

  vec3 w = pow(an, vec3(uSharpness));
  w /= (w.x + w.y + w.z);

  float sx = n.x >= 0.0 ? 1.0 : -1.0;
  float sy = n.y >= 0.0 ? 1.0 : -1.0;
  float sz = n.z >= 0.0 ? 1.0 : -1.0;

  // Signed planar UVs so every face reads correctly from outside the cube:
  //  ±X faces project ZY, ±Y faces XZ (top edge of image toward −Z), ±Z faces XY.
  vec2 uvX = vec2(sx > 0.0 ? 1.0 - p.z : p.z, p.y);
  vec2 uvY = vec2(p.x, sy > 0.0 ? 1.0 - p.z : p.z);
  vec2 uvZ = vec2(sz > 0.0 ? p.x : 1.0 - p.x, p.y);

  vec2 tX = vec2(sx > 0.0 ? -n.z : n.z, n.y);
  vec2 tY = vec2(n.x, sy > 0.0 ? -n.z : n.z);
  vec2 tZ = vec2(sz > 0.0 ? n.x : -n.x, n.y);

  vec3 col = vec3(0.0);
  if (w.x > 0.001) col += w.x * project(uvX, tX, bevel);
  if (w.y > 0.001) col += w.y * project(uvY, tY, bevel);
  if (w.z > 0.001) col += w.z * project(uvZ, tZ, bevel);

  // Debug: tint by projection axis + sign (+X red, −X cyan, +Y green, −Y magenta, +Z blue, −Z yellow).
  if (uDebug > 0.5) {
    vec3 dbg = w.x * (sx > 0.0 ? vec3(1.0, 0.1, 0.1) : vec3(0.1, 1.0, 1.0))
             + w.y * (sy > 0.0 ? vec3(0.1, 1.0, 0.1) : vec3(1.0, 0.1, 1.0))
             + w.z * (sz > 0.0 ? vec3(0.1, 0.2, 1.0) : vec3(1.0, 1.0, 0.1));
    col = mix(col, dbg, 0.35);
  }

  vec3 N = normalize(vViewNormal);
  // Orthographic cameras look straight down −Z in view space.
  vec3 V = isOrthographic ? vec3(0.0, 0.0, 1.0) : normalize(-vViewPos);

  // Gentle view-space shading so the volume reads without killing footage contrast.
  float lambert = dot(N, normalize(vec3(-0.3, 0.8, 0.5))) * 0.5 + 0.5;
  col *= 1.0 - uShade * (1.0 - lambert);

  // Restrained edge tint, graded bottom → top.
  vec3 tint = mix(uBottomTint, uTopTint, smoothstep(0.0, 1.0, p.y));
  col = mix(col, tint, uTintStrength * bevel);

  // Soft cool-white Fresnel rim.
  float fresnel = pow(1.0 - clamp(dot(N, V), 0.0, 1.0), uFresnelPower);
  col += uRimStrength * fresnel * vec3(0.93, 0.96, 1.0);

  gl_FragColor = vec4(col, 1.0);

  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}
`;
