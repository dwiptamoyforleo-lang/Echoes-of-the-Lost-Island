import { useCallback, useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import {
  CuboidCollider,
  RigidBody,
  type RapierCollider,
} from '@react-three/rapier';
import * as THREE from 'three';
import {
  Chest,
  CrystalField,
  Fragment,
  Interactable,
} from '@/src/game/collectibles';
import {
  registerIceCollider,
  unregisterIceCollider,
} from '@/src/game/physics';
import { playerTelemetry } from '@/src/game/player/playerTelemetry';
import {
  BreakableIceBridge,
  CrackedIceWall,
  Door,
  Inscription,
  MovingPlatform,
  Switch,
  TriggerZone,
} from '@/src/game/puzzles';
import { getQualityPreset } from '@/src/game/rendering/adaptiveQuality';
import {
  useCachedGeometry,
  useCachedMaterial,
} from '@/src/game/rendering/assetCache';
import { useGameStore } from '@/src/state/gameStore';
import { playPooledSynth } from '@/src/systems/audioSystem';
import { CheckpointBeacon } from './CheckpointBeacon';
import { ChunkManager } from './ChunkManager';
import {
  ChunkTerrainPatch,
  GlowHalo,
  SharedBiomeBackdrop,
} from './SharedBiomeEnvironment';
import { getCrystalsForChunk } from './levelTerrainFactory';
import {
  EMITTER_POS,
  LEVEL4_CHUNKS,
  MIRROR_IDS,
  MIRROR_INITIAL_STEPS,
  MIRROR_POSITIONS,
  MIRROR_TARGET_STEPS,
  RECEIVER_POS,
  getFrozenPeaksHeight,
  traceIceMirrorBeam,
  type BeamSegment,
} from './level4Config';

const COMPASS_LABELS = ['North', 'East', 'South', 'West'] as const;
const _dummy = new THREE.Object3D();

function createSeededRng(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

/**
 * Procedural Aurora Borealis ribbons shimmering across the northern night sky.
 */
function AuroraSkyCurtains() {
  const matA = useMemo(
    () =>
      new THREE.ShaderMaterial({
        uniforms: {
          uTime: { value: 0 },
          uPhase: { value: 0 },
        },
        vertexShader: `
          uniform float uTime;
          uniform float uPhase;
          varying vec2 vUv;
          void main() {
            vUv = uv;
            vec3 pos = position;
            pos.z += sin(pos.x * 0.08 + uTime * 0.45 + uPhase) * 3.8;
            pos.y += cos(pos.x * 0.05 - uTime * 0.35 + uPhase) * 1.4;
            gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
          }
        `,
        fragmentShader: `
          uniform float uTime;
          uniform float uPhase;
          varying vec2 vUv;
          void main() {
            float wave1 = sin(vUv.x * 16.0 + uTime * 0.7 + uPhase) * 0.5 + 0.5;
            float wave2 = sin(vUv.x * 29.0 - uTime * 0.55 + uPhase * 1.7) * 0.5 + 0.5;
            float curtain = pow(wave1 * 0.65 + wave2 * 0.35, 1.4);
            float vertFade = smoothstep(0.0, 0.32, vUv.y) * smoothstep(1.0, 0.25, vUv.y);
            float horizFade = smoothstep(0.0, 0.14, vUv.x) * smoothstep(1.0, 0.86, vUv.x);
            vec3 emerald = vec3(0.18, 0.92, 0.72);
            vec3 cyan = vec3(0.24, 0.74, 0.98);
            vec3 violet = vec3(0.62, 0.36, 0.96);
            vec3 col = mix(emerald, cyan, smoothstep(0.25, 0.68, vUv.y));
            col = mix(col, violet, smoothstep(0.65, 1.0, vUv.y) * 0.8);
            float alpha = curtain * vertFade * horizFade * 0.52;
            gl_FragColor = vec4(col, alpha);
          }
        `,
        transparent: true,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        side: THREE.DoubleSide,
      }),
    [],
  );

  const matB = useMemo(() => {
    const m = matA.clone();
    m.uniforms = {
      uTime: { value: 0 },
      uPhase: { value: 2.3 },
    };
    return m;
  }, [matA]);

  useEffect(() => {
    return () => {
      matA.dispose();
      matB.dispose();
    };
  }, [matA, matB]);

  useFrame((state) => {
    const t = state.clock.elapsedTime;
    matA.uniforms.uTime.value = t;
    matB.uniforms.uTime.value = t;
  });

  return (
    <group name="aurora-borealis">
      <mesh
        position={[-6, 30, -56]}
        rotation={[0.28, 0.12, 0.04]}
        material={matA}
      >
        <planeGeometry args={[130, 24, 40, 6]} />
      </mesh>
      <mesh
        position={[14, 34, -64]}
        rotation={[0.25, -0.18, -0.06]}
        material={matB}
      >
        <planeGeometry args={[120, 22, 36, 6]} />
      </mesh>
    </group>
  );
}

/**
 * Zero-GC GPU-driven falling snow particles wrapping smoothly around the player.
 */
function SnowfallParticles() {
  const activeTier = useGameStore((s) => s.activeQualityTier);
  const count = activeTier === 'high' ? 650 : activeTier === 'medium' ? 420 : 220;

  const { geometry, material } = useMemo(() => {
    const rng = createSeededRng(4041);
    const positions = new Float32Array(count * 3);
    const phases = new Float32Array(count);
    for (let i = 0; i < count; i++) {
      positions[i * 3] = (rng() - 0.5) * 44;
      positions[i * 3 + 1] = rng() * 22;
      positions[i * 3 + 2] = (rng() - 0.5) * 44;
      phases[i] = rng() * Math.PI * 2;
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geo.setAttribute('aPhase', new THREE.BufferAttribute(phases, 1));
    geo.computeBoundingSphere();

    const mat = new THREE.ShaderMaterial({
      uniforms: {
        uTime: { value: 0 },
        uPlayerPos: { value: new THREE.Vector3(0, 2, 20) },
      },
      vertexShader: `
        attribute float aPhase;
        uniform float uTime;
        uniform vec3 uPlayerPos;
        varying float vAlpha;
        void main() {
          vec3 box = vec3(44.0, 22.0, 44.0);
          vec3 p = position;
          p.y = mod(p.y - uTime * (2.6 + fract(aPhase) * 1.4), box.y);
          p.x += sin(uTime * 1.3 + aPhase) * 1.1;
          p.z += cos(uTime * 1.1 + aPhase * 1.4) * 1.1;
          vec3 rel = mod(p - uPlayerPos + box * 0.5, box) - box * 0.5;
          vec3 worldPos = uPlayerPos + rel;
          vec4 mvPos = modelViewMatrix * vec4(worldPos, 1.0);
          gl_Position = projectionMatrix * mvPos;
          gl_PointSize = clamp(32.0 / max(1.0, -mvPos.z), 2.0, 5.5);
          vAlpha = smoothstep(22.0, 4.0, length(rel.xz)) * 0.85;
        }
      `,
      fragmentShader: `
        varying float vAlpha;
        void main() {
          vec2 c = gl_PointCoord - vec2(0.5);
          float d = dot(c, c);
          if (d > 0.25) discard;
          float soft = 1.0 - smoothstep(0.05, 0.25, d);
          gl_FragColor = vec4(0.92, 0.97, 1.0, soft * vAlpha);
        }
      `,
      transparent: true,
      depthWrite: false,
    });

    return { geometry: geo, material: mat };
  }, [count]);

  useEffect(() => {
    return () => {
      geometry.dispose();
      material.dispose();
    };
  }, [geometry, material]);

  useFrame((state) => {
    material.uniforms.uTime.value = state.clock.elapsedTime;
    material.uniforms.uPlayerPos.value.copy(playerTelemetry.position);
  });

  return <points geometry={geometry} material={material} frustumCulled={false} />;
}

/**
 * Slippery Frozen Lake surface collider + glossy glacial ice visual sheet.
 */
function FrozenLakeSheet() {
  const colliderRef = useRef<RapierCollider>(null);

  useEffect(() => {
    const col = colliderRef.current;
    if (col) {
      registerIceCollider(col.handle);
    }
    return () => {
      if (col) {
        unregisterIceCollider(col.handle);
      }
    };
  }, []);

  return (
    <RigidBody type="fixed" position={[0, 1.5, 1]} colliders={false} friction={0.05}>
      <CuboidCollider ref={colliderRef} args={[13.5, 0.15, 12.2]} />
      <mesh receiveShadow>
        <boxGeometry args={[27, 0.3, 24.4]} />
        <meshStandardMaterial
          color="#93c5fd"
          emissive="#0c4a6e"
          emissiveIntensity={0.22}
          roughness={0.08}
          metalness={0.18}
          transparent
          opacity={0.86}
        />
      </mesh>
      {/* Subtle frost vein accents across frozen surface */}
      <mesh position={[0, 0.16, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[5.5, 5.8, 24]} />
        <meshBasicMaterial color="#e0f2fe" transparent opacity={0.35} />
      </mesh>
    </RigidBody>
  );
}

/**
 * Snow-frosted mountain pine trees & glacial crystal spires per chunk.
 */
function FrozenPeaksProps({
  minX,
  maxX,
  minZ,
  maxZ,
  seed,
}: {
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
  seed: number;
}) {
  const trunkRef = useRef<THREE.InstancedMesh>(null);
  const pineRef = useRef<THREE.InstancedMesh>(null);
  const iceSpireRef = useRef<THREE.InstancedMesh>(null);

  const { pines, spires } = useMemo(() => {
    const rng = createSeededRng(seed);
    const pineList: Array<{ x: number; y: number; z: number; s: number; r: number }> = [];
    const spireList: Array<{ x: number; y: number; z: number; s: number; r: number }> = [];

    const isLandmark = (x: number, z: number) => {
      if (Math.abs(x) < 14.5 && z > -13 && z < 15) return true; // Frozen lake
      if (Math.abs(x) < 6 && z >= 13 && z <= 32) return true; // Spawn trail
      if (Math.abs(x) < 12 && z <= -12 && z >= -35) return true; // North sanctum
      if (x < -11 && z > -26 && z < 10) return true; // West glacier bridge & spire
      if (x > 13 && z > -18 && z < 11) return true; // East mountain cave
      return false;
    };

    const w = maxX - minX;
    const d = maxZ - minZ;

    for (let i = 0; i < 110 && pineList.length < 14; i++) {
      const x = minX + 2 + rng() * Math.max(2, w - 4);
      const z = minZ + 2 + rng() * Math.max(2, d - 4);
      if (isLandmark(x, z)) continue;
      const y = getFrozenPeaksHeight(x, z);
      if (y > 2.1 && y < 6.8) {
        pineList.push({ x, y: y - 0.1, z, s: 0.9 + rng() * 0.55, r: rng() * Math.PI * 2 });
      }
    }

    for (let i = 0; i < 90 && spireList.length < 10; i++) {
      const x = minX + 2 + rng() * Math.max(2, w - 4);
      const z = minZ + 2 + rng() * Math.max(2, d - 4);
      if (isLandmark(x, z)) continue;
      const y = getFrozenPeaksHeight(x, z);
      if (y > 2.2) {
        spireList.push({ x, y: y - 0.2, z, s: 0.8 + rng() * 1.1, r: rng() * Math.PI * 2 });
      }
    }

    return { pines: pineList, spires: spireList };
  }, [minX, maxX, minZ, maxZ, seed]);

  const trunkGeo = useCachedGeometry('frozen-pine-trunk', () => {
    const g = new THREE.CylinderGeometry(0.18, 0.3, 2.2, 6);
    g.translate(0, 1.1, 0);
    g.computeBoundingSphere();
    return g;
  });
  const pineGeo = useCachedGeometry('frozen-pine-cone', () => {
    const g = new THREE.ConeGeometry(1.5, 4.4, 7);
    g.translate(0, 3.4, 0);
    g.computeBoundingSphere();
    return g;
  });
  const spireGeo = useCachedGeometry('frozen-ice-spire', () => {
    const g = new THREE.ConeGeometry(0.85, 3.6, 5);
    g.translate(0, 1.8, 0);
    g.computeBoundingSphere();
    return g;
  });

  const trunkMat = useCachedMaterial('frozen-trunk-mat', () =>
    new THREE.MeshStandardMaterial({ color: '#47362b', roughness: 0.92 }),
  );
  const pineMat = useCachedMaterial('frozen-pine-mat', () =>
    new THREE.MeshStandardMaterial({ color: '#c7dce8', roughness: 0.78 }),
  );
  const spireMat = useCachedMaterial('frozen-spire-mat', () =>
    new THREE.MeshStandardMaterial({
      color: '#bae6fd',
      emissive: '#0369a1',
      emissiveIntensity: 0.24,
      roughness: 0.2,
      transparent: true,
      opacity: 0.88,
    }),
  );

  useEffect(() => {
    if (trunkRef.current && pineRef.current) {
      pines.forEach((p, i) => {
        _dummy.position.set(p.x, p.y, p.z);
        _dummy.rotation.set(0, p.r, 0);
        _dummy.scale.setScalar(p.s);
        _dummy.updateMatrix();
        trunkRef.current!.setMatrixAt(i, _dummy.matrix);
        pineRef.current!.setMatrixAt(i, _dummy.matrix);
      });
      trunkRef.current.instanceMatrix.needsUpdate = true;
      pineRef.current.instanceMatrix.needsUpdate = true;
    }
    if (iceSpireRef.current) {
      spires.forEach((sp, i) => {
        _dummy.position.set(sp.x, sp.y, sp.z);
        _dummy.rotation.set(0.08, sp.r, -0.06);
        _dummy.scale.setScalar(sp.s);
        _dummy.updateMatrix();
        iceSpireRef.current!.setMatrixAt(i, _dummy.matrix);
      });
      iceSpireRef.current.instanceMatrix.needsUpdate = true;
    }
  }, [pines, spires]);

  return (
    <group>
      {pines.length > 0 && (
        <>
          <instancedMesh ref={trunkRef} args={[trunkGeo, trunkMat, pines.length]} />
          <instancedMesh ref={pineRef} args={[pineGeo, pineMat, pines.length]} />
        </>
      )}
      {spires.length > 0 && (
        <instancedMesh ref={iceSpireRef} args={[spireGeo, spireMat, spires.length]} />
      )}
    </group>
  );
}

/**
 * Interactive rotating ice mirror reflecting the solar prism beam.
 */
function IceMirrorPedestal({
  id,
  chunkId,
  label,
  position,
  initialStep,
  targetStep,
  locked,
  onStepChange,
}: {
  id: string;
  chunkId: string;
  label: string;
  position: [number, number, number];
  initialStep: number;
  targetStep: number;
  locked: boolean;
  onStepChange: () => void;
}) {
  const savedPhase = useGameStore(
    (s) => s.worldState.levels[s.activeLevel]?.[id]?.phase,
  );
  const currentStep = (((savedPhase ?? initialStep) % 4) + 4) % 4;
  const isAligned = currentStep === (((targetStep % 4) + 4) % 4);

  const rotorRef = useRef<THREE.Group>(null);
  const angleRef = useRef(-currentStep * (Math.PI / 2));

  useFrame((_, rawDt) => {
    const dt = Math.min(rawDt, 0.05);
    const targetAngle = -currentStep * (Math.PI / 2);
    let diff = targetAngle - angleRef.current;
    while (diff > Math.PI) diff -= Math.PI * 2;
    while (diff < -Math.PI) diff += Math.PI * 2;
    angleRef.current += diff * (1 - Math.exp(-10 * dt));
    if (rotorRef.current) {
      rotorRef.current.rotation.y = angleRef.current;
    }
  });

  const handleRotate = () => {
    if (locked) return;
    const store = useGameStore.getState();
    const cur = store.getWorldObjectState(id, 'level4')?.phase ?? initialStep;
    const nextStep = (((cur + 1) % 4) + 4) % 4;
    store.setWorldObjectState(
      id,
      {
        chunkId,
        phase: nextStep,
        activated: nextStep === targetStep,
      },
      'level4',
    );
    playPooledSynth('switch');
    store.showToast(
      `${label} rotated — Reflecting ${COMPASS_LABELS[nextStep]}`,
      'info',
    );
    onStepChange();
  };

  return (
    <group position={position}>
      <Interactable
        id={id}
        prompt={
          locked
            ? `${label} Locked (Facing ${COMPASS_LABELS[currentStep]})`
            : `Rotate ${label} (Aiming ${COMPASS_LABELS[currentStep]})`
        }
        actionLabel={locked ? 'Locked' : 'Rotate'}
        informationalOnly={locked}
        radius={2.5}
        disabled={locked}
        onInteract={handleRotate}
      >
        <RigidBody type="fixed" colliders={false}>
          <CuboidCollider args={[0.62, 0.9, 0.62]} position={[0, 0.9, 0]} />
          <mesh castShadow receiveShadow position={[0, 0.35, 0]}>
            <cylinderGeometry args={[0.72, 0.86, 0.7, 8]} />
            <meshStandardMaterial color="#475569" roughness={0.8} />
          </mesh>
        </RigidBody>

        <group ref={rotorRef} position={[0, 0.7, 0]}>
          {/* Mirror Stand */}
          <mesh castShadow position={[0, 0.42, 0]}>
            <cylinderGeometry args={[0.22, 0.32, 0.84, 8]} />
            <meshStandardMaterial color="#64748b" roughness={0.7} />
          </mesh>
          {/* Polished Ice Mirror Disc aimed along -Z when step = 0 (North) */}
          <mesh castShadow position={[0, 0.95, 0]} rotation={[0, 0, 0]}>
            <boxGeometry args={[1.15, 0.95, 0.16]} />
            <meshStandardMaterial
              color={isAligned ? '#fde68a' : '#bae6fd'}
              emissive={isAligned ? '#f59e0b' : '#0284c7'}
              emissiveIntensity={isAligned ? 0.95 : 0.35}
              roughness={0.08}
              metalness={0.65}
            />
          </mesh>
          {/* Directional Aiming Crest pointing -Z */}
          <mesh position={[0, 0.95, -0.45]} rotation={[-Math.PI / 2, 0, 0]}>
            <coneGeometry args={[0.2, 0.45, 4]} />
            <meshStandardMaterial
              color={isAligned ? '#fbbf24' : '#38bdf8'}
              emissive={isAligned ? '#f59e0b' : '#0ea5e9'}
              emissiveIntensity={1.2}
            />
          </mesh>
        </group>
      </Interactable>
    </group>
  );
}

/**
 * Renders the golden solar beam segments bouncing across the ice mirrors.
 */
function SolarBeamRenderer({ segments }: { segments: BeamSegment[] }) {
  return (
    <group name="solar-mirror-beams">
      {segments.map((seg, idx) => {
        const dx = seg.to[0] - seg.from[0];
        const dy = seg.to[1] - seg.from[1];
        const dz = seg.to[2] - seg.from[2];
        const len = Math.hypot(dx, dy, dz) || 0.1;
        const mid: [number, number, number] = [
          (seg.from[0] + seg.to[0]) * 0.5,
          (seg.from[1] + seg.to[1]) * 0.5,
          (seg.from[2] + seg.to[2]) * 0.5,
        ];
        const yaw = Math.atan2(dx, dz);
        return (
          <group key={`beam-seg-${idx}`}>
            <mesh position={mid} rotation={[Math.PI / 2, 0, -yaw]}>
              <cylinderGeometry args={[0.11, 0.11, len, 8]} />
              <meshBasicMaterial color="#fde047" />
            </mesh>
            <mesh position={mid} rotation={[Math.PI / 2, 0, -yaw]}>
              <cylinderGeometry args={[0.24, 0.24, len, 8]} />
              <meshBasicMaterial
                color="#f59e0b"
                transparent
                opacity={0.35}
                depthWrite={false}
              />
            </mesh>
            <GlowHalo position={seg.to} color="#fbbf24" scale={2.4} />
          </group>
        );
      })}
    </group>
  );
}

export function Level4_FrozenPeaks() {
  const chunks = useMemo(() => LEVEL4_CHUNKS.map((s) => s.chunk), []);
  const worldLevelState = useGameStore((s) => s.worldState.levels.level4);
  const mirrorsSolved = useGameStore((s) =>
    Boolean(s.activatedIds['l4-mirrors-solved']),
  );
  const glacierSwitchActive = useGameStore((s) =>
    Boolean(s.activatedIds['l4-glacier-switch']),
  );
  const caveMechanismActive = useGameStore((s) =>
    Boolean(s.activatedIds['l4-cave-mechanism']),
  );

  const mirrorSteps = useMemo(
    () =>
      MIRROR_IDS.map((mid, idx) => {
        const saved = worldLevelState?.[mid]?.phase;
        return typeof saved === 'number' ? saved : MIRROR_INITIAL_STEPS[idx];
      }),
    [worldLevelState],
  );

  const beamTrace = useMemo(
    () => traceIceMirrorBeam(mirrorSteps),
    [mirrorSteps],
  );

  useEffect(() => {
    const store = useGameStore.getState();
    if (store.screen === 'playing' && store.levelElapsedSeconds < 2) {
      store.showToast(
        'Ascended to The Frozen Peaks · Redirect the solar prism beam to melt the Sanctum Door',
      );
    }
  }, []);

  useEffect(() => {
    if (glacierSwitchActive) {
      useGameStore
        .getState()
        .reportQuestObjective('l4-obj-traversal', 1, 'level4');
    }
  }, [glacierSwitchActive]);

  useEffect(() => {
    if (caveMechanismActive) {
      useGameStore.getState().reportQuestObjective('l4-obj-cave', 1, 'level4');
    }
  }, [caveMechanismActive]);

  const handleMirrorChange = useCallback(() => {
    const store = useGameStore.getState();
    if (store.activatedIds['l4-mirrors-solved']) return;
    const latestSteps = MIRROR_IDS.map((mid, idx) => {
      const saved = store.getWorldObjectState(mid, 'level4')?.phase;
      return typeof saved === 'number' ? saved : MIRROR_INITIAL_STEPS[idx];
    });
    const res = traceIceMirrorBeam(latestSteps);
    if (res.solved) {
      store.setActivated('l4-mirrors-solved', true);
      store.setWorldObjectState(
        'l4-mirrors-solved',
        { solved: true },
        'level4',
      );
      store.reportQuestObjective('l4-obj-mirrors', 1, 'level4');
      playPooledSynth('door');
      store.showToast(
        'Solar beam focused! The Frozen Sanctum Door melts open!',
        'objective',
      );
    }
  }, []);

  const handleFallRespawn = useCallback(() => {
    useGameStore
      .getState()
      .triggerFallRespawn('Slipped into the glacial chasm — returned to checkpoint');
  }, []);

  const sanctumSteps = useMemo(() => {
    const count = 5;
    return Array.from({ length: count }, (_, i) => {
      const h = 1.65 + ((3.2 - 1.65) * (i + 1)) / count;
      return {
        id: `l4-north-step-${i}`,
        position: [0, h / 2, -11.4 - i * 0.7] as [number, number, number],
        size: [6.4, h, 0.75] as [number, number, number],
      };
    });
  }, []);

  const caveSteps = useMemo(() => {
    const count = 4;
    return Array.from({ length: count }, (_, i) => {
      const h = 2.4 + ((2.8 - 2.4) * (i + 1)) / count;
      return {
        id: `l4-cave-step-${i}`,
        position: [17.5, h / 2, 5.2 + i * 0.55] as [number, number, number],
        size: [3.2, h, 0.6] as [number, number, number],
      };
    });
  }, []);

  const renderChunk = useCallback(
    (chunkId: string) => {
      const spec = LEVEL4_CHUNKS.find((s) => s.chunk.id === chunkId);
      if (!spec) return null;
      const chunkCrystals = getCrystalsForChunk('level4', spec.patch);

      switch (chunkId) {
        case 'l4-south-lake':
          return (
            <>
              <ChunkTerrainPatch
                levelId="level4"
                chunkId={chunkId}
                patch={spec.patch}
              />
              <FrozenPeaksProps
                minX={spec.patch.minX}
                maxX={spec.patch.maxX}
                minZ={-10}
                maxZ={34}
                seed={4101}
              />
              <FrozenLakeSheet />
              <CrystalField crystals={chunkCrystals} color="#38bdf8" />

              <Inscription
                id="l4-inscription-mirrors"
                position={[-3.2, getFrozenPeaksHeight(-3.2, 18.5), 18.5]}
                rotationY={0.28}
                title="Solar Prism Riddle"
                body="The Frozen Sanctum above the lake will not yield to brute force. Turn the three Ice Mirrors across the frozen basin—first North, then East, then North again—to focus the Sun-Prism beam upon the Sanctum Crystal."
              />

              {/* Solar Prism Emitter */}
              <RigidBody type="fixed" position={[EMITTER_POS[0], 1.65, EMITTER_POS[2]]} colliders="cuboid">
                <mesh castShadow receiveShadow position={[0, 0.55, 0]}>
                  <cylinderGeometry args={[0.6, 0.78, 1.1, 8]} />
                  <meshStandardMaterial color="#475569" roughness={0.78} />
                </mesh>
                <mesh position={[0, 1.25, 0]}>
                  <octahedronGeometry args={[0.42, 0]} />
                  <meshStandardMaterial
                    color="#fde047"
                    emissive="#f59e0b"
                    emissiveIntensity={1.6}
                  />
                </mesh>
              </RigidBody>
              <GlowHalo position={EMITTER_POS} color="#fbbf24" scale={3.2} />

              {/* 3 Rotating Ice Mirrors */}
              {MIRROR_IDS.map((mid, idx) => (
                <IceMirrorPedestal
                  key={mid}
                  id={mid}
                  chunkId={chunkId}
                  label={`Ice Mirror ${idx + 1}`}
                  position={MIRROR_POSITIONS[idx]}
                  initialStep={MIRROR_INITIAL_STEPS[idx]}
                  targetStep={MIRROR_TARGET_STEPS[idx]}
                  locked={mirrorsSolved}
                  onStepChange={handleMirrorChange}
                />
              ))}

              {/* Solar Beam Segments */}
              <SolarBeamRenderer segments={beamTrace.segments} />

              {/* Melt Receiver Crystal beside North Steps */}
              <RigidBody type="fixed" position={[RECEIVER_POS[0], 1.65, RECEIVER_POS[2]]} colliders="cuboid">
                <mesh castShadow receiveShadow position={[0, 0.55, 0]}>
                  <cylinderGeometry args={[0.58, 0.72, 1.1, 8]} />
                  <meshStandardMaterial color="#475569" roughness={0.8} />
                </mesh>
                <mesh position={[0, 1.32, 0]}>
                  <octahedronGeometry args={[0.45, 0]} />
                  <meshStandardMaterial
                    color={mirrorsSolved ? '#fde047' : '#7dd3fc'}
                    emissive={mirrorsSolved ? '#f59e0b' : '#0369a1'}
                    emissiveIntensity={mirrorsSolved ? 1.8 : 0.45}
                  />
                </mesh>
              </RigidBody>

              <CheckpointBeacon
                id="l4-lake-cp"
                chunkId={chunkId}
                position={[0, getFrozenPeaksHeight(0, 16.0), 16.0]}
                spawnPos={[0, getFrozenPeaksHeight(0, 16.0) + 0.35, 16.0]}
                label="Frozen Lake Shore"
              />
            </>
          );

        case 'l4-west-glacier':
          return (
            <>
              <ChunkTerrainPatch
                levelId="level4"
                chunkId={chunkId}
                patch={spec.patch}
              />
              <FrozenPeaksProps
                minX={-36}
                maxX={-13}
                minZ={-30}
                maxZ={24}
                seed={4202}
              />
              <CrystalField crystals={chunkCrystals} color="#38bdf8" />

              {/* Breakable Ice Bridge 1 across south chasm lip */}
              <BreakableIceBridge
                id="l4-bridge-1"
                start={[-13.5, 2.45, 6.0]}
                end={[-21.0, 2.95, 1.0]}
                segments={3}
                width={2.6}
              />

              {/* Moving Ice Platform across central glacial abyss */}
              <MovingPlatform
                id="l4-moving-ice-1"
                chunkId={chunkId}
                from={[-21.0, 3.0, -1.5]}
                to={[-21.0, 3.85, -9.5]}
                size={[3.8, 0.46, 3.8]}
                speed={0.42}
                color="#bae6fd"
                accentColor="#38bdf8"
                isIce
              />

              {/* Breakable Ice Bridge 2 onto Glacial Spire Plateau */}
              <BreakableIceBridge
                id="l4-bridge-2"
                start={[-21.0, 3.95, -12.0]}
                end={[-21.0, 4.45, -17.2]}
                segments={3}
                width={2.6}
              />

              {/* Glacial Spire Plateau Ruins, Chest 1 & Traversal Switch */}
              <RigidBody type="fixed" colliders="cuboid">
                <mesh castShadow receiveShadow position={[-25.5, 6.2, -21]}>
                  <cylinderGeometry args={[0.5, 0.62, 3.6, 8]} />
                  <meshStandardMaterial color="#475569" roughness={0.86} />
                </mesh>
                <mesh castShadow receiveShadow position={[-16.5, 6.2, -21]}>
                  <cylinderGeometry args={[0.5, 0.62, 3.6, 8]} />
                  <meshStandardMaterial color="#475569" roughness={0.86} />
                </mesh>
              </RigidBody>

              <Switch
                id="l4-glacier-switch"
                label="Glacial Conduit Beacon"
                position={[-19.2, 4.5, -20.5]}
                rotationY={0.4}
                oneShot
              />

              <Chest
                id="chest-frozen-west"
                position={[-22.8, 4.5, -22.2]}
                rotationY={0.25}
                rewardItem="Frostweave Mantle"
              />

              <CheckpointBeacon
                id="l4-west-spire"
                chunkId={chunkId}
                position={[-21.0, 4.5, -18.5]}
                spawnPos={[-21.0, 4.85, -18.5]}
                label="Glacial Spire"
              />
            </>
          );

        case 'l4-east-cave':
          return (
            <>
              <ChunkTerrainPatch
                levelId="level4"
                chunkId={chunkId}
                patch={spec.patch}
              />
              <CrystalField crystals={chunkCrystals} color="#38bdf8" />

              {caveSteps.map((st) => (
                <RigidBody
                  key={st.id}
                  type="fixed"
                  position={st.position}
                  colliders="cuboid"
                >
                  <mesh receiveShadow>
                    <boxGeometry args={st.size} />
                    <meshStandardMaterial color="#475569" roughness={0.86} />
                  </mesh>
                </RigidBody>
              ))}

              {/* Mountain Cave Walls & Roof enclosing Hidden Chamber */}
              <RigidBody type="fixed" colliders="cuboid">
                {/* Outer East Cliff Wall */}
                <mesh receiveShadow position={[29.2, 5.2, -5.5]}>
                  <boxGeometry args={[1.4, 6.4, 24]} />
                  <meshStandardMaterial color="#334155" roughness={0.92} />
                </mesh>
                {/* West Cave Partition leaving open entry on south-west (z > 0) */}
                <mesh receiveShadow position={[16.8, 5.2, -9.8]}>
                  <boxGeometry args={[1.4, 6.4, 13.5]} />
                  <meshStandardMaterial color="#334155" roughness={0.92} />
                </mesh>
                {/* North Back Wall */}
                <mesh receiveShadow position={[23.0, 5.2, -16.8]}>
                  <boxGeometry args={[13.8, 6.4, 1.4]} />
                  <meshStandardMaterial color="#334155" roughness={0.92} />
                </mesh>
                {/* Flanking Walls at Cracked Ice Wall z = -3.5 leaving 5.4m passage [20.3..25.7] */}
                <mesh receiveShadow position={[18.8, 5.2, -3.5]}>
                  <boxGeometry args={[3.0, 6.4, 1.2]} />
                  <meshStandardMaterial color="#3e4e60" roughness={0.88} />
                </mesh>
                <mesh receiveShadow position={[27.2, 5.2, -3.5]}>
                  <boxGeometry args={[3.0, 6.4, 1.2]} />
                  <meshStandardMaterial color="#3e4e60" roughness={0.88} />
                </mesh>
                {/* Cave Roof over inner grotto */}
                <mesh position={[23.0, 8.2, -9.8]}>
                  <boxGeometry args={[14.0, 0.9, 14.5]} />
                  <meshStandardMaterial color="#1e293b" roughness={0.94} />
                </mesh>
              </RigidBody>

              {/* Glowing Ice Lanterns inside Cave */}
              <GlowHalo position={[20.0, 4.4, -1.0]} color="#38bdf8" scale={3.2} />
              <GlowHalo position={[23.0, 4.6, -11.5]} color="#38bdf8" scale={3.8} />

              {/* Mechanism outside the Cracked Ice Wall */}
              <Switch
                id="l4-cave-mechanism"
                label="Thermal Resonance Lever"
                position={[17.5, 2.8, 8.2]}
                rotationY={-0.35}
                oneShot
              />

              {/* Cracked Ice Wall blocking the Hidden Cave Chamber */}
              <CrackedIceWall
                id="l4-cracked-wall"
                position={[23.0, 2.4, -3.5]}
                width={5.4}
                height={4.4}
                requiredIds={['l4-cave-mechanism']}
                lockedMessage="Cracked Ice Wall — Pull the Thermal Resonance Lever on the cave ledge"
              />

              <Inscription
                id="l4-inscription-cave"
                position={[20.0, 2.4, -8.8]}
                rotationY={0.4}
                title="Surveyor's Ice-Vault Log"
                body="The frozen peaks preserve the memories of the builders who fled upward to The Sky Temple. Even in frost, the conduits remember how to mend."
              />

              <Chest
                id="chest-frozen-cave"
                position={[24.2, 2.4, -12.8]}
                rotationY={-0.2}
                rewardItem="Aurora Prism"
              />
            </>
          );

        case 'l4-north-sanctum':
          return (
            <>
              <ChunkTerrainPatch
                levelId="level4"
                chunkId={chunkId}
                patch={spec.patch}
              />
              <FrozenPeaksProps
                minX={-14}
                maxX={14}
                minZ={-38}
                maxZ={-11}
                seed={4404}
              />
              <CrystalField crystals={chunkCrystals} color="#38bdf8" />

              {sanctumSteps.map((st) => (
                <RigidBody
                  key={st.id}
                  type="fixed"
                  position={st.position}
                  colliders="cuboid"
                >
                  <mesh castShadow receiveShadow>
                    <boxGeometry args={st.size} />
                    <meshStandardMaterial color="#64748b" roughness={0.82} />
                  </mesh>
                </RigidBody>
              ))}

              {/* Sanctum Floor & Ancient Frozen Citadel Enclosure */}
              <RigidBody type="fixed" colliders="cuboid">
                <mesh receiveShadow position={[0, 2.7, -24]}>
                  <boxGeometry args={[20, 1.0, 20]} />
                  <meshStandardMaterial color="#475569" roughness={0.86} />
                </mesh>
                {/* Flanking Walls at Frozen Door z = -18.5 */}
                <mesh castShadow receiveShadow position={[-5.9, 5.5, -18.5]}>
                  <boxGeometry args={[7.4, 4.6, 1.2]} />
                  <meshStandardMaterial color="#3b4c5e" roughness={0.88} />
                </mesh>
                <mesh castShadow receiveShadow position={[5.9, 5.5, -18.5]}>
                  <boxGeometry args={[7.4, 4.6, 1.2]} />
                  <meshStandardMaterial color="#3b4c5e" roughness={0.88} />
                </mesh>
                {/* Side & Back Walls */}
                <mesh castShadow receiveShadow position={[-9.0, 5.5, -25.5]}>
                  <boxGeometry args={[1.2, 4.6, 15.2]} />
                  <meshStandardMaterial color="#3b4c5e" roughness={0.88} />
                </mesh>
                <mesh castShadow receiveShadow position={[9.0, 5.5, -25.5]}>
                  <boxGeometry args={[1.2, 4.6, 15.2]} />
                  <meshStandardMaterial color="#3b4c5e" roughness={0.88} />
                </mesh>
                <mesh castShadow receiveShadow position={[0, 5.5, -32.5]}>
                  <boxGeometry args={[19.2, 4.6, 1.2]} />
                  <meshStandardMaterial color="#3b4c5e" roughness={0.88} />
                </mesh>
                {/* Fragment Altar Pedestal */}
                <mesh castShadow receiveShadow position={[0, 3.7, -27.5]}>
                  <boxGeometry args={[2.5, 1.0, 2.5]} />
                  <meshStandardMaterial color="#94a3b8" roughness={0.74} />
                </mesh>
              </RigidBody>

              <Door
                id="l4-door-sanctum"
                position={[0, 3.2, -18.5]}
                width={4.4}
                height={4.2}
                requiredIds={['l4-mirrors-solved']}
              />

              <CheckpointBeacon
                id="l4-sanctum-cp"
                chunkId={chunkId}
                position={[0, 3.2, -15.8]}
                spawnPos={[0, 3.55, -15.8]}
                label="Frozen Sanctum Gate"
              />

              <Fragment
                id="fragment-4"
                name="Echo of the Frost"
                position={[0, 5.3, -27.5]}
              />
            </>
          );

        default:
          return null;
      }
    },
    [
      beamTrace.segments,
      caveSteps,
      handleMirrorChange,
      mirrorsSolved,
      sanctumSteps,
    ],
  );

  return (
    <group name="level4-frozen-peaks">
      <SharedBiomeBackdrop levelId="level4" />
      <AuroraSkyCurtains />
      <SnowfallParticles />

      <ChunkManager
        levelId="level4"
        chunks={chunks}
        renderChunk={renderChunk}
        onStreamingPendingChange={(pending) => {
          useGameStore.getState().setStreamingPending(pending);
        }}
      />

      {/* Glacial Chasm Fall-Safety Fade Respawn */}
      <TriggerZone
        id="l4-fall-safety"
        position={[0, -5.5, 0]}
        halfExtents={[140, 2.0, 140]}
        onEnter={handleFallRespawn}
      />
    </group>
  );
}

export default Level4_FrozenPeaks;
