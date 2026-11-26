import test from 'node:test';
import assert from 'node:assert/strict';
import {
  approachHorizontalVelocity,
  computeCameraRelativeMoveDir,
  dampAngle,
  DEFAULT_HORIZONTAL_CONFIG,
  resolveTargetMoveSpeed,
  shortestAngleDelta,
  stepStamina,
  stepVerticalKinematics,
  type StaminaState,
  type VerticalKinematicsState,
} from './characterController';

test('computeCameraRelativeMoveDir maps WASD relative to camera yaw', () => {
  const forwardAtZero = computeCameraRelativeMoveDir(1, 0, 0);
  assert.ok(Math.abs(forwardAtZero.x) < 1e-6);
  assert.ok(Math.abs(forwardAtZero.z + 1) < 1e-6);

  const rightAtZero = computeCameraRelativeMoveDir(0, 1, 0);
  assert.ok(Math.abs(rightAtZero.x - 1) < 1e-6);
  assert.ok(Math.abs(rightAtZero.z) < 1e-6);

  // Camera rotated 90 degrees left (+PI/2): forward looks toward -X
  const forwardRotated = computeCameraRelativeMoveDir(1, 0, Math.PI / 2);
  assert.ok(Math.abs(forwardRotated.x + 1) < 1e-6);
  assert.ok(Math.abs(forwardRotated.z) < 1e-6);

  // Diagonal input stays normalized to unit length
  const diag = computeCameraRelativeMoveDir(1, 1, 0.4);
  assert.ok(Math.abs(Math.hypot(diag.x, diag.z) - 1) < 1e-6);
});

test('approachHorizontalVelocity accelerates smoothly and decelerates to zero', () => {
  const vel = { x: 0, z: 0 };
  const dir = { x: 0, z: -1 };

  approachHorizontalVelocity(vel, dir, false, true, 0.05);
  assert.ok(vel.z < 0 && vel.z > -5.5);

  for (let i = 0; i < 20; i++) {
    approachHorizontalVelocity(vel, dir, false, true, 0.05);
  }
  assert.ok(Math.abs(vel.z + 5.5) < 1e-5);

  // Release input -> decelerates to 0
  for (let i = 0; i < 20; i++) {
    approachHorizontalVelocity(vel, { x: 0, z: 0 }, false, true, 0.05);
  }
  assert.equal(vel.x, 0);
  assert.equal(vel.z, 0);
});

test('stepVerticalKinematics enforces grounded jump, coyote time, jump buffer, and no mid-air jump', () => {
  const state: VerticalKinematicsState = {
    vy: 0,
    grounded: true,
    coyoteTimer: 0,
    jumpBufferTimer: 0,
    justJumped: false,
  };

  // Walking off ledge starts coyote window
  state.grounded = true;
  stepVerticalKinematics(state, false, false, 0.016);
  state.grounded = false;
  stepVerticalKinematics(state, false, false, 0.05);
  assert.ok(state.coyoteTimer > 0);

  // Jump within coyote time succeeds
  stepVerticalKinematics(state, true, true, 0.016);
  assert.equal(state.justJumped, true);
  assert.ok(state.vy > 8);
  assert.equal(state.coyoteTimer, 0);

  // Attempting to jump again in mid-air fails
  stepVerticalKinematics(state, true, true, 0.016);
  assert.equal(state.justJumped, false);

  // Wait past coyote time, buffer jump just before landing
  for (let i = 0; i < 20; i++) {
    stepVerticalKinematics(state, false, false, 0.02);
  }
  stepVerticalKinematics(state, true, true, 0.02);
  assert.equal(state.justJumped, false);
  assert.ok(state.jumpBufferTimer > 0);

  // Landing within buffer window fires buffered jump immediately
  state.grounded = true;
  state.vy = -0.5;
  stepVerticalKinematics(state, false, true, 0.016);
  assert.equal(state.justJumped, true);
  assert.ok(state.vy > 8);
});

test('shortestAngleDelta and dampAngle wrap across PI cleanly', () => {
  const delta = shortestAngleDelta(Math.PI - 0.1, -Math.PI + 0.1);
  assert.ok(Math.abs(delta - 0.2) < 1e-5);

  const damped = dampAngle(Math.PI - 0.1, -Math.PI + 0.1, 15, 0.016);
  assert.ok(damped > Math.PI - 0.1);
});

test('stepStamina drains when sprinting, locks out when exhausted, and recovers faster when idle', () => {
  const stamina: StaminaState = { value: 100, exhausted: false };

  // Drains while moving + sprinting
  const res1 = stepStamina(stamina, true, true, 1.0);
  assert.equal(res1.canSprint, true);
  assert.ok(stamina.value < 100 && stamina.value > 0);

  // Drain to exhaustion
  while (!stamina.exhausted) {
    stepStamina(stamina, true, true, 0.25);
  }
  assert.equal(stamina.value, 0);
  assert.equal(stamina.exhausted, true);

  // Cannot sprint while exhausted even after short recovery (< 22)
  const whileRecovering = stepStamina(stamina, true, true, 0.5);
  assert.equal(whileRecovering.canSprint, false);
  assert.equal(stamina.exhausted, true);
  assert.ok(stamina.value > 0 && stamina.value < 22);

  // Standing still recovers faster and clears exhausted once >= 22
  stepStamina(stamina, false, false, 1.0);
  assert.equal(stamina.exhausted, false);
  assert.ok(stamina.value >= 22);
});

test('resolveTargetMoveSpeed maps joystick tilt from walk to run while preserving keyboard speeds', () => {
  const walk = DEFAULT_HORIZONTAL_CONFIG.walkSpeed;
  const sprint = DEFAULT_HORIZONTAL_CONFIG.sprintSpeed;

  assert.equal(resolveTargetMoveSpeed(0, true, false), 0);
  assert.equal(resolveTargetMoveSpeed(1, false, false), walk);
  assert.equal(resolveTargetMoveSpeed(1, false, true), sprint);

  const gentleTilt = resolveTargetMoveSpeed(0.3, true, false);
  const midTilt = resolveTargetMoveSpeed(0.62, true, false);
  const fullTilt = resolveTargetMoveSpeed(1.0, true, false);

  assert.ok(gentleTilt > 0 && gentleTilt < midTilt);
  assert.ok(midTilt < walk);
  assert.ok(fullTilt > walk && fullTilt < sprint);
  assert.equal(resolveTargetMoveSpeed(0.4, true, true), sprint);
});
