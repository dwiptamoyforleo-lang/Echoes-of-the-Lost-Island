import { Suspense, useEffect, useRef, useState, type ReactNode } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { playerTelemetry } from '@/src/game/player/playerTelemetry';
import { getQualityPreset } from '@/src/game/rendering/adaptiveQuality';
import { performanceTelemetry } from '@/src/game/rendering/performanceTelemetry';
import { useGameStore } from '@/src/state/gameStore';
import {
  unloadAllChunkAudio,
  unloadChunkAudio,
} from '@/src/systems/audioSystem';
import type { LevelId } from '@/src/systems/progressionSystem';
import {
  evaluateChunkStreaming,
  type ChunkDefinition,
} from './chunkStreaming';

const STREAM_CHECK_INTERVAL_MS = 180;

const _projScreenMatrix = new THREE.Matrix4();
const _frustum = new THREE.Frustum();
const _sphere = new THREE.Sphere();

function listsEqual(a: readonly string[], b: readonly string[]): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    if (a[i] !== b[i]) return false;
  }
  return true;
}

function resolveChunkLabels(
  chunks: readonly ChunkDefinition[],
  loadedIds: readonly string[],
): string[] {
  const labels: string[] = [];
  for (let i = 0; i < chunks.length; i++) {
    const c = chunks[i];
    if (loadedIds.includes(c.id)) {
      labels.push(c.label);
    }
  }
  return labels;
}

function ChunkSlot({
  chunkId,
  children,
}: {
  chunkId: string;
  children: ReactNode;
}) {
  useEffect(() => {
    return () => {
      unloadChunkAudio(chunkId);
    };
  }, [chunkId]);

  return <group name={`chunk-${chunkId}`}>{children}</group>;
}

export interface ChunkManagerProps {
  levelId: LevelId;
  chunks: readonly ChunkDefinition[];
  visibleChunksRef?: { current: Set<string> };
  renderChunk: (chunkId: string) => ReactNode;
  onStreamingPendingChange?: (pending: boolean) => void;
}

export function ChunkManager({
  levelId,
  chunks,
  visibleChunksRef,
  renderChunk,
  onStreamingPendingChange,
}: ChunkManagerProps) {
  const { camera } = useThree();
  const activeTier = useGameStore((s) => s.activeQualityTier);
  const rangeScale = getQualityPreset(activeTier).chunkRangeScale;
  const rangeScaleRef = useRef(rangeScale);
  rangeScaleRef.current = rangeScale;

  const lastHeavyOpMsRef = useRef(-1000);
  const lastStreamEvalMsRef = useRef(-1000);
  const pendingFlagRef = useRef(false);

  const onPendingRef = useRef(onStreamingPendingChange);
  onPendingRef.current = onStreamingPendingChange;

  const [loadedIds, setLoadedIds] = useState<string[]>(() => {
    const initial = evaluateChunkStreaming({
      chunks,
      currentlyLoaded: [],
      playerPos: playerTelemetry.position,
      playerVel: playerTelemetry.velocity,
      nowMs: 1000,
      lastHeavyOpMs: -1000,
      rangeScale,
    });
    performanceTelemetry.loadedChunks = initial.nextLoaded;
    performanceTelemetry.loadedChunkLabels = resolveChunkLabels(
      chunks,
      initial.nextLoaded,
    );
    performanceTelemetry.totalChunks = chunks.length;
    performanceTelemetry.pendingChunkLoads = initial.pendingCount;
    return initial.nextLoaded;
  });

  const loadedIdsRef = useRef<string[]>(loadedIds);
  loadedIdsRef.current = loadedIds;

  // Reset chunk set when level or chunk definition changes
  useEffect(() => {
    const initial = evaluateChunkStreaming({
      chunks,
      currentlyLoaded: [],
      playerPos: playerTelemetry.position,
      playerVel: playerTelemetry.velocity,
      nowMs: performance.now(),
      lastHeavyOpMs: -1000,
      rangeScale: rangeScaleRef.current,
    });
    lastStreamEvalMsRef.current = -1000;
    loadedIdsRef.current = initial.nextLoaded;
    setLoadedIds(initial.nextLoaded);
    performanceTelemetry.loadedChunks = initial.nextLoaded;
    performanceTelemetry.loadedChunkLabels = resolveChunkLabels(
      chunks,
      initial.nextLoaded,
    );
    performanceTelemetry.totalChunks = chunks.length;
    performanceTelemetry.pendingChunkLoads = initial.pendingCount;

    return () => {
      unloadAllChunkAudio();
      if (pendingFlagRef.current) {
        pendingFlagRef.current = false;
        onPendingRef.current?.(false);
      }
    };
  }, [levelId, chunks]);

  useFrame(() => {
    const nowMs = performance.now();
    if (nowMs - lastStreamEvalMsRef.current >= STREAM_CHECK_INTERVAL_MS) {
      lastStreamEvalMsRef.current = nowMs;
      const res = evaluateChunkStreaming({
        chunks,
        currentlyLoaded: loadedIdsRef.current,
        playerPos: playerTelemetry.position,
        playerVel: playerTelemetry.velocity,
        nowMs,
        lastHeavyOpMs: lastHeavyOpMsRef.current,
        rangeScale: rangeScaleRef.current,
      });

      if (res.didHeavyOp) {
        lastHeavyOpMsRef.current = nowMs;
      }

      if (!listsEqual(res.nextLoaded, loadedIdsRef.current)) {
        loadedIdsRef.current = res.nextLoaded;
        setLoadedIds(res.nextLoaded);
        performanceTelemetry.loadedChunkLabels = resolveChunkLabels(
          chunks,
          res.nextLoaded,
        );
      }

      performanceTelemetry.loadedChunks = loadedIdsRef.current;
      performanceTelemetry.totalChunks = chunks.length;
      performanceTelemetry.pendingChunkLoads = res.pendingCount;

      const nextPending = res.pendingCount > 0;
      if (nextPending !== pendingFlagRef.current) {
        pendingFlagRef.current = nextPending;
        onPendingRef.current?.(nextPending);
      }
    }

    // Frustum visibility check across loaded chunks (zero heap allocation)
    _projScreenMatrix.multiplyMatrices(
      camera.projectionMatrix,
      camera.matrixWorldInverse,
    );
    _frustum.setFromProjectionMatrix(_projScreenMatrix);

    let visibleCount = 0;
    const visSet = visibleChunksRef?.current;
    visSet?.clear();

    for (let i = 0; i < chunks.length; i++) {
      const c = chunks[i];
      if (!loadedIdsRef.current.includes(c.id)) continue;
      _sphere.center.set(c.center[0], c.center[1], c.center[2]);
      _sphere.radius = c.boundsRadius + 6;
      if (_frustum.intersectsSphere(_sphere)) {
        visibleCount += 1;
        visSet?.add(c.id);
      }
    }

    performanceTelemetry.visibleChunks = visibleCount;
  });

  return (
    <group name={`chunk-manager-${levelId}`}>
      {loadedIds.map((chunkId) => (
        <ChunkSlot key={chunkId} chunkId={chunkId}>
          <Suspense fallback={null}>{renderChunk(chunkId)}</Suspense>
        </ChunkSlot>
      ))}
    </group>
  );
}
