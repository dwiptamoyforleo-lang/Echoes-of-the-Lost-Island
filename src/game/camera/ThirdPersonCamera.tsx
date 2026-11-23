import { useEffect, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { useRapier } from '@react-three/rapier';
import * as THREE from 'three';
import { getLevelHeight } from '@/src/game/levels/levelTerrainFactory';
import { resolveCameraDistanceWithRaycast } from '@/src/game/physics/raycast';
import { playerTelemetry } from '@/src/game/player/playerTelemetry';
import { useGameStore } from '@/src/state/gameStore';

const CAMERA_DISTANCE = 5.8;
const SHOULDER_RIGHT_OFFSET = 0.55;
const TARGET_HEIGHT_OFFSET = 1.55;
const DEFAULT_PITCH = 0.25;
const BASE_FOV = 52;
const SPRINT_FOV = 60;
const MIN_PITCH = -0.45;
const MAX_PITCH = 1.15;
const BASE_MOUSE_SENSITIVITY = 0.0024;
const BASE_DRAG_SENSITIVITY = 0.0045;

// Pre-allocated scratch vectors (zero GC in useFrame)
const _rayOrigin = new THREE.Vector3();
const _desiredTarget = new THREE.Vector3();
const _desiredCamPos = new THREE.Vector3();
const _rightVec = new THREE.Vector3();
const _forwardDir = new THREE.Vector3();
const _orbitTarget = new THREE.Vector3(0, 3.6, -6);

export function ThirdPersonCamera() {
  const { camera, gl } = useThree();
  const { world } = useRapier();
  const screen = useGameStore((state) => state.screen);
  const activeOverlay = useGameStore((state) => state.activeOverlay);
  const activeLevel = useGameStore((state) => state.activeLevel);
  const runId = useGameStore((state) => state.runId);
  const levelLoading = useGameStore((state) => state.levelLoading);

  const targetYawRef = useRef(0);
  const targetPitchRef = useRef(DEFAULT_PITCH);
  const currentYawRef = useRef(0);
  const currentPitchRef = useRef(DEFAULT_PITCH);
  const currentDistRef = useRef(CAMERA_DISTANCE);
  const currentFovRef = useRef(BASE_FOV);

  const smoothedTargetRef = useRef(new THREE.Vector3(0, TARGET_HEIGHT_OFFSET, 8));
  const smoothedCamPosRef = useRef(new THREE.Vector3(0.55, 3.4, 13.8));
  const initializedRef = useRef(false);
  const orbitAngleRef = useRef(0.42);
  const dragPointerIdRef = useRef<number | null>(null);
  const dragLastPosRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const dragMovedRef = useRef(false);

  useEffect(() => {
    const domElement = gl.domElement;

    const handleCanvasClick = () => {
      if (dragMovedRef.current) {
        dragMovedRef.current = false;
        return;
      }
      const st = useGameStore.getState();
      if (
        st.screen !== 'playing' ||
        st.activeOverlay !== 'none' ||
        st.activeInscription
      ) {
        return;
      }
      // Skip pointer lock on coarse/touch-only pointers so touch drag works seamlessly
      if (window.matchMedia?.('(pointer: coarse)').matches) {
        return;
      }
      if (document.pointerLockElement !== domElement) {
        try {
          const maybePromise = domElement.requestPointerLock?.() as
            | Promise<void>
            | undefined;
          if (maybePromise && typeof maybePromise.catch === 'function') {
            maybePromise.catch(() => {});
          }
        } catch {
          // Ignore pointer lock rejection in restricted contexts
        }
      }
    };

    const handleMouseMove = (event: MouseEvent) => {
      const st = useGameStore.getState();
      if (
        st.screen !== 'playing' ||
        st.activeOverlay !== 'none' ||
        st.activeInscription
      ) {
        return;
      }
      if (document.pointerLockElement !== domElement) return;

      const sens = BASE_MOUSE_SENSITIVITY * st.settings.mouseSensitivity;
      const ySign = st.settings.invertY ? -1 : 1;

      targetYawRef.current -= event.movementX * sens;
      targetPitchRef.current = THREE.MathUtils.clamp(
        targetPitchRef.current + event.movementY * sens * ySign,
        MIN_PITCH,
        MAX_PITCH,
      );
    };

    const handlePointerDown = (event: PointerEvent) => {
      if (document.pointerLockElement === domElement) return;
      const st = useGameStore.getState();
      if (
        st.screen !== 'playing' ||
        st.activeOverlay !== 'none' ||
        st.activeInscription
      ) {
        return;
      }
      if (event.pointerType === 'mouse' && event.button !== 0) return;
      if (dragPointerIdRef.current !== null) return;
      dragPointerIdRef.current = event.pointerId;
      dragLastPosRef.current.x = event.clientX;
      dragLastPosRef.current.y = event.clientY;
      dragMovedRef.current = false;
    };

    const handlePointerMove = (event: PointerEvent) => {
      if (dragPointerIdRef.current !== event.pointerId) return;
      if (document.pointerLockElement === domElement) {
        dragPointerIdRef.current = null;
        return;
      }
      const st = useGameStore.getState();
      if (
        st.screen !== 'playing' ||
        st.activeOverlay !== 'none' ||
        st.activeInscription
      ) {
        dragPointerIdRef.current = null;
        return;
      }

      const dx = event.clientX - dragLastPosRef.current.x;
      const dy = event.clientY - dragLastPosRef.current.y;
      dragLastPosRef.current.x = event.clientX;
      dragLastPosRef.current.y = event.clientY;

      if (Math.hypot(dx, dy) > 1.5) {
        dragMovedRef.current = true;
      }

      const sens = BASE_DRAG_SENSITIVITY * st.settings.mouseSensitivity;
      const ySign = st.settings.invertY ? -1 : 1;
      targetYawRef.current -= dx * sens;
      targetPitchRef.current = THREE.MathUtils.clamp(
        targetPitchRef.current + dy * sens * ySign,
        MIN_PITCH,
        MAX_PITCH,
      );
    };

    const handlePointerUp = (event: PointerEvent) => {
      if (dragPointerIdRef.current === event.pointerId) {
        dragPointerIdRef.current = null;
      }
    };

    domElement.addEventListener('click', handleCanvasClick);
    window.addEventListener('mousemove', handleMouseMove);
    domElement.addEventListener('pointerdown', handlePointerDown);
    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', handlePointerUp);
    window.addEventListener('pointercancel', handlePointerUp);

    return () => {
      domElement.removeEventListener('click', handleCanvasClick);
      window.removeEventListener('mousemove', handleMouseMove);
      domElement.removeEventListener('pointerdown', handlePointerDown);
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);
      window.removeEventListener('pointercancel', handlePointerUp);
    };
  }, [gl]);

  useEffect(() => {
    const blocked = screen !== 'playing' || activeOverlay !== 'none';
    if (blocked && document.pointerLockElement === gl.domElement) {
      document.exitPointerLock?.();
    }
    if (blocked) {
      dragPointerIdRef.current = null;
    }
    if (screen === 'playing') {
      initializedRef.current = false;
    }
  }, [screen, activeOverlay, gl]);

  // Snap camera behind player whenever a new level or run starts
  useEffect(() => {
    targetYawRef.current = 0;
    currentYawRef.current = 0;
    targetPitchRef.current = DEFAULT_PITCH;
    currentPitchRef.current = DEFAULT_PITCH;
    currentDistRef.current = CAMERA_DISTANCE;
    initializedRef.current = false;
  }, [activeLevel, runId, levelLoading]);

  useFrame((_, rawDt) => {
    const dt = Math.min(rawDt, 0.05);
    const storeState = useGameStore.getState();

    // Animated scenic island orbit for non-gameplay menu/map/story screens
    if (
      storeState.screen === 'mainMenu' ||
      storeState.screen === 'worldMap' ||
      storeState.screen === 'settings' ||
      storeState.screen === 'credits' ||
      storeState.screen === 'intro' ||
      storeState.screen === 'ending'
    ) {
      orbitAngleRef.current += dt * 0.09;
      const angle = orbitAngleRef.current;
      const radius = 38;
      const camX = Math.sin(angle) * radius;
      const camZ = Math.cos(angle) * radius - 4;
      const camY = 17.5 + Math.sin(angle * 0.7) * 1.8;

      camera.position.set(camX, camY, camZ);
      camera.lookAt(_orbitTarget);

      if (camera instanceof THREE.PerspectiveCamera && Math.abs(camera.fov - BASE_FOV) > 0.05) {
        camera.fov = BASE_FOV;
        camera.updateProjectionMatrix();
      }
      return;
    }

    const camResponsiveness = Math.max(0.3, storeState.settings.cameraSensitivity);
    const rotAlpha = 1 - Math.exp(-22 * camResponsiveness * dt);
    currentYawRef.current = THREE.MathUtils.lerp(
      currentYawRef.current,
      targetYawRef.current,
      rotAlpha,
    );
    currentPitchRef.current = THREE.MathUtils.lerp(
      currentPitchRef.current,
      targetPitchRef.current,
      rotAlpha,
    );

    const yaw = currentYawRef.current;
    const pitch = currentPitchRef.current;
    playerTelemetry.cameraYaw = yaw;

    const p = playerTelemetry.position;
    _rayOrigin.set(p.x, p.y + TARGET_HEIGHT_OFFSET, p.z);

    _rightVec.set(Math.cos(yaw), 0, -Math.sin(yaw));
    _desiredTarget.copy(_rayOrigin).addScaledVector(_rightVec, SHOULDER_RIGHT_OFFSET);

    const cosPitch = Math.cos(pitch);
    _forwardDir.set(
      -Math.sin(yaw) * cosPitch,
      -Math.sin(pitch),
      -Math.cos(yaw) * cosPitch,
    );

    const applyTerrainClearance = (pos: THREE.Vector3) => {
      if (storeState.activeLevel === 'testArena') return;
      const floorY = getLevelHeight(storeState.activeLevel, pos.x, pos.z) + 0.6;
      if (pos.y < floorY) {
        pos.y = floorY;
      }
    };

    if (
      !initializedRef.current ||
      smoothedTargetRef.current.distanceTo(_desiredTarget) > 12
    ) {
      smoothedTargetRef.current.copy(_desiredTarget);
      smoothedCamPosRef.current
        .copy(_desiredTarget)
        .addScaledVector(_forwardDir, -CAMERA_DISTANCE);
      applyTerrainClearance(smoothedCamPosRef.current);
      initializedRef.current = true;
    }

    const targetAlpha = 1 - Math.exp(-14 * camResponsiveness * dt);
    smoothedTargetRef.current.lerp(_desiredTarget, targetAlpha);

    _desiredCamPos
      .copy(smoothedTargetRef.current)
      .addScaledVector(_forwardDir, -CAMERA_DISTANCE);
    applyTerrainClearance(_desiredCamPos);

    const safeDist = resolveCameraDistanceWithRaycast(
      world,
      _rayOrigin,
      _desiredCamPos,
      CAMERA_DISTANCE,
      playerTelemetry.playerColliderHandle,
    );

    const distLambda = safeDist < currentDistRef.current ? 28 : 10;
    const distAlpha = 1 - Math.exp(-distLambda * dt);
    currentDistRef.current = THREE.MathUtils.lerp(
      currentDistRef.current,
      safeDist,
      distAlpha,
    );

    _desiredCamPos
      .copy(smoothedTargetRef.current)
      .addScaledVector(_forwardDir, -currentDistRef.current);
    applyTerrainClearance(_desiredCamPos);

    const camAlpha = 1 - Math.exp(-18 * camResponsiveness * dt);
    smoothedCamPosRef.current.lerp(_desiredCamPos, camAlpha);
    applyTerrainClearance(smoothedCamPosRef.current);

    camera.position.copy(smoothedCamPosRef.current);
    camera.lookAt(smoothedTargetRef.current);

    if (camera instanceof THREE.PerspectiveCamera) {
      const targetFov = playerTelemetry.sprinting ? SPRINT_FOV : BASE_FOV;
      const fovAlpha = 1 - Math.exp(-8 * dt);
      const nextFov = THREE.MathUtils.lerp(
        currentFovRef.current,
        targetFov,
        fovAlpha,
      );
      if (Math.abs(nextFov - camera.fov) > 0.01) {
        camera.fov = nextFov;
        camera.updateProjectionMatrix();
      }
      currentFovRef.current = nextFov;
    }
  });

  return null;
}
