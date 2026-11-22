import { useRef, useState } from 'react';
import { useFrame } from '@react-three/fiber';
import {
  BallCollider,
  RigidBody,
  type IntersectionEnterPayload,
} from '@react-three/rapier';
import * as THREE from 'three';
import { isPlayerPayload } from '@/src/game/physics';
import { eventBus } from '@/src/state/eventBus';
import { useGameStore } from '@/src/state/gameStore';

export interface KeyItemProps {
  id: string;
  label: string;
  position: [number, number, number];
}

export function KeyItem({ id, label, position }: KeyItemProps) {
  const collected = useGameStore((s) => Boolean(s.collectedIds[id]));
  const groupRef = useRef<THREE.Group>(null);
  const scaleRef = useRef(1);
  const [hidden, setHidden] = useState(collected);

  useFrame((state, rawDt) => {
    const dt = Math.min(rawDt, 0.05);
    const group = groupRef.current;
    if (!group || hidden) return;

    group.rotation.y += dt * 1.9;
    group.position.y = Math.sin(state.clock.elapsedTime * 2.5) * 0.14;

    if (collected) {
      scaleRef.current = Math.max(0, scaleRef.current - dt * 4.5);
      group.scale.setScalar(scaleRef.current);
      if (scaleRef.current <= 0.01) {
        setHidden(true);
      }
    }
  });

  const handleEnter = (payload: IntersectionEnterPayload) => {
    if (collected || !isPlayerPayload(payload)) return;
    const store = useGameStore.getState();
    if (store.markCollected(id)) {
      store.addKey(id, label);
      store.showToast(`Acquired ${label}`);
      eventBus.emit('key:collected', { id, label });
    }
  };

  if (hidden) return null;

  return (
    <group position={position}>
      <group ref={groupRef}>
        {/* Key Bow (ring) */}
        <mesh castShadow position={[0, 0.26, 0]}>
          <torusGeometry args={[0.16, 0.045, 8, 16]} />
          <meshStandardMaterial
            color="#f59e0b"
            emissive="#d97706"
            emissiveIntensity={0.45}
            roughness={0.25}
            metalness={0.8}
          />
        </mesh>
        {/* Key Shaft */}
        <mesh castShadow position={[0, -0.05, 0]}>
          <cylinderGeometry args={[0.04, 0.04, 0.44, 10]} />
          <meshStandardMaterial
            color="#f59e0b"
            emissive="#d97706"
            emissiveIntensity={0.45}
            roughness={0.25}
            metalness={0.8}
          />
        </mesh>
        {/* Key Teeth */}
        <mesh castShadow position={[0.09, -0.19, 0]}>
          <boxGeometry args={[0.14, 0.06, 0.05]} />
          <meshStandardMaterial
            color="#f59e0b"
            roughness={0.25}
            metalness={0.8}
          />
        </mesh>
        <mesh castShadow position={[0.07, -0.08, 0]}>
          <boxGeometry args={[0.1, 0.05, 0.05]} />
          <meshStandardMaterial
            color="#f59e0b"
            roughness={0.25}
            metalness={0.8}
          />
        </mesh>
      </group>

      {!collected && (
        <RigidBody type="fixed" colliders={false} sensor>
          <BallCollider
            args={[0.9]}
            sensor
            onIntersectionEnter={handleEnter}
          />
        </RigidBody>
      )}
    </group>
  );
}
