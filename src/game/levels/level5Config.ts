import type { CrystalSpec } from '@/src/game/collectibles';
import type { LevelTerrainChunkSpec } from './levelTerrainFactory';

export interface SkyIslandSpec {
  id: string;
  center: [number, number, number];
  size: [number, number, number];
}

export const SKY_ISLANDS: readonly SkyIslandSpec[] = [
  {
    id: 'l5-island-arrival',
    center: [0, 2.0, 23],
    size: [14, 1.0, 14], // top y = 2.5, z: 16..30
  },
  {
    id: 'l5-island-courtyard',
    center: [0, 2.3, 0],
    size: [18, 1.0, 12], // top y = 2.8, x: -9..9, z: -6..6
  },
  {
    id: 'l5-island-west',
    center: [-22.5, 3.5, -7],
    size: [13, 1.0, 13], // top y = 4.0, x: -29..-16, z: -13.5..-0.5
  },
  {
    id: 'l5-island-east',
    center: [22.5, 3.5, -0.5],
    size: [13, 1.0, 13], // top y = 4.0, x: 16..29, z: -7..6
  },
  {
    id: 'l5-island-east-spire',
    center: [23, 4.3, 15.5],
    size: [8.5, 1.0, 7.5], // top y = 4.8, x: 18.75..27.25, z: 11.75..19.25
  },
  {
    id: 'l5-island-temple',
    center: [0, 4.1, -27],
    size: [28, 1.0, 26], // top y = 4.6, x: -14..14, z: -40..-14
  },
];

/**
 * Deterministic surface height for Level 5 floating islands (used by crystal placement & camera clearance).
 * Returns -10 over open sky cloud abyss between islands.
 */
export function getSkyTempleHeight(x: number, z: number): number {
  for (const isl of SKY_ISLANDS) {
    const hw = isl.size[0] * 0.5;
    const hd = isl.size[2] * 0.5;
    if (
      x >= isl.center[0] - hw &&
      x <= isl.center[0] + hw &&
      z >= isl.center[2] - hd &&
      z <= isl.center[2] + hd
    ) {
      return isl.center[1] + isl.size[1] * 0.5;
    }
  }
  return -10;
}

export const LEVEL5_SPAWN: [number, number, number] = [0, 2.5, 26];

export const SYMBOL_PILLAR_IDS = [
  'l5-symbol-1',
  'l5-symbol-2',
  'l5-symbol-3',
] as const;

// 0 = Sun, 1 = Tide, 2 = Gale, 3 = Star
export const SYMBOL_INITIAL_STEPS: readonly number[] = [2, 0, 1];
export const SYMBOL_TARGET_STEPS: readonly number[] = [0, 1, 3];

export function areSkySymbolsAligned(steps: readonly number[]): boolean {
  if (steps.length < SYMBOL_TARGET_STEPS.length) return false;
  return SYMBOL_TARGET_STEPS.every(
    (target, idx) => (((steps[idx] ?? -1) % 4) + 4) % 4 === target,
  );
}

export const REQUIRED_SANCTUM_FRAGMENTS = [
  'fragment-1',
  'fragment-2',
  'fragment-3',
  'fragment-4',
] as const;

export const FRAGMENT_PEDESTALS = [
  {
    id: 'l5-pedestal-1',
    fragmentId: 'fragment-1',
    name: 'Echo of the Tides',
    position: [-4.4, 4.6, -26.5] as [number, number, number],
    color: '#38bdf8',
  },
  {
    id: 'l5-pedestal-2',
    fragmentId: 'fragment-2',
    name: 'Echo of the Gale',
    position: [4.4, 4.6, -26.5] as [number, number, number],
    color: '#34d399',
  },
  {
    id: 'l5-pedestal-3',
    fragmentId: 'fragment-3',
    name: 'Echo of the Stars',
    position: [-4.4, 4.6, -34.0] as [number, number, number],
    color: '#a78bfa',
  },
  {
    id: 'l5-pedestal-4',
    fragmentId: 'fragment-4',
    name: 'Echo of the Frost',
    position: [4.4, 4.6, -34.0] as [number, number, number],
    color: '#7dd3fc',
  },
] as const;

export interface SanctumFragmentCheck {
  unlocked: boolean;
  haveCount: number;
  missingIds: string[];
}

export function checkSanctumFragments(
  recoveredFragments: readonly string[],
): SanctumFragmentCheck {
  const missingIds = REQUIRED_SANCTUM_FRAGMENTS.filter(
    (fid) => !recoveredFragments.includes(fid),
  );
  return {
    unlocked: missingIds.length === 0,
    haveCount: REQUIRED_SANCTUM_FRAGMENTS.length - missingIds.length,
    missingIds,
  };
}

export const LEVEL5_CHUNKS: readonly LevelTerrainChunkSpec[] = [
  {
    chunk: {
      id: 'l5-arrival-island',
      label: 'Skyward Arrival & Courtyard',
      center: [0, 2.6, 12],
      boundsRadius: 18,
      loadRadius: 48,
      unloadRadius: 60,
      heavy: true,
    },
    patch: { minX: -12, maxX: 12, minZ: -8, maxZ: 34, step: 4 },
  },
  {
    chunk: {
      id: 'l5-west-wing',
      label: 'Western Resonance Isle',
      center: [-22, 3.8, -5],
      boundsRadius: 16,
      loadRadius: 48,
      unloadRadius: 60,
      heavy: true,
    },
    patch: { minX: -32, maxX: -10, minZ: -16, maxZ: 8, step: 4 },
  },
  {
    chunk: {
      id: 'l5-east-wing',
      label: 'Eastern Dawn Isle & Key Spire',
      center: [22, 4.2, 6],
      boundsRadius: 18,
      loadRadius: 48,
      unloadRadius: 60,
      heavy: true,
    },
    patch: { minX: 10, maxX: 32, minZ: -10, maxZ: 22, step: 4 },
  },
  {
    chunk: {
      id: 'l5-central-temple',
      label: 'The Sky Temple Sanctum',
      center: [0, 4.6, -27],
      boundsRadius: 20,
      loadRadius: 56,
      unloadRadius: 68,
      heavy: true,
    },
    patch: { minX: -16, maxX: 16, minZ: -44, maxZ: -12, step: 4 },
  },
];

function makeSkyCrystals(
  coords: Array<[number, number, number?]>,
): CrystalSpec[] {
  return coords.map(([x, z, fixedY], idx) => ({
    id: `l5-c${idx + 1}`,
    position: [x, (fixedY ?? getSkyTempleHeight(x, z)) + 0.85, z],
  }));
}

// Exactly 35 crystals across all 5 floating islands and bridges
export const LEVEL5_CRYSTALS: CrystalSpec[] = makeSkyCrystals([
  // Arrival Island & First Assembling Bridge (6)
  [0, 22, 2.5],
  [-4.2, 20, 2.5],
  [4.2, 20, 2.5],
  [0, 14, 2.65],
  [0, 10, 2.65],
  [0, 7.5, 2.75],
  // Southern Courtyard Island (7)
  [-5.5, 3, 2.8],
  [5.5, 3, 2.8],
  [-6.5, -2.5, 2.8],
  [6.5, -2.5, 2.8],
  [0, 1.5, 2.8],
  [-2.5, -4, 2.8],
  [2.5, -4, 2.8],
  // Western Resonance Isle & Platforms (8)
  [-17.5, -2.5, 4.0],
  [-22.5, -2.5, 4.0],
  [-27, -3.5, 4.0],
  [-27, -8.5, 4.0],
  [-22.5, -11.5, 4.0],
  [-18, -11.5, 4.0],
  [-18, -6.5, 4.0],
  [-25, -11.5, 4.0],
  // Eastern Dawn Isle, Key Spire & Vault (8)
  [12.5, 0, 3.4], // on East assembling bridge
  [18, 3.5, 4.0],
  [26.5, 3.5, 4.0],
  [21, 14.5, 4.8],
  [25, 14.5, 4.8],
  [23, 17.5, 4.8],
  [21, -5, 4.0],
  [26, -5, 4.0],
  // Central Sky Temple & Sanctum (6)
  [-8.5, -16.5, 4.6],
  [8.5, -16.5, 4.6],
  [-9.5, -24, 4.6],
  [9.5, -24, 4.6],
  [-7.5, -36, 4.6],
  [7.5, -36, 4.6],
]);
