import { useEffect, type ReactNode } from 'react';
import { Physics, useRapier } from '@react-three/rapier';
import { getQualityPreset } from '@/src/game/rendering/adaptiveQuality';
import { useGameStore } from '@/src/state/gameStore';

let loggedRapierInit = false;

function RapierInitLogger() {
  const { rapier } = useRapier();

  useEffect(() => {
    if (!loggedRapierInit && rapier) {
      loggedRapierInit = true;
      console.info(
        `[Journey Home] rapier=initialized (${rapier.version?.() ?? 'wasm-ready'})`,
      );
    }
  }, [rapier]);

  return null;
}

export interface PhysicsWorldProps {
  children: ReactNode;
  paused?: boolean;
}

export function PhysicsWorld({ children, paused = false }: PhysicsWorldProps) {
  const activeTier = useGameStore((s) => s.activeQualityTier);
  const preset = getQualityPreset(activeTier);
  const timeStep = 1 / preset.physicsHz;

  return (
    <Physics
      gravity={[0, -9.81, 0]}
      paused={paused}
      timeStep={timeStep}
      maxCcdSubsteps={2}
    >
      <RapierInitLogger />
      {children}
    </Physics>
  );
}
