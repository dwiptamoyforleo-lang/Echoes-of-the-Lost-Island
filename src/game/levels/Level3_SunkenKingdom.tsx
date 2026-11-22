import { useCallback, useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { CuboidCollider, RigidBody } from '@react-three/rapier';
import * as THREE from 'three';
import {
  Chest,
  CrystalField,
  Fragment,
  KeyItem,
} from '@/src/game/collectibles';
import {
  Door,
  Inscription,
  PressurePlate,
  PushableBlock,
  RotatingMechanism,
  Switch,
  TriggerZone,
} from '@/src/game/puzzles';
import { getQualityPreset } from '@/src/game/rendering/adaptiveQuality';
import {
  useCachedGeometry,
  useCachedMaterial,
} from '@/src/game/rendering/assetCache';
import { eventBus } from '@/src/state/eventBus';
import { useGameStore } from '@/src/state/gameStore';
import { playPooledSynth } from '@/src/systems/audioSystem';
import { CheckpointBeacon } from './CheckpointBeacon';
import { ChunkManager } from './ChunkManager';
import {
  ChunkTerrainPatch,
  GlowHalo,
  SharedBiomeBackdrop,
} from './SharedBiomeEnvironment';
import { getCrystalsForChunk } from './levelTerrainFactory';
import {
  CISTERN_WATER_BOUNDS,
  LEVEL3_CHUNKS,
  STATUE_IDS,
  STATUE_INITIAL_STEPS,
  areStatuesAligned,
} from './level3Config';

const CEIL_Y = 9.0;

/**
 * Warm flickering subterranean torch with zero extra shadow casters.
 */
function ChamberTorch({
  position,
  withPointLight = false,
}: {
  position: [number, number, number];
  withPointLight?: boolean;
}) {
  const flameRef = useRef<THREE.Mesh>(null);
  const phase = useMemo(
    () => Math.abs(position[0] * 0.7 + position[2] * 1.1),
    [position],
  );

  useFrame((state) => {
    if (!flameRef.current) return;
    const t = state.clock.elapsedTime * 7.5 + phase;
    const flicker = 0.88 + Math.sin(t) * 0.14 + Math.cos(t * 2.3) * 0.08;
    flameRef.current.scale.set(flicker, 0.92 + Math.sin(t * 1.7) * 0.16, flicker);
  });

  const sconceGeo = useCachedGeometry('sunken-torch-sconce', () => {
    const g = new THREE.CylinderGeometry(0.14, 0.09, 0.75, 6);
    g.computeBoundingSphere();
    return g;
  });
  const sconceMat = useCachedMaterial('sunken-torch-sconce-mat', () =>
    new THREE.MeshStandardMaterial({
      color: '#57534e',
      roughness: 0.5,
      metalness: 0.65,
    }),
  );

  return (
    <group position={position}>
      <mesh geometry={sconceGeo} material={sconceMat} position={[0, 0.37, 0]} />
      <mesh ref={flameRef} position={[0, 0.9, 0]}>
        <coneGeometry args={[0.16, 0.42, 6]} />
        <meshStandardMaterial
          color="#fbbf24"
          emissive="#f97316"
          emissiveIntensity={2.0}
          roughness={0.2}
        />
      </mesh>
      <GlowHalo position={[0, 0.96, 0]} color="#fb923c" scale={2.5} />
      {withPointLight && (
        <pointLight
          position={[0, 1.2, 0]}
          color="#fb923c"
          intensity={22}
          distance={24}
          decay={1.65}
        />
      )}
    </group>
  );
}

/**
 * Carved stone pillar for underground temple halls.
 */
function CarvedPillar({
  position,
  height = 6.8,
  color = '#3b4e59',
}: {
  position: [number, number, number];
  height?: number;
  color?: string;
}) {
  return (
    <RigidBody type="fixed" position={position} colliders="cuboid">
      <mesh castShadow receiveShadow position={[0, height / 2, 0]}>
        <cylinderGeometry args={[0.48, 0.58, height, 8]} />
        <meshStandardMaterial color={color} roughness={0.88} />
      </mesh>
      <mesh receiveShadow position={[0, 0.25, 0]}>
        <boxGeometry args={[1.35, 0.5, 1.35]} />
        <meshStandardMaterial color="#495f6b" roughness={0.86} />
      </mesh>
      <mesh position={[0, height - 0.25, 0]}>
        <boxGeometry args={[1.35, 0.5, 1.35]} />
        <meshStandardMaterial color="#495f6b" roughness={0.86} />
      </mesh>
    </RigidBody>
  );
}

/**
 * Flooded Cistern water volume that smoothly drains down when both pressure plates are held.
 */
function FloodedCisternWater({ drained }: { drained: boolean }) {
  const waterRef = useRef<THREE.Group>(null);
  const surfaceRef = useRef<THREE.Mesh>(null);
  const levelYRef = useRef(drained ? -0.65 : CISTERN_WATER_BOUNDS.maxY);

  useFrame((state, rawDt) => {
    const dt = Math.min(rawDt, 0.05);
    const targetY = drained ? -0.65 : CISTERN_WATER_BOUNDS.maxY;
    levelYRef.current = THREE.MathUtils.lerp(
      levelYRef.current,
      targetY,
      1 - Math.exp(-2.8 * dt),
    );
    if (waterRef.current) {
      const visible = levelYRef.current > 0.15;
      waterRef.current.visible = visible;
      waterRef.current.position.y = levelYRef.current;
    }
    if (surfaceRef.current && !drained) {
      surfaceRef.current.position.y =
        Math.sin(state.clock.elapsedTime * 1.9) * 0.05;
    }
  });

  const width = CISTERN_WATER_BOUNDS.maxX - CISTERN_WATER_BOUNDS.minX;
  const depth = CISTERN_WATER_BOUNDS.maxZ - CISTERN_WATER_BOUNDS.minZ;
  const cx = (CISTERN_WATER_BOUNDS.minX + CISTERN_WATER_BOUNDS.maxX) * 0.5;
  const cz = (CISTERN_WATER_BOUNDS.minZ + CISTERN_WATER_BOUNDS.maxZ) * 0.5;

  return (
    <group ref={waterRef} position={[cx, levelYRef.current, cz]}>
      {/* Water surface */}
      <mesh ref={surfaceRef} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[width, depth]} />
        <meshStandardMaterial
          color="#0891b2"
          emissive="#0e7490"
          emissiveIntensity={0.38}
          transparent
          opacity={0.62}
          roughness={0.15}
          side={THREE.DoubleSide}
        />
      </mesh>
      {/* Translucent submerged volume cube */}
      <mesh position={[0, -1.35, 0]}>
        <boxGeometry args={[width, 2.7, depth]} />
        <meshBasicMaterial
          color="#0e7490"
          transparent
          opacity={0.22}
          depthWrite={false}
          side={THREE.DoubleSide}
        />
      </mesh>
    </group>
  );
}

/**
 * Sunken floor stone slab/grate opening visually when the cistern drains,
 * plus underwater trigger volume controlling the HUD tint.
 */
function CisternWaterSensor({ drained }: { drained: boolean }) {
  useEffect(() => {
    if (drained) {
      useGameStore.getState().setUnderwaterTint(false);
    }
    return () => {
      useGameStore.getState().setUnderwaterTint(false);
    };
  }, [drained]);

  if (drained) return null;

  const cx = (CISTERN_WATER_BOUNDS.minX + CISTERN_WATER_BOUNDS.maxX) * 0.5;
  const cz = (CISTERN_WATER_BOUNDS.minZ + CISTERN_WATER_BOUNDS.maxZ) * 0.5;

  return (
    <TriggerZone
      id="l3-cistern-underwater"
      position={[cx, 1.45, cz]}
      halfExtents={[7.2, 1.5, 9.2]}
      onEnter={() => {
        if (!useGameStore.getState().activatedIds['l3-chamber-drained']) {
          useGameStore.getState().setUnderwaterTint(true);
        }
      }}
      onExit={() => {
        useGameStore.getState().setUnderwaterTint(false);
      }}
    />
  );
}

export function Level3_SunkenKingdom() {
  const activeTier = useGameStore((s) => s.activeQualityTier);
  const preset = getQualityPreset(activeTier);
  const chunks = useMemo(() => LEVEL3_CHUNKS.map((s) => s.chunk), []);

  const plateA = useGameStore((s) =>
    Boolean(s.activatedIds['l3-plate-drain-a']),
  );
  const plateB = useGameStore((s) =>
    Boolean(s.activatedIds['l3-plate-drain-b']),
  );
  const cisternDrained = useGameStore((s) =>
    Boolean(s.activatedIds['l3-chamber-drained']),
  );
  const interconnectActive = useGameStore((s) =>
    Boolean(s.activatedIds['l3-switch-interconnect']),
  );
  const statuesSolved = useGameStore((s) =>
    Boolean(s.activatedIds['l3-statues-solved']),
  );

  // Clean up underwater tint on level unmount
  useEffect(() => {
    return () => {
      useGameStore.getState().setUnderwaterTint(false);
    };
  }, []);

  useEffect(() => {
    const store = useGameStore.getState();
    if (store.screen === 'playing' && store.levelElapsedSeconds < 2) {
      store.showToast(
        'Descended into The Sunken Kingdom · Seek the Bronze Key and drain the flooded vaults',
      );
    }
  }, []);

  // Latch cistern drainage permanently once both pressure plates activate simultaneously
  useEffect(() => {
    if (!cisternDrained && plateA && plateB) {
      const store = useGameStore.getState();
      store.setActivated('l3-chamber-drained', true);
      store.setWorldObjectState('l3-chamber-drained', { solved: true }, 'level3');
      store.setUnderwaterTint(false);
      store.reportQuestObjective('l3-obj-drain', 1, 'level3');
      playPooledSynth('door');
      store.showToast(
        'Drainage sluices opened! The Flooded Cistern empties!',
        'objective',
      );
    }
  }, [plateA, plateB, cisternDrained]);

  // Report interconnected switch completion
  useEffect(() => {
    if (interconnectActive) {
      const store = useGameStore.getState();
      store.reportQuestObjective('l3-obj-interconnect', 1, 'level3');
    }
  }, [interconnectActive]);

  const handleStatueChange = useCallback(() => {
    const store = useGameStore.getState();
    if (store.activatedIds['l3-statues-solved']) return;
    const steps = STATUE_IDS.map((sid, idx) => {
      const saved = store.getWorldObjectState(sid, 'level3')?.phase;
      return typeof saved === 'number' ? saved : STATUE_INITIAL_STEPS[idx];
    });
    if (areStatuesAligned(steps)) {
      store.setActivated('l3-statues-solved', true);
      store.setWorldObjectState('l3-statues-solved', { solved: true }, 'level3');
      store.reportQuestObjective('l3-obj-statues', 1, 'level3');
      playPooledSynth('door');
      store.showToast(
        'All Four Guardian Statues aligned! The Star Throne Gate unseals!',
        'objective',
      );
    }
  }, []);

  const handleFallRespawn = useCallback(() => {
    const store = useGameStore.getState();
    store.setUnderwaterTint(false);
    store.showToast('Returned to last checkpoint');
    eventBus.emit('player:respawn', { position: store.checkpointPos });
  }, []);

  const cisternSteps = useMemo(() => {
    // Steps descending from north rim y=3.0 (z=8.5) down to basin y=0.2 (z=4.5)
    const count = 7;
    return Array.from({ length: count }, (_, i) => {
      const h = 3.0 - ((3.0 - 0.2) * (i + 1)) / count;
      return {
        id: `l3-cistern-step-${i}`,
        position: [20.5, h / 2, 8.2 - i * 0.6] as [number, number, number],
        size: [4.8, h, 0.65] as [number, number, number],
      };
    });
  }, []);

  const walkwaySteps = useMemo(() => {
    // Steps rising from Central Hall y=2.0 (x=9.6) to East Cistern walkway y=3.0 (x=11.0)
    const count = 4;
    return Array.from({ length: count }, (_, i) => {
      const h = 2.0 + ((3.0 - 2.0) * (i + 1)) / count;
      return {
        id: `l3-walk-step-${i}`,
        position: [9.5 + i * 0.45, h / 2, 2.0] as [number, number, number],
        size: [0.5, h, 6.2] as [number, number, number],
      };
    });
  }, []);

  const renderChunk = useCallback(
    (chunkId: string) => {
      const spec = LEVEL3_CHUNKS.find((s) => s.chunk.id === chunkId);
      if (!spec) return null;
      const chunkCrystals = getCrystalsForChunk('level3', spec.patch);

      switch (chunkId) {
        case 'l3-entry':
          return (
            <>
              <ChunkTerrainPatch
                levelId="level3"
                chunkId={chunkId}
                patch={spec.patch}
              />
              <CrystalField crystals={chunkCrystals} color="#38bdf8" />

              {/* Underground Stone Walls & High Vaulted Ceiling (y = 9.0) */}
              <RigidBody type="fixed" colliders="cuboid">
                {/* South back wall behind spawn */}
                <mesh receiveShadow position={[0, 5.5, 31]}>
                  <boxGeometry args={[20, 7.0, 1.2]} />
                  <meshStandardMaterial color="#2b3a44" roughness={0.9} />
                </mesh>
                {/* West & East walls of Entry Corridor */}
                <mesh receiveShadow position={[-8.5, 5.5, 22]}>
                  <boxGeometry args={[1.2, 7.0, 18]} />
                  <meshStandardMaterial color="#2b3a44" roughness={0.9} />
                </mesh>
                <mesh receiveShadow position={[8.5, 5.5, 22]}>
                  <boxGeometry args={[1.2, 7.0, 18]} />
                  <meshStandardMaterial color="#2b3a44" roughness={0.9} />
                </mesh>
                {/* Corner step-outs connecting Entry Corridor (x=±8.5) to Central Hall (x=±10.2) */}
                <mesh receiveShadow position={[-9.35, 5.5, 13.5]}>
                  <boxGeometry args={[2.6, 7.0, 1.2]} />
                  <meshStandardMaterial color="#2b3a44" roughness={0.9} />
                </mesh>
                <mesh receiveShadow position={[9.35, 5.5, 13.5]}>
                  <boxGeometry args={[2.6, 7.0, 1.2]} />
                  <meshStandardMaterial color="#2b3a44" roughness={0.9} />
                </mesh>
                {/* Central Hall perimeter segments leaving 8m West & East doorways (z=-2..6) */}
                <mesh receiveShadow position={[-10.2, 5.5, 10]}>
                  <boxGeometry args={[1.2, 7.0, 8.2]} />
                  <meshStandardMaterial color="#2e3f4a" roughness={0.9} />
                </mesh>
                <mesh receiveShadow position={[-10.2, 5.5, -6.5]}>
                  <boxGeometry args={[1.2, 7.0, 9.2]} />
                  <meshStandardMaterial color="#2e3f4a" roughness={0.9} />
                </mesh>
                <mesh receiveShadow position={[10.2, 5.5, 10]}>
                  <boxGeometry args={[1.2, 7.0, 8.2]} />
                  <meshStandardMaterial color="#2e3f4a" roughness={0.9} />
                </mesh>
                <mesh receiveShadow position={[10.2, 5.5, -6.5]}>
                  <boxGeometry args={[1.2, 7.0, 9.2]} />
                  <meshStandardMaterial color="#2e3f4a" roughness={0.9} />
                </mesh>
                {/* Lintel Headers over West & East Hall Doorways */}
                <mesh receiveShadow position={[-10.2, 7.5, 2.0]}>
                  <boxGeometry args={[1.2, 3.0, 8.2]} />
                  <meshStandardMaterial color="#2b3a44" roughness={0.9} />
                </mesh>
                <mesh receiveShadow position={[10.2, 7.5, 2.0]}>
                  <boxGeometry args={[1.2, 3.0, 8.2]} />
                  <meshStandardMaterial color="#2b3a44" roughness={0.9} />
                </mesh>
                {/* Vaulted Roof Ceiling overlapping North Sanctum seamlessly */}
                <mesh position={[0, CEIL_Y, 10.5]}>
                  <boxGeometry args={[22, 0.8, 43]} />
                  <meshStandardMaterial color="#182329" roughness={0.94} />
                </mesh>
              </RigidBody>

              {/* Carved Colonnade Pillars */}
              <CarvedPillar position={[-5.2, 2.0, 22]} />
              <CarvedPillar position={[5.2, 2.0, 22]} />
              <CarvedPillar position={[-6.2, 2.0, 11]} />
              <CarvedPillar position={[6.2, 2.0, 11]} />
              <CarvedPillar position={[-6.2, 2.0, -5]} />
              <CarvedPillar position={[6.2, 2.0, -5]} />

              {/* Warm Subterranean Torches */}
              <ChamberTorch position={[-5.2, 3.8, 22.7]} withPointLight />
              <ChamberTorch position={[5.2, 3.8, 22.7]} />
              <ChamberTorch position={[-6.2, 3.8, 11.7]} withPointLight />
              <ChamberTorch position={[6.2, 3.8, 11.7]} />
              <ChamberTorch position={[-6.2, 3.8, -4.3]} />
              <ChamberTorch position={[6.2, 3.8, -4.3]} withPointLight />

              {/* Glowing Interconnect Conduit Line across Central Hall -> West Crypt */}
              <mesh position={[-5.0, 2.03, 2.0]}>
                <boxGeometry args={[12.0, 0.05, 0.25]} />
                <meshStandardMaterial
                  color={interconnectActive ? '#2dd4bf' : '#475569'}
                  emissive={interconnectActive ? '#0d9488' : '#1e293b'}
                  emissiveIntensity={interconnectActive ? 1.2 : 0.2}
                />
              </mesh>

              <Inscription
                id="l3-inscription-vestibule"
                position={[-3.2, 2.0, 18.5]}
                rotationY={0.28}
                title="Chronicle of the Sunken Kingdom"
                body="Long before the tides claimed the upper reefs, the builders carved these subterranean halls around a deep cistern. To reach the Star Throne behind the Bronze Gate, seek the Bronze Key in the Western Crypt and balance the sluices in the Flooded Cistern."
              />

              <CheckpointBeacon
                id="l3-entry-cp"
                chunkId={chunkId}
                position={[0, 2.0, 17.0]}
                spawnPos={[0, 2.35, 17.0]}
                label="Vestibule Crossroads"
              />
            </>
          );

        case 'l3-west-crypt':
          return (
            <>
              <ChunkTerrainPatch
                levelId="level3"
                chunkId={chunkId}
                patch={spec.patch}
              />
              <CrystalField crystals={chunkCrystals} color="#38bdf8" />

              {/* West Crypt & Sealed Vault Stone Walls + Ceiling */}
              <RigidBody type="fixed" colliders="cuboid">
                {/* Outer West Wall */}
                <mesh receiveShadow position={[-30.2, 5.5, -2]}>
                  <boxGeometry args={[1.2, 7.0, 34]} />
                  <meshStandardMaterial color="#2b3a44" roughness={0.9} />
                </mesh>
                {/* South Wall */}
                <mesh receiveShadow position={[-20, 5.5, 13.5]}>
                  <boxGeometry args={[21, 7.0, 1.2]} />
                  <meshStandardMaterial color="#2b3a44" roughness={0.9} />
                </mesh>
                {/* North Back Wall of Sealed Vault */}
                <mesh receiveShadow position={[-20, 5.5, -18.5]}>
                  <boxGeometry args={[21, 7.0, 1.2]} />
                  <meshStandardMaterial color="#2b3a44" roughness={0.9} />
                </mesh>
                {/* Interior Partition Walls flanking Interconnected Door at [-20, 2, -5] */}
                <mesh receiveShadow position={[-26.5, 5.5, -5.0]}>
                  <boxGeometry args={[7.2, 7.0, 1.2]} />
                  <meshStandardMaterial color="#344652" roughness={0.88} />
                </mesh>
                <mesh receiveShadow position={[-13.5, 5.5, -5.0]}>
                  <boxGeometry args={[7.2, 7.0, 1.2]} />
                  <meshStandardMaterial color="#344652" roughness={0.88} />
                </mesh>
                {/* Bronze Key Carved Sarcophagus Plinth */}
                <mesh castShadow receiveShadow position={[-23, 2.45, 7]}>
                  <boxGeometry args={[2.2, 0.9, 1.4]} />
                  <meshStandardMaterial color="#4a5f6b" roughness={0.82} />
                </mesh>
                {/* Vaulted Roof */}
                <mesh position={[-20, CEIL_Y, -2]}>
                  <boxGeometry args={[22, 0.8, 34]} />
                  <meshStandardMaterial color="#1b262d" roughness={0.94} />
                </mesh>
              </RigidBody>

              <CarvedPillar position={[-16.5, 2.0, 8]} />
              <CarvedPillar position={[-25.5, 2.0, 8]} />
              <ChamberTorch position={[-16.5, 3.8, 8.7]} withPointLight />
              <ChamberTorch position={[-25.5, 3.8, 8.7]} />
              <ChamberTorch position={[-20.0, 3.8, -14.0]} />

              {/* Interconnected Conduit Glow leading into Western Vault Door */}
              <mesh position={[-15.0, 2.03, 0.5]} rotation={[0, 0.55, 0]}>
                <boxGeometry args={[12.5, 0.05, 0.25]} />
                <meshStandardMaterial
                  color={interconnectActive ? '#2dd4bf' : '#475569'}
                  emissive={interconnectActive ? '#0d9488' : '#1e293b'}
                  emissiveIntensity={interconnectActive ? 1.2 : 0.2}
                />
              </mesh>

              {/* Bronze Key on Sarcophagus Plinth */}
              <KeyItem
                id="key-bronze"
                label="Bronze Key"
                position={[-23, 3.45, 7]}
              />

              <Inscription
                id="l3-inscription-crypt"
                position={[-15.2, 2.0, -2.5]}
                rotationY={0.45}
                title="Ledger of the Hydraulic Seal"
                body="The Western Vault before you has no keyhole. Its stone lock responds only to the Bronze Sluice Lever submerged deep within the Flooded Cistern on the opposite side of the kingdom."
              />

              {/* Interconnected Door controlled by East Cistern Switch */}
              <Door
                id="l3-door-interconnect"
                position={[-20, 2.0, -5.0]}
                width={4.2}
                height={4.0}
                requiredIds={['l3-switch-interconnect']}
              />

              {/* Chest 2 inside Western Sealed Vault */}
              <Chest
                id="chest-sunken-west"
                position={[-21, 2.0, -14.5]}
                rotationY={0.1}
                rewardItem="Abyssal Astrolabe"
              />
            </>
          );

        case 'l3-east-cistern':
          return (
            <>
              <ChunkTerrainPatch
                levelId="level3"
                chunkId={chunkId}
                patch={spec.patch}
              />
              <CrystalField crystals={chunkCrystals} color="#38bdf8" />

              {/* Stairs from Central Hall to Elevated Walkway & down into Cistern Basin */}
              {walkwaySteps.map((st) => (
                <RigidBody
                  key={st.id}
                  type="fixed"
                  position={st.position}
                  colliders="cuboid"
                >
                  <mesh receiveShadow>
                    <boxGeometry args={st.size} />
                    <meshStandardMaterial color="#465b66" roughness={0.86} />
                  </mesh>
                </RigidBody>
              ))}
              {cisternSteps.map((st) => (
                <RigidBody
                  key={st.id}
                  type="fixed"
                  position={st.position}
                  colliders="cuboid"
                >
                  <mesh receiveShadow>
                    <boxGeometry args={st.size} />
                    <meshStandardMaterial color="#3c505c" roughness={0.88} />
                  </mesh>
                </RigidBody>
              ))}

              {/* Cistern Outer Walls & High Vaulted Ceiling */}
              <RigidBody type="fixed" colliders="cuboid">
                <mesh receiveShadow position={[30.2, 5.0, 0]}>
                  <boxGeometry args={[1.2, 10.0, 28]} />
                  <meshStandardMaterial color="#2b3a44" roughness={0.9} />
                </mesh>
                <mesh receiveShadow position={[20, 5.0, 13.5]}>
                  <boxGeometry args={[21, 10.0, 1.2]} />
                  <meshStandardMaterial color="#2b3a44" roughness={0.9} />
                </mesh>
                <mesh receiveShadow position={[20, 5.0, -12.5]}>
                  <boxGeometry args={[21, 10.0, 1.2]} />
                  <meshStandardMaterial color="#2b3a44" roughness={0.9} />
                </mesh>
                <mesh position={[20, CEIL_Y + 0.5, 0.5]}>
                  <boxGeometry args={[22, 0.8, 28]} />
                  <meshStandardMaterial color="#1b262d" roughness={0.94} />
                </mesh>
              </RigidBody>

              {/* Submerged Carved Statues & Pillars inside Cistern */}
              <CarvedPillar position={[16.5, 0.2, -7.5]} height={8.2} />
              <CarvedPillar position={[26.5, 0.2, -7.5]} height={8.2} />
              <CarvedPillar position={[26.5, 0.2, 6.5]} height={8.2} />
              <ChamberTorch position={[12.5, 4.4, 9.5]} withPointLight />
              <ChamberTorch position={[26.5, 3.2, 6.5]} />
              <ChamberTorch position={[26.5, 3.2, -7.5]} />

              {/* Pressure Plate Drainage Puzzle (c) on Dry Elevated Walkway */}
              <Inscription
                id="l3-inscription-cistern"
                position={[15.5, 3.0, 10.2]}
                rotationY={-0.35}
                title="Floodgate Counterweights"
                body="Push the two ancient counterweight stones onto both Sluice Plates along the western rim to drain the submerged chamber and uncover the royal vault."
              />

              <PressurePlate
                id="l3-plate-drain-a"
                position={[12.2, 3.0, 6.2]}
                label="North Sluice Plate"
              />
              <PressurePlate
                id="l3-plate-drain-b"
                position={[12.2, 3.0, -6.2]}
                label="South Sluice Plate"
              />
              <PushableBlock
                id="l3-block-cistern-a"
                chunkId={chunkId}
                position={[12.4, 3.65, 2.8]}
                size={1.15}
                color="#738794"
              />
              <PushableBlock
                id="l3-block-cistern-b"
                chunkId={chunkId}
                position={[12.4, 3.65, -2.8]}
                size={1.15}
                color="#677b87"
              />

              {/* Flooded Chamber Water Volume + Visual Underwater Tint Sensor */}
              <FloodedCisternWater drained={cisternDrained} />
              <CisternWaterSensor drained={cisternDrained} />

              {/* Chest 1 & Interconnected Switch inside Cistern Basin */}
              <Chest
                id="chest-sunken-cistern"
                position={[24.2, 0.2, -6.0]}
                rotationY={-0.4}
                rewardItem="Sunken Crown Signet"
              />
              <Switch
                id="l3-switch-interconnect"
                label="Western Vault Sluice"
                position={[25.8, 0.2, 3.5]}
                rotationY={-Math.PI / 2}
                oneShot
              />
            </>
          );

        case 'l3-north-sanctum':
          return (
            <>
              <ChunkTerrainPatch
                levelId="level3"
                chunkId={chunkId}
                patch={spec.patch}
              />
              <CrystalField crystals={chunkCrystals} color="#38bdf8" />

              {/* Walls around Bronze Door (z=-11) & Guardian Rotunda & Star Throne */}
              <RigidBody type="fixed" colliders="cuboid">
                {/* Bronze Door flanking walls & archway lintel at z = -11 */}
                <mesh receiveShadow position={[-6.55, 5.5, -11]}>
                  <boxGeometry args={[7.0, 7.0, 1.2]} />
                  <meshStandardMaterial color="#31434e" roughness={0.88} />
                </mesh>
                <mesh receiveShadow position={[6.55, 5.5, -11]}>
                  <boxGeometry args={[7.0, 7.0, 1.2]} />
                  <meshStandardMaterial color="#31434e" roughness={0.88} />
                </mesh>
                <mesh receiveShadow position={[0, 7.6, -11]}>
                  <boxGeometry args={[6.2, 2.8, 1.2]} />
                  <meshStandardMaterial color="#31434e" roughness={0.88} />
                </mesh>
                {/* Guardian Rotunda Side Walls */}
                <mesh receiveShadow position={[-10.5, 5.5, -22]}>
                  <boxGeometry args={[1.2, 7.0, 24]} />
                  <meshStandardMaterial color="#2b3a44" roughness={0.9} />
                </mesh>
                <mesh receiveShadow position={[10.5, 5.5, -22]}>
                  <boxGeometry args={[1.2, 7.0, 24]} />
                  <meshStandardMaterial color="#2b3a44" roughness={0.9} />
                </mesh>
                {/* Sanctum Gate flanking walls & archway lintel at z = -25.5 */}
                <mesh receiveShadow position={[-6.95, 5.5, -25.5]}>
                  <boxGeometry args={[8.1, 7.0, 1.2]} />
                  <meshStandardMaterial color="#31434e" roughness={0.88} />
                </mesh>
                <mesh receiveShadow position={[6.95, 5.5, -25.5]}>
                  <boxGeometry args={[8.1, 7.0, 1.2]} />
                  <meshStandardMaterial color="#31434e" roughness={0.88} />
                </mesh>
                <mesh receiveShadow position={[0, 7.6, -25.5]}>
                  <boxGeometry args={[5.8, 2.8, 1.2]} />
                  <meshStandardMaterial color="#31434e" roughness={0.88} />
                </mesh>
                {/* North Star Throne Back Wall */}
                <mesh receiveShadow position={[0, 5.5, -34]}>
                  <boxGeometry args={[22, 7.0, 1.2]} />
                  <meshStandardMaterial color="#2b3a44" roughness={0.9} />
                </mesh>
                {/* Star Throne Pedestal */}
                <mesh castShadow receiveShadow position={[0, 2.5, -30.5]}>
                  <boxGeometry args={[2.6, 1.0, 2.6]} />
                  <meshStandardMaterial color="#4d6370" roughness={0.8} />
                </mesh>
                {/* High Vaulted Ceiling */}
                <mesh position={[0, CEIL_Y, -22.5]}>
                  <boxGeometry args={[23, 0.8, 25]} />
                  <meshStandardMaterial color="#1b262d" roughness={0.94} />
                </mesh>
              </RigidBody>

              <ChamberTorch position={[-3.2, 3.8, -10.2]} />
              <ChamberTorch position={[3.2, 3.8, -10.2]} />
              <ChamberTorch position={[-8.2, 3.8, -19.0]} withPointLight />
              <ChamberTorch position={[8.2, 3.8, -19.0]} />
              <ChamberTorch position={[-5.2, 3.8, -29.5]} />
              <ChamberTorch position={[5.2, 3.8, -29.5]} />

              <CheckpointBeacon
                id="l3-rotunda-cp"
                chunkId={chunkId}
                position={[0, 2.0, -13.0]}
                spawnPos={[0, 2.35, -13.0]}
                label="Guardian Rotunda"
              />

              {/* Bronze Key Sealed Door (a) */}
              <Door
                id="l3-door-bronze"
                position={[0, 2.0, -11.0]}
                width={4.4}
                height={4.2}
                requiredKeyId="key-bronze"
                keyLabel="Bronze Key"
              />

              {/* Pattern Hint Inscription for Rotating Statues Puzzle (b) */}
              <Inscription
                id="l3-inscription-statues"
                position={[0, 2.0, -14.8]}
                rotationY={0}
                title="Edict of the Four Wardens"
                body="Four carved wardens guard the Star Throne. Turn each Guardian Statue toward its ancient watch: the SUN Warden (northwest) faces NORTH, the TIDE Warden (northeast) faces EAST, the MOON Warden (southeast) faces SOUTH, and the STAR Warden (southwest) faces WEST."
              />

              {/* 4 Rotating Guardian Statues (b) */}
              <RotatingMechanism
                id="l3-statue-sun"
                chunkId={chunkId}
                label="Sun Warden"
                position={[-5.2, 2.0, -16.8]}
                initialStep={STATUE_INITIAL_STEPS[0]}
                targetStep={0}
                variant="statue"
                accentColor="#fbbf24"
                locked={statuesSolved}
                onStepChange={handleStatueChange}
              />
              <RotatingMechanism
                id="l3-statue-tide"
                chunkId={chunkId}
                label="Tide Warden"
                position={[5.2, 2.0, -16.8]}
                initialStep={STATUE_INITIAL_STEPS[1]}
                targetStep={1}
                variant="statue"
                accentColor="#38bdf8"
                locked={statuesSolved}
                onStepChange={handleStatueChange}
              />
              <RotatingMechanism
                id="l3-statue-moon"
                chunkId={chunkId}
                label="Moon Warden"
                position={[5.2, 2.0, -22.2]}
                initialStep={STATUE_INITIAL_STEPS[2]}
                targetStep={2}
                variant="statue"
                accentColor="#a78bfa"
                locked={statuesSolved}
                onStepChange={handleStatueChange}
              />
              <RotatingMechanism
                id="l3-statue-star"
                chunkId={chunkId}
                label="Star Warden"
                position={[-5.2, 2.0, -22.2]}
                initialStep={STATUE_INITIAL_STEPS[3]}
                targetStep={3}
                variant="statue"
                accentColor="#2dd4bf"
                locked={statuesSolved}
                onStepChange={handleStatueChange}
              />

              {/* Final Sanctum Door opened by Guardian Statues */}
              <Door
                id="l3-door-sanctum"
                position={[0, 2.0, -25.5]}
                width={4.2}
                height={4.2}
                requiredIds={['l3-statues-solved']}
              />

              <Fragment
                id="fragment-3"
                name="Echo of the Stars"
                position={[0, 4.1, -30.5]}
              />
            </>
          );

        default:
          return null;
      }
    },
    [
      cisternDrained,
      cisternSteps,
      handleStatueChange,
      interconnectActive,
      statuesSolved,
      walkwaySteps,
    ],
  );

  // Keep lint clean if preset used by future hooks
  void preset;

  return (
    <group name="level3-sunken-kingdom">
      <SharedBiomeBackdrop levelId="level3" />

      <ChunkManager
        levelId="level3"
        chunks={chunks}
        renderChunk={renderChunk}
        onStreamingPendingChange={(pending) => {
          useGameStore.getState().setStreamingPending(pending);
        }}
      />

      {/* Abyssal Safety Respawn */}
      <TriggerZone
        id="l3-fall-safety"
        position={[0, -4.0, 0]}
        halfExtents={[120, 2.0, 120]}
        onEnter={handleFallRespawn}
      />
    </group>
  );
}

export default Level3_SunkenKingdom;
