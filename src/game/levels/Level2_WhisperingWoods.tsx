import { useCallback, useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import {
  CuboidCollider,
  CylinderCollider,
  RigidBody,
  type RapierRigidBody,
} from '@react-three/rapier';
import * as THREE from 'three';
import {
  Chest,
  CrystalField,
  Fragment,
  Interactable,
} from '@/src/game/collectibles';
import {
  Door,
  Inscription,
  RotatingMechanism,
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
import { CheckpointBeacon } from './CheckpointBeacon';
import { ChunkManager } from './ChunkManager';
import {
  ChunkTerrainPatch,
  GlowHalo,
  SharedBiomeBackdrop,
} from './SharedBiomeEnvironment';
import { getCrystalsForChunk } from './levelTerrainFactory';
import {
  BRIDGE_WHEEL_IDS,
  BRIDGE_WHEEL_INITIAL_STEPS,
  LEVEL2_CHUNKS,
  areWheelsAligned,
  evaluateTotemSequence,
  getWoodsHeight,
  type TotemId,
} from './level2Config';

const _dummy = new THREE.Object3D();
const _quat = new THREE.Quaternion();
const _euler = new THREE.Euler();

function createSeededRng(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

/**
 * Giant ancient woodland trees + glowing bioluminescent mushrooms + animated fireflies.
 */
function WoodsForestProps({
  chunkId,
  minX,
  maxX,
  minZ,
  maxZ,
  seed,
}: {
  chunkId: string;
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
  seed: number;
}) {
  const activeTier = useGameStore((s) => s.activeQualityTier);
  const preset = getQualityPreset(activeTier);

  const trunkRef = useRef<THREE.InstancedMesh>(null);
  const boughLowerRef = useRef<THREE.InstancedMesh>(null);
  const boughUpperRef = useRef<THREE.InstancedMesh>(null);
  const mushroomCapRef = useRef<THREE.InstancedMesh>(null);
  const mushroomStemRef = useRef<THREE.InstancedMesh>(null);
  const fireflyRef = useRef<THREE.InstancedMesh>(null);

  const { trees, mushrooms, fireflies } = useMemo(() => {
    const rng = createSeededRng(seed);
    const treeList: Array<{ x: number; y: number; z: number; s: number; r: number }> = [];
    const mushList: Array<{ x: number; y: number; z: number; s: number }> = [];
    const flyList: Array<{
      bx: number;
      by: number;
      bz: number;
      phase: number;
      speed: number;
      radius: number;
    }> = [];

    const isClearLandmark = (x: number, z: number) => {
      // River channel & waterfall
      if (Math.abs(z + 1) < 5.5 && Math.abs(x) < 27) return true;
      // Spawn + center path + drawbridge corridor
      if (Math.abs(x) < 6.5 && z > -10 && z < 32) return true;
      // Rotating wheel plaza
      if (Math.hypot(x - 6.5, z - 6.8) < 5.5) return true;
      // South-East Fern Glade totem
      if (Math.hypot(x - 11, z - 18) < 4.5) return true;
      // West bridge & hollow
      if (Math.abs(x + 10.5) < 4.5 && z > -10 && z < 10) return true;
      if (Math.hypot(x + 19, z + 9.5) < 6.5) return true;
      // Hidden east alcove & grotto
      if (Math.hypot(x - 17, z - 10) < 4.8) return true;
      if (Math.abs(x - 19) < 3.6 && z > -10 && z < 10) return true;
      if (Math.hypot(x - 21, z + 14) < 6.5) return true;
      // North shrine plaza
      if (Math.abs(x) < 12.5 && z <= -8 && z >= -34) return true;
      return false;
    };

    const width = maxX - minX;
    const depth = maxZ - minZ;

    for (let i = 0; i < 160 && treeList.length < 18; i++) {
      const x = minX + 2 + rng() * Math.max(2, width - 4);
      const z = minZ + 2 + rng() * Math.max(2, depth - 4);
      if (isClearLandmark(x, z)) continue;
      const y = getWoodsHeight(x, z);
      if (y > 1.8 && y < 6.2) {
        treeList.push({
          x,
          y: y - 0.15,
          z,
          s: 1.05 + rng() * 0.55,
          r: rng() * Math.PI * 2,
        });
      }
    }

    for (let i = 0; i < 120 && mushList.length < 22; i++) {
      const x = minX + 2 + rng() * Math.max(2, width - 4);
      const z = minZ + 2 + rng() * Math.max(2, depth - 4);
      if (Math.abs(x) < 3.5 && z > -2 && z < 28) continue;
      const y = getWoodsHeight(x, z);
      if (y > 1.6 && y < 5.5) {
        mushList.push({
          x,
          y: y - 0.04,
          z,
          s: 0.7 + rng() * 0.65,
        });
      }
    }

    const flyTarget = preset.particleCap >= 48 ? 16 : 8;
    for (let i = 0; i < 60 && flyList.length < flyTarget; i++) {
      const x = minX + 3 + rng() * Math.max(2, width - 6);
      const z = minZ + 3 + rng() * Math.max(2, depth - 6);
      const y = getWoodsHeight(x, z);
      if (y > 0.5) {
        flyList.push({
          bx: x,
          by: y + 1.1 + rng() * 2.2,
          bz: z,
          phase: rng() * Math.PI * 2,
          speed: 0.9 + rng() * 0.8,
          radius: 0.7 + rng() * 1.1,
        });
      }
    }

    return { trees: treeList, mushrooms: mushList, fireflies: flyList };
  }, [minX, maxX, minZ, maxZ, seed, preset.particleCap]);

  const trunkGeo = useCachedGeometry('woods-giant-trunk', () => {
    const g = new THREE.CylinderGeometry(0.36, 0.68, 7.6, 8);
    g.translate(0, 3.8, 0);
    g.computeBoundingSphere();
    return g;
  });
  const boughLowerGeo = useCachedGeometry('woods-bough-lower', () => {
    const g = new THREE.ConeGeometry(3.4, 3.6, 7);
    g.translate(0, 5.8, 0);
    g.computeBoundingSphere();
    return g;
  });
  const boughUpperGeo = useCachedGeometry('woods-bough-upper', () => {
    const g = new THREE.ConeGeometry(2.45, 3.6, 7);
    g.translate(0, 8.6, 0);
    g.computeBoundingSphere();
    return g;
  });
  const mushCapGeo = useCachedGeometry('woods-mush-cap-dome', () => {
    const g = new THREE.SphereGeometry(0.34, 10, 6, 0, Math.PI * 2, 0, Math.PI * 0.56);
    g.translate(0, 0.25, 0);
    g.computeBoundingSphere();
    return g;
  });
  const mushStemGeo = useCachedGeometry('woods-mush-stem', () => {
    const g = new THREE.CylinderGeometry(0.07, 0.1, 0.28, 6);
    g.translate(0, 0.14, 0);
    g.computeBoundingSphere();
    return g;
  });
  const fireflyGeo = useCachedGeometry('woods-firefly-dot', () => {
    const g = new THREE.OctahedronGeometry(0.08, 0);
    g.computeBoundingSphere();
    return g;
  });

  const trunkMat = useCachedMaterial(
    `woods-trunk-mat-${preset.materialMode}`,
    () =>
      new THREE.MeshStandardMaterial({
        color: '#3b2619',
        roughness: 0.92,
      }),
  );
  const boughMat = useCachedMaterial(
    `woods-bough-mat-${preset.materialMode}`,
    () =>
      new THREE.MeshStandardMaterial({
        color: '#16472d',
        roughness: 0.85,
      }),
  );
  const mushCapMat = useCachedMaterial('woods-mush-cap-mat', () =>
    new THREE.MeshStandardMaterial({
      color: '#14b8a6',
      emissive: '#0f766e',
      emissiveIntensity: 0.58,
      roughness: 0.38,
    }),
  );
  const mushStemMat = useCachedMaterial('woods-mush-stem-mat', () =>
    new THREE.MeshStandardMaterial({
      color: '#4c6e58',
      roughness: 0.78,
    }),
  );
  const fireflyMat = useCachedMaterial('woods-firefly-mat', () =>
    new THREE.MeshBasicMaterial({
      color: '#bef264',
    }),
  );

  useEffect(() => {
    if (trunkRef.current && boughLowerRef.current && boughUpperRef.current) {
      trees.forEach((tr, i) => {
        _dummy.position.set(tr.x, tr.y, tr.z);
        _dummy.rotation.set(0, tr.r, 0);
        _dummy.scale.setScalar(tr.s);
        _dummy.updateMatrix();
        trunkRef.current!.setMatrixAt(i, _dummy.matrix);
        boughLowerRef.current!.setMatrixAt(i, _dummy.matrix);
        boughUpperRef.current!.setMatrixAt(i, _dummy.matrix);
      });
      trunkRef.current.instanceMatrix.needsUpdate = true;
      boughLowerRef.current.instanceMatrix.needsUpdate = true;
      boughUpperRef.current.instanceMatrix.needsUpdate = true;
    }

    if (mushroomCapRef.current && mushroomStemRef.current) {
      mushrooms.forEach((m, i) => {
        _dummy.position.set(m.x, m.y, m.z);
        _dummy.rotation.set(0, i * 1.1, 0);
        _dummy.scale.setScalar(m.s);
        _dummy.updateMatrix();
        mushroomCapRef.current!.setMatrixAt(i, _dummy.matrix);
        mushroomStemRef.current!.setMatrixAt(i, _dummy.matrix);
      });
      mushroomCapRef.current.instanceMatrix.needsUpdate = true;
      mushroomStemRef.current.instanceMatrix.needsUpdate = true;
    }
  }, [trees, mushrooms]);

  useFrame((state) => {
    const fMesh = fireflyRef.current;
    if (!fMesh || fireflies.length === 0) return;
    const t = state.clock.elapsedTime;
    for (let i = 0; i < fireflies.length; i++) {
      const f = fireflies[i];
      const angle = t * f.speed + f.phase;
      _dummy.position.set(
        f.bx + Math.cos(angle) * f.radius,
        f.by + Math.sin(angle * 1.6) * 0.45,
        f.bz + Math.sin(angle) * f.radius,
      );
      const pulse = 0.75 + 0.5 * Math.sin(t * 3.5 + f.phase);
      _dummy.scale.setScalar(pulse);
      _dummy.updateMatrix();
      fMesh.setMatrixAt(i, _dummy.matrix);
    }
    fMesh.instanceMatrix.needsUpdate = true;
  });

  return (
    <group>
      {trees.length > 0 && (
        <>
          <instancedMesh
            ref={trunkRef}
            args={[trunkGeo, trunkMat, trees.length]}
            castShadow={preset.shadowsEnabled}
            receiveShadow={preset.shadowsEnabled}
          />
          <instancedMesh
            ref={boughLowerRef}
            args={[boughLowerGeo, boughMat, trees.length]}
            castShadow={false}
          />
          <instancedMesh
            ref={boughUpperRef}
            args={[boughUpperGeo, boughMat, trees.length]}
            castShadow={false}
          />
          <RigidBody type="fixed" colliders={false}>
            {trees.map((tr, i) => (
              <CylinderCollider
                key={`wt-${chunkId}-${i}`}
                args={[3.5 * tr.s, 0.5 * tr.s]}
                position={[tr.x, tr.y + 3.5 * tr.s, tr.z]}
              />
            ))}
          </RigidBody>
        </>
      )}

      {mushrooms.length > 0 && (
        <>
          <instancedMesh
            ref={mushroomCapRef}
            args={[mushCapGeo, mushCapMat, mushrooms.length]}
          />
          <instancedMesh
            ref={mushroomStemRef}
            args={[mushStemGeo, mushStemMat, mushrooms.length]}
          />
        </>
      )}

      {fireflies.length > 0 && (
        <instancedMesh
          ref={fireflyRef}
          args={[fireflyGeo, fireflyMat, fireflies.length]}
        />
      )}
    </group>
  );
}

/**
 * Translucent additive light shafts piercing the forest canopy.
 */
function ForestLightShafts({
  positions,
}: {
  positions: Array<[number, number, number]>;
}) {
  const shaftGeo = useCachedGeometry('woods-light-shaft-cone', () => {
    const g = new THREE.ConeGeometry(3.6, 15, 10, 1, true);
    g.computeBoundingSphere();
    return g;
  });
  const shaftMat = useCachedMaterial('woods-light-shaft-mat', () =>
    new THREE.MeshBasicMaterial({
      color: '#a7f3d0',
      transparent: true,
      opacity: 0.055,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      side: THREE.DoubleSide,
    }),
  );

  return (
    <group>
      {positions.map((pos, idx) => (
        <mesh
          key={`shaft-${idx}`}
          geometry={shaftGeo}
          material={shaftMat}
          position={[pos[0], pos[1] + 1.8, pos[2]]}
          rotation={[0.14, 0, -0.18]}
        />
      ))}
    </group>
  );
}

/**
 * Animated river water band & cliff waterfalls with cascading foam streaks.
 */
function AnimatedRiverAndFalls() {
  const fallsWestRef = useRef<THREE.Mesh>(null);
  const fallsEastRef = useRef<THREE.Mesh>(null);
  const foamRingRef = useRef<THREE.Mesh>(null);

  useFrame((state) => {
    const t = state.clock.elapsedTime;
    if (fallsWestRef.current) {
      fallsWestRef.current.position.y = 3.2 - ((t * 2.2) % 0.8) * 0.25;
      const mat = fallsWestRef.current.material as THREE.MeshStandardMaterial;
      mat.emissiveIntensity = 0.45 + Math.sin(t * 5) * 0.12;
    }
    if (fallsEastRef.current) {
      fallsEastRef.current.position.y = 0.2 - ((t * 2.4) % 0.8) * 0.2;
    }
    if (foamRingRef.current) {
      const s = 1 + Math.sin(t * 3.8) * 0.14;
      foamRingRef.current.scale.set(s, 1, s);
    }
  });

  return (
    <group>
      {/* Flowing River Surface along z = -1 */}
      <mesh position={[2, 0.26, -1]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[48, 6.2]} />
        <meshStandardMaterial
          color="#137a73"
          emissive="#0d4f4b"
          emissiveIntensity={0.28}
          roughness={0.18}
          transparent
          opacity={0.85}
        />
      </mesh>

      {/* Western Upper Waterfall Rock Lip & Cascade */}
      <RigidBody type="fixed" position={[-22.5, 2.8, -1]} colliders="cuboid">
        <mesh castShadow receiveShadow>
          <boxGeometry args={[4.5, 5.8, 7.6]} />
          <meshStandardMaterial color="#3c4f46" roughness={0.92} />
        </mesh>
      </RigidBody>
      <mesh
        ref={fallsWestRef}
        position={[-19.8, 3.0, -1]}
        rotation={[0, Math.PI / 2, 0.14]}
      >
        <planeGeometry args={[4.2, 6.2]} />
        <meshStandardMaterial
          color="#5eead4"
          emissive="#2dd4bf"
          emissiveIntensity={0.5}
          transparent
          opacity={0.78}
          side={THREE.DoubleSide}
        />
      </mesh>
      <mesh ref={foamRingRef} position={[-18.8, 0.34, -1]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[0.9, 2.5, 16]} />
        <meshBasicMaterial color="#ccfbf1" transparent opacity={0.55} />
      </mesh>
      <GlowHalo position={[-19.2, 1.4, -1]} color="#5eead4" scale={4.2} />

      {/* Eastern Plunge Waterfall */}
      <mesh
        ref={fallsEastRef}
        position={[25.8, 0.0, -1]}
        rotation={[0, -Math.PI / 2, 0.12]}
      >
        <planeGeometry args={[4.6, 3.8]} />
        <meshStandardMaterial
          color="#5eead4"
          emissive="#14b8a6"
          emissiveIntensity={0.45}
          transparent
          opacity={0.74}
          side={THREE.DoubleSide}
        />
      </mesh>
    </group>
  );
}

/**
 * Forest Spirit Totem activated in strict sequence (Roots -> Wings -> Antlers).
 */
function ForestSpiritTotem({
  id,
  label,
  crestKind,
  position,
  rotationY = 0,
  onAwaken,
}: {
  id: TotemId;
  label: string;
  crestKind: 'roots' | 'wings' | 'antlers';
  position: [number, number, number];
  rotationY?: number;
  onAwaken: (totemId: TotemId) => void;
}) {
  const active = useGameStore((s) => Boolean(s.activatedIds[id]));
  const solved = useGameStore((s) => Boolean(s.activatedIds['l2-totems-solved']));
  const crestRef = useRef<THREE.Group>(null);

  useFrame((state, rawDt) => {
    const dt = Math.min(rawDt, 0.05);
    if (crestRef.current) {
      crestRef.current.rotation.y += dt * (active ? 1.8 : 0.35);
      crestRef.current.position.y =
        2.35 + Math.sin(state.clock.elapsedTime * 2.4) * (active ? 0.1 : 0.03);
    }
  });

  const crestColor = active ? '#34d399' : '#f59e0b';
  const crestEmissive = active ? '#10b981' : '#78350f';

  return (
    <group position={position} rotation={[0, rotationY, 0]}>
      <Interactable
        id={id}
        prompt={
          solved || active
            ? `${label} Spirit Awakened`
            : `Awaken ${label} Spirit Totem`
        }
        actionLabel={solved || active ? 'Awakened' : 'Awaken'}
        informationalOnly={solved || active}
        radius={2.5}
        disabled={solved || active}
        onInteract={() => onAwaken(id)}
      >
        <RigidBody type="fixed" colliders={false}>
          <CuboidCollider args={[0.55, 1.35, 0.55]} position={[0, 1.35, 0]} />
          {/* Totem Stone Base */}
          <mesh castShadow receiveShadow position={[0, 0.35, 0]}>
            <cylinderGeometry args={[0.72, 0.88, 0.7, 8]} />
            <meshStandardMaterial color="#4c5c52" roughness={0.88} />
          </mesh>
          {/* Carved Timber Pillar */}
          <mesh castShadow receiveShadow position={[0, 1.35, 0]}>
            <cylinderGeometry args={[0.38, 0.44, 1.5, 8]} />
            <meshStandardMaterial color="#573c28" roughness={0.85} />
          </mesh>
          {/* Glowing Rune Ring */}
          <mesh position={[0, 1.65, 0]}>
            <cylinderGeometry args={[0.42, 0.42, 0.14, 10]} />
            <meshStandardMaterial
              color={crestColor}
              emissive={crestEmissive}
              emissiveIntensity={active ? 1.4 : 0.4}
            />
          </mesh>
        </RigidBody>

        {/* Distinct Silhouette Crest per Spirit */}
        <group ref={crestRef} position={[0, 2.35, 0]}>
          {crestKind === 'roots' && (
            <>
              <mesh castShadow>
                <coneGeometry args={[0.38, 0.72, 5]} />
                <meshStandardMaterial
                  color={crestColor}
                  emissive={crestEmissive}
                  emissiveIntensity={active ? 1.5 : 0.45}
                />
              </mesh>
              <mesh position={[-0.25, -0.1, 0]} rotation={[0, 0, 0.55]}>
                <boxGeometry args={[0.14, 0.48, 0.14]} />
                <meshStandardMaterial
                  color={crestColor}
                  emissive={crestEmissive}
                  emissiveIntensity={active ? 1.2 : 0.35}
                />
              </mesh>
              <mesh position={[0.25, -0.1, 0]} rotation={[0, 0, -0.55]}>
                <boxGeometry args={[0.14, 0.48, 0.14]} />
                <meshStandardMaterial
                  color={crestColor}
                  emissive={crestEmissive}
                  emissiveIntensity={active ? 1.2 : 0.35}
                />
              </mesh>
            </>
          )}
          {crestKind === 'wings' && (
            <>
              <mesh castShadow>
                <octahedronGeometry args={[0.28, 0]} />
                <meshStandardMaterial
                  color={crestColor}
                  emissive={crestEmissive}
                  emissiveIntensity={active ? 1.5 : 0.45}
                />
              </mesh>
              <mesh position={[-0.42, 0.08, 0]} rotation={[0, 0, 0.38]}>
                <boxGeometry args={[0.68, 0.16, 0.12]} />
                <meshStandardMaterial
                  color={crestColor}
                  emissive={crestEmissive}
                  emissiveIntensity={active ? 1.3 : 0.35}
                />
              </mesh>
              <mesh position={[0.42, 0.08, 0]} rotation={[0, 0, -0.38]}>
                <boxGeometry args={[0.68, 0.16, 0.12]} />
                <meshStandardMaterial
                  color={crestColor}
                  emissive={crestEmissive}
                  emissiveIntensity={active ? 1.3 : 0.35}
                />
              </mesh>
            </>
          )}
          {crestKind === 'antlers' && (
            <>
              <mesh castShadow>
                <dodecahedronGeometry args={[0.26, 0]} />
                <meshStandardMaterial
                  color={crestColor}
                  emissive={crestEmissive}
                  emissiveIntensity={active ? 1.5 : 0.45}
                />
              </mesh>
              <mesh position={[-0.28, 0.3, 0]} rotation={[0, 0, 0.42]}>
                <cylinderGeometry args={[0.05, 0.07, 0.65, 6]} />
                <meshStandardMaterial
                  color={crestColor}
                  emissive={crestEmissive}
                  emissiveIntensity={active ? 1.3 : 0.35}
                />
              </mesh>
              <mesh position={[0.28, 0.3, 0]} rotation={[0, 0, -0.42]}>
                <cylinderGeometry args={[0.05, 0.07, 0.65, 6]} />
                <meshStandardMaterial
                  color={crestColor}
                  emissive={crestEmissive}
                  emissiveIntensity={active ? 1.3 : 0.35}
                />
              </mesh>
            </>
          )}
        </group>

        {active && <GlowHalo position={[0, 2.4, 0]} color="#34d399" scale={2.8} />}
      </Interactable>
    </group>
  );
}

/**
 * Counterweight Timber & Stone Drawbridge that lowers smoothly when all 3 river wheels align.
 */
function CounterweightDrawbridge({ solved }: { solved: boolean }) {
  const pivotBodyRef = useRef<RapierRigidBody>(null);
  const angleRef = useRef(solved ? 0 : 0.92);

  useFrame((_, rawDt) => {
    const dt = Math.min(rawDt, 0.05);
    const target = solved ? 0 : 0.92;
    angleRef.current = THREE.MathUtils.lerp(
      angleRef.current,
      target,
      1 - Math.exp(-3.6 * dt),
    );
    if (pivotBodyRef.current) {
      _euler.set(angleRef.current, 0, 0);
      _quat.setFromEuler(_euler);
      pivotBodyRef.current.setNextKinematicRotation(_quat);
    }
  });

  // Hinged at south bank [0, 3.2, 4.0], extending -9.8m north across the river to z = -5.8
  return (
    <group>
      {/* Stone Bridge Abutment Pillars & Arch Lintel */}
      <RigidBody type="fixed" colliders="cuboid">
        <mesh castShadow receiveShadow position={[-2.6, 4.6, 4.0]}>
          <boxGeometry args={[0.95, 3.6, 0.95]} />
          <meshStandardMaterial color="#3d4b42" roughness={0.88} />
        </mesh>
        <mesh castShadow receiveShadow position={[2.6, 4.6, 4.0]}>
          <boxGeometry args={[0.95, 3.6, 0.95]} />
          <meshStandardMaterial color="#3d4b42" roughness={0.88} />
        </mesh>
        <mesh castShadow receiveShadow position={[0, 6.45, 4.0]}>
          <boxGeometry args={[6.4, 0.7, 1.05]} />
          <meshStandardMaterial color="#48594e" roughness={0.86} />
        </mesh>
      </RigidBody>

      <RigidBody
        ref={pivotBodyRef}
        type="kinematicPosition"
        position={[0, 3.22, 4.0]}
        colliders={false}
      >
        <CuboidCollider args={[2.1, 0.22, 4.9]} position={[0, -0.1, -4.9]} />
        <mesh castShadow receiveShadow position={[0, -0.1, -4.9]}>
          <boxGeometry args={[4.2, 0.36, 9.8]} />
          <meshStandardMaterial color="#573c26" roughness={0.86} />
        </mesh>
        {/* Cross planks & side rails */}
        {[-1.5, -3.5, -5.5, -7.5, -9.2].map((zOff, i) => (
          <mesh key={`db-plank-${i}`} position={[0, 0.1, zOff]}>
            <boxGeometry args={[4.3, 0.08, 0.45]} />
            <meshStandardMaterial color="#422b1a" roughness={0.9} />
          </mesh>
        ))}
        <mesh position={[-2.0, 0.45, -4.9]}>
          <boxGeometry args={[0.16, 0.65, 9.8]} />
          <meshStandardMaterial color="#3d2818" roughness={0.88} />
        </mesh>
        <mesh position={[2.0, 0.45, -4.9]}>
          <boxGeometry args={[0.16, 0.65, 9.8]} />
          <meshStandardMaterial color="#3d2818" roughness={0.88} />
        </mesh>
        <mesh position={[0, 0.12, -4.9]}>
          <boxGeometry args={[0.3, 0.08, 9.2]} />
          <meshStandardMaterial
            color={solved ? '#34d399' : '#f59e0b'}
            emissive={solved ? '#10b981' : '#78350f'}
            emissiveIntensity={solved ? 1.1 : 0.45}
          />
        </mesh>
      </RigidBody>
    </group>
  );
}

/**
 * Hidden path revealed by East Bank switch: lowers briar stone barrier & raises moss stepping bridge.
 */
function HiddenGrottoPath({ revealed }: { revealed: boolean }) {
  const bridgeRef = useRef<RapierRigidBody>(null);
  const barrierRef = useRef<RapierRigidBody>(null);
  const progressRef = useRef(revealed ? 1 : 0);

  useFrame((_, rawDt) => {
    const dt = Math.min(rawDt, 0.05);
    progressRef.current = THREE.MathUtils.lerp(
      progressRef.current,
      revealed ? 1 : 0,
      1 - Math.exp(-4.0 * dt),
    );
    const p = progressRef.current;

    if (bridgeRef.current) {
      bridgeRef.current.setNextKinematicTranslation({
        x: 19.2,
        y: -0.6 + p * 3.88,
        z: -1.5,
      });
    }
    if (barrierRef.current) {
      barrierRef.current.setNextKinematicTranslation({
        x: 19.0,
        y: 4.3 - p * 4.5,
        z: 5.5,
      });
    }
  });

  return (
    <group>
      {/* Hidden Moss Bridge rising across east tributary */}
      <RigidBody
        ref={bridgeRef}
        type="kinematicPosition"
        position={[19.2, revealed ? 3.28 : -0.6, -1.5]}
        colliders={false}
      >
        <CuboidCollider args={[1.9, 0.25, 6.2]} />
        <mesh castShadow receiveShadow>
          <boxGeometry args={[3.8, 0.5, 12.4]} />
          <meshStandardMaterial color="#42694c" roughness={0.86} />
        </mesh>
        <mesh position={[0, 0.28, 0]}>
          <boxGeometry args={[0.45, 0.06, 11.8]} />
          <meshStandardMaterial
            color="#2dd4bf"
            emissive="#0d9488"
            emissiveIntensity={revealed ? 0.9 : 0.1}
          />
        </mesh>
      </RigidBody>

      {/* Briar-draped stone barrier sealing path until switch is pulled */}
      <RigidBody
        ref={barrierRef}
        type="kinematicPosition"
        position={[19.0, revealed ? -0.2 : 4.3, 5.5]}
        colliders={false}
      >
        <CuboidCollider args={[2.6, 1.8, 0.8]} />
        <mesh castShadow receiveShadow>
          <boxGeometry args={[5.2, 3.6, 1.6]} />
          <meshStandardMaterial color="#2f4a37" roughness={0.94} />
        </mesh>
      </RigidBody>
    </group>
  );
}

export function Level2_WhisperingWoods() {
  const chunks = useMemo(() => LEVEL2_CHUNKS.map((s) => s.chunk), []);
  const bridgeSolved = useGameStore((s) =>
    Boolean(s.activatedIds['l2-bridge-solved']),
  );
  const hiddenPathRevealed = useGameStore((s) =>
    Boolean(s.activatedIds['l2-hidden-path-switch']),
  );

  // Sync hidden path quest objective when switch activates
  useEffect(() => {
    if (hiddenPathRevealed) {
      useGameStore
        .getState()
        .reportQuestObjective('l2-obj-hidden-path', 1, 'level2');
    }
  }, [hiddenPathRevealed]);

  useEffect(() => {
    const store = useGameStore.getState();
    if (store.screen === 'playing' && store.levelElapsedSeconds < 2) {
      store.showToast(
        'Entered Whispering Woods · Consult the crossroads stone and awaken the 3 spirit totems',
      );
    }
  }, []);

  const handleTotemAwaken = useCallback((totemId: TotemId) => {
    const store = useGameStore.getState();
    const currentStep =
      store.getWorldObjectState('l2-totem-seq', 'level2')?.phase ?? 0;
    const result = evaluateTotemSequence(currentStep, totemId);

    for (const [key, val] of Object.entries(result.activatedIdsPatch)) {
      store.setActivated(key, val);
    }
    store.setWorldObjectState(
      'l2-totem-seq',
      {
        phase: result.nextStep,
        solved: result.solved,
      },
      'level2',
    );
    store.reportQuestObjective('l2-obj-totems', result.nextStep, 'level2');

    if (result.resetTriggered) {
      playPooledSynth('switch');
      store.showToast(
        'Wrong spirit order! All totems slumber again — check the Crossroads Inscription.',
      );
    } else if (result.solved) {
      playPooledSynth('door');
      store.showToast(
        'All 3 Spirit Totems harmonized! The Ruined Shrine Gate opens!',
        'objective',
      );
    } else {
      playPooledSynth('crystal');
      store.showToast(
        `Spirit Totem awakened (${result.nextStep}/3)`,
        'info',
      );
    }
  }, []);

  const handleWheelChange = useCallback(() => {
    const store = useGameStore.getState();
    if (store.activatedIds['l2-bridge-solved']) return;
    const steps = BRIDGE_WHEEL_IDS.map((wid, idx) => {
      const saved = store.getWorldObjectState(wid, 'level2')?.phase;
      return typeof saved === 'number'
        ? saved
        : BRIDGE_WHEEL_INITIAL_STEPS[idx];
    });
    if (areWheelsAligned(steps)) {
      store.setActivated('l2-bridge-solved', true);
      store.setWorldObjectState('l2-bridge-solved', { solved: true }, 'level2');
      store.reportQuestObjective('l2-obj-bridge', 1, 'level2');
      playPooledSynth('door');
      store.showToast(
        'Counterweight aligned! The river drawbridge lowers!',
        'objective',
      );
    }
  }, []);

  const handleDeepWaterRespawn = useCallback(() => {
    const store = useGameStore.getState();
    store.showToast('Swept back by the rapids — returned to checkpoint');
    eventBus.emit('player:respawn', { position: store.checkpointPos });
  }, []);

  const shrineSteps = useMemo(() => {
    const count = 5;
    const startZ = -6.0;
    const depth = 0.9;
    return Array.from({ length: count }, (_, i) => {
      const h = 3.25 + ((4.0 - 3.25) * (i + 1)) / count;
      return {
        id: `l2-shrine-step-${i}`,
        position: [0, h / 2, startZ - i * depth] as [number, number, number],
        size: [5.2, h, depth] as [number, number, number],
      };
    });
  }, []);

  const renderChunk = useCallback(
    (chunkId: string) => {
      const spec = LEVEL2_CHUNKS.find((s) => s.chunk.id === chunkId);
      if (!spec) return null;
      const chunkCrystals = getCrystalsForChunk('level2', spec.patch);

      switch (chunkId) {
        case 'l2-south-glade':
          return (
            <>
              <ChunkTerrainPatch
                levelId="level2"
                chunkId={chunkId}
                patch={spec.patch}
              />
              <WoodsForestProps
                chunkId={chunkId}
                minX={spec.patch.minX}
                maxX={spec.patch.maxX}
                minZ={0}
                maxZ={34}
                seed={2101}
              />
              <ForestLightShafts
                positions={[
                  [-3, 9, 20],
                  [4, 9, 13],
                  [10, 9, 17],
                ]}
              />
              <CrystalField crystals={chunkCrystals} color="#2dd4bf" />

              {/* Lore & Order Hint Inscription */}
              <Inscription
                id="l2-inscription-order"
                position={[-3.2, getWoodsHeight(-3.2, 15.5), 15.5]}
                rotationY={0.3}
                title="Chronicle of the Three Forest Spirits"
                body="Before the island's energy vanished, the wood-keepers sang in strict harmony: First awaken the ROOTS Totem in the southeast fern glade, second the WINGS Totem across the western waterfall hollow, and third the ANTLERS Totem by the northern ruined arch."
              />

              {/* Spirit Totem 1: Roots (South-East Glade) */}
              <ForestSpiritTotem
                id="totem-roots"
                label="Roots"
                crestKind="roots"
                position={[11, getWoodsHeight(11, 18), 18]}
                rotationY={-0.5}
                onAwaken={handleTotemAwaken}
              />

              {/* Rotating Mechanism Puzzle: 3 River Wheels lowering Drawbridge */}
              <Inscription
                id="l2-inscription-winch"
                position={[3.6, getWoodsHeight(3.6, 8.2), 8.2]}
                rotationY={-0.25}
                title="Bridge Counterweight Edict"
                body="To lower the drawbridge across the rushing gorge, turn all three timber runewheels until their glowing jade pointers face North toward the Ruined Shrine."
              />
              {BRIDGE_WHEEL_IDS.map((wid, idx) => {
                const wx = 5.4 + idx * 2.1;
                const wz = 6.8;
                return (
                  <RotatingMechanism
                    key={wid}
                    id={wid}
                    chunkId={chunkId}
                    label={`River Wheel ${idx + 1}`}
                    position={[wx, getWoodsHeight(wx, wz), wz]}
                    initialStep={BRIDGE_WHEEL_INITIAL_STEPS[idx]}
                    targetStep={0}
                    variant="wheel"
                    accentColor="#34d399"
                    locked={bridgeSolved}
                    onStepChange={handleWheelChange}
                  />
                );
              })}

              {/* Lowerable Counterweight Drawbridge */}
              <CounterweightDrawbridge solved={bridgeSolved} />

              <CheckpointBeacon
                id="l2-south-river"
                chunkId={chunkId}
                position={[0, getWoodsHeight(0, 9.5), 9.5]}
                spawnPos={[0, getWoodsHeight(0, 9.5) + 0.35, 9.5]}
                label="Riverbank Crossroads"
              />
            </>
          );

        case 'l2-west-falls':
          return (
            <>
              <ChunkTerrainPatch
                levelId="level2"
                chunkId={chunkId}
                patch={spec.patch}
              />
              <WoodsForestProps
                chunkId={chunkId}
                minX={-34}
                maxX={-13}
                minZ={-26}
                maxZ={24}
                seed={2202}
              />
              <ForestLightShafts
                positions={[
                  [-18, 9.5, -8],
                  [-16, 9, 5],
                ]}
              />
              <CrystalField crystals={chunkCrystals} color="#2dd4bf" />

              {/* Permanent Western Timber Footbridge across the gorge */}
              <RigidBody type="fixed" colliders="cuboid" friction={0.95}>
                <mesh castShadow receiveShadow position={[-10.5, 3.1, -1.0]}>
                  <boxGeometry args={[3.6, 0.34, 11.4]} />
                  <meshStandardMaterial color="#6b472b" roughness={0.85} />
                </mesh>
                <mesh castShadow position={[-12.1, 3.65, -1.0]}>
                  <boxGeometry args={[0.18, 0.85, 11.4]} />
                  <meshStandardMaterial color="#4a301d" roughness={0.88} />
                </mesh>
                <mesh castShadow position={[-8.9, 3.65, -1.0]}>
                  <boxGeometry args={[0.18, 0.85, 11.4]} />
                  <meshStandardMaterial color="#4a301d" roughness={0.88} />
                </mesh>
              </RigidBody>

              {/* Spirit Totem 2: Wings (Western Waterfall Hollow) */}
              <ForestSpiritTotem
                id="totem-wings"
                label="Wings"
                crestKind="wings"
                position={[-19, getWoodsHeight(-19, -9.5), -9.5]}
                rotationY={0.65}
                onAwaken={handleTotemAwaken}
              />

              <CheckpointBeacon
                id="l2-west-hollow"
                chunkId={chunkId}
                position={[-15.5, getWoodsHeight(-15.5, -7), -7]}
                spawnPos={[-15.5, getWoodsHeight(-15.5, -7) + 0.35, -7]}
                label="Waterfall Hollow"
              />
            </>
          );

        case 'l2-east-grotto':
          return (
            <>
              <ChunkTerrainPatch
                levelId="level2"
                chunkId={chunkId}
                patch={spec.patch}
              />
              <WoodsForestProps
                chunkId={chunkId}
                minX={15}
                maxX={34}
                minZ={-26}
                maxZ={24}
                seed={2303}
              />
              <ForestLightShafts positions={[[21, 9, -14]]} />
              <CrystalField crystals={chunkCrystals} color="#2dd4bf" />

              {/* Hidden Path Switch tucked inside South-East Alcove */}
              <Switch
                id="l2-hidden-path-switch"
                label="Moss Grotto Mechanism"
                position={[17, getWoodsHeight(17, 10), 10]}
                rotationY={-0.6}
                oneShot
              />

              <HiddenGrottoPath revealed={hiddenPathRevealed} />

              {/* Secret Grotto Arch & Lore Stone + Chest 1 */}
              <RigidBody type="fixed" colliders="cuboid">
                <mesh castShadow receiveShadow position={[17.2, 5.1, -14.5]}>
                  <boxGeometry args={[1.4, 3.2, 1.4]} />
                  <meshStandardMaterial color="#4c5d52" roughness={0.9} />
                </mesh>
                <mesh castShadow receiveShadow position={[24.8, 5.1, -14.5]}>
                  <boxGeometry args={[1.4, 3.2, 1.4]} />
                  <meshStandardMaterial color="#4c5d52" roughness={0.9} />
                </mesh>
                <mesh castShadow receiveShadow position={[21.0, 6.9, -14.5]}>
                  <boxGeometry args={[9.2, 1.0, 1.6]} />
                  <meshStandardMaterial color="#586a5e" roughness={0.88} />
                </mesh>
              </RigidBody>

              <Inscription
                id="l2-inscription-grotto"
                position={[18.2, getWoodsHeight(18.2, -11.5), -11.5]}
                rotationY={0.4}
                title="Hymn of the Wood-Keepers"
                body="When the heart-crystal dimmed, we sealed our grove relics behind living briars so scavengers could not strip the roots. Only those who listen to the forest path may claim them."
              />

              <Chest
                id="chest-woods"
                position={[21.5, getWoodsHeight(21.5, -15.5), -15.5]}
                rotationY={0.15}
                rewardItem="Gale Chime Relic"
              />
            </>
          );

        case 'l2-north-shrine':
          return (
            <>
              <ChunkTerrainPatch
                levelId="level2"
                chunkId={chunkId}
                patch={spec.patch}
              />
              <WoodsForestProps
                chunkId={chunkId}
                minX={-13}
                maxX={13}
                minZ={-36}
                maxZ={-8}
                seed={2404}
              />
              <ForestLightShafts
                positions={[
                  [-5, 10, -16],
                  [0, 11, -27],
                ]}
              />
              <CrystalField crystals={chunkCrystals} color="#2dd4bf" />

              {/* Shrine Plaza Stone Floor & Steps */}
              <RigidBody type="fixed" colliders="cuboid" friction={0.95}>
                <mesh receiveShadow position={[0, 3.5, -21]}>
                  <boxGeometry args={[20, 1.0, 22]} />
                  <meshStandardMaterial color="#506356" roughness={0.88} />
                </mesh>
              </RigidBody>

              {shrineSteps.map((st) => (
                <RigidBody
                  key={st.id}
                  type="fixed"
                  position={st.position}
                  colliders="cuboid"
                >
                  <mesh castShadow receiveShadow>
                    <boxGeometry args={st.size} />
                    <meshStandardMaterial color="#5c7062" roughness={0.86} />
                  </mesh>
                </RigidBody>
              ))}

              {/* Ruined Shrine Columns & Walls */}
              <RigidBody type="fixed" colliders="cuboid">
                {[
                  [-6.5, 5.8, -14, 3.6],
                  [6.5, 5.8, -14, 3.2],
                  [-6.5, 6.2, -19, 4.4],
                  [6.5, 6.2, -19, 4.4],
                ].map(([cx, cy, cz, ch], idx) => (
                  <mesh key={`l2-col-${idx}`} castShadow receiveShadow position={[cx, cy, cz]}>
                    <cylinderGeometry args={[0.52, 0.6, ch, 8]} />
                    <meshStandardMaterial color="#485a4e" roughness={0.9} />
                  </mesh>
                ))}

                {/* Sanctum Chamber Enclosure around Fragment 2 */}
                <mesh castShadow receiveShadow position={[-5.4, 6.3, -21.5]}>
                  <boxGeometry args={[6.2, 4.6, 1.2]} />
                  <meshStandardMaterial color="#425448" roughness={0.9} />
                </mesh>
                <mesh castShadow receiveShadow position={[5.4, 6.3, -21.5]}>
                  <boxGeometry args={[6.2, 4.6, 1.2]} />
                  <meshStandardMaterial color="#425448" roughness={0.9} />
                </mesh>
                <mesh castShadow receiveShadow position={[-8.0, 6.3, -26.5]}>
                  <boxGeometry args={[1.2, 4.6, 11.2]} />
                  <meshStandardMaterial color="#425448" roughness={0.9} />
                </mesh>
                <mesh castShadow receiveShadow position={[8.0, 6.3, -26.5]}>
                  <boxGeometry args={[1.2, 4.6, 11.2]} />
                  <meshStandardMaterial color="#425448" roughness={0.9} />
                </mesh>
                <mesh castShadow receiveShadow position={[0, 6.3, -31.5]}>
                  <boxGeometry args={[17.2, 4.6, 1.2]} />
                  <meshStandardMaterial color="#425448" roughness={0.9} />
                </mesh>
                {/* Pedestal */}
                <mesh castShadow receiveShadow position={[0, 4.5, -28.0]}>
                  <boxGeometry args={[2.4, 1.0, 2.4]} />
                  <meshStandardMaterial color="#627869" roughness={0.82} />
                </mesh>
              </RigidBody>

              {/* Spirit Totem 3: Antlers (Northern Shrine Arch) */}
              <ForestSpiritTotem
                id="totem-antlers"
                label="Antlers"
                crestKind="antlers"
                position={[-7.5, 4.0, -16.5]}
                rotationY={0.35}
                onAwaken={handleTotemAwaken}
              />

              <Inscription
                id="l2-inscription-shrine"
                position={[4.6, 4.0, -15.5]}
                rotationY={-0.3}
                title="Why the Woods Fell Silent"
                body="The Echo of the Gale once linked every island valley through living wind-currents. When the deep Spire ruptured, the wind died—leaving only whispered echoes trapped inside the timber."
              />

              <CheckpointBeacon
                id="l2-north-shrine"
                chunkId={chunkId}
                position={[0, 4.0, -11.8]}
                spawnPos={[0, 4.35, -11.8]}
                label="Ruined Woodland Shrine"
              />

              <Door
                id="l2-door-shrine"
                position={[0, 4.0, -21.5]}
                width={4.4}
                height={4.2}
                requiredIds={['l2-totems-solved']}
              />

              <Fragment
                id="fragment-2"
                name="Echo of the Gale"
                position={[0, 6.1, -28.0]}
              />
            </>
          );

        default:
          return null;
      }
    },
    [
      bridgeSolved,
      handleTotemAwaken,
      handleWheelChange,
      hiddenPathRevealed,
      shrineSteps,
    ],
  );

  return (
    <group name="level2-whispering-woods">
      <SharedBiomeBackdrop levelId="level2" />
      <AnimatedRiverAndFalls />

      <ChunkManager
        levelId="level2"
        chunks={chunks}
        renderChunk={renderChunk}
        onStreamingPendingChange={(pending) => {
          useGameStore.getState().setStreamingPending(pending);
        }}
      />

      {/* Deep Water / Gorge Fall-Off Safety Respawn */}
      <TriggerZone
        id="l2-fall-safety"
        position={[0, -2.5, 0]}
        halfExtents={[140, 2.0, 140]}
        onEnter={handleDeepWaterRespawn}
      />
    </group>
  );
}

export default Level2_WhisperingWoods;
