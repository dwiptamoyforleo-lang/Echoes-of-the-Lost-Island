import { useEffect } from 'react';
import { create } from 'zustand';

export type InputMode = 'keyboard' | 'touch';

export function detectInitialInputMode(): InputMode {
  if (typeof window === 'undefined' || typeof navigator === 'undefined') {
    return 'keyboard';
  }
  const coarse = window.matchMedia?.('(pointer: coarse)').matches ?? false;
  const noHover = window.matchMedia?.('(hover: none)').matches ?? true;
  const hasTouchPoints = (navigator.maxTouchPoints ?? 0) > 0;
  return coarse && noHover && hasTouchPoints ? 'touch' : 'keyboard';
}

interface InputModeState {
  inputMode: InputMode;
  setInputMode: (mode: InputMode) => void;
}

export const useInputModeStore = create<InputModeState>((set) => ({
  inputMode: detectInitialInputMode(),
  setInputMode: (mode) =>
    set((state) => (state.inputMode === mode ? state : { inputMode: mode })),
}));

export function getInputMode(): InputMode {
  return useInputModeStore.getState().inputMode;
}

export function setInputMode(mode: InputMode): void {
  useInputModeStore.getState().setInputMode(mode);
}

let listenerSubscribers = 0;
let listenersAttached = false;

function handleWindowTouchStart() {
  setInputMode('touch');
}

function handleWindowKeyDown(event: KeyboardEvent) {
  if (event.key === 'Unidentified') return;
  setInputMode('keyboard');
}

function attachGlobalInputModeListeners() {
  if (listenersAttached || typeof window === 'undefined') return;
  window.addEventListener('touchstart', handleWindowTouchStart, {
    capture: true,
    passive: true,
  });
  window.addEventListener('keydown', handleWindowKeyDown, {
    capture: true,
    passive: true,
  });
  listenersAttached = true;
}

function detachGlobalInputModeListeners() {
  if (!listenersAttached || typeof window === 'undefined') return;
  window.removeEventListener('touchstart', handleWindowTouchStart, {
    capture: true,
  });
  window.removeEventListener('keydown', handleWindowKeyDown, {
    capture: true,
  });
  listenersAttached = false;
}

/**
 * Subscribes a UI component to the active input mode ('keyboard' | 'touch').
 * Attaches global listeners with reference counting so hybrid devices switch
 * cleanly without leaking listeners or re-rendering the 3D scene.
 */
export function useInputMode(): InputMode {
  const inputMode = useInputModeStore((s) => s.inputMode);

  useEffect(() => {
    listenerSubscribers += 1;
    attachGlobalInputModeListeners();
    return () => {
      listenerSubscribers = Math.max(0, listenerSubscribers - 1);
      if (listenerSubscribers === 0) {
        detachGlobalInputModeListeners();
      }
    };
  }, []);

  return inputMode;
}

const PRESS_E_PREFIX_RE = /^press\s+e\s+to\s+/i;

/**
 * Formats an interact prompt for the active input mode.
 * Ensures "Press E" wording only appears in keyboard mode.
 */
export function getInteractLabel(
  inputMode: InputMode,
  actionName: string,
): string {
  const cleaned = actionName.trim().replace(PRESS_E_PREFIX_RE, '');
  if (!cleaned) {
    return inputMode === 'keyboard' ? 'Press E to Interact' : 'Interact';
  }
  if (inputMode === 'keyboard') {
    return `Press E to ${cleaned}`;
  }
  return cleaned;
}

export function getTutorialInteractToast(inputMode: InputMode): string {
  return inputMode === 'keyboard'
    ? 'Press E near ancient stones, levers, and chests to interact'
    : 'Tap Interact near ancient stones, levers, and chests';
}

export function getDialogueCloseHint(
  inputMode: InputMode,
  finished: boolean,
): string {
  if (finished) {
    return inputMode === 'keyboard'
      ? 'Press E or Esc to close'
      : 'Tap Close to continue';
  }
  return inputMode === 'keyboard'
    ? 'Click text to reveal all'
    : 'Tap text to reveal all';
}
