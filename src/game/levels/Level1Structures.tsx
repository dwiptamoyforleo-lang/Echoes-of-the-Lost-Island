import { useMemo } from 'react';
import { CuboidCollider, RigidBody } from '@react-three/rapier';
import { getQualityPreset } from '@/src/game/rendering/adaptiveQuality';
import { useGameStore } from '@/src/state/gameStore';
import { CheckpointBeacon } from './CheckpointBeacon';
import { GlowHalo } from './SharedBiomeEnvironment';

export function Level1WestCaveStructures() {
  const activeTier = useGameStore((s) => s.activeQualityTier);
  const preset = getQualityPreset(activeTier);

  return (
    <group position={[-22, 2.5, -16]}>
      <RigidBody type="fixed" colliders={false}>
        <CuboidCollider args={[1.2, 3.2, 6.5]} position={[-5.4, 2.8, 0]} />
        <mesh castShadow={preset.shadowsEnabled} receiveShadow={preset.shadowsEnabled} position={[-5.4, 2.8, 0]}>
          <boxGeometry args={[2.4, 6.4, 13]} />
          <meshStandardMaterial color="#484e4a" roughness={0.95} />
        </mesh>
        <CuboidCollider args={[1.2, 3.2, 6.5]} position={[5.4, 2.8, 0]} />
        <mesh castShadow={preset.shadowsEnabled} receiveShadow={preset.shadowsEnabled} position={[5.4, 2.8, 0]}>
          <boxGeometry args={[2.4, 6.4, 13]} />
          <meshStandardMaterial color="#484e4a" roughness={0.95} />
        </mesh>
        <CuboidCollider args={[6.6, 3.2, 1.2]} position={[0, 2.8, -5.6]} />
        <mesh castShadow={preset.shadowsEnabled} receiveShadow={preset.shadowsEnabled} position={[0, 2.8, -5.6]}>
          <boxGeometry args={[13.2, 6.4, 2.4]} />
          <meshStandardMaterial color="#434945" roughness={0.95} />
        </mesh>
        <CuboidCollider args={[6.6, 1.0, 6.8]} position={[0, 5.8, -0.2]} />
        <mesh castShadow={preset.shadowsEnabled} receiveShadow={preset.shadowsEnabled} position={[0, 5.8, -0.2]}>
          <boxGeometry args={[13.2, 2.0, 13.6]} />
          <meshStandardMaterial color="#4f5652" roughness={0.95} />
        </mesh>
      </RigidBody>

      {preset.tier !== 'low' && (
        <pointLight position={[0, 3.6, -1.5]} color="#38bdf8" intensity={5.2} distance={15} />
      )}
      {[
        [-3.8, 1.2, -3.5, 0.7],
        [3.6, 1.4, -2.5, 0.9],
        [-3.6, 2.4, 2.2, 0.65],
        [3.9, 2.2, 2.8, 0.75],
      ].map(([x, y, z, s], i) => (
        <group key={`cave-glow-${i}`} position={[x, y, z]} scale={s}>
          <mesh>
            <octahedronGeometry args={[0.55, 0]} />
            <meshStandardMaterial
              color="#38bdf8"
              emissive="#0284c7"
              emissiveIntensity={1.6}
              roughness={0.2}
            />
          </mesh>
          <GlowHalo position={[0, 0.1, 0]} color="#38bdf8" scale={2.2} />
        </group>
      ))}
    </group>
  );
}

export function Level1EastCoveStructures() {
  const activeTier = useGameStore((s) => s.activeQualityTier);
  const preset = getQualityPreset(activeTier);

  return (
    <>
      <RigidBody type="fixed" colliders="cuboid">
        <mesh castShadow={preset.shadowsEnabled} receiveShadow={preset.shadowsEnabled} position={[10.5, 2.0, 15.5]}>
          <boxGeometry args={[2.2, 2.2, 2.2]} />
          <meshStandardMaterial color="#70766f" roughness={0.9} />
        </mesh>
        <mesh castShadow={preset.shadowsEnabled} receiveShadow={preset.shadowsEnabled} position={[12.5, 1.8, 17.2]}>
          <boxGeometry args={[2.4, 1.9, 2.0]} />
          <meshStandardMaterial color="#70766f" roughness={0.9} />
        </mesh>
      </RigidBody>

      <CheckpointBeacon
        id="east-ridge"
        chunkId="l1-east-cove"
        position={[21.5, 4.5, -1.0]}
        spawnPos={[21.5, 4.7, -1.0]}
        label="Windward Ridge"
      />
    </>
  );
}

export function Level1RuinsStructures() {
  const activeTier = useGameStore((s) => s.activeQualityTier);
  const preset = getQualityPreset(activeTier);

  const ruinsStairs = useMemo(() => {
    const count = 8;
    const startZ = -5.8;
    const depth = 0.75;
    const baseY = 2.4;
    const topY = 4.2;
    const stepRise = (topY - baseY) / count;
    return Array.from({ length: count }, (_, i) => {
      const h = baseY + (i + 1) * stepRise;
      return {
        id: `ruins-step-${i}`,
        position: [0, h / 2, startZ - i * depth] as [number, number, number],
        size: [5.4, h, depth] as [number, number, number],
      };
    });
  }, []);

  return (
    <>
      <RigidBody type="fixed" colliders="cuboid" friction={0.95}>
        <mesh receiveShadow={preset.shadowsEnabled} position={[0, 3.7, -22]}>
          <boxGeometry args={[18, 1.0, 21]} />
          <meshStandardMaterial color="#878d83" roughness={0.88} />
        </mesh>
      </RigidBody>

      {ruinsStairs.map((s) => (
        <RigidBody
          key={s.id}
          type="fixed"
          position={s.position}
          colliders="cuboid"
          friction={0.95}
        >
          <mesh castShadow={preset.shadowsEnabled} receiveShadow={preset.shadowsEnabled}>
            <boxGeometry args={s.size} />
            <meshStandardMaterial color="#8f958a" roughness={0.86} />
          </mesh>
        </RigidBody>
      ))}

      {[
        { pos: [-5.5, 4.2, -13.5] as [number, number, number], h: 3.4 },
        { pos: [5.5, 4.2, -13.5] as [number, number, number], h: 2.2 },
        { pos: [-6.5, 4.2, -18.5] as [number, number, number], h: 3.8 },
        { pos: [6.5, 4.2, -18.5] as [number, number, number], h: 3.8 },
      ].map((col, idx) => (
        <RigidBody
          key={`col-${idx}`}
          type="fixed"
          position={[col.pos[0], col.pos[1] + col.h / 2, col.pos[2]]}
          colliders="cuboid"
        >
          <mesh castShadow={preset.shadowsEnabled} receiveShadow={preset.shadowsEnabled}>
            <cylinderGeometry args={[0.52, 0.58, col.h, 8]} />
            <meshStandardMaterial color="#767d73" roughness={0.88} />
          </mesh>
        </RigidBody>
      ))}

      <RigidBody type="fixed" colliders="cuboid">
        <mesh castShadow={preset.shadowsEnabled} receiveShadow={preset.shadowsEnabled} position={[-4.3, 6.6, -21.5]}>
          <boxGeometry args={[3.4, 4.8, 1.2]} />
          <meshStandardMaterial color="#687066" roughness={0.88} />
        </mesh>
        <mesh castShadow={preset.shadowsEnabled} receiveShadow={preset.shadowsEnabled} position={[5.3, 6.6, -21.5]}>
          <boxGeometry args={[5.2, 4.8, 1.2]} />
          <meshStandardMaterial color="#687066" roughness={0.88} />
        </mesh>
        <mesh castShadow={preset.shadowsEnabled} receiveShadow={preset.shadowsEnabled} position={[7.3, 6.6, -26.5]}>
          <boxGeometry args={[1.2, 4.8, 11.2]} />
          <meshStandardMaterial color="#687066" roughness={0.88} />
        </mesh>
        <mesh castShadow={preset.shadowsEnabled} receiveShadow={preset.shadowsEnabled} position={[-0.8, 6.6, -31.5]}>
          <boxGeometry args={[17.2, 4.8, 1.2]} />
          <meshStandardMaterial color="#687066" roughness={0.88} />
        </mesh>
        <mesh castShadow={preset.shadowsEnabled} receiveShadow={preset.shadowsEnabled} position={[-9.0, 6.6, -25.8]}>
          <boxGeometry args={[1.2, 4.8, 12.6]} />
          <meshStandardMaterial color="#687066" roughness={0.88} />
        </mesh>
        <mesh castShadow={preset.shadowsEnabled} receiveShadow={preset.shadowsEnabled} position={[-5.4, 6.6, -26.5]}>
          <boxGeometry args={[1.0, 4.8, 10.2]} />
          <meshStandardMaterial color="#687066" roughness={0.88} />
        </mesh>
      </RigidBody>

      <RigidBody type="fixed" position={[0, 4.7, -28.0]} colliders="cuboid">
        <mesh castShadow={preset.shadowsEnabled} receiveShadow={preset.shadowsEnabled}>
          <boxGeometry args={[2.6, 1.0, 2.6]} />
          <meshStandardMaterial color="#7e877b" roughness={0.82} />
        </mesh>
      </RigidBody>

      <CheckpointBeacon
        id="ruins-plaza"
        chunkId="l1-ruins"
        position={[0, 4.2, -11.5]}
        spawnPos={[0, 4.4, -11.5]}
        label="Ancient Ruins Courtyard"
      />
    </>
  );
}
