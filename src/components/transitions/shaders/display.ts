export const copy = /* glsl */ `
  varying vec2 vUv;
  uniform sampler2D uImage;
  void main() { gl_FragColor = texture2D(uImage, vUv); }
`;
export const display = /* glsl */ `
  varying vec2 vUv;
  uniform sampler2D uImage;
  uniform vec2 uResolution;
  uniform float uReveal, uBlockPx;

  float hash(vec2 p) {
    return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
  }
  void main() {
    vec2 cell = floor(vUv * uResolution / vec2(uBlockPx * 3.0, uBlockPx));
    float threshold = hash(cell + vec2(43.0, 19.0));
    // Reveal actual DOM in the same block field as destination injection.
    // Soft edges prevent a second, hard replacement of the proxy at the end.
    float revealed = smoothstep(threshold, threshold + 0.22, uReveal * 1.22);
    gl_FragColor = vec4(texture2D(uImage, vUv).rgb, 1.0 - revealed);
    #include <colorspace_fragment>
  }
`;
