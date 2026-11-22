import { useEffect, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import {
  CuboidCollider,
  RigidBody,
  type IntersectionEnterPayload,
  type IntersectionExitPayload,
} from '@react-three/rapier';
import * as THREE from 'three';
import { isPlayerPayload } from '@/src/game/physics';
import { eventBus } from '@/src/state/eventBus';
import { useGameStore } from '@/src/state/gameStore';

export interface PressurePlateProps {
  id: string;
  position: [number, number, number];
  size?: [number, number];
  label?: string;
}

export function PressurePlate({
  id,
  position,
  size = [2.2, 2.2],
  label = 'Rune Plate',
}: PressurePlateProps) {
  const active = useGameStore((s) => Boolean(s.activatedIds[id]));
  const occupantsRef = useRef<Set<number>>(new Set());
  const mountedRef = useRef(true);
  const padRef = useRef<THREE.Mesh>(null);

  useEffect(() => {
    mountedRef.current = true;
    const occupants = occupantsRef.current;
    return () => {
      mountedRef.current = false;
      occupants.clear();
      // Preserve solved/activated state in worldState when chunk streams out
    };
  }, [id]);

  useFrame((_, rawDt) => {
    const dt = Math.min(rawDt, 0.05);
    if (padRef.current) {
      const targetY = active ? 0.06 : 0.14;
      padRef.current.position.y = THREE.MathUtils.lerp(
        padRef.current.position.y,
        targetY,
        1 - Math.exp(-16 * dt),
      );
    }
  });

  const isValidPresser = (
    payload: IntersectionEnterPayload | IntersectionExitPayload,
  ) => {
    if (isPlayerPayload(payload)) return true;
    return Boolean(payload.other.rigidBody?.isDynamic());
  };

  const syncActiveState = () => {
    if (!mountedRef.current) return;
    const nextActive = occupantsRef.current.size > 0;
    const prevActive = Boolean(useGameStore.getState().activatedIds[id]);
    if (nextActive !== prevActive) {
      useGameStore.getState().setActivated(id, nextActive);
      if (nextActive) {
        useGameStore.getState().showToast(`${label} Engaged`);
      }
      eventBus.emit('plate:changed', { id, active: nextActive });
    }
  };

  const handleEnter = (payload: IntersectionEnterPayload) => {
    if (!isValidPresser(payload)) return;
    occupantsRef.current.add(payload.other.collider.handle);
    syncActiveState();
  };

  const handleExit = (payload: IntersectionExitPayload) => {
    if (!mountedRef.current) return;
    if (!occupantsRef.current.has(payload.other.collider.handle)) return;
    occupantsRef.current.delete(payload.other.collider.handle);
    syncActiveState();
  };

  const [w, d] = size;

  return (
    <group position={position}>
      {/* Stone Frame */}
      <RigidBody type="fixed" colliders={false}>
        <CuboidCollider
          args={[w / 2 + 0.18, 0.08, d / 2 + 0.18]}
          position={[0, 0.06, 0]}
        />
        <mesh receiveShadow position={[0, 0.06, 0]}>
          <boxGeometry args={[w + 0.36, 0.12, d + 0.36]} />
          <meshStandardMaterial color="#575f58" roughness={0.88} />
        </mesh>
      </RigidBody>

      {/* Movable Inner Pad */}
      <mesh ref={padRef} receiveShadow castShadow position={[0, 0.14, 0]}>
        <boxGeometry args={[w, 0.12, d]} />
        <meshStandardMaterial
          color={active ? '#2dd4bf' : '#9ca398'}
          emissive={active ? '#0d9488' : '#000000'}
          emissiveIntensity={active ? 0.9 : 0}
          roughness={active ? 0.35 : 0.8}
        />
      </mesh>

      {/* Pressure Sensor Volume */}
      <RigidBody type="fixed" colliders={false} sensor>
        <CuboidCollider
          args={[w / 2 - 0.08, 0.38, d / 2 - 0.08]}
          position={[0, 0.42, 0]}
          sensor
          onIntersectionEnter={handleEnter}
          onIntersectionExit={handleExit}
        />
      </RigidBody>
    </group>
  );
}
