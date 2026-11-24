import { useEffect, useMemo, useRef, useState } from 'react';
import { useFrame } from '@react-three/fiber';
import {
  CuboidCollider,
  RigidBody,
  type IntersectionEnterPayload,
  type RapierCollider,
} from '@react-three/rapier';
import * as THREE from 'three';
import {
  isPlayerPayload,
  registerIceCollider,
  unregisterIceCollider,
} from '@/src/game/physics';
import { playPooledSynth } from '@/src/systems/audioSystem';

type SegmentPhase = 'intact' | 'cracking' | 'broken';

function IceBridgeSegment({
  position,
  rotationY,
  size,
  crackDuration = 0.75,
  respawnDuration = 4.2,
}: {
  position: [number, number, number];
  rotationY: number;
  size: [number, number, number];
  crackDuration?: number;
  respawnDuration?: number;
}) {
  const [phase, setPhase] = useState<SegmentPhase>('intact');
  const meshGroupRef = useRef<THREE.Group>(null);
  const colliderRef = useRef<RapierCollider>(null);
  const timerRef = useRef(0);

  useEffect(() => {
    const col = colliderRef.current;
    if (col && phase !== 'broken') {
      registerIceCollider(col.handle);
    }
    return () => {
      if (col) {
        unregisterIceCollider(col.handle);
      }
    };
  }, [phase]);

  useFrame((state, rawDt) => {
    const dt = Math.min(rawDt, 0.05);
    const grp = meshGroupRef.current;

    if (phase === 'cracking') {
      timerRef.current += dt;
      if (grp) {
        const t = state.clock.elapsedTime * 42;
        grp.position.set(
          Math.sin(t) * 0.045,
          -timerRef.current * 0.08,
          Math.cos(t * 1.3) * 0.045,
        );
      }
      if (timerRef.current >= crackDuration) {
        timerRef.current = 0;
        setPhase('broken');
      }
    } else if (phase === 'broken') {
      timerRef.current += dt;
      if (grp) {
        grp.position.y = -Math.min(4.5, timerRef.current * 6.5);
        grp.scale.setScalar(Math.max(0.05, 1 - timerRef.current * 0.55));
      }
      if (timerRef.current >= respawnDuration) {
        timerRef.current = 0;
        if (grp) {
          grp.position.set(0, 0, 0);
          grp.scale.setScalar(1);
        }
        setPhase('intact');
      }
    } else if (grp) {
      grp.position.set(0, 0, 0);
      grp.scale.setScalar(1);
    }
  });

  const handleStep = (payload: IntersectionEnterPayload) => {
    if (phase !== 'intact' || !isPlayerPayload(payload)) return;
    timerRef.current = 0;
    setPhase('cracking');
    playPooledSynth('switch');
  };

  return (
    <group position={position} rotation={[0, rotationY, 0]}>
      {phase !== 'broken' && (
        <RigidBody type="fixed" colliders={false}>
          <CuboidCollider
            ref={colliderRef}
            args={[size[0] / 2, size[1] / 2, size[2] / 2]}
          />
          <CuboidCollider
            args={[size[0] * 0.48, 0.25, size[2] * 0.48]}
            position={[0, size[1] / 2 + 0.16, 0]}
            sensor
            onIntersectionEnter={handleStep}
          />
        </RigidBody>
      )}

      <group ref={meshGroupRef} visible={phase !== 'broken'}>
        <mesh castShadow receiveShadow>
          <boxGeometry args={size} />
          <meshStandardMaterial
            color={phase === 'cracking' ? '#e0f2fe' : '#bae6fd'}
            emissive={phase === 'cracking' ? '#f59e0b' : '#0284c7'}
            emissiveIntensity={phase === 'cracking' ? 0.55 : 0.22}
            roughness={0.16}
            metalness={0.1}
            transparent
            opacity={phase === 'cracking' ? 0.85 : 0.92}
          />
        </mesh>
        {/* Fracture vein indicator across top */}
        <mesh position={[0, size[1] / 2 + 0.012, 0]} rotation={[0, 0.4, 0]}>
          <boxGeometry args={[size[0] * 0.78, 0.02, 0.1]} />
          <meshStandardMaterial
            color={phase === 'cracking' ? '#fbbf24' : '#7dd3fc'}
            emissive={phase === 'cracking' ? '#f59e0b' : '#0ea5e9'}
            emissiveIntensity={phase === 'cracking' ? 1.1 : 0.35}
          />
        </mesh>
      </group>
    </group>
  );
}

export interface BreakableIceBridgeProps {
  id: string;
  start: [number, number, number];
  end: [number, number, number];
  segments?: number;
  width?: number;
  crackDuration?: number;
  respawnDuration?: number;
}

export function BreakableIceBridge({
  id,
  start,
  end,
  segments = 3,
  width = 2.6,
  crackDuration = 0.75,
  respawnDuration = 4.2,
}: BreakableIceBridgeProps) {
  const { items, rotationY, segLength } = useMemo(() => {
    const dx = end[0] - start[0];
    const dy = end[1] - start[1];
    const dz = end[2] - start[2];
    const totalHoriz = Math.hypot(dx, dz) || 1;
    const angle = Math.atan2(dx, dz);
    const len = Math.max(1.2, totalHoriz / segments - 0.14);

    const list: Array<{ key: string; pos: [number, number, number] }> = [];
    for (let i = 0; i < segments; i++) {
      const t = (i + 0.5) / segments;
      list.push({
        key: `${id}-seg-${i}`,
        pos: [start[0] + dx * t, start[1] + dy * t, start[2] + dz * t],
      });
    }
    return { items: list, rotationY: angle, segLength: len };
  }, [id, start, end, segments]);

  return (
    <group name={`breakable-bridge-${id}`}>
      {items.map((item) => (
        <IceBridgeSegment
          key={item.key}
          position={item.pos}
          rotationY={rotationY}
          size={[width, 0.36, segLength]}
          crackDuration={crackDuration}
          respawnDuration={respawnDuration}
        />
      ))}
    </group>
  );
}
