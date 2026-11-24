import { memo, useEffect, useRef, useState } from 'react';
import {
  resetVirtualJoystickMove,
  setVirtualJoystickMove,
} from '@/src/game/player/usePlayerInput';
import { useGameStore } from '@/src/state/gameStore';
import { useInputMode } from '@/src/systems/inputMode';

const MAX_RADIUS_PX = 38;
const DEADZONE = 0.12;

function VirtualJoystickInner() {
  const inputMode = useInputMode();
  const screen = useGameStore((s) => s.screen);
  const activeOverlay = useGameStore((s) => s.activeOverlay);
  const activeInscription = useGameStore((s) => s.activeInscription);
  const finaleCutsceneActive = useGameStore((s) => s.finaleCutscene.active);
  const fallFadeActive = useGameStore((s) => s.fallFadeActive);

  const [knobOffset, setKnobOffset] = useState<{ x: number; y: number }>({
    x: 0,
    y: 0,
  });
  const [engaged, setEngaged] = useState(false);

  const baseRef = useRef<HTMLDivElement>(null);
  const pointerIdRef = useRef<number | null>(null);

  const active =
    inputMode === 'touch' &&
    screen === 'playing' &&
    activeOverlay === 'none' &&
    !activeInscription &&
    !finaleCutsceneActive &&
    !fallFadeActive;

  useEffect(() => {
    if (!active) {
      pointerIdRef.current = null;
      setEngaged(false);
      setKnobOffset({ x: 0, y: 0 });
      resetVirtualJoystickMove();
    }
    return () => {
      resetVirtualJoystickMove();
    };
  }, [active]);

  if (!active) return null;

  const updateStickFromPoint = (clientX: number, clientY: number) => {
    const el = baseRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const cx = rect.left + rect.width * 0.5;
    const cy = rect.top + rect.height * 0.5;

    let dx = clientX - cx;
    let dy = clientY - cy;
    const dist = Math.hypot(dx, dy);

    if (dist > MAX_RADIUS_PX) {
      const scale = MAX_RADIUS_PX / dist;
      dx *= scale;
      dy *= scale;
    }

    setKnobOffset({ x: dx, y: dy });

    const normDist = Math.min(1, dist / MAX_RADIUS_PX);
    if (normDist < DEADZONE) {
      setVirtualJoystickMove(0, 0, true);
      return;
    }

    const rescaled = (normDist - DEADZONE) / (1 - DEADZONE);
    const dirX = dist > 1e-4 ? dx / Math.min(dist, MAX_RADIUS_PX) : 0;
    const dirY = dist > 1e-4 ? dy / Math.min(dist, MAX_RADIUS_PX) : 0;
    // Screen +Y is down, so forward movement is -dirY
    setVirtualJoystickMove(dirX * rescaled, -dirY * rescaled, true);
  };

  const releaseStick = () => {
    pointerIdRef.current = null;
    setEngaged(false);
    setKnobOffset({ x: 0, y: 0 });
    resetVirtualJoystickMove();
  };

  return (
    <div
      ref={baseRef}
      data-testid="virtual-joystick"
      aria-label="Movement Joystick"
      role="application"
      onContextMenu={(e) => e.preventDefault()}
      onPointerDown={(e) => {
        if (pointerIdRef.current !== null) return;
        e.preventDefault();
        e.stopPropagation();
        pointerIdRef.current = e.pointerId;
        try {
          e.currentTarget.setPointerCapture?.(e.pointerId);
        } catch {
          // Ignore environments where pointer capture is unavailable
        }
        setEngaged(true);
        updateStickFromPoint(e.clientX, e.clientY);
      }}
      onPointerMove={(e) => {
        if (pointerIdRef.current !== e.pointerId) return;
        e.preventDefault();
        e.stopPropagation();
        updateStickFromPoint(e.clientX, e.clientY);
      }}
      onPointerUp={(e) => {
        if (pointerIdRef.current !== e.pointerId) return;
        e.preventDefault();
        e.stopPropagation();
        releaseStick();
      }}
      onPointerCancel={(e) => {
        if (pointerIdRef.current !== e.pointerId) return;
        e.preventDefault();
        releaseStick();
      }}
      onLostPointerCapture={() => {
        if (pointerIdRef.current !== null) {
          releaseStick();
        }
      }}
      className="pointer-events-auto fixed z-20 flex h-28 w-28 touch-none items-center justify-center rounded-full border border-[#c79d52]/55 select-none"
      style={{
        bottom: 'calc(env(safe-area-inset-bottom, 0px) + 1.5rem)',
        left: 'calc(env(safe-area-inset-left, 0px) + 1.25rem)',
        backgroundColor: engaged
          ? 'rgba(18, 26, 28, 0.58)'
          : 'rgba(18, 26, 28, 0.42)',
        boxShadow:
          '0 8px 24px rgba(0, 0, 0, 0.4), inset 0 0 18px rgba(45, 212, 191, 0.14)',
        touchAction: 'none',
        userSelect: 'none',
        WebkitUserSelect: 'none',
        WebkitTouchCallout: 'none',
      }}
    >
      {/* Directional rune ticks */}
      <div className="pointer-events-none absolute inset-2 rounded-full border border-[#c79d52]/25" />
      <span className="pointer-events-none absolute top-1.5 text-[9px] font-bold text-[#d9bf8e]/70">
        ▲
      </span>
      <span className="pointer-events-none absolute bottom-1.5 text-[9px] font-bold text-[#d9bf8e]/70">
        ▼
      </span>
      <span className="pointer-events-none absolute left-2 text-[9px] font-bold text-[#d9bf8e]/70">
        ◀
      </span>
      <span className="pointer-events-none absolute right-2 text-[9px] font-bold text-[#d9bf8e]/70">
        ▶
      </span>

      {/* Thumb Knob */}
      <div
        data-testid="virtual-joystick-knob"
        className="pointer-events-none h-11 w-11 rounded-full border border-[#e7c57c]/80"
        style={{
          transform: `translate3d(${knobOffset.x}px, ${knobOffset.y}px, 0)`,
          background:
            'radial-gradient(circle at 35% 30%, rgba(56, 189, 248, 0.72), rgba(23, 76, 71, 0.88))',
          boxShadow: '0 4px 12px rgba(0, 0, 0, 0.45)',
        }}
      />
    </div>
  );
}

export const VirtualJoystick = memo(VirtualJoystickInner);
