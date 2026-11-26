export const copy = /* glsl */ `
  varying vec2 vUv;
  uniform sampler2D uImage;
  void main() { gl_FragColor = texture2D(uImage, vUv); }
`;
export const display = /* glsl */ `
  varying vec2 vUv;
  uniform sampler2D uImage;
  void main() {
    gl_FragColor = texture2D(uImage, vUv);
    #include <colorspace_fragment>
  }
`;
