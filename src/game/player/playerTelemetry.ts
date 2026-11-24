import * as THREE from 'three';

export interface PlayerTelemetry {
  position: THREE.Vector3;
  velocity: THREE.Vector3;
  horizontalSpeed: number;
  grounded: boolean;
  onIce: boolean;
  sprinting: boolean;
  stamina: number;
  staminaExhausted: boolean;
  cameraYaw: number;
  playerColliderHandle: number | null;
}

export const playerTelemetry: PlayerTelemetry = {
  position: new THREE.Vector3(0, 0, 8),
  velocity: new THREE.Vector3(0, 0, 0),
  horizontalSpeed: 0,
  grounded: true,
  onIce: false,
  sprinting: false,
  stamina: 100,
  staminaExhausted: false,
  cameraYaw: 0,
  playerColliderHandle: null,
};
