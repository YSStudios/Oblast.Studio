import * as THREE from "three";
import type { CubeConfig } from "./cube-config";

export type ChainBlock = {
  position: [number, number, number];
  quaternion: [number, number, number, number];
  tint: string;
  /** 0 = nearest block. */
  index: number;
};

type ChainParams = Pick<
  CubeConfig,
  "chainPath" | "blockLength" | "blockGap" | "blockLean" | "blockTwist" | "chainTints"
>;

/**
 * Glass blocks laid end-to-end along a smooth 3D path (near → far). Each block's
 * length runs along the path tangent, so from the camera you see its broad face
 * skewed by perspective as the run recedes; every block then leans and twists a
 * little around the path. Pure function: no React, no GPU resources.
 */
export function chainLayout(c: ChainParams): ChainBlock[] {
  if (c.chainPath.length < 2) return [];
  const curve = new THREE.CatmullRomCurve3(
    c.chainPath.map(([x, y, z]) => new THREE.Vector3(x, y, z)),
    false,
    "centripetal",
  );
  const length = curve.getLength();
  const step = Math.max(0.2, c.blockLength + c.blockGap);
  const count = Math.max(1, Math.floor(length / step));
  const offset = (length - count * step) / 2; // centre the run on the path

  const up = new THREE.Vector3(0, 1, 0);
  const basis = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const spin = new THREE.Quaternion();
  const xAxis = new THREE.Vector3(1, 0, 0);

  return Array.from({ length: count }, (_, i) => {
    const u = THREE.MathUtils.clamp((offset + (i + 0.5) * step) / length, 0, 1);
    const p = curve.getPointAt(u);
    const tangent = curve.getTangentAt(u).normalize();
    // Basis: X along the path, Z = broad face normal (toward camera), Y completes it.
    const z = new THREE.Vector3().crossVectors(tangent, up).normalize();
    if (z.lengthSq() < 1e-6) z.set(0, 0, 1);
    const y = new THREE.Vector3().crossVectors(z, tangent).normalize();
    basis.makeBasis(tangent, y, z);
    q.setFromRotationMatrix(basis);
    spin.setFromAxisAngle(xAxis, c.blockLean + c.blockTwist * i);
    q.multiply(spin);
    return {
      position: [p.x, p.y, p.z],
      quaternion: [q.x, q.y, q.z, q.w],
      tint: c.chainTints.length ? c.chainTints[i % c.chainTints.length] : "#ffffff",
      index: i,
    };
  });
}
