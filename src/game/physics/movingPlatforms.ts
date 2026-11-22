export interface PlatformDelta {
  x: number;
  y: number;
  z: number;
}

const platformDeltas = new Map<number, PlatformDelta>();

export function setMovingPlatformDelta(
  colliderHandle: number,
  dx: number,
  dy: number,
  dz: number,
): void {
  let entry = platformDeltas.get(colliderHandle);
  if (!entry) {
    entry = { x: dx, y: dy, z: dz };
    platformDeltas.set(colliderHandle, entry);
  } else {
    entry.x = dx;
    entry.y = dy;
    entry.z = dz;
  }
}

export function getMovingPlatformDelta(
  colliderHandle: number,
): PlatformDelta | undefined {
  return platformDeltas.get(colliderHandle);
}

export function removeMovingPlatformDelta(colliderHandle: number): void {
  platformDeltas.delete(colliderHandle);
}
