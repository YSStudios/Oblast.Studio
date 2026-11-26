export const vertex = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = vec4(position.xy, 0.0, 1.0);
  }
`;

export const feedback = /* glsl */ `
  precision highp float;
  varying vec2 vUv;
  uniform sampler2D uHistory, uIncoming;
  uniform vec2 uResolution, uDirection, uOrigin;
  uniform float uProgress, uStrength, uFeedback, uInject;
  uniform float uBlockPx, uTrailPx, uTime, uDt, uHoldHz;
  uniform float uDebug, uCrossover;

  float hash(vec2 p) {
    return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
  }
  vec2 safeUV(vec2 p) {
    vec2 h = 0.5 / uResolution;
    return clamp(p, h, 1.0 - h);
  }
  void main() {
    vec2 uv = vUv;
    float tick = floor(uTime * uHoldHz);
    float dt60 = clamp(uDt * 60.0, 0.0, 3.0);
    // Mixed block scales produce coherent strips and irregular macroblocks.
    vec2 coarse = floor(uv * uResolution / vec2(uBlockPx * 3.0, uBlockPx));
    float broad = hash(coarse);
    vec2 cell = floor(uv * uResolution / (uBlockPx * (0.7 + broad)));
    float seed = hash(cell + vec2(tick * 13.0, tick * 7.0));
    float band = hash(vec2(coarse.y, tick));
    vec2 radial = (uv - uOrigin) * uResolution;
    radial /= max(length(radial), 1.0);
    // Neighboring ribbons flow in opposite directions, carrying both pages
    // across each other instead of wiping the old page in a single direction.
    float lane = hash(vec2(coarse.y, floor(tick / 3.0)));
    float reverseFlow = mix(1.0, lane < 0.48 ? -1.0 : 1.0, uCrossover);
    vec2 dir = uDirection * reverseFlow * (0.4 + seed * 1.4) + radial * 0.4;
    dir.y += (band - 0.5) * 0.65;
    vec2 motion = dir * uTrailPx * uStrength * step(0.27, seed) * dt60 / uResolution;
    vec3 old = texture2D(uHistory, safeUV(uv - motion)).rgb;
    vec3 fresh = texture2D(uIncoming, safeUV(uv + motion * uCrossover * 0.25)).rgb;
    float replaceSeed = hash(cell + vec2(floor(uTime * 60.0) * 17.0, 91.0));
    float probability = 1.0 - pow(1.0 - clamp(uInject, 0.0, 1.0), dt60);
    // Some blocks stay held across multiple motion-field ticks.
    float held = step(0.8, hash(coarse + floor(tick / 3.0)));
    float replaceBlock = step(1.0 - probability, replaceSeed) * (1.0 - held);
    // Stable incoming islands remain legible while old history crosses their
    // boundaries. Without these anchors, every fresh patch is immediately
    // swept away and the destination only becomes recognizable at the end.
    float reveal = smoothstep(0.26, 0.84, uProgress) * 0.78;
    float threshold = hash(coarse + vec2(43.0, 19.0));
    float anchor = smoothstep(threshold - 0.07, threshold + 0.07, reveal);
    anchor *= smoothstep(0.26, 0.38, uProgress);
    replaceBlock = max(replaceBlock, anchor * 0.9);
    float keep = pow(clamp(uFeedback, 0.0, 1.0), dt60);
    float clean = smoothstep(0.84, 1.0, uProgress);
    vec3 result = mix(fresh, old, keep * (1.0 - replaceBlock) * (1.0 - clean));
    if (uDebug > 0.5) result = vec3(replaceBlock, held * 0.3, 0.0);
    gl_FragColor = vec4(result, 1.0);
  }
`;
