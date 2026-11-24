import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import {
  CuboidCollider,
  RigidBody,
  type RapierRigidBody,
} from '@react-three/rapier';
import * as THREE from 'three';
import { Interactable } from '@/src/game/collectibles/Interactable';
import { useGameStore } from '@/src/state/gameStore';

export interface DoorProps {
  id: string;
  position: [number, number, number];
  rotationY?: number;
  width?: number;
  height?: number;
  requiredIds?: string[];
  requiredKeyId?: string;
  keyLabel?: string;
}

export function Door({
  id,
  position,
  rotationY = 0,
  width = 4.0,
  height = 4.2,
  requiredIds = [],
  requiredKeyId,
  keyLabel = 'Ancient Key',
}: DoorProps) {
  const activatedIds = useGameStore((s) => s.activatedIds);
  const keys = useGameStore((s) => s.keys);
  const keyUnlocked = Boolean(activatedIds[`door-unlocked-${id}`]);

  const switchesSatisfied = useMemo(
    () => requiredIds.every((reqId) => Boolean(activatedIds[reqId])),
    [requiredIds, activatedIds],
  );
  const keySatisfied = !requiredKeyId || keyUnlocked;
  const isOpen = switchesSatisfied && keySatisfied;

  const gateBodyRef = useRef<RapierRigidBody>(null);
  const openProgressRef = useRef(isOpen ? 1 : 0);

  useFrame((_, rawDt) => {
    const dt = Math.min(rawDt, 0.05);
    const target = isOpen ? 1 : 0;
    openProgressRef.current = THREE.MathUtils.lerp(
      openProgressRef.current,
      target,
      1 - Math.exp(-4.5 * dt),
    );

    if (gateBodyRef.current) {
      const localY = height / 2 + openProgressRef.current * (height + 0.35);
      gateBodyRef.current.setNextKinematicTranslation({
        x: position[0],
        y: position[1] + localY,
        z: position[2],
      });
    }
  });

  const hasKeyInBag = requiredKeyId ? keys.includes(requiredKeyId) : false;

  const handleKeyInteract = () => {
    if (!requiredKeyId) return;
    const store = useGameStore.getState();
    if (store.keys.includes(requiredKeyId)) {
      store.unlockDoor(id, requiredKeyId, keyLabel);
    } else {
      store.showToast(`Requires ${keyLabel}`);
    }
  };

  const pillarWidth = 0.85;
  const halfSpan = width / 2 + pillarWidth / 2;

  return (
    <>
      <group position={position} rotation={[0, rotationY, 0]}>
        {/* Left & Right Solid Archway Jambs + Lintel */}
        <RigidBody type="fixed" colliders={false}>
          <CuboidCollider
            args={[pillarWidth / 2, height / 2 + 0.3, 0.65]}
            position={[-halfSpan, height / 2 + 0.3, 0]}
          />
          <CuboidCollider
            args={[pillarWidth / 2, height / 2 + 0.3, 0.65]}
            position={[halfSpan, height / 2 + 0.3, 0]}
          />
          <CuboidCollider
            args={[width / 2 + pillarWidth, 0.55, 0.7]}
            position={[0, height + 0.55, 0]}
          />

          <mesh
            castShadow
            receiveShadow
            position={[-halfSpan, height / 2 + 0.3, 0]}
          >
            <boxGeometry args={[pillarWidth, height + 0.6, 1.3]} />
            <meshStandardMaterial color="#676e65" roughness={0.86} />
          </mesh>
          <mesh
            castShadow
            receiveShadow
            position={[halfSpan, height / 2 + 0.3, 0]}
          >
            <boxGeometry args={[pillarWidth, height + 0.6, 1.3]} />
            <meshStandardMaterial color="#676e65" roughness={0.86} />
          </mesh>
          <mesh castShadow receiveShadow position={[0, height + 0.55, 0]}>
            <boxGeometry args={[width + pillarWidth * 2, 1.1, 1.4]} />
            <meshStandardMaterial color="#7b8378" roughness={0.84} />
          </mesh>
        </RigidBody>

        {/* Key-locked Door Interactable Prompt */}
        {requiredKeyId && !keyUnlocked && (
          <Interactable
            id={`door-lock-${id}`}
            prompt={
              hasKeyInBag
                ? `Unlock (${keyLabel})`
                : `Locked — Needs ${keyLabel}`
            }
            actionLabel={hasKeyInBag ? 'Unlock' : 'Inspect'}
            informationalOnly={!hasKeyInBag}
            position={[0, 1.2, 0]}
            radius={2.6}
            onInteract={handleKeyInteract}
          />
        )}
      </group>

      {/* Animated Sliding Stone Gate Slab (world-positioned for kinematic translation) */}
      <RigidBody
        ref={gateBodyRef}
        type="kinematicPosition"
        position={[position[0], position[1] + height / 2, position[2]]}
        rotation={[0, rotationY, 0]}
        colliders={false}
      >
        <CuboidCollider args={[width / 2, height / 2, 0.35]} />
        <mesh castShadow receiveShadow>
          <boxGeometry args={[width, height, 0.65]} />
          <meshStandardMaterial color="#4e5854" roughness={0.82} />
        </mesh>
        <mesh position={[0, 0, 0.34]}>
          <boxGeometry args={[width * 0.65, 0.24, 0.04]} />
          <meshStandardMaterial
            color={isOpen ? '#2dd4bf' : '#f59e0b'}
            emissive={isOpen ? '#14b8a6' : '#b45309'}
            emissiveIntensity={isOpen ? 1.2 : 0.65}
            roughness={0.3}
          />
        </mesh>
      </RigidBody>
    </>
  );
}
