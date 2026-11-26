"use client";

import { type ThreeElement, extend, useFrame, useThree } from "@react-three/fiber";
import { type RefObject, useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { RoundedBoxGeometry } from "three/examples/jsm/geometries/RoundedBoxGeometry.js";
import { type CubeConfig, minDimension } from "@/lib/cube-config";
import {
  cubeFragmentShader,
  cubeVertexShader,
  glowFragmentShader,
  glowVertexShader,
  shadowFragmentShader,
  shadowVertexShader,
} from "./shaders/cube";

extend({ RoundedBoxGeometry });

declare module "@react-three/fiber" {
  interface ThreeElements {
    roundedBoxGeometry: ThreeElement<typeof RoundedBoxGeometry>;
  }
}

type Props = {
  /** Owned by the source component; read only inside useFrame. */
  textureRef: RefObject<THREE.Texture | null>;
  config: CubeConfig;
  animate: boolean;
  lowQuality: boolean;
  pointerRef: RefObject<{ x: number; y: number }>;
  /** Called once, on the first frame rendered with a texture bound. */
  onTextured?: () => void;
};

function textureSize(texture: THREE.Texture): [number, number] {
  const img = texture.image as HTMLVideoElement | HTMLCanvasElement | undefined;
  if (!img) return [0, 0];
  if ("videoWidth" in img) return [img.videoWidth, img.videoHeight];
  return [img.width, img.height];
}

function createUniforms() {
  return {
    uMap: { value: null as THREE.Texture | null },
    uTexAspect: { value: 1 },
    uTexel: { value: new THREE.Vector2(1 / 1024, 1 / 1024) },
    uDims: { value: new THREE.Vector3(2.4, 2.4, 2.4) },
    uSharpness: { value: 6 },
    uLensWidth: { value: 0.2 },
    uLens: { value: 0 },
    uDistortion: { value: 0 },
    uEdgeBlur: { value: 0 },
    uHaze: { value: 0 },
    uFresnelPower: { value: 2.5 },
    uRimStrength: { value: 0 },
    uTopTint: { value: new THREE.Color() },
    uBottomTint: { value: new THREE.Color() },
    uTintStrength: { value: 0 },
    uChroma: { value: 0 },
    uShade: { value: 0 },
    uDebug: { value: 0 },
    uFront: { value: 0 },
    uWrap: { value: 1 },
    uSideWrap: { value: 0.55 },
  };
}

function createGlowUniforms() {
  return {
    uTopTint: { value: new THREE.Color() },
    uBottomTint: { value: new THREE.Color() },
    uStrength: { value: 0 },
    uDims: { value: new THREE.Vector3(2.4, 2.4, 2.4) },
  };
}

function createShadowUniforms() {
  return {
    uHalf: { value: new THREE.Vector2(1, 1) },
    uRadius: { value: 0.4 },
    uSpread: { value: 0.8 },
    uStrength: { value: 0 },
    uTopTint: { value: new THREE.Color() },
    uBottomTint: { value: new THREE.Color() },
  };
}

/**
 * One mesh, one material. `box` is the UV baseline; `triplanar` the production
 * rounded shader. R3F owns (and disposes) geometry + material; everything that
 * changes per frame lives in refs and useFrame — never React state.
 */
export function VideoCube({
  textureRef,
  config,
  animate,
  lowQuality,
  pointerRef,
  onTextured,
}: Props) {
  const texturedRef = useRef(false);
  const onTexturedRef = useRef(onTextured);
  useEffect(() => {
    onTexturedRef.current = onTextured;
  });
  const groupRef = useRef<THREE.Group>(null);
  const shaderRef = useRef<THREE.ShaderMaterial>(null);
  const glowRef = useRef<THREE.ShaderMaterial>(null);
  const basicRef = useRef<THREE.MeshBasicMaterial>(null);
  const motionRef = useRef({ spin: 0, time: 0, tiltX: 0, tiltY: 0, tumble: 0 });
  const configRef = useRef(config);
  const invalidate = useThree((s) => s.invalidate);

  // Initial uniform set; values are re-applied from configRef every frame.
  const uniforms = useMemo(() => createUniforms(), []);
  const glowUniforms = useMemo(() => createGlowUniforms(), []);
  const shadowUniforms = useMemo(() => createShadowUniforms(), []);
  const shadowRef = useRef<THREE.ShaderMaterial>(null);
  const defines = useMemo(() => (lowQuality ? { LOW_QUALITY: "" } : {}), [lowQuality]);

  useEffect(() => {
    configRef.current = config;
    invalidate(); // re-render a paused (demand) canvas when tuning
  }, [config, invalidate]);

  useFrame((_, delta) => {
    const dt = Math.min(delta, 0.1);
    const c = configRef.current;
    const m = motionRef.current;
    const texture = textureRef.current;

    // ── Material sync (cheap; also covers materials remounted by mode switch)
    const shader = shaderRef.current;
    if (shader) {
      const u = shader.uniforms;
      u.uMap.value = texture;
      (u.uDims.value as THREE.Vector3).set(c.width, c.height, c.depth);
      u.uSharpness.value = c.projectionSharpness;
      u.uLensWidth.value = c.lensWidth;
      u.uLens.value = c.lensStrength;
      u.uDistortion.value = c.distortion;
      u.uEdgeBlur.value = c.edgeBlur;
      u.uHaze.value = c.haze;
      u.uFresnelPower.value = c.fresnelPower;
      u.uRimStrength.value = c.rimStrength;
      (u.uTopTint.value as THREE.Color).set(c.topTint);
      (u.uBottomTint.value as THREE.Color).set(c.bottomTint);
      u.uTintStrength.value = c.tintStrength;
      u.uChroma.value = c.chromaticOffset;
      u.uShade.value = c.shade;
      u.uDebug.value = c.debugFaces ? 1 : 0;
      u.uFront.value = c.mappingMode === "front" ? 1 : 0;
      u.uWrap.value = c.mappingMode === "wrap" ? 1 : 0;
      u.uSideWrap.value = c.sideWrap;
    }
    const glow = glowRef.current;
    if (glow) {
      const u = glow.uniforms;
      (u.uTopTint.value as THREE.Color).set(c.topTint);
      (u.uBottomTint.value as THREE.Color).set(c.bottomTint);
      u.uStrength.value = c.glowStrength;
      const grow = minDimension(c) * c.glowSize * 2;
      (u.uDims.value as THREE.Vector3).set(c.width + grow, c.height + grow, c.depth + grow);
    }
    const shadow = shadowRef.current;
    if (shadow) {
      const u = shadow.uniforms;
      (u.uHalf.value as THREE.Vector2).set(c.width / 2, c.height / 2);
      u.uRadius.value = Math.min(c.radius, minDimension(c) / 2);
      u.uSpread.value = c.shadowSpread;
      u.uStrength.value = c.shadowStrength;
      (u.uTopTint.value as THREE.Color).set(c.topTint);
      (u.uBottomTint.value as THREE.Color).set(c.bottomTint);
    }
    const basic = basicRef.current;
    if (basic && basic.map !== texture) {
      basic.map = texture;
      basic.needsUpdate = true;
    }

    // This frame renders with the texture bound — safe to reveal the canvas.
    if (texture && !texturedRef.current) {
      texturedRef.current = true;
      onTexturedRef.current?.();
    }

    // ── Aspect-cover from the live source size (video metadata may arrive late)
    if (texture) {
      const [w, h] = textureSize(texture);
      if (w && h) {
        const aspect = w / h;
        if (shader) {
          shader.uniforms.uTexAspect.value = aspect;
          (shader.uniforms.uTexel.value as THREE.Vector2).set(1 / w, 1 / h);
        }
        if (c.mappingMode === "box") {
          // Baseline: cover-crop via the texture transform (the shader path ignores it).
          if (aspect > 1) {
            texture.repeat.set(1 / aspect, 1);
            texture.offset.set((1 - 1 / aspect) / 2, 0);
          } else {
            texture.repeat.set(1, aspect);
            texture.offset.set(0, (1 - aspect) / 2);
          }
        }
      }
    }

    // ── Motion: idle yaw, gentle float/pitch, damped pointer parallax
    if (animate) {
      m.time += dt;
      m.spin += c.rotationSpeed * dt;
      if (c.tumble) m.tumble += c.rotationSpeed * 0.7 * dt;
    }
    const p = pointerRef.current;
    // Turn toward the hovering pointer (front face follows it), damped.
    m.tiltX = THREE.MathUtils.damp(m.tiltX, p.y * c.pointerTilt * 0.6, 3, dt);
    m.tiltY = THREE.MathUtils.damp(m.tiltY, p.x * c.pointerTilt, 3, dt);

    const g = groupRef.current;
    if (!g) return;
    // Static pose (yaw/pitch) + optional spin, gentle sway and pointer parallax.
    g.rotation.set(
      c.pitch + m.tiltX + Math.sin(m.time * 0.5) * 0.02 + m.tumble,
      c.yaw + m.spin + m.tiltY,
      0,
    );
    g.position.y = Math.sin(m.time * 0.8) * 0.06;
  });

  const {
    width,
    height,
    depth,
    radius,
    segments,
    mappingMode,
    glowSize,
    glowStrength,
    shadowStrength,
    shadowSpread,
    shadowOffsetX,
    shadowOffsetY,
  } = config;
  // Rounded-box radius cannot exceed half the smallest side.
  const r = Math.min(radius, minDimension(config) / 2 - 0.001);
  const grow = minDimension(config) * glowSize * 2;
  const shellRadius = r + grow / 2;

  return (
    <group ref={groupRef}>
      {shadowStrength > 0 && (
        // Coloured shadow: just behind the back face, shifted toward the back.
        // The shape occludes its centre, so it only shows around the back edges.
        <mesh position={[shadowOffsetX, shadowOffsetY, -depth / 2 - 0.02]} renderOrder={-1}>
          <planeGeometry args={[width + shadowSpread * 2.4, height + shadowSpread * 2.4]} />
          <shaderMaterial
            ref={shadowRef}
            vertexShader={shadowVertexShader}
            fragmentShader={shadowFragmentShader}
            uniforms={shadowUniforms}
            transparent
            depthWrite={false}
            toneMapped={false}
          />
        </mesh>
      )}
      {mappingMode === "box" ? (
        <mesh>
          <boxGeometry args={[width, height, depth]} />
          <meshBasicMaterial ref={basicRef} toneMapped={false} />
        </mesh>
      ) : (
        <>
          <mesh>
            <roundedBoxGeometry args={[width, height, depth, segments, r]} />
            <shaderMaterial
              key={lowQuality ? "lq" : "hq"}
              ref={shaderRef}
              vertexShader={cubeVertexShader}
              fragmentShader={cubeFragmentShader}
              uniforms={uniforms}
              defines={defines}
              // Footage must match a DOM <video>: no tone mapping on the cube.
              toneMapped={false}
            />
          </mesh>
          {glowStrength > 0 && glowSize > 0 && (
            // Halo: back faces of a slightly larger shell, depth-tested against
            // the cube so it only shows outside the silhouette.
            <mesh renderOrder={1}>
              <roundedBoxGeometry
                args={[width + grow, height + grow, depth + grow, segments, shellRadius]}
              />
              <shaderMaterial
                ref={glowRef}
                vertexShader={glowVertexShader}
                fragmentShader={glowFragmentShader}
                uniforms={glowUniforms}
                side={THREE.BackSide}
                transparent
                depthWrite={false}
                toneMapped={false}
              />
            </mesh>
          )}
        </>
      )}
    </group>
  );
}
