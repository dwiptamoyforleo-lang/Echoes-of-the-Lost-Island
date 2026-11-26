import { useEffect, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { getQualityPreset } from '@/src/game/rendering/adaptiveQuality';
import {
  useCachedGeometry,
  useCachedMaterial,
} from '@/src/game/rendering/assetCache';
import { useGameStore } from '@/src/state/gameStore';

const _orbitTarget = new THREE.Vector3(0, 4.2, 0);

/**
 * Lightweight procedural archipelago vista rendered on menu/map/story screens
 * with zero Rapier WASM or level chunk overhead so the main menu boots fast.
 */
export function MenuIslandBackdrop() {
  const { scene, camera } = useThree();
  const activeTier = useGameStore((s) => s.activeQualityTier);
  const preset = getQualityPreset(activeTier);

  const crystalRef = useRef<THREE.Mesh>(null);
  const ringRef = useRef<THREE.Mesh>(null);
  const orbitRef = useRef(0.35);

  useEffect(() => {
    scene.background = new THREE.Color('#8ec5e8');
    scene.fog = new THREE.Fog('#b5dff4', 42, 130);
    scene.environmentIntensity = 0.5;
    return () => {
      scene.fog = null;
      scene.environmentIntensity = 0.45;
    };
  }, [scene]);

  const seaGeo = useCachedGeometry('menu-sea-plane', () => {
    const g = new THREE.PlaneGeometry(240, 240, 1, 1);
    g.rotateX(-Math.PI / 2);
    g.computeBoundingSphere();
    return g;
  });
  const baseIslandGeo = useCachedGeometry('menu-island-cone', () => {
    const g = new THREE.CylinderGeometry(7.2, 12.5, 4.5, 10);
    g.computeBoundingSphere();
    return g;
  });
  const terraceGeo = useCachedGeometry('menu-island-terrace', () => {
    const g = new THREE.CylinderGeometry(4.4, 5.8, 2.2, 8);
    g.computeBoundingSphere();
    return g;
  });
  const pillarGeo = useCachedGeometry('menu-spire-pillar', () => {
    const g = new THREE.CylinderGeometry(0.45, 0.56, 3.6, 7);
    g.computeBoundingSphere();
    return g;
  });
  const crystalGeo = useCachedGeometry('menu-beacon-crystal', () => {
    const g = new THREE.OctahedronGeometry(0.85, 0);
    g.computeBoundingSphere();
    return g;
  });
  const ringGeo = useCachedGeometry('menu-beacon-ring', () => {
    const g = new THREE.TorusGeometry(1.35, 0.06, 8, 24);
    g.computeBoundingSphere();
    return g;
  });

  const seaMat = useCachedMaterial(`menu-sea-mat-${preset.materialMode}`, () =>
    preset.materialMode === 'lambert'
      ? new THREE.MeshLambertMaterial({ color: '#1b8a9b', transparent: true, opacity: 0.9 })
      : new THREE.MeshStandardMaterial({
          color: '#1b8a9b',
          roughness: 0.22,
          metalness: 0.1,
          transparent: true,
          opacity: 0.92,
        }),
  );
  const sandMat = useCachedMaterial(`menu-sand-mat-${preset.materialMode}`, () =>
    preset.materialMode === 'lambert'
      ? new THREE.MeshLambertMaterial({ color: '#d8c28d' })
      : new THREE.MeshStandardMaterial({ color: '#d8c28d', roughness: 0.9 }),
  );
  const stoneMat = useCachedMaterial(`menu-stone-mat-${preset.materialMode}`, () =>
    preset.materialMode === 'lambert'
      ? new THREE.MeshLambertMaterial({ color: '#6b756b' })
      : new THREE.MeshStandardMaterial({ color: '#6b756b', roughness: 0.86 }),
  );
  const crystalMat = useCachedMaterial('menu-crystal-mat', () =>
    new THREE.MeshStandardMaterial({
      color: '#5eead4',
      emissive: '#14b8a6',
      emissiveIntensity: 1.4,
      roughness: 0.15,
      metalness: 0.3,
    }),
  );
  const ringMat = useCachedMaterial('menu-ring-mat', () =>
    new THREE.MeshStandardMaterial({
      color: '#f59e0b',
      emissive: '#d97706',
      emissiveIntensity: 0.45,
      roughness: 0.3,
      metalness: 0.75,
    }),
  );

  useFrame((state, rawDt) => {
    const dt = Math.min(rawDt, 0.05);
    orbitRef.current += dt * 0.11;
    const angle = orbitRef.current;
    camera.position.set(
      Math.sin(angle) * 26,
      11.5 + Math.sin(angle * 0.8) * 1.2,
      Math.cos(angle) * 26,
    );
    camera.lookAt(_orbitTarget);

    if (camera instanceof THREE.PerspectiveCamera && Math.abs(camera.fov - 50) > 0.1) {
      camera.fov = 50;
      camera.updateProjectionMatrix();
    }

    const t = state.clock.elapsedTime;
    if (crystalRef.current) {
      crystalRef.current.rotation.y += dt * 0.9;
      crystalRef.current.position.y = 6.9 + Math.sin(t * 1.8) * 0.2;
    }
    if (ringRef.current) {
      ringRef.current.rotation.z += dt * 0.65;
      ringRef.current.rotation.x = 0.65;
    }
  });

  return (
    <group name="menu-island-backdrop">
      <hemisphereLight args={['#c8ecff', '#5c664a', 0.85]} />
      <directionalLight position={[18, 28, 14]} intensity={1.85} color="#fff1d0" />

      <mesh geometry={seaGeo} material={seaMat} position={[0, 0, 0]} />
      <mesh geometry={baseIslandGeo} material={sandMat} position={[0, 1.4, 0]} />
      <mesh geometry={terraceGeo} material={stoneMat} position={[0, 3.8, 0]} />

      {[
        [-2.8, 5.4, -1.6],
        [2.8, 5.4, -1.6],
        [-2.8, 5.4, 1.6],
        [2.8, 5.4, 1.6],
      ].map(([px, py, pz], idx) => (
        <mesh
          key={`menu-col-${idx}`}
          geometry={pillarGeo}
          material={stoneMat}
          position={[px, py, pz]}
        />
      ))}

      <mesh
        ref={crystalRef}
        geometry={crystalGeo}
        material={crystalMat}
        position={[0, 6.9, 0]}
      />
      <mesh
        ref={ringRef}
        geometry={ringGeo}
        material={ringMat}
        position={[0, 6.9, 0]}
      />
    </group>
  );
}
