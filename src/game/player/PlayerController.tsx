import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import {
  CapsuleCollider,
  RigidBody,
  useRapier,
  type RapierCollider,
  type RapierRigidBody,
} from '@react-three/rapier';
import type RAPIER from '@dimforge/rapier3d-compat';
import {
  ActiveCollisionTypes,
  QueryFilterFlags,
} from '@dimforge/rapier3d-compat';
import {
  approachHorizontalVelocity,
  computeCameraRelativeMoveDir,
  createExplorerCharacterController,
  dampAngle,
  getMovingPlatformDelta,
  isIceCollider,
  resolveHorizontalMoveConfig,
  resolveTargetMoveSpeed,
  stepStamina,
  stepVerticalKinematics,
  type StaminaState,
  type Vec2XZ,
  type VerticalKinematicsState,
} from '@/src/game/physics';
import { eventBus } from '@/src/state/eventBus';
import { useGameStore } from '@/src/state/gameStore';
import {
  playFootstepSfx,
  playJumpSfx,
  playLandSfx,
  resolveSurfaceType,
} from '@/src/systems/audioSystem';
import { consumeInteractAnimationTrigger } from '@/src/systems/interaction';
import {
  ExplorerModel,
  createExplorerAnimState,
  updateExplorerPose,
  type ExplorerRigRefs,
} from './ExplorerModel';
import { playerTelemetry } from './playerTelemetry';
import { usePlayerInput, type PlayerInputState } from './usePlayerInput';

const CAPSULE_HALF_HEIGHT = 0.45;
const CAPSULE_RADIUS = 0.35;
const COLLIDER_CENTER_Y = CAPSULE_HALF_HEIGHT + CAPSULE_RADIUS; // 0.80m above feet

export interface PlayerControllerProps {
  spawnPosition?: [number, number, number];
  levelMounted?: boolean;
}

export function PlayerController({
  spawnPosition = [0, 0.95, 8],
  levelMounted = true,
}: PlayerControllerProps) {
  const { world } = useRapier();
  const { sampleInput } = usePlayerInput();

  const bodyRef = useRef<RapierRigidBody>(null);
  const colliderRef = useRef<RapierCollider>(null);
  const rigRef = useRef<ExplorerRigRefs>(null);
  const contactShadowRef = useRef<THREE.Mesh>(null);
  const controllerRef = useRef<RAPIER.KinematicCharacterController | null>(
    null,
  );

  // Per-frame scratch objects (zero GC in useFrame)
  const inputRef = useRef<PlayerInputState>({
    forward: 0,
    right: 0,
    magnitude: 0,
    fromJoystick: false,
    sprint: false,
    jumpHeld: false,
    jumpJustPressed: false,
  });
  const moveDirRef = useRef<Vec2XZ>({ x: 0, z: 0 });
  const horizVelRef = useRef<Vec2XZ>({ x: 0, z: 0 });
  const vertStateRef = useRef<VerticalKinematicsState>({
    vy: 0,
    grounded: false,
    coyoteTimer: 0,
    jumpBufferTimer: 0,
    justJumped: false,
  });
  const desiredDeltaRef = useRef({ x: 0, y: 0, z: 0 });
  const nextPosRef = useRef({ x: 0, y: 0, z: 0 });
  const facingYawRef = useRef(0);
  const animStateRef = useRef(createExplorerAnimState());
  const staminaRef = useRef<StaminaState>({ value: 100, exhausted: false });
  const pendingTeleportRef = useRef<[number, number, number] | null>(null);
  const wasMountedRef = useRef(levelMounted);
  const onIceRef = useRef(false);
  const wasGroundedRef = useRef(false);
  const lastAirVyRef = useRef(0);
  const strideDistRef = useRef(0);

  useEffect(() => {
    const controller = createExplorerCharacterController(world);
    controllerRef.current = controller;

    const sx = spawnPosition[0];
    const sy = spawnPosition[1] + COLLIDER_CENTER_Y;
    const sz = spawnPosition[2];
    if (bodyRef.current) {
      bodyRef.current.setTranslation({ x: sx, y: sy, z: sz }, true);
    }
    if (colliderRef.current) {
      playerTelemetry.playerColliderHandle = colliderRef.current.handle;
    }
    playerTelemetry.position.set(sx, spawnPosition[1], sz);
    horizVelRef.current.x = 0;
    horizVelRef.current.z = 0;
    vertStateRef.current.vy = 0;
    vertStateRef.current.grounded = false;
    staminaRef.current.value = 100;
    staminaRef.current.exhausted = false;
    playerTelemetry.stamina = 100;
    playerTelemetry.staminaExhausted = false;

    const unsubRespawn = eventBus.on('player:respawn', ({ position }) => {
      pendingTeleportRef.current = position;
    });

    return () => {
      unsubRespawn();
      playerTelemetry.playerColliderHandle = null;
      world.removeCharacterController(controller);
      controllerRef.current = null;
    };
  }, [world, spawnPosition]);

  useFrame((_, rawDt) => {
    const body = bodyRef.current;
    const collider = colliderRef.current;
    const controller = controllerRef.current;
    const rig = rigRef.current;
    if (!body || !collider || !controller) return;

    playerTelemetry.playerColliderHandle = collider.handle;

    const state = useGameStore.getState();
    if (!levelMounted) {
      wasMountedRef.current = false;
      const sx = spawnPosition[0];
      const sy = spawnPosition[1] + COLLIDER_CENTER_Y;
      const sz = spawnPosition[2];
      body.setTranslation({ x: sx, y: sy, z: sz }, true);
      body.setNextKinematicTranslation({ x: sx, y: sy, z: sz });
      horizVelRef.current.x = 0;
      horizVelRef.current.z = 0;
      vertStateRef.current.vy = 0;
      vertStateRef.current.grounded = false;
      playerTelemetry.position.set(sx, spawnPosition[1], sz);
      return;
    }

    if (!wasMountedRef.current) {
      wasMountedRef.current = true;
      const sx = spawnPosition[0];
      const sy = spawnPosition[1] + COLLIDER_CENTER_Y;
      const sz = spawnPosition[2];
      body.setTranslation({ x: sx, y: sy, z: sz }, true);
      body.setNextKinematicTranslation({ x: sx, y: sy, z: sz });
      horizVelRef.current.x = 0;
      horizVelRef.current.z = 0;
      vertStateRef.current.vy = 0;
      vertStateRef.current.grounded = false;
      playerTelemetry.position.set(sx, spawnPosition[1], sz);
    }

    if (state.screen !== 'playing') {
      horizVelRef.current.x = 0;
      horizVelRef.current.z = 0;
      playerTelemetry.velocity.set(0, 0, 0);
      playerTelemetry.horizontalSpeed = 0;
      return;
    }

    // Apply deferred respawn teleport cleanly on physics tick
    if (pendingTeleportRef.current) {
      const tp = pendingTeleportRef.current;
      pendingTeleportRef.current = null;
      const targetPos = {
        x: tp[0],
        y: tp[1] + COLLIDER_CENTER_Y,
        z: tp[2],
      };
      body.setTranslation(targetPos, true);
      body.setNextKinematicTranslation(targetPos);
      horizVelRef.current.x = 0;
      horizVelRef.current.z = 0;
      vertStateRef.current.vy = 0;
      vertStateRef.current.grounded = false;
      playerTelemetry.position.set(tp[0], tp[1], tp[2]);
      playerTelemetry.velocity.set(0, 0, 0);
      playerTelemetry.horizontalSpeed = 0;
      return;
    }

    const dt = Math.min(rawDt, 0.05);
    const input = sampleInput(inputRef.current);

    // Freeze movement while reading an inscription, fading on fall respawn, or watching finale cutscene
    if (
      state.activeInscription ||
      state.fallFadeActive ||
      state.finaleCutscene.active
    ) {
      horizVelRef.current.x = 0;
      horizVelRef.current.z = 0;
      if (rig) {
        updateExplorerPose(
          rig,
          animStateRef.current,
          0,
          0,
          vertStateRef.current.grounded,
          false,
          false,
          dt,
        );
      }
      return;
    }

    const interactTriggered = consumeInteractAnimationTrigger();

    const moveDir = computeCameraRelativeMoveDir(
      input.forward,
      input.right,
      playerTelemetry.cameraYaw,
      moveDirRef.current,
    );

    const hasMoveInput =
      moveDir.x * moveDir.x + moveDir.z * moveDir.z > 1e-6;
    const { canSprint } = stepStamina(
      staminaRef.current,
      input.sprint,
      hasMoveInput,
      dt,
    );
    const isSprinting = canSprint && hasMoveInput;

    const horizConfig = resolveHorizontalMoveConfig(onIceRef.current);
    const targetSpeed = resolveTargetMoveSpeed(
      input.magnitude,
      input.fromJoystick,
      isSprinting,
      horizConfig,
    );

    const horiz = approachHorizontalVelocity(
      horizVelRef.current,
      moveDir,
      isSprinting,
      vertStateRef.current.grounded,
      dt,
      horizConfig,
      targetSpeed,
    );

    const wasGroundedBeforeStep = vertStateRef.current.grounded;
    const prevVy = vertStateRef.current.vy;
    if (!wasGroundedBeforeStep) {
      lastAirVyRef.current = Math.min(lastAirVyRef.current, prevVy);
    }

    const vert = stepVerticalKinematics(
      vertStateRef.current,
      input.jumpJustPressed,
      input.jumpHeld,
      dt,
    );
    if (vert.justJumped) {
      playJumpSfx();
      strideDistRef.current = 0;
    }

    // Disable snap-to-ground while ascending so jumps lift cleanly
    if (vert.vy > 0) {
      controller.disableSnapToGround();
    } else {
      controller.enableSnapToGround(0.35);
    }

    const desired = desiredDeltaRef.current;
    desired.x = horiz.x * dt;
    desired.y = vert.vy * dt;
    desired.z = horiz.z * dt;

    controller.computeColliderMovement(
      collider,
      desired,
      QueryFilterFlags.EXCLUDE_SENSORS,
      undefined,
      (hitCollider) => hitCollider.handle !== collider.handle,
    );

    const computed = controller.computedMovement();
    const currentPos = body.translation();
    const next = nextPosRef.current;
    next.x = currentPos.x + computed.x;
    next.y = currentPos.y + computed.y;
    next.z = currentPos.z + computed.z;

    // Carry player smoothly if standing on a moving platform & detect slippery ice colliders
    const numCollisions = controller.numComputedCollisions();
    let groundedOnIce = false;
    let carriedByPlatform = false;
    for (let i = 0; i < numCollisions; i++) {
      const collision = controller.computedCollision(i);
      if (!collision || !collision.collider) continue;
      if (collision.normal1.y > 0.5) {
        if (isIceCollider(collision.collider.handle)) {
          groundedOnIce = true;
        }
        if (!carriedByPlatform) {
          const pDelta = getMovingPlatformDelta(collision.collider.handle);
          if (pDelta) {
            next.x += pDelta.x;
            next.y += pDelta.y;
            next.z += pDelta.z;
            carriedByPlatform = true;
          }
        }
      }
    }

    // Update grounded state from Rapier character controller
    const hitGround = vert.vy <= 0 && controller.computedGrounded();
    if (hitGround) {
      vert.grounded = true;
      vert.vy = -0.6;
      onIceRef.current = groundedOnIce;
    } else {
      vert.grounded = false;
      onIceRef.current = false;
      if (vert.vy > 0 && desired.y > 0.001 && computed.y < desired.y * 0.35) {
        vert.vy = 0;
      }
    }

    // Fall-off safety: trigger smooth fade respawn to last checkpoint when dropping below y = -12
    if (next.y < -12) {
      horiz.x = 0;
      horiz.z = 0;
      vert.vy = 0;
      vert.grounded = false;
      onIceRef.current = false;
      state.triggerFallRespawn('Returned to last checkpoint');
      return;
    }

    body.setNextKinematicTranslation(next);

    // Smoothly turn explorer toward movement direction
    if (hasMoveInput) {
      const targetFacing = Math.atan2(-moveDir.x, -moveDir.z);
      facingYawRef.current = dampAngle(
        facingYawRef.current,
        targetFacing,
        12,
        dt,
      );
    }

    if (rig?.rootGroup) {
      rig.rootGroup.rotation.y = facingYawRef.current;
    }

    const horizSpeed = Math.hypot(horiz.x, horiz.z);
    const feetPos = {
      x: next.x,
      y: next.y - COLLIDER_CENTER_Y,
      z: next.z,
    };
    const surface = resolveSurfaceType(
      state.activeLevel,
      feetPos,
      onIceRef.current,
    );

    if (!wasGroundedBeforeStep && vert.grounded && lastAirVyRef.current < -3.0) {
      playLandSfx(Math.abs(lastAirVyRef.current), surface);
      lastAirVyRef.current = 0;
      strideDistRef.current = 0;
    } else if (vert.grounded) {
      lastAirVyRef.current = 0;
      if (horizSpeed > 0.7) {
        const strideLength = isSprinting ? 2.1 : 1.75;
        strideDistRef.current += horizSpeed * dt;
        if (strideDistRef.current >= strideLength) {
          strideDistRef.current %= strideLength;
          playFootstepSfx(surface);
        }
      } else {
        strideDistRef.current = 0;
      }
    }
    wasGroundedRef.current = vert.grounded;

    if (rig) {
      updateExplorerPose(
        rig,
        animStateRef.current,
        horizSpeed,
        vert.vy,
        vert.grounded,
        vert.justJumped,
        interactTriggered,
        dt,
      );
    }

    if (contactShadowRef.current) {
      contactShadowRef.current.visible = vert.grounded;
    }

    playerTelemetry.position.set(
      next.x,
      next.y - COLLIDER_CENTER_Y,
      next.z,
    );
    playerTelemetry.velocity.set(horiz.x, vert.grounded ? 0 : vert.vy, horiz.z);
    playerTelemetry.horizontalSpeed = horizSpeed;
    playerTelemetry.grounded = vert.grounded;
    playerTelemetry.onIce = onIceRef.current;
    playerTelemetry.sprinting = isSprinting && horizSpeed > 5.8;
    playerTelemetry.stamina = staminaRef.current.value;
    playerTelemetry.staminaExhausted = staminaRef.current.exhausted;
  });

  return (
    <RigidBody
      ref={bodyRef}
      name="player"
      userData={{ isPlayer: true }}
      type="kinematicPosition"
      ccd
      position={[
        spawnPosition[0],
        spawnPosition[1] + COLLIDER_CENTER_Y,
        spawnPosition[2],
      ]}
      colliders={false}
      enabledRotations={[false, false, false]}
    >
      <CapsuleCollider
        ref={colliderRef}
        args={[CAPSULE_HALF_HEIGHT, CAPSULE_RADIUS]}
        activeCollisionTypes={
          ActiveCollisionTypes.DEFAULT |
          ActiveCollisionTypes.KINEMATIC_FIXED |
          ActiveCollisionTypes.KINEMATIC_KINEMATIC
        }
      />
      <group position={[0, -COLLIDER_CENTER_Y, 0]}>
        <mesh
          ref={contactShadowRef}
          rotation={[-Math.PI / 2, 0, 0]}
          position={[0, 0.015, 0]}
          renderOrder={1}
        >
          <circleGeometry args={[0.42, 20]} />
          <meshBasicMaterial
            color="#1e293b"
            transparent
            opacity={0.28}
            depthWrite={false}
          />
        </mesh>
        <ExplorerModel ref={rigRef} />
      </group>
    </RigidBody>
  );
}
