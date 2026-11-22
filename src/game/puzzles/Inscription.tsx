import { CuboidCollider, RigidBody } from '@react-three/rapier';
import { Interactable } from '@/src/game/collectibles/Interactable';
import { useGameStore } from '@/src/state/gameStore';

export interface InscriptionProps {
  id: string;
  position: [number, number, number];
  rotationY?: number;
  title: string;
  body: string;
}

export function Inscription({
  id,
  position,
  rotationY = 0,
  title,
  body,
}: InscriptionProps) {
  const handleRead = () => {
    document.exitPointerLock?.();
    useGameStore.getState().openInscription({ title, body });
  };

  return (
    <group position={position} rotation={[0, rotationY, 0]}>
      <Interactable
        id={id}
        prompt="Press E to Read Inscription"
        radius={2.3}
        onInteract={handleRead}
      >
        <RigidBody type="fixed" colliders={false}>
          <CuboidCollider args={[0.6, 0.9, 0.28]} position={[0, 0.9, 0]} />
          {/* Base Plinth */}
          <mesh castShadow receiveShadow position={[0, 0.16, 0]}>
            <boxGeometry args={[1.4, 0.32, 0.72]} />
            <meshStandardMaterial color="#5e655d" roughness={0.88} />
          </mesh>
          {/* Carved Stele Slab */}
          <mesh castShadow receiveShadow position={[0, 1.02, 0]}>
            <boxGeometry args={[1.08, 1.45, 0.36]} />
            <meshStandardMaterial color="#788076" roughness={0.85} />
          </mesh>
          {/* Etched Glowing Glyph Lines */}
          <mesh position={[0, 1.25, 0.19]}>
            <boxGeometry args={[0.68, 0.08, 0.03]} />
            <meshStandardMaterial
              color="#5eead4"
              emissive="#14b8a6"
              emissiveIntensity={1.1}
            />
          </mesh>
          <mesh position={[0, 1.03, 0.19]}>
            <boxGeometry args={[0.52, 0.08, 0.03]} />
            <meshStandardMaterial
              color="#5eead4"
              emissive="#14b8a6"
              emissiveIntensity={1.1}
            />
          </mesh>
          <mesh position={[0, 0.81, 0.19]}>
            <boxGeometry args={[0.62, 0.08, 0.03]} />
            <meshStandardMaterial
              color="#5eead4"
              emissive="#14b8a6"
              emissiveIntensity={1.1}
            />
          </mesh>
        </RigidBody>
      </Interactable>
    </group>
  );
}
