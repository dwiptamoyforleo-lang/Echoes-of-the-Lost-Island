import test from 'node:test';
import assert from 'node:assert/strict';
import {
  DEFAULT_HORIZONTAL_CONFIG,
  ICE_HORIZONTAL_CONFIG,
  approachHorizontalVelocity,
  resolveHorizontalMoveConfig,
} from '@/src/game/physics/characterController';
import { isIceCollider, registerIceCollider, unregisterIceCollider } from '@/src/game/physics/iceSurfaces';
import {
  EMITTER_POS,
  LEVEL4_CHUNKS,
  LEVEL4_CRYSTALS,
  LEVEL4_SPAWN,
  MIRROR_INITIAL_STEPS,
  MIRROR_TARGET_STEPS,
  RECEIVER_POS,
  getFrozenPeaksHeight,
  traceIceMirrorBeam,
} from './level4Config';
import {
  FRAGMENT_PEDESTALS,
  LEVEL5_CHUNKS,
  LEVEL5_CRYSTALS,
  LEVEL5_SPAWN,
  SKY_ISLANDS,
  SYMBOL_INITIAL_STEPS,
  SYMBOL_TARGET_STEPS,
  areSkySymbolsAligned,
  checkSanctumFragments,
  getSkyTempleHeight,
} from './level5Config';
import { useGameStore } from '@/src/state/gameStore';

test('Level 4 (The Frozen Peaks) defines 30 unique crystals, valid terrain/lake heights, and 4 chunks', () => {
  assert.equal(LEVEL4_CRYSTALS.length, 30);
  const ids = new Set(LEVEL4_CRYSTALS.map((c) => c.id));
  assert.equal(ids.size, 30);

  assert.equal(LEVEL4_CHUNKS.length, 4);
  const spawnH = getFrozenPeaksHeight(LEVEL4_SPAWN[0], LEVEL4_SPAWN[2]);
  assert.ok(spawnH >= 2.0 && spawnH <= 3.0);

  const lakeH = getFrozenPeaksHeight(0, 0);
  assert.ok(Math.abs(lakeH - 1.4) < 0.05);

  const spireH = getFrozenPeaksHeight(-21, -21);
  assert.ok(spireH >= 4.2 && spireH <= 4.8);
});

test('Level 4 traceIceMirrorBeam solves when mirrors match target directions and tracks intermediate hits', () => {
  const initial = traceIceMirrorBeam(MIRROR_INITIAL_STEPS);
  assert.equal(initial.solved, false);
  assert.equal(initial.hitNodes, 1);
  assert.deepEqual(initial.segments[0].from, EMITTER_POS);

  // First mirror right, second wrong -> hits 2 nodes
  const step2 = traceIceMirrorBeam([MIRROR_TARGET_STEPS[0], 2, 2]);
  assert.equal(step2.solved, false);
  assert.equal(step2.hitNodes, 2);

  // All three aligned -> hits receiver
  const solved = traceIceMirrorBeam(MIRROR_TARGET_STEPS);
  assert.equal(solved.solved, true);
  assert.equal(solved.hitNodes, 4);
  assert.deepEqual(solved.segments[solved.segments.length - 1].to, RECEIVER_POS);
});

test('Ice physics config produces slower deceleration (glide) than normal ground and tracks collider handles', () => {
  assert.ok(ICE_HORIZONTAL_CONFIG.deceleration < DEFAULT_HORIZONTAL_CONFIG.deceleration * 0.2);
  assert.equal(resolveHorizontalMoveConfig(true), ICE_HORIZONTAL_CONFIG);
  assert.equal(resolveHorizontalMoveConfig(false), DEFAULT_HORIZONTAL_CONFIG);

  const normalVel = approachHorizontalVelocity(
    { x: 5.5, z: 0 },
    { x: 0, z: 0 },
    false,
    true,
    0.1,
    DEFAULT_HORIZONTAL_CONFIG,
  );
  const iceVel = approachHorizontalVelocity(
    { x: 5.5, z: 0 },
    { x: 0, z: 0 },
    false,
    true,
    0.1,
    ICE_HORIZONTAL_CONFIG,
  );
  assert.ok(iceVel.x > normalVel.x + 2.0);

  registerIceCollider(99101);
  assert.equal(isIceCollider(99101), true);
  unregisterIceCollider(99101);
  assert.equal(isIceCollider(99101), false);
});

test('Level 5 (The Sky Temple) defines 35 unique crystals, floating islands over cloud abyss, and 4 pedestals', () => {
  assert.equal(LEVEL5_CRYSTALS.length, 35);
  const ids = new Set(LEVEL5_CRYSTALS.map((c) => c.id));
  assert.equal(ids.size, 35);

  assert.equal(LEVEL5_CHUNKS.length, 4);
  assert.equal(SKY_ISLANDS.length, 6);
  assert.equal(FRAGMENT_PEDESTALS.length, 4);

  const arrivalH = getSkyTempleHeight(LEVEL5_SPAWN[0], LEVEL5_SPAWN[2]);
  assert.equal(arrivalH, 2.5);

  const abyssH = getSkyTempleHeight(14, 14);
  assert.equal(abyssH, -10);

  const templeH = getSkyTempleHeight(0, -27);
  assert.equal(templeH, 4.6);
});

test('Level 5 symbol alignment and Sanctum 4-fragment gate verification work as specified', () => {
  assert.equal(areSkySymbolsAligned(SYMBOL_INITIAL_STEPS), false);
  assert.equal(areSkySymbolsAligned(SYMBOL_TARGET_STEPS), true);

  const missingTwo = checkSanctumFragments(['fragment-1', 'fragment-3']);
  assert.equal(missingTwo.unlocked, false);
  assert.equal(missingTwo.haveCount, 2);
  assert.deepEqual(missingTwo.missingIds, ['fragment-2', 'fragment-4']);

  const allFour = checkSanctumFragments([
    'fragment-1',
    'fragment-2',
    'fragment-3',
    'fragment-4',
  ]);
  assert.equal(allFour.unlocked, true);
  assert.equal(allFour.haveCount, 4);
  assert.deepEqual(allFour.missingIds, []);
});

test('gameStore transitions Level 5 finale cutscene cleanly into ending screen and gameCompleted state', () => {
  useGameStore.getState().newGame();
  useGameStore.getState().startLevel('level5');
  useGameStore.getState().startFinaleCutscene();

  assert.equal(useGameStore.getState().finaleCutscene.active, true);
  assert.equal(useGameStore.getState().finaleCutscene.step, 0);

  useGameStore.getState().advanceFinaleCutscene();
  assert.equal(useGameStore.getState().finaleCutscene.step, 1);
  assert.equal(useGameStore.getState().finaleCutscene.islandRestored, true);

  useGameStore.getState().advanceFinaleCutscene();
  useGameStore.getState().advanceFinaleCutscene();
  useGameStore.getState().advanceFinaleCutscene();

  assert.equal(useGameStore.getState().finaleCutscene.active, false);
  assert.equal(useGameStore.getState().screen, 'ending');
  assert.equal(useGameStore.getState().gameCompleted, true);
  assert.equal(useGameStore.getState().progression.level5.completed, true);
  assert.equal(useGameStore.getState().recoveredFragments.includes('fragment-5'), true);
});
