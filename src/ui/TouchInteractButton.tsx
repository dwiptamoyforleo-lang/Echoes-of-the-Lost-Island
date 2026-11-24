import { memo, useEffect, useRef, useState } from 'react';
import { useGameStore } from '@/src/state/gameStore';
import { useInputMode } from '@/src/systems/inputMode';
import { triggerInteract } from '@/src/systems/interaction';

function TouchInteractButtonInner() {
  const inputMode = useInputMode();
  const screen = useGameStore((s) => s.screen);
  const activeOverlay = useGameStore((s) => s.activeOverlay);
  const activeInscription = useGameStore((s) => s.activeInscription);
  const finaleCutsceneActive = useGameStore((s) => s.finaleCutscene.active);
  const fallFadeActive = useGameStore((s) => s.fallFadeActive);
  const activePrompt = useGameStore((s) => s.activePrompt);

  const [pressed, setPressed] = useState(false);
  const pointerIdRef = useRef<number | null>(null);

  const visible =
    inputMode === 'touch' &&
    screen === 'playing' &&
    activeOverlay === 'none' &&
    !activeInscription &&
    !finaleCutsceneActive &&
    !fallFadeActive;

  const hasInteractable = visible && Boolean(activePrompt);

  useEffect(() => {
    const clearPressed = () => {
      pointerIdRef.current = null;
      setPressed(false);
    };

    if (!visible) {
      clearPressed();
      return;
    }

    const onVisibilityChange = () => {
      if (document.hidden) clearPressed();
    };

    window.addEventListener('blur', clearPressed);
    document.addEventListener('visibilitychange', onVisibilityChange);
    return () => {
      clearPressed();
      window.removeEventListener('blur', clearPressed);
      document.removeEventListener('visibilitychange', onVisibilityChange);
    };
  }, [visible]);

  if (!visible) return null;

  const actionText = hasInteractable
    ? activePrompt?.actionLabel || 'Interact'
    : 'Interact';

  return (
    <button
      type="button"
      data-testid="touch-interact-btn"
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
        if (!hasInteractable || pointerIdRef.current !== null) return;
        pointerIdRef.current = e.pointerId;
        setPressed(true);
        triggerInteract();
        try {
          e.currentTarget.setPointerCapture?.(e.pointerId);
        } catch {
          // Ignore environments where pointer capture rejects synthetic/secondary pointers
        }
      }}
      onPointerUp={(e) => {
        e.preventDefault();
        e.stopPropagation();
        if (pointerIdRef.current === e.pointerId) {
          pointerIdRef.current = null;
          setPressed(false);
        }
      }}
      onPointerCancel={(e) => {
        e.preventDefault();
        e.stopPropagation();
        if (pointerIdRef.current === e.pointerId) {
          pointerIdRef.current = null;
          setPressed(false);
        }
      }}
      onLostPointerCapture={() => {
        pointerIdRef.current = null;
        setPressed(false);
      }}
      className={`pointer-events-auto fixed z-20 flex h-20 w-20 min-h-[72px] min-w-[72px] touch-none flex-col items-center justify-center gap-1 rounded-full border select-none transition-opacity duration-150 ${
        hasInteractable
          ? 'opacity-100 border-[#e7c57c]/90 text-[#fdf3dc]'
          : 'opacity-45 border-[#c79d52]/35 text-[#bfb39a]'
      }`}
      style={{
        bottom: 'calc(env(safe-area-inset-bottom, 0px) + 1.5rem)',
        right: 'calc(env(safe-area-inset-right, 0px) + 1.25rem)',
        background: hasInteractable
          ? 'linear-gradient(165deg, rgba(37, 111, 104, 0.94) 0%, rgba(20, 58, 55, 0.96) 100%)'
          : 'rgba(20, 26, 28, 0.72)',
        boxShadow: hasInteractable
          ? '0 6px 18px rgba(13, 148, 136, 0.36), inset 0 1px 0 rgba(255, 240, 200, 0.28)'
          : '0 4px 12px rgba(0, 0, 0, 0.35)',
        transform: pressed && hasInteractable ? 'scale(0.93)' : 'scale(1)',
        touchAction: 'none',
        userSelect: 'none',
        WebkitUserSelect: 'none',
        WebkitTouchCallout: 'none',
      }}
    >
      {/* Subtle pulsing bronze rune ring when an interactable is in range */}
      {hasInteractable && (
        <span
          aria-hidden="true"
          className="animate-interact-pulse pointer-events-none absolute -inset-1 rounded-full border border-[#2dd4bf]/70"
        />
      )}

      {/* Ancient Rune-Hand SVG Icon (zero external assets) */}
      <svg
        viewBox="0 0 28 28"
        className={`pointer-events-none h-7 w-7 ${
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

      <span className="pointer-events-none max-w-[66px] truncate font-display text-[10px] font-bold tracking-wide uppercase">
        {actionText}
      </span>
    </button>
  );
}

export const TouchInteractButton = memo(TouchInteractButtonInner);
