import { useEffect, useRef, useState } from 'react';
import { getChunksForLevel, getLevelHeight } from '@/src/game/levels';
import { getAssetCacheStats } from '@/src/game/rendering/assetCache';
import { detectDeviceProfile } from '@/src/game/rendering/adaptiveQuality';
import { performanceTelemetry } from '@/src/game/rendering/performanceTelemetry';
import { eventBus } from '@/src/state/eventBus';
import { useGameStore } from '@/src/state/gameStore';
import { LEVEL_CATALOG, type LevelId } from '@/src/systems/progressionSystem';
import type { GraphicsQuality } from '@/src/systems/saveSystem';

interface StressResult {
  passed: boolean;
  crossings: number;
  beforeGeos: number;
  afterGeos: number;
  beforeTex: number;
  afterTex: number;
  beforeBodies: number;
  afterBodies: number;
  beforeHeap: number | null;
  afterHeap: number | null;
}

export function QaAcceptanceOverlay() {
  const qaVisible = useGameStore((s) => s.qaVisible);
  const activeLevel = useGameStore((s) => s.activeLevel);
  const graphicsQuality = useGameStore((s) => s.settings.graphicsQuality);
  const startLevel = useGameStore((s) => s.startLevel);
  const updateSettings = useGameStore((s) => s.updateSettings);
  const toggleQaOverlay = useGameStore((s) => s.toggleQaOverlay);
  const debugUnlockAllLevels = useGameStore((s) => s.debugUnlockAllLevels);

  const [stressRunning, setStressRunning] = useState(false);
  const [stressProgress, setStressProgress] = useState(0);
  const [stressResult, setStressResult] = useState<StressResult | null>(null);
  const [liveStats, setLiveStats] = useState({ ...performanceTelemetry });
  const abortRef = useRef(false);

  useEffect(() => {
    if (!qaVisible) return;
    const id = window.setInterval(() => {
      setLiveStats({ ...performanceTelemetry });
    }, 250);
    return () => window.clearInterval(id);
  }, [qaVisible]);

  useEffect(() => {
    return () => {
      abortRef.current = true;
    };
  }, []);

  if (!qaVisible) return null;

  const levelId: LevelId = activeLevel === 'testArena' ? 'level1' : activeLevel;
  const chunks = getChunksForLevel(levelId);
  const profile = detectDeviceProfile();
  const drawBudget = profile.isMobile ? 80 : 150;
  const triBudget = profile.isMobile ? 200000 : 600000;
  const cacheStats = getAssetCacheStats();

  const teleportTo = (x: number, z: number, label: string) => {
    const y = Math.max(2.2, getLevelHeight(levelId, x, z) + 0.9);
    eventBus.emit('player:respawn', { position: [x, y, z] });
    useGameStore.getState().showToast(`QA Teleport: ${label}`, 'info');
  };

  const run50CrossingsStressTest = async () => {
    if (stressRunning || chunks.length < 2) return;
    abortRef.current = false;
    setStressRunning(true);
    setStressResult(null);
    setStressProgress(0);

    const a = chunks[0];
    const b = chunks[chunks.length - 1];
    const posA: [number, number, number] = [
      a.center[0],
      Math.max(2.2, getLevelHeight(levelId, a.center[0], a.center[2]) + 0.9),
      a.center[2],
    ];
    const posB: [number, number, number] = [
      b.center[0],
      Math.max(2.2, getLevelHeight(levelId, b.center[0], b.center[2]) + 0.9),
      b.center[2],
    ];

    const waitTick = (minMs: number) =>
      new Promise<void>((resolve) => {
        setTimeout(() => {
          requestAnimationFrame(() => resolve());
        }, minMs);
      });

    // Anchor at posA and settle baseline before crossings
    eventBus.emit('player:respawn', { position: posA });
    await waitTick(350);

    const before = {
      geos: performanceTelemetry.geometries,
      tex: performanceTelemetry.textures,
      bodies: performanceTelemetry.activePhysicsBodies,
      chunks: performanceTelemetry.loadedChunks.length,
      heap: performanceTelemetry.jsHeapMB,
    };

    for (let i = 0; i < 50; i++) {
      if (abortRef.current) break;
      eventBus.emit('player:respawn', {
        position: i % 2 === 0 ? posB : posA,
      });
      setStressProgress(i + 1);
      await waitTick(105);
    }

    // Settle back at posA & wait for staggered unloads + telemetry refresh
    eventBus.emit('player:respawn', { position: posA });
    for (let w = 0; w < 25; w++) {
      await waitTick(160);
      if (performanceTelemetry.loadedChunks.length <= before.chunks) {
        await waitTick(320);
        break;
      }
    }

    const after = {
      geos: performanceTelemetry.geometries,
      tex: performanceTelemetry.textures,
      bodies: performanceTelemetry.activePhysicsBodies,
      heap: performanceTelemetry.jsHeapMB,
    };

    const geoDrift = after.geos - before.geos;
    const bodyDrift = after.bodies - before.bodies;
    const passed = geoDrift <= 4 && Math.abs(bodyDrift) <= 8;

    setStressResult({
      passed,
      crossings: 50,
      beforeGeos: before.geos,
      afterGeos: after.geos,
      beforeTex: before.tex,
      afterTex: after.tex,
      beforeBodies: before.bodies,
      afterBodies: after.bodies,
      beforeHeap: before.heap,
      afterHeap: after.heap,
    });
    setStressRunning(false);
  };

  return (
    <aside
      data-testid="qa-acceptance-overlay"
      className="pointer-events-auto fixed top-28 right-4 z-30 flex max-h-[75vh] w-80 flex-col gap-2.5 overflow-y-auto rounded-lg border border-amber-400/40 p-3.5 font-mono text-[11px] text-slate-100 shadow-2xl tabular-nums"
      style={{ backgroundColor: 'rgba(15, 21, 24, 0.95)' }}
    >
      <div className="flex items-center justify-between border-b border-amber-400/25 pb-2">
        <span className="font-semibold tracking-wider text-amber-300">
          QA ACCEPTANCE TOOL (F5)
        </span>
        <button
          type="button"
          onClick={toggleQaOverlay}
          className="rounded border border-white/20 px-2 py-0.5 text-[10px] hover:bg-white/10"
        >
          Close
        </button>
      </div>

      {/* Live Budgets */}
      <div className="rounded border border-white/10 bg-black/30 p-2">
        <div className="mb-1 flex justify-between text-[10px] text-slate-400">
          <span>GPU: {liveStats.gpuRenderer.slice(0, 28)}</span>
        </div>
        <div className="grid grid-cols-2 gap-1">
          <span>
            FPS: <strong className="text-teal-300">{liveStats.fps}</strong>
          </span>
          <span>
            Tier: <strong className="text-amber-200">{liveStats.activeTier}</strong> ({liveStats.currentDpr.toFixed(2)}x)
          </span>
          <span className={liveStats.drawCalls <= drawBudget ? 'text-emerald-300' : 'text-rose-400'}>
            Draws: {liveStats.drawCalls}/{drawBudget}
          </span>
          <span className={liveStats.triangles <= triBudget ? 'text-emerald-300' : 'text-rose-400'}>
            Tris: {(liveStats.triangles / 1000).toFixed(1)}k/{triBudget / 1000}k
          </span>
          <span>
            Bodies: {liveStats.activePhysicsBodies}
          </span>
          <span>
            Cache: {cacheStats.geometries}G/{cacheStats.materials}M
          </span>
          <span className="col-span-2 text-teal-200">
            Chunks: {liveStats.loadedChunks.length}/{liveStats.totalChunks} ({liveStats.loadedChunks.join(', ')})
          </span>
        </div>
      </div>

      {/* Level Quick-Jump */}
      <div>
        <div className="mb-1 flex items-center justify-between text-[10px] text-slate-400">
          <span>LEVELS 1–5</span>
          <button
            type="button"
            onClick={debugUnlockAllLevels}
            className="text-amber-300 underline hover:text-amber-200"
          >
            Unlock All
          </button>
        </div>
        <div className="grid grid-cols-5 gap-1">
          {LEVEL_CATALOG.map((lvl) => (
            <button
              key={lvl.id}
              type="button"
              data-testid={`qa-level-${lvl.id}`}
              onClick={() => startLevel(lvl.id)}
              className={`rounded border px-1 py-1 text-center font-semibold ${
                levelId === lvl.id
                  ? 'border-teal-400 bg-teal-900/70 text-white'
                  : 'border-white/15 bg-white/5 text-slate-300 hover:bg-white/15'
              }`}
            >
              L{lvl.order}
            </button>
          ))}
        </div>
      </div>

      {/* Quality Override */}
      <div>
        <div className="mb-1 text-[10px] text-slate-400">QUALITY PRESET</div>
        <div className="grid grid-cols-4 gap-1">
          {(['auto', 'low', 'medium', 'high'] as GraphicsQuality[]).map((q) => (
            <button
              key={q}
              type="button"
              onClick={() => updateSettings({ graphicsQuality: q })}
              className={`rounded border px-1 py-1 uppercase ${
                graphicsQuality === q
                  ? 'border-amber-400 bg-amber-900/60 text-amber-100'
                  : 'border-white/15 bg-white/5 text-slate-300'
              }`}
            >
              {q}
            </button>
          ))}
        </div>
      </div>

      {/* Chunk Teleport */}
      <div>
        <div className="mb-1 text-[10px] text-slate-400">CHUNK TELEPORT</div>
        <div className="flex flex-col gap-1">
          {chunks.map((c) => (
            <button
              key={c.id}
              type="button"
              data-testid={`qa-tp-${c.id}`}
              onClick={() => teleportTo(c.center[0], c.center[2], c.label)}
              className="flex items-center justify-between rounded border border-white/15 bg-white/5 px-2 py-1 text-left hover:bg-white/15"
            >
              <span>{c.label}</span>
              <span className="text-[10px] text-slate-400">{c.id}</span>
            </button>
          ))}
        </div>
      </div>

      {/* 50-Crossing Stress Test */}
      <div className="border-t border-white/10 pt-2">
        <button
          type="button"
          data-testid="qa-run-stress"
          disabled={stressRunning}
          onClick={run50CrossingsStressTest}
          className="w-full rounded border border-teal-400/50 bg-teal-900/60 px-3 py-1.5 font-semibold text-teal-100 hover:bg-teal-800/70 disabled:opacity-50"
        >
          {stressRunning
            ? `Running 50x Crossings (${stressProgress}/50)...`
            : 'Run 50x Border Stress Test'}
        </button>

        {stressResult && (
          <div
            data-testid="qa-stress-result"
            className={`mt-2 rounded border p-2 text-[10px] ${
              stressResult.passed
                ? 'border-emerald-400/50 bg-emerald-950/50 text-emerald-200'
                : 'border-rose-400/50 bg-rose-950/50 text-rose-200'
            }`}
          >
            <div className="font-bold">
              {stressResult.passed ? 'PASS' : 'WARN'} · {stressResult.crossings} crossings
            </div>
            <div>
              Geo: {stressResult.beforeGeos} {'->'} {stressResult.afterGeos} | Tex:{' '}
              {stressResult.beforeTex} {'->'} {stressResult.afterTex}
            </div>
            <div>
              Bodies: {stressResult.beforeBodies} {'->'} {stressResult.afterBodies}
              {stressResult.afterHeap !== null &&
                ` | Heap: ${stressResult.beforeHeap} -> ${stressResult.afterHeap} MB`}
            </div>
          </div>
        )}
      </div>
    </aside>
  );
}
