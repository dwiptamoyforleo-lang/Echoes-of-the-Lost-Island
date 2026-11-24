import { playerTelemetry } from '@/src/game/player/playerTelemetry';
import { eventBus } from '@/src/state/eventBus';
import { useGameStore } from '@/src/state/gameStore';

const INTERACT_DEBOUNCE_MS = 160;

let lastInteractTimestamp = -Infinity;
let pendingExplorerInteractAnim = false;

/**
 * Single shared interaction trigger used by both keyboard E and the touch Interact button.
 * Enforces gameplay state checks, requires an active in-range interactable, and debounces rapid taps.
 */
export function triggerInteract(): boolean {
  const state = useGameStore.getState();
  if (
    state.screen !== 'playing' ||
    state.activeOverlay !== 'none' ||
    state.activeInscription ||
    state.finaleCutscene.active ||
    state.fallFadeActive
  ) {
    return false;
  }

  if (!state.activePrompt) {
    return false;
  }

  const now =
    typeof performance !== 'undefined' ? performance.now() : Date.now();
  if (now - lastInteractTimestamp < INTERACT_DEBOUNCE_MS) {
    return false;
  }

  lastInteractTimestamp = now;
  pendingExplorerInteractAnim = true;
  eventBus.emit('player:interact');

  const p = playerTelemetry.position;
  console.info(
    `[Interact] Explorer interacted at (${p.x.toFixed(2)}, ${p.y.toFixed(2)}, ${p.z.toFixed(2)})`,
  );
  return true;
}

/**
 * Consumed once per physics/animation frame by PlayerController so the explorer
 * arm-reach animation plays identically for keyboard E and touch Interact taps.
 */
export function consumeInteractAnimationTrigger(): boolean {
  if (!pendingExplorerInteractAnim) return false;
  pendingExplorerInteractAnim = false;
  return true;
}

export function resetInteractDebounce(): void {
  lastInteractTimestamp = -Infinity;
  pendingExplorerInteractAnim = false;
}
