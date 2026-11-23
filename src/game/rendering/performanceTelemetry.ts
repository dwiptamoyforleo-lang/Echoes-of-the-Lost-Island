import type { EffectiveQualityTier } from './adaptiveQuality';

export interface PerformanceTelemetry {
  fps: number;
  frameTimeMs: number;
  drawCalls: number;
  triangles: number;
  geometries: number;
  textures: number;
  activePhysicsBodies: number;
  jsHeapMB: number | null;
  activeTier: EffectiveQualityTier;
  currentDpr: number;
  loadedChunks: string[];
  loadedChunkLabels: string[];
  totalChunks: number;
  pendingChunkLoads: number;
  visibleChunks: number;
  gpuRenderer: string;
}

export const performanceTelemetry: PerformanceTelemetry = {
  fps: 60,
  frameTimeMs: 16.6,
  drawCalls: 0,
  triangles: 0,
  geometries: 0,
  textures: 0,
  activePhysicsBodies: 0,
  jsHeapMB: null,
  activeTier: 'high',
  currentDpr: 1,
  loadedChunks: [],
  loadedChunkLabels: [],
  totalChunks: 0,
  pendingChunkLoads: 0,
  visibleChunks: 0,
  gpuRenderer: 'WebGL',
};
