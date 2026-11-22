import { useEffect, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { RigidBody, type RapierRigidBody } from '@react-three/rapier';
import * as THREE from 'three';
import { playerTelemetry } from '@/src/game/player/playerTelemetry';
import {
  useCachedGeometry,
  useCachedMaterial,
} from '@/src/game/rendering/assetCache';
import { useGameStore } from '@/src/state/gameStore';

export interface PushableBlockProps {
  id: string;
  chunkId?: string;
  position: [number, number, number];
  size?: number;
  color?: string;
}

export function PushableBlock({
  id,
  chunkId,
  position,
  size = 1.15,
  color = '#c29b6b',
}: PushableBlockProps) {
  const bodyRef = useRef<RapierRigidBody>(null);
  const savedPos = useGameStore.getState().getWorldObjectState(id)?.position;
  const startPos: [number, number, number] = savedPos ?? position;
  const lastSavedRef = useRef<[number, number, number]>(startPos);
  const checkTimerRef = useRef(0);

  const geom = useCachedGeometry(`pushable-box-${size}`, () => {
    const g = new THREE.BoxGeometry(size, size, size);
    g.computeBoundingSphere();
    return g;
  });

  const mat = useCachedMaterial(`pushable-mat-${color}`, () =>
    new THREE.MeshStandardMaterial({
      color,
      roughness: 0.78,
    }),
  );

  useEffect(() => {
    return () => {
      const body = bodyRef.current;
      if (body) {
        const t = body.translation();
        useGameStore.getState().setWorldObjectState(id, {
          chunkId,
          position: [
            Math.round(t.x * 100) / 100,
            Math.round(t.y * 100) / 100,
            Math.round(t.z * 100) / 100,
          ],
        });
      }
    };
  }, [id, chunkId]);

  useFrame((_, rawDt) => {
    const body = bodyRef.current;
    if (!body) return;
    checkTimerRef.current += Math.min(rawDt, 0.05);
    if (checkTimerRef.current < 0.35) return;
    checkTimerRef.current = 0;

    const t = body.translation();
    const p = playerTelemetry.position;
    const dist = Math.hypot(t.x - p.x, t.z - p.z);

    // Put far dynamic blocks to sleep to save Rapier solver work
    if (dist > 26 && !body.isSleeping()) {
      body.sleep();
    }

    const last = lastSavedRef.current;
    if (
      Math.hypot(t.x - last[0], t.y - last[1], t.z - last[2]) > 0.18
    ) {
      const next: [number, number, number] = [
        Math.round(t.x * 100) / 100,
        Math.round(t.y * 100) / 100,
        Math.round(t.z * 100) / 100,
      ];
      lastSavedRef.current = next;
      useGameStore.getState().setWorldObjectState(id, {
        chunkId,
        position: next,
      });
    }
  });

  return (
    <RigidBody
      ref={bodyRef}
      type="dynamic"
      position={startPos}
      colliders="cuboid"
      mass={2.5}
      friction={0.85}
      restitution={0.05}
      canSleep
    >
      <mesh geometry={geom} material={mat} castShadow receiveShadow />
    </RigidBody>
  );
}
