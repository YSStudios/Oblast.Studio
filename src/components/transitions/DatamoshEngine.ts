import * as THREE from "three";
import { gsap } from "gsap";
import type { TransitionVisual } from "./capture";
import { presets, type Preset } from "./presets";
import { feedback, vertex } from "./shaders/feedback";
import { copy, display } from "./shaders/display";

export class DatamoshEngine {
  private renderer: THREE.WebGLRenderer;
  private camera = new THREE.Camera();
  private geometry = new THREE.PlaneGeometry(2, 2);
  private scene = new THREE.Scene();
  private quad: THREE.Mesh<THREE.PlaneGeometry, THREE.ShaderMaterial>;
  private read: THREE.WebGLRenderTarget;
  private write: THREE.WebGLRenderTarget;
  private sources: THREE.Texture[] = [];
  private raf = 0;
  private last = 0;
  private elapsed = 0;
  private accumulator = 0;
  private timeline?: gsap.core.Timeline;
  private settling?: gsap.core.Timeline;
  private lost: () => void;
  private failed = false;
  private mobile = matchMedia("(pointer: coarse)").matches;
  private params = { progress: 0, strength: 0, inject: 0.005, retention: 0.96 };
  preset: Preset = presets.signal;
  debug: "output" | "history" | "previous" | "mask" = "output";
  feedbackEnabled = true;
  private uniforms = {
    uHistory: { value: null as THREE.Texture | null },
    uIncoming: { value: null as THREE.Texture | null },
    uResolution: { value: new THREE.Vector2() },
    uDirection: { value: new THREE.Vector2(1, 0) },
    uOrigin: { value: new THREE.Vector2(0.5, 0.5) },
    uProgress: { value: 0 }, uStrength: { value: 0 },
    uFeedback: { value: 0.96 }, uInject: { value: 0.005 },
    uBlockPx: { value: 20 }, uTrailPx: { value: 18 },
    uTime: { value: 0 }, uDt: { value: 1 / 60 }, uHoldHz: { value: 10 },
    uDebug: { value: 0 }, uCrossover: { value: 0.8 },
  };
  private simulation = new THREE.ShaderMaterial({ vertexShader: vertex, fragmentShader: feedback, uniforms: this.uniforms, depthTest: false, depthWrite: false });
  private copier = new THREE.ShaderMaterial({ vertexShader: vertex, fragmentShader: copy, uniforms: { uImage: { value: null as THREE.Texture | null } }, depthTest: false, depthWrite: false });
  private display = new THREE.ShaderMaterial({ vertexShader: vertex, fragmentShader: display, uniforms: { uImage: { value: null as THREE.Texture | null } }, depthTest: false, depthWrite: false });

  constructor(private canvas: HTMLCanvasElement, private onFailure: () => void) {
    const context = canvas.getContext("webgl2", { antialias: false, alpha: false, powerPreference: "low-power" });
    if (!context || context.isContextLost()) throw new Error("WebGL2 unavailable");
    // A disposed renderer may leave unpack state on this persistent canvas.
    context.pixelStorei(context.UNPACK_FLIP_Y_WEBGL, false);
    context.pixelStorei(context.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);
    this.renderer = new THREE.WebGLRenderer({ canvas, context, antialias: false, alpha: false });
    this.renderer.setPixelRatio(1);
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.NoToneMapping;
    this.renderer.debug.onShaderError = (gl, program, vertexShader, fragmentShader) => {
      console.warn("[Datamosh] Shader compilation failed", gl.getProgramInfoLog(program), gl.getShaderInfoLog(vertexShader), gl.getShaderInfoLog(fragmentShader));
      this.failed = true;
    };
    const scale = Math.min(this.mobile ? 0.5 : 0.65, (this.mobile ? 900 : 1280) / Math.max(innerWidth, innerHeight));
    const w = Math.max(1, Math.round(innerWidth * scale));
    const h = Math.max(1, Math.round(innerHeight * scale));
    this.renderer.setSize(w, h, false);
    const options = { depthBuffer: false, stencilBuffer: false, generateMipmaps: false, minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter, type: THREE.UnsignedByteType };
    this.read = new THREE.WebGLRenderTarget(w, h, options);
    this.write = new THREE.WebGLRenderTarget(w, h, options);
    this.uniforms.uResolution.value.set(w, h);
    this.quad = new THREE.Mesh(this.geometry, this.copier);
    this.quad.frustumCulled = false;
    this.scene.add(this.quad);
    this.lost = () => { this.stop(); this.onFailure(); };
    canvas.addEventListener("webglcontextlost", this.lost);
  }

  prewarm() {
    for (const material of [this.simulation, this.copier, this.display]) {
      this.quad.material = material;
      this.renderer.compile(this.scene, this.camera);
    }
    if (this.failed) throw new Error("Datamosh shader failed");
  }

  private texture(visual: TransitionVisual) {
    const texture = new THREE.CanvasTexture(visual.image);
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.minFilter = THREE.LinearFilter;
    texture.magFilter = THREE.LinearFilter;
    texture.generateMipmaps = false;
    this.sources.push(texture);
    return texture;
  }

  private render(material: THREE.ShaderMaterial, target: THREE.WebGLRenderTarget | null) {
    this.quad.material = material;
    this.renderer.setRenderTarget(target);
    this.renderer.render(this.scene, this.camera);
    if (this.failed) throw new Error("Datamosh shader failed");
  }

  start(source: TransitionVisual, covered: () => void, preset: Preset = presets.signal) {
    this.stop();
    this.preset = preset;
    const texture = this.texture(source);
    this.uniforms.uIncoming.value = texture;
    this.uniforms.uOrigin.value.set(source.origin.x, source.origin.y);
    this.uniforms.uDirection.value.set(source.origin.x < 0.5 ? 1 : -1, 0.15);
    this.copier.uniforms.uImage.value = texture;
    // Seed with a separate copy pass. Never sample a target being written.
    this.render(this.copier, this.read);
    this.display.uniforms.uImage.value = this.read.texture;
    this.render(this.display, null);
    Object.assign(this.params, { progress: 0, strength: 0, inject: 0.005, retention: preset.feedback });
    this.canvas.style.opacity = "1";
    this.last = performance.now(); this.elapsed = 0; this.accumulator = 0;
    this.raf = requestAnimationFrame(this.tick);
    const cover = Math.min(0.18, preset.duration / 4000);
    this.timeline = gsap.timeline()
      .to(this.params, { progress: 0.26, strength: 1, duration: cover, ease: "power2.in" })
      .call(covered)
      .to(this.params, { strength: 0.16, duration: 0.35, ease: "power2.out" });
  }

  resolve(incoming: TransitionVisual, done: () => void) {
    this.timeline?.kill();
    this.uniforms.uIncoming.value = this.texture(incoming);
    const seconds = Math.max(0.35, this.preset.duration / 1000 - 0.18);
    // Start injecting the destination immediately, while outgoing history is
    // still displaced at full strength. Keep retention high through the merge.
    this.params.inject = this.preset.inject ?? 0.045;
    this.params.strength = Math.max(0.8, this.params.strength);
    this.settling = gsap.timeline({ onComplete: done })
      .to(this.params, {
        progress: 0.8, strength: 0.65,
        duration: seconds * 0.68, ease: "none",
      })
      .to(this.params, {
        progress: 1, strength: 0, inject: 1, retention: 0.2,
        duration: seconds * 0.32, ease: "power2.inOut",
      })
      // Finish on a fully clean GPU frame before handing off to the DOM.
      .to(this.canvas, { opacity: 0, duration: 0.14, ease: "power1.out" });
  }

  configure(preset: Preset, feedbackEnabled: boolean, debug: typeof this.debug) {
    this.preset = { ...preset };
    this.feedbackEnabled = feedbackEnabled;
    this.debug = debug;
    // Preserve the timeline envelope, but allow patch density/retention to be
    // tuned live during the overlap rather than overwriting its clean finish.
    if (this.params.progress < 0.84 && this.params.progress > 0.26) {
      this.params.inject = preset.inject ?? 0.045;
      this.params.retention = preset.feedback;
    }
  }

  // Lab-only: keep feedback moving with a frozen incoming proxy for comparison.
  hold(incoming: TransitionVisual) {
    this.timeline?.kill();
    this.uniforms.uIncoming.value = this.texture(incoming);
    Object.assign(this.params, { progress: 0.4, strength: 0.8, inject: this.preset.inject ?? 0.045 });
  }

  private tick = (now: number) => {
    try {
      const step = this.mobile ? 1 / 30 : 1 / 60;
      this.accumulator += Math.min((now - this.last) / 1000, 0.05);
      this.last = now;
      // Fixed simulation cadence, at most three steps after a dropped frame.
      let count = 0;
      while (this.accumulator >= step && count++ < 3) {
        this.accumulator -= step; this.elapsed += step;
        const u = this.uniforms;
        u.uHistory.value = this.read.texture;
        u.uDt.value = step; u.uTime.value = this.elapsed;
        u.uProgress.value = this.params.progress; u.uStrength.value = this.params.strength * (this.preset.strength ?? 1);
        u.uCrossover.value = this.preset.crossover ?? 0.8;
        u.uFeedback.value = this.feedbackEnabled ? this.params.retention : 0;
        u.uInject.value = this.params.inject;
        const scale = this.read.width / innerWidth;
        u.uBlockPx.value = this.preset.block * scale;
        u.uTrailPx.value = this.preset.trail * scale;
        u.uHoldHz.value = this.preset.holdHz;
        u.uDebug.value = 0;
        this.render(this.simulation, this.write);
        [this.read, this.write] = [this.write, this.read];
      }
      this.display.uniforms.uImage.value = this.debug === "previous" ? this.write.texture : this.read.texture;
      if (this.debug === "mask") {
        this.uniforms.uDebug.value = 1;
        this.uniforms.uHistory.value = this.read.texture;
        this.render(this.simulation, null);
        this.uniforms.uDebug.value = 0;
      } else this.render(this.display, null);
      this.raf = requestAnimationFrame(this.tick);
    } catch (error) {
      console.warn("[Datamosh] Rendering failed; releasing overlay.", error);
      this.stop(); this.onFailure();
    }
  };

  stop() {
    cancelAnimationFrame(this.raf); this.raf = 0;
    this.timeline?.kill(); this.settling?.kill();
    gsap.killTweensOf(this.canvas);
    this.canvas.style.opacity = "0";
    this.uniforms.uHistory.value = null;
    this.uniforms.uIncoming.value = null;
    this.copier.uniforms.uImage.value = null;
    this.display.uniforms.uImage.value = null;
    for (const texture of this.sources) texture.dispose();
    this.sources = [];
  }

  dispose() {
    this.stop();
    this.canvas.removeEventListener("webglcontextlost", this.lost);
    this.read.dispose(); this.write.dispose();
    this.simulation.dispose(); this.copier.dispose(); this.display.dispose();
    this.geometry.dispose(); this.renderer.dispose();

  }
}
