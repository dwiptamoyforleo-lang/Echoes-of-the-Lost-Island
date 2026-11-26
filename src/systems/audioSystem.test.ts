import test from 'node:test';
import assert from 'node:assert/strict';
import {
  applyAudioSettings,
  computeCrystalComboStep,
  getAmbientForScene,
  getAudioVolumes,
  getMusicThemeForScene,
  isAudioMutedForBlur,
  isAudioUnlocked,
  resetAudioSystemForTests,
  resetCrystalCombo,
  resolveSurfaceType,
  setAudioMutedForBlur,
  unlockAudio,
} from './audioSystem';
import { DEFAULT_SETTINGS } from './saveSystem';

test('audio stays locked before user interaction and unlocks on first gesture', () => {
  resetAudioSystemForTests();
  assert.equal(isAudioUnlocked(), false);

  unlockAudio();
  assert.equal(isAudioUnlocked(), true);
});

test('blur mute toggles and restores cleanly without overwriting user volumes', () => {
  resetAudioSystemForTests();
  applyAudioSettings({
    masterVolume: 0.6,
    musicVolume: 0.4,
    sfxVolume: 0.9,
  });

  setAudioMutedForBlur(true);
  assert.equal(isAudioMutedForBlur(), true);
  assert.deepEqual(getAudioVolumes(), {
    masterVolume: 0.6,
    musicVolume: 0.4,
    sfxVolume: 0.9,
  });

  setAudioMutedForBlur(false);
  assert.equal(isAudioMutedForBlur(), false);
});

test('applyAudioSettings clamps volume sliders into [0, 1]', () => {
  resetAudioSystemForTests();
  applyAudioSettings({
    masterVolume: 1.8,
    musicVolume: -0.4,
    sfxVolume: 0.55,
  });
  assert.deepEqual(getAudioVolumes(), {
    masterVolume: 1,
    musicVolume: 0,
    sfxVolume: 0.55,
  });
});

test('scene routing selects distinct music themes and level ambient loops', () => {
  assert.equal(getMusicThemeForScene('mainMenu', 'level1'), 'menu');
  assert.equal(getMusicThemeForScene('worldMap', 'level3'), 'menu');
  assert.equal(getMusicThemeForScene('settings', 'level4'), 'menu');
  assert.equal(getMusicThemeForScene('playing', 'level1'), 'level1');
  assert.equal(getMusicThemeForScene('playing', 'level5'), 'level5');
  assert.equal(getMusicThemeForScene('playing', 'testArena'), 'level1');

  assert.equal(getAmbientForScene('mainMenu', 'level1'), null);
  assert.equal(getAmbientForScene('playing', 'level1'), 'level1');
  assert.equal(getAmbientForScene('paused', 'level3'), 'level3');
  assert.equal(getAmbientForScene('playing', 'level4'), 'level4');
});

test('crystal combo step rises within combo window and resets after timeout', () => {
  resetCrystalCombo();
  assert.equal(computeCrystalComboStep(1000), 0);
  assert.equal(computeCrystalComboStep(1500), 1);
  assert.equal(computeCrystalComboStep(2100), 2);
  assert.equal(computeCrystalComboStep(2600), 3);

  // Gap > 2600ms resets pitch combo back to base step 0
  assert.equal(computeCrystalComboStep(6200), 0);
});

test('resolveSurfaceType maps biomes and landmarks to sand, grass, stone, and snow', () => {
  assert.equal(resolveSurfaceType('level1', { x: 0, y: 0.4, z: 16 }), 'sand');
  assert.equal(resolveSurfaceType('level1', { x: 8, y: 3.1, z: 2 }), 'grass');
  assert.equal(resolveSurfaceType('level1', { x: 0, y: 4.4, z: -15 }), 'stone');
  assert.equal(resolveSurfaceType('level2', { x: 6, y: 2.5, z: 6 }), 'grass');
  assert.equal(resolveSurfaceType('level3', { x: 0, y: 1.0, z: 0 }), 'stone');
  assert.equal(resolveSurfaceType('level4', { x: 0, y: 2.0, z: 0 }), 'snow');
  assert.equal(resolveSurfaceType('level4', { x: 0, y: 2.0, z: 0 }, true), 'stone');
});

test('default settings use auto graphics quality across all devices', () => {
  assert.equal(DEFAULT_SETTINGS.graphicsQuality, 'auto');
});
