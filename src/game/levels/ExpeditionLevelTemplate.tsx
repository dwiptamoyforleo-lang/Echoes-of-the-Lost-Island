import { useCallback, useEffect, useMemo } from 'react';
import { RigidBody } from '@react-three/rapier';
import {
  Chest,
  CrystalField,
  Fragment,
  KeyItem,
} from '@/src/game/collectibles';
import {
  Door,
  Inscription,
  MovingPlatform,
  PressurePlate,
  PushableBlock,
  Switch,
  TriggerZone,
} from '@/src/game/puzzles';
import { getQualityPreset } from '@/src/game/rendering/adaptiveQuality';
import { eventBus } from '@/src/state/eventBus';
import { useGameStore } from '@/src/state/gameStore';
import type { LevelId } from '@/src/systems/progressionSystem';
import { CheckpointBeacon } from './CheckpointBeacon';
import { ChunkManager } from './ChunkManager';
import {
  ChunkPropField,
  ChunkTerrainPatch,
  GlowHalo,
  SharedBiomeBackdrop,
} from './SharedBiomeEnvironment';
import {
  LEVEL_BIOMES,
  LEVEL_CHUNKS,
  getCrystalsForChunk,
} from './levelTerrainFactory';

export interface ExpeditionLevelConfig {
  levelId: LevelId;
  welcomeToast: string;
  sanctumY: number;
  stairBaseY: number;
  stoneColor: string;
  wallColor: string;
  accentColor: string;
  entryChunkId: string;
  westChunkId: string;
  eastChunkId: string;
  northChunkId: string;
  westSwitch: { id: string; label: string; pos: [number, number, number] };
  eastSwitch: { id: string; label: string; pos: [number, number, number] };
  plate: { id: string; label: string };
  ferry: {
    id: string;
    from: [number, number, number];
    to: [number, number, number];
    speed: number;
  };
  chest: { id: string; pos: [number, number, number]; rewardItem: string };
  keyItem: { id: string; label: string; pos: [number, number, number] };
  inscription: { id: string; title: string; body: string };
  fragment: { id: string; name: string };
  checkpointEastLabel: string;
  checkpointNorthLabel: string;
  seedOffset: number;
}

export function ExpeditionLevelTemplate({
  config,
}: {
  config: ExpeditionLevelConfig;
}) {
  const activeTier = useGameStore((s) => s.activeQualityTier);
  const preset = getQualityPreset(activeTier);
  const palette = LEVEL_BIOMES[config.levelId];
  const chunkSpecs = LEVEL_CHUNKS[config.levelId];
  const chunks = useMemo(() => chunkSpecs.map((s) => s.chunk), [chunkSpecs]);

  const gateRequiredIds = useMemo(
    () => [config.westSwitch.id, config.eastSwitch.id, config.plate.id],
    [config.westSwitch.id, config.eastSwitch.id, config.plate.id],
  );

  const stairs = useMemo(() => {
    const count = 8;
    const startZ = -5.8;
    const depth = 0.75;
    const stepRise = (config.sanctumY - config.stairBaseY) / count;
    return Array.from({ length: count }, (_, i) => {
      const h = config.stairBaseY + (i + 1) * stepRise;
      return {
        id: `${config.levelId}-step-${i}`,
        position: [0, h / 2, startZ - i * depth] as [number, number, number],
        size: [5.4, h, depth] as [number, number, number],
      };
    });
  }, [config.levelId, config.sanctumY, config.stairBaseY]);

  useEffect(() => {
    const store = useGameStore.getState();
    if (store.screen === 'playing' && store.levelElapsedSeconds < 2) {
      store.showToast(config.welcomeToast);
    }
  }, [config.welcomeToast]);

  const handleDeepWaterRespawn = useCallback(() => {
    const store = useGameStore.getState();
    store.showToast('Returned safely to last checkpoint');
    eventBus.emit('player:respawn', { position: store.checkpointPos });
  }, []);

  const renderChunk = useCallback(
    (chunkId: string) => {
      const spec = chunkSpecs.find((s) => s.chunk.id === chunkId);
      if (!spec) return null;
      const chunkCrystals = getCrystalsForChunk(config.levelId, spec.patch);

      if (chunkId === config.entryChunkId) {
        return (
          <>
            <ChunkTerrainPatch
              levelId={config.levelId}
              chunkId={chunkId}
              patch={spec.patch}
            />
            <ChunkPropField
              levelId={config.levelId}
              chunkId={chunkId}
              patch={spec.patch}
              seed={config.seedOffset + 11}
              treeDensity={8}
              rockDensity={14}
              grassDensity={76}
            />
            <CrystalField crystals={chunkCrystals} color={palette.crystalColor} />
          </>
        );
      }

      if (chunkId === config.westChunkId) {
        return (
          <>
            <ChunkTerrainPatch
              levelId={config.levelId}
              chunkId={chunkId}
              patch={spec.patch}
            />
            <ChunkPropField
              levelId={config.levelId}
              chunkId={chunkId}
              patch={spec.patch}
              seed={config.seedOffset + 22}
              treeDensity={9}
              rockDensity={16}
              grassDensity={72}
            />
            <CrystalField crystals={chunkCrystals} color={palette.crystalColor} />
            <Switch
              id={config.westSwitch.id}
              label={config.westSwitch.label}
              position={config.westSwitch.pos}
              rotationY={Math.PI * 0.35}
              oneShot
            />
            <Chest
              id={config.chest.id}
              position={config.chest.pos}
              rewardItem={config.chest.rewardItem}
            />
          </>
        );
      }

      if (chunkId === config.eastChunkId) {
        return (
          <>
            <ChunkTerrainPatch
              levelId={config.levelId}
              chunkId={chunkId}
              patch={spec.patch}
            />
            <ChunkPropField
              levelId={config.levelId}
              chunkId={chunkId}
              patch={spec.patch}
              seed={config.seedOffset + 33}
              treeDensity={9}
              rockDensity={16}
              grassDensity={74}
            />
            <CrystalField crystals={chunkCrystals} color={palette.crystalColor} />
            <MovingPlatform
              id={config.ferry.id}
              chunkId={chunkId}
              from={config.ferry.from}
              to={config.ferry.to}
              size={[3.8, 0.5, 3.8]}
              speed={config.ferry.speed}
            />
            <Switch
              id={config.eastSwitch.id}
              label={config.eastSwitch.label}
              position={config.eastSwitch.pos}
              rotationY={-Math.PI * 0.45}
              oneShot
            />
            <KeyItem
              id={config.keyItem.id}
              label={config.keyItem.label}
              position={config.keyItem.pos}
            />
            <CheckpointBeacon
              id={`${config.levelId}-east`}
              chunkId={chunkId}
              position={[
                config.eastSwitch.pos[0] - 1.2,
                config.eastSwitch.pos[1],
                config.eastSwitch.pos[2] + 2.2,
              ]}
              spawnPos={[
                config.eastSwitch.pos[0] - 1.2,
                config.eastSwitch.pos[1] + 0.35,
                config.eastSwitch.pos[2] + 2.2,
              ]}
              label={config.checkpointEastLabel}
            />
          </>
        );
      }

      if (chunkId === config.northChunkId) {
        const sy = config.sanctumY;
        return (
          <>
            <ChunkTerrainPatch
              levelId={config.levelId}
              chunkId={chunkId}
              patch={spec.patch}
            />
            <ChunkPropField
              levelId={config.levelId}
              chunkId={chunkId}
              patch={spec.patch}
              seed={config.seedOffset + 44}
              treeDensity={3}
              rockDensity={10}
              grassDensity={30}
            />
            <CrystalField crystals={chunkCrystals} color={palette.crystalColor} />

            {/* Sanctum Platform */}
            <RigidBody type="fixed" colliders="cuboid" friction={0.95}>
              <mesh
                receiveShadow={preset.shadowsEnabled}
                position={[0, sy - 0.5, -22]}
              >
                <boxGeometry args={[18, 1.0, 21]} />
                <meshStandardMaterial color={config.stoneColor} roughness={0.86} />
              </mesh>
            </RigidBody>

            {/* Approach Stairs */}
            {stairs.map((s) => (
              <RigidBody
                key={s.id}
                type="fixed"
                position={s.position}
                colliders="cuboid"
                friction={0.95}
              >
                <mesh
                  castShadow={preset.shadowsEnabled}
                  receiveShadow={preset.shadowsEnabled}
                >
                  <boxGeometry args={s.size} />
                  <meshStandardMaterial color={config.stoneColor} roughness={0.85} />
                </mesh>
              </RigidBody>
            ))}

            {/* Columns & Decorative Halos */}
            {[
              [-5.5, sy, -13.5, 3.4],
              [5.5, sy, -13.5, 2.8],
              [-6.5, sy, -18.5, 3.8],
              [6.5, sy, -18.5, 3.8],
            ].map(([cx, cy, cz, ch], idx) => (
              <group key={`${config.levelId}-col-${idx}`}>
                <RigidBody
                  type="fixed"
                  position={[cx, cy + ch / 2, cz]}
                  colliders="cuboid"
                >
                  <mesh
                    castShadow={preset.shadowsEnabled}
                    receiveShadow={preset.shadowsEnabled}
                  >
                    <cylinderGeometry args={[0.5, 0.56, ch, 8]} />
                    <meshStandardMaterial color={config.wallColor} roughness={0.88} />
                  </mesh>
                </RigidBody>
                <GlowHalo
                  position={[cx, cy + ch + 0.3, cz]}
                  color={config.accentColor}
                  scale={2.4}
                />
              </group>
            ))}

            {/* Sanctuary Enclosure Walls */}
            <RigidBody type="fixed" colliders="cuboid">
              <mesh
                castShadow={preset.shadowsEnabled}
                receiveShadow={preset.shadowsEnabled}
                position={[-4.3, sy + 2.4, -21.5]}
              >
                <boxGeometry args={[3.4, 4.8, 1.2]} />
                <meshStandardMaterial color={config.wallColor} roughness={0.88} />
              </mesh>
              <mesh
                castShadow={preset.shadowsEnabled}
                receiveShadow={preset.shadowsEnabled}
                position={[5.3, sy + 2.4, -21.5]}
              >
                <boxGeometry args={[5.2, 4.8, 1.2]} />
                <meshStandardMaterial color={config.wallColor} roughness={0.88} />
              </mesh>
              <mesh
                castShadow={preset.shadowsEnabled}
                receiveShadow={preset.shadowsEnabled}
                position={[7.3, sy + 2.4, -26.5]}
              >
                <boxGeometry args={[1.2, 4.8, 11.2]} />
                <meshStandardMaterial color={config.wallColor} roughness={0.88} />
              </mesh>
              <mesh
                castShadow={preset.shadowsEnabled}
                receiveShadow={preset.shadowsEnabled}
                position={[-0.8, sy + 2.4, -31.5]}
              >
                <boxGeometry args={[17.2, 4.8, 1.2]} />
                <meshStandardMaterial color={config.wallColor} roughness={0.88} />
              </mesh>
              <mesh
                castShadow={preset.shadowsEnabled}
                receiveShadow={preset.shadowsEnabled}
                position={[-9.0, sy + 2.4, -25.8]}
              >
                <boxGeometry args={[1.2, 4.8, 12.6]} />
                <meshStandardMaterial color={config.wallColor} roughness={0.88} />
              </mesh>
              <mesh
                castShadow={preset.shadowsEnabled}
                receiveShadow={preset.shadowsEnabled}
                position={[-5.4, sy + 2.4, -26.5]}
              >
                <boxGeometry args={[1.0, 4.8, 10.2]} />
                <meshStandardMaterial color={config.wallColor} roughness={0.88} />
              </mesh>
            </RigidBody>

            {/* Altar Pedestal */}
            <RigidBody type="fixed" position={[0, sy + 0.5, -28.0]} colliders="cuboid">
              <mesh
                castShadow={preset.shadowsEnabled}
                receiveShadow={preset.shadowsEnabled}
              >
                <boxGeometry args={[2.6, 1.0, 2.6]} />
                <meshStandardMaterial color={config.stoneColor} roughness={0.8} />
              </mesh>
            </RigidBody>

            <CheckpointBeacon
              id={`${config.levelId}-north`}
              chunkId={chunkId}
              position={[0, sy, -11.5]}
              spawnPos={[0, sy + 0.35, -11.5]}
              label={config.checkpointNorthLabel}
            />

            <Inscription
              id={config.inscription.id}
              position={[-4.0, sy, -13.5]}
              rotationY={0.25}
              title={config.inscription.title}
              body={config.inscription.body}
            />

            <PressurePlate
              id={config.plate.id}
              position={[3.8, sy, -14.5]}
              label={config.plate.label}
            />
            <PushableBlock
              id={`${config.levelId}-block-east`}
              chunkId={chunkId}
              position={[6.2, sy + 0.7, -13.2]}
              size={1.15}
              color="#c29b6b"
            />
            <PushableBlock
              id={`${config.levelId}-block-west`}
              chunkId={chunkId}
              position={[1.4, sy + 0.7, -13.2]}
              size={1.1}
              color="#b08b5e"
            />

            <Door
              id={`${config.levelId}-door-sanctuary`}
              position={[0, sy, -21.5]}
              width={4.2}
              height={4.2}
              requiredIds={gateRequiredIds}
            />
            <Door
              id={`${config.levelId}-door-vault`}
              position={[-7.2, sy, -21.5]}
              width={2.6}
              height={3.6}
              requiredKeyId={config.keyItem.id}
              keyLabel={config.keyItem.label}
            />

            <Fragment
              id={config.fragment.id}
              name={config.fragment.name}
              position={[0, sy + 2.2, -28.0]}
            />
          </>
        );
      }

      return null;
    },
    [chunkSpecs, config, gateRequiredIds, palette.crystalColor, preset.shadowsEnabled, stairs],
  );

  return (
    <group name={`expedition-${config.levelId}`}>
      <SharedBiomeBackdrop levelId={config.levelId} />

      <ChunkManager
        levelId={config.levelId}
        chunks={chunks}
        renderChunk={renderChunk}
        onStreamingPendingChange={(pending) => {
          useGameStore.getState().setStreamingPending(pending);
        }}
      />

      <TriggerZone
        id={`${config.levelId}-fall-safety`}
        position={[0, -3.2, 0]}
        halfExtents={[140, 2.2, 140]}
        onEnter={handleDeepWaterRespawn}
      />
    </group>
  );
}
