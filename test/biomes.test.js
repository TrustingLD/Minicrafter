import { test } from 'node:test';
import assert from 'node:assert/strict';
import { temperature, humidity, biomeAt, BIOMES } from '../src/world/biomes.js';

test('temperature/humidity: deterministic and stay within [0,1]', () => {
  for (const [x, z] of [
    [0, 0],
    [123, -45],
    [-900, 900],
  ]) {
    const t1 = temperature(x, z),
      t2 = temperature(x, z);
    assert.equal(t1, t2);
    assert.ok(t1 >= 0 && t1 <= 1);
    const h1 = humidity(x, z),
      h2 = humidity(x, z);
    assert.equal(h1, h2);
    assert.ok(h1 >= 0 && h1 <= 1);
  }
});

test('biomeAt: isOcean always wins, regardless of temperature/humidity/mountain', () => {
  assert.equal(biomeAt(0, 0, 0.9, true), 'ocean');
  assert.equal(biomeAt(500, 500, 0, true), 'ocean');
});

test('biomeAt: a strong mountain mask wins over ocean=false', () => {
  assert.equal(biomeAt(0, 0, 0.2, false), 'mountains');
});

test('biomeAt: always returns a name present in BIOMES (never an unknown key)', () => {
  for (let x = -200; x <= 200; x += 37) {
    for (let z = -200; z <= 200; z += 41) {
      const biome = biomeAt(x, z, 0, false);
      assert.ok(BIOMES[biome], `unknown biome "${biome}" at (${x},${z})`);
    }
  }
});

test('biomeAt: produces more than one biome across a wide sample (variety, not a constant)', () => {
  const seen = new Set();
  for (let x = -300; x <= 300; x += 23) {
    for (let z = -300; z <= 300; z += 29) {
      seen.add(biomeAt(x, z, 0, false));
    }
  }
  assert.ok(seen.size > 1, `expected biome variety, only saw: ${[...seen]}`);
});
