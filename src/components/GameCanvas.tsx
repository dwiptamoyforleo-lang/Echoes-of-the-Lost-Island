import { lazy, Suspense, useEffect, useMemo, useState } from 'react';
import { GAME_TITLE } from '@/src/config/gameInfo';
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
import { detectWebGLSupport } from '@/src/game/rendering/webglSupport';
import {
  useGameStore,
  type ActiveLevelId,
} from '@/src/state/gameStore';
import { getLevelMetadata } from '@/src/systems/progressionSystem';
import { MenuIslandBackdrop } from './MenuIslandBackdrop';

const LazyTestScene = lazy(() =>
  import('./TestScene').then((m) => ({ default: m.TestScene })),
);

const TEST_ARENA_SPAWN: [number, number, number] = [0, 0.95, 8];

const LEVEL_BG_CLASSES: Record<ActiveLevelId, string> = {
  testArena: 'bg-[#9ec9e2]',
  level1: 'bg-[#94cbe8]',
  level2: 'bg-[#122e26]',
  level3: 'bg-[#050c10]',
  level4: 'bg-[#16283d]',
  level5: 'bg-[#58295b]',
};

function SceneSuspenseBeacon() {
  return (
    <mesh position={[0, 2, 0]} rotation={[0.4, 0.6, 0]}>
      <octahedronGeometry args={[0.9, 0]} />
      <meshBasicMaterial color="#2dd4bf" wireframe />
    </mesh>
  );
}

function LevelReadyReporter({
  readyKey,
  onReady,
}: {
  readyKey: string;
  onReady: (key: string) => void;
}) {
  useEffect(() => {
    onReady(readyKey);
  }, [readyKey, onReady]);
  return null;
}

export function GameCanvas() {
  const webglSupport = useMemo(() => detectWebGLSupport(), []);
  const deviceProfile = useMemo(() => detectDeviceProfile(), []);
  const isSoftwareGl = deviceProfile.isSoftwareGl;

  const screen = useGameStore((state) => state.screen);
  const settingsReturnScreen = useGameStore(
    (state) => state.settingsReturnScreen,
  );
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
  const [readyKey, setReadyKey] = useState<string | null>(null);
  const [minLoadElapsed, setMinLoadElapsed] = useState(true);

  const isGameplayMounted =
    screen === 'playing' ||
    screen === 'paused' ||
    screen === 'levelComplete' ||
    (screen === 'settings' && settingsReturnScreen === 'paused');

  const expectedReadyKey = `${activeLevel}-${runId}`;
  const levelMounted = isGameplayMounted && readyKey === expectedReadyKey;

  useEffect(() => {
    if (!isGameplayMounted) {
      setReadyKey(null);
    }
  }, [isGameplayMounted]);

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
      console.warn('[Journey Home] WebGL context lost');
      setContextLost(true);
    };
    const handleContextRestored = () => {
      console.info('[Journey Home] WebGL context restored');
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
    if (!levelLoading) {
      setMinLoadElapsed(true);
      return;
    }
    setMinLoadElapsed(false);
    const timer = window.setTimeout(() => {
      setMinLoadElapsed(true);
    }, 450);
    return () => window.clearTimeout(timer);
  }, [levelLoading, expectedReadyKey]);

  useEffect(() => {
    if (levelLoading && minLoadElapsed && levelMounted) {
      finishLevelLoading();
    }
  }, [levelLoading, minLoadElapsed, levelMounted, finishLevelLoading]);

  const preset = getQualityPreset(activeQualityTier, deviceProfile);
  const isPausedForRendering =
    documentHidden || screen === 'paused' || activeOverlay !== 'none';

  const ActiveLevelComponent =
    activeLevel === 'testArena' ? LazyTestScene : LazyLevels[activeLevel];

  if (!webglSupport.supported) {
    return (
      <div
        className="relative flex h-full w-full items-center justify-center bg-[#12181a] p-6 text-[#efe5cf]"
        data-testid="webgl-unavailable-fallback"
        role="alert"
      >
        <div className="stone-panel max-w-md rounded-md p-6 text-center">
          <p className="font-mono text-xs tracking-widest text-[#c79d52] uppercase">
            WebGL Unavailable
          </p>
          <h2 className="font-display mt-2 text-xl font-bold text-[#f7ebd2]">
            3D Graphics Context Required
          </h2>
          <p className="mt-2 text-xs leading-relaxed text-[#cfc3aa]">
            {GAME_TITLE} requires WebGL to render the island world.
            Enable hardware acceleration in your browser settings, update graphics
            drivers, or try a modern Chromium/Firefox/Safari browser.
          </p>
          {webglSupport.reason && (
            <p className="mt-2 font-mono text-[11px] text-amber-200/80">
              {webglSupport.reason}
            </p>
          )}
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="bronze-btn mt-4 rounded px-4 py-2 text-xs font-semibold"
          >
            Retry WebGL Check
          </button>
        </div>
      </div>
    );
  }

  return (
    <div
      className={`relative h-full w-full ${
        isGameplayMounted ? LEVEL_BG_CLASSES[activeLevel] : 'bg-[#8ec5e8]'
      }`}
      data-testid="canvas-container"
    >
      {contextLost && (
        <div
          className="absolute inset-0 z-30 flex items-center justify-center bg-[#12181a]/90 p-6 text-[#efe5cf]"
          data-testid="webgl-context-lost"
        >
          <div className="stone-panel max-w-sm rounded-md p-6 text-center">
            <h2 className="font-display text-lg font-bold text-[#f7ebd2]">
              Restoring 3D Graphics Context
            </h2>
            <p className="mt-2 text-xs text-[#cfc3aa]">
              Your GPU driver reset the WebGL context. Waiting for automatic recovery...
            </p>
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="bronze-btn mt-4 rounded px-4 py-2 text-xs font-semibold"
            >
              Reload Page
            </button>
          </div>
        </div>
      )}

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

          try {
            const pmremGenerator = new THREE.PMREMGenerator(gl);
            const tex = pmremGenerator.fromScene(
              new RoomEnvironment(),
              0.04,
            ).texture;
            scene.environment = tex;
            setEnvTexture(tex);
            pmremGenerator.dispose();
          } catch (err) {
            console.warn('[Journey Home] RoomEnvironment PMREM skipped:', err);
          }

          setCanvasEl(gl.domElement);
        }}
      >
        {isSoftwareGl && !isPausedForRendering && <SoftwareGlPacer enabled />}
        {isGameplayMounted ? (
          <Suspense fallback={<SceneSuspenseBeacon />}>
            <PhysicsWorld
              paused={
                screen !== 'playing' ||
                activeOverlay !== 'none' ||
                levelLoading ||
                !levelMounted ||
                documentHidden
              }
            >
              <RenderPerformanceController />
              <Suspense fallback={<SceneSuspenseBeacon />}>
                <ActiveLevelComponent key={expectedReadyKey} />
                <LevelReadyReporter
                  key={expectedReadyKey}
                  readyKey={expectedReadyKey}
                  onReady={setReadyKey}
                />
              </Suspense>
              <PlayerController
                key={expectedReadyKey}
                spawnPosition={spawnPosition}
                levelMounted={levelMounted}
              />
              <ThirdPersonCamera />
            </PhysicsWorld>
          </Suspense>
        ) : (
          <MenuIslandBackdrop />
        )}
      </Canvas>
    </div>
  );
}
