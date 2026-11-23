import { lazy, type ComponentType } from 'react';
import type { LevelId } from '@/src/systems/progressionSystem';
import { LEVEL_CHUNKS } from './levelTerrainFactory';

const levelImporters: Record<LevelId, () => Promise<{ default: ComponentType }>> = {
  level1: () => import('./Level1_ForgottenShore'),
  level2: () => import('./Level2_WhisperingWoods'),
  level3: () => import('./Level3_SunkenKingdom'),
  level4: () => import('./Level4_ObsidianCaldera'),
  level5: () => import('./Level5_HeartOfTheSpire'),
};

export const LazyLevels: Record<LevelId, ComponentType> = {
  level1: lazy(levelImporters.level1),
  level2: lazy(levelImporters.level2),
  level3: lazy(levelImporters.level3),
  level4: lazy(levelImporters.level4),
  level5: lazy(levelImporters.level5),
};

const preloaded = new Set<LevelId>();

export function preloadLevelModule(levelId: LevelId | null | undefined): void {
  if (!levelId || preloaded.has(levelId)) return;
  preloaded.add(levelId);
  void levelImporters[levelId]?.();
}

export function getChunksForLevel(levelId: LevelId) {
  return LEVEL_CHUNKS[levelId].map((s) => s.chunk);
}
