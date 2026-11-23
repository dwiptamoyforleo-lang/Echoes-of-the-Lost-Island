import type { CrystalSpec } from '@/src/game/collectibles';
import type { LevelTerrainChunkSpec } from './levelTerrainFactory';

function smoothstep(edge0: number, edge1: number, x: number): number {
  const t = Math.max(0, Math.min(1, (x - edge0) / (edge1 - edge0)));
  return t * t * (3 - 2 * t);
}

function plateauBlend(
  x: number,
  z: number,
  cx: number,
  cz: number,
  innerRadius: number,
  outerRadius: number,
  currentHeight: number,
  targetHeight: number,
): number {
  const d = Math.hypot(x - cx, z - cz);
  const w = 1 - smoothstep(innerRadius, outerRadius, d);
  return currentHeight * (1 - w) + targetHeight * w;
}

/**
 * Deterministic terrain heightfield for Level 2: Whispering Woods.
 * Water surface sits at y = 0.0; main river gorge flows east-west near z = -1.
 */
export function getWoodsHeight(x: number, z: number): number {
  const angle = Math.atan2(z, x);
  const rimWarp = 2.6 * Math.sin(angle * 4 + 0.4) + 1.8 * Math.cos(angle * 3 - 0.5);
  const radial = Math.hypot(x * 0.88, z * 0.88) + rimWarp * 0.45;
  const landMask = 1 - smoothstep(28, 44, radial);

  const undulation =
    Math.sin(x * 0.11) * Math.cos(z * 0.13) * 0.95 +
    Math.cos((x + z) * 0.08) * 0.55;

  let h = -2.2 + landMask * (5.2 + undulation * 0.45);

  // Main East-West River Gorge (z ~ -1) spanning x = -22..26
  const riverBand = 1 - smoothstep(1.8, 5.2, Math.abs(z + 1.0));
  const riverXMask = 1 - smoothstep(20, 28, Math.abs(x));
  h -= riverBand * riverXMask * 4.0;

  // Western Waterfall Cliff rise (west of x = -18, z ~ -4..4) feeding the upper falls
  const cliffRise =
    (1 - smoothstep(0, 6, x + 22)) * (1 - smoothstep(4, 10, Math.abs(z + 1)));
  h += cliffRise * 3.8;

  // South Trailhead & Crossroads Glade
  h = plateauBlend(x, z, 0, 26, 5.5, 11.5, h, 3.0);
  h = plateauBlend(x, z, 0, 14, 6.5, 12.5, h, 3.0);

  // South-East Fern Glade (Totem 1: Roots)
  h = plateauBlend(x, z, 11, 18, 4.5, 9.0, h, 3.1);

  // River-Wheel Winch Plaza (south bank of river)
  h = plateauBlend(x, z, 6.5, 6.8, 4.2, 8.2, h, 3.1);

  // West Bridge South Approach
  h = plateauBlend(x, z, -10.5, 6.5, 3.8, 7.5, h, 3.1);

  // Western Waterfall Hollow (Totem 2: Wings)
  h = plateauBlend(x, z, -19, -9.5, 5.5, 10.5, h, 3.2);

  // East Bank Alcove (Hidden Path Switch)
  h = plateauBlend(x, z, 17, 10, 4.2, 8.2, h, 3.1);

  // Hidden Eastern Moss Grotto (Chest 1 & bonus crystals)
  h = plateauBlend(x, z, 21, -14, 5.5, 10.5, h, 3.6);

  // Northern Ruined Shrine Island & Arch (Totem 3: Antlers + Fragment 2)
  const shrineXMask = 1 - smoothstep(9.0, 15.0, Math.abs(x));
  const shrineZRise = 1 - smoothstep(-10.5, -5.0, z);
  const shrineZDrop = smoothstep(-35.0, -30.0, z);
  const shrineMask = shrineXMask * shrineZRise * shrineZDrop;
  h = h * (1 - shrineMask) + 4.0 * shrineMask;

  return h;
}

export const LEVEL2_SPAWN: [number, number, number] = [0, 3.0, 26];

export const TOTEM_SEQUENCE = [
  'totem-roots',
  'totem-wings',
  'totem-antlers',
] as const;

export type TotemId = (typeof TOTEM_SEQUENCE)[number];

export interface TotemStepResult {
  nextStep: number;
  solved: boolean;
  resetTriggered: boolean;
  activatedIdsPatch: Record<string, boolean>;
}

/**
 * Pure state transition for Level 2's ordered 3-spirit-totem puzzle.
 * Requires exact order: Roots -> Wings -> Antlers.
 * Wrong order resets all totems back to 0 so the player can retry.
 */
export function evaluateTotemSequence(
  currentStep: number,
  clickedTotemId: TotemId,
): TotemStepResult {
  if (currentStep >= TOTEM_SEQUENCE.length) {
    return {
      nextStep: TOTEM_SEQUENCE.length,
      solved: true,
      resetTriggered: false,
      activatedIdsPatch: {},
    };
  }

  const expected = TOTEM_SEQUENCE[currentStep];
  if (clickedTotemId === expected) {
    const nextStep = currentStep + 1;
    const solved = nextStep >= TOTEM_SEQUENCE.length;
    return {
      nextStep,
      solved,
      resetTriggered: false,
      activatedIdsPatch: {
        [clickedTotemId]: true,
        ...(solved ? { 'l2-totems-solved': true } : {}),
      },
    };
  }

  // Wrong order: reset all active totems
  return {
    nextStep: 0,
    solved: false,
    resetTriggered: true,
    activatedIdsPatch: {
      'totem-roots': false,
      'totem-wings': false,
      'totem-antlers': false,
    },
  };
}

export const BRIDGE_WHEEL_IDS = [
  'l2-wheel-1',
  'l2-wheel-2',
  'l2-wheel-3',
] as const;

export const BRIDGE_WHEEL_INITIAL_STEPS: readonly number[] = [2, 1, 3];
export const BRIDGE_WHEEL_TARGET_STEPS: readonly number[] = [0, 0, 0];

export function areWheelsAligned(steps: readonly number[]): boolean {
  if (steps.length < BRIDGE_WHEEL_TARGET_STEPS.length) return false;
  return BRIDGE_WHEEL_TARGET_STEPS.every(
    (target, idx) => (((steps[idx] ?? -1) % 4) + 4) % 4 === target,
  );
}

export const LEVEL2_CHUNKS: readonly LevelTerrainChunkSpec[] = [
  {
    chunk: {
      id: 'l2-south-glade',
      label: 'Whispering Trailhead & Riverbank',
      center: [0, 3, 16],
      boundsRadius: 16,
      loadRadius: 34,
      unloadRadius: 43,
      heavy: true,
    },
    patch: { minX: -15, maxX: 16, minZ: -2, maxZ: 48, step: 2 },
    includeWaterInChunk: true,
  },
  {
    chunk: {
      id: 'l2-west-falls',
      label: 'Western Waterfall Hollow',
      center: [-20, 3.2, -4],
      boundsRadius: 15,
      loadRadius: 34,
      unloadRadius: 43,
      heavy: true,
    },
    patch: { minX: -48, maxX: -12, minZ: -48, maxZ: 48, step: 2 },
  },
  {
    chunk: {
      id: 'l2-east-grotto',
      label: 'Hidden Eastern Moss Grotto',
      center: [21, 3.4, -3],
      boundsRadius: 16,
      loadRadius: 34,
      unloadRadius: 43,
      heavy: true,
    },
    patch: { minX: 14, maxX: 48, minZ: -48, maxZ: 48, step: 2 },
  },
  {
    chunk: {
      id: 'l2-north-shrine',
      label: 'Ruined Woodland Shrine',
      center: [0, 4, -20],
      boundsRadius: 16,
      loadRadius: 34,
      unloadRadius: 43,
      heavy: true,
    },
    patch: { minX: -15, maxX: 16, minZ: -48, maxZ: -2, step: 2 },
  },
];

function makeWoodsCrystals(
  coords: Array<[number, number, number?]>,
): CrystalSpec[] {
  return coords.map(([x, z, fixedY], idx) => ({
    id: `l2-c${idx + 1}`,
    position: [x, (fixedY ?? getWoodsHeight(x, z)) + 0.85, z],
  }));
}

// Exactly 25 crystals across all 4 Whispering Woods regions
export const LEVEL2_CRYSTALS: CrystalSpec[] = makeWoodsCrystals([
  // South Trail & Fern Glade (6)
  [0, 21],
  [-4.2, 18],
  [4.2, 17],
  [0, 12],
  [9.5, 17],
  [12.5, 19],
  // Riverbank, Wheels & West Bridge (5)
  [5.5, 8.5],
  [8.5, 5.8],
  [-6.5, 7.5],
  [-10.5, 4.0, 3.25],
  [-10.5, -4.0, 3.25],
  // Western Waterfall Hollow (5)
  [-15.5, -7.5],
  [-19.5, -6.5],
  [-21.5, -12.0],
  [-17.5, -13.5],
  [-15.0, 6.0],
  // East Alcove & Hidden Moss Grotto (5)
  [16.5, 12.0],
  [19.0, 2.0, 3.3],
  [19.0, -5.0, 3.3],
  [20.5, -12.5],
  [23.0, -16.0],
  // Northern Ruined Shrine & Sanctum (4)
  [-6.5, -13.5, 4.0],
  [6.5, -13.5, 4.0],
  [-4.5, -24.5, 4.0],
  [4.5, -24.5, 4.0],
]);
