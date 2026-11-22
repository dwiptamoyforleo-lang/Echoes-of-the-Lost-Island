import test from 'node:test';
import assert from 'node:assert/strict';
import {
  LEVEL1_CRYSTALS,
  LEVEL1_SPAWN,
  classifyTerrainBiome,
  getIslandHeight,
} from './level1Terrain';

test('getIslandHeight places spawn, cave, shrines, and ruins above sea level', () => {
  const spawnH = getIslandHeight(LEVEL1_SPAWN[0], LEVEL1_SPAWN[2]);
  assert.ok(spawnH > 1.0 && spawnH < 2.0, `spawnH was ${spawnH}`);

  const westShrineH = getIslandHeight(-20, 4);
  assert.ok(Math.abs(westShrineH - 4.5) < 0.15, `westShrineH was ${westShrineH}`);

  const eastShrineH = getIslandHeight(22, -2);
  assert.ok(Math.abs(eastShrineH - 4.5) < 0.15, `eastShrineH was ${eastShrineH}`);

  const caveH = getIslandHeight(-22, -16);
  assert.ok(Math.abs(caveH - 2.5) < 0.15, `caveH was ${caveH}`);

  const ruinsH = getIslandHeight(0, -24);
  assert.ok(Math.abs(ruinsH - 4.2) < 0.15, `ruinsH was ${ruinsH}`);

  // Deep ocean beyond perimeter is submerged
  const oceanH = getIslandHeight(48, 48);
  assert.ok(oceanH < -1.5, `oceanH was ${oceanH}`);
});

test('LEVEL1_CRYSTALS contains exactly 20 unique crystals above terrain', () => {
  assert.equal(LEVEL1_CRYSTALS.length, 20);
  const ids = new Set(LEVEL1_CRYSTALS.map((c) => c.id));
  assert.equal(ids.size, 20);
  for (const c of LEVEL1_CRYSTALS) {
    assert.ok(c.position[1] > 0.5, `crystal ${c.id} too low: ${c.position[1]}`);
  }
});

test('classifyTerrainBiome distinguishes water, sand, grass, and rock', () => {
  assert.equal(classifyTerrainBiome(-0.5, 1), 'water');
  assert.equal(classifyTerrainBiome(0.8, 0.95), 'sand');
  assert.equal(classifyTerrainBiome(2.8, 0.92), 'grass');
  assert.equal(classifyTerrainBiome(3.0, 0.65), 'rock');
});
