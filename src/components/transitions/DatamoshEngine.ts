import * as THREE from "three";
import { gsap } from "gsap";
import type { TransitionVisual } from "./capture";
import { presets, type Preset } from "./presets";
import { feedback, vertex } from "./shaders/feedback";
import { copy, display } from "./shaders/display";
import { getTransitionPerformance, transitionSize, TransitionFrameBudget } from "./performance";

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
  private profile = getTransitionPerformance();
  private disposed = false;
  private warming?: Promise<void>;
  private budget = new TransitionFrameBudget(this.profile.fps);
  private lastRendered = 0;
  private freezeHistory = false;
  private params = { progress: 0, strength: 0, inject: 0.005, retention: 0.96, reveal: 0 };
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
  private display = new THREE.ShaderMaterial({ vertexShader: vertex, fragmentShader: display, uniforms: {
    uImage: { value: null as THREE.Texture | null },
    uResolution: this.uniforms.uResolution,
    uBlockPx: this.uniforms.uBlockPx,
    uReveal: { value: 0 },
  }, depthTest: false, depthWrite: false });

  constructor(private canvas: HTMLCanvasElement, private onFailure: () => void) {
    const context = canvas.getContext("webgl2", { antialias: false, alpha: true, premultipliedAlpha: false, powerPreference: "low-power" });
    if (!context || context.isContextLost()) throw new Error("WebGL2 unavailable");
    // A disposed renderer may leave unpack state on this persistent canvas.
    context.pixelStorei(context.UNPACK_FLIP_Y_WEBGL, false);
    context.pixelStorei(context.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);
    this.renderer = new THREE.WebGLRenderer({ canvas, context, antialias: false, alpha: true, premultipliedAlpha: false });
    this.renderer.setClearColor(0x000000, 0);
    this.renderer.setPixelRatio(1);
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.NoToneMapping;
    this.renderer.debug.onShaderError = (gl, program, vertexShader, fragmentShader) => {
      console.warn("[Datamosh] Shader compilation failed", gl.getProgramInfoLog(program), gl.getShaderInfoLog(vertexShader), gl.getShaderInfoLog(fragmentShader));
      this.failed = true;
    };
    const { width: w, height: h } = transitionSize(this.profile, innerWidth, innerHeight);
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

  get captureSize() { return { width: this.read.width, height: this.read.height }; }

  prewarm() {
    return this.warming ??= this.compileMaterials();
  }

  private async compileMaterials() {
    // Parallel shader compilation avoids synchronously waiting for linking on
    // a tap. Start this on idle/intent and let the controller bound the wait.
    for (const material of [this.simulation, this.copier, this.display]) {
      if (this.disposed) return;
      // Three keys programs by output color space as well as material. The
      // feedback/copy passes run in a linear offscreen target; warming them
      // against the sRGB screen would still compile new programs on first use.
      this.renderer.setRenderTarget(material === this.display ? null : this.read);
      this.quad.material = material;
      await this.renderer.compileAsync(this.scene, this.camera);
    }
    if (!this.disposed) this.renderer.setRenderTarget(null);
    if (this.failed) throw new Error("Datamosh shader failed");
  }

  private reduceQuality(action: "reduce" | "dissolve") {
    if (action === "dissolve") {
      // If downsampling was insufficient, stop the expensive simulation and
      // dissolve the retained history into the live DOM on the same timeline.
      this.freezeHistory = true;
      this.canvas.dataset.datamoshQuality = "dissolve";
      return;
    }
    const longest = Math.max(this.read.width, this.read.height);
    const factor = Math.max(0.75, Math.min(1, 192 / longest));
    if (factor >= 1) return;
    const width = Math.max(1, Math.round(this.read.width * factor));
    const height = Math.max(1, Math.round(this.read.height * factor));
    const previous = this.read;
    const previousWrite = this.write;
    const next = previous.clone();
    const nextWrite = previousWrite.clone();
    next.setSize(width, height); nextWrite.setSize(width, height);
    // Preserve the accumulated trails on GPU while changing resolution.
    this.copier.uniforms.uImage.value = previous.texture;
    this.render(this.copier, next);
    this.read = next; this.write = nextWrite;
    this.copier.uniforms.uImage.value = null;
    this.renderer.setSize(width, height, false);
    this.uniforms.uResolution.value.set(width, height);
    this.uniforms.uBlockPx.value = this.preset.block * width / innerWidth;
    this.display.uniforms.uImage.value = next.texture;
    this.render(this.display, null);
    previous.dispose(); previousWrite.dispose();
    this.canvas.dataset.datamoshQuality = "reduced";
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
    this.display.uniforms.uReveal.value = 0;
    const texture = this.texture(source);
    this.uniforms.uIncoming.value = texture;
    this.uniforms.uOrigin.value.set(source.origin.x, source.origin.y);
    this.uniforms.uDirection.value.set(source.origin.x < 0.5 ? 1 : -1, 0.15);
    this.copier.uniforms.uImage.value = texture;
    // Seed with a separate copy pass. Never sample a target being written.
    this.render(this.copier, this.read);
    this.display.uniforms.uImage.value = this.read.texture;
    this.render(this.display, null);
    Object.assign(this.params, { progress: 0, strength: 0, inject: 0.005, retention: preset.feedback, reveal: 0 });
    this.canvas.style.opacity = "1";
    this.last = performance.now(); this.elapsed = 0; this.accumulator = 0;
    this.budget = new TransitionFrameBudget(this.profile.fps);
    this.lastRendered = this.last; this.freezeHistory = false;
    this.canvas.dataset.datamoshFps = String(this.profile.fps);
    this.canvas.dataset.datamoshQuality = "normal";
    this.raf = requestAnimationFrame(this.tick);
    const cover = Math.min(0.18, preset.duration / 4000);
    this.timeline = gsap.timeline()
      .to(this.params, { progress: 0.26, strength: 1, duration: cover, ease: "power2.in" })
      .call(covered)
      .to(this.params, { strength: 0.16, duration: 0.35, ease: "power2.out" });
  }

  resolve(incoming: TransitionVisual, done: () => void, onReveal?: () => void) {
    this.timeline?.kill();
    this.uniforms.uIncoming.value = this.texture(incoming);
    const seconds = Math.max(0.35, this.preset.duration / 1000 - 0.18);
    // Start injecting the destination immediately, while outgoing history is
    // still displaced at full strength. Keep retention high through the merge.
    this.params.inject = this.preset.inject ?? 0.045;
    this.params.strength = Math.max(0.8, this.params.strength);
    const handoff = Math.min(0.55, Math.max(0.3, seconds * 0.5));
    this.settling = gsap.timeline({ onComplete: () => {
      // Cleanup must remove an already-transparent surface even when GSAP's
      // last update runs before our render RAF on a slow frame.
      this.display.uniforms.uReveal.value = 1;
      this.render(this.display, null);
      done();
    } })
      .to(this.params, {
        progress: 0.8, strength: 0.65,
        duration: seconds * 0.68, ease: "none",
      })
      .to(this.params, {
        progress: 1, strength: 0, inject: 1, retention: 0.2,
        duration: seconds * 0.32, ease: "power2.inOut",
      })
      // Overlap the live page reveal with settling trails, rather than
      // finishing on a clean approximation and then swapping to the DOM.
      .call(() => onReveal?.(), [], seconds - handoff)
      .to(this.params, { reveal: 1, duration: handoff, ease: "sine.inOut" }, seconds - handoff);
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
      const step = 1 / this.profile.fps;
      this.accumulator += Math.min((now - this.last) / 1000, 0.05);
      this.last = now;
      // Present only when a simulation step is due: no extra display passes
      // at 60/120 Hz on a 30 Hz mobile effect, and no catch-up render bursts.
      if (this.accumulator + 0.0005 < step) {
        this.raf = requestAnimationFrame(this.tick);
        return;
      }
      const dt = Math.min(this.accumulator, 0.05);
      this.accumulator = Math.max(0, this.accumulator - step) % step;
      this.elapsed += dt;
      const started = performance.now();
      const gap = now - this.lastRendered;
      this.lastRendered = now;
      if (!this.freezeHistory) {
        const u = this.uniforms;
        u.uHistory.value = this.read.texture;
        u.uDt.value = dt; u.uTime.value = this.elapsed;
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
      this.display.uniforms.uReveal.value = this.params.reveal;
      this.display.uniforms.uImage.value = this.debug === "previous" ? this.write.texture : this.read.texture;
      if (this.debug === "mask") {
        this.uniforms.uDebug.value = 1;
        this.uniforms.uHistory.value = this.read.texture;
        this.render(this.simulation, null);
        this.uniforms.uDebug.value = 0;
      } else this.render(this.display, null);
      // Frame gaps include GPU backpressure; command submission time alone
      // would miss it. Ignore startup frames and react only to sustained load.
      if (this.profile.mobile && !this.freezeHistory) {
        const action = this.budget.sample(gap, performance.now() - started);
        if (action) this.reduceQuality(action);
      }
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
    this.disposed = true;
    this.stop();
    this.canvas.removeEventListener("webglcontextlost", this.lost);
    this.read.dispose(); this.write.dispose();
    this.simulation.dispose(); this.copier.dispose(); this.display.dispose();
    this.geometry.dispose(); this.renderer.dispose();

  }
}
