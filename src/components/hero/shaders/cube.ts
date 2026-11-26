// Object-space triplanar video projection for a rounded glass-like cube
// (spec §6.3B, §6.4). TS template strings — no GLSL loader needed.
//
// Per projection: signed planar UV → edge "lens" band (distance to the face
// border) pulls samples toward the face centre so footage magnifies and bends
// near the edges → bevel swirl → aspect-cover → frosted taps + chroma split
// scaled by the band. Then: normalised pow(|n|) blend, shade, yellow→green edge
// tint, milky haze, tinted Fresnel rim, tone mapping + colour space once.

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
uniform vec3 uDims;         // box width, height, depth
uniform float uSharpness;
uniform float uLensWidth;
uniform float uLens;
uniform float uDistortion;
uniform float uEdgeBlur;
uniform float uHaze;
uniform float uChroma;
uniform vec3 uTopTint;
uniform vec3 uBottomTint;
uniform float uTintStrength;
uniform float uFresnelPower;
uniform float uRimStrength;
uniform float uShade;
uniform float uDebug;
uniform float uFront;       // 1 = single front projection stretched round the sides
uniform float uWrap;        // 1 = front image unfolded continuously round sides/top/bottom
uniform float uSideWrap;    // image the sides get, as a fraction of their depth

varying vec3 vLocalPos;
varying vec3 vLocalNormal;
varying vec3 vViewNormal;
varying vec3 vViewPos;

// Crop the texture to the face's own proportions (cover, never stretch).
vec2 cover(vec2 uv, float faceAspect) {
  float r = faceAspect / uTexAspect;
  if (r < 1.0) {
    uv.x = (uv.x - 0.5) * r + 0.5;   // texture wider than face: trim the sides
  } else {
    uv.y = (uv.y - 0.5) / r + 0.5;   // face wider than texture: trim top/bottom
  }
  return uv;
}

// Clamp with half-texel padding so edges never sample outside the frame.
vec3 tap(vec2 uv) {
  vec2 pad = uTexel * 0.5;
  return texture2D(uMap, clamp(uv, pad, 1.0 - pad)).rgb;
}

// Frosted glass: only inside the edge band; the flat centre stays one sharp tap.
vec3 frosted(vec2 uv, float r) {
  vec3 c = tap(uv);
  if (r < 0.0002) return c;
#ifdef LOW_QUALITY
  c += tap(uv + vec2(r, 0.0)) + tap(uv - vec2(r, 0.0));
  c += tap(uv + vec2(0.0, r)) + tap(uv - vec2(0.0, r));
  return c * 0.2;
#else
  float d = r * 0.7071;
  float h = r * 0.5;
  c += tap(uv + vec2(r, 0.0)) + tap(uv - vec2(r, 0.0));
  c += tap(uv + vec2(0.0, r)) + tap(uv - vec2(0.0, r));
  c += tap(uv + vec2(d, d)) + tap(uv - vec2(d, d));
  c += tap(uv + vec2(d, -d)) + tap(uv - vec2(d, -d));
  c += tap(uv + vec2(h, 0.0)) + tap(uv - vec2(h, 0.0));
  c += tap(uv + vec2(0.0, h)) + tap(uv - vec2(0.0, h));
  return c / 13.0;
#endif
}

// Sample one planar projection. Returns rgb + its edge-band strength.
// tangentN = local normal expressed in this plane's UV axes (bevel swirl).
// faceDims = world size of the faces this projection lands on.
vec4 project(vec2 uv, vec2 tangentN, float bevel, vec2 faceDims) {
  // Edge band, measured in world units so long and short edges match:
  // 1 at the face border (and across the bevel), 0 past the lens width.
  float minDim = min(uDims.x, min(uDims.y, uDims.z));
  vec2 e = min(uv, 1.0 - uv) * faceDims;
  float dist = max(min(e.x, e.y), 0.0);
  float band = 1.0 - smoothstep(0.0, max(uLensWidth * minDim, 0.001), dist);
  band = max(band, bevel);

  // Lens: pull toward the face centre, strongest at the edge → thick-glass bend.
  uv = 0.5 + (uv - 0.5) * (1.0 - uLens * band * band);
  // Swirl across the rounded bevel.
  uv += tangentN * uDistortion * bevel;
  uv = cover(uv, faceDims.x / faceDims.y);

  vec3 c = frosted(uv, uEdgeBlur * band);
#ifndef LOW_QUALITY
  if (uChroma > 0.0 && band > 0.01) {
    vec2 dir = uv - 0.5;
    vec2 co = dir * uChroma * band * 4.0;
    c.r = mix(c.r, tap(uv + co).r, band);
    c.b = mix(c.b, tap(uv - co).b, band);
  }
#endif
  return vec4(c, band);
}

void main() {
  vec3 n = normalize(vLocalNormal);
  vec3 an = abs(n);
  vec3 p = vLocalPos / uDims + 0.5;

  // 0 on flat faces, rising across the rounded edges (independent of view).
  float flatness = max(an.x, max(an.y, an.z));
  float bevel = smoothstep(0.0, 0.3, 1.0 - flatness);

  vec3 w = pow(an, vec3(uSharpness));
  w /= (w.x + w.y + w.z);

  float sx = n.x >= 0.0 ? 1.0 : -1.0;
  float sy = n.y >= 0.0 ? 1.0 : -1.0;
  float sz = n.z >= 0.0 ? 1.0 : -1.0;

  // Signed planar UVs — right-handed on every face, so nothing reads mirrored:
  //  ±X faces project ZY, ±Y faces XZ (top edge of image toward −Z), ±Z faces XY.
  vec2 uvX = vec2(sx > 0.0 ? 1.0 - p.z : p.z, p.y);
  vec2 uvY = vec2(p.x, sy > 0.0 ? 1.0 - p.z : p.z);
  vec2 uvZ = vec2(sz > 0.0 ? p.x : 1.0 - p.x, p.y);

  vec2 tX = vec2(sx > 0.0 ? -n.z : n.z, n.y);
  vec2 tY = vec2(n.x, sy > 0.0 ? -n.z : n.z);
  vec2 tZ = vec2(sz > 0.0 ? n.x : -n.x, n.y);

  vec3 col;
  if (uWrap > 0.5) {
    // Unfold the box around the front face: the sides/top/bottom show the
    // image that continues past each front edge — one picture, no copies.
    // Coordinates are world units, continuous across every front edge, so
    // blending them by normal weight across the bevel never doubles the image.
    vec3 q = vLocalPos;
    vec2 hw = uDims.xy * 0.5;
    float back = uDims.z * 0.5 - q.z;                 // 0 at the front plane
    float k = uSideWrap;
    vec2 cZ = q.xy;
    vec2 cX = vec2(sx * (hw.x + k * back), q.y);
    vec2 cY = vec2(q.x, sy * (hw.y + k * back));
    vec2 U = w.x * cX + w.y * cY + w.z * cZ;

    vec2 canvas = uDims.xy + 2.0 * k * uDims.z;     // unfolded size
    vec2 uv = U / canvas + 0.5;

    // Lens band just inside the front face's edges (world units).
    float minDim = min(uDims.x, min(uDims.y, uDims.z));
    float frontness = smoothstep(0.35, 0.95, n.z);
    vec2 e = hw - abs(q.xy);
    float band = (1.0 - smoothstep(0.0, max(uLensWidth * minDim, 0.001), min(e.x, e.y))) * frontness;
    float edge = max(bevel, band);

    // Thick-glass lens: magnify toward the centre near the edges, and bend the
    // image along the curve of the rounded edge.
    uv = 0.5 + (uv - 0.5) * (1.0 - uLens * 0.35 * edge * edge);
    uv -= n.xy * uLens * 0.08 * bevel;
    uv += n.xy * uDistortion * 0.25 * bevel;
    uv = cover(uv, canvas.x / canvas.y);

    vec3 c = frosted(uv, uEdgeBlur * edge);
#ifndef LOW_QUALITY
    // Subtle fringe that follows the curve, only where the glass bends.
    if (uChroma > 0.0 && edge > 0.01) {
      vec2 co = n.xy * uChroma * edge;
      c.r = mix(c.r, tap(uv - co).r, edge);
      c.b = mix(c.b, tap(uv + co).b, edge);
    }
#endif
    col = c;
  } else if (uFront > 0.5) {
    // One projection along Z. On the sides/top/bottom the front image's edge
    // pixels stretch back across the depth (a glass block, not repeated copies).
    // Anything not facing front counts as fully "edge": max lens, frost, chroma.
    float side = 1.0 - smoothstep(0.35, 0.95, n.z);
    col = project(p.xy, n.xy, max(bevel, side), uDims.xy).rgb;
  } else {
    vec4 acc = vec4(0.0);
    if (w.x > 0.001) acc += w.x * project(uvX, tX, bevel, uDims.zy);
    if (w.y > 0.001) acc += w.y * project(uvY, tY, bevel, uDims.xz);
    if (w.z > 0.001) acc += w.z * project(uvZ, tZ, bevel, uDims.xy);
    col = acc.rgb;
  }

  // Debug: +X red, −X cyan, +Y green, −Y magenta, +Z blue, −Z yellow.
  if (uDebug > 0.5) {
    vec3 dbg = w.x * (sx > 0.0 ? vec3(1.0, 0.1, 0.1) : vec3(0.1, 1.0, 1.0))
             + w.y * (sy > 0.0 ? vec3(0.1, 1.0, 0.1) : vec3(1.0, 0.1, 1.0))
             + w.z * (sz > 0.0 ? vec3(0.1, 0.2, 1.0) : vec3(1.0, 1.0, 0.1));
    col = mix(col, dbg, 0.35);
  }

  vec3 N = normalize(vViewNormal);
  // Orthographic cameras look straight down −Z in view space.
  vec3 V = isOrthographic ? vec3(0.0, 0.0, 1.0) : normalize(-vViewPos);

  // Gentle view-space shading so the volume reads without killing contrast.
  float lambert = dot(N, normalize(vec3(-0.3, 0.8, 0.5))) * 0.5 + 0.5;
  col *= 1.0 - uShade * (1.0 - lambert);

  // Colour glow: warm top → green bottom, leaning across X for a diagonal sweep.
  float g = clamp(p.y * 0.75 + (1.0 - p.x) * 0.25, 0.0, 1.0);
  vec3 tint = mix(uBottomTint, uTopTint, smoothstep(0.15, 0.85, g));
  // Colour lives on the rounded edges only — flat faces keep clean footage
  // (the lens bend + frost still reach in from the band).
  float rim = bevel * bevel;
  col = mix(col, tint, uTintStrength * rim);

  // Milky frosted haze on the rounded edges.
  col = mix(col, vec3(1.0), uHaze * rim);

  // Neutral white Fresnel rim — colour lives only in the shadow behind.
  float fresnel = pow(1.0 - clamp(dot(N, V), 0.0, 1.0), uFresnelPower);
  col += uRimStrength * fresnel * vec3(0.96, 0.98, 1.0);

  gl_FragColor = vec4(col, 1.0);

  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}
`;

// Outer halo: a slightly larger shell drawn back-faces-only, behind the cube
// (depth-tested, no depth write), so it only shows outside the silhouette and
// fades to nothing at the shell's own edge.
export const glowVertexShader = /* glsl */ `
varying vec3 vLocalPos;
varying vec3 vViewNormal;
varying vec3 vViewPos;

void main() {
  vLocalPos = position;
  vViewNormal = normalize(normalMatrix * normal);
  vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
  vViewPos = mvPosition.xyz;
  gl_Position = projectionMatrix * mvPosition;
}
`;

export const glowFragmentShader = /* glsl */ `
uniform vec3 uTopTint;
uniform vec3 uBottomTint;
uniform float uStrength;
uniform vec3 uDims;

varying vec3 vLocalPos;
varying vec3 vViewNormal;
varying vec3 vViewPos;

void main() {
  vec3 N = normalize(vViewNormal);
  vec3 V = isOrthographic ? vec3(0.0, 0.0, 1.0) : normalize(-vViewPos);
  // |N·V| → 0 at the shell silhouette: alpha fades out toward the halo's edge.
  float f = abs(dot(N, V));
  float alpha = uStrength * smoothstep(0.0, 0.75, f) * f;

  vec3 p = vLocalPos / uDims + 0.5;
  float g = clamp(p.y * 0.75 + (1.0 - p.x) * 0.25, 0.0, 1.0);
  vec3 tint = mix(uBottomTint, uTopTint, smoothstep(0.15, 0.85, g));

  gl_FragColor = vec4(tint, alpha);

  #include <colorspace_fragment>
}
`;

// Coloured shadow behind the shape: a plane just behind the back face with a
// soft rounded-rectangle falloff. The shape occludes its centre, so only a
// glow peeking out around the back edges is visible — never on the front.
export const shadowVertexShader = /* glsl */ `
varying vec2 vPos;

void main() {
  vPos = position.xy;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;

export const shadowFragmentShader = /* glsl */ `
uniform vec2 uHalf;       // half width / height of the shape's back face
uniform float uRadius;
uniform float uSpread;    // world units the glow reaches past the edge
uniform float uStrength;
uniform vec3 uTopTint;
uniform vec3 uBottomTint;

varying vec2 vPos;

float sdRoundRect(vec2 p, vec2 b, float r) {
  vec2 q = abs(p) - b + r;
  return length(max(q, 0.0)) + min(max(q.x, q.y), 0.0) - r;
}

void main() {
  float d = sdRoundRect(vPos, uHalf, uRadius);
  // Solid inside, long soft falloff outside (squared for a shadow-like tail).
  float t = 1.0 - smoothstep(-uSpread * 0.25, uSpread, d);
  float alpha = uStrength * t * t;

  float g = clamp(vPos.y / (uHalf.y * 2.0) + 0.5, 0.0, 1.0);
  vec3 tint = mix(uBottomTint, uTopTint, smoothstep(0.1, 0.9, g));

  gl_FragColor = vec4(tint, alpha);

  #include <colorspace_fragment>
}
`;
