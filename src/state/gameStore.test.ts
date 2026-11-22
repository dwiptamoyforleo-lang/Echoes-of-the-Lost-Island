import test from 'node:test';
import assert from 'node:assert/strict';
import {
  resolveInitialLevel,
  resolveInitialScreen,
  useGameStore,
  type GameScreen,
} from './gameStore';

test('resolveInitialScreen defaults to mainMenu and supports query overrides', () => {
  assert.equal(resolveInitialScreen(''), 'mainMenu');
  assert.equal(resolveInitialScreen('?autostart=1'), 'playing');
  assert.equal(resolveInitialScreen('?screen=worldMap'), 'worldMap');
  assert.equal(resolveInitialLevel(''), 'level1');
  assert.equal(resolveInitialLevel('?level=testArena'), 'testArena');
});

test('useGameStore transitions cleanly and tracks level collectibles, switches, and checkpoints', () => {
  const expectedScreens: GameScreen[] = [
    'mainMenu',
    'worldMap',
    'playing',
    'paused',
    'levelComplete',
  ];

  useGameStore.getState().reset();
  assert.equal(useGameStore.getState().screen, 'mainMenu');

  for (const nextScreen of expectedScreens) {
    useGameStore.getState().setScreen(nextScreen);
    assert.equal(useGameStore.getState().screen, nextScreen);
  }

  useGameStore.getState().startLevel('level1');
  assert.equal(useGameStore.getState().screen, 'playing');
  assert.equal(useGameStore.getState().activeLevel, 'level1');
  assert.equal(useGameStore.getState().crystals, 0);

  // Crystal collection is idempotent per id
  assert.equal(useGameStore.getState().addCrystal('c-1'), true);
  assert.equal(useGameStore.getState().addCrystal('c-1'), false);
  assert.equal(useGameStore.getState().crystals, 1);

  // Keys, inventory, and switches
  useGameStore.getState().addKey('ruins-side-key');
  useGameStore.getState().addInventoryItem('Sunstone Compass');
  useGameStore.getState().setActivated('switch-west', true);
  assert.deepEqual(useGameStore.getState().keys, ['ruins-side-key']);
  assert.deepEqual(useGameStore.getState().inventory, ['Sunstone Compass']);
  assert.equal(useGameStore.getState().activatedIds['switch-west'], true);

  // Checkpoint and level completion
  useGameStore.getState().setCheckpoint([10, 4, -5]);
  assert.deepEqual(useGameStore.getState().checkpointPos, [10, 4, -5]);
  useGameStore.getState().completeLevel('Echo of the Tides');
  assert.equal(useGameStore.getState().screen, 'levelComplete');
  assert.equal(
    useGameStore.getState().recoveredFragmentName,
    'Echo of the Tides',
  );
});
