"use client";

import { useFrame, useThree } from "@react-three/fiber";
import { type RefObject, useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { chainLayout } from "@/lib/chain-layout";
import type { CubeConfig } from "@/lib/cube-config";
import { chainFragmentShader, chainVertexShader } from "./shaders/chain";
// Registers <roundedBoxGeometry> with R3F (side-effect import).
import "./VideoCube";

type Props = {
  textureRef: RefObject<THREE.Texture | null>;
  config: CubeConfig;
  animate: boolean;
  lowQuality: boolean;
  pointerRef: RefObject<{ x: number; y: number }>;
  onTextured?: () => void;
};

function createUniforms() {
  return {
    uMap: { value: null as THREE.Texture | null },
    uTexAspect: { value: 1 },
    uTexel: { value: new THREE.Vector2(1 / 1024, 1 / 1024) },
    uResolution: { value: new THREE.Vector2(1, 1) },
    uRefraction: { value: 0 },
    uEdgeBlur: { value: 0 },
    uChroma: { value: 0 },
    uHaze: { value: 0 },
    uTint: { value: new THREE.Color() },
    uTintStrength: { value: 0 },
    uRimStrength: { value: 0 },
    uFresnelPower: { value: 2 },
    uShade: { value: 0 },
    uDefocus: { value: 0 },
    uEdgeSoft: { value: 0 },
  };
}

function textureSize(texture: THREE.Texture): [number, number] {
  const img = texture.image as HTMLVideoElement | HTMLCanvasElement | undefined;
  if (!img) return [0, 0];
  if ("videoWidth" in img) return [img.videoWidth, img.videoHeight];
  return [img.width, img.height];
}

/**
 * Glass blocks laid end-to-end along a 3D path, seen through the perspective
 * camera so the run recedes into depth. The video is projected across all of
 * them in screen space (one continuous picture) and each block refracts it.
 */
export function VideoChain({ textureRef, config, animate, lowQuality, pointerRef, onTextured }: Props) {
  const groupRef = useRef<THREE.Group>(null);
  const materialRefs = useRef<(THREE.ShaderMaterial | null)[]>([]);
  const motionRef = useRef({ time: 0, tiltX: 0, tiltY: 0 });
  const configRef = useRef(config);
  const texturedRef = useRef(false);
  const onTexturedRef = useRef(onTextured);
  const resolution = useRef(new THREE.Vector2());
  const invalidate = useThree((s) => s.invalidate);

  useEffect(() => {
    onTexturedRef.current = onTextured;
  });
  useEffect(() => {
    configRef.current = config;
    invalidate();
  }, [config, invalidate]);

  // Recompute the layout only when its inputs change (not on every tuning tweak).
  const { blockLength, blockGap, blockLean, blockTwist } = config;
  const pathKey = JSON.stringify(config.chainPath);
  const tintKey = config.chainTints.join(",");
  const blocks = useMemo(
    () =>
      chainLayout({
        chainPath: JSON.parse(pathKey) as CubeConfig["chainPath"],
        blockLength,
        blockGap,
        blockLean,
        blockTwist,
        chainTints: tintKey ? tintKey.split(",") : [],
      }),
    [pathKey, blockLength, blockGap, blockLean, blockTwist, tintKey],
  );
  const uniformSets = useMemo(() => blocks.map(() => createUniforms()), [blocks]);
  const defines = useMemo(() => (lowQuality ? { LOW_QUALITY: "" } : {}), [lowQuality]);

  useFrame((state, delta) => {
    const dt = Math.min(delta, 0.1);
    const c = configRef.current;
    const m = motionRef.current;
    const texture = textureRef.current;

    state.gl.getDrawingBufferSize(resolution.current);
    const [tw, th] = texture ? textureSize(texture) : [0, 0];

    materialRefs.current.forEach((mat, i) => {
      if (!mat) return;
      const u = mat.uniforms;
      u.uMap.value = texture;
      if (tw && th) {
        u.uTexAspect.value = tw / th;
        (u.uTexel.value as THREE.Vector2).set(1 / tw, 1 / th);
      }
      (u.uResolution.value as THREE.Vector2).copy(resolution.current);
      u.uRefraction.value = c.refraction;
      u.uEdgeBlur.value = c.edgeBlur;
      u.uChroma.value = c.chromaticOffset;
      u.uHaze.value = c.haze;
      (u.uTint.value as THREE.Color).set(blocks[i]?.tint ?? "#ffffff");
      u.uTintStrength.value = c.chainTintStrength;
      u.uRimStrength.value = c.rimStrength;
      u.uFresnelPower.value = c.fresnelPower;
      u.uShade.value = c.shade;
      u.uDefocus.value = c.defocus * Math.abs(i - c.focusIndex);
      u.uEdgeSoft.value = c.edgeSoftness;
    });

    if (texture && !texturedRef.current) {
      texturedRef.current = true;
      onTexturedRef.current?.();
    }

    // Gentle float + turn toward the hovering pointer (no idle spin).
    if (animate) m.time += dt;
    const p = pointerRef.current;
    m.tiltX = THREE.MathUtils.damp(m.tiltX, p.y * c.pointerTilt * 0.4, 3, dt);
    m.tiltY = THREE.MathUtils.damp(m.tiltY, p.x * c.pointerTilt * 0.6, 3, dt);
    const g = groupRef.current;
    if (!g) return;
    g.rotation.set(m.tiltX + Math.sin(m.time * 0.5) * 0.01, m.tiltY, 0);
    g.position.y = Math.sin(m.time * 0.8) * 0.06;
  });

  const { blockHeight, blockThickness, blockRadius, segments, edgeSoftness } = config;
  const r = Math.min(blockRadius, Math.min(blockLength, blockHeight, blockThickness) / 2 - 0.001);
  const soft = edgeSoftness > 0 || config.defocus > 0;

  return (
    <group ref={groupRef}>
      {blocks.map((b, i) => (
        <mesh key={i} position={b.position} quaternion={b.quaternion}>
          <roundedBoxGeometry args={[blockLength, blockHeight, blockThickness, segments, r]} />
          <shaderMaterial
            key={`${lowQuality ? "lq" : "hq"}-${soft ? "soft" : "solid"}`}
            ref={(mat: THREE.ShaderMaterial | null) => {
              materialRefs.current[i] = mat;
            }}
            vertexShader={chainVertexShader}
            fragmentShader={chainFragmentShader}
            uniforms={uniformSets[i]}
            defines={defines}
            // Soft silhouettes need blending; three sorts these back-to-front.
            transparent={soft}
            toneMapped={false}
          />
        </mesh>
      ))}
    </group>
  );
}
