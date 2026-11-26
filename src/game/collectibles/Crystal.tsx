import { useEffect, useMemo, useRef, useState } from 'react';
import { useFrame } from '@react-three/fiber';
import {
  BallCollider,
  RigidBody,
  type IntersectionEnterPayload,
} from '@react-three/rapier';
import * as THREE from 'three';
import { isPlayerPayload } from '@/src/game/physics';
import { getQualityPreset } from '@/src/game/rendering/adaptiveQuality';
import {
  useCachedGeometry,
  useCachedMaterial,
} from '@/src/game/rendering/assetCache';
import { eventBus } from '@/src/state/eventBus';
import { useGameStore } from '@/src/state/gameStore';

export interface CrystalSpec {
  id: string;
  position: [number, number, number];
}

interface BurstParticle {
  active: boolean;
  age: number;
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
}

const MAX_BURST_POOL = 72;
const PARTICLES_PER_COLLECT = 8;
const _dummy = new THREE.Object3D();

export interface CrystalProps {
  id: string;
  position: [number, number, number];
  color?: string;
}

export function Crystal({
  id,
  position,
  color = '#38bdf8',
}: CrystalProps) {
  const collected = useGameStore((s) => Boolean(s.collectedIds[id]));
  const meshRef = useRef<THREE.Mesh>(null);
  const scaleRef = useRef(1);
  const phaseRef = useRef(Math.abs(position[0] * 1.3 + position[2] * 0.7));
  const [hidden, setHidden] = useState(collected);

  const geom = useCachedGeometry('crystal-single-octa', () => {
    const g = new THREE.OctahedronGeometry(0.34, 0);
    g.computeBoundingSphere();
    return g;
  });
  const mat = useCachedMaterial(`crystal-mat-${color}`, () =>
    new THREE.MeshStandardMaterial({
      color,
      emissive: color,
      emissiveIntensity: 0.9,
      roughness: 0.18,
      metalness: 0.25,
    }),
  );

  useFrame((_, rawDt) => {
    const dt = Math.min(rawDt, 0.05);
    const mesh = meshRef.current;
    if (!mesh || hidden) return;

    phaseRef.current += dt * 2.2;
    mesh.rotation.y += dt * 1.8;
    mesh.position.y = Math.sin(phaseRef.current) * 0.14;

    if (collected) {
      scaleRef.current = Math.max(0, scaleRef.current - dt * 4.5);
      mesh.scale.setScalar(scaleRef.current);
      if (scaleRef.current <= 0.01) {
        setHidden(true);
      }
    }
  });

  const handleEnter = (payload: IntersectionEnterPayload) => {
    if (collected || !isPlayerPayload(payload)) return;
    if (useGameStore.getState().addCrystal(id)) {
      eventBus.emit('crystal:collected', {
        id,
        total: useGameStore.getState().crystals,
      });
    }
  };

  if (hidden) return null;

  return (
    <group position={position}>
      <mesh ref={meshRef} geometry={geom} material={mat} />
      {!collected && (
        <RigidBody type="fixed" colliders={false} sensor>
          <BallCollider
            args={[0.78]}
            sensor
            onIntersectionEnter={handleEnter}
          />
        </RigidBody>
      )}
    </group>
  );
}

export interface CrystalFieldProps {
  crystals: CrystalSpec[];
  color?: string;
}

export function CrystalField({
  crystals,
  color = '#38bdf8',
}: CrystalFieldProps) {
  const instancedRef = useRef<THREE.InstancedMesh>(null);
  const particleMeshRef = useRef<THREE.InstancedMesh>(null);
  const collectedIds = useGameStore((s) => s.collectedIds);
  const activeTier = useGameStore((s) => s.activeQualityTier);
  const particleCap = getQualityPreset(activeTier).particleCap;

  const scalesRef = useRef<Float32Array>(new Float32Array(crystals.length));
  const particleCursorRef = useRef(0);
  const particlesRef = useRef<BurstParticle[]>(
    Array.from({ length: MAX_BURST_POOL }, () => ({
      active: false,
      age: 0,
      x: 0,
      y: 0,
      z: 0,
      vx: 0,
      vy: 0,
      vz: 0,
    })),
  );

  const crystalGeom = useCachedGeometry('crystal-field-octa', () => {
    const geom = new THREE.OctahedronGeometry(0.36, 0);
    geom.scale(0.85, 1.35, 0.85);
    geom.computeBoundingSphere();
    return geom;
  });

  const crystalMat = useCachedMaterial(`crystal-field-mat-${color}`, () =>
    new THREE.MeshStandardMaterial({
      color,
      emissive: color,
      emissiveIntensity: 0.95,
      roughness: 0.16,
      metalness: 0.25,
    }),
  );

  const particleGeom = useCachedGeometry('crystal-particle-octa', () => {
    const g = new THREE.OctahedronGeometry(0.09, 0);
    g.computeBoundingSphere();
    return g;
  });

  const particleMat = useCachedMaterial('crystal-particle-mat', () =>
    new THREE.MeshBasicMaterial({
      color: '#bae6fd',
      transparent: true,
      opacity: 0.92,
    }),
  );

  // Compute tight bounding sphere for frustum culling across all crystals in this chunk
  const chunkBoundingSphere = useMemo(() => {
    const box = new THREE.Box3();
    const v = new THREE.Vector3();
    for (let i = 0; i < crystals.length; i++) {
      const p = crystals[i].position;
      v.set(p[0], p[1], p[2]);
      box.expandByPoint(v);
    }
    const sphere = new THREE.Sphere();
    if (!box.isEmpty()) {
      box.getBoundingSphere(sphere);
      sphere.radius += 6;
    } else {
      sphere.set(new THREE.Vector3(), 10);
    }
    return sphere;
  }, [crystals]);

  useEffect(() => {
    scalesRef.current = new Float32Array(crystals.length);
    const collectedMap = useGameStore.getState().collectedIds;
    for (let i = 0; i < crystals.length; i++) {
      scalesRef.current[i] = collectedMap[crystals[i].id] ? 0 : 1;
    }
    if (instancedRef.current) {
      instancedRef.current.boundingSphere = chunkBoundingSphere.clone();
    }
    if (particleMeshRef.current) {
      particleMeshRef.current.boundingSphere = chunkBoundingSphere.clone();
    }
  }, [crystals, chunkBoundingSphere]);

  const spawnBurst = (pos: [number, number, number]) => {
    const pool = particlesRef.current;
    const count = Math.min(PARTICLES_PER_COLLECT, particleCap);
    for (let i = 0; i < count; i++) {
      const idx = particleCursorRef.current % Math.max(1, particleCap);
      particleCursorRef.current += 1;
      const p = pool[idx];
      const angle = (i / count) * Math.PI * 2;
      const speed = 2.0 + (i % 3) * 0.85;
      p.active = true;
      p.age = 0;
      p.x = pos[0];
      p.y = pos[1];
      p.z = pos[2];
      p.vx = Math.cos(angle) * speed;
      p.vy = 2.4 + (i % 2) * 1.1;
      p.vz = Math.sin(angle) * speed;
    }
  };

  useFrame((state, rawDt) => {
    const dt = Math.min(rawDt, 0.05);
    const t = state.clock.elapsedTime;
    const mesh = instancedRef.current;
    const pMesh = particleMeshRef.current;
    const collectedMap = useGameStore.getState().collectedIds;
    const scales = scalesRef.current;

    if (mesh) {
      let anyVisible = false;
      for (let i = 0; i < crystals.length; i++) {
        const c = crystals[i];
        const isCollected = Boolean(collectedMap[c.id]);

        if (isCollected) {
          scales[i] = Math.max(0, scales[i] - dt * 5.0);
        } else {
          scales[i] = 1;
        }

        const s = scales[i];
        if (s <= 0.005) {
          _dummy.position.set(0, -200, 0);
          _dummy.scale.setScalar(0);
        } else {
          anyVisible = true;
          const bob = Math.sin(t * 2.4 + i * 0.7) * 0.14;
          _dummy.position.set(c.position[0], c.position[1] + bob, c.position[2]);
          _dummy.rotation.set(0, t * 1.8 + i * 0.5, 0);
          const popScale = isCollected ? s * 1.35 : s;
          _dummy.scale.setScalar(popScale);
        }
        if (anyVisible || mesh.visible) {
          _dummy.updateMatrix();
          mesh.setMatrixAt(i, _dummy.matrix);
        }
      }
      if (anyVisible) {
        mesh.visible = true;
        mesh.instanceMatrix.needsUpdate = true;
      } else if (mesh.visible) {
        mesh.instanceMatrix.needsUpdate = true;
        mesh.visible = false;
      }
    }

    if (pMesh) {
      const pool = particlesRef.current;
      let anyActive = false;
      const limit = Math.min(pool.length, particleCap);
      for (let i = 0; i < limit; i++) {
        const p = pool[i];
        if (!p.active) {
          _dummy.position.set(0, -200, 0);
          _dummy.scale.setScalar(0);
        } else {
          anyActive = true;
          p.age += dt;
          if (p.age >= 0.55) {
            p.active = false;
            _dummy.position.set(0, -200, 0);
            _dummy.scale.setScalar(0);
          } else {
            p.vy -= 9.5 * dt;
            p.x += p.vx * dt;
            p.y += p.vy * dt;
            p.z += p.vz * dt;
            const s = Math.max(0, 1 - p.age / 0.55);
            _dummy.position.set(p.x, p.y, p.z);
            _dummy.rotation.set(p.age * 6, p.age * 4, 0);
            _dummy.scale.setScalar(s);
          }
        }
        _dummy.updateMatrix();
        pMesh.setMatrixAt(i, _dummy.matrix);
      }
      pMesh.visible = anyActive;
      if (anyActive) {
        pMesh.instanceMatrix.needsUpdate = true;
      }
    }
  });

  if (crystals.length === 0) return null;

  return (
    <group>
      <instancedMesh
        ref={instancedRef}
        args={[crystalGeom, crystalMat, crystals.length]}
        frustumCulled
      />
      <instancedMesh
        ref={particleMeshRef}
        args={[particleGeom, particleMat, Math.max(1, particleCap)]}
        frustumCulled
      />
      {crystals.map((c) => {
        if (collectedIds[c.id]) return null;
        return (
          <RigidBody
            key={c.id}
            type="fixed"
            position={c.position}
            colliders={false}
            sensor
          >
            <BallCollider
              args={[0.85]}
              sensor
              onIntersectionEnter={(payload) => {
                if (!isPlayerPayload(payload)) return;
                if (useGameStore.getState().addCrystal(c.id)) {
                  spawnBurst(c.position);
                  eventBus.emit('crystal:collected', {
                    id: c.id,
                    total: useGameStore.getState().crystals,
                  });
                }
              }}
            />
          </RigidBody>
        );
      })}
    </group>
  );
}
