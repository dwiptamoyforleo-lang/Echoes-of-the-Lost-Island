import type { CrystalSpec } from '@/src/game/collectibles';

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
 * Deterministic procedural heightfield for Level 1: The Forgotten Shore.
 * Ocean surface sits at y = 0.0.
 */
export function getIslandHeight(x: number, z: number): number {
  // Organic island radius
  const angle = Math.atan2(z, x);
  const coastWarp =
    3.2 * Math.sin(angle * 3.0 + 0.5) + 2.0 * Math.cos(angle * 5.0 - 0.8);
  const radial = Math.hypot(x * 0.9, z * 0.88) + coastWarp * 0.55;

  // Base island profile: underwater -> sandy beach -> rolling hills
  const landMask = 1 - smoothstep(23, 39, radial);
  const hillUndulation =
    Math.sin(x * 0.14) * Math.cos(z * 0.13) * 0.85 +
    Math.sin((x + z) * 0.09) * 0.55;

  let h = -2.4 + landMask * (5.2 + hillUndulation * 0.7);

  // Eastern tidal inlet channel separating eastern sea-stack (x ~ 14..18)
  const inletDist = Math.abs(x - 15.8);
  const inletZMask = 1 - smoothstep(6.0, 14.0, Math.abs(z - 0.5));
  const inletDepth = (1 - smoothstep(1.2, 4.2, inletDist)) * inletZMask * 3.8;
  h -= inletDepth;

  // South Beach spawn cove (gentle sand landing around [0, 25])
  h = plateauBlend(x, z, 0, 25, 4.5, 11.0, h, 1.35);

  // Central green meadow ([0, 8])
  h = plateauBlend(x, z, 0, 8, 5.5, 12.5, h, 2.5);

  // Western Headland ridge (Switch 1 at [-20, 4])
  h = plateauBlend(x, z, -20, 4, 5.2, 11.5, h, 4.5);

  // Hidden Cave clearing ([-22, -16])
  h = plateauBlend(x, z, -22, -16, 6.2, 12.0, h, 2.5);

  // Eastern Sea-Stack plateau (Switch 2 at [22, -2])
  h = plateauBlend(x, z, 22, -2, 4.8, 9.5, h, 4.5);

  // Hidden East Cove (KeyItem at [15, 14])
  h = plateauBlend(x, z, 15, 14, 3.5, 7.5, h, 2.1);

  // Northern Ancient Ruins Plaza & Sanctuary ([-10..10, -12..-33])
  const ruinsXMask = 1 - smoothstep(7.5, 14.5, Math.abs(x));
  const ruinsZMask =
    smoothstep(-6.0, -11.5, z) * (1 - smoothstep(-32.0, -37.0, z));
  // Note: smoothstep(-6, -11.5, z) is 0 when z > -6 and 1 when z < -11.5?
  // Wait: smoothstep(a, b, x) requires edge0 < edge1!
  const zNorthRise = 1 - smoothstep(-11.5, -5.5, z); // 1 for z <= -11.5, 0 for z >= -5.5
  const zNorthDrop = smoothstep(-37.0, -32.0, z); // 1 for z >= -32, 0 for z <= -37
  const ruinsMask = ruinsXMask * zNorthRise * zNorthDrop;
  h = h * (1 - ruinsMask) + 4.2 * ruinsMask;

  // Keep unused ruinsZMask compiler-clean
  void ruinsZMask;

  return h;
}

export type TerrainBiome = 'water' | 'sand' | 'grass' | 'rock';

export function classifyTerrainBiome(
  height: number,
  slopeY: number,
): TerrainBiome {
  if (height < 0.15) return 'water';
  if (height < 1.75 && slopeY > 0.85) return 'sand';
  if (slopeY < 0.78 || height > 4.6) return 'rock';
  return 'grass';
}

export const LEVEL1_SPAWN: [number, number, number] = [0, 1.5, 25];

export const LEVEL1_CRYSTALS: CrystalSpec[] = [
  // Beach & opening path (3)
  { id: 'l1-c1', position: [0, getIslandHeight(0, 19) + 0.8, 19] },
  { id: 'l1-c2', position: [-4.5, getIslandHeight(-4.5, 16) + 0.8, 16] },
  { id: 'l1-c3', position: [4.8, getIslandHeight(4.8, 15) + 0.8, 15] },

  // Central meadow & trail (3)
  { id: 'l1-c4', position: [0, getIslandHeight(0, 8) + 0.8, 8] },
  { id: 'l1-c5', position: [-7.5, getIslandHeight(-7.5, 6) + 0.8, 6] },
  { id: 'l1-c6', position: [6.5, getIslandHeight(6.5, 2) + 0.8, 2] },

  // Western Headland (3)
  { id: 'l1-c7', position: [-14, getIslandHeight(-14, 5) + 0.8, 5] },
  { id: 'l1-c8', position: [-20, getIslandHeight(-20, 8) + 0.8, 8] },
  { id: 'l1-c9', position: [-23, getIslandHeight(-23, 2) + 0.8, 2] },

  // Hidden Cave (4)
  { id: 'l1-c10', position: [-22, getIslandHeight(-22, -6) + 0.8, -6] },
  { id: 'l1-c11', position: [-21, getIslandHeight(-21, -14) + 0.8, -14] },
  { id: 'l1-c12', position: [-23.5, getIslandHeight(-23.5, -17) + 0.8, -17] },
  { id: 'l1-c13', position: [-19.5, getIslandHeight(-19.5, -18) + 0.8, -18] },

  // Eastern Sea-Stack & Ferry (3)
  { id: 'l1-c14', position: [10.5, getIslandHeight(10.5, 1) + 0.8, 1] },
  { id: 'l1-c15', position: [21, getIslandHeight(21, -5) + 0.8, -5] },
  { id: 'l1-c16', position: [24, getIslandHeight(24, 1) + 0.8, 1] },

  // Hidden East Cove (2)
  { id: 'l1-c17', position: [13, getIslandHeight(13, 15) + 0.8, 15] },
  { id: 'l1-c18', position: [17, getIslandHeight(17, 13) + 0.8, 13] },

  // Side Vault (behind key-locked door) (2)
  { id: 'l1-c19', position: [-7.5, 4.2 + 0.8, -24.5] },
  { id: 'l1-c20', position: [-7.5, 4.2 + 0.8, -26.5] },
];
