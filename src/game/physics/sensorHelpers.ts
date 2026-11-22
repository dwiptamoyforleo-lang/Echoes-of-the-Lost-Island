import type { CollisionPayload, IntersectionEnterPayload } from '@react-three/rapier';
import { playerTelemetry } from '@/src/game/player/playerTelemetry';

export function isPlayerPayload(
  payload: IntersectionEnterPayload | CollisionPayload,
): boolean {
  if (
    playerTelemetry.playerColliderHandle !== null &&
    payload.other.collider.handle === playerTelemetry.playerColliderHandle
  ) {
    return true;
  }
  const userData = payload.other.rigidBodyObject?.userData as
    | { isPlayer?: boolean }
    | undefined;
  return Boolean(userData?.isPlayer);
}
