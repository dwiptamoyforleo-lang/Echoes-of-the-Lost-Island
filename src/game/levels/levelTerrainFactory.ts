import * as THREE from 'three';
import type { CrystalSpec } from '@/src/game/collectibles';
import { acquireGeometry } from '@/src/game/rendering/assetCache';
import type { LevelId } from '@/src/systems/progressionSystem';
import type { ChunkDefinition } from './chunkStreaming';
import { classifyTerrainBiome, getIslandHeight, LEVEL1_CRYSTALS, LEVEL1_SPAWN } from './level1Terrain';
import {
  getWoodsHeight,
  LEVEL2_CHUNKS,
  LEVEL2_CRYSTALS,
  LEVEL2_SPAWN,
} from './level2Config';
import {
  getSunkenKingdomHeight,
  LEVEL3_CHUNKS,
  LEVEL3_CRYSTALS,
  LEVEL3_SPAWN,
} from './level3Config';
import {
  getFrozenPeaksHeight,
  LEVEL4_CHUNKS,
  LEVEL4_CRYSTALS,
  LEVEL4_SPAWN,
} from './level4Config';
import {
  getSkyTempleHeight,
  LEVEL5_CHUNKS,
  LEVEL5_CRYSTALS,
  LEVEL5_SPAWN,
} from './level5Config';

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
  environmentIntensity?: number;
  showClouds?: boolean;
  showOcean?: boolean;
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
    environmentIntensity: 0.48,
    showClouds: true,
    showOcean: true,
  },
  level2: {
    skyColor: '#122e26',
    fogColor: '#173a30',
    fogNear: 16,
    fogFar: 68,
    sunColor: '#c9fae0',
    sunIntensity: 1.75,
    hemiSky: '#6ee7b7',
    hemiGround: '#13241a',
    hemiIntensity: 0.62,
    waterColor: '#157870',
    waterOpacity: 0.86,
    sandLow: '#2b4232',
    sandHigh: '#395740',
    grassBase: '#1e462d',
    grassLush: '#2d633e',
    rockColor: '#3f4f46',
    trunkColor: '#4a3021',
    canopyColor: '#174f30',
    grassBladeColor: '#338c55',
    crystalColor: '#2dd4bf',
    useSkyDome: false,
    sunPosition: [42, 54, 22],
    environmentIntensity: 0.25,
    showClouds: false,
    showOcean: true,
  },
  level3: {
    skyColor: '#050c10',
    fogColor: '#07151b',
    fogNear: 10,
    fogFar: 44,
    sunColor: '#7dd3fc',
    sunIntensity: 0.42,
    hemiSky: '#2dd4bf',
    hemiGround: '#091318',
    hemiIntensity: 0.35,
    waterColor: '#0e7490',
    waterOpacity: 0.8,
    sandLow: '#22303a',
    sandHigh: '#2f414d',
    grassBase: '#273640',
    grassLush: '#324652',
    rockColor: '#1e2932',
    trunkColor: '#374752',
    canopyColor: '#244047',
    grassBladeColor: '#316062',
    crystalColor: '#38bdf8',
    useSkyDome: false,
    sunPosition: [-25, 42, 24],
    environmentIntensity: 0.14,
    showClouds: false,
    showOcean: false,
  },
  level4: {
    skyColor: '#16283d',
    fogColor: '#1c344d',
    fogNear: 24,
    fogFar: 94,
    sunColor: '#e0f2fe',
    sunIntensity: 2.15,
    hemiSky: '#bae6fd',
    hemiGround: '#334155',
    hemiIntensity: 0.78,
    waterColor: '#7dd3fc',
    waterOpacity: 0.9,
    sandLow: '#94a3b8',
    sandHigh: '#cbd5e1',
    grassBase: '#dce8f2',
    grassLush: '#f1f5f9',
    rockColor: '#475569',
    trunkColor: '#3f4c59',
    canopyColor: '#94a3b8',
    grassBladeColor: '#bae6fd',
    crystalColor: '#38bdf8',
    useSkyDome: false,
    sunPosition: [26, 42, -30],
    environmentIntensity: 0.34,
    showClouds: false,
    showOcean: false,
  },
  level5: {
    skyColor: '#58295b',
    fogColor: '#9d4d72',
    fogNear: 38,
    fogFar: 138,
    sunColor: '#ffd99e',
    sunIntensity: 2.4,
    hemiSky: '#f5d0fe',
    hemiGround: '#4c1d95',
    hemiIntensity: 0.85,
    waterColor: '#f59e0b',
    waterOpacity: 0.75,
    sandLow: '#d6c6a8',
    sandHigh: '#ede2c8',
    grassBase: '#93a67c',
    grassLush: '#b3c295',
    rockColor: '#9f9486',
    trunkColor: '#a8926a',
    canopyColor: '#e2b66b',
    grassBladeColor: '#c9b784',
    crystalColor: '#fbbf24',
    useSkyDome: false,
    sunPosition: [18, 22, -65],
    environmentIntensity: 0.45,
    showClouds: false,
    showOcean: false,
  },
};



export function getLevelHeight(levelId: LevelId, x: number, z: number): number {
  switch (levelId) {
    case 'level1':
      return getIslandHeight(x, z);
    case 'level2':
      return getWoodsHeight(x, z);
    case 'level3':
      return getSunkenKingdomHeight(x, z);
    case 'level4':
      return getFrozenPeaksHeight(x, z);
    case 'level5':
      return getSkyTempleHeight(x, z);
  }
}

export function getLevelSpawn(levelId: LevelId): [number, number, number] {
  switch (levelId) {
    case 'level1':
      return LEVEL1_SPAWN;
    case 'level2':
      return LEVEL2_SPAWN;
    case 'level3':
      return LEVEL3_SPAWN;
    case 'level4':
      return LEVEL4_SPAWN;
    case 'level5':
      return LEVEL5_SPAWN;
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
  level2: LEVEL2_CHUNKS,
  level3: LEVEL3_CHUNKS,
  level4: LEVEL4_CHUNKS,
  level5: LEVEL5_CHUNKS,
};


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
