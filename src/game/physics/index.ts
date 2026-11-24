export { PhysicsWorld, type PhysicsWorldProps } from './PhysicsWorld';
export {
  createExplorerCharacterController,
  computeCameraRelativeMoveDir,
  approachHorizontalVelocity,
  stepVerticalKinematics,
  stepStamina,
  dampAngle,
  DEFAULT_HORIZONTAL_CONFIG,
  ICE_HORIZONTAL_CONFIG,
  resolveHorizontalMoveConfig,
  type Vec2XZ,
  type VerticalKinematicsState,
  type StaminaState,
} from './characterController';
export { resolveCameraDistanceWithRaycast } from './raycast';
export {
  setMovingPlatformDelta,
  getMovingPlatformDelta,
  removeMovingPlatformDelta,
} from './movingPlatforms';
export {
  registerIceCollider,
  unregisterIceCollider,
  isIceCollider,
} from './iceSurfaces';
export { isPlayerPayload } from './sensorHelpers';
