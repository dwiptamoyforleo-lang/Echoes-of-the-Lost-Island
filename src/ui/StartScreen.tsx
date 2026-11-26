import { useEffect, useState } from 'react';
import { GAME_TAGLINE, GAME_TITLE } from '@/src/config/gameInfo';
import { useGameStore } from '@/src/state/gameStore';
import { useInputMode, useViewportLayout } from '@/src/systems/inputMode';
import { AmbientDust, RuneCorner, RuneDivider } from './RuneOrnaments';

export function StartScreen() {
  const inputMode = useInputMode();
  const { isCompactHeight } = useViewportLayout();
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
      className="pointer-events-auto fixed inset-0 z-20 flex items-center justify-center p-3 sm:p-8"
      style={{
        background:
          'radial-gradient(circle at 50% 45%, rgba(12, 22, 26, 0.25) 0%, rgba(10, 16, 19, 0.72) 100%)',
        paddingTop: 'max(0.75rem, env(safe-area-inset-top, 0px))',
        paddingBottom: 'max(0.75rem, env(safe-area-inset-bottom, 0px))',
        paddingLeft: 'max(0.75rem, env(safe-area-inset-left, 0px))',
        paddingRight: 'max(0.75rem, env(safe-area-inset-right, 0px))',
      }}
      data-testid="start-screen"
    >
      <AmbientDust />

      <div
        className={`stone-panel animate-panel-in relative flex max-h-[94dvh] w-full max-w-lg flex-col items-center overflow-y-auto rounded-md text-center ${
          isCompactHeight ? 'gap-2.5 px-5 py-4' : 'gap-4 px-5 py-6 sm:gap-5 sm:px-10 sm:py-9'
        }`}
      >
        <RuneCorner className="pointer-events-none absolute top-2 left-2" />
        <RuneCorner className="pointer-events-none absolute top-2 right-2 rotate-90" />
        <RuneCorner className="pointer-events-none absolute bottom-2 right-2 rotate-180" />
        <RuneCorner className="pointer-events-none absolute bottom-2 left-2 -rotate-90" />

        <div className="flex flex-col items-center gap-1.5 sm:gap-2">
          {!isCompactHeight && (
            <svg
              viewBox="0 0 48 48"
              className="h-10 w-10 text-teal-300 sm:h-12 sm:w-12"
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
          )}
          <h1 className="font-display text-xl font-bold tracking-wider text-[#f7ebd2] sm:text-3xl">
            {GAME_TITLE}
          </h1>
          <p className="max-w-sm text-[11px] leading-relaxed tracking-wide text-[#d9af62] sm:text-xs">
            {GAME_TAGLINE}
          </p>
          {!isCompactHeight && (
            <p className="max-w-sm text-xs leading-relaxed text-[#cfc3aa] sm:text-sm">
              Chart the forgotten coast, rekindle the ancient seals, and recover the five resonant fragments.
            </p>
          )}
        </div>

        <RuneDivider className="w-full" />

        {saveCorruptedNotice && (
          <p className="w-full rounded border border-amber-400/40 bg-amber-950/60 px-3 py-2 text-xs text-amber-200">
            Previous save data was unreadable and has been restored to defaults.
          </p>
        )}

        {hasSavedGame && (
          <div className="w-full border-y border-[#c79d52]/25 py-1.5 font-mono text-[11px] text-[#dfd3b8] tabular-nums sm:py-2 sm:text-xs">
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
            <div className="flex flex-col gap-2 sm:flex-row sm:gap-2.5">
              <button
                type="button"
                data-testid="confirm-overwrite-btn"
                onClick={(e) => {
                  e.currentTarget.blur();
                  setConfirmNewGame(false);
                  beginNewGameWithIntro();
                }}
                className="bronze-btn min-h-[44px] flex-1 rounded px-4 py-2.5 font-semibold"
              >
                Confirm New Game
              </button>
              <button
                type="button"
                onClick={() => setConfirmNewGame(false)}
                className="stone-btn min-h-[44px] flex-1 rounded px-4 py-2.5 font-medium"
              >
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <nav
            className="flex w-full flex-col gap-2 sm:gap-2.5"
            aria-label="Main Menu Actions"
          >
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-1">
              <button
                type="button"
                disabled={!hasSavedGame}
                data-testid="btn-continue"
                onClick={(e) => {
                  e.currentTarget.blur();
                  continueSavedGame();
                }}
                className="bronze-btn min-h-[44px] w-full rounded px-5 py-2.5 text-sm font-semibold tracking-wide sm:py-3"
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
                className="stone-btn min-h-[44px] w-full rounded px-5 py-2.5 text-sm font-semibold tracking-wide"
              >
                New Game
              </button>
            </div>

            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                data-testid="btn-world-map"
                onClick={(e) => {
                  e.currentTarget.blur();
                  setScreen('worldMap');
                }}
                className="stone-btn min-h-[44px] rounded px-2 py-2.5 text-xs font-semibold sm:px-3"
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
                className="stone-btn min-h-[44px] rounded px-2 py-2.5 text-xs font-semibold sm:px-3"
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
                className="stone-btn min-h-[44px] rounded px-2 py-2.5 text-xs font-semibold sm:px-3"
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
              className="mt-0.5 min-h-[36px] text-xs font-medium text-[#b5a78b] underline-offset-4 transition-colors hover:text-[#f3e7cf] hover:underline"
            >
              Movement Test Arena
            </button>
          </nav>
        )}

        <p className="text-center text-[11px] text-[#a99b80]">
          {inputMode === 'touch'
            ? 'Left Stick Move · Right Half Look · Touch Jump, Sprint & Interact'
            : 'WASD Move · Shift Sprint · Space Jump · E Interact'}
        </p>
      </div>
    </div>
  );
}
