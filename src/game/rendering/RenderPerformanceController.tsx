import { useEffect, useRef, useState } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { useRapier } from '@react-three/rapier';
import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { useGameStore } from '@/src/state/gameStore';
import {
  AdaptiveQualityMonitor,
  detectDeviceProfile,
  getQualityPreset,
  resolveInitialTier,
} from './adaptiveQuality';
import { performanceTelemetry } from './performanceTelemetry';

function ComposerPassRunner({
  composerRef,
}: {
  composerRef: { current: EffectComposer | null };
}) {
  useFrame(() => {
    if (composerRef.current) {
      composerRef.current.render();
    }
  }, 1);
  return null;
}

export function RenderPerformanceController() {
  const { gl, scene, camera, size, setDpr } = useThree();
  const { world } = useRapier();

  const qualityPreference = useGameStore(
    (s) => s.settings.graphicsQuality,
  );
  const activeTier = useGameStore((s) => s.activeQualityTier);

  const profileRef = useRef(detectDeviceProfile());
  const monitorRef = useRef<AdaptiveQualityMonitor>(
    new AdaptiveQualityMonitor(
      resolveInitialTier(qualityPreference, profileRef.current),
      profileRef.current,
    ),
  );
  const lastDprRef = useRef(-1);
  const telemetryTimerRef = useRef(0);
  const composerRef = useRef<EffectComposer | null>(null);
  const bloomPassRef = useRef<UnrealBloomPass | null>(null);
  const [composerReady, setComposerReady] = useState(false);

  // Sync manual or Auto initial tier whenever graphicsQuality preference changes
  useEffect(() => {
    const profile = profileRef.current;
    const initialTier = resolveInitialTier(qualityPreference, profile);
    monitorRef.current.syncPreset(initialTier, profile);
    const preset = getQualityPreset(initialTier, profile);
    useGameStore.getState().setActiveQualityTier(initialTier);
    performanceTelemetry.gpuRenderer = profile.gpuRenderer;
    performanceTelemetry.activeTier = initialTier;

    if (!profile.isSoftwareGl) {
      lastDprRef.current = preset.maxDpr;
      setDpr(preset.maxDpr);
    }
  }, [qualityPreference, setDpr]);

  // Sync shadow map state, camera far clip, and optional post-processing per quality tier
  useEffect(() => {
    const profile = profileRef.current;
    const preset = getQualityPreset(activeTier, profile);

    gl.shadowMap.enabled = !profile.isSoftwareGl && preset.shadowsEnabled;
    gl.shadowMap.needsUpdate = true;

    if ((camera as THREE.PerspectiveCamera).isPerspectiveCamera) {
      const persp = camera as THREE.PerspectiveCamera;
      if (persp.far !== preset.cameraFar) {
        persp.far = preset.cameraFar;
        persp.updateProjectionMatrix();
      }
    }

    const shouldUseComposer =
      !profile.isSoftwareGl && preset.postProcessing !== 'off';

    if (!shouldUseComposer) {
      if (composerRef.current) {
        composerRef.current.dispose();
        composerRef.current = null;
        bloomPassRef.current = null;
      }
      setComposerReady(false);
      return;
    }

    const isMediumBloom = preset.postProcessing === 'bloom';
    const bloomRes = isMediumBloom
      ? new THREE.Vector2(
          Math.max(1, Math.floor(size.width * 0.5)),
          Math.max(1, Math.floor(size.height * 0.5)),
        )
      : new THREE.Vector2(size.width, size.height);

    const composer = new EffectComposer(gl);
    const renderPass = new RenderPass(scene, camera);
    const bloomPass = new UnrealBloomPass(
      bloomRes,
      isMediumBloom ? 0.16 : 0.26,
      isMediumBloom ? 0.25 : 0.36,
      isMediumBloom ? 0.9 : 0.86,
    );
    const outputPass = new OutputPass();

    composer.addPass(renderPass);
    composer.addPass(bloomPass);
    composer.addPass(outputPass);
    const targetDpr = monitorRef.current.getState().dpr;
    composer.setPixelRatio(targetDpr);

    composerRef.current = composer;
    bloomPassRef.current = bloomPass;
    setComposerReady(true);

    return () => {
      setComposerReady(false);
      bloomPass.dispose();
      outputPass.dispose();
      composer.dispose();
      composerRef.current = null;
      bloomPassRef.current = null;
    };
  }, [activeTier, gl, scene, camera]);

  // Keep EffectComposer synced with viewport size
  useEffect(() => {
    const composer = composerRef.current;
    if (!composer) return;
    const preset = getQualityPreset(activeTier, profileRef.current);
    composer.setSize(size.width, size.height);
    if (bloomPassRef.current) {
      const scale = preset.postProcessing === 'bloom' ? 0.5 : 1;
      bloomPassRef.current.resolution.set(
        Math.max(1, Math.floor(size.width * scale)),
        Math.max(1, Math.floor(size.height * scale)),
      );
    }
  }, [size.width, size.height, composerReady, activeTier]);

  useFrame((_, rawDt) => {
    const profile = profileRef.current;
    const dt = Math.min(Math.max(rawDt, 0.001), 0.25);
    const res = monitorRef.current.recordFrame(
      dt,
      qualityPreference === 'auto',
      profile,
    );

    if (res.tierChanged) {
      useGameStore.getState().setActiveQualityTier(res.tier);
    }

    if (
      !profile.isSoftwareGl &&
      Math.abs(res.dpr - lastDprRef.current) >= 0.05
    ) {
      lastDprRef.current = res.dpr;
      setDpr(res.dpr);
      if (composerRef.current) {
        composerRef.current.setPixelRatio(res.dpr);
      }
    }

    performanceTelemetry.activeTier = res.tier;
    performanceTelemetry.currentDpr = profile.isSoftwareGl ? 1 : res.dpr;
    performanceTelemetry.fps = Math.round(res.avgFps);
    performanceTelemetry.frameTimeMs =
      Math.round((1000 / Math.max(1, res.avgFps)) * 10) / 10;

    telemetryTimerRef.current += dt;
    if (telemetryTimerRef.current >= 0.25) {
      telemetryTimerRef.current = 0;
      const info = gl.info;
      performanceTelemetry.drawCalls = info.render.calls;
      performanceTelemetry.triangles = info.render.triangles;
      performanceTelemetry.geometries = info.memory.geometries;
      performanceTelemetry.textures = info.memory.textures;
      performanceTelemetry.activePhysicsBodies = world.bodies.len();

      const perfMem = (
        performance as unknown as { memory?: { usedJSHeapSize?: number } }
      ).memory;
      performanceTelemetry.jsHeapMB =
        perfMem && typeof perfMem.usedJSHeapSize === 'number'
          ? Math.round((perfMem.usedJSHeapSize / (1024 * 1024)) * 10) / 10
          : null;
    }
  });

  return composerReady ? <ComposerPassRunner composerRef={composerRef} /> : null;
}
