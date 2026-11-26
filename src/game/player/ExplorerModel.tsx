import { forwardRef, useImperativeHandle, useRef } from 'react';
import * as THREE from 'three';
import { getQualityPreset } from '@/src/game/rendering/adaptiveQuality';
import {
  useCachedGeometry,
  useCachedMaterial,
} from '@/src/game/rendering/assetCache';
import { useGameStore } from '@/src/state/gameStore';

export interface ExplorerRigRefs {
  rootGroup: THREE.Group | null;
  bodyGroup: THREE.Group | null;
  headGroup: THREE.Group | null;
  leftArmPivot: THREE.Group | null;
  rightArmPivot: THREE.Group | null;
  leftLegPivot: THREE.Group | null;
  rightLegPivot: THREE.Group | null;
  scarfTail: THREE.Mesh | null;
}

export interface ExplorerAnimState {
  walkPhase: number;
  idlePhase: number;
  squashY: number;
  interactTimer: number;
  wasGrounded: boolean;
}

export function createExplorerAnimState(): ExplorerAnimState {
  return {
    walkPhase: 0,
    idlePhase: 0,
    squashY: 1,
    interactTimer: 0,
    wasGrounded: true,
  };
}

/**
 * Updates procedural explorer character pose in-place without allocating objects.
 */
export function updateExplorerPose(
  rig: ExplorerRigRefs,
  anim: ExplorerAnimState,
  horizontalSpeed: number,
  vy: number,
  grounded: boolean,
  justJumped: boolean,
  interactTriggered: boolean,
  dt: number,
): void {
  if (!rig.rootGroup || !rig.bodyGroup) return;

  // Detect landing impact for squash
  if (!anim.wasGrounded && grounded) {
    anim.squashY = 0.78;
  } else if (justJumped) {
    anim.squashY = 1.16;
  }
  anim.wasGrounded = grounded;

  if (interactTriggered) {
    anim.interactTimer = 0.55;
  } else if (anim.interactTimer > 0) {
    anim.interactTimer = Math.max(0, anim.interactTimer - dt);
  }

  // Exponentially damp squash/stretch back to 1
  const squashAlpha = 1 - Math.exp(-16 * dt);
  anim.squashY = THREE.MathUtils.lerp(anim.squashY, 1, squashAlpha);
  const squashXZ = 1 / Math.sqrt(Math.max(0.65, anim.squashY));
  rig.rootGroup.scale.set(squashXZ, anim.squashY, squashXZ);

  const poseAlpha = 1 - Math.exp(-14 * dt);

  let targetBodyY = 0.84;
  let targetBodyPitch = 0;
  let targetHeadPitch = 0;
  let targetLeftArmX = 0;
  let targetLeftArmZ = 0.08;
  let targetRightArmX = 0;
  let targetRightArmZ = -0.08;
  let targetLeftLegX = 0;
  let targetRightLegX = 0;
  let targetScarfX = 0.25;

  if (!grounded) {
    if (vy > 0.4) {
      // Jump ascent pose: arms raised forward/up, asymmetric knee tuck
      targetBodyY = 0.88;
      targetBodyPitch = 0.08;
      targetHeadPitch = -0.1;
      targetLeftArmX = -1.15;
      targetLeftArmZ = 0.35;
      targetRightArmX = -0.85;
      targetRightArmZ = -0.35;
      targetLeftLegX = -0.55;
      targetRightLegX = 0.35;
      targetScarfX = 0.65;
    } else {
      // Fall descent pose: arms spread out for balance
      targetBodyY = 0.85;
      targetBodyPitch = -0.04;
      targetHeadPitch = 0.12;
      targetLeftArmX = -0.35;
      targetLeftArmZ = 0.82;
      targetRightArmX = -0.35;
      targetRightArmZ = -0.82;
      targetLeftLegX = -0.22;
      targetRightLegX = 0.24;
      targetScarfX = 0.85;
    }
  } else if (horizontalSpeed > 0.3) {
    // Distance-synced walk / run stride
    const speedRatio = THREE.MathUtils.clamp(horizontalSpeed / 9.0, 0.25, 1.0);
    anim.walkPhase += horizontalSpeed * dt * 2.15;
    const swing = Math.sin(anim.walkPhase);
    const bounce = Math.abs(Math.cos(anim.walkPhase));

    const legAmp = 0.38 + speedRatio * 0.48;
    const armAmp = 0.35 + speedRatio * 0.52;

    targetBodyY = 0.82 + bounce * (0.04 + speedRatio * 0.04);
    targetBodyPitch = 0.06 + speedRatio * 0.14;
    targetHeadPitch = -targetBodyPitch * 0.55;

    targetLeftLegX = swing * legAmp;
    targetRightLegX = -swing * legAmp;
    targetLeftArmX = -swing * armAmp;
    targetRightArmX = swing * armAmp;
    targetLeftArmZ = 0.1 + speedRatio * 0.08;
    targetRightArmZ = -(0.1 + speedRatio * 0.08);
    targetScarfX = 0.35 + speedRatio * 0.55 + Math.sin(anim.walkPhase * 2) * 0.1;
  } else {
    // Idle breathing / subtle sway
    anim.idlePhase += dt * 2.4;
    const breath = Math.sin(anim.idlePhase);
    targetBodyY = 0.84 + breath * 0.018;
    targetBodyPitch = breath * 0.015;
    targetLeftArmX = breath * 0.03;
    targetRightArmX = -breath * 0.03;
    targetLeftArmZ = 0.09 + breath * 0.02;
    targetRightArmZ = -(0.09 + breath * 0.02);
    targetScarfX = 0.22 + breath * 0.05;
  }

  // Interact override: short right-arm raise gesture
  if (anim.interactTimer > 0) {
    const progress = 1 - anim.interactTimer / 0.55;
    const raiseCurve = Math.sin(progress * Math.PI);
    targetRightArmX = THREE.MathUtils.lerp(targetRightArmX, -2.2, raiseCurve);
    targetRightArmZ = THREE.MathUtils.lerp(targetRightArmZ, -0.35, raiseCurve);
  }

  rig.bodyGroup.position.y = THREE.MathUtils.lerp(
    rig.bodyGroup.position.y,
    targetBodyY,
    poseAlpha,
  );
  rig.bodyGroup.rotation.x = THREE.MathUtils.lerp(
    rig.bodyGroup.rotation.x,
    targetBodyPitch,
    poseAlpha,
  );

  if (rig.headGroup) {
    rig.headGroup.rotation.x = THREE.MathUtils.lerp(
      rig.headGroup.rotation.x,
      targetHeadPitch,
      poseAlpha,
    );
  }
  if (rig.leftArmPivot) {
    rig.leftArmPivot.rotation.x = THREE.MathUtils.lerp(
      rig.leftArmPivot.rotation.x,
      targetLeftArmX,
      poseAlpha,
    );
    rig.leftArmPivot.rotation.z = THREE.MathUtils.lerp(
      rig.leftArmPivot.rotation.z,
      targetLeftArmZ,
      poseAlpha,
    );
  }
  if (rig.rightArmPivot) {
    rig.rightArmPivot.rotation.x = THREE.MathUtils.lerp(
      rig.rightArmPivot.rotation.x,
      targetRightArmX,
      poseAlpha,
    );
    rig.rightArmPivot.rotation.z = THREE.MathUtils.lerp(
      rig.rightArmPivot.rotation.z,
      targetRightArmZ,
      poseAlpha,
    );
  }
  if (rig.leftLegPivot) {
    rig.leftLegPivot.rotation.x = THREE.MathUtils.lerp(
      rig.leftLegPivot.rotation.x,
      targetLeftLegX,
      poseAlpha,
    );
  }
  if (rig.rightLegPivot) {
    rig.rightLegPivot.rotation.x = THREE.MathUtils.lerp(
      rig.rightLegPivot.rotation.x,
      targetRightLegX,
      poseAlpha,
    );
  }
  if (rig.scarfTail) {
    rig.scarfTail.rotation.x = THREE.MathUtils.lerp(
      rig.scarfTail.rotation.x,
      targetScarfX,
      poseAlpha,
    );
  }
}

export const ExplorerModel = forwardRef<ExplorerRigRefs>(
  function ExplorerModel(_, ref) {
    const activeTier = useGameStore((s) => s.activeQualityTier);
    const cast = getQualityPreset(activeTier).shadowsEnabled;

    const rootGroupRef = useRef<THREE.Group>(null);
    const bodyGroupRef = useRef<THREE.Group>(null);
    const headGroupRef = useRef<THREE.Group>(null);
    const leftArmRef = useRef<THREE.Group>(null);
    const rightArmRef = useRef<THREE.Group>(null);
    const leftLegRef = useRef<THREE.Group>(null);
    const rightLegRef = useRef<THREE.Group>(null);
    const scarfTailRef = useRef<THREE.Mesh>(null);

    const torsoGeo = useCachedGeometry('exp-torso', () => new THREE.CapsuleGeometry(0.21, 0.28, 6, 12));
    const beltGeo = useCachedGeometry('exp-belt', () => new THREE.CylinderGeometry(0.218, 0.218, 0.08, 14));
    const buckleGeo = useCachedGeometry('exp-buckle', () => new THREE.BoxGeometry(0.09, 0.085, 0.03));
    const scarfCollarGeo = useCachedGeometry('exp-scarf-collar', () => new THREE.TorusGeometry(0.165, 0.055, 8, 16));
    const scarfTailGeo = useCachedGeometry('exp-scarf-tail', () => new THREE.BoxGeometry(0.1, 0.34, 0.035));
    const packGeo = useCachedGeometry('exp-pack', () => new THREE.BoxGeometry(0.32, 0.38, 0.18));
    const bedrollGeo = useCachedGeometry('exp-bedroll', () => new THREE.CylinderGeometry(0.075, 0.075, 0.34, 12));
    const claspGeo = useCachedGeometry('exp-clasp', () => new THREE.BoxGeometry(0.1, 0.06, 0.02));
    const headGeo = useCachedGeometry('exp-head', () => new THREE.SphereGeometry(0.19, 14, 14));
    const eyeGeo = useCachedGeometry('exp-eye', () => new THREE.SphereGeometry(0.024, 8, 8));
    const brimGeo = useCachedGeometry('exp-brim', () => new THREE.CylinderGeometry(0.34, 0.35, 0.032, 18));
    const crownGeo = useCachedGeometry('exp-crown', () => new THREE.CylinderGeometry(0.17, 0.2, 0.16, 16));
    const hatBandGeo = useCachedGeometry('exp-hatband', () => new THREE.CylinderGeometry(0.203, 0.203, 0.035, 16));
    const armGeo = useCachedGeometry('exp-arm', () => new THREE.CapsuleGeometry(0.065, 0.22, 6, 10));
    const handGeo = useCachedGeometry('exp-hand', () => new THREE.SphereGeometry(0.062, 10, 10));
    const legGeo = useCachedGeometry('exp-leg', () => new THREE.CapsuleGeometry(0.075, 0.24, 6, 10));
    const bootGeo = useCachedGeometry('exp-boot', () => new THREE.BoxGeometry(0.14, 0.12, 0.22));

    const tunicMat = useCachedMaterial('exp-mat-tunic', () => new THREE.MeshStandardMaterial({ color: '#c86d44', roughness: 0.78, metalness: 0.05 }));
    const sleeveMat = useCachedMaterial('exp-mat-sleeve', () => new THREE.MeshStandardMaterial({ color: '#b55d38', roughness: 0.78, metalness: 0.05 }));
    const beltMat = useCachedMaterial('exp-mat-belt', () => new THREE.MeshStandardMaterial({ color: '#523724', roughness: 0.72, metalness: 0.08 }));
    const brassMat = useCachedMaterial('exp-mat-brass', () => new THREE.MeshStandardMaterial({ color: '#d4a84f', roughness: 0.28, metalness: 0.75 }));
    const scarfMat = useCachedMaterial('exp-mat-scarf', () => new THREE.MeshStandardMaterial({ color: '#2a9d8f', roughness: 0.72, metalness: 0.04 }));
    const packMat = useCachedMaterial('exp-mat-pack', () => new THREE.MeshStandardMaterial({ color: '#8c6239', roughness: 0.82, metalness: 0.05 }));
    const bedrollMat = useCachedMaterial('exp-mat-bedroll', () => new THREE.MeshStandardMaterial({ color: '#d9c39e', roughness: 0.85, metalness: 0.02 }));
    const skinMat = useCachedMaterial('exp-mat-skin', () => new THREE.MeshStandardMaterial({ color: '#ecc09a', roughness: 0.74, metalness: 0.02 }));
    const eyeMat = useCachedMaterial('exp-mat-eye', () => new THREE.MeshStandardMaterial({ color: '#1f2937', roughness: 0.3 }));
    const hatMat = useCachedMaterial('exp-mat-hat', () => new THREE.MeshStandardMaterial({ color: '#d4b98c', roughness: 0.82, metalness: 0.04 }));
    const pantsMat = useCachedMaterial('exp-mat-pants', () => new THREE.MeshStandardMaterial({ color: '#2d3640', roughness: 0.85, metalness: 0.04 }));
    const bootMat = useCachedMaterial('exp-mat-boot', () => new THREE.MeshStandardMaterial({ color: '#5c3d28', roughness: 0.72, metalness: 0.08 }));

    useImperativeHandle(
      ref,
      () => ({
        get rootGroup() {
          return rootGroupRef.current;
        },
        get bodyGroup() {
          return bodyGroupRef.current;
        },
        get headGroup() {
          return headGroupRef.current;
        },
        get leftArmPivot() {
          return leftArmRef.current;
        },
        get rightArmPivot() {
          return rightArmRef.current;
        },
        get leftLegPivot() {
          return leftLegRef.current;
        },
        get rightLegPivot() {
          return rightLegRef.current;
        },
        get scarfTail() {
          return scarfTailRef.current;
        },
      }),
      [],
    );

    return (
      <group ref={rootGroupRef} name="explorer-character">
        <group ref={bodyGroupRef} position={[0, 0.84, 0]}>
          <mesh geometry={torsoGeo} material={tunicMat} castShadow={cast} receiveShadow={cast} />
          <mesh geometry={beltGeo} material={beltMat} castShadow={cast} position={[0, -0.14, 0]} />
          <mesh geometry={buckleGeo} material={brassMat} castShadow={cast} position={[0, -0.14, -0.215]} />
          <mesh geometry={scarfCollarGeo} material={scarfMat} castShadow={cast} position={[0, 0.24, 0]} rotation={[0.12, 0, 0]} />
          <mesh ref={scarfTailRef} geometry={scarfTailGeo} material={scarfMat} castShadow={cast} position={[0.06, 0.14, 0.21]} rotation={[0.25, 0, -0.1]} />

          <group position={[0, 0.03, 0.25]}>
            <mesh geometry={packGeo} material={packMat} castShadow={cast} receiveShadow={cast} />
            <mesh geometry={bedrollGeo} material={bedrollMat} castShadow={cast} position={[0, 0.22, 0]} rotation={[0, 0, Math.PI / 2]} />
            <mesh geometry={claspGeo} material={brassMat} castShadow={cast} position={[0, 0.05, 0.095]} />
          </group>

          <group ref={headGroupRef} position={[0, 0.43, 0]}>
            <mesh geometry={headGeo} material={skinMat} castShadow={cast} receiveShadow={cast} />
            <mesh geometry={eyeGeo} material={eyeMat} position={[-0.065, 0.02, -0.168]} />
            <mesh geometry={eyeGeo} material={eyeMat} position={[0.065, 0.02, -0.168]} />
            <mesh geometry={brimGeo} material={hatMat} castShadow={cast} position={[0, 0.12, 0]} rotation={[-0.08, 0, 0]} />
            <mesh geometry={crownGeo} material={hatMat} castShadow={cast} position={[0, 0.21, 0]} rotation={[-0.08, 0, 0]} />
            <mesh geometry={hatBandGeo} material={scarfMat} position={[0, 0.15, 0]} rotation={[-0.08, 0, 0]} />
          </group>

          <group ref={leftArmRef} position={[-0.27, 0.17, 0]}>
            <mesh geometry={armGeo} material={sleeveMat} castShadow={cast} position={[0, -0.16, 0]} />
            <mesh geometry={handGeo} material={skinMat} castShadow={cast} position={[0, -0.34, 0]} />
          </group>

          <group ref={rightArmRef} position={[0.27, 0.17, 0]}>
            <mesh geometry={armGeo} material={sleeveMat} castShadow={cast} position={[0, -0.16, 0]} />
            <mesh geometry={handGeo} material={skinMat} castShadow={cast} position={[0, -0.34, 0]} />
          </group>
        </group>

        <group ref={leftLegRef} position={[-0.11, 0.56, 0]}>
          <mesh geometry={legGeo} material={pantsMat} castShadow={cast} position={[0, -0.2, 0]} />
          <mesh geometry={bootGeo} material={bootMat} castShadow={cast} position={[0, -0.5, -0.03]} />
        </group>

        <group ref={rightLegRef} position={[0.11, 0.56, 0]}>
          <mesh geometry={legGeo} material={pantsMat} castShadow={cast} position={[0, -0.2, 0]} />
          <mesh geometry={bootGeo} material={bootMat} castShadow={cast} position={[0, -0.5, -0.03]} />
        </group>
      </group>
    );
  },
);
