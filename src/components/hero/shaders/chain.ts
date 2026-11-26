// Screen-projected glass (the TwelveLabs-style look). The video is mapped in
// SCREEN space — one continuous picture behind every block — and each block
// refracts it: the sample is shifted by the surface's view-space normal, so
// faces turned toward the camera stay nearly clean while sides and rounded
// edges show a displaced ("transposed"), frosted, faintly fringed copy.

export const chainVertexShader = /* glsl */ `
varying vec3 vLocalNormal;
varying vec3 vViewNormal;
varying vec3 vViewPos;

void main() {
  vLocalNormal = normal;
  vViewNormal = normalize(normalMatrix * normal);
  vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
  vViewPos = mvPosition.xyz;
  gl_Position = projectionMatrix * mvPosition;
}
`;

export const chainFragmentShader = /* glsl */ `
uniform sampler2D uMap;
uniform float uTexAspect;
uniform vec2 uTexel;
uniform vec2 uResolution;   // drawing-buffer size in px
uniform float uRefraction;
uniform float uEdgeBlur;
uniform float uChroma;
uniform float uHaze;
uniform vec3 uTint;
uniform float uTintStrength;
uniform float uRimStrength;
uniform float uFresnelPower;
uniform float uShade;
uniform float uDefocus;     // extra blur for blocks away from focus (fake DOF)
uniform float uEdgeSoft;    // fades the grazing rim → soft, out-of-focus outline

varying vec3 vLocalNormal;
varying vec3 vViewNormal;
varying vec3 vViewPos;

vec2 cover(vec2 uv, float frameAspect) {
  float r = frameAspect / uTexAspect;
  if (r < 1.0) uv.x = (uv.x - 0.5) * r + 0.5;
  else uv.y = (uv.y - 0.5) / r + 0.5;
  return uv;
}

vec3 tap(vec2 uv) {
  vec2 pad = uTexel * 0.5;
  return texture2D(uMap, clamp(uv, pad, 1.0 - pad)).rgb;
}

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

void main() {
  vec3 N = normalize(vViewNormal);
  vec3 V = isOrthographic ? vec3(0.0, 0.0, 1.0) : normalize(-vViewPos);
  float facing = clamp(dot(N, V), 0.0, 1.0);

  // 0 on faces turned toward the camera (up to ~45°, since the blocks are
  // yawed), 1 on sides and across rounded edges.
  float edge = 1.0 - smoothstep(0.22, 0.78, facing);

  // One picture across the whole canvas, cover-cropped (never stretched).
  vec2 uv = gl_FragCoord.xy / uResolution;
  uv = cover(uv, uResolution.x / uResolution.y);

  // Refraction: shift by the surface angle; stronger where the glass turns away.
  vec2 bend = N.xy * uRefraction * (0.35 + 0.65 * edge);
  uv -= bend;

  vec3 col = frosted(uv, uEdgeBlur * edge + uDefocus);
#ifndef LOW_QUALITY
  if (uChroma > 0.0 && edge > 0.01) {
    vec2 co = N.xy * uChroma * edge;
    col.r = mix(col.r, tap(uv - co).r, edge);
    col.b = mix(col.b, tap(uv + co).b, edge);
  }
#endif

  // Coloured glass: multiply (stained glass — keeps the video's contrast),
  // with a little extra pure tint toward the edges where the glass thickens.
  col = mix(col, col * uTint * 1.35, uTintStrength);
  col = mix(col, uTint, uTintStrength * 0.35 * edge);

  // Gentle shading so each block reads as a volume.
  float lambert = dot(N, normalize(vec3(-0.3, 0.8, 0.5))) * 0.5 + 0.5;
  col *= 1.0 - uShade * (1.0 - lambert);

  // Milky haze where the glass turns away, plus a soft white rim.
  col = mix(col, vec3(1.0), uHaze * edge * edge);
  float fresnel = pow(1.0 - facing, uFresnelPower);
  col += uRimStrength * fresnel * vec3(0.96, 0.98, 1.0);

  // Soft silhouette: the outline melts away where the surface turns edge-on,
  // more so for defocused blocks — reads as depth of field without post-FX.
  float soft = clamp(uEdgeSoft + uDefocus * 40.0, 0.0, 1.0);
  float alpha = mix(1.0, smoothstep(0.0, 0.35, facing), soft);

  gl_FragColor = vec4(col, alpha);

  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}
`;
