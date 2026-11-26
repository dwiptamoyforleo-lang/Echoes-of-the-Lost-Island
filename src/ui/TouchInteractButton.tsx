import { memo, useEffect, useRef, useState } from 'react';
import {
  resetVirtualTouchButtons,
  setVirtualJump,
  toggleVirtualSprint,
  useVirtualTouchStore,
} from '@/src/game/player/usePlayerInput';
import { useGameStore } from '@/src/state/gameStore';
import { useInputMode, useViewportLayout } from '@/src/systems/inputMode';
import { triggerInteract } from '@/src/systems/interaction';

function TouchActionClusterInner() {
  const inputMode = useInputMode();
  const { isCompactHeight } = useViewportLayout();
  const screen = useGameStore((s) => s.screen);
  const activeOverlay = useGameStore((s) => s.activeOverlay);
  const activeInscription = useGameStore((s) => s.activeInscription);
  const finaleCutsceneActive = useGameStore((s) => s.finaleCutscene.active);
  const fallFadeActive = useGameStore((s) => s.fallFadeActive);
  const activePrompt = useGameStore((s) => s.activePrompt);
  const sprintActive = useVirtualTouchStore((s) => s.sprintToggle);

  const [interactPressed, setInteractPressed] = useState(false);
  const [jumpPressed, setJumpPressed] = useState(false);

  const interactPointerRef = useRef<number | null>(null);
  const jumpPointerRef = useRef<number | null>(null);

  const visible =
    inputMode === 'touch' &&
    screen === 'playing' &&
    activeOverlay === 'none' &&
    !activeInscription &&
    !finaleCutsceneActive &&
    !fallFadeActive;

  const hasInteractable = visible && Boolean(activePrompt);

  useEffect(() => {
    const clearAll = () => {
      interactPointerRef.current = null;
      jumpPointerRef.current = null;
      setInteractPressed(false);
      setJumpPressed(false);
      setVirtualJump(false);
    };

    if (!visible) {
      clearAll();
      return;
    }

    const onVisibilityChange = () => {
      if (document.hidden) {
        clearAll();
        resetVirtualTouchButtons();
      }
    };
    const onBlur = () => {
      clearAll();
      resetVirtualTouchButtons();
    };

    window.addEventListener('blur', onBlur);
    document.addEventListener('visibilitychange', onVisibilityChange);
    return () => {
      clearAll();
      window.removeEventListener('blur', onBlur);
      document.removeEventListener('visibilitychange', onVisibilityChange);
    };
  }, [visible]);

  if (!visible) return null;

  const actionText = hasInteractable
    ? activePrompt?.actionLabel || 'Interact'
    : 'Interact';

  const bottomBase = isCompactHeight ? '0.85rem' : '1.35rem';
  const interactSize = isCompactHeight ? 64 : 72;
  const jumpSize = isCompactHeight ? 58 : 64;
  const sprintSize = isCompactHeight ? 50 : 54;
  const clusterWidth = interactSize + 12 + jumpSize;
  const clusterHeight = interactSize + 14 + sprintSize;

  return (
    <div
      className="pointer-events-none fixed z-20"
      data-testid="touch-action-cluster"
      style={{
        width: `${clusterWidth}px`,
        height: `${clusterHeight}px`,
        bottom: `calc(env(safe-area-inset-bottom, 0px) + ${bottomBase})`,
        right: 'calc(env(safe-area-inset-right, 0px) + 1rem)',
      }}
    >
      {/* Jump Button (Thumb Arc Left of Interact) */}
      <button
        type="button"
        data-testid="touch-jump-btn"
        data-no-ui-sfx="true"
        aria-label="Jump"
        onContextMenu={(e) => e.preventDefault()}
        onPointerDown={(e) => {
          e.preventDefault();
          e.stopPropagation();
          if (jumpPointerRef.current !== null) return;
          jumpPointerRef.current = e.pointerId;
          setJumpPressed(true);
          setVirtualJump(true);
          try {
            e.currentTarget.setPointerCapture?.(e.pointerId);
          } catch {
            // ignore
          }
        }}
        onPointerUp={(e) => {
          e.preventDefault();
          e.stopPropagation();
          if (jumpPointerRef.current === e.pointerId) {
            jumpPointerRef.current = null;
            setJumpPressed(false);
            setVirtualJump(false);
          }
        }}
        onPointerCancel={(e) => {
          e.preventDefault();
          e.stopPropagation();
          if (jumpPointerRef.current === e.pointerId) {
            jumpPointerRef.current = null;
            setJumpPressed(false);
            setVirtualJump(false);
          }
        }}
        onLostPointerCapture={() => {
          jumpPointerRef.current = null;
          setJumpPressed(false);
          setVirtualJump(false);
        }}
        className="pointer-events-auto absolute bottom-0 left-0 flex touch-none flex-col items-center justify-center gap-0.5 rounded-full border border-[#d6b26a]/70 text-[#f5ebd4] select-none transition-transform duration-100"
        style={{
          width: `${jumpSize}px`,
          height: `${jumpSize}px`,
          background: jumpPressed
            ? 'linear-gradient(165deg, rgba(45, 132, 122, 0.9) 0%, rgba(20, 58, 55, 0.94) 100%)'
            : 'rgba(18, 25, 27, 0.62)',
          boxShadow:
            '0 6px 16px rgba(0, 0, 0, 0.4), inset 0 1px 0 rgba(255, 240, 200, 0.22)',
          transform: jumpPressed ? 'scale(0.92)' : 'scale(1)',
          touchAction: 'none',
          userSelect: 'none',
          WebkitUserSelect: 'none',
          WebkitTouchCallout: 'none',
        }}
      >
        <svg viewBox="0 0 24 24" className="pointer-events-none h-6 w-6 text-[#99f6e4]" aria-hidden="true">
          <path
            d="M12 4.5l5.5 6h-3.4V19h-4.2v-8.5H6.5L12 4.5z"
            fill="currentColor"
            opacity="0.9"
          />
        </svg>
        <span className="pointer-events-none font-display text-[9px] font-bold tracking-wider uppercase">
          Jump
        </span>
      </button>

      {/* Sprint Toggle Button (Above Interact) */}
      <button
        type="button"
        data-testid="touch-sprint-btn"
        data-no-ui-sfx="true"
        aria-label="Toggle Sprint"
        aria-pressed={sprintActive}
        onContextMenu={(e) => e.preventDefault()}
        onPointerDown={(e) => {
          e.preventDefault();
          e.stopPropagation();
          toggleVirtualSprint();
        }}
        className={`pointer-events-auto absolute top-0 flex touch-none flex-col items-center justify-center gap-0.5 rounded-full border select-none transition-all duration-150 ${
          sprintActive
            ? 'border-[#2dd4bf] text-[#ecfeff]'
            : 'border-[#c79d52]/55 text-[#dfd3b8]'
        }`}
        style={{
          width: `${sprintSize}px`,
          height: `${sprintSize}px`,
          right: `${Math.round((interactSize - sprintSize) / 2)}px`,
          background: sprintActive
            ? 'linear-gradient(165deg, rgba(20, 128, 118, 0.92) 0%, rgba(16, 68, 65, 0.94) 100%)'
            : 'rgba(18, 25, 27, 0.56)',
          boxShadow: sprintActive
            ? '0 0 16px rgba(45, 212, 191, 0.45), inset 0 1px 0 rgba(255, 255, 255, 0.25)'
            : '0 4px 12px rgba(0, 0, 0, 0.35)',
          touchAction: 'none',
          userSelect: 'none',
          WebkitUserSelect: 'none',
          WebkitTouchCallout: 'none',
        }}
      >
        <svg viewBox="0 0 24 24" className="pointer-events-none h-5 w-5" aria-hidden="true">
          <path
            d="M4 12h9l-2.5-3.2M6 16h11l-2.2-2.6M9 8h8"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
        <span className="pointer-events-none font-display text-[8.5px] font-bold tracking-wide uppercase">
          {sprintActive ? 'Run' : 'Sprint'}
        </span>
      </button>

      {/* Primary Interact Medallion (Bottom-Right Corner) */}
      <button
        type="button"
        data-testid="touch-interact-btn"
        data-no-ui-sfx="true"
        aria-label={
          hasInteractable && activePrompt
            ? activePrompt.label
            : 'Interact (nothing in range)'
        }
        aria-disabled={!hasInteractable}
        onContextMenu={(e) => e.preventDefault()}
        onPointerDown={(e) => {
          e.preventDefault();
          e.stopPropagation();
          if (!hasInteractable || interactPointerRef.current !== null) return;
          interactPointerRef.current = e.pointerId;
          setInteractPressed(true);
          triggerInteract();
          try {
            e.currentTarget.setPointerCapture?.(e.pointerId);
          } catch {
            // ignore
          }
        }}
        onPointerUp={(e) => {
          e.preventDefault();
          e.stopPropagation();
          if (interactPointerRef.current === e.pointerId) {
            interactPointerRef.current = null;
            setInteractPressed(false);
          }
        }}
        onPointerCancel={(e) => {
          e.preventDefault();
          e.stopPropagation();
          if (interactPointerRef.current === e.pointerId) {
            interactPointerRef.current = null;
            setInteractPressed(false);
          }
        }}
        onLostPointerCapture={() => {
          interactPointerRef.current = null;
          setInteractPressed(false);
        }}
        className={`pointer-events-auto absolute right-0 bottom-0 flex touch-none flex-col items-center justify-center gap-0.5 rounded-full border select-none transition-opacity duration-150 ${
          hasInteractable
            ? 'opacity-100 border-[#e7c57c]/95 text-[#fdf3dc]'
            : 'opacity-45 border-[#c79d52]/40 text-[#bfb39a]'
        }`}
        style={{
          width: `${interactSize}px`,
          height: `${interactSize}px`,
          background: hasInteractable
            ? 'linear-gradient(165deg, rgba(37, 111, 104, 0.94) 0%, rgba(20, 58, 55, 0.96) 100%)'
            : 'rgba(20, 26, 28, 0.6)',
          boxShadow: hasInteractable
            ? '0 6px 18px rgba(13, 148, 136, 0.38), inset 0 1px 0 rgba(255, 240, 200, 0.28)'
            : '0 4px 12px rgba(0, 0, 0, 0.35)',
          transform: interactPressed && hasInteractable ? 'scale(0.92)' : 'scale(1)',
          touchAction: 'none',
          userSelect: 'none',
          WebkitUserSelect: 'none',
          WebkitTouchCallout: 'none',
        }}
      >
        {hasInteractable && (
          <span
            aria-hidden="true"
            className="animate-interact-pulse pointer-events-none absolute -inset-1 rounded-full border border-[#2dd4bf]/75"
          />
        )}

        <svg
          viewBox="0 0 28 28"
          className={`pointer-events-none h-6 w-6 ${
            hasInteractable ? 'text-[#5eead4]' : 'text-[#a6987d]'
          }`}
          aria-hidden="true"
        >
          <path
            d="M14 3.5L16.2 7.4L14 11.3L11.8 7.4L14 3.5Z"
            fill="currentColor"
            opacity={hasInteractable ? 0.95 : 0.45}
          />
          <path
            d="M9.5 14.2V11.2a1.2 1.2 0 1 1 2.4 0v2.6m0-3.3V9.3a1.2 1.2 0 1 1 2.4 0v4.5m0-3.5a1.2 1.2 0 1 1 2.4 0v4.3m0-2.8a1.2 1.2 0 1 1 2.4 0v4.7c0 3.3-2.3 5.8-5.4 5.8h-.7c-2.6 0-4.7-1.9-5-4.4l-.4-2.9a1.2 1.2 0 0 1 2.3-.5l.6 1.6"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.65"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>

        <span className="pointer-events-none max-w-[60px] truncate font-display text-[9px] font-bold tracking-wide uppercase">
          {actionText}
        </span>
      </button>
    </div>
  );
}

export const TouchInteractButton = memo(TouchActionClusterInner);
export const TouchControls = TouchInteractButton;
