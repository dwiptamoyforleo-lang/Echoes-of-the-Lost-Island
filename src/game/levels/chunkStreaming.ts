export interface ChunkDefinition {
  id: string;
  label: string;
  center: [number, number, number];
  boundsRadius: number;
  loadRadius: number;
  unloadRadius: number;
  heavy?: boolean;
  isInterior?: boolean;
}

export interface ChunkEvalInput {
  chunks: readonly ChunkDefinition[];
  currentlyLoaded: readonly string[];
  playerPos: { x: number; y: number; z: number };
  playerVel: { x: number; y: number; z: number };
  nowMs: number;
  lastHeavyOpMs: number;
  heavyOpCooldownMs?: number;
}

export interface ChunkEvalResult {
  nextLoaded: string[];
  currentChunkId: string | null;
  pendingCount: number;
  didHeavyOp: boolean;
}

export function evaluateChunkStreaming(input: ChunkEvalInput): ChunkEvalResult {
  const {
    chunks,
    currentlyLoaded,
    playerPos,
    playerVel,
    nowMs,
    lastHeavyOpMs,
    heavyOpCooldownMs = 90,
  } = input;

  if (chunks.length === 0) {
    return {
      nextLoaded: [],
      currentChunkId: null,
      pendingCount: 0,
      didHeavyOp: false,
    };
  }

  const loadedSet = new Set(currentlyLoaded);
  const velMag = Math.hypot(playerVel.x, playerVel.z);
  const vx = velMag > 0.25 ? playerVel.x / velMag : 0;
  const vz = velMag > 0.25 ? playerVel.z / velMag : 0;

  let currentChunkId: string | null = null;
  let closestDist = Infinity;

  const metrics = chunks.map((chunk) => {
    const dx = chunk.center[0] - playerPos.x;
    const dz = chunk.center[2] - playerPos.z;
    const dist = Math.hypot(dx, dz);

    if (dist < closestDist) {
      closestDist = dist;
      currentChunkId = chunk.id;
    }

    // Priority: negative distance minus approach velocity bonus so chunks player walks toward load first
    let approachBonus = 0;
    if (dist > 0.5 && velMag > 0.25) {
      const dirX = dx / dist;
      const dirZ = dz / dist;
      approachBonus = (dirX * vx + dirZ * vz) * 14;
    }

    return {
      chunk,
      dist,
      priority: -dist + approachBonus,
    };
  });

  // Ensure the chunk the player is physically inside (or nearest if slightly out of bounds) stays pinned
  const pinnedInside = metrics.find((m) => m.dist <= m.chunk.boundsRadius);
  if (pinnedInside) {
    currentChunkId = pinnedInside.chunk.id;
  }

  const desiredToLoad: { id: string; heavy: boolean; priority: number }[] = [];
  const desiredToUnload: { id: string; heavy: boolean; dist: number }[] = [];

  for (const m of metrics) {
    const isLoaded = loadedSet.has(m.chunk.id);
    const isPinned = m.chunk.id === currentChunkId;

    if (!isLoaded) {
      if (isPinned || m.dist <= m.chunk.loadRadius) {
        desiredToLoad.push({
          id: m.chunk.id,
          heavy: Boolean(m.chunk.heavy),
          priority: isPinned ? 1e6 : m.priority,
        });
      }
    } else if (!isPinned && m.dist > m.chunk.unloadRadius) {
      desiredToUnload.push({
        id: m.chunk.id,
        heavy: Boolean(m.chunk.heavy),
        dist: m.dist,
      });
    }
  }

  // Sort loads by highest priority (pinned + player movement direction), unloads by furthest first
  desiredToLoad.sort((a, b) => b.priority - a.priority);
  desiredToUnload.sort((a, b) => b.dist - a.dist);

  const canDoHeavy = nowMs - lastHeavyOpMs >= heavyOpCooldownMs;
  let heavyOpUsed = false;
  let didHeavyOp = false;

  // Mount pinned chunk immediately if missing, plus at most 1 heavy chunk per cooldown window
  for (const item of desiredToLoad) {
    const isPinned = item.id === currentChunkId;
    if (item.heavy && !isPinned) {
      if (!canDoHeavy || heavyOpUsed) {
        continue;
      }
      heavyOpUsed = true;
      didHeavyOp = true;
    }
    loadedSet.add(item.id);
  }

  // Unload at most 1 heavy chunk per cooldown window so teardown never hitches frame time
  for (const item of desiredToUnload) {
    if (item.heavy) {
      if (!canDoHeavy || heavyOpUsed) {
        continue;
      }
      heavyOpUsed = true;
      didHeavyOp = true;
    }
    loadedSet.delete(item.id);
  }

  const nextLoaded = chunks
    .filter((c) => loadedSet.has(c.id))
    .map((c) => c.id);

  const remainingPending = desiredToLoad.filter(
    (d) => !loadedSet.has(d.id),
  ).length;

  return {
    nextLoaded,
    currentChunkId,
    pendingCount: remainingPending,
    didHeavyOp,
  };
}
