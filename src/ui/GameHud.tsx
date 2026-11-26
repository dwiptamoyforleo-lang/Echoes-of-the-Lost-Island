import { memo, useEffect, useRef, useState } from 'react';
import { playerTelemetry } from '@/src/game/player/playerTelemetry';
import { useGameStore, type ToastKind } from '@/src/state/gameStore';
import { ANCIENT_FRAGMENTS } from '@/src/systems/inventorySystem';
import {
  getInteractLabel,
  useInputMode,
  useViewportLayout,
} from '@/src/systems/inputMode';
import { DialogueBox } from './DialogueBox';
import { ItemIcon } from './ItemIcon';
import { FragmentEmblem } from './RuneOrnaments';
import { TouchInteractButton } from './TouchInteractButton';
import { VirtualJoystick } from './VirtualJoystick';

const TOAST_BORDER_COLORS: Record<ToastKind, string> = {
  crystal: 'border-sky-400/60 text-sky-100',
  objective: 'border-emerald-400/65 text-emerald-100',
  fragment: 'border-teal-300/75 text-teal-100',
  save: 'border-amber-300/65 text-amber-100',
  info: 'border-[#c79d52]/60 text-[#f3e7cf]',
};

const FINALE_BEATS: ReadonlyArray<{
  chapter: string;
  title: string;
  body: string;
}> = [
  {
    chapter: 'Finale · I of IV',
    title: 'The Cradle of Five Echoes',
    body: 'As the Echo of Eternity settles beside Tide, Gale, Stars, and Frost, the Sky Temple astrolabe awakens with a deep, golden chime.',
  },
  {
    chapter: 'Finale · II of IV',
    title: 'The Ancient Covenant',
    body: 'Ages ago, the Sky Temple builders split the archipelago heart into five resonant echoes so no single storm could ever silence the islands.',
  },
  {
    chapter: 'Finale · III of IV',
    title: 'Skyfire Conduit Restored',
    body: 'A radiant column of teal and amber light surges heavenward, reweaving the sky bridges and calming the drifting cloud sea below.',
  },
  {
    chapter: 'Finale · IV of IV',
    title: 'Echoes Across the Horizon',
    body: 'From the Forgotten Shore to the Frozen Peaks, every shrine answers in harmony. The Lost Archipelago breathes once more.',
  },
];

function ToastItem({
  id,
  message,
  kind,
  onDismiss,
}: {
  id: number;
  message: string;
  kind: ToastKind;
  onDismiss: (id: number) => void;
}) {
  useEffect(() => {
    const timer = window.setTimeout(() => {
      onDismiss(id);
    }, 3800);
    return () => window.clearTimeout(timer);
  }, [id, onDismiss]);

  return (
    <div
      className={`stone-panel rounded px-3 py-1.5 text-[11px] font-medium shadow-lg sm:px-4 sm:py-2 sm:text-xs ${TOAST_BORDER_COLORS[kind]}`}
      data-testid="hud-toast"
    >
      {message}
    </div>
  );
}

const InteractionPromptBanner = memo(function InteractionPromptBanner() {
  const inputMode = useInputMode();
  const activePrompt = useGameStore((state) => state.activePrompt);
  const activeInscription = useGameStore((state) => state.activeInscription);
  const activeOverlay = useGameStore((state) => state.activeOverlay);

  if (
    inputMode !== 'keyboard' ||
    !activePrompt ||
    activeInscription ||
    activeOverlay !== 'none'
  ) {
    return null;
  }

  const promptText =
    activePrompt.requiresPrefix === false
      ? activePrompt.label
      : getInteractLabel('keyboard', activePrompt.label);

  return (
    <div
      className="stone-panel rounded border-[#e0b86b]/60 px-4 py-2 text-sm font-semibold text-[#fbe6ba]"
      data-testid="interaction-prompt"
    >
      {promptText}
    </div>
  );
});

export function GameHud() {
  const inputMode = useInputMode();
  const { isPortrait, isCompactWidth, isCompactHeight } = useViewportLayout();
  const useCompactHud = inputMode === 'touch' || isCompactWidth || isCompactHeight;

  const screen = useGameStore((state) => state.screen);
  const activeLevel = useGameStore((state) => state.activeLevel);
  const crystals = useGameStore((state) => state.crystals);
  const totalCrystals = useGameStore((state) => state.totalCrystals);
  const objectiveText = useGameStore((state) => state.objectiveText);
  const toasts = useGameStore((state) => state.toasts);
  const dismissToast = useGameStore((state) => state.dismissToast);
  const inventoryItems = useGameStore((state) => state.inventoryItems);
  const recoveredFragments = useGameStore((state) => state.recoveredFragments);
  const quests = useGameStore((state) => state.quests);
  const streamingPending = useGameStore((state) => state.streamingPending);
  const underwaterTint = useGameStore((state) => state.underwaterTint);
  const fallFadeActive = useGameStore((state) => state.fallFadeActive);
  const finaleCutscene = useGameStore((state) => state.finaleCutscene);
  const advanceFinaleCutscene = useGameStore(
    (state) => state.advanceFinaleCutscene,
  );
  const finishFinaleCutscene = useGameStore(
    (state) => state.finishFinaleCutscene,
  );
  const toggleInventory = useGameStore((state) => state.toggleInventory);
  const toggleQuestLog = useGameStore((state) => state.toggleQuestLog);
  const togglePause = useGameStore((state) => state.togglePause);

  const [landscapeHintDismissed, setLandscapeHintDismissed] = useState(false);

  const staminaBarRef = useRef<HTMLDivElement>(null);
  const staminaLabelRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    if (screen !== 'playing') return;
    let rafId = 0;
    const syncStamina = () => {
      const bar = staminaBarRef.current;
      const label = staminaLabelRef.current;
      if (bar) {
        const pct = Math.max(0, Math.min(100, playerTelemetry.stamina));
        bar.style.transform = `scaleX(${pct / 100})`;
        bar.style.backgroundColor = playerTelemetry.staminaExhausted
          ? '#f59e0b'
          : '#2dd4bf';
      }
      if (label) {
        label.textContent = playerTelemetry.staminaExhausted
          ? 'Recover'
          : `${Math.round(playerTelemetry.stamina)}%`;
      }
      rafId = requestAnimationFrame(syncStamina);
    };
    rafId = requestAnimationFrame(syncStamina);
    return () => cancelAnimationFrame(rafId);
  }, [screen, useCompactHud]);

  if (screen !== 'playing') return null;

  const gearItems = inventoryItems.filter((i) => i.category !== 'crystal');
  const levelQuests =
    activeLevel === 'testArena' ? [] : (quests[activeLevel] ?? []);
  const completedCount = levelQuests.filter((q) => q.completed).length;
  const questProgressPct =
    levelQuests.length > 0
      ? Math.round((completedCount / levelQuests.length) * 100)
      : 0;

  const finaleBeat =
    FINALE_BEATS[Math.min(finaleCutscene.step, FINALE_BEATS.length - 1)];

  const showLandscapeHint =
    inputMode === 'touch' && isPortrait && !landscapeHintDismissed && !finaleCutscene.active;

  return (
    <>
      {/* Smooth fall-respawn fade transition overlay */}
      <div
        className={`pointer-events-none fixed inset-0 z-40 bg-[#070d11] transition-opacity duration-200 ${
          fallFadeActive ? 'opacity-100' : 'opacity-0'
        }`}
        data-testid="fall-fade-overlay"
        aria-hidden="true"
      />

      {finaleCutscene.active ? (
        <div
          className="pointer-events-none fixed inset-0 z-20 flex flex-col justify-between p-3 sm:p-6"
          data-testid="finale-cutscene-overlay"
          style={{
            paddingTop: 'max(0.75rem, env(safe-area-inset-top, 0px))',
            paddingBottom: 'max(0.75rem, env(safe-area-inset-bottom, 0px))',
          }}
        >
          <div className="flex justify-end">
            <button
              type="button"
              data-testid="finale-skip-btn"
              onClick={(e) => {
                e.currentTarget.blur();
                finishFinaleCutscene();
              }}
              className="stone-btn pointer-events-auto min-h-[40px] rounded px-3.5 py-1.5 text-xs font-semibold"
            >
              Skip Cutscene
            </button>
          </div>

          <div className="mx-auto w-full max-w-2xl">
            <div className="stone-panel pointer-events-auto flex flex-col gap-2.5 rounded-md border-[#e0b86b]/70 p-4 shadow-2xl sm:gap-3 sm:p-6">
              <div className="flex items-center justify-between gap-2">
                <span className="font-mono text-[11px] tracking-widest text-[#e0b86b] uppercase">
                  {finaleBeat.chapter}
                </span>
                <span className="font-mono text-[11px] text-[#9ee7dc]">
                  {finaleCutscene.islandRestored
                    ? 'Beacon Restored'
                    : 'Echoes Awakening'}
                </span>
              </div>
              <h2 className="font-display text-base font-bold text-[#fbf0d8] sm:text-xl">
                {finaleBeat.title}
              </h2>
              <p className="text-xs leading-relaxed text-[#e6dac0] sm:text-sm">
                {finaleBeat.body}
              </p>
              <div className="flex justify-end pt-1">
                <button
                  type="button"
                  data-testid="finale-next-btn"
                  onClick={(e) => {
                    e.currentTarget.blur();
                    advanceFinaleCutscene();
                  }}
                  className="bronze-btn min-h-[42px] rounded px-5 py-2 text-xs font-semibold"
                >
                  {finaleCutscene.step >= FINALE_BEATS.length - 1
                    ? 'Complete Expedition'
                    : 'Continue'}
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div
          className="pointer-events-none fixed inset-0 z-10 flex flex-col justify-between"
          style={{
            paddingTop: 'max(0.5rem, env(safe-area-inset-top, 0px))',
            paddingRight: 'max(0.5rem, env(safe-area-inset-right, 0px))',
            paddingBottom: 'max(0.5rem, env(safe-area-inset-bottom, 0px))',
            paddingLeft: 'max(0.5rem, env(safe-area-inset-left, 0px))',
          }}
          data-testid="game-hud"
        >
          {/* Visual-only underwater tint when submerged inside Level 3 Flooded Cistern */}
          {underwaterTint && (
            <div
              className="pointer-events-none fixed inset-0 -z-10 bg-gradient-to-b from-cyan-950/35 via-teal-900/40 to-cyan-950/55 transition-opacity duration-300"
              data-testid="underwater-tint-overlay"
            />
          )}

          {useCompactHud ? (
            /* Purpose-Built Mobile / Small-Screen Compact Top Strip (<= 15% height) */
            <div className="flex flex-col gap-1.5">
              <div
                className="stone-panel flex items-center justify-between gap-2 rounded px-2.5 py-1.5"
                data-testid="mobile-compact-hud"
              >
                {/* Left: Echoes + Compact Stamina */}
                <div className="flex min-w-0 items-center gap-2">
                  <div className="flex items-center gap-1" data-testid="fragment-tracker">
                    {ANCIENT_FRAGMENTS.map((frag) => {
                      const has = recoveredFragments.includes(frag.id);
                      return (
                        <FragmentEmblem
                          key={frag.id}
                          recovered={has}
                          size="sm"
                          label={`${frag.name}${has ? ' (Recovered)' : ' (Unclaimed)'}`}
                        />
                      );
                    })}
                  </div>
                  <div className="flex items-center gap-1.5">
                    <div className="h-2 w-14 overflow-hidden rounded-sm border border-[#c79d52]/40 bg-[#0d1213] sm:w-20">
                      <div
                        ref={staminaBarRef}
                        data-testid="stamina-bar"
                        className="h-full w-full origin-left bg-teal-400"
                        style={{ transform: 'scaleX(1)' }}
                      />
                    </div>
                    <span
                      ref={staminaLabelRef}
                      className="hidden font-mono text-[10px] text-[#d6c9ae] tabular-nums sm:inline"
                    >
                      100%
                    </span>
                  </div>
                </div>

                {/* Center: Crystal Counter + Single-Line Objective */}
                <div className="flex min-w-0 flex-1 items-center justify-center gap-2 px-1">
                  {activeLevel !== 'testArena' && (
                    <div className="flex shrink-0 items-center gap-1 font-mono text-xs font-bold text-sky-300 tabular-nums">
                      <ItemIcon iconId="crystal" className="h-3.5 w-3.5" />
                      <span data-testid="crystal-counter">
                        {crystals}/{totalCrystals}
                      </span>
                    </div>
                  )}
                  {!isPortrait && (
                    <p
                      className="hidden truncate text-[11px] font-semibold text-[#f5ebd4] sm:block"
                      data-testid="objective-text"
                    >
                      {objectiveText}
                    </p>
                  )}
                </div>

                {/* Right: Satchel, Quests, and Pause Thumb Buttons */}
                <div className="flex shrink-0 items-center gap-1.5">
                  {activeLevel !== 'testArena' && (
                    <>
                      <button
                        type="button"
                        data-testid="hud-inventory-btn"
                        aria-label="Open Satchel"
                        onClick={(e) => {
                          e.currentTarget.blur();
                          document.exitPointerLock?.();
                          toggleInventory();
                        }}
                        className="stone-btn pointer-events-auto flex h-10 min-w-[40px] items-center justify-center rounded px-2 text-[11px] font-semibold"
                      >
                        <ItemIcon iconId="relic" className="h-4 w-4" />
                      </button>
                      <button
                        type="button"
                        data-testid="hud-quests-btn"
                        aria-label="Open Quest Log"
                        onClick={(e) => {
                          e.currentTarget.blur();
                          document.exitPointerLock?.();
                          toggleQuestLog();
                        }}
                        className="stone-btn pointer-events-auto flex h-10 min-w-[40px] items-center justify-center rounded px-2 font-mono text-[11px] font-semibold"
                      >
                        {completedCount}/{levelQuests.length}
                      </button>
                    </>
                  )}
                  <button
                    type="button"
                    data-testid="touch-pause-btn"
                    aria-label="Pause Game"
                    onClick={(e) => {
                      e.currentTarget.blur();
                      document.exitPointerLock?.();
                      togglePause();
                    }}
                    className="stone-btn pointer-events-auto flex h-10 min-w-[40px] items-center justify-center rounded px-2 text-[#f5ebd4]"
                  >
                    <svg viewBox="0 0 24 24" className="h-4 w-4" aria-hidden="true">
                      <rect x="6" y="5" width="4" height="14" rx="1" fill="currentColor" />
                      <rect x="14" y="5" width="4" height="14" rx="1" fill="currentColor" />
                    </svg>
                  </button>
                </div>
              </div>

              {/* Compact Portrait Objective Strip */}
              {isPortrait && (
                <div className="flex items-center justify-between gap-2 px-1">
                  <p
                    className="stone-panel max-w-full truncate rounded px-2.5 py-1 text-[11px] font-semibold text-[#f5ebd4]"
                    data-testid="objective-text"
                  >
                    {objectiveText}
                  </p>
                </div>
              )}

              {/* Portrait Landscape Orientation Suggestion */}
              {showLandscapeHint && (
                <div
                  data-testid="landscape-suggestion-banner"
                  className="stone-panel pointer-events-auto mx-auto flex items-center gap-2 rounded border-[#e0b86b]/55 px-3 py-1 text-[11px] text-[#f3e7cf]"
                >
                  <span>Rotate to landscape for the widest view</span>
                  <button
                    type="button"
                    aria-label="Dismiss rotate suggestion"
                    onClick={() => setLandscapeHintDismissed(true)}
                    className="rounded border border-[#c79d52]/40 px-2 py-0.5 text-[10px] font-semibold text-[#e0b86b]"
                  >
                    OK
                  </button>
                </div>
              )}
            </div>
          ) : (
            /* Desktop Full HUD Top Row */
            <div className="flex flex-wrap items-start justify-between gap-3 p-1 sm:p-2">
              {/* Top-Left: 5-Slot Fragment Tracker + Stamina Bar */}
              <div className="stone-panel flex flex-col gap-2 rounded px-3.5 py-2.5">
                <div className="flex items-center gap-1.5" data-testid="fragment-tracker">
                  <span className="mr-1 font-display text-[11px] font-semibold tracking-wider text-[#d9bf8e]">
                    Echoes
                  </span>
                  {ANCIENT_FRAGMENTS.map((frag) => {
                    const has = recoveredFragments.includes(frag.id);
                    return (
                      <FragmentEmblem
                        key={frag.id}
                        recovered={has}
                        size="sm"
                        label={`${frag.name}${has ? ' (Recovered)' : ' (Unclaimed)'}`}
                      />
                    );
                  })}
                </div>

                <div className="flex items-center gap-2">
                  <span className="text-[11px] font-medium text-[#cfc3aa]">
                    Stamina
                  </span>
                  <div className="h-2 w-28 overflow-hidden rounded-sm border border-[#c79d52]/40 bg-[#0d1213] sm:w-32">
                    <div
                      ref={staminaBarRef}
                      data-testid="stamina-bar"
                      className="h-full w-full origin-left bg-teal-400"
                      style={{ transform: 'scaleX(1)' }}
                    />
                  </div>
                  <span
                    ref={staminaLabelRef}
                    className="w-12 font-mono text-[10px] text-[#d6c9ae] tabular-nums"
                  >
                    100%
                  </span>
                </div>
              </div>

              {/* Top-Right: Crystal Counter, Objective, Progress Bar & Quick Buttons */}
              <div className="stone-panel flex max-w-xs flex-col items-end gap-1.5 rounded px-3.5 py-2.5 text-right sm:max-w-sm">
                {activeLevel !== 'testArena' && (
                  <div className="flex w-full items-center justify-between gap-3">
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        data-testid="hud-inventory-btn"
                        onClick={(e) => {
                          e.currentTarget.blur();
                          document.exitPointerLock?.();
                          toggleInventory();
                        }}
                        className="stone-btn pointer-events-auto rounded px-2 py-0.5 text-[11px] font-medium"
                      >
                        Satchel (I)
                      </button>
                      <button
                        type="button"
                        data-testid="hud-quests-btn"
                        onClick={(e) => {
                          e.currentTarget.blur();
                          document.exitPointerLock?.();
                          toggleQuestLog();
                        }}
                        className="stone-btn pointer-events-auto rounded px-2 py-0.5 text-[11px] font-medium"
                      >
                        Quests (J)
                      </button>
                    </div>
                    <div className="flex items-center gap-1.5 font-mono text-sm font-bold text-sky-300 tabular-nums sm:text-base">
                      <ItemIcon iconId="crystal" className="h-4 w-4" />
                      <span data-testid="crystal-counter">
                        {crystals} / {totalCrystals}
                      </span>
                    </div>
                  </div>
                )}

                <p
                  className="text-xs font-semibold text-[#f5ebd4]"
                  data-testid="objective-text"
                >
                  {objectiveText}
                </p>

                {activeLevel !== 'testArena' && (
                  <div className="flex w-full items-center gap-2">
                    <div className="h-1.5 flex-1 overflow-hidden rounded-sm bg-[#0f1415]">
                      <div
                        className="h-full bg-gradient-to-r from-[#256f68] to-[#d9af62] transition-transform duration-300"
                        style={{ width: `${questProgressPct}%` }}
                      />
                    </div>
                    <span className="font-mono text-[10px] text-[#c7b99d] tabular-nums">
                      {completedCount}/{levelQuests.length}
                    </span>
                  </div>
                )}

                {gearItems.length > 0 && (
                  <div className="flex flex-wrap items-center justify-end gap-2 pt-0.5 text-[11px] text-amber-200">
                    {gearItems.map((item) => (
                      <span key={item.id} className="inline-flex items-center gap-1">
                        <ItemIcon iconId={item.iconId} className="h-3.5 w-3.5" />
                        <span>{item.name}</span>
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Typewriter Story / Inscription Dialogue Box */}
          <DialogueBox />

          {/* Bottom Prompts & Toasts (raised safely above mobile thumb controls) */}
          <div
            className={`flex flex-col items-center gap-2 ${
              inputMode === 'touch' ? 'pb-28 sm:pb-24' : 'pb-1'
            }`}
          >
            {toasts.length > 0 && (
              <div className="flex flex-col items-center gap-1.5">
                {toasts.map((toast) => (
                  <ToastItem
                    key={toast.id}
                    id={toast.id}
                    message={toast.message}
                    kind={toast.kind}
                    onDismiss={dismissToast}
                  />
                ))}
              </div>
            )}

            <InteractionPromptBanner />

            {streamingPending && (
              <div
                data-testid="streaming-badge"
                className="fixed right-4 bottom-12 rounded border border-[#c79d52]/40 bg-[#121719]/85 px-2.5 py-1 font-mono text-[10px] text-teal-200"
              >
                Streaming area...
              </div>
            )}
          </div>

          {/* Touch-only bottom-left joystick & right-side Jump, Sprint toggle, and Interact cluster */}
          <VirtualJoystick />
          <TouchInteractButton />
        </div>
      )}
    </>
  );
}
