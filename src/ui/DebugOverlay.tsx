import { useEffect, useRef } from 'react';
import { playerTelemetry } from '@/src/game/player/playerTelemetry';
import { getAssetCacheStats } from '@/src/game/rendering/assetCache';
import { performanceTelemetry } from '@/src/game/rendering/performanceTelemetry';
import { useGameStore } from '@/src/state/gameStore';

export function DebugOverlay() {
  const debugVisible = useGameStore((state) => state.debugVisible);
  const fpsRef = useRef<HTMLSpanElement>(null);
  const drawsRef = useRef<HTMLSpanElement>(null);
  const trisRef = useRef<HTMLSpanElement>(null);
  const gpuMemRef = useRef<HTMLSpanElement>(null);
  const bodiesRef = useRef<HTMLSpanElement>(null);
  const tierRef = useRef<HTMLSpanElement>(null);
  const chunksRef = useRef<HTMLSpanElement>(null);
  const heapRef = useRef<HTMLSpanElement>(null);
  const posRef = useRef<HTMLSpanElement>(null);
  const groundedRef = useRef<HTMLSpanElement>(null);
  const velRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    if (!debugVisible) return;

    let rafId = 0;

    const update = () => {
      const {
        fps,
        frameTimeMs,
        drawCalls,
        triangles,
        geometries,
        textures,
        activePhysicsBodies,
        activeTier,
        currentDpr,
        loadedChunks,
        totalChunks,
        visibleChunks,
        jsHeapMB,
      } = performanceTelemetry;
      const cache = getAssetCacheStats();

      if (fpsRef.current) {
        fpsRef.current.textContent = `${fps} (${frameTimeMs.toFixed(1)} ms)`;
      }
      if (drawsRef.current) {
        drawsRef.current.textContent = `${drawCalls}`;
      }
      if (trisRef.current) {
        trisRef.current.textContent = triangles.toLocaleString();
      }
      if (gpuMemRef.current) {
        gpuMemRef.current.textContent = `${geometries}G / ${textures}T (cache ${cache.geometries}G/${cache.materials}M)`;
      }
      if (bodiesRef.current) {
        bodiesRef.current.textContent = `${activePhysicsBodies}`;
      }
      if (tierRef.current) {
        tierRef.current.textContent = `${activeTier.toUpperCase()} · ${currentDpr.toFixed(2)}x`;
      }
      if (chunksRef.current) {
        chunksRef.current.textContent = `${loadedChunks.length}/${totalChunks} (vis ${visibleChunks}) ${loadedChunks.join(', ') || 'none'}`;
      }
      if (heapRef.current) {
        heapRef.current.textContent = jsHeapMB !== null ? `${jsHeapMB.toFixed(1)} MB` : 'N/A';
      }

      const { position, grounded, velocity, horizontalSpeed } = playerTelemetry;

      if (posRef.current) {
        posRef.current.textContent = `${position.x.toFixed(2)}, ${position.y.toFixed(2)}, ${position.z.toFixed(2)}`;
      }
      if (groundedRef.current) {
        groundedRef.current.textContent = grounded ? 'Grounded' : 'Airborne';
        groundedRef.current.style.color = grounded ? '#6ee7b7' : '#fcd34d';
      }
      if (velRef.current) {
        velRef.current.textContent = `${velocity.x.toFixed(2)}, ${velocity.y.toFixed(2)}, ${velocity.z.toFixed(2)} (${horizontalSpeed.toFixed(1)} m/s)`;
      }

      rafId = requestAnimationFrame(update);
    };

    rafId = requestAnimationFrame(update);
    return () => cancelAnimationFrame(rafId);
  }, [debugVisible]);

  if (!debugVisible) return null;

  return (
    <aside
      data-testid="debug-overlay"
      aria-label="Debug Telemetry"
      className="pointer-events-none fixed top-4 left-4 z-20 max-w-md rounded-lg border border-white/15 px-3.5 py-2.5 font-mono text-xs text-slate-100 shadow-lg tabular-nums"
      style={{ backgroundColor: 'rgba(15, 23, 42, 0.88)' }}
    >
      <div className="mb-1.5 flex items-center justify-between gap-6 border-b border-white/10 pb-1 text-[11px] font-semibold tracking-wider text-slate-300">
        <span>PERFORMANCE &amp; TELEMETRY</span>
        <span className="text-slate-400">F3 · F4 · F5</span>
      </div>
      <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1">
        <dt className="text-slate-400">FPS / Frame</dt>
        <dd className="text-right">
          <span ref={fpsRef}>--</span>
        </dd>
        <dt className="text-slate-400">Draw Calls</dt>
        <dd className="text-right">
          <span ref={drawsRef}>0</span>
        </dd>
        <dt className="text-slate-400">Triangles</dt>
        <dd className="text-right">
          <span ref={trisRef}>0</span>
        </dd>
        <dt className="text-slate-400">GPU Mem</dt>
        <dd className="text-right">
          <span ref={gpuMemRef}>0G / 0T</span>
        </dd>
        <dt className="text-slate-400">Physics Bodies</dt>
        <dd className="text-right">
          <span ref={bodiesRef}>0</span>
        </dd>
        <dt className="text-slate-400">Quality / DPR</dt>
        <dd className="text-right">
          <span ref={tierRef}>--</span>
        </dd>
        <dt className="text-slate-400">Chunks</dt>
        <dd className="text-right text-[11px] text-teal-200">
          <span ref={chunksRef}>0/0</span>
        </dd>
        <dt className="text-slate-400">JS Heap</dt>
        <dd className="text-right">
          <span ref={heapRef}>N/A</span>
        </dd>
        <dt className="text-slate-400">Position</dt>
        <dd className="text-right">
          <span ref={posRef}>0.00, 0.00, 0.00</span>
        </dd>
        <dt className="text-slate-400">State</dt>
        <dd className="text-right font-semibold">
          <span ref={groundedRef}>Grounded</span>
        </dd>
        <dt className="text-slate-400">Velocity</dt>
        <dd className="text-right">
          <span ref={velRef}>0.00, 0.00, 0.00 (0.0 m/s)</span>
        </dd>
      </dl>
    </aside>
  );
}
