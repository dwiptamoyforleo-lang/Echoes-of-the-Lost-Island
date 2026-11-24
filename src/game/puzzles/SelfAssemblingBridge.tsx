import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { CuboidCollider, RigidBody } from '@react-three/rapier';
import * as THREE from 'three';

export interface SelfAssemblingBridgeProps {
  id: string;
  start: [number, number, number];
  end: [number, number, number];
  segments?: number;
  width?: number;
  active: boolean;
  stoneColor?: string;
  trimColor?: string;
}

function AssemblingSlab({
  targetPos,
  rotationY,
  size,
  delayOrder,
  active,
  stoneColor,
  trimColor,
}: {
  targetPos: [number, number, number];
  rotationY: number;
  size: [number, number, number];
  delayOrder: number;
  active: boolean;
  stoneColor: string;
  trimColor: string;
}) {
  const groupRef = useRef<THREE.Group>(null);
  const progressRef = useRef(active ? 1 : 0);

  useFrame((state, rawDt) => {
    const dt = Math.min(rawDt, 0.05);
    const speed = active ? 3.2 - Math.min(1.6, delayOrder * 0.25) : 4.0;
    progressRef.current = THREE.MathUtils.lerp(
      progressRef.current,
      active ? 1 : 0,
      1 - Math.exp(-Math.max(1.2, speed) * dt),
    );
    const p = progressRef.current;
    if (groupRef.current) {
      const floatBob = active
        ? 0
        : Math.sin(state.clock.elapsedTime * 1.6 + delayOrder) * 0.18;
      groupRef.current.position.y = -3.8 * (1 - p) + floatBob;
      groupRef.current.rotation.z = (1 - p) * (delayOrder % 2 === 0 ? 0.35 : -0.35);
      groupRef.current.scale.setScalar(0.35 + p * 0.65);
    }
  });

  return (
    <group position={targetPos} rotation={[0, rotationY, 0]}>
      {active && (
        <RigidBody type="fixed" colliders={false} friction={1.0}>
          <CuboidCollider args={[size[0] / 2, size[1] / 2, size[2] / 2]} />
        </RigidBody>
      )}
      <group ref={groupRef}>
        <mesh castShadow receiveShadow>
          <boxGeometry args={size} />
          <meshStandardMaterial
            color={stoneColor}
            roughness={0.75}
            metalness={0.08}
            transparent={!active}
            opacity={active ? 1 : 0.36}
          />
        </mesh>
        <mesh position={[0, size[1] / 2 + 0.02, 0]}>
          <boxGeometry args={[size[0] * 0.78, 0.04, size[2] * 0.78]} />
          <meshStandardMaterial
            color={trimColor}
            emissive={trimColor}
            emissiveIntensity={active ? 0.85 : 0.25}
            roughness={0.3}
          />
        </mesh>
      </group>
    </group>
  );
}

export function SelfAssemblingBridge({
  id,
  start,
  end,
  segments = 5,
  width = 3.4,
  active,
  stoneColor = '#e6decb',
  trimColor = '#fbbf24',
}: SelfAssemblingBridgeProps) {
  const { slabs, rotationY, segLen } = useMemo(() => {
    const dx = end[0] - start[0];
    const dy = end[1] - start[1];
    const dz = end[2] - start[2];
    const dist = Math.hypot(dx, dz) || 1;
    const angle = Math.atan2(dx, dz);
    const len = dist / segments + 0.06;

    const list: Array<{ key: string; pos: [number, number, number]; idx: number }> = [];
    for (let i = 0; i < segments; i++) {
      const t = (i + 0.5) / segments;
      list.push({
        key: `${id}-slab-${i}`,
        pos: [start[0] + dx * t, start[1] + dy * t, start[2] + dz * t],
        idx: i,
      });
    }
    return { slabs: list, rotationY: angle, segLen: len };
  }, [id, start, end, segments]);

  return (
    <group name={`self-assembling-bridge-${id}`}>
      {slabs.map((slab) => (
        <AssemblingSlab
          key={slab.key}
          targetPos={slab.pos}
          rotationY={rotationY}
          size={[width, 0.42, segLen]}
          delayOrder={slab.idx}
          active={active}
          stoneColor={stoneColor}
          trimColor={trimColor}
        />
      ))}
    </group>
  );
}
