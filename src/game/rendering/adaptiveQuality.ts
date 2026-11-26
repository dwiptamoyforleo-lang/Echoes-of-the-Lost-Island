import type { GraphicsQuality } from '@/src/systems/saveSystem';
import { detectSoftwareGl } from './softwareGl';

export type EffectiveQualityTier = 'low' | 'medium' | 'high';

export interface DeviceProfile {
  isMobile: boolean;
  isSoftwareGl: boolean;
  hardwareConcurrency: number;
  deviceMemoryGb: number;
  gpuRenderer: string;
  devicePixelRatio: number;
}

export interface QualityPreset {
  tier: EffectiveQualityTier;
  minDpr: number;
  maxDpr: number;
  antialias: boolean;
  shadowsEnabled: boolean;
  shadowMapSize: number;
  materialMode: 'lambert' | 'standard';
  simpleWaterAndSky: boolean;
  postProcessing: 'off' | 'bloom' | 'full';
  physicsHz: 30 | 60;
  particleCap: number;
  propCullDistance: number;
  mediumPropCullDistance: number;
  lodDistance: number;
  fogScale: number;
  cameraFar: number;
  chunkRangeScale: number;
}

let cachedProfile: DeviceProfile | null = null;

export function detectDeviceProfile(): DeviceProfile {
  if (cachedProfile) return cachedProfile;
  if (typeof window === 'undefined' || typeof navigator === 'undefined') {
    cachedProfile = {
      isMobile: false,
      isSoftwareGl: false,
      hardwareConcurrency: 8,
      deviceMemoryGb: 8,
      gpuRenderer: 'Unknown',
      devicePixelRatio: 1,
    };
    return cachedProfile;
  }

  const ua = navigator.userAgent || '';
  const isMobile =
    /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(ua);
  const hardwareConcurrency = navigator.hardwareConcurrency || 4;
  const deviceMemoryGb =
    (navigator as unknown as { deviceMemory?: number }).deviceMemory || 4;
  const isSoftwareGl = detectSoftwareGl();
  let gpuRenderer = isSoftwareGl ? 'Software WebGL' : 'Hardware WebGL';

  try {
    const canvas = document.createElement('canvas');
    const gl = canvas.getContext('webgl2') || canvas.getContext('webgl');
    if (gl) {
      const ext = gl.getExtension('WEBGL_debug_renderer_info');
      const param = ext ? ext.UNMASKED_RENDERER_WEBGL : gl.RENDERER;
      const str = String(gl.getParameter(param) ?? '');
      if (str) gpuRenderer = str;
      gl.getExtension('WEBGL_lose_context')?.loseContext();
    }
  } catch {
    // Fallback cleanly in restricted contexts
  }

  cachedProfile = {
    isMobile,
    isSoftwareGl,
    hardwareConcurrency,
    deviceMemoryGb,
    gpuRenderer,
    devicePixelRatio: Math.min(window.devicePixelRatio || 1, 2),
  };
  return cachedProfile;
}

export function resolveInitialTier(
  preference: GraphicsQuality,
  profile: DeviceProfile = detectDeviceProfile(),
): EffectiveQualityTier {
  if (preference !== 'auto') {
    return preference;
  }
  if (profile.isSoftwareGl) {
    return 'low';
  }
  if (profile.isMobile) {
    if (profile.hardwareConcurrency <= 4 || profile.deviceMemoryGb <= 3) {
      return 'low';
    }
    return 'medium';
  }
  if (profile.hardwareConcurrency <= 2 || profile.deviceMemoryGb <= 2) {
    return 'low';
  }
  if (
    /Mali-G5|Mali-T|Adreno \(TM\) [345]/i.test(profile.gpuRenderer)
  ) {
    return 'low';
  }
  if (profile.hardwareConcurrency <= 4) {
    return 'medium';
  }
  return 'high';
}

export function getQualityPreset(
  tier: EffectiveQualityTier,
  profile: DeviceProfile = detectDeviceProfile(),
): QualityPreset {
  const maxSysDpr = profile.devicePixelRatio;
  if (tier === 'low') {
    return {
      tier: 'low',
      minDpr: 0.55,
      maxDpr: profile.isSoftwareGl ? 1.0 : Math.min(maxSysDpr, 0.75),
      antialias: false,
      shadowsEnabled: false,
      shadowMapSize: 0,
      materialMode: 'lambert',
      simpleWaterAndSky: true,
      postProcessing: 'off',
      physicsHz: 30,
      particleCap: 16,
      propCullDistance: 26,
      mediumPropCullDistance: 44,
      lodDistance: 18,
      fogScale: 0.72,
      cameraFar: 95,
      chunkRangeScale: 0.78,
    };
  }
  if (tier === 'medium') {
    return {
      tier: 'medium',
      minDpr: 0.75,
      maxDpr: Math.min(maxSysDpr, 1.25),
      antialias: !profile.isMobile,
      shadowsEnabled: !profile.isSoftwareGl,
      shadowMapSize: 1024,
      materialMode: 'standard',
      simpleWaterAndSky: false,
      postProcessing: 'bloom',
      physicsHz: 60,
      particleCap: 40,
      propCullDistance: 38,
      mediumPropCullDistance: 62,
      lodDistance: 28,
      fogScale: 0.88,
      cameraFar: 185,
      chunkRangeScale: 0.9,
    };
  }
  return {
    tier: 'high',
    minDpr: 0.9,
    maxDpr: profile.isMobile ? Math.min(maxSysDpr, 1.5) : Math.min(maxSysDpr, 2.0),
    antialias: !profile.isMobile,
    shadowsEnabled: !profile.isSoftwareGl,
    shadowMapSize: 2048,
    materialMode: 'standard',
    simpleWaterAndSky: false,
    postProcessing: 'full',
    physicsHz: 60,
    particleCap: 72,
    propCullDistance: 54,
    mediumPropCullDistance: 85,
    lodDistance: 42,
    fogScale: 1.0,
    cameraFar: 360,
    chunkRangeScale: 1.0,
  };
}

const TIER_ORDER: EffectiveQualityTier[] = ['low', 'medium', 'high'];

export class AdaptiveQualityMonitor {
  private tier: EffectiveQualityTier;
  private maxAllowedTier: EffectiveQualityTier;
  private dpr: number;
  private minDpr: number;
  private maxDpr: number;
  private lowFpsDuration = 0;
  private highFpsDuration = 0;
  private cooldown = 0;
  private frameTimes = new Float32Array(60);
  private frameCursor = 0;
  private frameCount = 0;

  constructor(
    initialTier: EffectiveQualityTier = 'high',
    profile: DeviceProfile = detectDeviceProfile(),
  ) {
    this.tier = initialTier;
    this.maxAllowedTier = initialTier;
    const preset = getQualityPreset(initialTier, profile);
    this.minDpr = preset.minDpr;
    this.maxDpr = preset.maxDpr;
    this.dpr = preset.maxDpr;
  }

  public syncPreset(tier: EffectiveQualityTier, profile: DeviceProfile) {
    this.tier = tier;
    this.maxAllowedTier = tier;
    const preset = getQualityPreset(tier, profile);
    this.minDpr = preset.minDpr;
    this.maxDpr = preset.maxDpr;
    this.dpr = preset.maxDpr;
    this.lowFpsDuration = 0;
    this.highFpsDuration = 0;
  }

  public recordFrame(
    dt: number,
    autoEnabled: boolean,
    profile: DeviceProfile,
  ): {
    avgFps: number;
    tier: EffectiveQualityTier;
    dpr: number;
    tierChanged: boolean;
  } {
    const safeDt = Math.max(0.001, Math.min(dt, 0.25));
    this.frameTimes[this.frameCursor % this.frameTimes.length] = safeDt;
    this.frameCursor += 1;
    this.frameCount = Math.min(this.frameCount + 1, this.frameTimes.length);

    let sum = 0;
    for (let i = 0; i < this.frameCount; i++) {
      sum += this.frameTimes[i];
    }
    const avgDt = sum / Math.max(1, this.frameCount);
    const avgFps = 1 / avgDt;

    if (!autoEnabled || profile.isSoftwareGl || this.frameCount < 20) {
      return {
        avgFps,
        tier: this.tier,
        dpr: this.dpr,
        tierChanged: false,
      };
    }

    if (this.cooldown > 0) {
      this.cooldown = Math.max(0, this.cooldown - safeDt);
    }

    let tierChanged = false;
    const targetFps = profile.isMobile ? 28 : 54;

    if (avgFps < 28) {
      this.lowFpsDuration += safeDt;
      this.highFpsDuration = 0;
      this.dpr = Math.max(this.minDpr, this.dpr - safeDt * 0.22);

      if (this.lowFpsDuration >= 2.5 && this.cooldown <= 0) {
        const idx = TIER_ORDER.indexOf(this.tier);
        if (idx > 0) {
          this.tier = TIER_ORDER[idx - 1];
          const p = getQualityPreset(this.tier, profile);
          this.minDpr = p.minDpr;
          this.maxDpr = p.maxDpr;
          this.dpr = Math.min(this.dpr, p.maxDpr);
          tierChanged = true;
          this.cooldown = 6.0;
          this.lowFpsDuration = 0;
        }
      }
    } else if (avgFps > 58) {
      this.highFpsDuration += safeDt;
      this.lowFpsDuration = 0;
      this.dpr = Math.min(this.maxDpr, this.dpr + safeDt * 0.12);

      const maxIdx = TIER_ORDER.indexOf(this.maxAllowedTier);
      const curIdx = TIER_ORDER.indexOf(this.tier);
      if (
        this.highFpsDuration >= 8.0 &&
        this.cooldown <= 0 &&
        curIdx < maxIdx
      ) {
        this.tier = TIER_ORDER[curIdx + 1];
        const p = getQualityPreset(this.tier, profile);
        this.minDpr = p.minDpr;
        this.maxDpr = p.maxDpr;
        tierChanged = true;
        this.cooldown = 10.0;
        this.highFpsDuration = 0;
      }
    } else {
      this.lowFpsDuration = Math.max(0, this.lowFpsDuration - safeDt * 0.5);
      this.highFpsDuration = Math.max(0, this.highFpsDuration - safeDt * 0.5);
      if (avgFps < targetFps) {
        this.dpr = Math.max(this.minDpr, this.dpr - safeDt * 0.08);
      }
    }

    return {
      avgFps,
      tier: this.tier,
      dpr: Math.round(this.dpr * 100) / 100,
      tierChanged,
    };
  }

  public getState() {
    return {
      tier: this.tier,
      dpr: this.dpr,
    };
  }
}
