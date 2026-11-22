import { create } from 'zustand';
import {
  addItemToInventory,
  consumeItemFromInventory,
  resolveItemDefinition,
  type InventoryItem,
} from '@/src/systems/inventorySystem';
import {
  completeLevelProgress,
  createInitialProgression,
  getLevelMetadata,
  isLevelId,
  recordLevelChest,
  recordLevelCrystal,
  recordLevelFragment,
  unlockAllProgression,
  type LevelId,
  type LevelProgress,
} from '@/src/systems/progressionSystem';
import {
  applyQuestEvent,
  createInitialQuests,
  formatObjectiveLabel,
  getActiveObjective,
  type QuestObjective,
} from '@/src/systems/questSystem';
import { applyAudioSettings, playPooledSynth } from '@/src/systems/audioSystem';
import {
  DEFAULT_SETTINGS,
  clearStorageSave,
  loadFromStorage,
  loadSettingsFromStorage,
  saveSettingsToStorage,
  saveToStorage,
  type GameSettings,
  type SaveDataV1,
  type StorageLike,
} from '@/src/systems/saveSystem';
import {
  createEmptyWorldState,
  getWorldObjectState as readWorldObj,
  patchWorldObjectState,
  type PersistedWorldState,
  type WorldObjectState,
} from '@/src/systems/worldStateSystem';
import {
  detectDeviceProfile,
  resolveInitialTier,
  type EffectiveQualityTier,
} from '@/src/game/rendering/adaptiveQuality';
import { eventBus } from './eventBus';

export type GameScreen =
  | 'mainMenu'
  | 'worldMap'
  | 'playing'
  | 'paused'
  | 'levelComplete'
  | 'settings'
  | 'credits'
  | 'intro'
  | 'ending';

export type ActiveOverlay = 'none' | 'inventory' | 'quests';

export type ActiveLevelId = LevelId | 'testArena';

export interface ActivePrompt {
  id: string;
  label: string;
}

export interface InscriptionData {
  title: string;
  body: string;
}

export type ToastKind = 'info' | 'crystal' | 'objective' | 'fragment' | 'save';

export interface ToastNotification {
  id: number;
  message: string;
  kind: ToastKind;
}

export interface GameState {
  screen: GameScreen;
  activeLevel: ActiveLevelId;
  activeOverlay: ActiveOverlay;
  settingsReturnScreen: GameScreen;
  levelLoading: boolean;
  loadingTitle: string;
  runId: number;
  debugVisible: boolean;
  systemsDebugVisible: boolean;
  qaVisible: boolean;
  streamingPending: boolean;
  activeQualityTier: EffectiveQualityTier;
  inventoryVisible: boolean;
  crystals: number;
  totalCrystals: number;
  keys: string[];
  inventory: string[];
  inventoryItems: InventoryItem[];
  activatedIds: Record<string, boolean>;
  collectedIds: Record<string, boolean>;
  foundChestIds: string[];
  worldState: PersistedWorldState;
  progression: Record<LevelId, LevelProgress>;
  quests: Record<LevelId, QuestObjective[]>;
  recoveredFragments: string[];
  settings: GameSettings;
  playtimeSeconds: number;
  levelElapsedSeconds: number;
  hasSavedGame: boolean;
  saveCorruptedNotice: boolean;

  activePrompt: ActivePrompt | null;
  activeInscription: InscriptionData | null;
  objectiveText: string;
  toastMessage: string | null;
  toasts: ToastNotification[];
  checkpointPos: [number, number, number];
  recoveredFragmentName: string | null;

  setScreen: (screen: GameScreen) => void;
  startLevel: (level: ActiveLevelId) => void;
  continueSavedGame: (storage?: StorageLike | null) => boolean;
  newGame: (storage?: StorageLike | null) => void;
  beginNewGameWithIntro: (storage?: StorageLike | null) => void;
  finishIntro: () => void;
  finishLevelLoading: () => void;
  openSettings: (returnTo?: GameScreen) => void;
  closeSettings: () => void;
  resetProgress: (storage?: StorageLike | null) => void;
  saveCurrentGame: (manual?: boolean, storage?: StorageLike | null) => boolean;
  scheduleDebouncedSave: () => void;
  togglePause: () => void;
  toggleDebug: () => void;
  toggleSystemsDebug: () => void;
  toggleQaOverlay: () => void;
  setStreamingPending: (pending: boolean) => void;
  setActiveQualityTier: (tier: EffectiveQualityTier) => void;
  setWorldObjectState: (
    objectId: string,
    patch: Partial<WorldObjectState>,
    levelId?: ActiveLevelId,
  ) => void;
  getWorldObjectState: (
    objectId: string,
    levelId?: ActiveLevelId,
  ) => WorldObjectState | undefined;
  setActiveOverlay: (overlay: ActiveOverlay) => void;
  toggleInventory: () => void;
  toggleQuestLog: () => void;
  reset: () => void;

  setActivated: (id: string, active: boolean) => void;
  markCollected: (id: string) => boolean;
  addCrystal: (id: string) => boolean;
  addKey: (keyId: string, label?: string) => void;
  consumeKey: (keyId: string) => void;
  unlockDoor: (doorId: string, keyId?: string, keyLabel?: string) => void;
  openChest: (chestId: string, rewardItem: string) => boolean;
  collectFragment: (fragmentId: string, fragmentName: string) => void;
  addInventoryItem: (item: string) => void;
  tickPlaytime: (seconds: number) => void;
  updateSettings: (partial: Partial<GameSettings>) => void;

  setActivePrompt: (prompt: ActivePrompt | null) => void;
  clearActivePromptIfId: (id: string) => void;
  openInscription: (data: InscriptionData) => void;
  closeInscription: () => void;
  setObjectiveText: (text: string) => void;
  showToast: (message: string | null, kind?: ToastKind) => void;
  dismissToast: (id: number) => void;
  setCheckpoint: (pos: [number, number, number]) => void;
  completeLevel: (fragmentName: string) => void;
  resetLevelProgress: (
    totalCrystals?: number,
    spawnPos?: [number, number, number],
    objective?: string,
  ) => void;

  debugUnlockAllLevels: () => void;
  debugResetSave: () => void;
  debugAddTestItem: () => void;
}

const VALID_SCREENS: readonly GameScreen[] = [
  'mainMenu',
  'worldMap',
  'playing',
  'paused',
  'levelComplete',
  'settings',
  'credits',
  'intro',
  'ending',
];

const LEVEL_SEAL_IDS: Record<LevelId, readonly string[]> = {
  level1: ['switch-west', 'switch-east', 'plate-courtyard'],
  level2: ['l2-switch-west', 'l2-switch-east', 'l2-plate-shrine'],
  level3: ['l3-switch-west', 'l3-switch-east', 'l3-plate-star'],
  level4: ['l4-switch-west', 'l4-switch-east', 'l4-plate-hearth'],
  level5: ['l5-switch-west', 'l5-switch-east', 'l5-plate-summit'],
};
let nextToastSeq = 1;
let debouncedSaveTimer: ReturnType<typeof setTimeout> | null = null;

export function resolveInitialScreen(search?: string): GameScreen {
  const query =
    search ?? (typeof window !== 'undefined' ? window.location.search : '');
  const params = new URLSearchParams(query);
  if (params.get('autostart') === '1') {
    return 'playing';
  }
  const requested = params.get('screen') as GameScreen | null;
  if (requested && VALID_SCREENS.includes(requested)) {
    return requested;
  }
  return 'mainMenu';
}

export function resolveInitialLevel(search?: string): ActiveLevelId {
  const query =
    search ?? (typeof window !== 'undefined' ? window.location.search : '');
  const params = new URLSearchParams(query);
  const lvl = params.get('level');
  if (lvl === 'testArena') return 'testArena';
  if (lvl && isLevelId(lvl)) return lvl;
  return 'level1';
}

export function getDefaultSpawn(level: ActiveLevelId): [number, number, number] {
  switch (level) {
    case 'testArena':
      return [0, 0.95, 8];
    case 'level1':
      return [0, 1.5, 25];
    case 'level2':
      return [0, 2.7, 26];
    case 'level3':
      return [0, 2.3, 26];
    case 'level4':
      return [0, 2.5, 26];
    case 'level5':
      return [0, 2.5, 26];
  }
}

function deriveObjectiveText(
  level: ActiveLevelId,
  quests: Record<LevelId, QuestObjective[]>,
): string {
  if (level === 'testArena') {
    return 'Test movement, slopes, stairs, and collision';
  }
  const active = getActiveObjective(quests[level] ?? []);
  return active
    ? formatObjectiveLabel(active)
    : `Explore ${getLevelMetadata(level).name}`;
}

function buildCollectedMapFromProgress(
  progression: Record<LevelId, LevelProgress>,
  foundChestIds: string[],
  extraIds: string[] = [],
): Record<string, boolean> {
  const map: Record<string, boolean> = {};
  for (const levelProgress of Object.values(progression)) {
    for (const cid of levelProgress.collectedCrystalIds) {
      map[cid] = true;
    }
  }
  for (const chestId of foundChestIds) {
    map[chestId] = true;
  }
  for (const id of extraIds) {
    map[id] = true;
  }
  return map;
}

function buildSavePayload(state: GameState): SaveDataV1 {
  const collectedCrystalIds = Object.values(state.progression).flatMap(
    (p) => p.collectedCrystalIds,
  );
  return {
    version: 1,
    updatedAt: Date.now(),
    currentLevel: state.activeLevel,
    levelElapsedSeconds: state.levelElapsedSeconds,
    checkpointPos: state.checkpointPos,
    activatedIds: state.activatedIds,
    keys: state.keys,
    collectedCrystalIds,
    foundChestIds: state.foundChestIds,
    progression: state.progression,
    inventory: state.inventoryItems,
    quests: state.quests,
    fragments: state.recoveredFragments,
    settings: state.settings,
    playtimeSeconds: state.playtimeSeconds,
    worldState: state.worldState,
  };
}

function makeInitialState() {
  const initialScreen = resolveInitialScreen();
  const initialLevel = resolveInitialLevel();
  const loadRes = loadFromStorage();
  const saved = loadRes.data;
  const deviceProfile = detectDeviceProfile();

  if (saved) {
    const activeLevel =
      typeof window !== 'undefined' &&
      new URLSearchParams(window.location.search).has('level')
        ? initialLevel
        : saved.currentLevel;

    const persistentCollected = buildCollectedMapFromProgress(
      saved.progression,
      saved.foundChestIds,
      [
        ...saved.keys,
        ...(saved.activatedIds['door-unlocked-door-vault']
          ? ['key-sanctuary']
          : []),
      ],
    );

    const activatedIds = { ...saved.activatedIds };
    for (const chestId of saved.foundChestIds) {
      activatedIds[chestId] = true;
    }

    const loadedWorldState = saved.worldState ?? createEmptyWorldState();
    const levelWorldObjs = loadedWorldState.levels[activeLevel] ?? {};
    for (const [objId, objState] of Object.entries(levelWorldObjs)) {
      if (objState.collected) persistentCollected[objId] = true;
      if (objState.opened || objState.activated || objState.solved) {
        activatedIds[objId] = true;
      }
    }

    const levelProgress =
      activeLevel !== 'testArena' ? saved.progression[activeLevel] : null;

    applyAudioSettings(saved.settings);

    return {
      screen: initialScreen,
      activeLevel,
      activeOverlay: 'none' as ActiveOverlay,
      settingsReturnScreen: 'mainMenu' as GameScreen,
      levelLoading: false,
      loadingTitle:
        activeLevel === 'testArena'
          ? 'Movement Test Arena'
          : getLevelMetadata(activeLevel).name,
      runId: 1,
      debugVisible: false,
      systemsDebugVisible: false,
      qaVisible: false,
      streamingPending: false,
      activeQualityTier: resolveInitialTier(
        saved.settings.graphicsQuality,
        deviceProfile,
      ),
      inventoryVisible: false,
      crystals: levelProgress ? levelProgress.crystalsCollected : 0,
      totalCrystals: levelProgress ? levelProgress.totalCrystals : 0,
      keys: saved.keys,
      inventory: saved.inventory
        .filter((i) => i.category !== 'crystal' && i.category !== 'key')
        .map((i) => i.name),
      inventoryItems: saved.inventory,
      activatedIds,
      collectedIds: persistentCollected,
      foundChestIds: saved.foundChestIds,
      worldState: loadedWorldState,
      progression: saved.progression,
      quests: saved.quests,
      recoveredFragments: saved.fragments,
      settings: saved.settings,
      playtimeSeconds: saved.playtimeSeconds,
      levelElapsedSeconds: saved.levelElapsedSeconds,
      hasSavedGame: true,
      saveCorruptedNotice: false,
      activePrompt: null,
      activeInscription: null,
      objectiveText: deriveObjectiveText(activeLevel, saved.quests),
      toastMessage: null,
      toasts: [] as ToastNotification[],
      checkpointPos: saved.checkpointPos,
      recoveredFragmentName: null,
    };
  }

  const progression = createInitialProgression();
  const quests = createInitialQuests();
  const storedSettings = loadSettingsFromStorage();
  applyAudioSettings(storedSettings);
  return {
    screen: initialScreen,
    activeLevel: initialLevel,
    activeOverlay: 'none' as ActiveOverlay,
    settingsReturnScreen: 'mainMenu' as GameScreen,
    levelLoading: false,
    loadingTitle:
      initialLevel === 'testArena'
        ? 'Movement Test Arena'
        : getLevelMetadata(initialLevel).name,
    runId: 1,
    debugVisible: false,
    systemsDebugVisible: false,
    qaVisible: false,
    streamingPending: false,
    activeQualityTier: resolveInitialTier(
      storedSettings.graphicsQuality,
      deviceProfile,
    ),
    inventoryVisible: false,
    crystals: 0,
    totalCrystals: initialLevel === 'testArena' ? 0 : 20,
    keys: [] as string[],
    inventory: [] as string[],
    inventoryItems: [] as InventoryItem[],
    activatedIds: {} as Record<string, boolean>,
    collectedIds: {} as Record<string, boolean>,
    foundChestIds: [] as string[],
    worldState: createEmptyWorldState(),
    progression,
    quests,
    recoveredFragments: [] as string[],
    settings: storedSettings,
    playtimeSeconds: 0,
    levelElapsedSeconds: 0,
    hasSavedGame: false,
    saveCorruptedNotice: loadRes.corrupted,
    activePrompt: null,
    activeInscription: null,
    objectiveText: deriveObjectiveText(initialLevel, quests),
    toastMessage: null,
    toasts: [] as ToastNotification[],
    checkpointPos: getDefaultSpawn(initialLevel),
    recoveredFragmentName: null,
  };
}

function appendToastList(
  existing: ToastNotification[],
  message: string,
  kind: ToastKind,
): ToastNotification[] {
  const entry: ToastNotification = {
    id: nextToastSeq++,
    message,
    kind,
  };
  return [...existing, entry].slice(-3);
}

export const useGameStore = create<GameState>((set, get) => {
  const pushToast = (message: string, kind: ToastKind = 'info') => {
    set((state) => ({
      toastMessage: message,
      toasts: appendToastList(state.toasts, message, kind),
    }));
  };

  const applyQuestAndNotify = (
    event: Parameters<typeof applyQuestEvent>[1],
    activeLevel: ActiveLevelId,
  ) => {
    const state = get();
    const { nextQuests, newlyCompleted } = applyQuestEvent(state.quests, event);
    if (nextQuests === state.quests) return;

    const nextObjectiveText = deriveObjectiveText(activeLevel, nextQuests);
    set({
      quests: nextQuests,
      objectiveText: nextObjectiveText,
    });

    for (const completed of newlyCompleted) {
      pushToast(`Objective complete: ${completed.description}`, 'objective');
      eventBus.emit('objective:completed', {
        id: completed.id,
        description: completed.description,
      });
    }
  };

  return {
    ...makeInitialState(),

    setScreen: (screen) => set({ screen, activeOverlay: 'none', inventoryVisible: false }),

    startLevel: (level) => {
      const state = get();
      const defaultSpawn = getDefaultSpawn(level);

      if (level === 'testArena') {
        set({
          activeLevel: 'testArena',
          activeOverlay: 'none',
          levelLoading: true,
          loadingTitle: 'Movement Test Arena',
          runId: state.runId + 1,
          screen: 'playing',
          inventoryVisible: false,
          crystals: 0,
          totalCrystals: 0,
          keys: [],
          activatedIds: {},
          collectedIds: {},
          activePrompt: null,
          activeInscription: null,
          objectiveText: 'Test movement, slopes, stairs, and collision',
          toastMessage: null,
          toasts: [],
          checkpointPos: defaultSpawn,
          recoveredFragmentName: null,
          levelElapsedSeconds: 0,
        });
        return;
      }

      // Preserve persistent collected crystals, world objects, & found chests so they never respawn
      const persistentCollected = buildCollectedMapFromProgress(
        state.progression,
        state.foundChestIds,
      );
      const persistentActivated: Record<string, boolean> = {};
      for (const chestId of state.foundChestIds) {
        persistentActivated[chestId] = true;
      }
      const levelObjects = state.worldState.levels[level] ?? {};
      for (const [objId, obj] of Object.entries(levelObjects)) {
        if (obj.collected) persistentCollected[objId] = true;
        if (obj.opened || obj.activated || obj.solved) {
          persistentActivated[objId] = true;
        }
      }

      const levelProgress = state.progression[level];
      const persistentItems = state.inventoryItems.filter(
        (i) => i.category !== 'key',
      );
      set({
        activeLevel: level,
        activeOverlay: 'none',
        levelLoading: true,
        loadingTitle: getLevelMetadata(level).name,
        runId: state.runId + 1,
        screen: 'playing',
        inventoryVisible: false,
        crystals: levelProgress.crystalsCollected,
        totalCrystals: levelProgress.totalCrystals,
        keys: [],
        inventoryItems: persistentItems,
        inventory: persistentItems
          .filter((i) => i.category !== 'crystal' && i.category !== 'key')
          .map((i) => i.name),
        activatedIds: persistentActivated,
        collectedIds: persistentCollected,
        activePrompt: null,
        activeInscription: null,
        objectiveText: deriveObjectiveText(level, state.quests),
        toastMessage: null,
        toasts: [],
        checkpointPos: defaultSpawn,
        recoveredFragmentName: null,
        levelElapsedSeconds: 0,
      });
    },

    continueSavedGame: (storage) => {
      const { data } = loadFromStorage(storage);
      if (!data) return false;

      const activeLevel = data.currentLevel;
      const persistentCollected = buildCollectedMapFromProgress(
        data.progression,
        data.foundChestIds,
        [
          ...data.keys,
          ...(data.activatedIds['door-unlocked-door-vault']
            ? ['key-sanctuary']
            : []),
        ],
      );
      const activatedIds = { ...data.activatedIds };
      for (const chestId of data.foundChestIds) {
        activatedIds[chestId] = true;
      }

      const loadedWorldState = data.worldState ?? createEmptyWorldState();
      const levelWorldObjs = loadedWorldState.levels[activeLevel] ?? {};
      for (const [objId, objState] of Object.entries(levelWorldObjs)) {
        if (objState.collected) persistentCollected[objId] = true;
        if (objState.opened || objState.activated || objState.solved) {
          activatedIds[objId] = true;
        }
      }

      const levelProgress =
        activeLevel !== 'testArena' ? data.progression[activeLevel] : null;
      applyAudioSettings(data.settings);

      set((state) => ({
        screen: 'playing',
        activeLevel,
        activeOverlay: 'none',
        levelLoading: true,
        loadingTitle:
          activeLevel === 'testArena'
            ? 'Movement Test Arena'
            : getLevelMetadata(activeLevel).name,
        runId: state.runId + 1,
        activeQualityTier: resolveInitialTier(data.settings.graphicsQuality),
        inventoryVisible: false,
        crystals: levelProgress ? levelProgress.crystalsCollected : 0,
        totalCrystals: levelProgress ? levelProgress.totalCrystals : 0,
        keys: data.keys,
        inventory: data.inventory
          .filter((i) => i.category !== 'crystal' && i.category !== 'key')
          .map((i) => i.name),
        inventoryItems: data.inventory,
        activatedIds,
        collectedIds: persistentCollected,
        foundChestIds: data.foundChestIds,
        worldState: loadedWorldState,
        progression: data.progression,
        quests: data.quests,
        recoveredFragments: data.fragments,
        settings: data.settings,
        playtimeSeconds: data.playtimeSeconds,
        levelElapsedSeconds: data.levelElapsedSeconds,
        hasSavedGame: true,
        saveCorruptedNotice: false,
        activePrompt: null,
        activeInscription: null,
        objectiveText: deriveObjectiveText(activeLevel, data.quests),
        toastMessage: null,
        toasts: [],
        checkpointPos: data.checkpointPos,
        recoveredFragmentName: null,
      }));
      return true;
    },

    newGame: (storage) => {
      clearStorageSave(storage);
      const progression = createInitialProgression();
      const quests = createInitialQuests();
      const spawn = getDefaultSpawn('level1');
      set((state) => ({
        screen: 'playing',
        activeLevel: 'level1',
        activeOverlay: 'none',
        levelLoading: true,
        loadingTitle: getLevelMetadata('level1').name,
        runId: state.runId + 1,
        inventoryVisible: false,
        crystals: 0,
        totalCrystals: 20,
        keys: [],
        inventory: [],
        inventoryItems: [],
        activatedIds: {},
        collectedIds: {},
        foundChestIds: [],
        worldState: createEmptyWorldState(),
        progression,
        quests,
        recoveredFragments: [],
        playtimeSeconds: 0,
        levelElapsedSeconds: 0,
        hasSavedGame: false,
        saveCorruptedNotice: false,
        activePrompt: null,
        activeInscription: null,
        objectiveText: deriveObjectiveText('level1', quests),
        toastMessage: null,
        toasts: [],
        checkpointPos: spawn,
        recoveredFragmentName: null,
      }));
    },

    beginNewGameWithIntro: (storage) => {
      clearStorageSave(storage);
      const progression = createInitialProgression();
      const quests = createInitialQuests();
      const spawn = getDefaultSpawn('level1');
      set((state) => ({
        screen: 'intro',
        activeLevel: 'level1',
        activeOverlay: 'none',
        levelLoading: false,
        runId: state.runId + 1,
        inventoryVisible: false,
        crystals: 0,
        totalCrystals: 20,
        keys: [],
        inventory: [],
        inventoryItems: [],
        activatedIds: {},
        collectedIds: {},
        foundChestIds: [],
        worldState: createEmptyWorldState(),
        progression,
        quests,
        recoveredFragments: [],
        playtimeSeconds: 0,
        levelElapsedSeconds: 0,
        hasSavedGame: false,
        saveCorruptedNotice: false,
        activePrompt: null,
        activeInscription: null,
        objectiveText: deriveObjectiveText('level1', quests),
        toastMessage: null,
        toasts: [],
        checkpointPos: spawn,
        recoveredFragmentName: null,
      }));
    },

    finishIntro: () => {
      get().startLevel('level1');
    },

    finishLevelLoading: () => set({ levelLoading: false }),

    openSettings: (returnTo) =>
      set((state) => ({
        settingsReturnScreen: returnTo ?? state.screen,
        screen: 'settings',
        activeOverlay: 'none',
        inventoryVisible: false,
      })),

    closeSettings: () =>
      set((state) => ({
        screen: state.settingsReturnScreen,
      })),

    resetProgress: (storage) => {
      clearStorageSave(storage);
      const progression = createInitialProgression();
      const quests = createInitialQuests();
      const spawn = getDefaultSpawn('level1');
      set((state) => ({
        screen: 'mainMenu',
        activeLevel: 'level1',
        activeOverlay: 'none',
        levelLoading: false,
        runId: state.runId + 1,
        inventoryVisible: false,
        crystals: 0,
        totalCrystals: 20,
        keys: [],
        inventory: [],
        inventoryItems: [],
        activatedIds: {},
        collectedIds: {},
        foundChestIds: [],
        worldState: createEmptyWorldState(),
        progression,
        quests,
        recoveredFragments: [],
        playtimeSeconds: 0,
        levelElapsedSeconds: 0,
        hasSavedGame: false,
        saveCorruptedNotice: false,
        activePrompt: null,
        activeInscription: null,
        objectiveText: deriveObjectiveText('level1', quests),
        checkpointPos: spawn,
        recoveredFragmentName: null,
      }));
      pushToast('Progress reset', 'info');
    },

    saveCurrentGame: (manual = false, storage) => {
      const state = get();
      const ok = saveToStorage(buildSavePayload(state), storage);
      if (ok) {
        set({ hasSavedGame: true });
        if (manual) {
          pushToast('Game saved', 'save');
          eventBus.emit('game:saved', { manual: true });
        }
      }
      return ok;
    },

    scheduleDebouncedSave: () => {
      if (typeof window === 'undefined') {
        get().saveCurrentGame(false);
        return;
      }
      if (debouncedSaveTimer !== null) {
        clearTimeout(debouncedSaveTimer);
      }
      debouncedSaveTimer = setTimeout(() => {
        debouncedSaveTimer = null;
        get().saveCurrentGame(false);
      }, 350);
    },

    togglePause: () =>
      set((state) => {
        if (state.activeInscription) {
          return { activeInscription: null };
        }
        if (state.activeOverlay !== 'none') {
          return { activeOverlay: 'none', inventoryVisible: false };
        }
        if (state.screen === 'playing') return { screen: 'paused' };
        if (state.screen === 'paused') return { screen: 'playing' };
        return state;
      }),

    toggleDebug: () => set((state) => ({ debugVisible: !state.debugVisible })),

    toggleSystemsDebug: () =>
      set((state) => ({ systemsDebugVisible: !state.systemsDebugVisible })),

    toggleQaOverlay: () =>
      set((state) => ({ qaVisible: !state.qaVisible })),

    setStreamingPending: (pending) =>
      set((state) =>
        state.streamingPending === pending
          ? state
          : { streamingPending: pending },
      ),

    setActiveQualityTier: (tier) =>
      set((state) =>
        state.activeQualityTier === tier
          ? state
          : { activeQualityTier: tier },
      ),

    setWorldObjectState: (objectId, patch, levelId) => {
      set((state) => {
        const targetLevel = levelId ?? state.activeLevel;
        const nextWorldState = patchWorldObjectState(
          state.worldState,
          targetLevel,
          objectId,
          patch,
        );
        if (nextWorldState === state.worldState) return state;

        const nextCollected =
          patch.collected === true && !state.collectedIds[objectId]
            ? { ...state.collectedIds, [objectId]: true }
            : state.collectedIds;
        const nextActivated =
          patch.activated !== undefined || patch.opened !== undefined || patch.solved !== undefined
            ? {
                ...state.activatedIds,
                [objectId]: Boolean(
                  patch.activated ?? patch.opened ?? patch.solved,
                ),
              }
            : state.activatedIds;

        return {
          worldState: nextWorldState,
          collectedIds: nextCollected,
          activatedIds: nextActivated,
        };
      });
      get().scheduleDebouncedSave();
    },

    getWorldObjectState: (objectId, levelId) => {
      const state = get();
      return readWorldObj(
        state.worldState,
        levelId ?? state.activeLevel,
        objectId,
      );
    },

    setActiveOverlay: (overlay) =>
      set({
        activeOverlay: overlay,
        inventoryVisible: overlay === 'inventory',
      }),

    toggleInventory: () =>
      set((state) => {
        if (state.screen !== 'playing' && state.screen !== 'paused') {
          return state;
        }
        const next: ActiveOverlay =
          state.activeOverlay === 'inventory' ? 'none' : 'inventory';
        return {
          activeOverlay: next,
          inventoryVisible: next === 'inventory',
        };
      }),

    toggleQuestLog: () =>
      set((state) => {
        if (state.screen !== 'playing' && state.screen !== 'paused') {
          return state;
        }
        const next: ActiveOverlay =
          state.activeOverlay === 'quests' ? 'none' : 'quests';
        return {
          activeOverlay: next,
          inventoryVisible: false,
        };
      }),

    reset: () =>
      set({
        screen: 'mainMenu',
        activeOverlay: 'none',
        levelLoading: false,
        debugVisible: false,
        systemsDebugVisible: false,
        qaVisible: false,
        inventoryVisible: false,
        activePrompt: null,
        activeInscription: null,
        toastMessage: null,
        toasts: [],
      }),

    setActivated: (id, active) => {
      set((state) => ({
        activatedIds: { ...state.activatedIds, [id]: active },
        worldState: patchWorldObjectState(
          state.worldState,
          state.activeLevel,
          id,
          { activated: active },
        ),
      }));

      if (active) {
        playPooledSynth('switch');
      }

      const activeLevel = get().activeLevel;
      if (activeLevel !== 'testArena') {
        const sealIds = LEVEL_SEAL_IDS[activeLevel];
        if (sealIds?.includes(id)) {
          const activated = get().activatedIds;
          const activeCount = sealIds.filter((sid) =>
            Boolean(activated[sid]),
          ).length;
          applyQuestAndNotify(
            { type: 'seals', levelId: activeLevel, activeCount },
            activeLevel,
          );
        }
      }
      get().scheduleDebouncedSave();
    },

    markCollected: (id) => {
      if (get().collectedIds[id]) return false;
      set((state) => ({
        collectedIds: { ...state.collectedIds, [id]: true },
        worldState: patchWorldObjectState(
          state.worldState,
          state.activeLevel,
          id,
          { collected: true },
        ),
      }));
      get().scheduleDebouncedSave();
      return true;
    },

    addCrystal: (id) => {
      const state = get();
      if (state.collectedIds[id]) return false;

      const levelId: LevelId =
        state.activeLevel === 'testArena' ? 'level1' : state.activeLevel;
      const nextProgression = recordLevelCrystal(
        state.progression,
        levelId,
        id,
      );
      const nextCount = nextProgression[levelId].crystalsCollected;
      const nextItems = addItemToInventory(
        state.inventoryItems,
        'crystal-shard',
        1,
      );

      set({
        collectedIds: { ...state.collectedIds, [id]: true },
        progression: nextProgression,
        crystals:
          state.activeLevel === 'testArena' ? state.crystals + 1 : nextCount,
        inventoryItems: nextItems,
        worldState: patchWorldObjectState(
          state.worldState,
          state.activeLevel,
          id,
          { collected: true },
        ),
      });

      playPooledSynth('crystal');
      pushToast(
        `Crystal collected (${nextCount}/${state.totalCrystals || 20})`,
        'crystal',
      );
      applyQuestAndNotify(
        { type: 'crystal', levelId, collectedCount: nextCount },
        state.activeLevel,
      );
      get().scheduleDebouncedSave();
      return true;
    },

    addKey: (keyId, label) => {
      const state = get();
      const nextKeys = state.keys.includes(keyId)
        ? state.keys
        : [...state.keys, keyId];
      const def = resolveItemDefinition(keyId, {
        category: 'key',
        iconId: 'key',
        ...(label ? { name: label } : {}),
      });
      const nextItems = state.keys.includes(keyId)
        ? state.inventoryItems
        : addItemToInventory(state.inventoryItems, keyId, 1, def);

      set({
        keys: nextKeys,
        inventoryItems: nextItems,
        inventory: nextItems
          .filter((i) => i.category !== 'crystal' && i.category !== 'key')
          .map((i) => i.name),
      });
      get().scheduleDebouncedSave();
    },

    consumeKey: (keyId) => {
      const state = get();
      const { nextInventory } = consumeItemFromInventory(
        state.inventoryItems,
        keyId,
        1,
      );
      set({
        keys: state.keys.filter((k) => k !== keyId),
        inventoryItems: nextInventory,
        inventory: nextInventory
          .filter((i) => i.category !== 'crystal' && i.category !== 'key')
          .map((i) => i.name),
      });
    },

    unlockDoor: (doorId, keyId, keyLabel) => {
      const state = get();
      if (state.activatedIds[`door-unlocked-${doorId}`]) return;

      if (keyId) {
        state.consumeKey(keyId);
      }

      set((cur) => ({
        activatedIds: {
          ...cur.activatedIds,
          [`door-unlocked-${doorId}`]: true,
        },
        worldState: patchWorldObjectState(
          cur.worldState,
          cur.activeLevel,
          `door-unlocked-${doorId}`,
          { solved: true, activated: true },
        ),
      }));

      playPooledSynth('door');
      pushToast(
        keyLabel ? `Unlocked with ${keyLabel}` : 'Ancient Door Unlocked',
        'info',
      );
      eventBus.emit('door:unlocked', { id: doorId, keyId });

      const levelId: LevelId =
        state.activeLevel === 'testArena' ? 'level1' : state.activeLevel;
      applyQuestAndNotify(
        { type: 'door_unlocked', levelId, doorId },
        state.activeLevel,
      );
      get().scheduleDebouncedSave();
    },

    openChest: (chestId, rewardItem) => {
      const state = get();
      if (state.activatedIds[chestId] || state.foundChestIds.includes(chestId)) {
        return false;
      }

      const levelId: LevelId =
        state.activeLevel === 'testArena' ? 'level1' : state.activeLevel;
      const nextFound = [...state.foundChestIds, chestId];
      const nextProgression = recordLevelChest(
        state.progression,
        levelId,
        chestId,
      );
      const nextItems = addItemToInventory(
        state.inventoryItems,
        rewardItem,
        1,
        { levelOfOrigin: levelId },
      );

      set({
        activatedIds: { ...state.activatedIds, [chestId]: true },
        collectedIds: { ...state.collectedIds, [chestId]: true },
        foundChestIds: nextFound,
        progression: nextProgression,
        inventoryItems: nextItems,
        inventory: nextItems
          .filter((i) => i.category !== 'crystal' && i.category !== 'key')
          .map((i) => i.name),
        worldState: patchWorldObjectState(
          state.worldState,
          state.activeLevel,
          chestId,
          { opened: true, activated: true },
        ),
      });

      playPooledSynth('chest');
      const resolved = resolveItemDefinition(rewardItem);
      pushToast(`Found ${resolved.name}!`, 'info');
      applyQuestAndNotify(
        {
          type: 'chest',
          levelId,
          foundCount: nextProgression[levelId].foundChestIds.length,
        },
        state.activeLevel,
      );
      get().scheduleDebouncedSave();
      return true;
    },

    collectFragment: (fragmentId, fragmentName) => {
      const state = get();
      const levelId: LevelId =
        state.activeLevel === 'testArena' ? 'level1' : state.activeLevel;

      const nextFragments = state.recoveredFragments.includes(fragmentId)
        ? state.recoveredFragments
        : [...state.recoveredFragments, fragmentId];

      const nextProgression = recordLevelFragment(state.progression, levelId);
      const nextItems = addItemToInventory(
        state.inventoryItems,
        fragmentId,
        1,
        {
          name: fragmentName,
          category: 'fragment',
          iconId: 'fragment',
          levelOfOrigin: levelId,
        },
      );

      set({
        collectedIds: { ...state.collectedIds, [fragmentId]: true },
        recoveredFragments: nextFragments,
        progression: nextProgression,
        inventoryItems: nextItems,
        inventory: nextItems
          .filter((i) => i.category !== 'crystal' && i.category !== 'key')
          .map((i) => i.name),
        worldState: patchWorldObjectState(
          state.worldState,
          state.activeLevel,
          fragmentId,
          { collected: true },
        ),
      });

      playPooledSynth('fragment');
      pushToast(`Fragment found: ${fragmentName}`, 'fragment');
      applyQuestAndNotify({ type: 'fragment', levelId }, state.activeLevel);
      get().saveCurrentGame(false);
    },

    addInventoryItem: (item) =>
      set((state) => {
        const nextItems = addItemToInventory(state.inventoryItems, item, 1);
        const nextNames = state.inventory.includes(item)
          ? state.inventory
          : [...state.inventory, item];
        return {
          inventory: nextNames,
          inventoryItems: nextItems,
        };
      }),

    tickPlaytime: (seconds) =>
      set((state) => {
        if (state.screen !== 'playing' || seconds <= 0) return state;
        return {
          playtimeSeconds: state.playtimeSeconds + seconds,
          levelElapsedSeconds: state.levelElapsedSeconds + seconds,
        };
      }),

    updateSettings: (partial) => {
      const next = { ...get().settings, ...partial };
      applyAudioSettings(next);
      saveSettingsToStorage(next);
      const resolvedTier = resolveInitialTier(next.graphicsQuality);
      set({ settings: next, activeQualityTier: resolvedTier });
      if (get().hasSavedGame) {
        get().scheduleDebouncedSave();
      }
    },

    setActivePrompt: (prompt) => set({ activePrompt: prompt }),

    clearActivePromptIfId: (id) =>
      set((state) =>
        state.activePrompt?.id === id ? { activePrompt: null } : state,
      ),

    openInscription: (data) => set({ activeInscription: data }),

    closeInscription: () => set({ activeInscription: null }),

    setObjectiveText: (text) => set({ objectiveText: text }),

    showToast: (message, kind = 'info') => {
      if (message === null) {
        set({ toastMessage: null });
        return;
      }
      pushToast(message, kind);
    },

    dismissToast: (id) =>
      set((state) => {
        const next = state.toasts.filter((t) => t.id !== id);
        return {
          toasts: next,
          toastMessage: next[next.length - 1]?.message ?? null,
        };
      }),

    setCheckpoint: (pos) => {
      set({ checkpointPos: pos });
      get().saveCurrentGame(false);
    },

    completeLevel: (fragmentName) => {
      const state = get();
      const levelId: LevelId =
        state.activeLevel === 'testArena' ? 'level1' : state.activeLevel;
      const meta = getLevelMetadata(levelId);
      const nextProgression = completeLevelProgress(
        state.progression,
        levelId,
        state.levelElapsedSeconds,
      );

      // Ensure fragment item & quest completion are recorded even if called directly in tests
      const nextFragments = state.recoveredFragments.includes(meta.fragmentId)
        ? state.recoveredFragments
        : [...state.recoveredFragments, meta.fragmentId];
      const nextItems = addItemToInventory(
        state.inventoryItems,
        meta.fragmentId,
        1,
      );

      set({
        screen: 'levelComplete',
        recoveredFragmentName: fragmentName,
        progression: nextProgression,
        recoveredFragments: nextFragments,
        inventoryItems: nextItems,
        inventory: nextItems
          .filter((i) => i.category !== 'crystal' && i.category !== 'key')
          .map((i) => i.name),
        activePrompt: null,
        activeInscription: null,
      });

      applyQuestAndNotify({ type: 'fragment', levelId }, state.activeLevel);
      get().saveCurrentGame(false);
    },

    resetLevelProgress: (
      totalCrystals = 20,
      spawnPos = [0, 1.8, 25],
      objective = 'Explore the Forgotten Shore',
    ) =>
      set({
        crystals: 0,
        totalCrystals,
        keys: [],
        inventory: [],
        inventoryItems: [],
        activatedIds: {},
        collectedIds: {},
        foundChestIds: [],
        worldState: createEmptyWorldState(),
        progression: createInitialProgression(),
        quests: createInitialQuests(),
        recoveredFragments: [],
        activePrompt: null,
        activeInscription: null,
        objectiveText: objective,
        toastMessage: null,
        toasts: [],
        checkpointPos: spawnPos,
        recoveredFragmentName: null,
        levelElapsedSeconds: 0,
      }),

    debugUnlockAllLevels: () => {
      set((state) => ({
        progression: unlockAllProgression(state.progression),
      }));
      get().saveCurrentGame(false);
      pushToast('Debug: All 5 levels unlocked', 'info');
    },

    debugResetSave: () => {
      get().resetProgress();
      pushToast('Debug: Save reset to defaults', 'info');
    },

    debugAddTestItem: () => {
      const state = get();
      const hasWaystone = state.inventoryItems.some(
        (i) => i.id === 'relic-test-waystone',
      );
      const itemId = hasWaystone
        ? `relic-debug-${state.inventoryItems.length + 1}`
        : 'relic-test-waystone';
      const nextItems = addItemToInventory(
        state.inventoryItems,
        itemId,
        1,
        hasWaystone
          ? {
              id: itemId,
              name: `Survey Relic #${state.inventoryItems.length + 1}`,
              description: 'Debug test relic added via F4 Systems Panel.',
              iconId: 'relic',
              category: 'relic',
              levelOfOrigin: 'level1',
            }
          : undefined,
      );
      const added = nextItems[nextItems.length - 1];
      set({
        inventoryItems: nextItems,
        inventory: nextItems
          .filter((i) => i.category !== 'crystal' && i.category !== 'key')
          .map((i) => i.name),
      });
      get().saveCurrentGame(false);
      pushToast(`Added item: ${added.name}`, 'info');
    },
  };
});
