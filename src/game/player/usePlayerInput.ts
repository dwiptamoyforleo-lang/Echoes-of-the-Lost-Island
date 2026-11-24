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

export interface MoveAxis {
  forward: number;
  right: number;
}

const virtualJoystickAxis = {
  x: 0,
  y: 0,
  active: false,
};

export function setVirtualJoystickMove(
  x: number,
  y: number,
  active = true,
): void {
  virtualJoystickAxis.x = Number.isFinite(x) ? Math.max(-1, Math.min(1, x)) : 0;
  virtualJoystickAxis.y = Number.isFinite(y) ? Math.max(-1, Math.min(1, y)) : 0;
  virtualJoystickAxis.active = active;
}

export function resetVirtualJoystickMove(): void {
  virtualJoystickAxis.x = 0;
  virtualJoystickAxis.y = 0;
  virtualJoystickAxis.active = false;
}

export function combineMoveInputs(
  keyForward: number,
  keyRight: number,
  joyX: number,
  joyY: number,
  out: MoveAxis = { forward: 0, right: 0 },
): MoveAxis {
  const rawForward = keyForward + joyY;
  const rawRight = keyRight + joyX;
  const mag = Math.hypot(rawForward, rawRight);
  if (mag > 1) {
    out.forward = rawForward / mag;
    out.right = rawRight / mag;
  } else {
    out.forward = rawForward;
    out.right = rawRight;
  }
  return out;
}

const _combinedAxis: MoveAxis = { forward: 0, right: 0 };

export function usePlayerInput() {
  const heldRef = useRef<Set<string>>(new Set());
  const jumpQueuedRef = useRef(false);
  const interactQueuedRef = useRef(false);

  useEffect(() => {
    const clearInputs = () => {
      heldRef.current.clear();
      jumpQueuedRef.current = false;
      interactQueuedRef.current = false;
      resetVirtualJoystickMove();
    };

    const onKeyDown = (event: KeyboardEvent) => {
      const code = event.code;
      const state = useGameStore.getState();

      if (code === 'F3') {
        event.preventDefault();
        if (!event.repeat) {
          state.toggleDebug();
        }
        return;
      }

      if (code === 'F4') {
        event.preventDefault();
        if (!event.repeat) {
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
          if (!state.qaVisible) {
            document.exitPointerLock?.();
          }
          state.toggleQaOverlay();
        }
        return;
      }

      if ((code === 'KeyI' || code === 'Tab') && !event.repeat) {
        if (code === 'Tab') {
          event.preventDefault();
        }
        if (
          !state.activeInscription &&
          !state.finaleCutscene.active &&
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
        if (
          !state.activeInscription &&
          !state.finaleCutscene.active &&
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
          if (state.finaleCutscene.active) {
            return;
          }
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

      if (state.finaleCutscene.active) {
        return;
      }

      if (
        (code === 'ArrowUp' ||
          code === 'ArrowDown' ||
          code === 'ArrowLeft' ||
          code === 'ArrowRight') &&
        state.screen === 'playing' &&
        state.activeOverlay === 'none' &&
        !state.activeInscription
      ) {
        event.preventDefault();
      }

      if (code === 'KeyE' && !event.repeat) {
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

    const onVisibilityChange = () => {
      if (document.hidden) {
        clearInputs();
      }
    };

    const unsubStore = useGameStore.subscribe((curr, prev) => {
      const currBlocked =
        curr.screen !== 'playing' ||
        curr.activeOverlay !== 'none' ||
        Boolean(curr.activeInscription) ||
        curr.finaleCutscene.active;
      const prevBlocked =
        prev.screen !== 'playing' ||
        prev.activeOverlay !== 'none' ||
        Boolean(prev.activeInscription) ||
        prev.finaleCutscene.active;
      if (currBlocked && !prevBlocked) {
        clearInputs();
      }
    });

    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    window.addEventListener('blur', clearInputs);
    document.addEventListener('visibilitychange', onVisibilityChange);

    return () => {
      unsubStore();
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      window.removeEventListener('blur', clearInputs);
      document.removeEventListener('visibilitychange', onVisibilityChange);
      clearInputs();
    };
  }, []);

  const sampleInput = (out: PlayerInputState): PlayerInputState => {
    const held = heldRef.current;
    const keyForward =
      (held.has('KeyW') || held.has('ArrowUp') ? 1 : 0) -
      (held.has('KeyS') || held.has('ArrowDown') ? 1 : 0);
    const keyRight =
      (held.has('KeyD') || held.has('ArrowRight') ? 1 : 0) -
      (held.has('KeyA') || held.has('ArrowLeft') ? 1 : 0);

    const joyX = virtualJoystickAxis.active ? virtualJoystickAxis.x : 0;
    const joyY = virtualJoystickAxis.active ? virtualJoystickAxis.y : 0;
    const combined = combineMoveInputs(
      keyForward,
      keyRight,
      joyX,
      joyY,
      _combinedAxis,
    );

    out.forward = combined.forward;
    out.right = combined.right;
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
