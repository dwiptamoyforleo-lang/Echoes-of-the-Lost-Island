import test from 'node:test';
import assert from 'node:assert/strict';
import {
  combineMoveInputs,
  resetVirtualTouchButtons,
  setVirtualSprint,
  toggleVirtualSprint,
  useVirtualTouchStore,
} from './usePlayerInput';

test('combineMoveInputs normalizes diagonal keyboard vectors to magnitude <= 1', () => {
  const res = combineMoveInputs(1, 1, 0, 0);
  const mag = Math.hypot(res.forward, res.right);
  assert.ok(Math.abs(mag - 1) < 1e-6);
  assert.ok(res.forward > 0.7 && res.right > 0.7);
});

test('combineMoveInputs passes through sub-unit virtual joystick vectors cleanly', () => {
  const res = combineMoveInputs(0, 0, -0.4, 0.3);
  assert.equal(res.right, -0.4);
  assert.equal(res.forward, 0.3);
});

test('combineMoveInputs clamps combined keyboard and joystick inputs to unit circle', () => {
  const res = combineMoveInputs(1, 0, 0.8, 0.9);
  const mag = Math.hypot(res.forward, res.right);
  assert.ok(mag <= 1 + 1e-6);
  assert.ok(res.forward > 0 && res.right > 0);
});

test('virtual touch sprint toggle and reset update Zustand touch store cleanly', () => {
  resetVirtualTouchButtons();
  assert.equal(useVirtualTouchStore.getState().sprintToggle, false);

  const toggledOn = toggleVirtualSprint();
  assert.equal(toggledOn, true);
  assert.equal(useVirtualTouchStore.getState().sprintToggle, true);

  setVirtualSprint(false);
  assert.equal(useVirtualTouchStore.getState().sprintToggle, false);

  toggleVirtualSprint();
  resetVirtualTouchButtons();
  assert.equal(useVirtualTouchStore.getState().sprintToggle, false);
});
