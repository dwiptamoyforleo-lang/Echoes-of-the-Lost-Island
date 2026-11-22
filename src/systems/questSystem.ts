import { LEVEL_IDS, type LevelId } from './progressionSystem';

export type ObjectiveType = 'main' | 'optional';

export interface QuestObjective {
  id: string;
  levelId: LevelId;
  description: string;
  type: ObjectiveType;
  current: number;
  target: number;
  completed: boolean;
}

export type QuestEvent =
  | { type: 'crystal'; levelId: LevelId; collectedCount: number }
  | { type: 'seals'; levelId: LevelId; activeCount: number }
  | { type: 'gate_opened'; levelId: LevelId }
  | { type: 'chest'; levelId: LevelId; foundCount: number }
  | { type: 'door_unlocked'; levelId: LevelId; doorId: string }
  | { type: 'fragment'; levelId: LevelId };

function makeObj(
  id: string,
  levelId: LevelId,
  description: string,
  type: ObjectiveType,
  target: number,
): QuestObjective {
  return {
    id,
    levelId,
    description,
    type,
    current: 0,
    target,
    completed: false,
  };
}

export function createInitialQuests(): Record<LevelId, QuestObjective[]> {
  return {
    level1: [
      makeObj(
        'l1-obj-seals',
        'level1',
        'Awaken the 3 Ancient Seals',
        'main',
        3,
      ),
      makeObj(
        'l1-obj-gate',
        'level1',
        'Open the Ruins Sanctuary Gate',
        'main',
        1,
      ),
      makeObj(
        'l1-obj-fragment',
        'level1',
        'Recover Fragment 1: Echo of the Tides',
        'main',
        1,
      ),
      makeObj(
        'l1-obj-crystals',
        'level1',
        'Collect all 20 Crystals',
        'optional',
        20,
      ),
      makeObj(
        'l1-obj-chest',
        'level1',
        'Find the hidden Sea Cave Chest',
        'optional',
        1,
      ),
      makeObj(
        'l1-obj-vault',
        'level1',
        'Unlock the Sunstone Side Vault',
        'optional',
        1,
      ),
    ],
    level2: [
      makeObj('l2-obj-seals', 'level2', 'Awaken the 3 Canopy Seals', 'main', 3),
      makeObj(
        'l2-obj-fragment',
        'level2',
        'Recover Fragment 2: Echo of the Gale',
        'main',
        1,
      ),
      makeObj(
        'l2-obj-crystals',
        'level2',
        'Collect all 20 Canopy Crystals',
        'optional',
        20,
      ),
      makeObj(
        'l2-obj-chest',
        'level2',
        'Find the hidden Canopy Chest',
        'optional',
        1,
      ),
    ],
    level3: [
      makeObj('l3-obj-seals', 'level3', 'Align the 3 Observatory Seals', 'main', 3),
      makeObj(
        'l3-obj-fragment',
        'level3',
        'Recover Fragment 3: Echo of the Stars',
        'main',
        1,
      ),
      makeObj(
        'l3-obj-crystals',
        'level3',
        'Collect all 20 Observatory Crystals',
        'optional',
        20,
      ),
      makeObj(
        'l3-obj-chest',
        'level3',
        'Find the hidden Lens Chest',
        'optional',
        1,
      ),
    ],
    level4: [
      makeObj('l4-obj-seals', 'level4', 'Unseal the 3 Caldera Conduits', 'main', 3),
      makeObj(
        'l4-obj-fragment',
        'level4',
        'Recover Fragment 4: Echo of the Ember',
        'main',
        1,
      ),
      makeObj(
        'l4-obj-crystals',
        'level4',
        'Collect all 20 Caldera Crystals',
        'optional',
        20,
      ),
      makeObj(
        'l4-obj-chest',
        'level4',
        'Find the hidden Caldera Chest',
        'optional',
        1,
      ),
    ],
    level5: [
      makeObj('l5-obj-seals', 'level5', 'Harmonize the 3 Spire Seals', 'main', 3),
      makeObj(
        'l5-obj-fragment',
        'level5',
        'Recover Fragment 5: Echo of Eternity',
        'main',
        1,
      ),
      makeObj(
        'l5-obj-crystals',
        'level5',
        'Collect all 20 Spire Crystals',
        'optional',
        20,
      ),
      makeObj(
        'l5-obj-chest',
        'level5',
        'Find the hidden Summit Chest',
        'optional',
        1,
      ),
    ],
  };
}

function updateObjectiveProgress(
  objectives: QuestObjective[],
  objectiveId: string,
  value: number,
  stickyCompletion = false,
): QuestObjective[] {
  return objectives.map((obj) => {
    if (obj.id !== objectiveId) return obj;
    const clamped = Math.max(0, Math.min(obj.target, value));
    const completed =
      (stickyCompletion && obj.completed) || clamped >= obj.target;
    const nextCurrent = completed ? obj.target : clamped;
    if (nextCurrent === obj.current && completed === obj.completed) {
      return obj;
    }
    return {
      ...obj,
      current: nextCurrent,
      completed,
    };
  });
}

export function applyQuestEvent(
  quests: Record<LevelId, QuestObjective[]>,
  event: QuestEvent,
): {
  nextQuests: Record<LevelId, QuestObjective[]>;
  newlyCompleted: QuestObjective[];
} {
  const prevList = quests[event.levelId];
  if (!prevList) {
    return { nextQuests: quests, newlyCompleted: [] };
  }

  let updated = prevList;

  if (event.levelId === 'level1') {
    switch (event.type) {
      case 'crystal':
        updated = updateObjectiveProgress(
          updated,
          'l1-obj-crystals',
          event.collectedCount,
          true,
        );
        break;
      case 'seals':
        updated = updateObjectiveProgress(
          updated,
          'l1-obj-seals',
          event.activeCount,
          true,
        );
        if (event.activeCount >= 3) {
          updated = updateObjectiveProgress(updated, 'l1-obj-gate', 1, true);
        }
        break;
      case 'gate_opened':
        updated = updateObjectiveProgress(updated, 'l1-obj-gate', 1, true);
        break;
      case 'chest':
        updated = updateObjectiveProgress(
          updated,
          'l1-obj-chest',
          event.foundCount,
          true,
        );
        break;
      case 'door_unlocked':
        if (event.doorId === 'door-vault') {
          updated = updateObjectiveProgress(updated, 'l1-obj-vault', 1, true);
        }
        break;
      case 'fragment':
        updated = updateObjectiveProgress(updated, 'l1-obj-fragment', 1, true);
        break;
    }
  } else {
    const num = event.levelId.slice(-1);
    if (event.type === 'crystal') {
      updated = updateObjectiveProgress(
        updated,
        `l${num}-obj-crystals`,
        event.collectedCount,
        true,
      );
    } else if (event.type === 'seals') {
      updated = updateObjectiveProgress(
        updated,
        `l${num}-obj-seals`,
        event.activeCount,
        true,
      );
    } else if (event.type === 'chest') {
      updated = updateObjectiveProgress(
        updated,
        `l${num}-obj-chest`,
        event.foundCount,
        true,
      );
    } else if (event.type === 'fragment') {
      updated = updateObjectiveProgress(
        updated,
        `l${num}-obj-fragment`,
        1,
        true,
      );
    }
  }

  if (updated === prevList) {
    return { nextQuests: quests, newlyCompleted: [] };
  }

  const newlyCompleted = updated.filter((obj, idx) => {
    const prevObj = prevList[idx];
    return obj.completed && !prevObj?.completed;
  });

  return {
    nextQuests: {
      ...quests,
      [event.levelId]: updated,
    },
    newlyCompleted,
  };
}

export function getActiveObjective(
  objectives: QuestObjective[],
): QuestObjective | null {
  const nextMain = objectives.find(
    (obj) => obj.type === 'main' && !obj.completed,
  );
  if (nextMain) return nextMain;

  const nextOptional = objectives.find((obj) => !obj.completed);
  if (nextOptional) return nextOptional;

  return objectives[objectives.length - 1] ?? null;
}

export function formatObjectiveLabel(obj: QuestObjective): string {
  if (obj.target > 1) {
    return `${obj.description} (${obj.current}/${obj.target})`;
  }
  return obj.description;
}

export function resetTransientLevelQuests(
  quests: Record<LevelId, QuestObjective[]>,
  levelId: LevelId,
): Record<LevelId, QuestObjective[]> {
  // Keep persistent optional crystal/chest/vault completion, reset seals/gate/fragment only if desired
  // Actually quest completion itself is persistent progress, so we preserve completed flags!
  void LEVEL_IDS;
  void levelId;
  return quests;
}
