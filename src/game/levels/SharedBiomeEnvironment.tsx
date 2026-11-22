import { useEffect, useMemo, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { Sky } from '@react-three/drei';
import { CylinderCollider, RigidBody } from '@react-three/rapier';
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { playerTelemetry } from '@/src/game/player/playerTelemetry';
import { getQualityPreset } from '@/src/game/rendering/adaptiveQuality';
import {
  acquireGeometry,
  releaseGeometry,
  useCachedGeometry,
  useCachedMaterial,
  useCachedTexture,
} from '@/src/game/rendering/assetCache';
import { useGameStore } from '@/src/state/gameStore';
import type { LevelId } from '@/src/systems/progressionSystem';
import {
  LEVEL_BIOMES,
  acquireChunkTerrainGeometry,
  getLevelHeight,
  type TerrainPatchBounds,
} from './levelTerrainFactory';

function createRng(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

function createNoiseBumpTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 128;
  canvas.height = 128;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    const img = ctx.createImageData(128, 128);
    const rng = createRng(42);
    for (let i = 0; i < img.data.length; i += 4) {
      const v = Math.floor(110 + rng() * 45);
      img.data[i] = v;
      img.data[i + 1] = v;
      img.data[i + 2] = v;
      img.data[i + 3] = 255;
    }
    ctx.putImageData(img, 0, 0);
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(16, 16);
  tex.colorSpace = THREE.NoColorSpace;
  return tex;
}

function createHaloSpriteTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 64;
  canvas.height = 64;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    const grad = ctx.createRadialGradient(32, 32, 2, 32, 32, 30);
    grad.addColorStop(0, 'rgba(255,255,255,0.95)');
    grad.addColorStop(0.4, 'rgba(255,255,255,0.45)');
    grad.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 64, 64);
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

const _dummy = new THREE.Object3D();
const _color = new THREE.Color();
const sharedShaderUniforms = {
  uTime: { value: 0 },
};

export function GlowHalo({
  position,
  color = '#38bdf8',
  scale = 2.6,
}: {
  position: [number, number, number];
  color?: string;
  scale?: number;
}) {
  const tex = useCachedTexture('shared-glow-halo-tex', createHaloSpriteTexture);
  const mat = useCachedMaterial(
    `halo-mat-${color}`,
    () =>
      new THREE.SpriteMaterial({
        map: tex,
        color,
        transparent: true,
        opacity: 0.72,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      }),
  );

  return <sprite position={position} scale={[scale, scale, 1]} material={mat} />;
}

export function SharedBiomeBackdrop({ levelId }: { levelId: LevelId }) {
  const { scene } = useThree();
  const activeTier = useGameStore((s) => s.activeQualityTier);
  const preset = getQualityPreset(activeTier);
  const palette = LEVEL_BIOMES[levelId];

  const dirLightRef = useRef<THREE.DirectionalLight>(null);
  const lightTargetRef = useRef<THREE.Object3D>(new THREE.Object3D());
  const cloudGroupRef = useRef<THREE.Group>(null);

  const oceanGeo = useCachedGeometry(
    `ocean-geo-${preset.simpleWaterAndSky ? 'low' : 'hi'}`,
    () => {
      const segs = preset.simpleWaterAndSky ? 12 : 40;
      const g = new THREE.PlaneGeometry(240, 240, segs, segs);
      g.rotateX(-Math.PI / 2);
      g.computeBoundingSphere();
      return g;
    },
  );

  const oceanMat = useCachedMaterial(
    `ocean-mat-${levelId}-${preset.materialMode}-${preset.simpleWaterAndSky ? 'simple' : 'anim'}`,
    () => {
      if (preset.simpleWaterAndSky || preset.materialMode === 'lambert') {
        return new THREE.MeshLambertMaterial({
          color: palette.waterColor,
          transparent: true,
          opacity: palette.waterOpacity,
        });
      }
      const mat = new THREE.MeshStandardMaterial({
        color: palette.waterColor,
        roughness: 0.24,
        metalness: 0.12,
        transparent: true,
        opacity: palette.waterOpacity,
      });
      mat.onBeforeCompile = (shader) => {
        shader.uniforms.uTime = sharedShaderUniforms.uTime;
        shader.vertexShader = shader.vertexShader
          .replace(
            '#include <common>',
            `#include <common>
             uniform float uTime;
             varying vec3 vWorldPos;`,
          )
          .replace(
            '#include <begin_vertex>',
            `#include <begin_vertex>
             vec4 wp = modelMatrix * vec4(transformed, 1.0);
             float w1 = sin(wp.x * 0.22 + uTime * 1.4) * cos(wp.z * 0.18 + uTime * 1.1);
             float w2 = sin((wp.x - wp.z) * 0.35 - uTime * 1.9) * 0.5;
             transformed.y += (w1 + w2) * 0.10;
             vWorldPos = (modelMatrix * vec4(transformed, 1.0)).xyz;`,
          );
        shader.fragmentShader = shader.fragmentShader
          .replace(
            '#include <common>',
            `#include <common>
             uniform float uTime;
             varying vec3 vWorldPos;`,
          )
          .replace(
            '#include <color_fragment>',
            `#include <color_fragment>
             float dist = length(vWorldPos.xz * vec2(0.9, 0.88));
             float foamWave = sin(dist * 1.1 - uTime * 2.2) * 0.5 + 0.5;
             float shoreBand = smoothstep(39.0, 28.0, dist) * smoothstep(22.0, 31.0, dist);
             float foam = smoothstep(0.65, 0.92, foamWave * shoreBand + shoreBand * 0.42);
             diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.88, 0.97, 0.99), foam * 0.65);`,
          );
      };
      return mat;
    },
  );

  useEffect(() => {
    const light = dirLightRef.current;
    if (light) {
      light.target = lightTargetRef.current;
    }
  }, []);

  useFrame((state) => {
    const t = state.clock.elapsedTime;
    sharedShaderUniforms.uTime.value = t;

    // Follow player with snapped directional shadow frustum (zero allocation)
    const light = dirLightRef.current;
    if (light && preset.shadowsEnabled) {
      const p = playerTelemetry.position;
      const snapX = Math.round(p.x * 2) * 0.5;
      const snapZ = Math.round(p.z * 2) * 0.5;
      light.position.set(snapX + 24, 34, snapZ + 18);
      lightTargetRef.current.position.set(snapX, p.y, snapZ);
      lightTargetRef.current.updateMatrixWorld();
    }

    if (cloudGroupRef.current && !preset.simpleWaterAndSky) {
      cloudGroupRef.current.position.x = Math.sin(t * 0.03) * 8;
    }
  });

  const fogNear = Math.round(palette.fogNear * preset.fogScale);
  const fogFar = Math.round(palette.fogFar * preset.fogScale);

  // Attach background, fog, and IBL intensity directly onto THREE.Scene
  // (R3F <color attach="background"> inside a level <group> would otherwise attach to the Group!)
  useEffect(() => {
    scene.background = new THREE.Color(palette.skyColor);
    scene.fog = new THREE.Fog(palette.fogColor, fogNear, fogFar);
    scene.environmentIntensity = palette.environmentIntensity ?? 0.45;
    return () => {
      scene.fog = null;
      scene.environmentIntensity = 0.45;
    };
  }, [
    scene,
    palette.skyColor,
    palette.fogColor,
    palette.environmentIntensity,
    fogNear,
    fogFar,
  ]);

  const showClouds = palette.showClouds !== false && !preset.simpleWaterAndSky;
  const showOcean = palette.showOcean !== false;

  return (
    <>
      {palette.useSkyDome && !preset.simpleWaterAndSky && (
        <Sky
          distance={450}
          sunPosition={palette.sunPosition}
          inclination={0.48}
          azimuth={0.25}
          turbidity={4}
          rayleigh={1.2}
        />
      )}

      <hemisphereLight
        args={[palette.hemiSky, palette.hemiGround, palette.hemiIntensity]}
      />
      <primitive object={lightTargetRef.current} />
      <directionalLight
        ref={dirLightRef}
        position={[24, 34, 18]}
        intensity={palette.sunIntensity}
        color={palette.sunColor}
        castShadow={preset.shadowsEnabled}
        shadow-mapSize={[preset.shadowMapSize, preset.shadowMapSize]}
        shadow-camera-near={2}
        shadow-camera-far={96}
        shadow-camera-left={-22}
        shadow-camera-right={22}
        shadow-camera-top={22}
        shadow-camera-bottom={-22}
        shadow-bias={-0.0005}
        shadow-normalBias={0.02}
      />

      {showClouds && (
        <group ref={cloudGroupRef} position={[0, 32, -25]}>
          {[
            [-26, 0, -10, 1.3],
            [12, 3, -24, 1.6],
            [34, -1, 8, 1.1],
          ].map(([cx, cy, cz, cs], idx) => (
            <group key={idx} position={[cx, cy, cz]} scale={cs}>
              <mesh position={[0, 0, 0]}>
                <sphereGeometry args={[3.2, 8, 6]} />
                <meshBasicMaterial color="#f8fafc" />
              </mesh>
              <mesh position={[2.6, -0.4, 0.4]}>
                <sphereGeometry args={[2.2, 8, 6]} />
                <meshBasicMaterial color="#f8fafc" />
              </mesh>
            </group>
          ))}
        </group>
      )}

      {/* Sea / Basin Surface */}
      {showOcean && (
        <mesh
          geometry={oceanGeo}
          material={oceanMat}
          position={[0, 0, 0]}
          receiveShadow={preset.shadowsEnabled}
        />
      )}
    </>
  );
}

export function ChunkTerrainPatch({
  levelId,
  chunkId,
  patch,
}: {
  levelId: LevelId;
  chunkId: string;
  patch: TerrainPatchBounds;
}) {
  const activeTier = useGameStore((s) => s.activeQualityTier);
  const preset = getQualityPreset(activeTier);
  const step = patch.step ?? 2;
  const geoKey = `terrain-chunk-${levelId}-${chunkId}-s${step}`;

  const terrainGeo = useMemo(
    () => acquireChunkTerrainGeometry(levelId, chunkId, patch),
    [levelId, chunkId, patch],
  );

  useEffect(() => {
    return () => {
      releaseGeometry(geoKey);
    };
  }, [geoKey]);

  const bumpTex = useCachedTexture(
    'terrain-bump-noise-128',
    createNoiseBumpTexture,
  );

  const terrainMat = useCachedMaterial(
    `terrain-mat-${levelId}-${preset.materialMode}`,
    () => {
      if (preset.materialMode === 'lambert') {
        return new THREE.MeshLambertMaterial({
          vertexColors: true,
        });
      }
      return new THREE.MeshStandardMaterial({
        vertexColors: true,
        roughness: 0.9,
        metalness: 0.02,
        bumpMap: bumpTex,
        bumpScale: 0.1,
      });
    },
  );

  return (
    <RigidBody type="fixed" colliders="trimesh" friction={1.0}>
      <mesh
        geometry={terrainGeo}
        material={terrainMat}
        receiveShadow={preset.shadowsEnabled}
        castShadow={false}
      />
    </RigidBody>
  );
}

interface TreeInstance {
  x: number;
  y: number;
  z: number;
  scale: number;
  rot: number;
}
interface RockInstance {
  x: number;
  y: number;
  z: number;
  sx: number;
  sy: number;
  sz: number;
  rot: number;
  tint: number;
}
interface GrassInstance {
  x: number;
  y: number;
  z: number;
  scale: number;
  rot: number;
  tint: number;
}

export function ChunkPropField({
  levelId,
  chunkId,
  patch,
  seed = 1337,
  treeDensity = 8,
  rockDensity = 16,
  grassDensity = 72,
}: {
  levelId: LevelId;
  chunkId: string;
  patch: TerrainPatchBounds;
  seed?: number;
  treeDensity?: number;
  rockDensity?: number;
  grassDensity?: number;
}) {
  const activeTier = useGameStore((s) => s.activeQualityTier);
  const preset = getQualityPreset(activeTier);
  const palette = LEVEL_BIOMES[levelId];

  const trunkHiRef = useRef<THREE.InstancedMesh>(null);
  const crownHiRef = useRef<THREE.InstancedMesh>(null);
  const treeLoRef = useRef<THREE.InstancedMesh>(null);
  const rockRef = useRef<THREE.InstancedMesh>(null);
  const grassRef = useRef<THREE.InstancedMesh>(null);

  const lastUpdatePosRef = useRef(new THREE.Vector3(999, 999, 999));
  const lastTierRef = useRef(activeTier);

  const { trees, rocks, grass, boundsSphere } = useMemo(() => {
    const rng = createRng(seed);
    const width = patch.maxX - patch.minX;
    const depth = patch.maxZ - patch.minZ;
    const treeList: TreeInstance[] = [];
    const rockList: RockInstance[] = [];
    const grassList: GrassInstance[] = [];

    const isClearedZone = (x: number, z: number) => {
      if (Math.abs(x) < 10.5 && z < -8) return true;
      if (Math.abs(x) < 4.5 && z > 13) return true;
      if (levelId === 'level1' && x < -14 && z < -8) return true;
      if (x > 12 && x < 20 && Math.abs(z) < 7) return true;
      return false;
    };

    let attempts = 0;
    while (treeList.length < treeDensity && attempts < treeDensity * 18) {
      attempts += 1;
      const x = patch.minX + 2 + rng() * Math.max(1, width - 4);
      const z = patch.minZ + 2 + rng() * Math.max(1, depth - 4);
      if (isClearedZone(x, z)) continue;
      const y = getLevelHeight(levelId, x, z);
      const ny =
        1 /
        Math.hypot(
          getLevelHeight(levelId, x + 0.5, z) - getLevelHeight(levelId, x - 0.5, z),
          1,
          getLevelHeight(levelId, x, z + 0.5) - getLevelHeight(levelId, x, z - 0.5),
        );
      if (y > 0.7 && y < 4.7 && ny > 0.87) {
        treeList.push({
          x,
          y: y - 0.12,
          z,
          scale: 0.85 + rng() * 0.35,
          rot: rng() * Math.PI * 2,
        });
      }
    }

    for (let i = 0; i < rockDensity * 3 && rockList.length < rockDensity; i++) {
      const x = patch.minX + 1.5 + rng() * Math.max(1, width - 3);
      const z = patch.minZ + 1.5 + rng() * Math.max(1, depth - 3);
      if (Math.abs(x) < 9.5 && z < -6) continue;
      if (Math.abs(x) < 4.5 && z > 15) continue;
      const y = getLevelHeight(levelId, x, z);
      if (y > -0.3 && y < 5.0) {
        const base = 0.55 + rng() * 0.95;
        rockList.push({
          x,
          y: y - 0.15,
          z,
          sx: base * (0.8 + rng() * 0.45),
          sy: base * (0.6 + rng() * 0.4),
          sz: base * (0.8 + rng() * 0.45),
          rot: rng() * Math.PI * 2,
          tint: 0.85 + rng() * 0.25,
        });
      }
    }

    for (let i = 0; i < grassDensity * 4 && grassList.length < grassDensity; i++) {
      const x = patch.minX + 1 + rng() * Math.max(1, width - 2);
      const z = patch.minZ + 1 + rng() * Math.max(1, depth - 2);
      if (Math.abs(x) < 10 && z < -10 && z > -35) continue;
      const y = getLevelHeight(levelId, x, z);
      if (y > 1.5 && y < 4.8) {
        grassList.push({
          x,
          y: y - 0.05,
          z,
          scale: 0.75 + rng() * 0.55,
          rot: rng() * Math.PI * 2,
          tint: 0.85 + rng() * 0.3,
        });
      }
    }

    const cx = (patch.minX + patch.maxX) * 0.5;
    const cz = (patch.minZ + patch.maxZ) * 0.5;
    const radius = Math.hypot(width * 0.5, depth * 0.5) + 8;
    const sphere = new THREE.Sphere(new THREE.Vector3(cx, 3, cz), radius);

    return { trees: treeList, rocks: rockList, grass: grassList, boundsSphere: sphere };
  }, [levelId, patch, seed, treeDensity, rockDensity, grassDensity]);

  const trunkGeo = useCachedGeometry('prop-tree-trunk', () => {
    const g = new THREE.CylinderGeometry(0.16, 0.28, 4.2, 7);
    g.translate(0, 2.1, 0);
    g.computeBoundingSphere();
    return g;
  });
  const crownGeo = useCachedGeometry('prop-tree-crown', () => {
    const parts: THREE.BufferGeometry[] = [];
    for (let f = 0; f < 6; f++) {
      const frond = new THREE.BoxGeometry(0.48, 0.08, 2.15);
      frond.translate(0, 0, 1.05);
      frond.rotateX(0.26);
      frond.rotateY((f / 6) * Math.PI * 2);
      parts.push(frond);
    }
    const top = new THREE.ConeGeometry(0.55, 0.45, 5);
    top.translate(0, 0.12, 0);
    parts.push(top);
    const merged = mergeGeometries(parts);
    parts.forEach((p) => p.dispose());
    merged.computeBoundingSphere();
    return merged;
  });
  const treeImpostorGeo = useCachedGeometry('prop-tree-impostor', () => {
    const t = new THREE.CylinderGeometry(0.14, 0.22, 4.0, 4);
    t.translate(0, 2.0, 0);
    const c = new THREE.ConeGeometry(1.6, 1.3, 5);
    c.translate(0, 4.1, 0);
    const merged = mergeGeometries([t, c]);
    t.dispose();
    c.dispose();
    merged.computeBoundingSphere();
    return merged;
  });
  const rockGeo = useCachedGeometry('prop-rock-dodeca', () => {
    const g = new THREE.DodecahedronGeometry(1.0, 0);
    g.computeBoundingSphere();
    return g;
  });
  const grassGeo = useCachedGeometry('prop-grass-tuft', () => {
    const parts: THREE.BufferGeometry[] = [];
    const angles = [0, 2.1, 4.2];
    for (let b = 0; b < angles.length; b++) {
      const blade = new THREE.ConeGeometry(0.075, 0.55, 3);
      blade.translate(0, 0.275, 0);
      blade.rotateZ(0.18);
      blade.rotateY(angles[b]);
      blade.translate(Math.cos(angles[b]) * 0.06, 0, Math.sin(angles[b]) * 0.06);
      parts.push(blade);
    }
    const g = mergeGeometries(parts);
    parts.forEach((p) => p.dispose());
    g.computeBoundingSphere();
    return g;
  });

  const makeMat = (color: string, roughness: number) =>
    preset.materialMode === 'lambert'
      ? new THREE.MeshLambertMaterial({ color })
      : new THREE.MeshStandardMaterial({ color, roughness, metalness: 0.02 });

  const trunkMat = useCachedMaterial(
    `prop-trunk-${levelId}-${preset.materialMode}`,
    () => makeMat(palette.trunkColor, 0.9),
  );
  const crownMat = useCachedMaterial(
    `prop-crown-${levelId}-${preset.materialMode}`,
    () => makeMat(palette.canopyColor, 0.78),
  );
  const impostorMat = useCachedMaterial(
    `prop-impostor-${levelId}`,
    () => new THREE.MeshLambertMaterial({ color: palette.canopyColor }),
  );
  const rockMat = useCachedMaterial(
    `prop-rock-${levelId}-${preset.materialMode}`,
    () => makeMat(palette.rockColor, 0.88),
  );
  const grassMat = useCachedMaterial(
    `prop-grass-${levelId}-${preset.materialMode}`,
    () => {
      const m =
        preset.materialMode === 'lambert'
          ? new THREE.MeshLambertMaterial({ color: palette.grassBladeColor })
          : new THREE.MeshStandardMaterial({
              color: palette.grassBladeColor,
              roughness: 0.82,
              metalness: 0.02,
            });
      m.onBeforeCompile = (shader) => {
        shader.uniforms.uTime = sharedShaderUniforms.uTime;
        shader.vertexShader = shader.vertexShader
          .replace(
            '#include <common>',
            `#include <common>
             uniform float uTime;`,
          )
          .replace(
            '#include <begin_vertex>',
            `#include <begin_vertex>
             float sway = sin(uTime * 2.2 + position.x * 1.5 + position.z * 1.5) * 0.11 * clamp(position.y * 1.8, 0.0, 1.0);
             transformed.x += sway;`,
          );
      };
      return m;
    },
  );

  useEffect(() => {
    const meshes = [
      trunkHiRef.current,
      crownHiRef.current,
      treeLoRef.current,
      rockRef.current,
      grassRef.current,
    ];
    for (const m of meshes) {
      if (m) m.boundingSphere = boundsSphere.clone();
    }
    lastUpdatePosRef.current.set(999, 999, 999);
  }, [boundsSphere, chunkId]);

  useFrame(() => {
    const p = playerTelemetry.position;
    const movedSq =
      (p.x - lastUpdatePosRef.current.x) ** 2 +
      (p.z - lastUpdatePosRef.current.z) ** 2;
    if (movedSq < 6.25 && lastTierRef.current === activeTier) {
      return;
    }
    lastUpdatePosRef.current.set(p.x, p.y, p.z);
    lastTierRef.current = activeTier;

    const lodDist = preset.lodDistance;
    const medCull = preset.mediumPropCullDistance;
    const nearCull = preset.propCullDistance;

    // 1. Trees: 2-tier LOD (High detail near player, low impostor medium distance, culled far)
    if (trunkHiRef.current && crownHiRef.current && treeLoRef.current) {
      let hiCount = 0;
      let loCount = 0;
      for (let i = 0; i < trees.length; i++) {
        const tr = trees[i];
        const dist = Math.hypot(tr.x - p.x, tr.z - p.z);
        if (dist <= lodDist) {
          _dummy.position.set(tr.x, tr.y, tr.z);
          _dummy.rotation.set(0.06, tr.rot, 0.04);
          _dummy.scale.setScalar(tr.scale);
          _dummy.updateMatrix();
          trunkHiRef.current.setMatrixAt(hiCount, _dummy.matrix);

          _dummy.position.set(tr.x, tr.y + 4.0 * tr.scale, tr.z);
          _dummy.rotation.set(0.05, tr.rot, 0);
          _dummy.scale.setScalar(tr.scale);
          _dummy.updateMatrix();
          crownHiRef.current.setMatrixAt(hiCount, _dummy.matrix);
          hiCount += 1;
        } else if (dist <= medCull) {
          _dummy.position.set(tr.x, tr.y, tr.z);
          _dummy.rotation.set(0, tr.rot, 0);
          _dummy.scale.setScalar(tr.scale);
          _dummy.updateMatrix();
          treeLoRef.current.setMatrixAt(loCount, _dummy.matrix);
          loCount += 1;
        }
      }
      trunkHiRef.current.count = hiCount;
      crownHiRef.current.count = hiCount;
      treeLoRef.current.count = loCount;
      trunkHiRef.current.instanceMatrix.needsUpdate = true;
      crownHiRef.current.instanceMatrix.needsUpdate = true;
      treeLoRef.current.instanceMatrix.needsUpdate = true;
    }

    // 2. Rocks: Distance culled at mediumPropCullDistance
    if (rockRef.current) {
      let rCount = 0;
      for (let i = 0; i < rocks.length; i++) {
        const r = rocks[i];
        const dist = Math.hypot(r.x - p.x, r.z - p.z);
        if (dist <= medCull) {
          _dummy.position.set(r.x, r.y, r.z);
          _dummy.rotation.set(r.rot * 0.3, r.rot, r.rot * 0.2);
          _dummy.scale.set(r.sx, r.sy, r.sz);
          _dummy.updateMatrix();
          rockRef.current.setMatrixAt(rCount, _dummy.matrix);
          _color.set(palette.rockColor).multiplyScalar(r.tint);
          rockRef.current.setColorAt(rCount, _color);
          rCount += 1;
        }
      }
      rockRef.current.count = rCount;
      rockRef.current.instanceMatrix.needsUpdate = true;
      if (rockRef.current.instanceColor) {
        rockRef.current.instanceColor.needsUpdate = true;
      }
    }

    // 3. Grass: Short distance culled at propCullDistance, castShadow=false
    if (grassRef.current) {
      let gCount = 0;
      for (let i = 0; i < grass.length; i++) {
        const g = grass[i];
        const dist = Math.hypot(g.x - p.x, g.z - p.z);
        if (dist <= nearCull) {
          _dummy.position.set(g.x, g.y, g.z);
          _dummy.rotation.set(0, g.rot, 0);
          _dummy.scale.setScalar(g.scale);
          _dummy.updateMatrix();
          grassRef.current.setMatrixAt(gCount, _dummy.matrix);
          _color.set(palette.grassBladeColor).multiplyScalar(g.tint);
          grassRef.current.setColorAt(gCount, _color);
          gCount += 1;
        }
      }
      grassRef.current.count = gCount;
      grassRef.current.instanceMatrix.needsUpdate = true;
      if (grassRef.current.instanceColor) {
        grassRef.current.instanceColor.needsUpdate = true;
      }
    }
  });

  return (
    <group>
      {trees.length > 0 && (
        <>
          <instancedMesh
            ref={trunkHiRef}
            args={[trunkGeo, trunkMat, trees.length]}
            castShadow={preset.shadowsEnabled}
            receiveShadow={preset.shadowsEnabled}
            frustumCulled
          />
          <instancedMesh
            ref={crownHiRef}
            args={[crownGeo, crownMat, trees.length]}
            castShadow={preset.shadowsEnabled}
            frustumCulled
          />
          <instancedMesh
            ref={treeLoRef}
            args={[treeImpostorGeo, impostorMat, trees.length]}
            frustumCulled
          />
          <RigidBody type="fixed" colliders={false}>
            {trees.map((tr, idx) => (
              <CylinderCollider
                key={`tree-col-${chunkId}-${idx}`}
                args={[1.8 * tr.scale, 0.24 * tr.scale]}
                position={[tr.x, tr.y + 1.8 * tr.scale, tr.z]}
              />
            ))}
          </RigidBody>
        </>
      )}

      {rocks.length > 0 && (
        <instancedMesh
          ref={rockRef}
          args={[rockGeo, rockMat, rocks.length]}
          castShadow={preset.shadowsEnabled}
          receiveShadow={preset.shadowsEnabled}
          frustumCulled
        />
      )}

      {grass.length > 0 && (
        <instancedMesh
          ref={grassRef}
          args={[grassGeo, grassMat, grass.length]}
          castShadow={false}
          frustumCulled
        />
      )}
    </group>
  );
}
