import { useGameStore } from '@/src/state/gameStore';
import { LEVEL_CATALOG } from '@/src/systems/progressionSystem';

export function SystemsDebugPanel() {
  const visible = useGameStore((s) => s.systemsDebugVisible);
  const toggleSystemsDebug = useGameStore((s) => s.toggleSystemsDebug);
  const progression = useGameStore((s) => s.progression);
  const inventoryItems = useGameStore((s) => s.inventoryItems);
  const hasSavedGame = useGameStore((s) => s.hasSavedGame);
  const playtimeSeconds = useGameStore((s) => s.playtimeSeconds);
  const debugUnlockAllLevels = useGameStore((s) => s.debugUnlockAllLevels);
  const debugResetSave = useGameStore((s) => s.debugResetSave);
  const debugAddTestItem = useGameStore((s) => s.debugAddTestItem);

  if (!visible) return null;

  const unlockedCount = LEVEL_CATALOG.filter(
    (l) => progression[l.id]?.unlocked,
  ).length;
  const completedCount = LEVEL_CATALOG.filter(
    (l) => progression[l.id]?.completed,
  ).length;

  return (
    <aside
      data-testid="systems-debug-panel"
      aria-label="Systems Debug Panel"
      className="pointer-events-auto fixed bottom-16 left-4 z-30 w-72 rounded-lg border border-amber-400/30 p-3.5 text-xs text-slate-100 shadow-2xl"
      style={{ backgroundColor: 'rgba(15, 23, 42, 0.94)' }}
    >
      <div className="mb-2.5 flex items-center justify-between border-b border-white/10 pb-1.5">
        <span className="font-mono text-[11px] font-bold tracking-wider text-amber-300">
          SYSTEMS DEBUG (F4)
        </span>
        <button
          type="button"
          onClick={(e) => {
            e.currentTarget.blur();
            toggleSystemsDebug();
          }}
          className="rounded px-1.5 py-0.5 text-[10px] text-slate-400 hover:bg-white/10 hover:text-white"
        >
          Close
        </button>
      </div>

      <dl className="mb-3 grid grid-cols-2 gap-y-1 font-mono text-[11px] tabular-nums">
        <dt className="text-slate-400">Levels Unlocked</dt>
        <dd className="text-right text-teal-300">{unlockedCount} / 5</dd>
        <dt className="text-slate-400">Levels Completed</dt>
        <dd className="text-right text-emerald-300">{completedCount} / 5</dd>
        <dt className="text-slate-400">Inventory Items</dt>
        <dd className="text-right text-sky-300">{inventoryItems.length}</dd>
        <dt className="text-slate-400">Saved in Storage</dt>
        <dd className="text-right">{hasSavedGame ? 'Yes' : 'No'}</dd>
        <dt className="text-slate-400">Playtime</dt>
        <dd className="text-right">{Math.floor(playtimeSeconds)}s</dd>
      </dl>

      <div className="flex flex-col gap-1.5">
        <button
          type="button"
          data-testid="debug-unlock-levels"
          onClick={(e) => {
            e.currentTarget.blur();
            debugUnlockAllLevels();
          }}
          className="w-full rounded-md bg-teal-700 px-3 py-1.5 text-left text-xs font-medium text-white transition-colors hover:bg-teal-600"
        >
          Unlock All Levels
        </button>
        <button
          type="button"
          data-testid="debug-add-item"
          onClick={(e) => {
            e.currentTarget.blur();
            debugAddTestItem();
          }}
          className="w-full rounded-md bg-sky-700 px-3 py-1.5 text-left text-xs font-medium text-white transition-colors hover:bg-sky-600"
        >
          Add Test Item
        </button>
        <button
          type="button"
          data-testid="debug-reset-save"
          onClick={(e) => {
            e.currentTarget.blur();
            debugResetSave();
          }}
          className="w-full rounded-md bg-rose-700 px-3 py-1.5 text-left text-xs font-medium text-white transition-colors hover:bg-rose-600"
        >
          Reset Save
        </button>
      </div>
    </aside>
  );
}
