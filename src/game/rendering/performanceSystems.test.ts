import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {
  acquireGeometry,
  clearAllCachedAssets,
  getAssetCacheStats,
  releaseGeometry,
} from './assetCache';
import {
  AdaptiveQualityMonitor,
  getQualityPreset,
  resolveInitialTier,
  type DeviceProfile,
} from './adaptiveQuality';
import {
  evaluateChunkStreaming,
  type ChunkDefinition,
} from '@/src/game/levels/chunkStreaming';
import { createInitialProgression } from '@/src/systems/progressionSystem';
import { createInitialQuests } from '@/src/systems/questSystem';
import { parseSaveData } from '@/src/systems/saveSystem';
import {
  createEmptyWorldState,
  getWorldObjectState,
  patchWorldObjectState,
} from '@/src/systems/worldStateSystem';

const DESKTOP_HW: DeviceProfile = {
  isMobile: false,
  isSoftwareGl: false,
  hardwareConcurrency: 8,
  deviceMemoryGb: 8,
  gpuRenderer: 'ANGLE (NVIDIA GeForce RTX 3060)',
  devicePixelRatio: 2,
};

const MOBILE_LOW: DeviceProfile = {
  isMobile: true,
  isSoftwareGl: false,
  hardwareConcurrency: 4,
  deviceMemoryGb: 3,
  gpuRenderer: 'Mali-G57',
  devicePixelRatio: 2,
};

test('assetCache tracks reference counts and disposes geometries strictly at zero', () => {
  clearAllCachedAssets();
  let disposeCount = 0;
  let createCount = 0;

  const factory = () => {
    createCount += 1;
    const g = new THREE.BoxGeometry(1, 1, 1);
    const origDispose = g.dispose.bind(g);
    g.dispose = () => {
      disposeCount += 1;
      origDispose();
    };
    return g;
  };

  const g1 = acquireGeometry('test-box', factory);
  const g2 = acquireGeometry('test-box', factory);
  assert.equal(g1, g2);
  assert.equal(createCount, 1);
  assert.equal(getAssetCacheStats().geometries, 1);
  assert.equal(getAssetCacheStats().totalRefs, 2);

  releaseGeometry('test-box');
  assert.equal(disposeCount, 0);
  assert.equal(getAssetCacheStats().totalRefs, 1);

  releaseGeometry('test-box');
  assert.equal(disposeCount, 1);
  assert.equal(getAssetCacheStats().geometries, 0);
  assert.equal(getAssetCacheStats().totalRefs, 0);
});

test('AdaptiveQualityMonitor detects hardware profiles and adapts without rapid oscillation', () => {
  assert.equal(resolveInitialTier('auto', DESKTOP_HW), 'high');
  assert.equal(resolveInitialTier('auto', MOBILE_LOW), 'low');
  assert.equal(resolveInitialTier('medium', MOBILE_LOW), 'medium');

  const monitor = new AdaptiveQualityMonitor('high', DESKTOP_HW);

  // Warmup (20 frames) + 3 seconds at ~22 FPS triggers clean single step-down to medium
  let steppedDown = false;
  for (let i = 0; i < 90; i++) {
    const res = monitor.recordFrame(1 / 22, true, DESKTOP_HW);
    if (res.tierChanged && res.tier === 'medium') {
      steppedDown = true;
    }
  }
  assert.equal(steppedDown, true);
  assert.equal(monitor.getState().tier, 'medium');

  // Cooldown prevents immediate step-up for 2 seconds even at 65 FPS
  let earlyStepUp = false;
  for (let i = 0; i < 120; i++) {
    const res = monitor.recordFrame(1 / 65, true, DESKTOP_HW);
    if (res.tierChanged) earlyStepUp = true;
  }
  assert.equal(earlyStepUp, false);

  // Sustained >58 FPS after cooldown steps cleanly back up to high
  let restoredHigh = false;
  for (let i = 0; i < 900; i++) {
    const res = monitor.recordFrame(1 / 65, true, DESKTOP_HW);
    if (res.tierChanged && res.tier === 'high') {
      restoredHigh = true;
      break;
    }
  }
  assert.equal(restoredHigh, true);
});

test('worldStateSystem persists moved blocks, platform phase, switches, and survives save round-trip', () => {
  let ws = createEmptyWorldState();
  ws = patchWorldObjectState(ws, 'level1', 'block-courtyard-east', {
    chunkId: 'l1-ruins',
    position: [3.8, 4.78, -14.5],
  });
  ws = patchWorldObjectState(ws, 'level1', 'ferry-east-inlet', {
    chunkId: 'l1-east-cove',
    phase: 0.72,
  });
  ws = patchWorldObjectState(ws, 'level1', 'switch-west', {
    chunkId: 'l1-west-ridge',
    activated: true,
  });

  const blockState = getWorldObjectState(ws, 'level1', 'block-courtyard-east');
  assert.deepEqual(blockState?.position, [3.8, 4.78, -14.5]);
  assert.equal(
    getWorldObjectState(ws, 'level1', 'ferry-east-inlet')?.phase,
    0.72,
  );

  const rawJson = JSON.stringify({
    version: 1,
    updatedAt: 5000,
    currentLevel: 'level1',
    levelElapsedSeconds: 55,
    checkpointPos: [0, 4.4, -11.5],
    activatedIds: { 'switch-west': true },
    keys: [],
    collectedCrystalIds: ['l1-c1'],
    foundChestIds: [],
    progression: createInitialProgression(),
    inventory: [],
    quests: createInitialQuests(),
    fragments: [],
    settings: { graphicsQuality: 'auto' },
    playtimeSeconds: 55,
    worldState: ws,
  });

  const parsed = parseSaveData(rawJson);
  assert.equal(parsed.corrupted, false);
  assert.equal(parsed.data?.settings.graphicsQuality, 'auto');
  assert.deepEqual(
    parsed.data?.worldState?.levels.level1?.['block-courtyard-east']?.position,
    [3.8, 4.78, -14.5],
  );
  assert.equal(
    parsed.data?.worldState?.levels.level1?.['ferry-east-inlet']?.phase,
    0.72,
  );
});

test('QualityPreset differentiates Low, Medium, and High across shadows, DPR, draw distance, particles, and post-processing', () => {
  const low = getQualityPreset('low', DESKTOP_HW);
  const med = getQualityPreset('medium', DESKTOP_HW);
  const high = getQualityPreset('high', DESKTOP_HW);

  // 1. Shadow resolution
  assert.equal(low.shadowsEnabled, false);
  assert.equal(low.shadowMapSize, 0);
  assert.equal(med.shadowsEnabled, true);
  assert.equal(med.shadowMapSize, 1024);
  assert.equal(high.shadowsEnabled, true);
  assert.equal(high.shadowMapSize, 2048);

  // 2. DPR
  assert.ok(low.maxDpr < med.maxDpr && med.maxDpr < high.maxDpr);

  // 3. Draw distance
  assert.ok(low.cameraFar < med.cameraFar && med.cameraFar < high.cameraFar);
  assert.ok(low.fogScale < med.fogScale && med.fogScale < high.fogScale);
  assert.ok(
    low.propCullDistance < med.propCullDistance &&
      med.propCullDistance < high.propCullDistance,
  );
  assert.ok(
    low.chunkRangeScale < med.chunkRangeScale &&
      med.chunkRangeScale < high.chunkRangeScale,
  );

  // 4. Particles
  assert.ok(low.particleCap < med.particleCap && med.particleCap < high.particleCap);

  // 5. Post-processing
  assert.equal(low.postProcessing, 'off');
  assert.equal(med.postProcessing, 'bloom');
  assert.equal(high.postProcessing, 'full');

  // Chunk streaming respects rangeScale
  const chunks: ChunkDefinition[] = [
    {
      id: 'near',
      label: 'Near',
      center: [0, 0, 0],
      boundsRadius: 10,
      loadRadius: 20,
      unloadRadius: 25,
    },
    {
      id: 'mid',
      label: 'Mid',
      center: [36, 0, 0],
      boundsRadius: 10,
      loadRadius: 40,
      unloadRadius: 48,
    },
  ];
  const highRes = evaluateChunkStreaming({
    chunks,
    currentlyLoaded: [],
    playerPos: { x: 0, y: 0, z: 0 },
    playerVel: { x: 0, y: 0, z: 0 },
    nowMs: 1000,
    lastHeavyOpMs: -1000,
    rangeScale: high.chunkRangeScale,
  });
  const lowRes = evaluateChunkStreaming({
    chunks,
    currentlyLoaded: [],
    playerPos: { x: 0, y: 0, z: 0 },
    playerVel: { x: 0, y: 0, z: 0 },
    nowMs: 1000,
    lastHeavyOpMs: -1000,
    rangeScale: low.chunkRangeScale,
  });
  assert.deepEqual(highRes.nextLoaded, ['near', 'mid']);
  assert.deepEqual(lowRes.nextLoaded, ['near']);
});
