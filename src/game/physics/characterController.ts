import type RAPIER from '@dimforge/rapier3d-compat';

export interface HorizontalMoveConfig {
  walkSpeed: number;
  sprintSpeed: number;
  acceleration: number;
  deceleration: number;
  airControlFactor: number;
}

export const DEFAULT_HORIZONTAL_CONFIG: HorizontalMoveConfig = {
  walkSpeed: 5.5,
  sprintSpeed: 9.0,
  acceleration: 34.0,
  deceleration: 28.0,
  airControlFactor: 0.55,
};

export const ICE_HORIZONTAL_CONFIG: HorizontalMoveConfig = {
  walkSpeed: 6.3,
  sprintSpeed: 9.8,
  acceleration: 11.5,
  deceleration: 3.1,
  airControlFactor: 0.55,
};

export function resolveHorizontalMoveConfig(
  onIce: boolean,
): HorizontalMoveConfig {
  return onIce ? ICE_HORIZONTAL_CONFIG : DEFAULT_HORIZONTAL_CONFIG;
}

export interface VerticalKinematicsConfig {
  gravity: number;
  fallGravityMultiplier: number;
  jumpSpeed: number;
  coyoteDuration: number;
  jumpBufferDuration: number;
  maxFallSpeed: number;
  groundedStickVelocity: number;
}

export const DEFAULT_VERTICAL_CONFIG: VerticalKinematicsConfig = {
  gravity: 24.0,
  fallGravityMultiplier: 1.35,
  jumpSpeed: 9.6,
  coyoteDuration: 0.11,
  jumpBufferDuration: 0.12,
  maxFallSpeed: 28.0,
  groundedStickVelocity: -0.6,
};

export interface VerticalKinematicsState {
  vy: number;
  grounded: boolean;
  coyoteTimer: number;
  jumpBufferTimer: number;
  justJumped: boolean;
}

export interface Vec2XZ {
  x: number;
  z: number;
}

/**
 * Computes normalized XZ movement direction relative to camera yaw.
 * At yaw = 0, camera looks toward -Z, so forward (+1) maps to (0, -1)
 * and right (+1) maps to (+1, 0).
 */
export function computeCameraRelativeMoveDir(
  forwardInput: number,
  rightInput: number,
  cameraYaw: number,
  out: Vec2XZ = { x: 0, z: 0 },
): Vec2XZ {
  if (forwardInput === 0 && rightInput === 0) {
    out.x = 0;
    out.z = 0;
    return out;
  }

  const sinYaw = Math.sin(cameraYaw);
  const cosYaw = Math.cos(cameraYaw);

  // Camera forward on XZ plane is (-sinYaw, -cosYaw); right is (cosYaw, -sinYaw)
  const rawX = -sinYaw * forwardInput + cosYaw * rightInput;
  const rawZ = -cosYaw * forwardInput - sinYaw * rightInput;
  const len = Math.hypot(rawX, rawZ);

  if (len > 1e-6) {
    out.x = rawX / len;
    out.z = rawZ / len;
  } else {
    out.x = 0;
    out.z = 0;
  }
  return out;
}

/**
 * Smoothly accelerates or decelerates horizontal velocity toward the target vector.
 */
export function approachHorizontalVelocity(
  current: Vec2XZ,
  moveDir: Vec2XZ,
  sprinting: boolean,
  grounded: boolean,
  dt: number,
  config: HorizontalMoveConfig = DEFAULT_HORIZONTAL_CONFIG,
): Vec2XZ {
  const hasInput = moveDir.x * moveDir.x + moveDir.z * moveDir.z > 1e-6;
  const maxSpeed = sprinting ? config.sprintSpeed : config.walkSpeed;
  const targetX = hasInput ? moveDir.x * maxSpeed : 0;
  const targetZ = hasInput ? moveDir.z * maxSpeed : 0;

  const baseRate = hasInput ? config.acceleration : config.deceleration;
  const rate = grounded ? baseRate : baseRate * config.airControlFactor;
  const maxStep = rate * dt;

  const dx = targetX - current.x;
  const dz = targetZ - current.z;
  const dist = Math.hypot(dx, dz);

  if (dist <= maxStep || dist < 1e-6) {
    current.x = targetX;
    current.z = targetZ;
  } else {
    const scale = maxStep / dist;
    current.x += dx * scale;
    current.z += dz * scale;
  }

  return current;
}

/**
 * Advances vertical velocity, coyote time, jump buffering, and jump triggering.
 * Never allows jumping in mid-air after coyote time expires.
 */
export function stepVerticalKinematics(
  state: VerticalKinematicsState,
  jumpJustPressed: boolean,
  jumpHeld: boolean,
  dt: number,
  config: VerticalKinematicsConfig = DEFAULT_VERTICAL_CONFIG,
): VerticalKinematicsState {
  state.justJumped = false;

  if (state.grounded) {
    state.coyoteTimer = config.coyoteDuration;
  } else {
    state.coyoteTimer = Math.max(0, state.coyoteTimer - dt);
  }

  if (jumpJustPressed) {
    state.jumpBufferTimer = config.jumpBufferDuration;
  } else {
    state.jumpBufferTimer = Math.max(0, state.jumpBufferTimer - dt);
  }

  if (state.jumpBufferTimer > 0 && state.coyoteTimer > 0) {
    state.vy = config.jumpSpeed;
    state.grounded = false;
    state.coyoteTimer = 0;
    state.jumpBufferTimer = 0;
    state.justJumped = true;
    return state;
  }

  if (state.grounded && state.vy <= 0) {
    state.vy = config.groundedStickVelocity;
  } else {
    // Variable jump height: extra gravity if ascending and jump key released early
    let g = config.gravity;
    if (state.vy < 0) {
      g *= config.fallGravityMultiplier;
    } else if (state.vy > 0 && !jumpHeld) {
      g *= 1.85;
    }
    state.vy = Math.max(-config.maxFallSpeed, state.vy - g * dt);
  }

  return state;
}

export function shortestAngleDelta(from: number, to: number): number {
  let diff = ((to - from + Math.PI) % (Math.PI * 2)) - Math.PI;
  if (diff < -Math.PI) diff += Math.PI * 2;
  return diff;
}

export function dampAngle(
  current: number,
  target: number,
  lambda: number,
  dt: number,
): number {
  const delta = shortestAngleDelta(current, target);
  const t = 1 - Math.exp(-lambda * dt);
  return current + delta * t;
}

export function createExplorerCharacterController(
  world: RAPIER.World,
): RAPIER.KinematicCharacterController {
  const controller = world.createCharacterController(0.02);
  controller.setUp({ x: 0, y: 1, z: 0 });
  controller.setMaxSlopeClimbAngle((48 * Math.PI) / 180);
  controller.setMinSlopeSlideAngle((52 * Math.PI) / 180);
  controller.enableAutostep(0.45, 0.25, false);
  controller.enableSnapToGround(0.35);
  controller.setSlideEnabled(true);
  controller.setApplyImpulsesToDynamicBodies(true);
  return controller;
}

export interface StaminaState {
  value: number;
  exhausted: boolean;
}

export function stepStamina(
  state: StaminaState,
  wantsSprint: boolean,
  isMoving: boolean,
  dt: number,
): { state: StaminaState; canSprint: boolean } {
  if (wantsSprint && isMoving && !state.exhausted && state.value > 0) {
    const nextValue = Math.max(0, state.value - 26 * dt);
    const exhausted = nextValue <= 0;
    state.value = nextValue;
    state.exhausted = exhausted;
    return { state, canSprint: true };
  }

  const regenRate = isMoving ? 15 : 24;
  const nextValue = Math.min(100, state.value + regenRate * dt);
  const exhausted = state.exhausted ? nextValue < 22 : false;
  state.value = nextValue;
  state.exhausted = exhausted;
  return { state, canSprint: false };
}

