import { useGameStore } from '@/src/state/gameStore';
import { GAME_TAGLINE, GAME_TITLE } from '@/src/config/gameInfo';
import { RuneCorner, RuneDivider } from './RuneOrnaments';

export function LoadingOverlay() {
  const levelLoading = useGameStore((state) => state.levelLoading);
  const loadingTitle = useGameStore((state) => state.loadingTitle);

  if (!levelLoading) return null;

  return (
    <div
      className="pointer-events-auto fixed inset-0 z-40 flex items-center justify-center p-4"
      style={{ backgroundColor: 'rgba(10, 15, 18, 0.92)' }}
      data-testid="loading-overlay"
      role="status"
      aria-live="polite"
      aria-label={`Loading ${loadingTitle}`}
    >
      <div className="stone-panel animate-panel-in relative flex w-full max-w-sm flex-col items-center gap-4 rounded-md px-7 py-8 text-center">
        <RuneCorner className="pointer-events-none absolute top-2 left-2" />
        <RuneCorner className="pointer-events-none absolute top-2 right-2 rotate-90" />
        <RuneCorner className="pointer-events-none absolute bottom-2 right-2 rotate-180" />
        <RuneCorner className="pointer-events-none absolute bottom-2 left-2 -rotate-90" />

        <svg
          viewBox="0 0 64 64"
          className="animate-rune-spin h-14 w-14 text-[#c79d52]"
          aria-hidden="true"
        >
          <circle
            cx="32"
            cy="32"
            r="26"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeDasharray="8 5"
          />
          <polygon
            points="32,10 46,32 32,54 18,32"
            fill="none"
            stroke="#2dd4bf"
            strokeWidth="1.8"
          />
          <circle cx="32" cy="32" r="5" fill="#2dd4bf" />
        </svg>

        <div>
          <p className="font-display text-xs font-bold tracking-widest text-[#f7ebd2]">{GAME_TITLE}</p>
          <p className="mt-1 text-[10px] text-[#b8aa8e]">{GAME_TAGLINE}</p>
          <p className="mt-3 font-mono text-[11px] tracking-widest text-[#c79d52] uppercase">
            Charting Horizon
          </p>
          <h2 className="font-display mt-1 text-lg font-bold text-[#f7ebd2]">
            {loadingTitle}
          </h2>
        </div>

        <RuneDivider className="w-full" />

        <p className="text-xs text-[#b8aa8e]">
          Aligning stone seals and coastal currents...
        </p>
      </div>
    </div>
  );
}
