import { test } from 'node:test';
import assert from 'node:assert/strict';
import { generateChunk, getHeight } from '../src/world/generator.js';
import { BLOCK_ID, BLOCK_BY_ID } from '../src/data/blocks.js';
import { CHUNK_X, CHUNK_Y, CHUNK_Z, idx } from '../src/world/chunk.js';

test('generateChunk is deterministic: same coords -> identical bytes every time', () => {
  const a = generateChunk(3, -2);
  const b = generateChunk(3, -2);
  assert.deepEqual(Array.from(a.data), Array.from(b.data));
  assert.deepEqual(a.waterCells, b.waterCells);
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
