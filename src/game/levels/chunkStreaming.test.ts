import test from 'node:test';
import assert from 'node:assert/strict';
import {
  evaluateChunkStreaming,
  type ChunkDefinition,
} from './chunkStreaming';

const SAMPLE_CHUNKS: ChunkDefinition[] = [
  {
    id: 'shore',
    label: 'Shore',
    center: [0, 0, 20],
    boundsRadius: 12,
    loadRadius: 30,
    unloadRadius: 40,
    heavy: true,
  },
  {
    id: 'west',
    label: 'West',
    center: [-32, 0, 0],
    boundsRadius: 12,
    loadRadius: 30,
    unloadRadius: 40,
    heavy: true,
  },
  {
    id: 'north',
    label: 'North',
    center: [0, 0, -25],
    boundsRadius: 12,
    loadRadius: 30,
    unloadRadius: 40,
    heavy: true,
  },
];

test('evaluateChunkStreaming respects hysteresis band and avoids border thrashing', () => {
  // Player at [0, 0, 12]: dist to shore=8, dist to north=37 (between load=30 & unload=40), dist to west=34.2 > 30
  const initial = evaluateChunkStreaming({
    chunks: SAMPLE_CHUNKS,
    currentlyLoaded: ['shore'],
    playerPos: { x: 0, y: 0, z: 12 },
    playerVel: { x: 0, y: 0, z: 0 },
    nowMs: 500,
    lastHeavyOpMs: 0,
  });
  assert.deepEqual(initial.nextLoaded, ['shore']);

  // If north WAS loaded and player sits inside hysteresis (dist=37 < unload=40), north stays loaded
  const hysteresisHold = evaluateChunkStreaming({
    chunks: SAMPLE_CHUNKS,
    currentlyLoaded: ['shore', 'north'],
    playerPos: { x: 0, y: 0, z: 12 },
    playerVel: { x: 0, y: 0, z: 0 },
    nowMs: 600,
    lastHeavyOpMs: 0,
  });
  assert.deepEqual(hysteresisHold.nextLoaded, ['shore', 'north']);

  // Once dist > unloadRadius (player moves south to z=20 -> dist to north=45 > 40), north unloads
  const unloadOutside = evaluateChunkStreaming({
    chunks: SAMPLE_CHUNKS,
    currentlyLoaded: ['shore', 'north'],
    playerPos: { x: 0, y: 0, z: 20 },
    playerVel: { x: 0, y: 0, z: 0 },
    nowMs: 800,
    lastHeavyOpMs: 0,
  });
  assert.deepEqual(unloadOutside.nextLoaded, ['shore']);
});

test('evaluateChunkStreaming pins current chunk and prioritizes player velocity direction', () => {
  // Player at [-5, 0, 0] with both west (27m) & north (25.5m) within loadRadius=30, moving north (-Z)
  const movingNorth = evaluateChunkStreaming({
    chunks: SAMPLE_CHUNKS,
    currentlyLoaded: ['shore'],
    playerPos: { x: -5, y: 0, z: 0 },
    playerVel: { x: 0, y: 0, z: -6 },
    nowMs: 1000,
    lastHeavyOpMs: 0,
    heavyOpCooldownMs: 90,
  });

  // Heavy op limit allows 1 non-pinned heavy chunk per tick -> north (direction of motion) wins over west
  assert.equal(movingNorth.nextLoaded.includes('north'), true);
  assert.equal(movingNorth.nextLoaded.includes('west'), false);
  assert.equal(movingNorth.pendingCount, 1);
  assert.equal(movingNorth.didHeavyOp, true);

  // Too soon (nowMs=1030 < 1090) -> staggered, waits for cooldown
  const throttled = evaluateChunkStreaming({
    chunks: SAMPLE_CHUNKS,
    currentlyLoaded: movingNorth.nextLoaded,
    playerPos: { x: -5, y: 0, z: 0 },
    playerVel: { x: 0, y: 0, z: -6 },
    nowMs: 1030,
    lastHeavyOpMs: 1000,
    heavyOpCooldownMs: 90,
  });
  assert.equal(throttled.nextLoaded.includes('west'), false);
  assert.equal(throttled.pendingCount, 1);

  // After cooldown -> remaining heavy chunk mounts
  const secondTick = evaluateChunkStreaming({
    chunks: SAMPLE_CHUNKS,
    currentlyLoaded: movingNorth.nextLoaded,
    playerPos: { x: -5, y: 0, z: 0 },
    playerVel: { x: 0, y: 0, z: -6 },
    nowMs: 1120,
    lastHeavyOpMs: 1000,
    heavyOpCooldownMs: 90,
  });
  assert.equal(secondTick.nextLoaded.includes('west'), true);
  assert.equal(secondTick.pendingCount, 0);
});
