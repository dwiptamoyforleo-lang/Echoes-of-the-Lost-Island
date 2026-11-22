import type { CrystalSpec } from '@/src/game/collectibles';
import type { LevelTerrainChunkSpec } from './levelTerrainFactory';

/**
 * Deterministic floor heightfield for Level 3: The Sunken Kingdom.
 * Standard temple floor sits at y = 2.0; East Cistern basin drops to y = 0.2
 * with an elevated perimeter walkway at y = 3.0.
 */
export function getSunkenKingdomHeight(x: number, z: number): number {
  // East Cistern deep basin (x: 13.5..29, z: -10.5..8.5)
  if (x >= 14.5 && x <= 29 && z >= -10 && z <= 8) {
    return 0.2;
  }
  // Elevated stone walkway flanking the Cistern west/north rim (x: 10.5..14.0, z: -11..12)
  if (x >= 10.5 && x < 14.5 && z >= -11 && z <= 12) {
    return 3.0;
  }
  if (x >= 14.5 && x <= 29 && z > 8 && z <= 12.5) {
    return 3.0;
  }
  return 2.0;
}

export const LEVEL3_SPAWN: [number, number, number] = [0, 2.0, 26];

export const STATUE_IDS = [
  'l3-statue-sun',
  'l3-statue-tide',
  'l3-statue-moon',
  'l3-statue-star',
] as const;

// 0 = North, 1 = East, 2 = South, 3 = West
export const STATUE_INITIAL_STEPS: readonly number[] = [2, 3, 0, 1];
export const STATUE_TARGET_STEPS: readonly number[] = [0, 1, 2, 3];

export function areStatuesAligned(steps: readonly number[]): boolean {
  if (steps.length < STATUE_TARGET_STEPS.length) return false;
  return STATUE_TARGET_STEPS.every(
    (target, idx) => (((steps[idx] ?? -1) % 4) + 4) % 4 === target,
  );
}

/**
 * Flooded Cistern water bounds (world coordinates).
 * Water surface sits at y = 2.85 when flooded.
 */
export const CISTERN_WATER_BOUNDS = {
  minX: 14.2,
  maxX: 29.2,
  minY: -0.5,
  maxY: 2.85,
  minZ: -10.5,
  maxZ: 8.5,
} as const;

export function isPositionInFloodedCistern(
  pos: { x: number; y: number; z: number },
  isDrained: boolean,
): boolean {
  if (isDrained) return false;
  return (
    pos.x >= CISTERN_WATER_BOUNDS.minX &&
    pos.x <= CISTERN_WATER_BOUNDS.maxX &&
    pos.z >= CISTERN_WATER_BOUNDS.minZ &&
    pos.z <= CISTERN_WATER_BOUNDS.maxZ &&
    pos.y >= CISTERN_WATER_BOUNDS.minY &&
    pos.y <= CISTERN_WATER_BOUNDS.maxY
  );
}

export const LEVEL3_CHUNKS: readonly LevelTerrainChunkSpec[] = [
  {
    chunk: {
      id: 'l3-entry',
      label: 'Subterranean Vestibule & Central Hall',
      center: [0, 2.5, 16],
      boundsRadius: 16,
      loadRadius: 36,
      unloadRadius: 45,
      heavy: true,
      isInterior: true,
    },
    patch: { minX: -12, maxX: 12, minZ: -6, maxZ: 34, step: 4 },
  },
  {
    chunk: {
      id: 'l3-west-crypt',
      label: 'Western Crypt & Sealed Vault',
      center: [-20, 2.5, 0],
      boundsRadius: 16,
      loadRadius: 42,
      unloadRadius: 52,
      heavy: true,
      isInterior: true,
    },
    patch: { minX: -34, maxX: -10, minZ: -24, maxZ: 20, step: 4 },
  },
  {
    chunk: {
      id: 'l3-east-cistern',
      label: 'Flooded Cistern Chamber',
      center: [21, 2.0, -1],
      boundsRadius: 16,
      loadRadius: 42,
      unloadRadius: 52,
      heavy: true,
      isInterior: true,
    },
    patch: { minX: 10, maxX: 34, minZ: -20, maxZ: 20, step: 4 },
  },
  {
    chunk: {
      id: 'l3-north-sanctum',
      label: 'Hall of Four Guardians & Star Throne',
      center: [0, 2.5, -21],
      boundsRadius: 16,
      loadRadius: 56,
      unloadRadius: 66,
      heavy: true,
      isInterior: true,
    },
    patch: { minX: -14, maxX: 14, minZ: -36, maxZ: -6, step: 4 },
  },
];

function makeKingdomCrystals(
  coords: Array<[number, number, number?]>,
): CrystalSpec[] {
  return coords.map(([x, z, fixedY], idx) => ({
    id: `l3-c${idx + 1}`,
    position: [x, (fixedY ?? getSunkenKingdomHeight(x, z)) + 0.85, z],
  }));
}

// Exactly 30 crystals distributed across all 4 chambers & vaults
export const LEVEL3_CRYSTALS: CrystalSpec[] = makeKingdomCrystals([
  // South Entry Vestibule & Central Hall (6)
  [-2.5, 22, 2.0],
  [2.5, 22, 2.0],
  [0, 14, 2.0],
  [-5.5, 6, 2.0],
  [5.5, 6, 2.0],
  [0, -4, 2.0],
  // West Crypt & Bronze Key Alcove (6)
  [-13, 3, 2.0],
  [-18, 7, 2.0],
  [-24, 9, 2.0],
  [-26, 3, 2.0],
  [-17, 1, 2.0],
  [-14, -2, 2.0],
  // Western Interconnected Vault (4)
  [-20, -10, 2.0],
  [-24, -12, 2.0],
  [-24, -15, 2.0],
  [-18, -15, 2.0],
  // East Flooded Cistern (Walkway + Basin) (8)
  [12.2, 9.5, 3.0],
  [18, 10.5, 3.0],
  [24, 10.5, 3.0],
  [18, 3, 0.2],
  [22, 0, 0.2],
  [18, -5, 0.2],
  [24, -1, 0.2],
  [26, -7, 0.2],
  // North Guardian Rotunda & Star Throne (6)
  [-6.5, -14, 2.0],
  [6.5, -14, 2.0],
  [-6.5, -20, 2.0],
  [6.5, -20, 2.0],
  [-3.5, -28.5, 2.0],
  [3.5, -28.5, 2.0],
]);
