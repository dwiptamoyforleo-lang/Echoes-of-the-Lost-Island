import test from 'node:test';
import assert from 'node:assert/strict';
import {
  ANCIENT_FRAGMENTS,
  addItemToInventory,
  consumeItemFromInventory,
  hasInventoryItem,
} from './inventorySystem';
import {
  completeLevelProgress,
  createInitialProgression,
  getLevelMetadata,
  recordLevelChest,
  recordLevelCrystal,
} from './progressionSystem';
import {
  applyQuestEvent,
  createInitialQuests,
  getActiveObjective,
} from './questSystem';
import {
  SAVE_STORAGE_KEY,
  loadFromStorage,
  parseSaveData,
  saveToStorage,
  type StorageLike,
} from './saveSystem';
import { useGameStore } from '@/src/state/gameStore';

function createMemoryStorage(): StorageLike {
  const map = new Map<string, string>();
  return {
    getItem: (k) => map.get(k) ?? null,
    setItem: (k, v) => {
      map.set(k, v);
    },
    removeItem: (k) => {
      map.delete(k);
    },
  };
}

test('progressionSystem unlocks level N+1 on completion, records bestTime, and allows replay', () => {
  let prog = createInitialProgression();
  assert.equal(prog.level1.unlocked, true);
  assert.equal(prog.level2.unlocked, false);
  assert.equal(prog.level5.unlocked, false);

  prog = recordLevelCrystal(prog, 'level1', 'l1-c1');
  prog = recordLevelCrystal(prog, 'level1', 'l1-c1'); // idempotent
  prog = recordLevelChest(prog, 'level1', 'chest-cave');
  assert.equal(prog.level1.crystalsCollected, 1);
  assert.equal(prog.level1.chestFound, true);

  prog = completeLevelProgress(prog, 'level1', 94.6);
  assert.equal(prog.level1.completed, true);
  assert.equal(prog.level1.fragmentCollected, true);
  assert.equal(prog.level1.bestTimeSeconds, 94.6);
  assert.equal(prog.level2.unlocked, true);
  assert.equal(prog.level3.unlocked, false);

  // Replay with faster time updates bestTimeSeconds while keeping slower time untouched
  prog = completeLevelProgress(prog, 'level1', 120.0);
  assert.equal(prog.level1.bestTimeSeconds, 94.6);
  prog = completeLevelProgress(prog, 'level1', 72.3);
  assert.equal(prog.level1.bestTimeSeconds, 72.3);
});

test('questSystem updates main and optional objectives and emits newlyCompleted', () => {
  let quests = createInitialQuests();
  assert.equal(getActiveObjective(quests.level1)?.id, 'l1-obj-seals');

  let res = applyQuestEvent(quests, {
    type: 'seals',
    levelId: 'level1',
    activeCount: 3,
  });
  quests = res.nextQuests;
  assert.equal(res.newlyCompleted.length, 2); // seals + gate
  assert.equal(getActiveObjective(quests.level1)?.id, 'l1-obj-fragment');

  res = applyQuestEvent(quests, {
    type: 'crystal',
    levelId: 'level1',
    collectedCount: 20,
  });
  quests = res.nextQuests;
  assert.equal(res.newlyCompleted.some((o) => o.id === 'l1-obj-crystals'), true);

  res = applyQuestEvent(quests, {
    type: 'chest',
    levelId: 'level1',
    foundCount: 1,
  });
  quests = res.nextQuests;
  assert.equal(res.newlyCompleted.some((o) => o.id === 'l1-obj-chest'), true);
});

test('inventorySystem adds items, consumes keys, and preserves lore on all 5 fragments', () => {
  assert.equal(ANCIENT_FRAGMENTS.length, 5);
  for (const frag of ANCIENT_FRAGMENTS) {
    assert.ok(frag.loreText && frag.loreText.length > 20);
  }

  let items = addItemToInventory([], 'key-sanctuary');
  items = addItemToInventory(items, 'Sunstone Compass');
  items = addItemToInventory(items, 'fragment-1');
  assert.equal(hasInventoryItem(items, 'key-sanctuary'), true);
  assert.equal(hasInventoryItem(items, 'relic-sunstone-compass'), true);
  assert.equal(hasInventoryItem(items, 'fragment-1'), true);

  const consumed = consumeItemFromInventory(items, 'key-sanctuary');
  assert.equal(consumed.consumed, true);
  assert.equal(hasInventoryItem(consumed.nextInventory, 'key-sanctuary'), false);
});

test('saveSystem safely handles corrupted, wrong-version, and valid saves', () => {
  const storage = createMemoryStorage();
  assert.deepEqual(loadFromStorage(storage), { data: null, corrupted: false });

  storage.setItem(SAVE_STORAGE_KEY, '{bad-json');
  assert.deepEqual(loadFromStorage(storage), { data: null, corrupted: true });

  storage.setItem(SAVE_STORAGE_KEY, JSON.stringify({ version: 99 }));
  assert.deepEqual(loadFromStorage(storage), { data: null, corrupted: true });

  const valid = parseSaveData(
    JSON.stringify({
      version: 1,
      updatedAt: 1000,
      currentLevel: 'level1',
      levelElapsedSeconds: 42,
      checkpointPos: [21.5, 4.7, -1],
      activatedIds: { 'switch-west': true },
      keys: ['key-sanctuary'],
      collectedCrystalIds: ['l1-c1', 'l1-c2'],
      foundChestIds: ['chest-cave'],
      progression: createInitialProgression(),
      inventory: [{ id: 'relic-sunstone-compass', quantity: 1 }],
      quests: createInitialQuests(),
      fragments: ['fragment-1'],
      settings: { masterVolume: 0.7, mouseSensitivity: 1.2 },
      playtimeSeconds: 120,
    }),
  );

  assert.equal(valid.corrupted, false);
  assert.ok(valid.data);
  assert.equal(saveToStorage(valid.data, storage), true);

  const loaded = loadFromStorage(storage);
  assert.equal(loaded.corrupted, false);
  assert.deepEqual(loaded.data?.collectedCrystalIds, ['l1-c1', 'l1-c2']);
  assert.deepEqual(loaded.data?.foundChestIds, ['chest-cave']);
  assert.equal(loaded.data?.playtimeSeconds, 120);
});

test('gameStore integrates save, continue, replay persistence, and key consumption', () => {
  const storage = createMemoryStorage();
  useGameStore.getState().newGame(storage);

  useGameStore.getState().addCrystal('l1-c1');
  useGameStore.getState().openChest('chest-cave', 'Sunstone Compass');
  useGameStore.getState().addKey('key-sanctuary', 'Sunstone Vault Key');
  useGameStore.getState().setCheckpoint([0, 4.4, -11.5]);
  useGameStore.getState().saveCurrentGame(true, storage);

  // Simulate page reset & Continue
  useGameStore.getState().resetProgress();
  assert.equal(useGameStore.getState().crystals, 0);
  const resumed = useGameStore.getState().continueSavedGame(storage);
  assert.equal(resumed, true);
  assert.equal(useGameStore.getState().crystals, 1);
  assert.equal(useGameStore.getState().collectedIds['l1-c1'], true);
  assert.equal(useGameStore.getState().foundChestIds.includes('chest-cave'), true);
  assert.deepEqual(useGameStore.getState().checkpointPos, [0, 4.4, -11.5]);

  // Unlocking door consumes key
  useGameStore.getState().unlockDoor('door-vault', 'key-sanctuary', 'Sunstone Vault Key');
  assert.equal(useGameStore.getState().keys.includes('key-sanctuary'), false);

  // Replaying Level 1 keeps collected crystals & found chests from respawning
  useGameStore.getState().startLevel('level1');
  assert.equal(useGameStore.getState().collectedIds['l1-c1'], true);
  assert.equal(useGameStore.getState().activatedIds['chest-cave'], true);
  assert.equal(useGameStore.getState().crystals, 1);
});

test('Stage 4 extended settings persist and UI overlay/settings transitions restore context', () => {
  const parsed = parseSaveData(
    JSON.stringify({
      version: 1,
      updatedAt: 2000,
      currentLevel: 'level1',
      levelElapsedSeconds: 10,
      checkpointPos: [0, 1.5, 25],
      activatedIds: {},
      keys: [],
      collectedCrystalIds: [],
      foundChestIds: [],
      progression: createInitialProgression(),
      inventory: [],
      quests: createInitialQuests(),
      fragments: [],
      settings: {
        graphicsQuality: 'low',
        masterVolume: 0.65,
        musicVolume: 0.4,
        sfxVolume: 0.9,
        mouseSensitivity: 1.5,
        cameraSensitivity: 1.8,
        invertY: true,
      },
      playtimeSeconds: 30,
    }),
  );

  assert.equal(parsed.corrupted, false);
  assert.equal(parsed.data?.settings.graphicsQuality, 'low');
  assert.equal(parsed.data?.settings.musicVolume, 0.4);
  assert.equal(parsed.data?.settings.sfxVolume, 0.9);
  assert.equal(parsed.data?.settings.cameraSensitivity, 1.8);
  assert.equal(parsed.data?.settings.invertY, true);

  const storage = createMemoryStorage();
  useGameStore.getState().beginNewGameWithIntro(storage);
  assert.equal(useGameStore.getState().screen, 'intro');
  useGameStore.getState().finishIntro();
  assert.equal(useGameStore.getState().screen, 'playing');
  assert.equal(useGameStore.getState().levelLoading, true);
  useGameStore.getState().finishLevelLoading();
  assert.equal(useGameStore.getState().levelLoading, false);

  useGameStore.getState().toggleQuestLog();
  assert.equal(useGameStore.getState().activeOverlay, 'quests');
  useGameStore.getState().toggleInventory();
  assert.equal(useGameStore.getState().activeOverlay, 'inventory');
  useGameStore.getState().togglePause();
  assert.equal(useGameStore.getState().activeOverlay, 'none');

  useGameStore.getState().setScreen('paused');
  useGameStore.getState().openSettings('paused');
  assert.equal(useGameStore.getState().screen, 'settings');
  useGameStore.getState().closeSettings();
  assert.equal(useGameStore.getState().screen, 'paused');
});

test('Stage 6 configures Level 4 (30 crystals, 2 chests) and Level 5 (35 crystals, 2 chests) and persists gameCompleted', () => {
  const l4 = getLevelMetadata('level4');
  const l5 = getLevelMetadata('level5');
  assert.equal(l4.name, 'The Frozen Peaks');
  assert.equal(l4.totalCrystals, 30);
  assert.equal(l4.totalChests, 2);
  assert.equal(l4.fragmentName, 'Echo of the Frost');

  assert.equal(l5.name, 'The Sky Temple');
  assert.equal(l5.totalCrystals, 35);
  assert.equal(l5.totalChests, 2);
  assert.equal(l5.fragmentName, 'Echo of Eternity');

  const storage = createMemoryStorage();
  useGameStore.getState().newGame(storage);
  useGameStore.getState().startLevel('level5');
  useGameStore.getState().startFinaleCutscene();
  useGameStore.getState().finishFinaleCutscene();
  useGameStore.getState().saveCurrentGame(true, storage);

  assert.equal(useGameStore.getState().screen, 'ending');
  assert.equal(useGameStore.getState().gameCompleted, true);
  assert.equal(useGameStore.getState().progression.level5.completed, true);

  // Verify gameCompleted survives save/reload roundtrip
  useGameStore.getState().resetProgress();
  assert.equal(useGameStore.getState().gameCompleted, false);
  const loaded = useGameStore.getState().continueSavedGame(storage);
  assert.equal(loaded, true);
  assert.equal(useGameStore.getState().gameCompleted, true);
  assert.equal(useGameStore.getState().progression.level5.completed, true);
});

