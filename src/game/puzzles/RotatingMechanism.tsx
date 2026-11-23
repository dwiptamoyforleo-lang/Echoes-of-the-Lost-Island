import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { CuboidCollider, RigidBody } from '@react-three/rapier';
import * as THREE from 'three';
import { Interactable } from '@/src/game/collectibles/Interactable';
import { useGameStore } from '@/src/state/gameStore';
import { playPooledSynth } from '@/src/systems/audioSystem';

const COMPASS_LABELS = ['North', 'East', 'South', 'West'] as const;

export interface RotatingMechanismProps {
  id: string;
  chunkId?: string;
  label: string;
  position: [number, number, number];
  initialStep?: number;
  targetStep?: number;
  variant?: 'wheel' | 'statue';
  accentColor?: string;
  locked?: boolean;
  onStepChange?: (nextStep: number, id: string) => void;
}

/**
 * Reusable 4-direction rotating puzzle plinth ('wheel' or 'statue' silhouette).
 * Persists its current orientation step (0..3) in worldState.phase across chunk unloads.
 */
export function RotatingMechanism({
  id,
  chunkId,
  label,
  position,
  initialStep = 0,
  targetStep = 0,
  variant = 'wheel',
  accentColor = '#38bdf8',
  locked = false,
  onStepChange,
}: RotatingMechanismProps) {
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
    // Shortest modular interpolation across wraparound
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
    const cur = store.getWorldObjectState(id)?.phase ?? initialStep;
    const nextStep = (((cur + 1) % 4) + 4) % 4;
    store.setWorldObjectState(id, {
      chunkId,
      phase: nextStep,
      activated: nextStep === targetStep,
    });
    playPooledSynth('switch');
    store.showToast(`${label} rotated to face ${COMPASS_LABELS[nextStep]}`, 'info');
    onStepChange?.(nextStep, id);
  };

  const indicatorColor = isAligned ? '#34d399' : accentColor;
  const indicatorEmissive = isAligned ? '#10b981' : accentColor;

  return (
    <group position={position}>
      <Interactable
        id={id}
        prompt={
          locked
            ? `${label} Locked (${COMPASS_LABELS[currentStep]})`
            : `Press E to Rotate ${label} (Facing ${COMPASS_LABELS[currentStep]})`
        }
        radius={2.4}
        disabled={locked}
        onInteract={handleRotate}
      >
        <RigidBody type="fixed" colliders={false}>
          <CuboidCollider args={[0.6, 0.85, 0.6]} position={[0, 0.85, 0]} />
          <mesh castShadow receiveShadow position={[0, 0.35, 0]}>
            <cylinderGeometry args={[0.7, 0.84, 0.7, 8]} />
            <meshStandardMaterial color="#425059" roughness={0.86} />
          </mesh>
        </RigidBody>

        <group ref={rotorRef} position={[0, 0.7, 0]}>
          {variant === 'wheel' ? (
            <>
              <mesh castShadow receiveShadow position={[0, 0.48, 0]} rotation={[0, 0, Math.PI / 2]}>
                <cylinderGeometry args={[0.42, 0.42, 0.24, 12]} />
                <meshStandardMaterial color="#5c3d26" roughness={0.82} />
              </mesh>
              <mesh castShadow position={[0, 0.92, -0.25]}>
                <boxGeometry args={[0.16, 0.16, 0.68]} />
                <meshStandardMaterial
                  color={indicatorColor}
                  emissive={indicatorEmissive}
                  emissiveIntensity={isAligned ? 1.3 : 0.6}
                />
              </mesh>
              <mesh castShadow position={[0, 0.92, -0.62]} rotation={[-Math.PI / 2, 0, 0]}>
                <coneGeometry args={[0.18, 0.32, 4]} />
                <meshStandardMaterial
                  color={indicatorColor}
                  emissive={indicatorEmissive}
                  emissiveIntensity={isAligned ? 1.5 : 0.75}
                />
              </mesh>
            </>
          ) : (
            <>
              {/* Carved Guardian Statue Torso & Crown Facing -Z (North at step 0) */}
              <mesh castShadow receiveShadow position={[0, 0.65, 0]}>
                <boxGeometry args={[0.62, 1.1, 0.46]} />
                <meshStandardMaterial color="#4d606c" roughness={0.82} />
              </mesh>
              <mesh castShadow receiveShadow position={[0, 1.42, 0]}>
                <boxGeometry args={[0.4, 0.44, 0.38]} />
                <meshStandardMaterial color="#596e7a" roughness={0.8} />
              </mesh>
              {/* Forward-Facing Carved Shield / Sight Emblem */}
              <mesh castShadow position={[0, 0.78, -0.32]}>
                <boxGeometry args={[0.32, 0.56, 0.16]} />
                <meshStandardMaterial
                  color={indicatorColor}
                  emissive={indicatorEmissive}
                  emissiveIntensity={isAligned ? 1.35 : 0.65}
                />
              </mesh>
              <mesh castShadow position={[0, 1.45, -0.24]} rotation={[-Math.PI / 2, 0, 0]}>
                <coneGeometry args={[0.12, 0.24, 4]} />
                <meshStandardMaterial
                  color={indicatorColor}
                  emissive={indicatorEmissive}
                  emissiveIntensity={isAligned ? 1.4 : 0.7}
                />
              </mesh>
            </>
          )}
        </group>
      </Interactable>
    </group>
  );
}
