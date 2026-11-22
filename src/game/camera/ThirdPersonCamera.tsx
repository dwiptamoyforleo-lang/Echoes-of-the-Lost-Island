import { useEffect, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { useRapier } from '@react-three/rapier';
import * as THREE from 'three';
import { resolveCameraDistanceWithRaycast } from '@/src/game/physics/raycast';
import { playerTelemetry } from '@/src/game/player/playerTelemetry';
import { useGameStore } from '@/src/state/gameStore';

const CAMERA_DISTANCE = 5.0;
const SHOULDER_RIGHT_OFFSET = 0.55;
const TARGET_HEIGHT_OFFSET = 1.35;
const BASE_FOV = 52;
const SPRINT_FOV = 60;
const MIN_PITCH = -0.45;
const MAX_PITCH = 1.15;
const BASE_MOUSE_SENSITIVITY = 0.0024;

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

  const targetYawRef = useRef(0);
  const targetPitchRef = useRef(0.28);
  const currentYawRef = useRef(0);
  const currentPitchRef = useRef(0.28);
  const currentDistRef = useRef(CAMERA_DISTANCE);
  const currentFovRef = useRef(BASE_FOV);

  const smoothedTargetRef = useRef(new THREE.Vector3(0, 1.35, 8));
  const smoothedCamPosRef = useRef(new THREE.Vector3(0.55, 3.2, 13));
  const initializedRef = useRef(false);
  const orbitAngleRef = useRef(0.42);

  useEffect(() => {
    const domElement = gl.domElement;

    const handleCanvasClick = () => {
      const st = useGameStore.getState();
      if (
        st.screen !== 'playing' ||
        st.activeOverlay !== 'none' ||
        st.activeInscription
      ) {
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
      if (st.screen !== 'playing' || st.activeOverlay !== 'none') return;
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

    domElement.addEventListener('click', handleCanvasClick);
    window.addEventListener('mousemove', handleMouseMove);

    return () => {
      domElement.removeEventListener('click', handleCanvasClick);
      window.removeEventListener('mousemove', handleMouseMove);
    };
  }, [gl]);

  useEffect(() => {
    const blocked =
      screen !== 'playing' || activeOverlay !== 'none';
    if (blocked && document.pointerLockElement === gl.domElement) {
      document.exitPointerLock?.();
    }
    if (screen === 'playing') {
      initializedRef.current = false;
    }
  }, [screen, activeOverlay, gl]);

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

    if (
      !initializedRef.current ||
      smoothedTargetRef.current.distanceTo(_desiredTarget) > 12
    ) {
      smoothedTargetRef.current.copy(_desiredTarget);
      smoothedCamPosRef.current
        .copy(_desiredTarget)
        .addScaledVector(_forwardDir, -CAMERA_DISTANCE);
      initializedRef.current = true;
    }

    const targetAlpha = 1 - Math.exp(-14 * camResponsiveness * dt);
    smoothedTargetRef.current.lerp(_desiredTarget, targetAlpha);

    _desiredCamPos
      .copy(smoothedTargetRef.current)
      .addScaledVector(_forwardDir, -CAMERA_DISTANCE);

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

    const camAlpha = 1 - Math.exp(-18 * camResponsiveness * dt);
    smoothedCamPosRef.current.lerp(_desiredCamPos, camAlpha);

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
