import { useGameStore } from '@/src/state/gameStore';
import { ANCIENT_FRAGMENTS } from '@/src/systems/inventorySystem';
import { getLevelMetadata, type LevelId } from '@/src/systems/progressionSystem';
import { FragmentEmblem, RuneCorner, RuneDivider } from './RuneOrnaments';

export function StatusOverlay() {
  const screen = useGameStore((state) => state.screen);
  const activeLevel = useGameStore((state) => state.activeLevel);
  const crystals = useGameStore((state) => state.crystals);
  const totalCrystals = useGameStore((state) => state.totalCrystals);
  const progression = useGameStore((state) => state.progression);
  const quests = useGameStore((state) => state.quests);
  const levelElapsedSeconds = useGameStore(
    (state) => state.levelElapsedSeconds,
  );
  const recoveredFragmentName = useGameStore(
    (state) => state.recoveredFragmentName,
  );
  const setScreen = useGameStore((state) => state.setScreen);
  const startLevel = useGameStore((state) => state.startLevel);
  const saveCurrentGame = useGameStore((state) => state.saveCurrentGame);
  const openSettings = useGameStore((state) => state.openSettings);
  const showToast = useGameStore((state) => state.showToast);

  if (screen !== 'paused' && screen !== 'levelComplete') {
    return null;
  }

  const levelId: LevelId =
    activeLevel === 'testArena' ? 'level1' : activeLevel;
  const levelMeta = getLevelMetadata(levelId);
  const levelProg = progression[levelId];
  const levelQuests = quests[levelId] ?? [];
  const completedObjectives = levelQuests.filter((q) => q.completed).length;
  const fragmentDef = ANCIENT_FRAGMENTS.find(
    (f) => f.id === levelMeta.fragmentId,
  );
  const nextMeta = levelMeta.nextLevelId
    ? getLevelMetadata(levelMeta.nextLevelId)
    : null;

  return (
    <div
      className="pointer-events-auto fixed inset-0 z-20 flex items-center justify-center p-4"
      style={{ backgroundColor: 'rgba(10, 16, 18, 0.68)' }}
    >
      {screen === 'paused' && (
        <div
          className="stone-panel animate-panel-in relative flex w-full max-w-xs flex-col items-center gap-3 rounded-md px-7 py-6 text-center"
          role="dialog"
          aria-label="Game Paused"
          data-testid="pause-menu"
        >
          <RuneCorner className="pointer-events-none absolute top-1.5 left-1.5" />
          <RuneCorner className="pointer-events-none absolute top-1.5 right-1.5 rotate-90" />

          <h2 className="font-display text-xl font-bold tracking-wide text-[#f7ebd2]">
            Paused
          </h2>
          <p className="text-xs text-[#b8aa8e]">
            Press Escape to resume exploration
          </p>

          <RuneDivider className="w-full" />

          <div className="flex w-full flex-col gap-2">
            <button
              type="button"
              onClick={(e) => {
                e.currentTarget.blur();
                setScreen('playing');
              }}
              className="bronze-btn w-full rounded px-4 py-2.5 text-xs font-semibold"
            >
              Resume
            </button>
            <button
              type="button"
              onClick={(e) => {
                e.currentTarget.blur();
                startLevel(activeLevel);
              }}
              className="stone-btn w-full rounded px-4 py-2 text-xs font-semibold"
            >
              Restart Level
            </button>
            <button
              type="button"
              data-testid="pause-settings-btn"
              onClick={(e) => {
                e.currentTarget.blur();
                openSettings('paused');
              }}
              className="stone-btn w-full rounded px-4 py-2 text-xs font-semibold"
            >
              Settings
            </button>
            <button
              type="button"
              data-testid="btn-manual-save"
              onClick={(e) => {
                e.currentTarget.blur();
                saveCurrentGame(true);
              }}
              className="stone-btn w-full rounded px-4 py-2 text-xs font-semibold text-amber-200"
            >
              Save Game
            </button>
            <button
              type="button"
              onClick={(e) => {
                e.currentTarget.blur();
                setScreen('mainMenu');
              }}
              className="stone-btn w-full rounded px-4 py-2 text-xs font-medium"
            >
              Main Menu
            </button>
          </div>
        </div>
      )}

      {screen === 'levelComplete' && (
        <div
          className="stone-panel animate-panel-in relative flex w-full max-w-md flex-col items-center gap-4 rounded-md px-7 py-7 text-center"
          role="dialog"
          aria-label="Level Complete"
          data-testid="level-complete-screen"
        >
          <RuneCorner className="pointer-events-none absolute top-1.5 left-1.5" />
          <RuneCorner className="pointer-events-none absolute top-1.5 right-1.5 rotate-90" />
          <RuneCorner className="pointer-events-none absolute bottom-1.5 right-1.5 rotate-180" />
          <RuneCorner className="pointer-events-none absolute bottom-1.5 left-1.5 -rotate-90" />

          <FragmentEmblem
            recovered
            size="lg"
            label={recoveredFragmentName ?? levelMeta.fragmentName}
          />

          <div>
            <p className="font-mono text-xs text-[#c79d52]">
              Level {levelMeta.order} Complete
            </p>
            <h2 className="font-display mt-0.5 text-2xl font-bold text-[#f7ebd2]">
              {levelMeta.name}
            </h2>
          </div>

          <p className="text-sm text-[#e6dac0]">
            Fragment Recovered:{' '}
            <span className="font-semibold text-teal-300">
              {recoveredFragmentName ?? levelMeta.fragmentName}
            </span>
          </p>

          {fragmentDef?.loreText && (
            <div className="parchment-panel rounded px-4 py-2.5 text-xs italic leading-relaxed">
              “{fragmentDef.loreText}”
            </div>
          )}

          <div className="grid w-full grid-cols-3 gap-2 border-y border-[#c79d52]/25 py-3 font-mono text-xs tabular-nums">
            <div>
              <span className="block text-[10px] text-[#a5977c]">
                Objectives
              </span>
              <span className="font-semibold text-emerald-300">
                {completedObjectives} / {levelQuests.length}
              </span>
            </div>
            <div>
              <span className="block text-[10px] text-[#a5977c]">Crystals</span>
              <span className="font-semibold text-sky-300">
                {crystals} / {totalCrystals}
              </span>
            </div>
            <div>
              <span className="block text-[10px] text-[#a5977c]">Time</span>
              <span className="font-semibold text-[#f3e7cf]">
                {levelElapsedSeconds.toFixed(1)}s
              </span>
            </div>
          </div>

          <div className="flex w-full flex-col gap-2">
            <button
              type="button"
              data-testid="level-complete-next"
              onClick={(e) => {
                e.currentTarget.blur();
                if (levelId === 'level5' || !levelMeta.nextLevelId) {
                  setScreen('ending');
                } else {
                  if (nextMeta) {
                    showToast(`Embarking to ${nextMeta.name}`, 'objective');
                  }
                  startLevel(levelMeta.nextLevelId);
                }
              }}
              className="bronze-btn w-full rounded px-4 py-2.5 text-xs font-semibold"
            >
              {levelId === 'level5'
                ? 'Continue to Ending'
                : `Next Level${nextMeta ? `: ${nextMeta.name}` : ''}`}
            </button>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                data-start="true"
                onClick={(e) => {
                  e.currentTarget.blur();
                  startLevel(levelId);
                }}
                className="stone-btn rounded px-4 py-2 text-xs font-semibold"
              >
                Replay
              </button>
              <button
                type="button"
                onClick={(e) => {
                  e.currentTarget.blur();
                  setScreen('worldMap');
                }}
                className="stone-btn rounded px-4 py-2 text-xs font-semibold"
              >
                World Map
              </button>
            </div>
          </div>

          {levelProg.bestTimeSeconds !== null && (
            <p className="font-mono text-[11px] text-[#a5977c] tabular-nums">
              Best Time: {levelProg.bestTimeSeconds.toFixed(1)}s
            </p>
          )}
        </div>
      )}
    </div>
  );
}
