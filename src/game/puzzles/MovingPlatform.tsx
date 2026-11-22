import { useEffect, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import {
  CuboidCollider,
  RigidBody,
  type RapierCollider,
  type RapierRigidBody,
} from '@react-three/rapier';
import {
  removeMovingPlatformDelta,
  setMovingPlatformDelta,
} from '@/src/game/physics';
import { useGameStore } from '@/src/state/gameStore';

export interface MovingPlatformProps {
  id?: string;
  chunkId?: string;
  from: [number, number, number];
  to: [number, number, number];
  size?: [number, number, number];
  speed?: number;
  color?: string;
}

export function MovingPlatform({
  id = 'moving-platform-default',
  chunkId,
  from,
  to,
  size = [3.6, 0.5, 3.6],
  speed = 0.45,
  color = '#748279',
}: MovingPlatformProps) {
  const bodyRef = useRef<RapierRigidBody>(null);
  const colliderRef = useRef<RapierCollider>(null);

  const savedPhase = useGameStore
    .getState()
    .getWorldObjectState(id)?.phase;
  const timeRef = useRef(typeof savedPhase === 'number' ? savedPhase : 0);

  const initialAlpha = 0.5 - 0.5 * Math.cos(timeRef.current * Math.PI);
  const initialPos: [number, number, number] = [
    from[0] + (to[0] - from[0]) * initialAlpha,
    from[1] + (to[1] - from[1]) * initialAlpha,
    from[2] + (to[2] - from[2]) * initialAlpha,
  ];

  const prevPosRef = useRef({
    x: initialPos[0],
    y: initialPos[1],
    z: initialPos[2],
  });

  useEffect(() => {
    return () => {
      if (colliderRef.current) {
        removeMovingPlatformDelta(colliderRef.current.handle);
      }
      // Persist platform phase on unmount so remounting the chunk resumes seamlessly
      useGameStore.getState().setWorldObjectState(id, {
        chunkId,
        phase: timeRef.current,
      });
    };
  }, [id, chunkId]);

  useFrame((_, rawDt) => {
    const body = bodyRef.current;
    const collider = colliderRef.current;
    if (!body || !collider) return;

    if (useGameStore.getState().screen !== 'playing') return;

    const dt = Math.min(rawDt, 0.05);
    timeRef.current += dt * speed;

    // Smooth cosine ping-pong between 0 and 1
    const alpha = 0.5 - 0.5 * Math.cos(timeRef.current * Math.PI);
    const nx = from[0] + (to[0] - from[0]) * alpha;
    const ny = from[1] + (to[1] - from[1]) * alpha;
    const nz = from[2] + (to[2] - from[2]) * alpha;

    const prev = prevPosRef.current;
    setMovingPlatformDelta(
      collider.handle,
      nx - prev.x,
      ny - prev.y,
      nz - prev.z,
    );
    prev.x = nx;
    prev.y = ny;
    prev.z = nz;

    body.setNextKinematicTranslation({ x: nx, y: ny, z: nz });
  });

  return (
    <RigidBody
      ref={bodyRef}
      type="kinematicPosition"
      position={initialPos}
      colliders={false}
    >
      <CuboidCollider
        ref={colliderRef}
        args={[size[0] / 2, size[1] / 2, size[2] / 2]}
      />
      <mesh castShadow receiveShadow>
        <boxGeometry args={size} />
        <meshStandardMaterial color={color} roughness={0.78} metalness={0.08} />
      </mesh>
      <mesh position={[0, size[1] / 2 + 0.01, 0]}>
        <boxGeometry args={[size[0] * 0.72, 0.03, size[2] * 0.72]} />
        <meshStandardMaterial
          color="#2dd4bf"
          emissive="#0f766e"
          emissiveIntensity={0.45}
          roughness={0.4}
        />
      </mesh>
    </RigidBody>
  );
}
