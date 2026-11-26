import { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { CuboidCollider, RigidBody } from '@react-three/rapier';
import * as THREE from 'three';
import { Interactable } from '@/src/game/collectibles';
import { useGameStore } from '@/src/state/gameStore';
import { playPooledSynth } from '@/src/systems/audioSystem';

export interface CrackedIceWallProps {
  id: string;
  position: [number, number, number];
  rotationY?: number;
  width?: number;
  height?: number;
  requiredIds: string[];
  lockedMessage?: string;
}

export function CrackedIceWall({
  id,
  position,
  rotationY = 0,
  width = 5.4,
  height = 4.2,
  requiredIds,
  lockedMessage = 'Sealed by thick fractured ice — activate the nearby Thermal Mechanism',
}: CrackedIceWallProps) {
  const activatedIds = useGameStore((s) => s.activatedIds);
  const shattered = useMemo(
    () => requiredIds.every((req) => Boolean(activatedIds[req])),
    [requiredIds, activatedIds],
  );

  const shardsRef = useRef<THREE.Group>(null);
  const collapseRef = useRef(shattered ? 1 : 0);
  const prevShatteredRef = useRef(shattered);

  useEffect(() => {
    if (shattered && !prevShatteredRef.current) {
      playPooledSynth('mechanism');
    }
    prevShatteredRef.current = shattered;
  }, [shattered]);

  useFrame((_, rawDt) => {
    const dt = Math.min(rawDt, 0.05);
    const target = shattered ? 1 : 0;
    collapseRef.current = THREE.MathUtils.lerp(
      collapseRef.current,
      target,
      1 - Math.exp(-5.0 * dt),
    );
    if (shardsRef.current) {
      const p = collapseRef.current;
      shardsRef.current.position.y = -p * (height * 0.9);
      shardsRef.current.scale.setScalar(Math.max(0.01, 1 - p));
      shardsRef.current.visible = p < 0.96;
    }
  });

  return (
    <group position={position} rotation={[0, rotationY, 0]} name={`cracked-ice-wall-${id}`}>
      {!shattered && (
        <RigidBody type="fixed" colliders={false}>
          <CuboidCollider
            args={[width / 2, height / 2, 0.6]}
            position={[0, height / 2, 0]}
          />
        </RigidBody>
      )}

      {!shattered && (
        <Interactable
          id={`ice-wall-hint-${id}`}
          prompt={lockedMessage}
          actionLabel="Inspect"
          informationalOnly
          position={[0, 1.2, 0]}
          radius={2.8}
          onInteract={() => {
            useGameStore.getState().showToast(lockedMessage, 'info');
          }}
        />
      )}

      <group ref={shardsRef}>
        {/* Main Cracked Ice Block */}
        <mesh castShadow receiveShadow position={[0, height / 2, 0]}>
          <boxGeometry args={[width, height, 1.05]} />
          <meshStandardMaterial
            color="#bae6fd"
            emissive="#0284c7"
            emissiveIntensity={0.28}
            roughness={0.18}
            transparent
            opacity={0.86}
          />
        </mesh>
        {/* Jagged Ice Spires & Glowing Fault Lines */}
        {[-1.5, -0.4, 0.7, 1.7].map((xOff, idx) => (
          <mesh
            key={`${id}-spike-${idx}`}
            position={[xOff, height * (0.45 + (idx % 2) * 0.14), 0.35]}
            rotation={[0.12, idx * 0.4, (idx % 2 === 0 ? 1 : -1) * 0.2]}
          >
            <coneGeometry args={[0.55, height * 0.65, 5]} />
            <meshStandardMaterial
              color="#e0f2fe"
              emissive="#38bdf8"
              emissiveIntensity={0.35}
              roughness={0.15}
              transparent
              opacity={0.9}
            />
          </mesh>
        ))}
        <mesh position={[0, height * 0.5, 0.54]} rotation={[0, 0, 0.35]}>
          <boxGeometry args={[width * 0.75, 0.1, 0.06]} />
          <meshStandardMaterial
            color="#fbbf24"
            emissive="#f59e0b"
            emissiveIntensity={0.9}
          />
        </mesh>
      </group>
    </group>
  );
}
