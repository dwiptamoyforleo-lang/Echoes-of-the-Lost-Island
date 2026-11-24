import { useCallback, useMemo } from 'react';
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
import { eventBus } from '@/src/state/eventBus';
import { useGameStore } from '@/src/state/gameStore';
import { getInputMode, getTutorialInteractToast } from '@/src/systems/inputMode';
import { ChunkManager } from './ChunkManager';
import {
  Level1EastCoveStructures,
  Level1RuinsStructures,
  Level1WestCaveStructures,
} from './Level1Structures';
import {
  ChunkPropField,
  ChunkTerrainPatch,
  SharedBiomeBackdrop,
} from './SharedBiomeEnvironment';
import {
  LEVEL_CHUNKS,
  getCrystalsForChunk,
  getLevelHeight,
} from './levelTerrainFactory';

const GATE_REQUIRED_IDS = ['switch-west', 'switch-east', 'plate-courtyard'];
const CHUNK_SPECS = LEVEL_CHUNKS.level1;

export function Level1_ForgottenShore() {
  const chunks = useMemo(() => CHUNK_SPECS.map((s) => s.chunk), []);

  const handleDeepWaterRespawn = useCallback(() => {
    const store = useGameStore.getState();
    store.showToast('Swept back to shore — returned to checkpoint');
    eventBus.emit('player:respawn', { position: store.checkpointPos });
  }, []);

  const renderChunk = useCallback((chunkId: string) => {
    const spec = CHUNK_SPECS.find((s) => s.chunk.id === chunkId);
    if (!spec) return null;
    const chunkCrystals = getCrystalsForChunk('level1', spec.patch);

    switch (chunkId) {
      case 'l1-shore':
        return (
          <>
            <ChunkTerrainPatch levelId="level1" chunkId={chunkId} patch={spec.patch} />
            <ChunkPropField
              levelId="level1"
              chunkId={chunkId}
              patch={spec.patch}
              seed={101}
              treeDensity={8}
              rockDensity={14}
              grassDensity={85}
            />
            <CrystalField crystals={chunkCrystals} />
            <TriggerZone
              id="tutorial-explore"
              chunkId={chunkId}
              position={[0, 2.2, 16]}
              halfExtents={[7, 2.2, 2.5]}
              once
              onEnter={() => {
                useGameStore
                  .getState()
                  .showToast(getTutorialInteractToast(getInputMode()));
              }}
            />
          </>
        );

      case 'l1-west-ridge':
        return (
          <>
            <ChunkTerrainPatch levelId="level1" chunkId={chunkId} patch={spec.patch} />
            <ChunkPropField
              levelId="level1"
              chunkId={chunkId}
              patch={spec.patch}
              seed={202}
              treeDensity={9}
              rockDensity={16}
              grassDensity={75}
            />
            <CrystalField crystals={chunkCrystals} />
            <Switch
              id="switch-west"
              label="Tidepool Seal"
              position={[-20, 4.5, 4]}
              rotationY={Math.PI * 0.35}
              oneShot
            />
          </>
        );

      case 'l1-east-cove':
        return (
          <>
            <ChunkTerrainPatch levelId="level1" chunkId={chunkId} patch={spec.patch} />
            <ChunkPropField
              levelId="level1"
              chunkId={chunkId}
              patch={spec.patch}
              seed={303}
              treeDensity={10}
              rockDensity={18}
              grassDensity={90}
            />
            <CrystalField crystals={chunkCrystals} />
            <Level1EastCoveStructures />
            <KeyItem
              id="key-sanctuary"
              label="Sunstone Vault Key"
              position={[15, getLevelHeight('level1', 15, 14) + 0.85, 14]}
            />
            <MovingPlatform
              id="ferry-east-inlet"
              chunkId={chunkId}
              from={[12.5, 3.3, 1.5]}
              to={[19.2, 4.3, -1.0]}
              size={[3.8, 0.5, 3.8]}
              speed={0.42}
            />
            <Switch
              id="switch-east"
              label="Windward Seal"
              position={[22.5, 4.5, -2.5]}
              rotationY={-Math.PI * 0.45}
              oneShot
            />
          </>
        );

      case 'l1-sea-cave':
        return (
          <>
            <ChunkTerrainPatch levelId="level1" chunkId={chunkId} patch={spec.patch} />
            <ChunkPropField
              levelId="level1"
              chunkId={chunkId}
              patch={spec.patch}
              seed={404}
              treeDensity={4}
              rockDensity={14}
              grassDensity={40}
            />
            <CrystalField crystals={chunkCrystals} />
            <Level1WestCaveStructures />
            <TriggerZone
              id="cave-discovery"
              chunkId={chunkId}
              position={[-22, 3.6, -10.5]}
              halfExtents={[3.5, 2.2, 2.0]}
              once
              onEnter={() => {
                useGameStore.getState().showToast('Discovered Hidden Sea Cave');
              }}
            />
            <Chest
              id="chest-cave"
              position={[-22, 2.5, -19.2]}
              rewardItem="Sunstone Compass"
            />
          </>
        );

      case 'l1-ruins':
        return (
          <>
            <ChunkTerrainPatch levelId="level1" chunkId={chunkId} patch={spec.patch} />
            <ChunkPropField
              levelId="level1"
              chunkId={chunkId}
              patch={spec.patch}
              seed={505}
              treeDensity={2}
              rockDensity={10}
              grassDensity={30}
            />
            <CrystalField crystals={chunkCrystals} />
            <Level1RuinsStructures />
            <Inscription
              id="inscription-shore"
              position={[-4.0, 4.2, -13.5]}
              rotationY={0.25}
              title="Carving of the Three Seals"
              body="Three resonant seals guard the Echo of the Tides: awaken the Tidepool Seal on the western headland, ride the stone ferry to ignite the Windward Seal in the east, and set a rune stone upon the courtyard pressure plate."
            />
            <PressurePlate
              id="plate-courtyard"
              position={[3.8, 4.2, -14.5]}
              label="Courtyard Seal"
            />
            <PushableBlock
              id="block-courtyard-east"
              chunkId={chunkId}
              position={[6.2, 4.9, -13.2]}
              size={1.15}
              color="#c29b6b"
            />
            <PushableBlock
              id="block-courtyard-west"
              chunkId={chunkId}
              position={[1.4, 4.9, -13.2]}
              size={1.1}
              color="#b08b5e"
            />
            <Door
              id="door-sanctuary"
              position={[0, 4.2, -21.5]}
              width={4.2}
              height={4.2}
              requiredIds={GATE_REQUIRED_IDS}
            />
            <Door
              id="door-vault"
              position={[-7.2, 4.2, -21.5]}
              width={2.6}
              height={3.6}
              requiredKeyId="key-sanctuary"
              keyLabel="Sunstone Vault Key"
            />
            <Fragment
              id="fragment-1"
              name="Echo of the Tides"
              position={[0, 6.4, -28.0]}
            />
          </>
        );

      default:
        return null;
    }
  }, []);

  return (
    <group name="level1-forgotten-shore">
      <SharedBiomeBackdrop levelId="level1" />

      <ChunkManager
        levelId="level1"
        chunks={chunks}
        renderChunk={renderChunk}
        onStreamingPendingChange={(pending) => {
          useGameStore.getState().setStreamingPending(pending);
        }}
      />

      {/* Deep Ocean Fall-Off Safety Respawn */}
      <TriggerZone
        id="deep-water-safety"
        position={[0, -3.2, 0]}
        halfExtents={[140, 2.2, 140]}
        onEnter={handleDeepWaterRespawn}
      />
    </group>
  );
}

export default Level1_ForgottenShore;
