import test from 'node:test';
import assert from 'node:assert/strict';
import { eventBus } from '@/src/state/eventBus';
import { useGameStore } from '@/src/state/gameStore';
import {
  getDialogueCloseHint,
  getInputMode,
  getInteractLabel,
  getTutorialInteractToast,
  setInputMode,
} from './inputMode';
import {
  consumeInteractAnimationTrigger,
  resetInteractDebounce,
  triggerInteract,
} from './interaction';

test('getInteractLabel, tutorial toast, and dialogue hint adapt cleanly between keyboard and touch', () => {
  assert.equal(getInteractLabel('keyboard', 'Open Chest'), 'Press E to Open Chest');
  assert.equal(getInteractLabel('keyboard', 'Press E to Read Inscription'), 'Press E to Read Inscription');
  assert.equal(getInteractLabel('touch', 'Open Chest'), 'Open Chest');
  assert.equal(getInteractLabel('touch', 'Press E to Read Inscription'), 'Read Inscription');
  assert.equal(getInteractLabel('touch', ''), 'Interact');

  assert.match(getTutorialInteractToast('keyboard'), /Press E/);
  assert.equal(/Press E/i.test(getTutorialInteractToast('touch')), false);

  assert.match(getDialogueCloseHint('keyboard', true), /Press E/);
  assert.equal(/Press E/i.test(getDialogueCloseHint('touch', true)), false);

  setInputMode('touch');
  assert.equal(getInputMode(), 'touch');
  setInputMode('keyboard');
  assert.equal(getInputMode(), 'keyboard');
});

test('triggerInteract enforces playing state, activePrompt presence, single shared emission, and debounce', () => {
  resetInteractDebounce();
  useGameStore.getState().newGame();
  useGameStore.getState().finishLevelLoading();

  let emitCount = 0;
  const unsub = eventBus.on('player:interact', () => {
    emitCount += 1;
  });

  try {
    // Nothing in range -> does not trigger
    useGameStore.getState().setActivePrompt(null);
    assert.equal(triggerInteract(), false);
    assert.equal(emitCount, 0);
    assert.equal(consumeInteractAnimationTrigger(), false);

    // Interactable in range -> triggers once and queues explorer animation
    useGameStore.getState().setActivePrompt({
      id: 'chest-cave',
      label: 'Open Chest',
      actionLabel: 'Open',
      requiresPrefix: true,
    });
    assert.equal(triggerInteract(), true);
    assert.equal(emitCount, 1);
    assert.equal(consumeInteractAnimationTrigger(), true);
    assert.equal(consumeInteractAnimationTrigger(), false);

    // Immediate double-tap within debounce window -> blocked
    assert.equal(triggerInteract(), false);
    assert.equal(emitCount, 1);

    // Pausing or opening an overlay blocks interaction even if prompt exists
    resetInteractDebounce();
    useGameStore.getState().setScreen('paused');
    assert.equal(triggerInteract(), false);
    assert.equal(emitCount, 1);

    useGameStore.getState().setScreen('playing');
    useGameStore.getState().setActiveOverlay('inventory');
    assert.equal(triggerInteract(), false);
    assert.equal(emitCount, 1);

    // Clearing prompt (e.g. chunk unload) prevents stale interaction
    useGameStore.getState().setActiveOverlay('none');
    useGameStore.getState().clearActivePromptIfId('chest-cave');
    assert.equal(useGameStore.getState().activePrompt, null);
    assert.equal(triggerInteract(), false);
    assert.equal(emitCount, 1);
  } finally {
    unsub();
    resetInteractDebounce();
  }
});
