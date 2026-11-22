import * as THREE from 'three';
import type { CrystalSpec } from '@/src/game/collectibles';
import { acquireGeometry } from '@/src/game/rendering/assetCache';
import type { LevelId } from '@/src/systems/progressionSystem';
import type { ChunkDefinition } from './chunkStreaming';
import { classifyTerrainBiome, getIslandHeight, LEVEL1_CRYSTALS, LEVEL1_SPAWN } from './level1Terrain';

export interface TerrainPatchBounds {
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
  step?: number;
}

export interface LevelTerrainChunkSpec {
  chunk: ChunkDefinition;
  patch: TerrainPatchBounds;
  includeWaterInChunk?: boolean;
}

export interface BiomePalette {
  skyColor: string;
  fogColor: string;
  fogNear: number;
  fogFar: number;
  sunColor: string;
  sunIntensity: number;
  hemiSky: string;
  hemiGround: string;
  hemiIntensity: number;
  waterColor: string;
  waterOpacity: number;
  sandLow: string;
  sandHigh: string;
  grassBase: string;
  grassLush: string;
  rockColor: string;
  trunkColor: string;
  canopyColor: string;
  grassBladeColor: string;
  crystalColor: string;
  useSkyDome: boolean;
  sunPosition: [number, number, number];
}

export const LEVEL_BIOMES: Record<LevelId, BiomePalette> = {
  level1: {
    skyColor: '#94cbe8',
    fogColor: '#b5ddf0',
    fogNear: 48,
    fogFar: 138,
    sunColor: '#fff2d2',
    sunIntensity: 2.35,
    hemiSky: '#c8ebff',
    hemiGround: '#6a7852',
    hemiIntensity: 0.75,
    waterColor: '#1b8ea6',
    waterOpacity: 0.88,
    sandLow: '#c9b27c',
    sandHigh: '#e6cf98',
    grassBase: '#5f9354',
    grassLush: '#74a85e',
    rockColor: '#7a7d76',
    trunkColor: '#8c6443',
    canopyColor: '#3f8f4e',
    grassBladeColor: '#63a355',
    crystalColor: '#38bdf8',
    useSkyDome: true,
    sunPosition: [60, 42, 35],
  },
  level2: {
    skyColor: '#a8dec8',
    fogColor: '#a6d9c4',
    fogNear: 42,
    fogFar: 126,
    sunColor: '#fff6d6',
    sunIntensity: 2.25,
    hemiSky: '#d5f7e6',
    hemiGround: '#436345',
    hemiIntensity: 0.85,
    waterColor: '#258d82',
    waterOpacity: 0.85,
    sandLow: '#93a36d',
    sandHigh: '#aebe7c',
    grassBase: '#3f7f48',
    grassLush: '#58a156',
    rockColor: '#68736a',
    trunkColor: '#6d4c36',
    canopyColor: '#2e7d47',
    grassBladeColor: '#4fa357',
    crystalColor: '#34d399',
    useSkyDome: true,
    sunPosition: [45, 52, 24],
  },
  level3: {
    skyColor: '#8dc1da',
    fogColor: '#8ec0d6',
    fogNear: 40,
    fogFar: 122,
    sunColor: '#e8f4ff',
    sunIntensity: 2.1,
    hemiSky: '#bce2f7',
    hemiGround: '#445d6e',
    hemiIntensity: 0.8,
    waterColor: '#166f94',
    waterOpacity: 0.86,
    sandLow: '#8ea3aa',
    sandHigh: '#b3c3c7',
    grassBase: '#4c7c77',
    grassLush: '#62988d',
    rockColor: '#627380',
    trunkColor: '#5c6b75',
    canopyColor: '#3a7a78',
    grassBladeColor: '#54938d',
    crystalColor: '#60a5fa',
    useSkyDome: true,
    sunPosition: [-35, 48, 30],
  },
  level4: {
    skyColor: '#5b4036',
    fogColor: '#634438',
    fogNear: 38,
    fogFar: 118,
    sunColor: '#ffd4a6',
    sunIntensity: 2.2,
    hemiSky: '#ffb784',
    hemiGround: '#3d2a24',
    hemiIntensity: 0.72,
    waterColor: '#c2410c',
    waterOpacity: 0.92,
    sandLow: '#493c38',
    sandHigh: '#63514a',
    grassBase: '#5c4b44',
    grassLush: '#7a5c49',
    rockColor: '#3a3435',
    trunkColor: '#4a3a35',
    canopyColor: '#8c4b32',
    grassBladeColor: '#b45309',
    crystalColor: '#fb923c',
    useSkyDome: false,
    sunPosition: [30, 38, -28],
  },
  level5: {
    skyColor: '#c2d8ef',
    fogColor: '#cfe0f2',
    fogNear: 44,
    fogFar: 136,
    sunColor: '#fff5dc',
    sunIntensity: 2.45,
    hemiSky: '#e8f1ff',
    hemiGround: '#6c727f',
    hemiIntensity: 0.9,
    waterColor: '#4e8db8',
    waterOpacity: 0.82,
    sandLow: '#b8b2a4',
    sandHigh: '#dcd6c6',
    grassBase: '#6f8e76',
    grassLush: '#86aa88',
    rockColor: '#8d929b',
    trunkColor: '#99896e',
    canopyColor: '#538d7c',
    grassBladeColor: '#76ab90',
    crystalColor: '#e879f9',
    useSkyDome: true,
    sunPosition: [40, 56, 20],
  },
};

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

// Level 2: Whispering Canopy
export function getCanopyHeight(x: number, z: number): number {
  const radial = Math.hypot(x * 0.92, z * 0.9);
  const landMask = 1 - smoothstep(26, 42, radial);
  const hills =
    Math.sin(x * 0.12) * Math.cos(z * 0.14) * 1.15 +
    Math.cos((x - z) * 0.08) * 0.7;
  let h = -2.2 + landMask * (6.2 + hills * 0.65);

  // Ravine stream dividing east bridge & wind shrine
  const gorge = (1 - smoothstep(1.5, 4.8, Math.abs(x - 13.5))) * (1 - smoothstep(8, 16, Math.abs(z)));
  h -= gorge * 3.6;

  // Spawn terrace
  h = plateauBlend(x, z, 0, 26, 5.5, 11.5, h, 2.2);
  // Central glade
  h = plateauBlend(x, z, 0, 6, 6.0, 12.0, h, 3.6);
  // West elder bough ridge
  h = plateauBlend(x, z, -22, 2, 5.5, 11.0, h, 5.0);
  // East wind-bridge ledge
  h = plateauBlend(x, z, 22, 0, 5.2, 10.0, h, 5.0);
  // North shrine terrace
  h = plateauBlend(x, z, 0, -24, 9.5, 16.0, h, 5.2);
  return h;
}

// Level 3: Sunken Observatory
export function getObservatoryHeight(x: number, z: number): number {
  const radial = Math.hypot(x * 0.9, z * 0.88);
  const landMask = 1 - smoothstep(24, 41, radial);
  const steps = Math.sin(x * 0.11) * Math.sin(z * 0.11) * 0.85;
  let h = -2.6 + landMask * (5.4 + steps * 0.55);

  // Tidal canal separating north sanctum from causeway
  const canal = (1 - smoothstep(2.0, 5.2, Math.abs(z + 8.5))) * (1 - smoothstep(7, 15, Math.abs(x)));
  h -= canal * 3.2;

  h = plateauBlend(x, z, 0, 26, 5.5, 11.5, h, 1.8);
  h = plateauBlend(x, z, 0, 7, 5.5, 11.5, h, 2.8);
  h = plateauBlend(x, z, -22, 2, 5.5, 10.5, h, 4.2);
  h = plateauBlend(x, z, 22, -4, 6.0, 11.5, h, 3.2);
  h = plateauBlend(x, z, 0, -24, 10.0, 16.0, h, 4.6);
  return h;
}

// Level 4: Obsidian Caldera
export function getCalderaHeight(x: number, z: number): number {
  const radial = Math.hypot(x * 0.92, z * 0.9);
  const landMask = 1 - smoothstep(25, 42, radial);
  const ridge = Math.abs(Math.sin(x * 0.12 + z * 0.09)) * 1.4;
  let h = -2.4 + landMask * (6.0 + ridge * 0.6);

  // Lava fissure between main approach and north hearth
  const fissure = (1 - smoothstep(1.8, 5.0, Math.abs(z + 7))) * (1 - smoothstep(6, 15, Math.abs(x - 10)));
  h -= fissure * 4.0;

  h = plateauBlend(x, z, 0, 26, 5.5, 11.0, h, 2.0);
  h = plateauBlend(x, z, 0, 6, 5.5, 11.5, h, 3.4);
  h = plateauBlend(x, z, -22, 0, 5.5, 10.5, h, 4.8);
  h = plateauBlend(x, z, 22, -4, 6.2, 11.5, h, 3.5);
  h = plateauBlend(x, z, 0, -24, 10.0, 16.0, h, 5.0);
  return h;
}

// Level 5: Heart of the Spire
export function getSpireHeight(x: number, z: number): number {
  const radial = Math.hypot(x * 0.92, z * 0.9);
  const landMask = 1 - smoothstep(26, 43, radial);
  const terraces = Math.cos(x * 0.1) * Math.cos(z * 0.1) * 0.9;
  let h = -2.0 + landMask * (5.6 + terraces * 0.45);

  h = plateauBlend(x, z, 0, 26, 5.5, 11.5, h, 2.0);
  h = plateauBlend(x, z, 0, 7, 5.8, 12.0, h, 3.6);
  h = plateauBlend(x, z, -22, 1, 5.2, 10.5, h, 4.6);
  h = plateauBlend(x, z, 22, 1, 5.2, 10.5, h, 4.6);
  h = plateauBlend(x, z, 0, -24, 10.5, 16.5, h, 5.6);
  return h;
}

export function getLevelHeight(levelId: LevelId, x: number, z: number): number {
  switch (levelId) {
    case 'level1':
      return getIslandHeight(x, z);
    case 'level2':
      return getCanopyHeight(x, z);
    case 'level3':
      return getObservatoryHeight(x, z);
    case 'level4':
      return getCalderaHeight(x, z);
    case 'level5':
      return getSpireHeight(x, z);
  }
}

export function getLevelSpawn(levelId: LevelId): [number, number, number] {
  switch (levelId) {
    case 'level1':
      return LEVEL1_SPAWN;
    case 'level2':
      return [0, getCanopyHeight(0, 26) + 0.5, 26];
    case 'level3':
      return [0, getObservatoryHeight(0, 26) + 0.5, 26];
    case 'level4':
      return [0, getCalderaHeight(0, 26) + 0.5, 26];
    case 'level5':
      return [0, getSpireHeight(0, 26) + 0.5, 26];
  }
}

export const LEVEL_CHUNKS: Record<LevelId, readonly LevelTerrainChunkSpec[]> = {
  level1: [
    {
      chunk: {
        id: 'l1-shore',
        label: 'South Shore & Meadow',
        center: [0, 2, 20],
        boundsRadius: 15,
        loadRadius: 34,
        unloadRadius: 43,
        heavy: true,
      },
      patch: { minX: -14, maxX: 14, minZ: -6, maxZ: 52, step: 2 },
      includeWaterInChunk: true,
    },
    {
      chunk: {
        id: 'l1-west-ridge',
        label: 'Western Headland',
        center: [-24, 4, 14],
        boundsRadius: 14,
        loadRadius: 34,
        unloadRadius: 43,
        heavy: true,
      },
      patch: { minX: -52, maxX: -14, minZ: -6, maxZ: 52, step: 2 },
    },
    {
      chunk: {
        id: 'l1-east-cove',
        label: 'East Cove & Ferry',
        center: [24, 3, 12],
        boundsRadius: 15,
        loadRadius: 36,
        unloadRadius: 45,
        heavy: true,
      },
      patch: { minX: 14, maxX: 52, minZ: -52, maxZ: 52, step: 2 },
    },
    {
      chunk: {
        id: 'l1-sea-cave',
        label: 'Hidden Sea Cave',
        center: [-24, 3, -20],
        boundsRadius: 14,
        loadRadius: 31,
        unloadRadius: 39,
        heavy: true,
        isInterior: true,
      },
      patch: { minX: -52, maxX: -14, minZ: -52, maxZ: -6, step: 2 },
    },
    {
      chunk: {
        id: 'l1-ruins',
        label: 'Northern Ruins Sanctuary',
        center: [0, 4, -22],
        boundsRadius: 15,
        loadRadius: 32,
        unloadRadius: 40,
        heavy: true,
      },
      patch: { minX: -14, maxX: 14, minZ: -52, maxZ: -6, step: 2 },
    },
  ],
  level2: [
    {
      chunk: {
        id: 'l2-entry',
        label: 'Emerald Trailhead',
        center: [0, 2.5, 20],
        boundsRadius: 15,
        loadRadius: 32,
        unloadRadius: 40,
        heavy: true,
      },
      patch: { minX: -14, maxX: 14, minZ: -6, maxZ: 52, step: 2 },
      includeWaterInChunk: true,
    },
    {
      chunk: {
        id: 'l2-west-boughs',
        label: 'Elder Bough Terrace',
        center: [-24, 5, 4],
        boundsRadius: 15,
        loadRadius: 33,
        unloadRadius: 41,
        heavy: true,
      },
      patch: { minX: -52, maxX: -14, minZ: -52, maxZ: 52, step: 2 },
    },
    {
      chunk: {
        id: 'l2-east-bridge',
        label: 'Suspended Wind Bridge',
        center: [24, 5, 2],
        boundsRadius: 15,
        loadRadius: 33,
        unloadRadius: 41,
        heavy: true,
      },
      patch: { minX: 14, maxX: 52, minZ: -52, maxZ: 52, step: 2 },
    },
    {
      chunk: {
        id: 'l2-wind-shrine',
        label: 'Canopy Wind Sanctum',
        center: [0, 5, -24],
        boundsRadius: 16,
        loadRadius: 32,
        unloadRadius: 40,
        heavy: true,
      },
      patch: { minX: -14, maxX: 14, minZ: -52, maxZ: -6, step: 2 },
    },
  ],
  level3: [
    {
      chunk: {
        id: 'l3-causeway',
        label: 'Tidal Causeway',
        center: [0, 2.5, 20],
        boundsRadius: 15,
        loadRadius: 32,
        unloadRadius: 40,
        heavy: true,
      },
      patch: { minX: -14, maxX: 14, minZ: -6, maxZ: 52, step: 2 },
      includeWaterInChunk: true,
    },
    {
      chunk: {
        id: 'l3-lens-west',
        label: 'Western Lens Deck',
        center: [-24, 4, 4],
        boundsRadius: 15,
        loadRadius: 33,
        unloadRadius: 41,
        heavy: true,
      },
      patch: { minX: -52, maxX: -14, minZ: -52, maxZ: 52, step: 2 },
    },
    {
      chunk: {
        id: 'l3-vault-east',
        label: 'Flooded Astrolabe Vault',
        center: [24, 3.5, -2],
        boundsRadius: 15,
        loadRadius: 33,
        unloadRadius: 41,
        heavy: true,
        isInterior: true,
      },
      patch: { minX: 14, maxX: 52, minZ: -52, maxZ: 52, step: 2 },
    },
    {
      chunk: {
        id: 'l3-star-sanctum',
        label: 'Starlight Sanctum',
        center: [0, 4.6, -24],
        boundsRadius: 16,
        loadRadius: 32,
        unloadRadius: 40,
        heavy: true,
      },
      patch: { minX: -14, maxX: 14, minZ: -52, maxZ: -6, step: 2 },
    },
  ],
  level4: [
    {
      chunk: {
        id: 'l4-trail',
        label: 'Basalt Landing',
        center: [0, 2.5, 20],
        boundsRadius: 15,
        loadRadius: 32,
        unloadRadius: 40,
        heavy: true,
      },
      patch: { minX: -14, maxX: 14, minZ: -6, maxZ: 52, step: 2 },
      includeWaterInChunk: true,
    },
    {
      chunk: {
        id: 'l4-west-ridge',
        label: 'Thermal Vent Ridge',
        center: [-24, 4.8, 2],
        boundsRadius: 15,
        loadRadius: 33,
        unloadRadius: 41,
        heavy: true,
      },
      patch: { minX: -52, maxX: -14, minZ: -52, maxZ: 52, step: 2 },
    },
    {
      chunk: {
        id: 'l4-ember-chamber',
        label: 'Obsidian Forge Chamber',
        center: [24, 3.5, -2],
        boundsRadius: 15,
        loadRadius: 33,
        unloadRadius: 41,
        heavy: true,
        isInterior: true,
      },
      patch: { minX: 14, maxX: 52, minZ: -52, maxZ: 52, step: 2 },
    },
    {
      chunk: {
        id: 'l4-hearth',
        label: 'Caldera Hearth Sanctum',
        center: [0, 5, -24],
        boundsRadius: 16,
        loadRadius: 32,
        unloadRadius: 40,
        heavy: true,
      },
      patch: { minX: -14, maxX: 14, minZ: -52, maxZ: -6, step: 2 },
    },
  ],
  level5: [
    {
      chunk: {
        id: 'l5-steps',
        label: 'Skyward Ascent',
        center: [0, 2.5, 20],
        boundsRadius: 15,
        loadRadius: 32,
        unloadRadius: 40,
        heavy: true,
      },
      patch: { minX: -14, maxX: 14, minZ: -6, maxZ: 52, step: 2 },
      includeWaterInChunk: true,
    },
    {
      chunk: {
        id: 'l5-echo-west',
        label: 'Western Resonance Wing',
        center: [-24, 4.6, 2],
        boundsRadius: 15,
        loadRadius: 33,
        unloadRadius: 41,
        heavy: true,
      },
      patch: { minX: -52, maxX: -14, minZ: -52, maxZ: 52, step: 2 },
    },
    {
      chunk: {
        id: 'l5-echo-east',
        label: 'Eastern Resonance Wing',
        center: [24, 4.6, 2],
        boundsRadius: 15,
        loadRadius: 33,
        unloadRadius: 41,
        heavy: true,
      },
      patch: { minX: 14, maxX: 52, minZ: -52, maxZ: 52, step: 2 },
    },
    {
      chunk: {
        id: 'l5-summit',
        label: 'Heart of the Spire',
        center: [0, 5.6, -24],
        boundsRadius: 16,
        loadRadius: 32,
        unloadRadius: 40,
        heavy: true,
      },
      patch: { minX: -14, maxX: 14, minZ: -52, maxZ: -6, step: 2 },
    },
  ],
};

function makeCrystalsFromCoords(
  prefix: string,
  levelId: LevelId,
  coords: Array<[number, number, number?]>,
): CrystalSpec[] {
  return coords.map(([x, z, fixedY], idx) => ({
    id: `${prefix}-c${idx + 1}`,
    position: [x, (fixedY ?? getLevelHeight(levelId, x, z)) + 0.85, z],
  }));
}

export const LEVEL2_CRYSTALS: CrystalSpec[] = makeCrystalsFromCoords('l2', 'level2', [
  [0, 20], [-4, 16], [4, 15], [0, 10], [-6, 6],
  [6, 4], [-15, 5], [-20, 7], [-23, 1], [-21, -5],
  [10, 2], [20, -3], [23, 3], [21, 9], [16, -9],
  [-4, -15, 5.2], [4, -15, 5.2], [-6.5, -24, 5.2], [6.5, -24, 5.2], [0, -18, 5.2],
]);

export const LEVEL3_CRYSTALS: CrystalSpec[] = makeCrystalsFromCoords('l3', 'level3', [
  [0, 20], [-4.5, 16], [4.5, 15], [0, 9], [-7, 5],
  [7, 4], [-16, 4], [-21, 7], [-24, 1], [-20, -6],
  [12, 2], [20, -2], [24, -6], [21, -10], [18, 8],
  [-4.5, -16, 4.6], [4.5, -16, 4.6], [-6.5, -25, 4.6], [6.5, -25, 4.6], [0, -19, 4.6],
]);

export const LEVEL4_CRYSTALS: CrystalSpec[] = makeCrystalsFromCoords('l4', 'level4', [
  [0, 20], [-4, 16], [4, 15], [0, 10], [-6, 5],
  [6, 4], [-16, 3], [-21, 6], [-24, -1], [-20, -6],
  [12, 2], [20, -2], [24, -6], [20, -11], [17, 7],
  [-4.5, -16, 5.0], [4.5, -16, 5.0], [-6.5, -25, 5.0], [6.5, -25, 5.0], [0, -19, 5.0],
]);

export const LEVEL5_CRYSTALS: CrystalSpec[] = makeCrystalsFromCoords('l5', 'level5', [
  [0, 20], [-4, 16], [4, 15], [0, 10], [-7, 5],
  [7, 5], [-16, 3], [-21, 6], [-24, 0], [-20, -6],
  [16, 3], [21, 6], [24, 0], [20, -6], [0, -5],
  [-4.5, -16, 5.6], [4.5, -16, 5.6], [-6.5, -25, 5.6], [6.5, -25, 5.6], [0, -19, 5.6],
]);

export const LEVEL_CRYSTALS: Record<LevelId, CrystalSpec[]> = {
  level1: LEVEL1_CRYSTALS,
  level2: LEVEL2_CRYSTALS,
  level3: LEVEL3_CRYSTALS,
  level4: LEVEL4_CRYSTALS,
  level5: LEVEL5_CRYSTALS,
};

export function getCrystalsForChunk(
  levelId: LevelId,
  patch: TerrainPatchBounds,
): CrystalSpec[] {
  return LEVEL_CRYSTALS[levelId].filter((c) => {
    const [x, , z] = c.position;
    return x >= patch.minX && x < patch.maxX && z >= patch.minZ && z < patch.maxZ;
  });
}

const _col = new THREE.Color();
const _cSandWet = new THREE.Color();
const _cSand = new THREE.Color();
const _cGrass = new THREE.Color();
const _cGrassLush = new THREE.Color();
const _cRock = new THREE.Color();

export function acquireChunkTerrainGeometry(
  levelId: LevelId,
  chunkId: string,
  patch: TerrainPatchBounds,
): THREE.BufferGeometry {
  const step = patch.step ?? 2;
  const key = `terrain-chunk-${levelId}-${chunkId}-s${step}`;
  return acquireGeometry(key, () => {
    const width = patch.maxX - patch.minX;
    const depth = patch.maxZ - patch.minZ;
    const segX = Math.max(2, Math.round(width / step));
    const segZ = Math.max(2, Math.round(depth / step));

    const geo = new THREE.PlaneGeometry(width, depth, segX, segZ);
    geo.rotateX(-Math.PI / 2);
    const centerX = (patch.minX + patch.maxX) * 0.5;
    const centerZ = (patch.minZ + patch.maxZ) * 0.5;
    geo.translate(centerX, 0, centerZ);

    const pos = geo.attributes.position as THREE.BufferAttribute;
    const norm = geo.attributes.normal as THREE.BufferAttribute;
    const colors = new Float32Array(pos.count * 3);

    const palette = LEVEL_BIOMES[levelId];
    _cSandWet.set(palette.sandLow);
    _cSand.set(palette.sandHigh);
    _cGrass.set(palette.grassBase);
    _cGrassLush.set(palette.grassLush);
    _cRock.set(palette.rockColor);

    const eps = 0.6;
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i);
      const z = pos.getZ(i);
      const y = getLevelHeight(levelId, x, z);
      pos.setY(i, y);

      // Finite-difference exact normal so chunk edges have zero shading seams
      const hx = getLevelHeight(levelId, x + eps, z) - getLevelHeight(levelId, x - eps, z);
      const hz = getLevelHeight(levelId, x, z + eps) - getLevelHeight(levelId, x, z - eps);
      const nx = -hx;
      const ny = 2 * eps;
      const nz = -hz;
      const len = Math.hypot(nx, ny, nz) || 1;
      norm.setXYZ(i, nx / len, ny / len, nz / len);

      const slopeY = ny / len;
      const biome = classifyTerrainBiome(y, slopeY);
      if (biome === 'water') {
        _col.copy(_cSandWet);
      } else if (biome === 'sand') {
        const t = THREE.MathUtils.clamp((y - 0.15) / 1.4, 0, 1);
        _col.copy(_cSandWet).lerp(_cSand, t);
      } else if (biome === 'rock') {
        _col.copy(_cRock);
      } else {
        const n = 0.5 + 0.5 * Math.sin(x * 0.25) * Math.cos(z * 0.25);
        _col.copy(_cGrass).lerp(_cGrassLush, n);
      }

      colors[i * 3] = _col.r;
      colors[i * 3 + 1] = _col.g;
      colors[i * 3 + 2] = _col.b;
    }

    geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    geo.computeBoundingBox();
    geo.computeBoundingSphere();
    return geo;
  });
}
