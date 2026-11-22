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
  resolveInitialTier,
  type DeviceProfile,
} from './adaptiveQuality';
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
