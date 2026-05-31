import * as THREE from "three";
import type { Vec3 } from "../types/GameState";

export function yawForForwardDirection(direction: THREE.Vector3) {
  if (direction.lengthSq() < 0.0001) return 0;
  return Math.atan2(direction.x, -direction.z);
}

export function yawToFacePoint(from: Vec3, to: Vec3) {
  return yawForForwardDirection(
    new THREE.Vector3(to.x - from.x, 0, to.z - from.z),
  );
}
