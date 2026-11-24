import { useGameStore } from '@/src/state/gameStore';
import { GAME_TITLE } from '@/src/config/gameInfo';
import { AmbientDust, RuneCorner, RuneDivider } from './RuneOrnaments';

const CREDIT_SECTIONS = [
  {
    role: 'Design & World Architecture',
    detail: 'Five-island expedition structure from Forgotten Shore and Whispering Woods through the Sunken Kingdom, Frozen Peaks, and Sky Temple.',
  },
  {
    role: 'Procedural 3D & Shaders',
    detail: 'Heightfield geometry, instanced flora, animated water, GLSL aurora borealis, falling snow, drifting cloud seas, and stylized explorer rig.',
  },
  {
    role: 'Physics & Core Systems',
    detail: 'Kinematic Rapier character controller with ice-glide mechanics, chunk streaming, quest state machine, and versioned saves.',
  },
  {
    role: 'Engine & Open-Source Stack',
    detail: 'React, TypeScript, Three.js, React Three Fiber, Drei, Rapier, Zustand, Howler, and Tailwind CSS.',
  },
];

export function CreditsScreen() {
  const screen = useGameStore((state) => state.screen);
  const setScreen = useGameStore((state) => state.setScreen);

  if (screen !== 'credits') return null;

  return (
    <div
      className="pointer-events-auto fixed inset-0 z-30 flex items-center justify-center p-4"
      style={{ backgroundColor: 'rgba(10, 15, 18, 0.78)' }}
      data-testid="credits-screen"
      role="dialog"
      aria-label="Expedition Credits"
    >
      <AmbientDust />

      <div className="stone-panel animate-panel-in relative flex max-h-[90vh] w-full max-w-xl flex-col gap-5 overflow-y-auto rounded-md px-6 py-7 sm:px-9">
        <RuneCorner className="pointer-events-none absolute top-2 left-2" />
        <RuneCorner className="pointer-events-none absolute top-2 right-2 rotate-90" />
        <RuneCorner className="pointer-events-none absolute bottom-2 right-2 rotate-180" />
        <RuneCorner className="pointer-events-none absolute bottom-2 left-2 -rotate-90" />

        <div className="text-center">
          <p className="font-mono text-[11px] tracking-widest text-[#c79d52] uppercase">
            Expedition Chronicle
          </p>
          <h2 className="font-display mt-1 text-2xl font-bold tracking-wide text-[#f7ebd2]">
            {GAME_TITLE}
          </h2>
          <p className="mt-1 text-xs text-[#b8aa8e]">
            Built fully in-browser with procedural geometry and zero external asset dependencies
          </p>
        </div>

        <RuneDivider />

        <div className="parchment-panel flex flex-col gap-3 rounded p-4 sm:p-5">
          {CREDIT_SECTIONS.map((sec) => (
            <div
              key={sec.role}
              className="border-b border-[#8a6a34]/25 pb-2.5 last:border-b-0 last:pb-0"
            >
              <h3 className="font-display text-xs font-bold tracking-wide text-[#5a3b18] uppercase">
                {sec.role}
              </h3>
              <p className="mt-0.5 text-xs leading-relaxed text-[#2b2013]">
                {sec.detail}
              </p>
            </div>
          ))}
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
          <div className="flex gap-2">
            <button
              type="button"
              data-testid="credits-watch-intro"
              onClick={() => setScreen('intro')}
              className="stone-btn rounded px-3 py-2 text-xs font-semibold"
            >
              Watch Intro
            </button>
            <button
              type="button"
              data-testid="credits-watch-ending"
              onClick={() => setScreen('ending')}
              className="stone-btn rounded px-3 py-2 text-xs font-semibold"
            >
              Watch Ending
            </button>
          </div>
          <button
            type="button"
            data-testid="credits-back-btn"
            onClick={() => setScreen('mainMenu')}
            className="bronze-btn rounded px-5 py-2 text-xs font-semibold"
          >
            Back to Menu
          </button>
        </div>
      </div>
    </div>
  );
}
