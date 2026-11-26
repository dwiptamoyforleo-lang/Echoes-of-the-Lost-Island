import { memo, useEffect, useRef, useState } from 'react';
import {
  resetVirtualJoystickMove,
  setVirtualJoystickMove,
} from '@/src/game/player/usePlayerInput';
import { useGameStore } from '@/src/state/gameStore';
import { useInputMode, useViewportLayout } from '@/src/systems/inputMode';

const MAX_RADIUS_PX = 38;
const DEADZONE = 0.12;

function VirtualJoystickInner() {
  const inputMode = useInputMode();
  const { isCompactHeight } = useViewportLayout();
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
  const [normMagnitude, setNormMagnitude] = useState(0);

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
      setNormMagnitude(0);
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
      setNormMagnitude(0);
      setVirtualJoystickMove(0, 0, true);
      return;
    }

    const rescaled = (normDist - DEADZONE) / (1 - DEADZONE);
    setNormMagnitude(rescaled);
    const dirX = dist > 1e-4 ? dx / Math.min(dist, MAX_RADIUS_PX) : 0;
    const dirY = dist > 1e-4 ? dy / Math.min(dist, MAX_RADIUS_PX) : 0;
    // Screen +Y is down, so forward movement is -dirY
    setVirtualJoystickMove(dirX * rescaled, -dirY * rescaled, true);
  };

  const releaseStick = () => {
    pointerIdRef.current = null;
    setEngaged(false);
    setNormMagnitude(0);
    setKnobOffset({ x: 0, y: 0 });
    resetVirtualJoystickMove();
  };

  const isRunningZone = engaged && normMagnitude >= 0.62;

  return (
    <div
      ref={baseRef}
      data-testid="virtual-joystick"
      data-no-ui-sfx="true"
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
      className={`pointer-events-auto fixed z-20 flex touch-none items-center justify-center rounded-full border select-none transition-colors duration-150 ${
        isCompactHeight ? 'h-24 w-24' : 'h-28 w-28'
      } ${
        isRunningZone
          ? 'border-[#2dd4bf]/80'
          : 'border-[#c79d52]/55'
      }`}
      style={{
        bottom: `calc(env(safe-area-inset-bottom, 0px) + ${isCompactHeight ? '0.85rem' : '1.35rem'})`,
        left: 'calc(env(safe-area-inset-left, 0px) + 1rem)',
        backgroundColor: engaged
          ? 'rgba(18, 26, 28, 0.56)'
          : 'rgba(18, 26, 28, 0.36)',
        boxShadow: isRunningZone
          ? '0 8px 24px rgba(0, 0, 0, 0.42), inset 0 0 22px rgba(45, 212, 191, 0.24)'
          : '0 8px 24px rgba(0, 0, 0, 0.38), inset 0 0 18px rgba(45, 212, 191, 0.12)',
        touchAction: 'none',
        userSelect: 'none',
        WebkitUserSelect: 'none',
        WebkitTouchCallout: 'none',
      }}
    >
      {/* Inner Walk vs Outer Run Threshold Ring */}
      <div className="pointer-events-none absolute inset-2 rounded-full border border-[#c79d52]/25" />
      <div className="pointer-events-none absolute inset-6 rounded-full border border-dashed border-[#c79d52]/20" />
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
        className="pointer-events-none h-11 w-11 rounded-full border border-[#e7c57c]/85"
        style={{
          transform: `translate3d(${knobOffset.x}px, ${knobOffset.y}px, 0)`,
          background: isRunningZone
            ? 'radial-gradient(circle at 35% 30%, rgba(94, 234, 212, 0.85), rgba(23, 76, 71, 0.92))'
            : 'radial-gradient(circle at 35% 30%, rgba(56, 189, 248, 0.68), rgba(23, 76, 71, 0.86))',
          boxShadow: '0 4px 12px rgba(0, 0, 0, 0.45)',
        }}
      />
    </div>
  );
}

export const VirtualJoystick = memo(VirtualJoystickInner);
