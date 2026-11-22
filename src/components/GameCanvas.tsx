import { Suspense, useEffect, useMemo, useState } from 'react';
import * as THREE from 'three';
import { Canvas } from '@react-three/fiber';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { ThirdPersonCamera } from '@/src/game/camera';
import {
  LazyLevels,
  getLevelSpawn,
  preloadLevelModule,
} from '@/src/game/levels';
import { PhysicsWorld } from '@/src/game/physics/PhysicsWorld';
import { PlayerController } from '@/src/game/player';
import { RenderPerformanceController } from '@/src/game/rendering/RenderPerformanceController';
import {
  detectDeviceProfile,
  getQualityPreset,
} from '@/src/game/rendering/adaptiveQuality';
import { SoftwareGlPacer } from '@/src/game/rendering/softwareGl';
import { useGameStore } from '@/src/state/gameStore';
import { getLevelMetadata } from '@/src/systems/progressionSystem';
import { TestScene } from './TestScene';

const TEST_ARENA_SPAWN: [number, number, number] = [0, 0.95, 8];

export function GameCanvas() {
  const deviceProfile = useMemo(() => detectDeviceProfile(), []);
  const isSoftwareGl = deviceProfile.isSoftwareGl;

  const screen = useGameStore((state) => state.screen);
  const activeLevel = useGameStore((state) => state.activeLevel);
  const activeOverlay = useGameStore((state) => state.activeOverlay);
  const runId = useGameStore((state) => state.runId);
  const activeQualityTier = useGameStore((state) => state.activeQualityTier);
  const levelLoading = useGameStore((state) => state.levelLoading);
  const finishLevelLoading = useGameStore((state) => state.finishLevelLoading);

  const [contextLost, setContextLost] = useState(false);
  const [documentHidden, setDocumentHidden] = useState(
    () => typeof document !== 'undefined' && document.hidden,
  );
  const [canvasEl, setCanvasEl] = useState<HTMLCanvasElement | null>(null);
  const [envTexture, setEnvTexture] = useState<THREE.Texture | null>(null);

  useEffect(() => {
    const onVis = () => {
      setDocumentHidden(document.hidden);
    };
    document.addEventListener('visibilitychange', onVis);
    return () => document.removeEventListener('visibilitychange', onVis);
  }, []);

  // Preload next level chunk module while player views Level Complete screen
  useEffect(() => {
    if (screen === 'levelComplete' && activeLevel !== 'testArena') {
      const nextId = getLevelMetadata(activeLevel).nextLevelId;
      preloadLevelModule(nextId);
    }
  }, [screen, activeLevel]);

  useEffect(() => {
    if (!envTexture) return;
    return () => {
      envTexture.dispose();
    };
  }, [envTexture]);

  useEffect(() => {
    if (!canvasEl) return;

    const handleContextLost = (event: Event) => {
      event.preventDefault();
      setContextLost(true);
    };
    const handleContextRestored = () => {
      setContextLost(false);
    };

    canvasEl.addEventListener('webglcontextlost', handleContextLost);
    canvasEl.addEventListener('webglcontextrestored', handleContextRestored);

    return () => {
      canvasEl.removeEventListener('webglcontextlost', handleContextLost);
      canvasEl.removeEventListener(
        'webglcontextrestored',
        handleContextRestored,
      );
    };
  }, [canvasEl]);

  const spawnPosition = useMemo(() => {
    const cp = useGameStore.getState().checkpointPos;
    if (activeLevel === 'testArena') return TEST_ARENA_SPAWN;
    return cp ?? getLevelSpawn(activeLevel);
  }, [activeLevel, runId]);

  useEffect(() => {
    if (!levelLoading) return;
    const timer = window.setTimeout(() => {
      finishLevelLoading();
    }, 450);
    return () => window.clearTimeout(timer);
  }, [levelLoading, finishLevelLoading]);

  const preset = getQualityPreset(activeQualityTier, deviceProfile);
  const isPausedForRendering =
    documentHidden || screen === 'paused' || activeOverlay !== 'none';

  const ActiveLevelComponent =
    activeLevel === 'testArena' ? TestScene : LazyLevels[activeLevel];

  return (
    <div
      className="relative h-full w-full bg-[#94cbe8]"
      data-testid="canvas-container"
    >
      {contextLost ? (
        <div className="flex h-full w-full items-center justify-center text-slate-900">
          <p className="text-sm font-medium">
            Restoring 3D graphics context...
          </p>
        </div>
      ) : (
        <Canvas
          className="block h-full w-full"
          frameloop={isSoftwareGl || isPausedForRendering ? 'demand' : 'always'}
          shadows={preset.shadowsEnabled}
          dpr={isSoftwareGl ? 1 : [preset.minDpr, preset.maxDpr]}
          camera={{ position: [0.55, 4.2, 30], fov: 52, near: 0.1, far: 360 }}
          gl={{
            antialias: preset.antialias,
            powerPreference: 'high-performance',
          }}
          onCreated={({ gl, scene }) => {
            gl.outputColorSpace = THREE.SRGBColorSpace;
            gl.toneMapping = THREE.ACESFilmicToneMapping;
            gl.toneMappingExposure = 1.1;
            if (!isSoftwareGl && preset.shadowsEnabled) {
              gl.shadowMap.enabled = true;
              gl.shadowMap.type = THREE.PCFSoftShadowMap;
            }

            const pmremGenerator = new THREE.PMREMGenerator(gl);
            const tex = pmremGenerator.fromScene(
              new RoomEnvironment(),
              0.04,
            ).texture;
            scene.environment = tex;
            setEnvTexture(tex);
            pmremGenerator.dispose();

            setCanvasEl(gl.domElement);
          }}
        >
          <SoftwareGlPacer enabled={isSoftwareGl && !isPausedForRendering} />
          <Suspense fallback={null}>
            <PhysicsWorld
              paused={
                screen !== 'playing' ||
                activeOverlay !== 'none' ||
                levelLoading ||
                documentHidden
              }
            >
              <RenderPerformanceController />
              <ActiveLevelComponent key={activeLevel} />
              <PlayerController
                key={`${activeLevel}-${runId}`}
                spawnPosition={spawnPosition}
              />
              <ThirdPersonCamera />
            </PhysicsWorld>
          </Suspense>
        </Canvas>
      )}
    </div>
  );
}
