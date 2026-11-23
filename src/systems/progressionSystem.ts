export type LevelId = 'level1' | 'level2' | 'level3' | 'level4' | 'level5';

export interface LevelMetadata {
  id: LevelId;
  order: number;
  name: string;
  description: string;
  prerequisiteId: LevelId | null;
  nextLevelId: LevelId | null;
  totalCrystals: number;
  totalChests: number;
  fragmentId: string;
  fragmentName: string;
}

export interface LevelProgress {
  levelId: LevelId;
  unlocked: boolean;
  completed: boolean;
  crystalsCollected: number;
  totalCrystals: number;
  collectedCrystalIds: string[];
  fragmentCollected: boolean;
  chestFound: boolean;
  foundChestIds: string[];
  bestTimeSeconds: number | null;
}

export const LEVEL_CATALOG: readonly LevelMetadata[] = [
  {
    id: 'level1',
    order: 1,
    name: 'The Forgotten Shore',
    description:
      'Explore the sun-bleached coast, awaken three ancient seals, and recover the Echo of the Tides.',
    prerequisiteId: null,
    nextLevelId: 'level2',
    totalCrystals: 20,
    totalChests: 1,
    fragmentId: 'fragment-1',
    fragmentName: 'Echo of the Tides',
  },
  {
    id: 'level2',
    order: 2,
    name: 'Whispering Woods',
    description:
      'Explore mist-shrouded ancient woods, awaken three spirit totems in order, lower the river drawbridge, and recover the Echo of the Gale.',
    prerequisiteId: 'level1',
    nextLevelId: 'level3',
    totalCrystals: 25,
    totalChests: 1,
    fragmentId: 'fragment-2',
    fragmentName: 'Echo of the Gale',
  },
  {
    id: 'level3',
    order: 3,
    name: 'The Sunken Kingdom',
    description:
      'Descend into torch-lit subterranean halls, drain the flooded cistern, align the four guardian statues, and claim the Echo of the Stars.',
    prerequisiteId: 'level2',
    nextLevelId: 'level4',
    totalCrystals: 30,
    totalChests: 2,
    fragmentId: 'fragment-3',
    fragmentName: 'Echo of the Stars',
  },
  {
    id: 'level4',
    order: 4,
    name: 'Obsidian Caldera',
    description:
      'Cross basalt ridges and thermal vents ringing the dormant heart of the island.',
    prerequisiteId: 'level3',
    nextLevelId: 'level5',
    totalCrystals: 20,
    totalChests: 1,
    fragmentId: 'fragment-4',
    fragmentName: 'Echo of the Ember',
  },
  {
    id: 'level5',
    order: 5,
    name: 'Heart of the Spire',
    description:
      'Reunite all five ancient echoes at the summit sanctum to reawaken the island.',
    prerequisiteId: 'level4',
    nextLevelId: null,
    totalCrystals: 20,
    totalChests: 1,
    fragmentId: 'fragment-5',
    fragmentName: 'Echo of Eternity',
  },
];

export const LEVEL_IDS: readonly LevelId[] = LEVEL_CATALOG.map((l) => l.id);

export function isLevelId(value: string): value is LevelId {
  return LEVEL_IDS.includes(value as LevelId);
}

export function getLevelMetadata(levelId: LevelId): LevelMetadata {
  const found = LEVEL_CATALOG.find((l) => l.id === levelId);
  return found ?? LEVEL_CATALOG[0];
}

export function createInitialProgression(): Record<LevelId, LevelProgress> {
  const result = {} as Record<LevelId, LevelProgress>;
  for (const meta of LEVEL_CATALOG) {
    result[meta.id] = {
      levelId: meta.id,
      unlocked: meta.prerequisiteId === null,
      completed: false,
      crystalsCollected: 0,
      totalCrystals: meta.totalCrystals,
      collectedCrystalIds: [],
      fragmentCollected: false,
      chestFound: false,
      foundChestIds: [],
      bestTimeSeconds: null,
    };
  }
  return result;
}

export function recordLevelCrystal(
  progression: Record<LevelId, LevelProgress>,
  levelId: LevelId,
  crystalId: string,
): Record<LevelId, LevelProgress> {
  const entry = progression[levelId];
  if (!entry || entry.collectedCrystalIds.includes(crystalId)) {
    return progression;
  }
  const nextIds = [...entry.collectedCrystalIds, crystalId];
  return {
    ...progression,
    [levelId]: {
      ...entry,
      collectedCrystalIds: nextIds,
      crystalsCollected: nextIds.length,
    },
  };
}

export function recordLevelChest(
  progression: Record<LevelId, LevelProgress>,
  levelId: LevelId,
  chestId: string,
): Record<LevelId, LevelProgress> {
  const entry = progression[levelId];
  if (!entry || entry.foundChestIds.includes(chestId)) {
    return progression;
  }
  const nextIds = [...entry.foundChestIds, chestId];
  return {
    ...progression,
    [levelId]: {
      ...entry,
      foundChestIds: nextIds,
      chestFound: nextIds.length > 0,
    },
  };
}

export function recordLevelFragment(
  progression: Record<LevelId, LevelProgress>,
  levelId: LevelId,
): Record<LevelId, LevelProgress> {
  const entry = progression[levelId];
  if (!entry || entry.fragmentCollected) {
    return progression;
  }
  return {
    ...progression,
    [levelId]: {
      ...entry,
      fragmentCollected: true,
    },
  };
}

export function completeLevelProgress(
  progression: Record<LevelId, LevelProgress>,
  levelId: LevelId,
  runTimeSeconds: number,
): Record<LevelId, LevelProgress> {
  const entry = progression[levelId];
  if (!entry) return progression;

  const cleanTime =
    Number.isFinite(runTimeSeconds) && runTimeSeconds >= 0
      ? Math.round(runTimeSeconds * 10) / 10
      : null;

  const nextBestTime =
    cleanTime === null
      ? entry.bestTimeSeconds
      : entry.bestTimeSeconds === null
        ? cleanTime
        : Math.min(entry.bestTimeSeconds, cleanTime);

  const nextProgression: Record<LevelId, LevelProgress> = {
    ...progression,
    [levelId]: {
      ...entry,
      unlocked: true,
      completed: true,
      fragmentCollected: true,
      bestTimeSeconds: nextBestTime,
    },
  };

  const meta = getLevelMetadata(levelId);
  if (meta.nextLevelId && nextProgression[meta.nextLevelId]) {
    nextProgression[meta.nextLevelId] = {
      ...nextProgression[meta.nextLevelId],
      unlocked: true,
    };
  }

  return nextProgression;
}

export function unlockAllProgression(
  progression: Record<LevelId, LevelProgress>,
): Record<LevelId, LevelProgress> {
  const next = { ...progression };
  for (const id of LEVEL_IDS) {
    next[id] = {
      ...next[id],
      unlocked: true,
    };
  }
  return next;
}
