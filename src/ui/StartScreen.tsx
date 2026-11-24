import { useEffect, useState } from 'react';
import { GAME_TAGLINE, GAME_TITLE } from '@/src/config/gameInfo';
import { useGameStore } from '@/src/state/gameStore';
import { AmbientDust, RuneCorner, RuneDivider } from './RuneOrnaments';

export function StartScreen() {
  const screen = useGameStore((state) => state.screen);
  const hasSavedGame = useGameStore((state) => state.hasSavedGame);
  const saveCorruptedNotice = useGameStore((state) => state.saveCorruptedNotice);
  const progression = useGameStore((state) => state.progression);
  const recoveredFragments = useGameStore((state) => state.recoveredFragments);
  const startLevel = useGameStore((state) => state.startLevel);
  const continueSavedGame = useGameStore((state) => state.continueSavedGame);
  const beginNewGameWithIntro = useGameStore(
    (state) => state.beginNewGameWithIntro,
  );
  const openSettings = useGameStore((state) => state.openSettings);
  const setScreen = useGameStore((state) => state.setScreen);

  const [confirmNewGame, setConfirmNewGame] = useState(false);

  useEffect(() => {
    if (screen !== 'mainMenu') {
      setConfirmNewGame(false);
    }
  }, [screen]);

  if (screen !== 'mainMenu') return null;

  const l1 = progression.level1;

  return (
    <div
      className="pointer-events-auto fixed inset-0 z-20 flex items-center justify-center p-4 sm:p-8"
      style={{
        background:
          'radial-gradient(circle at 50% 45%, rgba(12, 22, 26, 0.25) 0%, rgba(10, 16, 19, 0.72) 100%)',
      }}
      data-testid="start-screen"
    >
      <AmbientDust />

      <div className="stone-panel animate-panel-in relative flex w-full max-w-lg flex-col items-center gap-5 rounded-md px-6 py-7 text-center sm:px-10 sm:py-9">
        <RuneCorner className="absolute top-2 left-2" />
        <RuneCorner className="absolute top-2 right-2 rotate-90" />
        <RuneCorner className="absolute bottom-2 right-2 rotate-180" />
        <RuneCorner className="absolute bottom-2 left-2 -rotate-90" />

        <div className="flex flex-col items-center gap-2">
          <svg
            viewBox="0 0 48 48"
            className="h-12 w-12 text-teal-300"
            aria-hidden="true"
          >
            <polygon
              points="24,4 40,24 24,44 8,24"
              fill="currentColor"
              fillOpacity="0.18"
              stroke="#c79d52"
              strokeWidth="2"
            />
            <polygon points="24,12 32,24 24,36 16,24" fill="currentColor" />
          </svg>
          <h1 className="font-display text-2xl font-bold tracking-wider text-[#f7ebd2] sm:text-3xl">
            {GAME_TITLE}
          </h1>
          <p className="max-w-sm text-[11px] leading-relaxed tracking-wide text-[#d9af62] sm:text-xs">
            {GAME_TAGLINE}
          </p>
          <p className="max-w-sm text-xs leading-relaxed text-[#cfc3aa] sm:text-sm">
            Chart the forgotten coast, rekindle the ancient seals, and recover the five resonant fragments.
          </p>
        </div>

        <RuneDivider className="w-full" />

        {saveCorruptedNotice && (
          <p className="w-full rounded border border-amber-400/40 bg-amber-950/60 px-3 py-2 text-xs text-amber-200">
            Previous save data was unreadable and has been restored to defaults.
          </p>
        )}

        {hasSavedGame && (
          <div className="w-full border-y border-[#c79d52]/25 py-2 font-mono text-xs text-[#dfd3b8] tabular-nums">
            Saved Expedition · Crystals {l1.crystalsCollected}/{l1.totalCrystals} · Fragments {recoveredFragments.length}/5
          </div>
        )}

        {confirmNewGame ? (
          <div
            className="flex w-full flex-col gap-3 rounded border border-amber-400/35 bg-[#121719]/90 p-4 text-xs"
            data-testid="save-confirm-dialog"
          >
            <p className="font-medium text-[#f3e7cf]">
              Begin a new expedition? Your saved progress will be erased.
            </p>
            <div className="flex gap-2.5">
              <button
                type="button"
                data-testid="confirm-overwrite-btn"
                onClick={(e) => {
                  e.currentTarget.blur();
                  setConfirmNewGame(false);
                  beginNewGameWithIntro();
                }}
                className="bronze-btn flex-1 rounded px-4 py-2.5 font-semibold"
              >
                Confirm New Game
              </button>
              <button
                type="button"
                onClick={() => setConfirmNewGame(false)}
                className="stone-btn flex-1 rounded px-4 py-2.5 font-medium"
              >
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <nav
            className="flex w-full flex-col gap-2.5"
            aria-label="Main Menu Actions"
          >
            <button
              type="button"
              disabled={!hasSavedGame}
              data-testid="btn-continue"
              onClick={(e) => {
                e.currentTarget.blur();
                continueSavedGame();
              }}
              className="bronze-btn w-full rounded px-5 py-3 text-sm font-semibold tracking-wide"
            >
              Continue
            </button>

            <button
              type="button"
              data-start="true"
              data-testid="btn-new-game"
              onClick={(e) => {
                e.currentTarget.blur();
                if (hasSavedGame) {
                  setConfirmNewGame(true);
                } else {
                  beginNewGameWithIntro();
                }
              }}
              className="stone-btn w-full rounded px-5 py-2.5 text-sm font-semibold tracking-wide"
            >
              New Game
            </button>

            <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
              <button
                type="button"
                data-testid="btn-world-map"
                onClick={(e) => {
                  e.currentTarget.blur();
                  setScreen('worldMap');
                }}
                className="stone-btn rounded px-3 py-2.5 text-xs font-semibold"
              >
                World Map
              </button>
              <button
                type="button"
                data-testid="btn-settings"
                onClick={(e) => {
                  e.currentTarget.blur();
                  openSettings('mainMenu');
                }}
                className="stone-btn rounded px-3 py-2.5 text-xs font-semibold"
              >
                Settings
              </button>
              <button
                type="button"
                data-testid="btn-credits"
                onClick={(e) => {
                  e.currentTarget.blur();
                  setScreen('credits');
                }}
                className="stone-btn rounded px-3 py-2.5 text-xs font-semibold"
              >
                Credits
              </button>
            </div>

            <button
              type="button"
              data-testid="btn-test-arena"
              onClick={(e) => {
                e.currentTarget.blur();
                startLevel('testArena');
              }}
              className="mt-1 text-xs font-medium text-[#b5a78b] underline-offset-4 transition-colors hover:text-[#f3e7cf] hover:underline"
            >
              Movement Test Arena
            </button>
          </nav>
        )}

        <p className="whitespace-nowrap text-[11px] text-[#a99b80]">
          WASD Move · Shift Sprint · Space Jump · E Interact
        </p>
      </div>
    </div>
  );
}
