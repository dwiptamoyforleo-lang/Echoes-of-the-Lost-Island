import { useEffect, useRef } from 'react';
import { useGameStore } from '@/src/state/gameStore';

export interface PlayerInputState {
  forward: number;
  right: number;
  sprint: boolean;
  jumpHeld: boolean;
  jumpJustPressed: boolean;
  interactJustPressed: boolean;
}

export function usePlayerInput() {
  const heldRef = useRef<Set<string>>(new Set());
  const jumpQueuedRef = useRef(false);
  const interactQueuedRef = useRef(false);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const code = event.code;

      if (code === 'F3') {
        event.preventDefault();
        if (!event.repeat) {
          useGameStore.getState().toggleDebug();
        }
        return;
      }

      if (code === 'F4') {
        event.preventDefault();
        if (!event.repeat) {
          const state = useGameStore.getState();
          if (!state.systemsDebugVisible) {
            document.exitPointerLock?.();
          }
          state.toggleSystemsDebug();
        }
        return;
      }

      if (code === 'F5') {
        event.preventDefault();
        if (!event.repeat) {
          const state = useGameStore.getState();
          if (!state.qaVisible) {
            document.exitPointerLock?.();
          }
          state.toggleQaOverlay();
        }
        return;
      }

      if ((code === 'KeyI' || code === 'Tab') && !event.repeat) {
        const state = useGameStore.getState();
        if (code === 'Tab') {
          event.preventDefault();
        }
        if (
          !state.activeInscription &&
          (state.screen === 'playing' || state.screen === 'paused')
        ) {
          if (state.activeOverlay !== 'inventory') {
            document.exitPointerLock?.();
          }
          state.toggleInventory();
        }
        return;
      }

      if (code === 'KeyJ' && !event.repeat) {
        const state = useGameStore.getState();
        if (
          !state.activeInscription &&
          (state.screen === 'playing' || state.screen === 'paused')
        ) {
          if (state.activeOverlay !== 'quests') {
            document.exitPointerLock?.();
          }
          state.toggleQuestLog();
        }
        return;
      }

      if (code === 'Escape') {
        if (!event.repeat) {
          const state = useGameStore.getState();
          if (state.activeInscription) {
            state.closeInscription();
            return;
          }
          if (state.screen === 'settings') {
            state.closeSettings();
            return;
          }
          if (state.screen === 'credits' || state.screen === 'worldMap') {
            state.setScreen('mainMenu');
            return;
          }
          if (state.screen === 'playing') {
            document.exitPointerLock?.();
          }
          state.togglePause();
        }
        return;
      }

      if (code === 'KeyE' && !event.repeat) {
        const state = useGameStore.getState();
        if (state.activeInscription) {
          state.closeInscription();
          return;
        }
        interactQueuedRef.current = true;
      }

      if (code === 'Space') {
        event.preventDefault();
        if (!event.repeat) {
          jumpQueuedRef.current = true;
        }
      }

      heldRef.current.add(code);
    };

    const onKeyUp = (event: KeyboardEvent) => {
      heldRef.current.delete(event.code);
    };

    const clearInputs = () => {
      heldRef.current.clear();
      jumpQueuedRef.current = false;
      interactQueuedRef.current = false;
    };

    const onVisibilityChange = () => {
      if (document.hidden) {
        clearInputs();
      }
    };

    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    window.addEventListener('blur', clearInputs);
    document.addEventListener('visibilitychange', onVisibilityChange);

    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      window.removeEventListener('blur', clearInputs);
      document.removeEventListener('visibilitychange', onVisibilityChange);
    };
  }, []);

  const sampleInput = (out: PlayerInputState): PlayerInputState => {
    const held = heldRef.current;
    const forward =
      (held.has('KeyW') || held.has('ArrowUp') ? 1 : 0) -
      (held.has('KeyS') || held.has('ArrowDown') ? 1 : 0);
    const right =
      (held.has('KeyD') || held.has('ArrowRight') ? 1 : 0) -
      (held.has('KeyA') || held.has('ArrowLeft') ? 1 : 0);

    out.forward = forward;
    out.right = right;
    out.sprint = held.has('ShiftLeft') || held.has('ShiftRight');
    out.jumpHeld = held.has('Space');
    out.jumpJustPressed = jumpQueuedRef.current;
    out.interactJustPressed = interactQueuedRef.current;

    jumpQueuedRef.current = false;
    interactQueuedRef.current = false;
    return out;
  };

  return { sampleInput };
}
