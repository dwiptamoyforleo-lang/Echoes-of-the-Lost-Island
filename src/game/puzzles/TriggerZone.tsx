import { useRef } from 'react';
import {
  CuboidCollider,
  RigidBody,
  type IntersectionEnterPayload,
  type IntersectionExitPayload,
} from '@react-three/rapier';
import { isPlayerPayload } from '@/src/game/physics';
import { eventBus } from '@/src/state/eventBus';
import { useGameStore } from '@/src/state/gameStore';

export interface TriggerZoneProps {
  id: string;
  chunkId?: string;
  position: [number, number, number];
  halfExtents: [number, number, number];
  once?: boolean;
  onEnter?: () => void;
  onExit?: () => void;
}

export function TriggerZone({
  id,
  chunkId,
  position,
  halfExtents,
  once = false,
  onEnter,
  onExit,
}: TriggerZoneProps) {
  const triggerStateKey = `trigger-${id}`;
  const persistedFired = useGameStore((s) =>
    once ? Boolean(s.activatedIds[triggerStateKey]) : false,
  );
  const triggeredRef = useRef(persistedFired);

  const handleEnter = (payload: IntersectionEnterPayload) => {
    if (!isPlayerPayload(payload)) return;
    if (once) {
      if (triggeredRef.current || useGameStore.getState().activatedIds[triggerStateKey]) {
        triggeredRef.current = true;
        return;
      }
      triggeredRef.current = true;
      useGameStore
        .getState()
        .setWorldObjectState(triggerStateKey, { chunkId, activated: true });
    }
    eventBus.emit('trigger:entered', { id });
    onEnter?.();
  };

  const handleExit = (payload: IntersectionExitPayload) => {
    if (!isPlayerPayload(payload)) return;
    onExit?.();
  };

  return (
    <RigidBody type="fixed" position={position} colliders={false} sensor>
      <CuboidCollider
        args={halfExtents}
        sensor
        onIntersectionEnter={handleEnter}
        onIntersectionExit={handleExit}
      />
    </RigidBody>
  );
}
