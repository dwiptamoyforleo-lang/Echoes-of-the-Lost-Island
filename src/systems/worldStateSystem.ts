export interface WorldObjectState {
  chunkId?: string;
  collected?: boolean;
  opened?: boolean;
  activated?: boolean;
  solved?: boolean;
  position?: [number, number, number];
  phase?: number;
}

export type LevelWorldObjects = Record<string, WorldObjectState>;

export interface PersistedWorldState {
  levels: Record<string, LevelWorldObjects>;
}

export function createEmptyWorldState(): PersistedWorldState {
  return { levels: {} };
}

export function getWorldObjectState(
  worldState: PersistedWorldState,
  levelId: string,
  objectId: string,
): WorldObjectState | undefined {
  return worldState.levels[levelId]?.[objectId];
}

export function patchWorldObjectState(
  worldState: PersistedWorldState,
  levelId: string,
  objectId: string,
  patch: Partial<WorldObjectState>,
): PersistedWorldState {
  const prevLevel = worldState.levels[levelId] ?? {};
  const prevObj = prevLevel[objectId] ?? {};

  const nextObj: WorldObjectState = {
    ...prevObj,
    ...patch,
  };

  // Avoid creating new references if nothing actually changed
  const samePos =
    prevObj.position === nextObj.position ||
    (prevObj.position !== undefined &&
      nextObj.position !== undefined &&
      Math.abs(prevObj.position[0] - nextObj.position[0]) < 1e-4 &&
      Math.abs(prevObj.position[1] - nextObj.position[1]) < 1e-4 &&
      Math.abs(prevObj.position[2] - nextObj.position[2]) < 1e-4);

  if (
    prevObj.chunkId === nextObj.chunkId &&
    prevObj.collected === nextObj.collected &&
    prevObj.opened === nextObj.opened &&
    prevObj.activated === nextObj.activated &&
    prevObj.solved === nextObj.solved &&
    prevObj.phase === nextObj.phase &&
    samePos
  ) {
    return worldState;
  }

  return {
    levels: {
      ...worldState.levels,
      [levelId]: {
        ...prevLevel,
        [objectId]: nextObj,
      },
    },
  };
}

export function sanitizeWorldState(raw: unknown): PersistedWorldState {
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) {
    return createEmptyWorldState();
  }
  const rawRec = raw as Record<string, unknown>;
  const rawLevels = rawRec.levels;
  if (
    typeof rawLevels !== 'object' ||
    rawLevels === null ||
    Array.isArray(rawLevels)
  ) {
    return createEmptyWorldState();
  }

  const cleanLevels: Record<string, LevelWorldObjects> = {};
  for (const [levelId, levelVal] of Object.entries(
    rawLevels as Record<string, unknown>,
  )) {
    if (
      typeof levelVal !== 'object' ||
      levelVal === null ||
      Array.isArray(levelVal)
    ) {
      continue;
    }
    const cleanObjs: LevelWorldObjects = {};
    for (const [objId, objVal] of Object.entries(
      levelVal as Record<string, unknown>,
    )) {
      if (
        typeof objVal !== 'object' ||
        objVal === null ||
        Array.isArray(objVal)
      ) {
        continue;
      }
      const o = objVal as Record<string, unknown>;
      const entry: WorldObjectState = {};
      if (typeof o.chunkId === 'string') entry.chunkId = o.chunkId;
      if (typeof o.collected === 'boolean') entry.collected = o.collected;
      if (typeof o.opened === 'boolean') entry.opened = o.opened;
      if (typeof o.activated === 'boolean') entry.activated = o.activated;
      if (typeof o.solved === 'boolean') entry.solved = o.solved;
      if (typeof o.phase === 'number' && Number.isFinite(o.phase)) {
        entry.phase = o.phase;
      }
      if (
        Array.isArray(o.position) &&
        o.position.length === 3 &&
        o.position.every((n) => typeof n === 'number' && Number.isFinite(n))
      ) {
        entry.position = [o.position[0], o.position[1], o.position[2]];
      }
      cleanObjs[objId] = entry;
    }
    cleanLevels[levelId] = cleanObjs;
  }

  return { levels: cleanLevels };
}
