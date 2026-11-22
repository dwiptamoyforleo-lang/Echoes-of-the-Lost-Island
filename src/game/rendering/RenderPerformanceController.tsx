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
    useGameStore.getState().setActiveQualityTier(initialTier);
    performanceTelemetry.gpuRenderer = profile.gpuRenderer;
    performanceTelemetry.activeTier = initialTier;
  }, [qualityPreference]);

  // Lightweight optional post-processing strictly on High / desktop Bloom, cleanly disposed when off
  useEffect(() => {
    const profile = profileRef.current;
    const preset = getQualityPreset(activeTier, profile);
    const shouldUseComposer =
      !profile.isSoftwareGl &&
      !profile.isMobile &&
      preset.postProcessing === 'full';

    if (!shouldUseComposer) {
      if (composerRef.current) {
        composerRef.current.dispose();
        composerRef.current = null;
        bloomPassRef.current = null;
      }
      setComposerReady(false);
      return;
    }

    const composer = new EffectComposer(gl);
    const renderPass = new RenderPass(scene, camera);
    const bloomPass = new UnrealBloomPass(
      new THREE.Vector2(size.width, size.height),
      0.24,
      0.35,
      0.88,
    );
    const outputPass = new OutputPass();

    composer.addPass(renderPass);
    composer.addPass(bloomPass);
    composer.addPass(outputPass);

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
    composer.setSize(size.width, size.height);
    if (bloomPassRef.current) {
      bloomPassRef.current.resolution.set(size.width, size.height);
    }
  }, [size.width, size.height, composerReady]);

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
