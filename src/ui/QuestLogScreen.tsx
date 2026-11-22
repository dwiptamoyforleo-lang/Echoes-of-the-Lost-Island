import { useState } from 'react';
import { useGameStore } from '@/src/state/gameStore';
import { LEVEL_CATALOG, type LevelId } from '@/src/systems/progressionSystem';
import { RuneCorner, RuneDivider } from './RuneOrnaments';

export function QuestLogScreen() {
  const activeOverlay = useGameStore((s) => s.activeOverlay);
  const setActiveOverlay = useGameStore((s) => s.setActiveOverlay);
  const activeLevel = useGameStore((s) => s.activeLevel);
  const quests = useGameStore((s) => s.quests);
  const progression = useGameStore((s) => s.progression);

  const [selectedLevel, setSelectedLevel] = useState<LevelId>(
    activeLevel === 'testArena' ? 'level1' : activeLevel,
  );

  if (activeOverlay !== 'quests') return null;

  const list = quests[selectedLevel] ?? [];
  const mainObjectives = list.filter((q) => q.type === 'main');
  const optionalObjectives = list.filter((q) => q.type === 'optional');

  return (
    <div
      className="pointer-events-auto fixed inset-0 z-30 flex items-center justify-center p-3 sm:p-6"
      style={{ backgroundColor: 'rgba(10, 16, 18, 0.78)' }}
      data-testid="quest-log-screen"
    >
      <div
        className="stone-panel animate-panel-in relative flex max-h-[86vh] w-full max-w-2xl flex-col overflow-hidden rounded-md p-5 sm:p-6"
        role="dialog"
        aria-label="Quest Log"
      >
        <RuneCorner className="pointer-events-none absolute top-1.5 left-1.5" />
        <RuneCorner className="pointer-events-none absolute top-1.5 right-1.5 rotate-90" />

        <div className="mb-3 flex items-center justify-between gap-3">
          <div>
            <h2 className="font-display text-xl font-bold text-[#f7ebd2]">
              Expedition Quest Log
            </h2>
            <p className="text-xs text-[#b8aa8e]">
              Main and optional objectives · Press J or Esc to close
            </p>
          </div>
          <button
            type="button"
            onClick={(e) => {
              e.currentTarget.blur();
              setActiveOverlay('none');
            }}
            className="stone-btn rounded px-3.5 py-1.5 text-xs font-semibold"
          >
            Close
          </button>
        </div>

        <div className="mb-4 flex flex-wrap gap-1.5 border-b border-[#c79d52]/25 pb-3">
          {LEVEL_CATALOG.map((meta) => {
            const unlocked = progression[meta.id]?.unlocked;
            return (
              <button
                key={meta.id}
                type="button"
                disabled={!unlocked}
                onClick={() => setSelectedLevel(meta.id)}
                className={`rounded px-3 py-1.5 text-xs font-semibold transition-colors ${
                  selectedLevel === meta.id
                    ? 'bronze-btn'
                    : 'stone-btn disabled:opacity-40'
                }`}
              >
                {meta.order}. {meta.name}
              </button>
            );
          })}
        </div>

        <div className="flex flex-col gap-5 overflow-y-auto pr-1">
          <section>
            <h3 className="mb-2 font-display text-xs font-bold tracking-wider text-teal-300">
              Main Objectives
            </h3>
            <div className="flex flex-col gap-2">
              {mainObjectives.map((q) => {
                const pct = Math.min(100, Math.round((q.current / q.target) * 100));
                return (
                  <div
                    key={q.id}
                    className="rounded border border-[#c79d52]/25 bg-[#13191b]/90 px-4 py-3"
                  >
                    <div className="flex items-center justify-between gap-3 text-xs">
                      <span
                        className={
                          q.completed
                            ? 'text-[#8e826b] line-through'
                            : 'font-semibold text-[#f3e7cf]'
                        }
                      >
                        {q.description}
                      </span>
                      <span
                        className={`font-mono font-semibold tabular-nums ${
                          q.completed ? 'text-emerald-300' : 'text-teal-300'
                        }`}
                      >
                        {q.completed ? 'Complete' : `${q.current} / ${q.target}`}
                      </span>
                    </div>
                    <div className="mt-2 h-1.5 w-full overflow-hidden rounded-sm bg-[#0c1012]">
                      <div
                        className="h-full bg-teal-400"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </section>

          <RuneDivider />

          <section>
            <h3 className="mb-2 font-display text-xs font-bold tracking-wider text-amber-300">
              Optional Objectives
            </h3>
            <div className="flex flex-col gap-2">
              {optionalObjectives.map((q) => {
                const pct = Math.min(100, Math.round((q.current / q.target) * 100));
                return (
                  <div
                    key={q.id}
                    className="rounded border border-[#c79d52]/25 bg-[#13191b]/90 px-4 py-3"
                  >
                    <div className="flex items-center justify-between gap-3 text-xs">
                      <span
                        className={
                          q.completed
                            ? 'text-[#8e826b] line-through'
                            : 'font-semibold text-[#f3e7cf]'
                        }
                      >
                        {q.description}
                      </span>
                      <span
                        className={`font-mono font-semibold tabular-nums ${
                          q.completed ? 'text-emerald-300' : 'text-amber-300'
                        }`}
                      >
                        {q.completed ? 'Complete' : `${q.current} / ${q.target}`}
                      </span>
                    </div>
                    <div className="mt-2 h-1.5 w-full overflow-hidden rounded-sm bg-[#0c1012]">
                      <div
                        className="h-full bg-amber-400"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
