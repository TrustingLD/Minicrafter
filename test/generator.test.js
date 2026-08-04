import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  generateChunk,
  getHeight,
  getBiome,
  findSpawnColumn,
  SEA_LEVEL,
} from '../src/world/generator.js';
import { BLOCK_ID, BLOCK_BY_ID } from '../src/data/blocks.js';
import { CHUNK_X, CHUNK_Y, CHUNK_Z, idx } from '../src/world/chunk.js';

test('generateChunk is deterministic: same coords -> identical bytes every time', () => {
  const a = generateChunk(3, -2);
  const b = generateChunk(3, -2);
  assert.deepEqual(Array.from(a.data), Array.from(b.data));
});

test('generateChunk: a lake column is filled with real water blocks up to SEA_LEVEL (Phase 16)', () => {
  // cherche une colonne dont le terrain est AU MOINS 2 sous SEA_LEVEL (h === SEA_LEVEL-1
  // veut dire le rivage exact, 0 bloc d'eau au-dessus -- pas un lac, juste la plage)
  let found = false;
  for (let cx = 0; cx < 6 && !found; cx++) {
    for (let cz = 0; cz < 6 && !found; cz++) {
      const { data } = generateChunk(cx, cz);
      for (let lx = 0; lx < CHUNK_X && !found; lx++) {
        for (let lz = 0; lz < CHUNK_Z && !found; lz++) {
          const wx = cx * CHUNK_X + lx,
            wz = cz * CHUNK_Z + lz;
          const h = getHeight(wx, wz);
          if (h >= SEA_LEVEL - 1) continue;
          found = true;
          assert.equal(data[idx(lx, SEA_LEVEL - 1, lz)], BLOCK_ID.water);
          assert.equal(data[idx(lx, h + 1, lz)], BLOCK_ID.water);
        }
      }
    }
  }
  assert.ok(found, 'expected at least one column with >=1 water block in the sampled chunks');
});

test('generateChunk: y=0 is always bedrock (world floor)', () => {
  const { data } = generateChunk(0, 0);
  for (let x = 0; x < CHUNK_X; x++)
    for (let z = 0; z < CHUNK_Z; z++) assert.equal(data[idx(x, 0, z)], BLOCK_ID.bedrock);
});

test('generateChunk: every non-air block above y=0 is a known block id', () => {
  const { data } = generateChunk(1, 1);
  for (let i = 0; i < data.length; i++) {
    const id = data[i];
    if (id === 0) continue;
    assert.ok(BLOCK_BY_ID[id], `unknown block id ${id} at flat index ${i}`);
  }
});

test('generateChunk: some ore appears within a reasonably large sample of chunks', () => {
  let oreCount = 0;
  for (let cx = 0; cx < 6; cx++) {
    for (let cz = 0; cz < 6; cz++) {
      const { data } = generateChunk(cx, cz);
      for (const id of data) if (id === BLOCK_ID.coal_ore) oreCount++;
    }
  }
  assert.ok(oreCount > 0, 'expected at least some coal ore across a 6x6 chunk sample');
});

test('generateChunk: sand appears within a reasonably large sample of chunks (Phase 17 biomes)', () => {
  let sandCount = 0;
  for (let cx = -5; cx < 5; cx++) {
    for (let cz = -5; cz < 5; cz++) {
      const { data } = generateChunk(cx, cz);
      for (const id of data) if (id === BLOCK_ID.sand) sandCount++;
    }
  }
  assert.ok(
    sandCount > 0,
    'expected at least some sand across a 10x10 chunk sample (desert/ocean shore)',
  );
});

test('getHeight is deterministic and stays within the documented [1, 58] range', () => {
  for (const [x, z] of [
    [0, 0],
    [100, -50],
    [-7, 42],
  ]) {
    const h1 = getHeight(x, z);
    const h2 = getHeight(x, z);
    assert.equal(h1, h2);
    assert.ok(h1 >= 1 && h1 <= 58);
  }
});

// Régression : le jeu plaçait le joueur en dur en (0,0), en supposant que c'était une
// colonne jouable. Ça ne l'était pas — (0,0) est un point du treillis de `noiseRiver`,
// où un bruit de Perlin vaut exactement 0, donc `1 - |bruit|` y est MAXIMAL : une
// tranchée de rivière garantie, sous le niveau de la mer. Le joueur naissait au fond
// d'un trou noyé et dans le noir. Ces tests gardent les deux moitiés du correctif.
test('getHeight: the world origin is dry land, not the bottom of a river trench', () => {
  assert.ok(
    getHeight(0, 0) > SEA_LEVEL,
    `origin must sit above sea level, got ${getHeight(0, 0)} <= ${SEA_LEVEL}`,
  );
});

test('findSpawnColumn returns a dry, non-ocean column (deterministic)', () => {
  const a = findSpawnColumn();
  const b = findSpawnColumn();
  assert.deepEqual(a, b, 'spawn must be stable across calls (pure function of the noise)');
  assert.ok(a.y > SEA_LEVEL, `spawn y=${a.y} must be above sea level ${SEA_LEVEL}`);
  assert.equal(a.y, getHeight(a.x, a.z), 'spawn y must be the surface of its own column');
  assert.notEqual(getBiome(a.x, a.z), 'ocean');
});
