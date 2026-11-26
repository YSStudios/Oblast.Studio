"use client";

import { type ThreeElement, extend, useFrame, useThree } from "@react-three/fiber";
import { type RefObject, useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { RoundedBoxGeometry } from "three/examples/jsm/geometries/RoundedBoxGeometry.js";
import type { CubeConfig } from "@/lib/cube-config";
import { cubeFragmentShader, cubeVertexShader } from "./shaders/cube";

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
    uSize: { value: 2.4 },
    uSharpness: { value: 6 },
    uDistortion: { value: 0 },
    uEdgeBlur: { value: 0 },
    uFresnelPower: { value: 2.5 },
    uRimStrength: { value: 0 },
    uTopTint: { value: new THREE.Color() },
    uBottomTint: { value: new THREE.Color() },
    uTintStrength: { value: 0 },
    uChroma: { value: 0 },
    uShade: { value: 0 },
    uDebug: { value: 0 },
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
  const basicRef = useRef<THREE.MeshBasicMaterial>(null);
  const motionRef = useRef({ spin: 0.65, time: 0, tiltX: 0, tiltY: 0, tumble: 0 });
  const configRef = useRef(config);
  const invalidate = useThree((s) => s.invalidate);

  // Initial uniform set; values are re-applied from configRef every frame.
  const uniforms = useMemo(() => createUniforms(), []);
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
      u.uSize.value = c.size;
      u.uSharpness.value = c.projectionSharpness;
      u.uDistortion.value = c.distortion;
      u.uEdgeBlur.value = c.edgeBlur;
      u.uFresnelPower.value = c.fresnelPower;
      u.uRimStrength.value = c.rimStrength;
      (u.uTopTint.value as THREE.Color).set(c.topTint);
      (u.uBottomTint.value as THREE.Color).set(c.bottomTint);
      u.uTintStrength.value = c.tintStrength;
      u.uChroma.value = c.chromaticOffset;
      u.uShade.value = c.shade;
      u.uDebug.value = c.debugFaces ? 1 : 0;
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
    m.tiltX = THREE.MathUtils.damp(m.tiltX, -p.y * c.pointerTilt, 4, dt);
    m.tiltY = THREE.MathUtils.damp(m.tiltY, p.x * c.pointerTilt, 4, dt);

    const g = groupRef.current;
    if (!g) return;
    g.rotation.set(m.tiltX + Math.sin(m.time * 0.5) * 0.04 + m.tumble, m.spin + m.tiltY, 0);
    g.position.y = Math.sin(m.time * 0.8) * 0.06;
  });

  const { size, radius, segments, mappingMode } = config;

  return (
    <group ref={groupRef}>
      {mappingMode === "box" ? (
        <mesh>
          <boxGeometry args={[size, size, size]} />
          <meshBasicMaterial ref={basicRef} toneMapped={false} />
        </mesh>
      ) : (
        <mesh>
          <roundedBoxGeometry args={[size, size, size, segments, radius]} />
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
      )}
    </group>
  );
}
