import { useEffect, useRef, type ReactNode } from 'react';
import {
  BallCollider,
  CuboidCollider,
  RigidBody,
  type IntersectionEnterPayload,
  type IntersectionExitPayload,
} from '@react-three/rapier';
import { isPlayerPayload } from '@/src/game/physics';
import { eventBus } from '@/src/state/eventBus';
import { useGameStore } from '@/src/state/gameStore';

export interface InteractableProps {
  id: string;
  prompt: string;
  position?: [number, number, number];
  radius?: number;
  boxHalfExtents?: [number, number, number];
  disabled?: boolean;
  onInteract: () => void;
  children?: ReactNode;
}

export function Interactable({
  id,
  prompt,
  position = [0, 0, 0],
  radius = 2.1,
  boxHalfExtents,
  disabled = false,
  onInteract,
  children,
}: InteractableProps) {
  const inRangeRef = useRef(false);
  const onInteractRef = useRef(onInteract);
  onInteractRef.current = onInteract;

  useEffect(() => {
    if (disabled) {
      inRangeRef.current = false;
      useGameStore.getState().clearActivePromptIfId(id);
    }
  }, [disabled, id]);

  useEffect(() => {
    const unsub = eventBus.on('player:interact', () => {
      if (disabled || !inRangeRef.current) return;
      const active = useGameStore.getState().activePrompt;
      if (active?.id === id) {
        onInteractRef.current();
      }
    });

    return () => {
      unsub();
      useGameStore.getState().clearActivePromptIfId(id);
    };
  }, [id, disabled]);

  const handleEnter = (payload: IntersectionEnterPayload) => {
    if (disabled || !isPlayerPayload(payload)) return;
    inRangeRef.current = true;
    useGameStore.getState().setActivePrompt({ id, label: prompt });
  };

  const handleExit = (payload: IntersectionExitPayload) => {
    if (!isPlayerPayload(payload)) return;
    inRangeRef.current = false;
    useGameStore.getState().clearActivePromptIfId(id);
  };

  return (
    <group position={position}>
      {children}
      <RigidBody type="fixed" colliders={false} sensor>
        {boxHalfExtents ? (
          <CuboidCollider
            args={boxHalfExtents}
            sensor
            onIntersectionEnter={handleEnter}
            onIntersectionExit={handleExit}
          />
        ) : (
          <BallCollider
            args={[radius]}
            sensor
            onIntersectionEnter={handleEnter}
            onIntersectionExit={handleExit}
          />
        )}
      </RigidBody>
    </group>
  );
}
