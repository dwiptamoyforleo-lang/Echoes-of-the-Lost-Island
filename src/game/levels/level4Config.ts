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
 * Deterministic terrain heightfield for Level 4: The Frozen Peaks.
 * Frozen Lake sits flat at y = 1.4 (ice sheet collider at y = 1.65);
 * surrounding snow-clad peaks rise along the outer perimeter.
 */
export function getFrozenPeaksHeight(x: number, z: number): number {
  const radial = Math.hypot(x * 0.92, z * 0.9);
  const outerRing = smoothstep(28, 42, radial);
  const crags =
    Math.abs(Math.sin(x * 0.14 + z * 0.11)) * 4.5 +
    Math.cos(x * 0.08 - z * 0.12) * 1.8;
  let h = 2.4 + outerRing * (4.5 + crags * 0.65);

  // Frozen Lake basin in the central valley (x: -14..14, z: -12..14)
  const lakeX = 1 - smoothstep(12.5, 16.5, Math.abs(x));
  const lakeZ = 1 - smoothstep(10.5, 14.5, Math.abs(z - 1));
  const lakeMask = lakeX * lakeZ;
  h = h * (1 - lakeMask) + 1.4 * lakeMask;

  // Western Glacier Chasm separating South Trail from Glacial Spire (x: -26..-15, z: -15..7)
  const chasmX = 1 - smoothstep(2.5, 6.2, Math.abs(x + 20.5));
  const chasmZ = 1 - smoothstep(8.5, 13.5, Math.abs(z + 4));
  h -= chasmX * chasmZ * 6.2;

  // South Snowy Trailhead & Spawn Terrace
  h = plateauBlend(x, z, 0, 26, 5.5, 10.5, h, 2.5);
  h = plateauBlend(x, z, 0, 17, 4.5, 9.0, h, 2.2);

  // West Approach Ledge before breakable bridge
  h = plateauBlend(x, z, -12, 7, 3.8, 7.2, h, 2.5);

  // Glacial Spire Plateau (north-west after moving platforms & breakable bridge)
  h = plateauBlend(x, z, -21, -21, 5.2, 9.5, h, 4.5);

  // East Mountain Cave Entry & Hidden Inner Cavern
  h = plateauBlend(x, z, 19, 5, 4.5, 8.5, h, 2.4);
  h = plateauBlend(x, z, 23, -10, 6.5, 11.0, h, 2.4);

  // North Frozen Sanctum Terrace
  const northX = 1 - smoothstep(10.0, 15.0, Math.abs(x));
  const northZ = (1 - smoothstep(-14.5, -11.0, z)) * smoothstep(-36, -31, z);
  const northMask = northX * northZ;
  h = h * (1 - northMask) + 3.2 * northMask;

  return h;
}

export const LEVEL4_SPAWN: [number, number, number] = [0, 2.5, 26];

export const MIRROR_IDS = [
  'l4-mirror-1',
  'l4-mirror-2',
  'l4-mirror-3',
] as const;

// Outgoing direction steps: 0 = North (-Z), 1 = East (+X), 2 = South (+Z), 3 = West (-X)
export const MIRROR_INITIAL_STEPS: readonly number[] = [2, 3, 2];
export const MIRROR_TARGET_STEPS: readonly number[] = [0, 1, 0];

export const MIRROR_POSITIONS: ReadonlyArray<[number, number, number]> = [
  [-4, 1.65, 2],
  [-4, 1.65, -7],
  [4, 1.65, -7],
];

export const EMITTER_POS: [number, number, number] = [-11, 2.75, 2];
export const RECEIVER_POS: [number, number, number] = [4, 2.75, -14.5];

export interface BeamSegment {
  from: [number, number, number];
  to: [number, number, number];
}

export interface MirrorBeamTraceResult {
  segments: BeamSegment[];
  hitNodes: number;
  solved: boolean;
}

function directionOffset(step: number, distance: number): [number, number] {
  const s = ((step % 4) + 4) % 4;
  if (s === 0) return [0, -distance]; // North
  if (s === 1) return [distance, 0]; // East
  if (s === 2) return [0, distance]; // South
  return [-distance, 0]; // West
}

/**
 * Pure beam solver for Level 4's Solar Prism & 3 Rotating Ice Mirrors puzzle.
 * Computes rendered beam segments and whether the beam hits the Sanctum Receiver.
 */
export function traceIceMirrorBeam(
  mirrorSteps: readonly number[],
): MirrorBeamTraceResult {
  const m1: [number, number, number] = [
    MIRROR_POSITIONS[0][0],
    2.75,
    MIRROR_POSITIONS[0][2],
  ];
  const m2: [number, number, number] = [
    MIRROR_POSITIONS[1][0],
    2.75,
    MIRROR_POSITIONS[1][2],
  ];
  const m3: [number, number, number] = [
    MIRROR_POSITIONS[2][0],
    2.75,
    MIRROR_POSITIONS[2][2],
  ];

  const segments: BeamSegment[] = [{ from: EMITTER_POS, to: m1 }];

  const s1 = (((mirrorSteps[0] ?? 0) % 4) + 4) % 4;
  if (s1 !== MIRROR_TARGET_STEPS[0]) {
    const [dx, dz] = directionOffset(s1, 6.5);
    segments.push({ from: m1, to: [m1[0] + dx, m1[1], m1[2] + dz] });
    return { segments, hitNodes: 1, solved: false };
  }

  segments.push({ from: m1, to: m2 });

  const s2 = (((mirrorSteps[1] ?? 0) % 4) + 4) % 4;
  if (s2 !== MIRROR_TARGET_STEPS[1]) {
    const [dx, dz] = directionOffset(s2, 6.5);
    segments.push({ from: m2, to: [m2[0] + dx, m2[1], m2[2] + dz] });
    return { segments, hitNodes: 2, solved: false };
  }

  segments.push({ from: m2, to: m3 });

  const s3 = (((mirrorSteps[2] ?? 0) % 4) + 4) % 4;
  if (s3 !== MIRROR_TARGET_STEPS[2]) {
    const [dx, dz] = directionOffset(s3, 6.5);
    segments.push({ from: m3, to: [m3[0] + dx, m3[1], m3[2] + dz] });
    return { segments, hitNodes: 3, solved: false };
  }

  segments.push({ from: m3, to: RECEIVER_POS });
  return { segments, hitNodes: 4, solved: true };
}

export const LEVEL4_CHUNKS: readonly LevelTerrainChunkSpec[] = [
  {
    chunk: {
      id: 'l4-south-lake',
      label: 'Frozen Lake & Sun Mirrors',
      center: [0, 2.0, 12],
      boundsRadius: 17,
      loadRadius: 42,
      unloadRadius: 52,
      heavy: true,
    },
    patch: { minX: -15, maxX: 15, minZ: -12, maxZ: 48, step: 2 },
  },
  {
    chunk: {
      id: 'l4-west-glacier',
      label: 'Glacial Bridges & Spire',
      center: [-21, 3.6, -4],
      boundsRadius: 16,
      loadRadius: 44,
      unloadRadius: 54,
      heavy: true,
    },
    patch: { minX: -48, maxX: -12, minZ: -48, maxZ: 48, step: 2 },
  },
  {
    chunk: {
      id: 'l4-east-cave',
      label: 'Mountain Cave & Cracked Vault',
      center: [22, 2.5, -2],
      boundsRadius: 16,
      loadRadius: 44,
      unloadRadius: 54,
      heavy: true,
      isInterior: true,
    },
    patch: { minX: 14, maxX: 48, minZ: -48, maxZ: 48, step: 2 },
  },
  {
    chunk: {
      id: 'l4-north-sanctum',
      label: 'Frozen Sanctum Citadel',
      center: [0, 3.4, -24],
      boundsRadius: 16,
      loadRadius: 48,
      unloadRadius: 58,
      heavy: true,
    },
    patch: { minX: -15, maxX: 15, minZ: -48, maxZ: -10, step: 2 },
  },
];

function makeFrozenCrystals(
  coords: Array<[number, number, number?]>,
): CrystalSpec[] {
  return coords.map(([x, z, fixedY], idx) => ({
    id: `l4-c${idx + 1}`,
    position: [x, (fixedY ?? getFrozenPeaksHeight(x, z)) + 0.85, z],
  }));
}

// Exactly 30 crystals distributed across all 4 Frozen Peaks regions
export const LEVEL4_CRYSTALS: CrystalSpec[] = makeFrozenCrystals([
  // South Trail & Frozen Lake (9)
  [0, 22],
  [-3.8, 19],
  [3.8, 18],
  [0, 12, 1.65],
  [-7.5, 6, 1.65],
  [7.5, 6, 1.65],
  [-1.5, -2, 1.65],
  [6.5, -2, 1.65],
  [0, -10, 1.65],
  // West Glacier Approach, Bridges & Spire (8)
  [-11.5, 7],
  [-16.5, 4.5, 2.7],
  [-19.5, 2.0, 2.95],
  [-21, -13.8, 4.2],
  [-23.5, -18.5, 4.5],
  [-18.5, -19.5, 4.5],
  [-24, -23.5, 4.5],
  [-18, -23.5, 4.5],
  // East Mountain Cave & Hidden Ice Chamber (7)
  [16.5, 4, 2.4],
  [21, 5, 2.4],
  [17.5, 8.2, 2.8],
  [20.5, -8, 2.4],
  [25.5, -8, 2.4],
  [25.5, -13, 2.4],
  [20.5, -13.5, 2.4],
  // North Frozen Sanctum (6)
  [-6.5, -15.5, 3.2],
  [6.5, -15.5, 3.2],
  [-5.5, -21.5, 3.2],
  [5.5, -21.5, 3.2],
  [-4.5, -28.5, 3.2],
  [4.5, -28.5, 3.2],
]);
