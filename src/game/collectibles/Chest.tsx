import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { CuboidCollider, RigidBody } from '@react-three/rapier';
import * as THREE from 'three';
import { eventBus } from '@/src/state/eventBus';
import { useGameStore } from '@/src/state/gameStore';
import { Interactable } from './Interactable';

export interface ChestProps {
  id: string;
  position: [number, number, number];
  rotationY?: number;
  rewardItem: string;
}

export function Chest({
  id,
  position,
  rotationY = 0,
  rewardItem,
}: ChestProps) {
  const opened = useGameStore((s) =>
    Boolean(s.activatedIds[id] || s.foundChestIds.includes(id)),
  );
  const lidPivotRef = useRef<THREE.Group>(null);
  const glowRef = useRef<THREE.Mesh>(null);

  useFrame((_, rawDt) => {
    const dt = Math.min(rawDt, 0.05);
    const targetRot = opened ? -1.85 : 0;
    if (lidPivotRef.current) {
      lidPivotRef.current.rotation.x = THREE.MathUtils.lerp(
        lidPivotRef.current.rotation.x,
        targetRot,
        1 - Math.exp(-10 * dt),
      );
    }
    if (glowRef.current) {
      const targetScale = opened ? 1 : 0.01;
      const next = THREE.MathUtils.lerp(
        glowRef.current.scale.x,
        targetScale,
        1 - Math.exp(-8 * dt),
      );
      glowRef.current.scale.setScalar(next);
      glowRef.current.visible = next > 0.05;
    }
  });

  const handleOpen = () => {
    const store = useGameStore.getState();
    if (store.openChest(id, rewardItem)) {
      eventBus.emit('chest:opened', { id, reward: rewardItem });
    }
  };

  return (
    <group position={position} rotation={[0, rotationY, 0]}>
      <Interactable
        id={id}
        prompt={`Press E to Open Chest`}
        radius={2.2}
        disabled={opened}
        onInteract={handleOpen}
      >
        <RigidBody type="fixed" colliders={false}>
          <CuboidCollider args={[0.62, 0.42, 0.42]} position={[0, 0.42, 0]} />
          {/* Chest Base */}
          <mesh castShadow receiveShadow position={[0, 0.3, 0]}>
            <boxGeometry args={[1.18, 0.56, 0.76]} />
            <meshStandardMaterial color="#6e472b" roughness={0.78} />
          </mesh>
          {/* Brass Corner Bands */}
          <mesh castShadow position={[-0.48, 0.3, 0]}>
            <boxGeometry args={[0.1, 0.58, 0.79]} />
            <meshStandardMaterial
              color="#d4a84f"
              roughness={0.32}
              metalness={0.75}
            />
          </mesh>
          <mesh castShadow position={[0.48, 0.3, 0]}>
            <boxGeometry args={[0.1, 0.58, 0.79]} />
            <meshStandardMaterial
              color="#d4a84f"
              roughness={0.32}
              metalness={0.75}
            />
          </mesh>
          {/* Lockplate */}
          <mesh castShadow position={[0, 0.48, 0.39]}>
            <boxGeometry args={[0.18, 0.2, 0.04]} />
            <meshStandardMaterial
              color="#e6be67"
              roughness={0.28}
              metalness={0.8}
            />
          </mesh>
        </RigidBody>

        {/* Hinged Lid */}
        <group ref={lidPivotRef} position={[0, 0.58, -0.38]}>
          <mesh castShadow position={[0, 0.12, 0.38]}>
            <boxGeometry args={[1.2, 0.24, 0.78]} />
            <meshStandardMaterial color="#7d5233" roughness={0.76} />
          </mesh>
          <mesh castShadow position={[-0.48, 0.13, 0.38]}>
            <boxGeometry args={[0.1, 0.26, 0.8]} />
            <meshStandardMaterial
              color="#d4a84f"
              roughness={0.32}
              metalness={0.75}
            />
          </mesh>
          <mesh castShadow position={[0.48, 0.13, 0.38]}>
            <boxGeometry args={[0.1, 0.26, 0.8]} />
            <meshStandardMaterial
              color="#d4a84f"
              roughness={0.32}
              metalness={0.75}
            />
          </mesh>
        </group>

        {/* Treasure Glow inside open chest */}
        <mesh ref={glowRef} position={[0, 0.65, 0]} scale={0.01}>
          <octahedronGeometry args={[0.24, 0]} />
          <meshStandardMaterial
            color="#fbbf24"
            emissive="#f59e0b"
            emissiveIntensity={1.6}
            roughness={0.2}
          />
        </mesh>
      </Interactable>
    </group>
  );
}
