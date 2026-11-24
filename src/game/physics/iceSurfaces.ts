const iceColliders = new Set<number>();

export function registerIceCollider(colliderHandle: number): void {
  iceColliders.add(colliderHandle);
}

export function unregisterIceCollider(colliderHandle: number): void {
  iceColliders.delete(colliderHandle);
}

export function isIceCollider(colliderHandle: number): boolean {
  return iceColliders.has(colliderHandle);
}
