import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { CuboidCollider, RigidBody } from '@react-three/rapier';
import * as THREE from 'three';
import { Interactable } from '@/src/game/collectibles/Interactable';
import { eventBus } from '@/src/state/eventBus';
import { useGameStore } from '@/src/state/gameStore';

export interface SwitchProps {
  id: string;
  label?: string;
  position: [number, number, number];
  rotationY?: number;
  oneShot?: boolean;
}

export function Switch({
  id,
  label = 'Ancient Switch',
  position,
  rotationY = 0,
  oneShot = false,
}: SwitchProps) {
  const active = useGameStore((s) => Boolean(s.activatedIds[id]));
  const leverRef = useRef<THREE.Group>(null);

  useFrame((_, rawDt) => {
    const dt = Math.min(rawDt, 0.05);
    if (leverRef.current) {
      const targetAngle = active ? 0.55 : -0.55;
      leverRef.current.rotation.x = THREE.MathUtils.lerp(
        leverRef.current.rotation.x,
        targetAngle,
        1 - Math.exp(-12 * dt),
      );
    }
  });

  const handleToggle = () => {
    const store = useGameStore.getState();
    const current = Boolean(store.activatedIds[id]);
    if (oneShot && current) return;
    const next = !current;
    store.setActivated(id, next);
    store.showToast(`${label} ${next ? 'Activated' : 'Deactivated'}`);
    eventBus.emit('switch:toggled', { id, active: next });
  };

  return (
    <group position={position} rotation={[0, rotationY, 0]}>
      <Interactable
        id={id}
        prompt={
          active
            ? oneShot
              ? `${label} Active`
              : `Deactivate ${label}`
            : `Activate ${label}`
        }
        actionLabel={
          active ? (oneShot ? 'Active' : 'Deactivate') : 'Activate'
        }
        informationalOnly={oneShot && active}
        radius={2.3}
        disabled={oneShot && active}
        onInteract={handleToggle}
      >
        {/* Stone Pedestal */}
        <RigidBody type="fixed" colliders={false}>
          <CuboidCollider args={[0.45, 0.52, 0.45]} position={[0, 0.52, 0]} />
          <mesh castShadow receiveShadow position={[0, 0.5, 0]}>
            <boxGeometry args={[0.86, 1.0, 0.86]} />
            <meshStandardMaterial color="#6b7268" roughness={0.86} />
          </mesh>
          <mesh castShadow position={[0, 1.04, 0]}>
            <boxGeometry args={[0.96, 0.1, 0.96]} />
            <meshStandardMaterial color="#879184" roughness={0.82} />
          </mesh>
        </RigidBody>

        {/* Lever Arm + Rune Orb */}
        <group ref={leverRef} position={[0, 1.08, 0]}>
          <mesh castShadow position={[0, 0.34, 0]}>
            <cylinderGeometry args={[0.06, 0.08, 0.68, 10]} />
            <meshStandardMaterial
              color="#78716c"
              roughness={0.5}
              metalness={0.45}
            />
          </mesh>
          <mesh castShadow position={[0, 0.72, 0]}>
            <octahedronGeometry args={[0.18, 0]} />
            <meshStandardMaterial
              color={active ? '#2dd4bf' : '#f59e0b'}
              emissive={active ? '#14b8a6' : '#b45309'}
              emissiveIntensity={active ? 1.4 : 0.4}
              roughness={0.22}
            />
          </mesh>
        </group>
      </Interactable>
    </group>
  );
}
