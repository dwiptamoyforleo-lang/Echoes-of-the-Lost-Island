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

export interface FragmentProps {
  id: string;
  name: string;
  position: [number, number, number];
}

export function Fragment({ id, name, position }: FragmentProps) {
  const [collecting, setCollecting] = useState(false);
  const collectProgressRef = useRef(0);
  const completedRef = useRef(false);

  const rootRef = useRef<THREE.Group>(null);
  const coreRef = useRef<THREE.Mesh>(null);
  const ringARef = useRef<THREE.Mesh>(null);
  const ringBRef = useRef<THREE.Mesh>(null);

  useFrame((state, rawDt) => {
    const dt = Math.min(rawDt, 0.05);
    const t = state.clock.elapsedTime;

    if (coreRef.current) {
      coreRef.current.rotation.y += dt * (collecting ? 6.0 : 1.4);
      coreRef.current.rotation.x = Math.sin(t * 1.2) * 0.2;
    }
    if (ringARef.current) {
      ringARef.current.rotation.z += dt * (collecting ? 5.2 : 1.1);
      ringARef.current.rotation.x = 0.7;
    }
    if (ringBRef.current) {
      ringBRef.current.rotation.x += dt * (collecting ? 4.8 : 0.9);
      ringBRef.current.rotation.y = 0.5;
    }

    if (rootRef.current) {
      if (collecting) {
        collectProgressRef.current += dt;
        const p = Math.min(1, collectProgressRef.current / 1.25);
        rootRef.current.position.y = p * 2.2;
        const scale = 1 + Math.sin(p * Math.PI) * 0.45 - p * 0.7;
        rootRef.current.scale.setScalar(Math.max(0.05, scale));

        if (p >= 1 && !completedRef.current) {
          completedRef.current = true;
          useGameStore.getState().completeLevel(name);
        }
      } else {
        rootRef.current.position.y = Math.sin(t * 2.0) * 0.16;
      }
    }
  });

  const handleEnter = (payload: IntersectionEnterPayload) => {
    if (collecting || !isPlayerPayload(payload)) return;
    const store = useGameStore.getState();
    setCollecting(true);
    store.collectFragment(id, name);
    eventBus.emit('fragment:collected', { id, name });
  };

  return (
    <group position={position}>
      <group ref={rootRef}>
        {/* Glowing Octahedral Core */}
        <mesh ref={coreRef} castShadow>
          <octahedronGeometry args={[0.52, 0]} />
          <meshStandardMaterial
            color="#5eead4"
            emissive="#14b8a6"
            emissiveIntensity={1.5}
            roughness={0.12}
            metalness={0.35}
          />
        </mesh>

        {/* Orbiting Ancient Brass Rings */}
        <mesh ref={ringARef}>
          <torusGeometry args={[0.82, 0.045, 10, 28]} />
          <meshStandardMaterial
            color="#f59e0b"
            emissive="#d97706"
            emissiveIntensity={0.35}
            roughness={0.25}
            metalness={0.85}
          />
        </mesh>
        <mesh ref={ringBRef}>
          <torusGeometry args={[0.98, 0.035, 10, 28]} />
          <meshStandardMaterial
            color="#fde68a"
            roughness={0.25}
            metalness={0.8}
          />
        </mesh>

        <pointLight color="#2dd4bf" intensity={3.2} distance={8} />
      </group>

      {!collecting && (
        <RigidBody type="fixed" colliders={false} sensor>
          <BallCollider
            args={[1.15]}
            sensor
            onIntersectionEnter={handleEnter}
          />
        </RigidBody>
      )}
    </group>
  );
}
