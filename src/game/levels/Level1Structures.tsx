import { useMemo } from 'react';
import { CuboidCollider, RigidBody } from '@react-three/rapier';
import * as THREE from 'three';
import { getQualityPreset } from '@/src/game/rendering/adaptiveQuality';
import {
  useCachedGeometry,
  useCachedMaterial,
} from '@/src/game/rendering/assetCache';
import { useGameStore } from '@/src/state/gameStore';
import { CheckpointBeacon } from './CheckpointBeacon';
import { GlowHalo } from './SharedBiomeEnvironment';

const CAVE_GLOW_POSITIONS: ReadonlyArray<[number, number, number, number]> = [
  [-3.8, 1.2, -3.5, 0.7],
  [3.6, 1.4, -2.5, 0.9],
  [-3.6, 2.4, 2.2, 0.65],
  [3.9, 2.2, 2.8, 0.75],
];

const RUINS_COLUMNS: ReadonlyArray<{ pos: [number, number, number]; h: number }> = [
  { pos: [-5.5, 4.2, -13.5], h: 3.4 },
  { pos: [5.5, 4.2, -13.5], h: 2.2 },
  { pos: [-6.5, 4.2, -18.5], h: 3.8 },
  { pos: [6.5, 4.2, -18.5], h: 3.8 },
];

export function Level1WestCaveStructures() {
  const activeTier = useGameStore((s) => s.activeQualityTier);
  const preset = getQualityPreset(activeTier);

  const caveWallMat = useCachedMaterial('l1-cave-wall-mat', () =>
    new THREE.MeshStandardMaterial({ color: '#484e4a', roughness: 0.95 }),
  );
  const caveBackMat = useCachedMaterial('l1-cave-back-mat', () =>
    new THREE.MeshStandardMaterial({ color: '#434945', roughness: 0.95 }),
  );
  const caveRoofMat = useCachedMaterial('l1-cave-roof-mat', () =>
    new THREE.MeshStandardMaterial({ color: '#4f5652', roughness: 0.95 }),
  );
  const crystalGeo = useCachedGeometry('l1-cave-crystal-geo', () => {
    const g = new THREE.OctahedronGeometry(0.55, 0);
    g.computeBoundingSphere();
    return g;
  });
  const crystalMat = useCachedMaterial('l1-cave-crystal-mat', () =>
    new THREE.MeshStandardMaterial({
      color: '#38bdf8',
      emissive: '#0284c7',
      emissiveIntensity: 1.6,
      roughness: 0.2,
    }),
  );

  return (
    <group position={[-22, 2.5, -16]}>
      <RigidBody type="fixed" colliders={false}>
        <CuboidCollider args={[1.2, 3.2, 6.5]} position={[-5.4, 2.8, 0]} />
        <mesh
          castShadow={preset.shadowsEnabled}
          receiveShadow={preset.shadowsEnabled}
          position={[-5.4, 2.8, 0]}
          material={caveWallMat}
        >
          <boxGeometry args={[2.4, 6.4, 13]} />
        </mesh>
        <CuboidCollider args={[1.2, 3.2, 6.5]} position={[5.4, 2.8, 0]} />
        <mesh
          castShadow={preset.shadowsEnabled}
          receiveShadow={preset.shadowsEnabled}
          position={[5.4, 2.8, 0]}
          material={caveWallMat}
        >
          <boxGeometry args={[2.4, 6.4, 13]} />
        </mesh>
        <CuboidCollider args={[6.6, 3.2, 1.2]} position={[0, 2.8, -5.6]} />
        <mesh
          castShadow={preset.shadowsEnabled}
          receiveShadow={preset.shadowsEnabled}
          position={[0, 2.8, -5.6]}
          material={caveBackMat}
        >
          <boxGeometry args={[13.2, 6.4, 2.4]} />
        </mesh>
        <CuboidCollider args={[6.6, 1.0, 6.8]} position={[0, 5.8, -0.2]} />
        <mesh
          castShadow={preset.shadowsEnabled}
          receiveShadow={preset.shadowsEnabled}
          position={[0, 5.8, -0.2]}
          material={caveRoofMat}
        >
          <boxGeometry args={[13.2, 2.0, 13.6]} />
        </mesh>
      </RigidBody>

      {preset.tier !== 'low' && (
        <pointLight position={[0, 3.6, -1.5]} color="#38bdf8" intensity={5.2} distance={15} />
      )}
      {CAVE_GLOW_POSITIONS.map(([x, y, z, s], i) => (
        <group key={`cave-glow-${i}`} position={[x, y, z]} scale={s}>
          <mesh geometry={crystalGeo} material={crystalMat} />
          <GlowHalo position={[0, 0.1, 0]} color="#38bdf8" scale={2.2} />
        </group>
      ))}
    </group>
  );
}

export function Level1EastCoveStructures() {
  const activeTier = useGameStore((s) => s.activeQualityTier);
  const preset = getQualityPreset(activeTier);
  const rockMat = useCachedMaterial('l1-cove-rock-mat', () =>
    new THREE.MeshStandardMaterial({ color: '#70766f', roughness: 0.9 }),
  );

  return (
    <>
      <RigidBody type="fixed" colliders="cuboid">
        <mesh
          castShadow={preset.shadowsEnabled}
          receiveShadow={preset.shadowsEnabled}
          position={[10.5, 2.0, 15.5]}
          material={rockMat}
        >
          <boxGeometry args={[2.2, 2.2, 2.2]} />
        </mesh>
        <mesh
          castShadow={preset.shadowsEnabled}
          receiveShadow={preset.shadowsEnabled}
          position={[12.5, 1.8, 17.2]}
          material={rockMat}
        >
          <boxGeometry args={[2.4, 1.9, 2.0]} />
        </mesh>
      </RigidBody>

      <CheckpointBeacon
        id="east-ridge"
        chunkId="l1-east-cove"
        position={[21.5, 4.5, -1.0]}
        spawnPos={[21.5, 4.7, -1.0]}
        label="Windward Ridge"
      />
    </>
  );
}

export function Level1RuinsStructures() {
  const activeTier = useGameStore((s) => s.activeQualityTier);
  const preset = getQualityPreset(activeTier);

  const stairMat = useCachedMaterial('l1-ruins-stair-mat', () =>
    new THREE.MeshStandardMaterial({ color: '#8f958a', roughness: 0.86 }),
  );
  const colGeo = useCachedGeometry('l1-ruins-col-unit', () => {
    const g = new THREE.CylinderGeometry(0.52, 0.58, 1, 8);
    g.computeBoundingSphere();
    return g;
  });
  const colMat = useCachedMaterial('l1-ruins-col-mat', () =>
    new THREE.MeshStandardMaterial({ color: '#767d73', roughness: 0.88 }),
  );
  const wallMat = useCachedMaterial('l1-ruins-wall-mat', () =>
    new THREE.MeshStandardMaterial({ color: '#687066', roughness: 0.88 }),
  );
  const unitBoxGeo = useCachedGeometry('l1-unit-box', () => {
    const g = new THREE.BoxGeometry(1, 1, 1);
    g.computeBoundingSphere();
    return g;
  });

  const ruinsStairs = useMemo(() => {
    const count = 8;
    const startZ = -5.8;
    const depth = 0.75;
    const baseY = 2.4;
    const topY = 4.2;
    const stepRise = (topY - baseY) / count;
    return Array.from({ length: count }, (_, i) => {
      const h = baseY + (i + 1) * stepRise;
      return {
        id: `ruins-step-${i}`,
        position: [0, h / 2, startZ - i * depth] as [number, number, number],
        size: [5.4, h, depth] as [number, number, number],
        half: [2.7, h / 2, depth / 2] as [number, number, number],
      };
    });
  }, []);

  return (
    <>
      <RigidBody type="fixed" colliders="cuboid" friction={0.95}>
        <mesh receiveShadow={preset.shadowsEnabled} position={[0, 3.7, -22]}>
          <boxGeometry args={[18, 1.0, 21]} />
          <meshStandardMaterial color="#878d83" roughness={0.88} />
        </mesh>
      </RigidBody>

      <RigidBody type="fixed" colliders={false} friction={0.95}>
        {ruinsStairs.map((s) => (
          <group key={s.id} position={s.position}>
            <CuboidCollider args={s.half} />
            <mesh
              castShadow={preset.shadowsEnabled}
              receiveShadow={preset.shadowsEnabled}
              geometry={unitBoxGeo}
              material={stairMat}
              scale={s.size}
            />
          </group>
        ))}
      </RigidBody>

      <RigidBody type="fixed" colliders={false}>
        {RUINS_COLUMNS.map((col, idx) => (
          <group
            key={`col-${idx}`}
            position={[col.pos[0], col.pos[1] + col.h / 2, col.pos[2]]}
          >
            <CuboidCollider args={[0.56, col.h / 2, 0.56]} />
            <mesh
              castShadow={preset.shadowsEnabled}
              receiveShadow={preset.shadowsEnabled}
              geometry={colGeo}
              material={colMat}
              scale={[1, col.h, 1]}
            />
          </group>
        ))}
      </RigidBody>

      <RigidBody type="fixed" colliders="cuboid">
        <mesh
          castShadow={preset.shadowsEnabled}
          receiveShadow={preset.shadowsEnabled}
          position={[-4.3, 6.6, -21.5]}
          material={wallMat}
        >
          <boxGeometry args={[3.4, 4.8, 1.2]} />
        </mesh>
        <mesh
          castShadow={preset.shadowsEnabled}
          receiveShadow={preset.shadowsEnabled}
          position={[5.3, 6.6, -21.5]}
          material={wallMat}
        >
          <boxGeometry args={[5.2, 4.8, 1.2]} />
        </mesh>
        <mesh
          castShadow={preset.shadowsEnabled}
          receiveShadow={preset.shadowsEnabled}
          position={[7.3, 6.6, -26.5]}
          material={wallMat}
        >
          <boxGeometry args={[1.2, 4.8, 11.2]} />
        </mesh>
        <mesh
          castShadow={preset.shadowsEnabled}
          receiveShadow={preset.shadowsEnabled}
          position={[-0.8, 6.6, -31.5]}
          material={wallMat}
        >
          <boxGeometry args={[17.2, 4.8, 1.2]} />
        </mesh>
        <mesh
          castShadow={preset.shadowsEnabled}
          receiveShadow={preset.shadowsEnabled}
          position={[-9.0, 6.6, -25.8]}
          material={wallMat}
        >
          <boxGeometry args={[1.2, 4.8, 12.6]} />
        </mesh>
        <mesh
          castShadow={preset.shadowsEnabled}
          receiveShadow={preset.shadowsEnabled}
          position={[-5.4, 6.6, -26.5]}
          material={wallMat}
        >
          <boxGeometry args={[1.0, 4.8, 10.2]} />
        </mesh>
      </RigidBody>

      <RigidBody type="fixed" position={[0, 4.7, -28.0]} colliders="cuboid">
        <mesh castShadow={preset.shadowsEnabled} receiveShadow={preset.shadowsEnabled}>
          <boxGeometry args={[2.6, 1.0, 2.6]} />
          <meshStandardMaterial color="#7e877b" roughness={0.82} />
        </mesh>
      </RigidBody>

      <CheckpointBeacon
        id="ruins-plaza"
        chunkId="l1-ruins"
        position={[0, 4.2, -11.5]}
        spawnPos={[0, 4.4, -11.5]}
        label="Ancient Ruins Courtyard"
      />
    </>
  );
}
