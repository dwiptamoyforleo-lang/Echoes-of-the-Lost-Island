import {
  resolveItemDefinition,
  type InventoryItem,
} from './inventorySystem';
import {
  LEVEL_IDS,
  createInitialProgression,
  getLevelMetadata,
  isLevelId,
  type LevelId,
  type LevelProgress,
} from './progressionSystem';
import { createInitialQuests, type QuestObjective } from './questSystem';
import {
  createEmptyWorldState,
  sanitizeWorldState,
  type PersistedWorldState,
} from './worldStateSystem';

export const SAVE_STORAGE_KEY = 'journey-home-save-v1';
export const SETTINGS_STORAGE_KEY = 'journey-home-settings-v1';
export const SAVE_VERSION = 1;

const LEGACY_SAVE_STORAGE_KEY = 'echoes_lost_island_save_v1';
const LEGACY_SETTINGS_STORAGE_KEY = 'echoes_lost_island_settings_v1';

export function migrateLegacyStorage(storage: StorageLike | null = getBrowserStorage()): void {
  if (!storage) return;

  const migrations: Array<[string, string]> = [
    [LEGACY_SAVE_STORAGE_KEY, SAVE_STORAGE_KEY],
    [LEGACY_SETTINGS_STORAGE_KEY, SETTINGS_STORAGE_KEY],
  ];

  for (const [legacyKey, currentKey] of migrations) {
    try {
      const currentValue = storage.getItem(currentKey);
      const legacyValue = storage.getItem(legacyKey);
      if (!currentValue && legacyValue !== null) {
        storage.setItem(currentKey, legacyValue);
        storage.removeItem(legacyKey);
      }
    } catch {
      // Restricted storage or corrupt entries must never prevent startup.
    }
  }
}

migrateLegacyStorage();

export type GraphicsQuality = 'auto' | 'low' | 'medium' | 'high';

export interface GameSettings {
  graphicsQuality: GraphicsQuality;
  masterVolume: number;
  musicVolume: number;
  sfxVolume: number;
  mouseSensitivity: number;
  cameraSensitivity: number;
  invertY: boolean;
}

export const DEFAULT_SETTINGS: GameSettings = {
  graphicsQuality: 'auto',
  masterVolume: 0.8,
  musicVolume: 0.7,
  sfxVolume: 0.85,
  mouseSensitivity: 1.0,
  cameraSensitivity: 1.0,
  invertY: false,
};

export interface SaveDataV1 {
  version: typeof SAVE_VERSION;
  updatedAt: number;
  currentLevel: LevelId | 'testArena';
  levelElapsedSeconds: number;
  checkpointPos: [number, number, number];
  activatedIds: Record<string, boolean>;
  keys: string[];
  collectedCrystalIds: string[];
  foundChestIds: string[];
  progression: Record<LevelId, LevelProgress>;
  inventory: InventoryItem[];
  quests: Record<LevelId, QuestObjective[]>;
  fragments: string[];
  settings: GameSettings;
  playtimeSeconds: number;
  worldState?: PersistedWorldState;
  gameCompleted?: boolean;
}

export interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

export interface LoadSaveResult {
  data: SaveDataV1 | null;
  corrupted: boolean;
}

function getBrowserStorage(): StorageLike | null {
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      return window.localStorage;
    }
  } catch {
    return null;
  }
  return null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function sanitizeStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const item of value) {
    if (typeof item === 'string' && item.length > 0 && !seen.has(item)) {
      seen.add(item);
      out.push(item);
    }
  }
  return out;
}

function sanitizeCheckpoint(value: unknown): [number, number, number] {
  if (
    Array.isArray(value) &&
    value.length === 3 &&
    value.every((n) => typeof n === 'number' && Number.isFinite(n))
  ) {
    return [value[0], value[1], value[2]];
  }
  return [0, 1.5, 25];
}

function sanitizeProgression(
  raw: unknown,
  fallbackCrystalIds: string[],
  fallbackChestIds: string[],
): Record<LevelId, LevelProgress> {
  const base = createInitialProgression();
  if (!isRecord(raw)) return base;

  for (const id of LEVEL_IDS) {
    const entry = raw[id];
    const meta = getLevelMetadata(id);
    if (!isRecord(entry)) continue;

    const crystalIds = sanitizeStringArray(entry.collectedCrystalIds);
    const mergedCrystalIds =
      id === 'level1' && crystalIds.length === 0
        ? fallbackCrystalIds
        : crystalIds;

    const chestIds = sanitizeStringArray(entry.foundChestIds);
    const mergedChestIds =
      id === 'level1' && chestIds.length === 0 ? fallbackChestIds : chestIds;

    base[id] = {
      levelId: id,
      unlocked:
        id === 'level1'
          ? true
          : typeof entry.unlocked === 'boolean'
            ? entry.unlocked
            : base[id].unlocked,
      completed: Boolean(entry.completed),
      collectedCrystalIds: mergedCrystalIds,
      crystalsCollected: mergedCrystalIds.length,
      totalCrystals: meta.totalCrystals,
      fragmentCollected: Boolean(entry.fragmentCollected),
      foundChestIds: mergedChestIds,
      chestFound: Boolean(entry.chestFound) || mergedChestIds.length > 0,
      bestTimeSeconds:
        typeof entry.bestTimeSeconds === 'number' &&
        Number.isFinite(entry.bestTimeSeconds) &&
        entry.bestTimeSeconds >= 0
          ? entry.bestTimeSeconds
          : null,
    };
  }

  return base;
}

function sanitizeInventory(raw: unknown): InventoryItem[] {
  if (!Array.isArray(raw)) return [];
  const out: InventoryItem[] = [];
  const seen = new Set<string>();
  for (const item of raw) {
    if (!isRecord(item) || typeof item.id !== 'string' || seen.has(item.id)) {
      continue;
    }
    seen.add(item.id);
    const def = resolveItemDefinition(item.id);
    const qty =
      typeof item.quantity === 'number' &&
      Number.isFinite(item.quantity) &&
      item.quantity >= 1
        ? Math.floor(item.quantity)
        : 1;
    out.push({
      ...def,
      quantity: qty,
    });
  }
  return out;
}

function sanitizeQuests(raw: unknown): Record<LevelId, QuestObjective[]> {
  const base = createInitialQuests();
  if (!isRecord(raw)) return base;

  for (const levelId of LEVEL_IDS) {
    const rawList = raw[levelId];
    if (!Array.isArray(rawList)) continue;

    const byId = new Map<string, Record<string, unknown>>();
    for (const item of rawList) {
      if (isRecord(item) && typeof item.id === 'string') {
        byId.set(item.id, item);
      }
    }

    base[levelId] = base[levelId].map((defObj) => {
      const saved = byId.get(defObj.id);
      if (!saved) return defObj;
      const cur =
        typeof saved.current === 'number' && Number.isFinite(saved.current)
          ? Math.max(0, Math.min(defObj.target, Math.floor(saved.current)))
          : defObj.current;
      const completed = Boolean(saved.completed) || cur >= defObj.target;
      return {
        ...defObj,
        current: completed ? defObj.target : cur,
        completed,
      };
    });
  }

  return base;
}

export function serializeSaveData(data: SaveDataV1): string {
  return JSON.stringify(data);
}

export function parseSaveData(raw: string): LoadSaveResult {
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!isRecord(parsed) || parsed.version !== SAVE_VERSION) {
      return { data: null, corrupted: true };
    }

    const currentLevel =
      typeof parsed.currentLevel === 'string' &&
      (parsed.currentLevel === 'testArena' || isLevelId(parsed.currentLevel))
        ? parsed.currentLevel
        : 'level1';

    const collectedCrystalIds = sanitizeStringArray(parsed.collectedCrystalIds);
    const foundChestIds = sanitizeStringArray(parsed.foundChestIds);

    const activatedIds: Record<string, boolean> = {};
    if (isRecord(parsed.activatedIds)) {
      for (const [k, v] of Object.entries(parsed.activatedIds)) {
        if (typeof v === 'boolean') {
          activatedIds[k] = v;
        }
      }
    }

    const settings = sanitizeSettings(parsed.settings);

    const data: SaveDataV1 = {
      version: SAVE_VERSION,
      updatedAt:
        typeof parsed.updatedAt === 'number' && Number.isFinite(parsed.updatedAt)
          ? parsed.updatedAt
          : Date.now(),
      currentLevel,
      levelElapsedSeconds:
        typeof parsed.levelElapsedSeconds === 'number' &&
        Number.isFinite(parsed.levelElapsedSeconds) &&
        parsed.levelElapsedSeconds >= 0
          ? parsed.levelElapsedSeconds
          : 0,
      checkpointPos: sanitizeCheckpoint(parsed.checkpointPos),
      activatedIds,
      keys: sanitizeStringArray(parsed.keys),
      collectedCrystalIds,
      foundChestIds,
      progression: sanitizeProgression(
        parsed.progression,
        collectedCrystalIds,
        foundChestIds,
      ),
      inventory: sanitizeInventory(parsed.inventory),
      quests: sanitizeQuests(parsed.quests),
      fragments: sanitizeStringArray(parsed.fragments),
      settings,
      playtimeSeconds:
        typeof parsed.playtimeSeconds === 'number' &&
        Number.isFinite(parsed.playtimeSeconds) &&
        parsed.playtimeSeconds >= 0
          ? parsed.playtimeSeconds
          : 0,
      worldState: parsed.worldState
        ? sanitizeWorldState(parsed.worldState)
        : createEmptyWorldState(),
      gameCompleted: Boolean(parsed.gameCompleted),
    };

    return { data, corrupted: false };
  } catch {
    return { data: null, corrupted: true };
  }
}

export function saveToStorage(
  data: SaveDataV1,
  storage: StorageLike | null = getBrowserStorage(),
): boolean {
  if (!storage) return false;
  try {
    storage.setItem(SAVE_STORAGE_KEY, serializeSaveData(data));
    return true;
  } catch {
    return false;
  }
}

export function loadFromStorage(
  storage: StorageLike | null = getBrowserStorage(),
): LoadSaveResult {
  if (!storage) return { data: null, corrupted: false };
  try {
    const raw = storage.getItem(SAVE_STORAGE_KEY);
    if (!raw) return { data: null, corrupted: false };
    return parseSaveData(raw);
  } catch {
    return { data: null, corrupted: true };
  }
}

export function hasSaveInStorage(
  storage: StorageLike | null = getBrowserStorage(),
): boolean {
  const { data } = loadFromStorage(storage);
  return data !== null;
}

export function sanitizeSettings(raw: unknown): GameSettings {
  const rawSettings = isRecord(raw) ? raw : {};
  const clamp01 = (val: unknown, fallback: number) =>
    typeof val === 'number' && Number.isFinite(val)
      ? Math.max(0, Math.min(1, val))
      : fallback;
  const clampSens = (val: unknown, fallback: number) =>
    typeof val === 'number' && Number.isFinite(val)
      ? Math.max(0.2, Math.min(3, val))
      : fallback;

  const graphicsQuality: GraphicsQuality =
    rawSettings.graphicsQuality === 'auto' ||
    rawSettings.graphicsQuality === 'low' ||
    rawSettings.graphicsQuality === 'medium' ||
    rawSettings.graphicsQuality === 'high'
      ? rawSettings.graphicsQuality
      : DEFAULT_SETTINGS.graphicsQuality;

  return {
    graphicsQuality,
    masterVolume: clamp01(rawSettings.masterVolume, DEFAULT_SETTINGS.masterVolume),
    musicVolume: clamp01(rawSettings.musicVolume, DEFAULT_SETTINGS.musicVolume),
    sfxVolume: clamp01(rawSettings.sfxVolume, DEFAULT_SETTINGS.sfxVolume),
    mouseSensitivity: clampSens(
      rawSettings.mouseSensitivity,
      DEFAULT_SETTINGS.mouseSensitivity,
    ),
    cameraSensitivity: clampSens(
      rawSettings.cameraSensitivity,
      DEFAULT_SETTINGS.cameraSensitivity,
    ),
    invertY:
      typeof rawSettings.invertY === 'boolean'
        ? rawSettings.invertY
        : DEFAULT_SETTINGS.invertY,
  };
}

export function saveSettingsToStorage(
  settings: GameSettings,
  storage: StorageLike | null = getBrowserStorage(),
): boolean {
  if (!storage) return false;
  try {
    storage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(settings));
    return true;
  } catch {
    return false;
  }
}

export function loadSettingsFromStorage(
  storage: StorageLike | null = getBrowserStorage(),
): GameSettings {
  if (!storage) return { ...DEFAULT_SETTINGS };
  try {
    const raw = storage.getItem(SETTINGS_STORAGE_KEY);
    if (!raw) return { ...DEFAULT_SETTINGS };
    return sanitizeSettings(JSON.parse(raw));
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

export function clearStorageSave(
  storage: StorageLike | null = getBrowserStorage(),
): void {
  if (!storage) return;
  try {
    storage.removeItem(SAVE_STORAGE_KEY);
  } catch {
    // Ignore storage removal errors in restricted environments
  }
}
