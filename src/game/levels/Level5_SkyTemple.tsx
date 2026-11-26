import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useFrame } from '@react-three/fiber';
import {
  BallCollider,
  CuboidCollider,
  RigidBody,
  type IntersectionEnterPayload,
} from '@react-three/rapier';
import * as THREE from 'three';
import {
  Chest,
  CrystalField,
  Interactable,
  KeyItem,
} from '@/src/game/collectibles';
import { isPlayerPayload } from '@/src/game/physics';
import {
  Door,
  Inscription,
  MovingPlatform,
  PressurePlate,
  PushableBlock,
  RotatingMechanism,
  SelfAssemblingBridge,
  Switch,
  TriggerZone,
} from '@/src/game/puzzles';
import { getQualityPreset } from '@/src/game/rendering/adaptiveQuality';
import {
  useCachedGeometry,
  useCachedMaterial,
} from '@/src/game/rendering/assetCache';
import { eventBus } from '@/src/state/eventBus';
import { useGameStore } from '@/src/state/gameStore';
import { playPooledSynth } from '@/src/systems/audioSystem';
import { ANCIENT_FRAGMENTS } from '@/src/systems/inventorySystem';
import { CheckpointBeacon } from './CheckpointBeacon';
import { ChunkManager } from './ChunkManager';
import { GlowHalo, SharedBiomeBackdrop } from './SharedBiomeEnvironment';
import { getCrystalsForChunk } from './levelTerrainFactory';
import {
  FRAGMENT_PEDESTALS,
  LEVEL5_CHUNKS,
  SKY_ISLANDS,
  SYMBOL_INITIAL_STEPS,
  SYMBOL_PILLAR_IDS,
  areSkySymbolsAligned,
  checkSanctumFragments,
  type SkyIslandSpec,
} from './level5Config';

const _dummy = new THREE.Object3D();

/**
 * Procedural Golden-Hour Sky Dome with pink/purple/gold glow.
 */
function GoldenHourSkyDome({ restored }: { restored: boolean }) {
  const mat = useMemo(
    () =>
      new THREE.ShaderMaterial({
        uniforms: {
          uRestored: { value: restored ? 1 : 0 },
        },
        vertexShader: `
          varying vec3 vDir;
          void main() {
            vDir = normalize(position);
            gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
          }
        `,
        fragmentShader: `
          uniform float uRestored;
          varying vec3 vDir;
          void main() {
            float h = clamp(vDir.y * 0.5 + 0.5, 0.0, 1.0);
            vec3 zenith = mix(vec3(0.18, 0.08, 0.34), vec3(0.12, 0.28, 0.48), uRestored * 0.45);
            vec3 mid = vec3(0.68, 0.24, 0.48);
            vec3 horizon = mix(vec3(0.98, 0.64, 0.28), vec3(1.0, 0.86, 0.52), uRestored * 0.5);
            vec3 col = mix(horizon, mid, smoothstep(0.42, 0.65, h));
            col = mix(col, zenith, smoothstep(0.62, 0.92, h));

            vec3 sunDir = normalize(vec3(0.25, 0.28, -0.92));
            float sunDot = max(dot(normalize(vDir), sunDir), 0.0);
            float sunGlow = pow(sunDot, 12.0) * 0.45 + pow(sunDot, 96.0) * 0.85;
            col += vec3(1.0, 0.85, 0.55) * sunGlow;
            gl_FragColor = vec4(col, 1.0);
          }
        `,
        side: THREE.BackSide,
        depthWrite: false,
      }),
    [],
  );

  useEffect(() => {
    mat.uniforms.uRestored.value = restored ? 1 : 0;
  }, [mat, restored]);

  useEffect(() => {
    return () => {
      mat.dispose();
    };
  }, [mat]);

  return (
    <mesh material={mat}>
      <sphereGeometry args={[210, 24, 16]} />
    </mesh>
  );
}

/**
 * Sea of clouds drifting beneath the floating islands.
 */
function CloudSeaBelow() {
  const puffsRef = useRef<THREE.InstancedMesh>(null);
  const cloudMat = useMemo(
    () =>
      new THREE.ShaderMaterial({
        uniforms: {
          uTime: { value: 0 },
        },
        vertexShader: `
          uniform float uTime;
          varying vec2 vUv;
          void main() {
            vUv = uv;
            vec3 p = position;
            p.z += sin(p.x * 0.04 + uTime * 0.35) * 0.7;
            gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
          }
        `,
        fragmentShader: `
          uniform float uTime;
          varying vec2 vUv;
          void main() {
            float n = sin(vUv.x * 26.0 + uTime * 0.12) * cos(vUv.y * 26.0 - uTime * 0.1);
            vec3 pink = vec3(0.86, 0.54, 0.68);
            vec3 gold = vec3(0.99, 0.82, 0.58);
            vec3 col = mix(pink, gold, 0.5 + 0.5 * n);
            float edge = smoothstep(0.5, 0.15, length(vUv - 0.5));
            gl_FragColor = vec4(col, 0.72 * edge + 0.2);
          }
        `,
        transparent: true,
        depthWrite: false,
      }),
    [],
  );

  const puffs = useMemo(() => {
    const out: Array<{ x: number; y: number; z: number; sx: number; sy: number; sz: number; phase: number }> = [];
    for (let i = 0; i < 36; i++) {
      const a = (i / 36) * Math.PI * 2;
      const r = 18 + (i % 5) * 14;
      out.push({
        x: Math.cos(a) * r,
        y: -5.2 - (i % 3) * 1.4,
        z: Math.sin(a) * r - 6,
        sx: 6.5 + (i % 4) * 2.2,
        sy: 1.6 + (i % 2) * 0.7,
        sz: 5.5 + (i % 3) * 2.0,
        phase: i * 0.6,
      });
    }
    return out;
  }, []);

  const puffGeo = useCachedGeometry('l5-cloud-puff-geo', () => {
    const g = new THREE.DodecahedronGeometry(1, 1);
    g.computeBoundingSphere();
    return g;
  });
  const puffMat = useCachedMaterial('l5-cloud-puff-mat', () =>
    new THREE.MeshStandardMaterial({
      color: '#f7d5b8',
      emissive: '#be4b8b',
      emissiveIntensity: 0.22,
      roughness: 0.95,
      transparent: true,
      opacity: 0.78,
    }),
  );

  useEffect(() => {
    if (!puffsRef.current) return;
    puffs.forEach((p, i) => {
      _dummy.position.set(p.x, p.y, p.z);
      _dummy.rotation.set(0, p.phase, 0);
      _dummy.scale.set(p.sx, p.sy, p.sz);
      _dummy.updateMatrix();
      puffsRef.current!.setMatrixAt(i, _dummy.matrix);
    });
    puffsRef.current.instanceMatrix.needsUpdate = true;
  }, [puffs]);

  useFrame((state) => {
    cloudMat.uniforms.uTime.value = state.clock.elapsedTime;
  });

  useEffect(() => {
    return () => {
      cloudMat.dispose();
    };
  }, [cloudMat]);

  return (
    <group name="sky-cloud-sea">
      <mesh position={[0, -7.2, -6]} rotation={[-Math.PI / 2, 0, 0]} material={cloudMat}>
        <planeGeometry args={[280, 280, 24, 24]} />
      </mesh>
      <instancedMesh ref={puffsRef} args={[puffGeo, puffMat, puffs.length]} />
    </group>
  );
}

/**
 * Floating Sky Island slab with marble deck, golden rune rim, and tapered crystalline underbelly.
 */
function FloatingIslandDeck({ island }: { island: SkyIslandSpec }) {
  const activeTier = useGameStore((s) => s.activeQualityTier);
  const preset = getQualityPreset(activeTier);
  const [cx, cy, cz] = island.center;
  const [w, h, d] = island.size;
  const underDepth = Math.min(w, d) * 0.55;

  return (
    <group position={[cx, cy, cz]}>
      <RigidBody type="fixed" colliders={false} friction={1.0}>
        <CuboidCollider args={[w / 2, h / 2, d / 2]} />
        {/* Sunlit Marble Deck */}
        <mesh receiveShadow={preset.shadowsEnabled} castShadow={preset.shadowsEnabled}>
          <boxGeometry args={[w, h, d]} />
          <meshStandardMaterial color="#e6dcc6" roughness={0.82} />
        </mesh>
      </RigidBody>
      {/* Golden Trim Belt */}
      <mesh position={[0, h * 0.35, 0]}>
        <boxGeometry args={[w + 0.16, 0.18, d + 0.16]} />
        <meshStandardMaterial
          color="#d9af62"
          emissive="#b45309"
          emissiveIntensity={0.35}
          roughness={0.35}
          metalness={0.65}
        />
      </mesh>
      {/* Tapered Rock & Crystal Underbelly */}
      <mesh position={[0, -underDepth * 0.5 - h * 0.45, 0]} rotation={[Math.PI, Math.PI / 4, 0]}>
        <coneGeometry args={[Math.max(w, d) * 0.56, underDepth, 4]} />
        <meshStandardMaterial color="#6b5d6b" roughness={0.9} />
      </mesh>
      <GlowHalo position={[0, -underDepth * 0.85, 0]} color="#fbbf24" scale={5.2} />
    </group>
  );
}

/**
 * 4-Fragment Sanctuary Gate that unlocks only when fragments 1..4 are recovered.
 */
function FourFragmentSanctumGate({
  unsealed,
  westSolved,
  eastSolved,
  recoveredFragments,
}: {
  unsealed: boolean;
  westSolved: boolean;
  eastSolved: boolean;
  recoveredFragments: readonly string[];
}) {
  const fragCheck = useMemo(
    () => checkSanctumFragments(recoveredFragments),
    [recoveredFragments],
  );
  const wingsReady = westSolved && eastSolved;

  const handleInteract = () => {
    const store = useGameStore.getState();
    if (unsealed) return;
    if (!wingsReady) {
      store.showToast(
        'Both Western and Eastern Resonance Beams must be harmonized first.',
        'info',
      );
      return;
    }
    const check = checkSanctumFragments(store.recoveredFragments);
    if (!check.unlocked) {
      const missingNames = check.missingIds
        .map(
          (fid) =>
            ANCIENT_FRAGMENTS.find((f) => f.id === fid)?.name ?? fid,
        )
        .join(', ');
      store.showToast(
        `Sanctum Sealed (${check.haveCount}/4 Fragments) · Missing: ${missingNames}`,
        'info',
      );
      return;
    }
    store.setActivated('l5-sanctum-unsealed', true);
    store.setWorldObjectState('l5-sanctum-unsealed', { solved: true }, 'level5');
    playPooledSynth('door');
    store.showToast(
      'All 4 Echoes resonate! The Sky Temple Sanctum Gate opens!',
      'objective',
    );
  };

  const gateActionable = wingsReady && fragCheck.unlocked;
  const promptText = !wingsReady
    ? 'Harmonize West & East Wings to power this Gate'
    : fragCheck.unlocked
      ? 'Unseal Sanctum Gate (4/4 Fragments Ready)'
      : `Locked — Requires all 4 Echoes (${fragCheck.haveCount}/4 recovered, ${4 - fragCheck.haveCount} missing)`;

  return (
    <group>
      <Door
        id="l5-door-sanctum"
        position={[0, 4.6, -21.0]}
        width={4.6}
        height={4.4}
        requiredIds={['l5-sanctum-unsealed']}
      />
      {!unsealed && (
        <Interactable
          id="l5-sanctum-gate-control"
          prompt={promptText}
          actionLabel={gateActionable ? 'Unseal' : 'Inspect'}
          informationalOnly={!gateActionable}
          position={[0, 5.8, -20.0]}
          radius={3.0}
          onInteract={handleInteract}
        />
      )}
    </group>
  );
}

/**
 * Interactive Fragment Pedestal inside the Sky Temple Sanctum.
 */
function FragmentPedestal({
  id,
  fragmentId,
  name,
  position,
  color,
  placed,
  onPlace,
}: {
  id: string;
  fragmentId: string;
  name: string;
  position: [number, number, number];
  color: string;
  placed: boolean;
  onPlace: (pedestalId: string, fragmentId: string, name: string) => void;
}) {
  const activeTier = useGameStore((s) => s.activeQualityTier);
  const preset = getQualityPreset(activeTier);
  const orbRef = useRef<THREE.Mesh>(null);
  useFrame((state, rawDt) => {
    if (!orbRef.current) return;
    const dt = Math.min(rawDt, 0.05);
    orbRef.current.rotation.y += dt * 1.8;
    orbRef.current.position.y = 1.65 + Math.sin(state.clock.elapsedTime * 2.5) * 0.1;
  });

  return (
    <group position={position}>
      <Interactable
        id={id}
        prompt={
          placed
            ? `${name} Placed`
            : `Place ${name}`
        }
        actionLabel={placed ? 'Placed' : 'Place'}
        informationalOnly={placed}
        radius={2.3}
        disabled={placed}
        onInteract={() => onPlace(id, fragmentId, name)}
      >
        <RigidBody type="fixed" colliders={false}>
          <CuboidCollider args={[0.6, 0.7, 0.6]} position={[0, 0.7, 0]} />
          <mesh castShadow={preset.shadowsEnabled} receiveShadow={preset.shadowsEnabled} position={[0, 0.55, 0]}>
            <cylinderGeometry args={[0.55, 0.72, 1.1, 8]} />
            <meshStandardMaterial color="#d6cbb4" roughness={0.78} />
          </mesh>
          <mesh position={[0, 1.12, 0]}>
            <cylinderGeometry args={[0.58, 0.58, 0.08, 8]} />
            <meshStandardMaterial
              color={placed ? color : '#78716c'}
              emissive={placed ? color : '#292524'}
              emissiveIntensity={placed ? 1.2 : 0.2}
            />
          </mesh>
        </RigidBody>

        {placed && (
          <>
            <mesh ref={orbRef} position={[0, 1.65, 0]}>
              <octahedronGeometry args={[0.36, 0]} />
              <meshStandardMaterial
                color={color}
                emissive={color}
                emissiveIntensity={1.6}
                roughness={0.12}
              />
            </mesh>
            <GlowHalo position={[0, 1.65, 0]} color={color} scale={2.6} />
          </>
        )}
      </Interactable>
    </group>
  );
}

/**
 * Fragment 5 Horizon Cradle object that launches the 3D Finale Cutscene on pickup.
 */
function FinalSkyFragment({
  position,
  unlocked,
}: {
  position: [number, number, number];
  unlocked: boolean;
}) {
  const [triggered, setTriggered] = useState(false);
  const coreRef = useRef<THREE.Mesh>(null);
  const ringRef = useRef<THREE.Mesh>(null);

  useFrame((state, rawDt) => {
    const dt = Math.min(rawDt, 0.05);
    const t = state.clock.elapsedTime;
    if (coreRef.current) {
      coreRef.current.rotation.y += dt * (unlocked ? 1.8 : 0.4);
      coreRef.current.position.y = Math.sin(t * 2.0) * 0.14;
    }
    if (ringRef.current) {
      ringRef.current.rotation.z += dt * 1.2;
      ringRef.current.rotation.x = 0.65;
    }
  });

  const handleEnter = (payload: IntersectionEnterPayload) => {
    if (!unlocked || triggered || !isPlayerPayload(payload)) return;
    setTriggered(true);
    const store = useGameStore.getState();
    store.collectFragment('fragment-5', 'Echo of Eternity');
    eventBus.emit('fragment:collected', {
      id: 'fragment-5',
      name: 'Echo of Eternity',
    });
    store.startFinaleCutscene();
  };

  return (
    <group position={position}>
      <mesh ref={coreRef}>
        <octahedronGeometry args={[unlocked ? 0.62 : 0.42, 0]} />
        <meshStandardMaterial
          color={unlocked ? '#fde047' : '#94a3b8'}
          emissive={unlocked ? '#f59e0b' : '#475569'}
          emissiveIntensity={unlocked ? 1.8 : 0.35}
          roughness={0.12}
          metalness={0.4}
          transparent={!unlocked}
          opacity={unlocked ? 1 : 0.5}
        />
      </mesh>
      <mesh ref={ringRef}>
        <torusGeometry args={[0.98, 0.05, 10, 28]} />
        <meshStandardMaterial
          color={unlocked ? '#2dd4bf' : '#64748b'}
          emissive={unlocked ? '#14b8a6' : '#1e293b'}
          emissiveIntensity={unlocked ? 1.0 : 0.2}
          metalness={0.75}
        />
      </mesh>
      {unlocked && <GlowHalo position={[0, 0, 0]} color="#fbbf24" scale={4.2} />}
      {unlocked && !triggered && (
        <RigidBody type="fixed" colliders={false} sensor>
          <BallCollider
            args={[1.35]}
            sensor
            onIntersectionEnter={handleEnter}
          />
        </RigidBody>
      )}
    </group>
  );
}

/**
 * Radiant light pillar shooting into the sky once the 5th fragment restores the island.
 */
function RestoredEnergyBeacon({ active }: { active: boolean }) {
  const beamRef = useRef<THREE.Mesh>(null);
  useFrame((state) => {
    if (!beamRef.current || !active) return;
    const s = 1 + Math.sin(state.clock.elapsedTime * 3.0) * 0.12;
    beamRef.current.scale.set(s, 1, s);
  });

  if (!active) return null;

  return (
    <group position={[0, 5.5, -31.5]}>
      <mesh ref={beamRef} position={[0, 26, 0]}>
        <cylinderGeometry args={[1.1, 2.2, 56, 16, 1, true]} />
        <meshBasicMaterial
          color="#5eead4"
          transparent
          opacity={0.42}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
          side={THREE.DoubleSide}
        />
      </mesh>
      <mesh position={[0, 26, 0]}>
        <cylinderGeometry args={[0.45, 0.9, 56, 12, 1, true]} />
        <meshBasicMaterial
          color="#fde047"
          transparent
          opacity={0.65}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
          side={THREE.DoubleSide}
        />
      </mesh>
      <GlowHalo position={[0, 1.5, 0]} color="#fde047" scale={8.0} />
    </group>
  );
}

export function Level5_SkyTemple() {
  const activeTier = useGameStore((s) => s.activeQualityTier);
  const preset = getQualityPreset(activeTier);
  const chunks = useMemo(() => LEVEL5_CHUNKS.map((s) => s.chunk), []);
  const activatedIds = useGameStore((s) => s.activatedIds);
  const recoveredFragments = useGameStore((s) => s.recoveredFragments);
  const finaleCutscene = useGameStore((s) => s.finaleCutscene);

  const bridge1Active = Boolean(activatedIds['l5-bridge-1-assembled']);
  const eastBridgeSwitch = Boolean(activatedIds['l5-switch-east-bridge']);
  const westPlateActive = Boolean(activatedIds['l5-plate-west']);
  const westSolved = Boolean(activatedIds['l5-west-solved']);
  const eastSolved = Boolean(activatedIds['l5-east-solved']);
  const grandBridgeActive = westSolved && eastSolved;
  const sanctumUnsealed = Boolean(activatedIds['l5-sanctum-unsealed']);

  const placedPedestalsCount = useMemo(
    () =>
      FRAGMENT_PEDESTALS.filter((p) => Boolean(activatedIds[p.id])).length,
    [activatedIds],
  );
  const allPedestalsPlaced = placedPedestalsCount >= FRAGMENT_PEDESTALS.length;

  useEffect(() => {
    const store = useGameStore.getState();
    if (store.screen === 'playing' && store.levelElapsedSeconds < 2) {
      store.showToast(
        'Reached The Sky Temple · Harmonize both floating wings to unseal the Sanctum',
      );
    }
  }, []);

  // Latch West Wing completion when all 3 symbols align AND pressure plate is weighted
  const evaluateWestWing = useCallback(() => {
    const store = useGameStore.getState();
    if (store.activatedIds['l5-west-solved']) return;
    const steps = SYMBOL_PILLAR_IDS.map((sid, idx) => {
      const saved = store.getWorldObjectState(sid, 'level5')?.phase;
      return typeof saved === 'number' ? saved : SYMBOL_INITIAL_STEPS[idx];
    });
    const symbolsOk = areSkySymbolsAligned(steps);
    const plateOk = Boolean(store.activatedIds['l5-plate-west']);
    if (symbolsOk && plateOk) {
      store.setActivated('l5-west-solved', true);
      store.setWorldObjectState('l5-west-solved', { solved: true }, 'level5');
      store.reportQuestObjective('l5-obj-west-wing', 1, 'level5');
      playPooledSynth('door');
      store.showToast(
        'Western Resonance Harmonized! Light arcs toward the Central Temple!',
        'objective',
      );
    }
  }, []);

  useEffect(() => {
    if (westPlateActive) {
      evaluateWestWing();
    }
  }, [westPlateActive, evaluateWestWing]);

  useEffect(() => {
    if (eastSolved) {
      useGameStore
        .getState()
        .reportQuestObjective('l5-obj-east-wing', 1, 'level5');
    }
  }, [eastSolved]);

  const handlePlacePedestal = useCallback(
    (pedestalId: string, fragmentId: string, name: string) => {
      const store = useGameStore.getState();
      if (store.activatedIds[pedestalId]) return;
      if (!store.recoveredFragments.includes(fragmentId)) {
        store.showToast(`Missing ${name} (${fragmentId})`, 'info');
        return;
      }
      store.setActivated(pedestalId, true);
      store.setWorldObjectState(pedestalId, { solved: true }, 'level5');
      playPooledSynth('crystal');

      const nextCount = FRAGMENT_PEDESTALS.filter((p) =>
        p.id === pedestalId ? true : Boolean(store.activatedIds[p.id]),
      ).length;
      store.reportQuestObjective('l5-obj-pedestals', nextCount, 'level5');

      if (nextCount >= FRAGMENT_PEDESTALS.length) {
        playPooledSynth('door');
        store.showToast(
          'All 4 Echoes placed! The Horizon Cradle awakens with the Echo of Eternity!',
          'objective',
        );
      } else {
        store.showToast(`Placed ${name} (${nextCount}/4)`, 'info');
      }
    },
    [],
  );

  const handleFallRespawn = useCallback(() => {
    useGameStore
      .getState()
      .triggerFallRespawn('Fell into the cloud sea — returned to checkpoint');
  }, []);

  const renderChunk = useCallback(
    (chunkId: string) => {
      const spec = LEVEL5_CHUNKS.find((s) => s.chunk.id === chunkId);
      if (!spec) return null;
      const chunkCrystals = getCrystalsForChunk('level5', spec.patch);

      switch (chunkId) {
        case 'l5-arrival-island':
          return (
            <>
              <FloatingIslandDeck island={SKY_ISLANDS[0]} />
              <FloatingIslandDeck island={SKY_ISLANDS[1]} />
              <CrystalField crystals={chunkCrystals} color="#fbbf24" />

              {/* Arrival Colonnade Pillars */}
              <RigidBody type="fixed" colliders="cuboid">
                {[-4.5, 4.5].map((px, idx) => (
                  <mesh key={`l5-arr-col-${idx}`} castShadow={preset.shadowsEnabled} receiveShadow={preset.shadowsEnabled} position={[px, 4.7, 21.5]}>
                    <cylinderGeometry args={[0.42, 0.5, 4.4, 8]} />
                    <meshStandardMaterial color="#e7dec8" roughness={0.78} />
                  </mesh>
                ))}
              </RigidBody>

              {/* Trigger for Self-Assembling Arrival Bridge */}
              <TriggerZone
                id="l5-trigger-bridge-1"
                chunkId={chunkId}
                position={[0, 3.6, 17.8]}
                halfExtents={[4.8, 1.6, 2.2]}
                once
                onEnter={() => {
                  const store = useGameStore.getState();
                  if (!store.activatedIds['l5-bridge-1-assembled']) {
                    store.setActivated('l5-bridge-1-assembled', true);
                    store.setWorldObjectState(
                      'l5-bridge-1-assembled',
                      { solved: true },
                      'level5',
                    );
                    playPooledSynth('door');
                    store.showToast('Sky Bridge assembled!', 'info');
                  }
                }}
              />

              <SelfAssemblingBridge
                id="l5-bridge-arrival"
                start={[0, 2.55, 16.0]}
                end={[0, 2.8, 6.0]}
                segments={5}
                width={3.6}
                active={bridge1Active}
              />

              <Inscription
                id="l5-inscription-courtyard"
                position={[0, 2.8, 1.5]}
                rotationY={0}
                title="Edict of the Skyward Builders"
                body="Here above the clouds rests the Echo of Eternity. Harmonize the Western Symbol Isle and unlock the Eastern Dawn Vault to raise the Grand Bridge, then bring all four recovered Echoes into the Sanctum."
              />

              {/* Switch raising Eastern Self-Assembling Bridge */}
              <Switch
                id="l5-switch-east-bridge"
                label="Eastern Sky-Bridge Conduit"
                position={[6.5, 2.8, 0]}
                rotationY={-Math.PI / 2}
                oneShot
              />

              <CheckpointBeacon
                id="l5-courtyard-cp"
                chunkId={chunkId}
                position={[0, 2.8, -2.5]}
                spawnPos={[0, 3.15, -2.5]}
                label="Sky Courtyard"
              />
            </>
          );

        case 'l5-west-wing':
          return (
            <>
              <FloatingIslandDeck island={SKY_ISLANDS[2]} />
              <CrystalField crystals={chunkCrystals} color="#fbbf24" />

              {/* 2 Moving Sky Platforms leading from Courtyard to West Isle */}
              <MovingPlatform
                id="l5-move-west-1"
                chunkId={chunkId}
                from={[-9.5, 2.8, 0]}
                to={[-13.5, 3.4, -2.0]}
                size={[3.2, 0.45, 3.2]}
                speed={0.44}
                color="#e6dcc6"
                accentColor="#fbbf24"
              />
              <MovingPlatform
                id="l5-move-west-2"
                chunkId={chunkId}
                from={[-14.5, 3.5, -4.5]}
                to={[-16.8, 4.0, -7.2]}
                size={[3.2, 0.45, 3.2]}
                speed={0.48}
                color="#e6dcc6"
                accentColor="#fbbf24"
              />

              <Inscription
                id="l5-inscription-symbols"
                position={[-18.0, 4.0, -3.5]}
                rotationY={0.4}
                title="Hymn of the Three Celestial Pillars"
                body="Align the Western Trio: turn Pillar I NORTH toward the Sun, Pillar II EAST toward the Tide, and Pillar III WEST toward the Stars—then anchor the Resonance Plate with the golden block."
              />

              <RotatingMechanism
                id="l5-symbol-1"
                chunkId={chunkId}
                label="Sun Pillar I"
                position={[-20.5, 4.0, -3.5]}
                initialStep={SYMBOL_INITIAL_STEPS[0]}
                targetStep={0}
                variant="statue"
                accentColor="#fbbf24"
                locked={westSolved}
                onStepChange={evaluateWestWing}
              />
              <RotatingMechanism
                id="l5-symbol-2"
                chunkId={chunkId}
                label="Tide Pillar II"
                position={[-23.0, 4.0, -3.5]}
                initialStep={SYMBOL_INITIAL_STEPS[1]}
                targetStep={1}
                variant="statue"
                accentColor="#38bdf8"
                locked={westSolved}
                onStepChange={evaluateWestWing}
              />
              <RotatingMechanism
                id="l5-symbol-3"
                chunkId={chunkId}
                label="Star Pillar III"
                position={[-25.5, 4.0, -3.5]}
                initialStep={SYMBOL_INITIAL_STEPS[2]}
                targetStep={3}
                variant="statue"
                accentColor="#c084fc"
                locked={westSolved}
                onStepChange={evaluateWestWing}
              />

              <PressurePlate
                id="l5-plate-west"
                position={[-21.0, 4.0, -10.5]}
                label="West Resonance Plate"
              />
              <PushableBlock
                id="l5-block-west"
                chunkId={chunkId}
                position={[-24.0, 4.65, -10.5]}
                size={1.15}
                color="#d9af62"
              />

              <Chest
                id="chest-sky-west"
                position={[-26.5, 4.0, -11.5]}
                rotationY={0.35}
                rewardItem="Celestial Astrolabe"
              />

              {westSolved && (
                <GlowHalo position={[-22.5, 6.2, -7.0]} color="#fbbf24" scale={4.6} />
              )}
            </>
          );

        case 'l5-east-wing':
          return (
            <>
              <FloatingIslandDeck island={SKY_ISLANDS[3]} />
              <FloatingIslandDeck island={SKY_ISLANDS[4]} />
              <CrystalField crystals={chunkCrystals} color="#fbbf24" />

              {/* Self-Assembling Bridge from Courtyard to East Isle */}
              <SelfAssemblingBridge
                id="l5-bridge-east"
                start={[9.0, 2.8, 0]}
                end={[16.0, 4.0, 0]}
                segments={4}
                width={3.4}
                active={eastBridgeSwitch}
              />

              {/* Moving Platform to Side Key Spire */}
              <MovingPlatform
                id="l5-move-east-spire"
                chunkId={chunkId}
                from={[23.0, 4.0, 6.2]}
                to={[23.0, 4.8, 11.8]}
                size={[3.2, 0.45, 3.2]}
                speed={0.45}
                color="#e6dcc6"
                accentColor="#fbbf24"
              />

              {/* Sky Temple Key atop Key Spire */}
              <KeyItem
                id="key-sky"
                label="Sky Temple Key"
                position={[23.0, 5.7, 15.5]}
              />

              {/* Eastern Vault Enclosure & Key-Locked Door */}
              <RigidBody type="fixed" colliders="cuboid">
                <mesh castShadow={preset.shadowsEnabled} receiveShadow={preset.shadowsEnabled} position={[17.8, 6.2, -2.5]}>
                  <boxGeometry args={[3.4, 4.4, 1.0]} />
                  <meshStandardMaterial color="#dcd1ba" roughness={0.82} />
                </mesh>
                <mesh castShadow={preset.shadowsEnabled} receiveShadow={preset.shadowsEnabled} position={[27.2, 6.2, -2.5]}>
                  <boxGeometry args={[3.4, 4.4, 1.0]} />
                  <meshStandardMaterial color="#dcd1ba" roughness={0.82} />
                </mesh>
              </RigidBody>

              <Door
                id="l5-door-east-key"
                position={[22.5, 4.0, -2.5]}
                width={4.0}
                height={4.0}
                requiredKeyId="key-sky"
                keyLabel="Sky Temple Key"
              />

              <Chest
                id="chest-sky-east"
                position={[20.5, 4.0, -5.2]}
                rotationY={0.2}
                rewardItem="Dawnfire Diadem"
              />

              <Switch
                id="l5-east-solved"
                label="Dawn Conduit Switch"
                position={[24.5, 4.0, -5.2]}
                rotationY={-0.3}
                oneShot
              />

              {eastSolved && (
                <GlowHalo position={[22.5, 6.2, -0.5]} color="#fbbf24" scale={4.6} />
              )}
            </>
          );

        case 'l5-central-temple':
          return (
            <>
              <FloatingIslandDeck island={SKY_ISLANDS[5]} />
              <CrystalField crystals={chunkCrystals} color="#fbbf24" />

              {/* Grand Self-Assembling Sky Bridge to Central Temple */}
              <SelfAssemblingBridge
                id="l5-bridge-grand"
                start={[0, 2.8, -6.0]}
                end={[0, 4.6, -14.0]}
                segments={5}
                width={4.2}
                active={grandBridgeActive}
              />

              {/* Temple Colonnade & Sanctum Walls */}
              <RigidBody type="fixed" colliders="cuboid">
                {[-9.5, 9.5].map((cx, idx) => (
                  <mesh key={`l5-tcol-f-${idx}`} castShadow={preset.shadowsEnabled} receiveShadow={preset.shadowsEnabled} position={[cx, 7.6, -17.0]}>
                    <cylinderGeometry args={[0.55, 0.68, 6.0, 10]} />
                    <meshStandardMaterial color="#ebe2ce" roughness={0.76} />
                  </mesh>
                ))}
                {/* Sanctum Gate Flanking Walls at z = -21 */}
                <mesh castShadow={preset.shadowsEnabled} receiveShadow={preset.shadowsEnabled} position={[-7.6, 7.0, -21.0]}>
                  <boxGeometry args={[10.2, 4.8, 1.2]} />
                  <meshStandardMaterial color="#dfd4bc" roughness={0.82} />
                </mesh>
                <mesh castShadow={preset.shadowsEnabled} receiveShadow={preset.shadowsEnabled} position={[7.6, 7.0, -21.0]}>
                  <boxGeometry args={[10.2, 4.8, 1.2]} />
                  <meshStandardMaterial color="#dfd4bc" roughness={0.82} />
                </mesh>
                {/* Sanctum Side & Back Walls */}
                <mesh castShadow={preset.shadowsEnabled} receiveShadow={preset.shadowsEnabled} position={[-12.5, 7.0, -29.8]}>
                  <boxGeometry args={[1.2, 4.8, 18.8]} />
                  <meshStandardMaterial color="#dfd4bc" roughness={0.82} />
                </mesh>
                <mesh castShadow={preset.shadowsEnabled} receiveShadow={preset.shadowsEnabled} position={[12.5, 7.0, -29.8]}>
                  <boxGeometry args={[1.2, 4.8, 18.8]} />
                  <meshStandardMaterial color="#dfd4bc" roughness={0.82} />
                </mesh>
                <mesh castShadow={preset.shadowsEnabled} receiveShadow={preset.shadowsEnabled} position={[0, 7.0, -38.6]}>
                  <boxGeometry args={[26.2, 4.8, 1.2]} />
                  <meshStandardMaterial color="#dfd4bc" roughness={0.82} />
                </mesh>
                {/* Horizon Cradle Altar */}
                <mesh castShadow={preset.shadowsEnabled} receiveShadow={preset.shadowsEnabled} position={[0, 5.1, -31.5]}>
                  <cylinderGeometry args={[1.7, 2.1, 1.0, 12]} />
                  <meshStandardMaterial color="#f5ecd6" roughness={0.7} />
                </mesh>
              </RigidBody>

              <CheckpointBeacon
                id="l5-temple-cp"
                chunkId={chunkId}
                position={[0, 4.6, -17.5]}
                spawnPos={[0, 4.95, -17.5]}
                label="Sky Temple Forecourt"
              />

              {/* 4-Fragment Sanctuary Gate */}
              <FourFragmentSanctumGate
                unsealed={sanctumUnsealed}
                westSolved={westSolved}
                eastSolved={eastSolved}
                recoveredFragments={recoveredFragments}
              />

              {/* 4 Echo Pedestals */}
              {FRAGMENT_PEDESTALS.map((ped) => (
                <FragmentPedestal
                  key={ped.id}
                  id={ped.id}
                  fragmentId={ped.fragmentId}
                  name={ped.name}
                  position={ped.position}
                  color={ped.color}
                  placed={Boolean(activatedIds[ped.id])}
                  onPlace={handlePlacePedestal}
                />
              ))}

              {/* Final Fragment 5 on Horizon Cradle */}
              <FinalSkyFragment
                position={[0, 6.3, -31.5]}
                unlocked={allPedestalsPlaced}
              />

              <RestoredEnergyBeacon
                active={finaleCutscene.islandRestored || Boolean(activatedIds['fragment-5'])}
              />
            </>
          );

        default:
          return null;
      }
    },
    [
      activatedIds,
      allPedestalsPlaced,
      bridge1Active,
      eastBridgeSwitch,
      eastSolved,
      evaluateWestWing,
      finaleCutscene.islandRestored,
      grandBridgeActive,
      handlePlacePedestal,
      preset.shadowsEnabled,
      recoveredFragments,
      sanctumUnsealed,
      westSolved,
    ],
  );

  return (
    <group name="level5-sky-temple">
      <SharedBiomeBackdrop levelId="level5" />
      <GoldenHourSkyDome restored={finaleCutscene.islandRestored} />
      <CloudSeaBelow />

      <ChunkManager
        levelId="level5"
        chunks={chunks}
        renderChunk={renderChunk}
        onStreamingPendingChange={(pending) => {
          useGameStore.getState().setStreamingPending(pending);
        }}
      />

      {/* Cloud Sea Fall-Safety Fade Respawn */}
      <TriggerZone
        id="l5-fall-safety"
        position={[0, -4.5, 0]}
        halfExtents={[160, 2.0, 160]}
        onEnter={handleFallRespawn}
      />
    </group>
  );
}

export default Level5_SkyTemple;
