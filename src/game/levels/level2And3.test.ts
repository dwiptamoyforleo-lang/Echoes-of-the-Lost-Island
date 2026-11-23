import assert from 'node:assert/strict';
import test from 'node:test';
import {
  BRIDGE_WHEEL_TARGET_STEPS,
  LEVEL2_CHUNKS,
  LEVEL2_CRYSTALS,
  LEVEL2_SPAWN,
  areWheelsAligned,
  evaluateTotemSequence,
  getWoodsHeight,
} from './level2Config';
import {
  CISTERN_WATER_BOUNDS,
  LEVEL3_CHUNKS,
  LEVEL3_CRYSTALS,
  LEVEL3_SPAWN,
  STATUE_TARGET_STEPS,
  areStatuesAligned,
  getSunkenKingdomHeight,
  isPositionInFloodedCistern,
} from './level3Config';
import { useGameStore } from '@/src/state/gameStore';

test('Level 2 Whispering Woods has 25 unique crystals, valid terrain, and river gorge', () => {
  assert.equal(LEVEL2_CRYSTALS.length, 25);
  const ids = new Set(LEVEL2_CRYSTALS.map((c) => c.id));
  assert.equal(ids.size, 25);
  assert.equal(LEVEL2_CHUNKS.length, 4);

  // Spawn sits smoothly on the south trailhead terrace
  const spawnGround = getWoodsHeight(LEVEL2_SPAWN[0], LEVEL2_SPAWN[2]);
  assert.ok(Math.abs(spawnGround - LEVEL2_SPAWN[1]) < 0.25);

  // River gorge dips below water surface y = 0 near z = -1
  assert.ok(getWoodsHeight(0, -1) < 0);
  // Ruined shrine terrace rises at y = 4.0
  assert.ok(getWoodsHeight(0, -20) > 3.8);
});

test('Level 2 totem sequence enforces Roots -> Wings -> Antlers and resets on wrong order', () => {
  // Wrong first totem resets
  const wrong1 = evaluateTotemSequence(0, 'totem-wings');
  assert.equal(wrong1.resetTriggered, true);
  assert.equal(wrong1.nextStep, 0);
  assert.equal(wrong1.solved, false);

  // Correct step 1 -> wrong step 2 resets all
  const ok1 = evaluateTotemSequence(0, 'totem-roots');
  assert.equal(ok1.nextStep, 1);
  assert.equal(ok1.activatedIdsPatch['totem-roots'], true);

  const wrong2 = evaluateTotemSequence(ok1.nextStep, 'totem-antlers');
  assert.equal(wrong2.resetTriggered, true);
  assert.equal(wrong2.nextStep, 0);
  assert.equal(wrong2.activatedIdsPatch['totem-roots'], false);

  // Full valid sequence solves puzzle
  const ok2 = evaluateTotemSequence(1, 'totem-wings');
  const ok3 = evaluateTotemSequence(ok2.nextStep, 'totem-antlers');
  assert.equal(ok3.nextStep, 3);
  assert.equal(ok3.solved, true);
  assert.equal(ok3.activatedIdsPatch['l2-totems-solved'], true);

  // Drawbridge wheels alignment check
  assert.equal(areWheelsAligned([2, 1, 3]), false);
  assert.equal(areWheelsAligned([...BRIDGE_WHEEL_TARGET_STEPS]), true);
});

test('Level 3 The Sunken Kingdom has 30 unique crystals, flooded cistern bounds, and statue puzzle logic', () => {
  assert.equal(LEVEL3_CRYSTALS.length, 30);
  const ids = new Set(LEVEL3_CRYSTALS.map((c) => c.id));
  assert.equal(ids.size, 30);
  assert.equal(LEVEL3_CHUNKS.length, 4);

  assert.equal(getSunkenKingdomHeight(LEVEL3_SPAWN[0], LEVEL3_SPAWN[2]), 2.0);
  assert.equal(getSunkenKingdomHeight(20, 0), 0.2);
  assert.equal(getSunkenKingdomHeight(12.2, 0), 3.0);

  const floodedPos = { x: 20, y: 1.0, z: 0 };
  assert.equal(isPositionInFloodedCistern(floodedPos, false), true);
  assert.equal(isPositionInFloodedCistern(floodedPos, true), false);
  assert.ok(CISTERN_WATER_BOUNDS.maxY > 2.0);

  assert.equal(areStatuesAligned([0, 0, 0, 0]), false);
  assert.equal(areStatuesAligned([...STATUE_TARGET_STEPS]), true);
});

test('gameStore integrates Level 2 and Level 3 quests, Bronze Key door, 2 chests, underwater tint, and progression', () => {
  const store = useGameStore.getState();
  store.resetProgress(null);

  // Level 2 flow -> unlocks Level 3
  store.startLevel('level2');
  assert.equal(useGameStore.getState().totalCrystals, 25);
  store.reportQuestObjective('l2-obj-totems', 3, 'level2');
  store.reportQuestObjective('l2-obj-bridge', 1, 'level2');
  store.collectFragment('fragment-2', 'Echo of the Gale');
  store.completeLevel('Echo of the Gale');

  const afterL2 = useGameStore.getState();
  assert.equal(afterL2.progression.level2.completed, true);
  assert.equal(afterL2.progression.level3.unlocked, true);

  // Level 3 flow: Bronze Key consumes on door unlock, 2 chests, underwater tint, unlocks Level 4
  store.startLevel('level3');
  assert.equal(useGameStore.getState().totalCrystals, 30);
  store.setUnderwaterTint(true);
  assert.equal(useGameStore.getState().underwaterTint, true);

  store.addKey('key-bronze', 'Bronze Key');
  store.unlockDoor('l3-door-bronze', 'key-bronze', 'Bronze Key');
  assert.equal(useGameStore.getState().keys.includes('key-bronze'), false);
  assert.equal(
    useGameStore.getState().quests.level3.find((q) => q.id === 'l3-obj-bronze-door')?.completed,
    true,
  );

  store.openChest('chest-sunken-cistern', 'Sunken Crown Signet');
  assert.equal(
    useGameStore.getState().quests.level3.find((q) => q.id === 'l3-obj-chest')?.current,
    1,
  );
  store.openChest('chest-sunken-west', 'Abyssal Astrolabe');
  assert.equal(
    useGameStore.getState().quests.level3.find((q) => q.id === 'l3-obj-chest')?.completed,
    true,
  );

  store.collectFragment('fragment-3', 'Echo of the Stars');
  store.completeLevel('Echo of the Stars');
  const afterL3 = useGameStore.getState();
  assert.equal(afterL3.underwaterTint, false);
  assert.equal(afterL3.progression.level3.completed, true);
  assert.equal(afterL3.progression.level4.unlocked, true);
});
