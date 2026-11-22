import { useEffect, useMemo } from 'react';
import { useThree } from '@react-three/fiber';
import { CuboidCollider, RigidBody } from '@react-three/rapier';

interface StaticPlatform {
  id: string;
  position: [number, number, number];
  size: [number, number, number];
  color: string;
  roughness?: number;
}

const PLATFORMS: StaticPlatform[] = [
  // Center jump-stepping platforms (increasing heights + jumpable gaps)
  {
    id: 'step-platform-1',
    position: [0, 0.45, -1.5],
    size: [3.2, 0.9, 3.0],
    color: '#c29b6b',
    roughness: 0.8,
  },
  {
    id: 'step-platform-2',
    position: [0, 0.9, -6.2],
    size: [3.2, 1.8, 3.0],
    color: '#b88b58',
    roughness: 0.8,
  },
  {
    id: 'step-platform-3',
    position: [0, 1.35, -11.2],
    size: [3.4, 2.7, 3.2],
    color: '#2e8b82',
    roughness: 0.55,
  },

  // West deck (reached by walkable 19.5° slope) + jump gap to NW platform
  {
    id: 'west-deck',
    position: [-7.5, 1.0, -6.1],
    size: [3.6, 2.0, 5.0],
    color: '#8a9186',
    roughness: 0.85,
  },
  {
    id: 'nw-gap-platform',
    position: [-7.5, 1.1, -13.0],
    size: [3.8, 2.2, 4.0],
    color: '#4ea8a1',
    roughness: 0.5,
  },

  // East terrace (reached by stairs) + jump gap to NE platform
  {
    id: 'east-terrace',
    position: [7.5, 1.0, -5.475],
    size: [3.6, 2.0, 4.8],
    color: '#8a9186',
    roughness: 0.85,
  },
  {
    id: 'ne-gap-platform',
    position: [7.5, 1.3, -12.4],
    size: [3.8, 2.6, 4.0],
    color: '#c29b6b',
    roughness: 0.78,
  },

  // Walls for sliding & camera collision raycast testing
  {
    id: 'north-wall',
    position: [0, 2.25, -17.5],
    size: [14.0, 4.5, 1.2],
    color: '#5a635e',
    roughness: 0.88,
  },
  {
    id: 'east-camera-wall',
    position: [12.5, 2.0, 3.5],
    size: [1.2, 4.0, 8.0],
    color: '#5a635e',
    roughness: 0.88,
  },
  {
    id: 'west-monolith',
    position: [-13.0, 2.4, 2.0],
    size: [2.0, 4.8, 2.0],
    color: '#6b756d',
    roughness: 0.85,
  },
];

const STAIR_COUNT = 8;
const STAIR_HEIGHT = 0.25;
const STAIR_DEPTH = 0.65;
const STAIR_WIDTH = 3.4;

export function TestScene() {
  const invalidate = useThree((state) => state.invalidate);

  useEffect(() => {
    invalidate();
  }, [invalidate]);

  // Precompute exact ramp transform so bottom meets y=0 and top meets west-deck y=2.0 at z=-3.6
  const walkableRamp = useMemo(() => {
    const length = 6.0;
    const thickness = 0.32;
    const rise = 2.0;
    const angle = Math.asin(rise / length); // ~19.47 deg
    const centerY = (length / 2) * (rise / length) - (thickness / 2) * Math.cos(angle);
    const centerZ = -3.6 - (thickness / 2) * Math.sin(angle) + (length / 2) * Math.cos(angle);
    return { length, thickness, angle, centerY, centerZ };
  }, []);

  // Steeper ~36° test ramp beside the walkable ramp
  const steepRamp = useMemo(() => {
    const length = 3.8;
    const thickness = 0.45;
    const rise = 2.25;
    const angle = Math.asin(rise / length); // ~36.3 deg
    const centerY = (length / 2) * (rise / length) - (thickness / 2) * Math.cos(angle);
    const centerZ = 1.0;
    return { length, thickness, angle, centerY, centerZ };
  }, []);

  const stairs = useMemo(() => {
    return Array.from({ length: STAIR_COUNT }, (_, idx) => {
      const stepNum = idx + 1;
      const height = stepNum * STAIR_HEIGHT;
      const z = 1.8 - idx * STAIR_DEPTH;
      return {
        id: `stair-${idx}`,
        position: [7.5, height / 2, z] as [number, number, number],
        size: [STAIR_WIDTH, height, STAIR_DEPTH] as [number, number, number],
      };
    });
  }, []);

  return (
    <>
      <color attach="background" args={['#9ec9e2']} />
      <fog attach="fog" args={['#9ec9e2', 45, 130]} />

      <hemisphereLight args={['#b8e1ff', '#5c664c', 0.72]} />
      <directionalLight
        position={[20, 32, 18]}
        intensity={2.2}
        color="#fff1d0"
        castShadow
        shadow-mapSize={[1024, 1024]}
        shadow-camera-near={1}
        shadow-camera-far={100}
        shadow-camera-left={-32}
        shadow-camera-right={32}
        shadow-camera-top={32}
        shadow-camera-bottom={-32}
        shadow-bias={-0.0005}
        shadow-normalBias={0.02}
      />

      {/* Large Ground Plane with Rapier Fixed Collider */}
      <RigidBody type="fixed" colliders={false} friction={1.0}>
        <CuboidCollider args={[80, 0.5, 80]} position={[0, -0.5, 0]} />
        <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
          <planeGeometry args={[160, 160]} />
          <meshStandardMaterial
            color="#6f875d"
            roughness={0.92}
            metalness={0.02}
          />
        </mesh>
      </RigidBody>

      {/* Courtyard Stone Plaza Pad (offset +0.02m on Y to avoid Z-fighting) */}
      <mesh position={[0, 0.01, 4.5]} receiveShadow>
        <boxGeometry args={[18, 0.02, 12]} />
        <meshStandardMaterial color="#b4ac96" roughness={0.9} metalness={0.02} />
      </mesh>

      {/* Platforms & Walls */}
      {PLATFORMS.map((p) => (
        <RigidBody
          key={p.id}
          type="fixed"
          position={p.position}
          colliders="cuboid"
          friction={0.9}
        >
          <mesh castShadow receiveShadow>
            <boxGeometry args={p.size} />
            <meshStandardMaterial
              color={p.color}
              roughness={p.roughness ?? 0.8}
              metalness={0.05}
            />
          </mesh>
        </RigidBody>
      ))}

      {/* Walkable Ramp (West) */}
      <RigidBody
        type="fixed"
        position={[-7.5, walkableRamp.centerY, walkableRamp.centerZ]}
        rotation={[walkableRamp.angle, 0, 0]}
        colliders="cuboid"
        friction={0.95}
      >
        <mesh castShadow receiveShadow>
          <boxGeometry
            args={[3.4, walkableRamp.thickness, walkableRamp.length]}
          />
          <meshStandardMaterial
            color="#c29b6b"
            roughness={0.82}
            metalness={0.04}
          />
        </mesh>
      </RigidBody>

      {/* Steep Test Ramp (Far West) */}
      <RigidBody
        type="fixed"
        position={[-11.2, steepRamp.centerY, steepRamp.centerZ]}
        rotation={[steepRamp.angle, 0, 0]}
        colliders="cuboid"
        friction={0.85}
      >
        <mesh castShadow receiveShadow>
          <boxGeometry args={[2.4, steepRamp.thickness, steepRamp.length]} />
          <meshStandardMaterial
            color="#a67c52"
            roughness={0.82}
            metalness={0.04}
          />
        </mesh>
      </RigidBody>

      {/* Staircase (East) */}
      {stairs.map((step) => (
        <RigidBody
          key={step.id}
          type="fixed"
          position={step.position}
          colliders="cuboid"
          friction={0.95}
        >
          <mesh castShadow receiveShadow>
            <boxGeometry args={step.size} />
            <meshStandardMaterial
              color="#9ca39b"
              roughness={0.85}
              metalness={0.04}
            />
          </mesh>
        </RigidBody>
      ))}

      {/* Dynamic Pushable Crates */}
      <RigidBody
        type="dynamic"
        position={[3.2, 0.55, 5.0]}
        colliders="cuboid"
        mass={2.0}
        friction={0.8}
        restitution={0.1}
      >
        <mesh castShadow receiveShadow>
          <boxGeometry args={[1.05, 1.05, 1.05]} />
          <meshStandardMaterial
            color="#d48c46"
            roughness={0.68}
            metalness={0.08}
          />
        </mesh>
      </RigidBody>

      <RigidBody
        type="dynamic"
        position={[-3.4, 0.55, 5.2]}
        colliders="cuboid"
        mass={2.0}
        friction={0.8}
        restitution={0.1}
      >
        <mesh castShadow receiveShadow>
          <boxGeometry args={[0.95, 0.95, 0.95]} />
          <meshStandardMaterial
            color="#4ea8a1"
            roughness={0.35}
            metalness={0.22}
          />
        </mesh>
      </RigidBody>
    </>
  );
}
