import { Ray, QueryFilterFlags } from '@dimforge/rapier3d-compat';
import type RAPIER from '@dimforge/rapier3d-compat';
import * as THREE from 'three';

const _dir = new THREE.Vector3();
const _rayOrigin = { x: 0, y: 0, z: 0 };
const _rayDir = { x: 0, y: 0, z: 1 };
let _rapierRay: Ray | null = null;

/**
 * Raycasts from the player focus anchor toward the desired camera position
 * and returns the safe camera distance (pulling inward if obstructed).
 */
export function resolveCameraDistanceWithRaycast(
  world: RAPIER.World,
  origin: THREE.Vector3,
  desiredCamPos: THREE.Vector3,
  desiredDistance: number,
  excludeColliderHandle: number | null,
  minDistance = 0.85,
  wallPadding = 0.3,
): number {
  _dir.subVectors(desiredCamPos, origin);
  const fullDist = _dir.length();
  if (fullDist < 1e-4) {
    return desiredDistance;
  }
  _dir.divideScalar(fullDist);

  if (!_rapierRay) {
    _rapierRay = new Ray(_rayOrigin, _rayDir);
  }
  _rapierRay.origin.x = origin.x;
  _rapierRay.origin.y = origin.y;
  _rapierRay.origin.z = origin.z;
  _rapierRay.dir.x = _dir.x;
  _rapierRay.dir.y = _dir.y;
  _rapierRay.dir.z = _dir.z;

  const excludeCollider =
    excludeColliderHandle !== null
      ? world.getCollider(excludeColliderHandle)
      : undefined;

  const hit = world.castRay(
    _rapierRay,
    fullDist,
    true,
    QueryFilterFlags.EXCLUDE_SENSORS,
    undefined,
    excludeCollider,
    undefined,
  );

  if (!hit) {
    return desiredDistance;
  }

  const ratio = Math.max(0, (hit.timeOfImpact - wallPadding) / fullDist);
  return Math.max(minDistance, desiredDistance * ratio);
}
