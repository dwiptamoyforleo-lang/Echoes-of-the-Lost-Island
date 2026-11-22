import { TriggerZone } from '@/src/game/puzzles';
import {
  useCachedGeometry,
  useCachedMaterial,
} from '@/src/game/rendering/assetCache';
import { eventBus } from '@/src/state/eventBus';
import { useGameStore } from '@/src/state/gameStore';
import * as THREE from 'three';

export function CheckpointBeacon({
  id,
  chunkId,
  position,
  spawnPos,
  label,
}: {
  id: string;
  chunkId?: string;
  position: [number, number, number];
  spawnPos: [number, number, number];
  label: string;
}) {
  const reached = useGameStore((s) => Boolean(s.activatedIds[`cp-${id}`]));

  const baseGeo = useCachedGeometry('cp-base-cyl', () => {
    const g = new THREE.CylinderGeometry(1.25, 1.4, 0.16, 12);
    g.computeBoundingSphere();
    return g;
  });
  const ringGeo = useCachedGeometry('cp-ring-cyl', () => {
    const g = new THREE.CylinderGeometry(0.85, 0.85, 0.05, 12);
    g.computeBoundingSphere();
    return g;
  });
  const baseMat = useCachedMaterial(
    'cp-base-mat',
    () => new THREE.MeshStandardMaterial({ color: '#676e65', roughness: 0.85 }),
  );
  const ringMat = useCachedMaterial(`cp-ring-mat-${reached ? 'on' : 'off'}`, () =>
    new THREE.MeshStandardMaterial({
      color: reached ? '#2dd4bf' : '#94a3b8',
      emissive: reached ? '#0d9488' : '#334155',
      emissiveIntensity: reached ? 1.1 : 0.25,
      roughness: 0.35,
    }),
  );

  return (
    <group position={position}>
      <mesh geometry={baseGeo} material={baseMat} position={[0, 0.08, 0]} receiveShadow />
      <mesh geometry={ringGeo} material={ringMat} position={[0, 0.17, 0]} />
      <TriggerZone
        id={`checkpoint-${id}`}
        chunkId={chunkId}
        position={[0, 1.0, 0]}
        halfExtents={[1.4, 1.2, 1.4]}
        once
        onEnter={() => {
          const store = useGameStore.getState();
          store.setActivated(`cp-${id}`, true);
          store.setCheckpoint(spawnPos);
          store.showToast(`Checkpoint Reached: ${label}`);
          eventBus.emit('checkpoint:reached', { id, position: spawnPos });
        }}
      />
    </group>
  );
}
