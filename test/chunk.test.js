import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  CHUNK_X,
  CHUNK_Y,
  CHUNK_Z,
  idx,
  inBounds,
  worldToChunk,
  worldToLocal,
} from '../src/world/chunk.js';

test('idx is a bijection over the chunk volume (no collisions)', () => {
  const seen = new Set();
  for (let x = 0; x < CHUNK_X; x++)
    for (let y = 0; y < CHUNK_Y; y++)
      for (let z = 0; z < CHUNK_Z; z++) {
        const i = idx(x, y, z);
        assert.ok(!seen.has(i), `duplicate index at ${x},${y},${z}`);
        seen.add(i);
      }
  assert.equal(seen.size, CHUNK_X * CHUNK_Y * CHUNK_Z);
});

test('inBounds rejects coordinates outside the chunk', () => {
  assert.equal(inBounds(0, 0, 0), true);
  assert.equal(inBounds(CHUNK_X - 1, CHUNK_Y - 1, CHUNK_Z - 1), true);
  assert.equal(inBounds(-1, 0, 0), false);
  assert.equal(inBounds(CHUNK_X, 0, 0), false);
});

test('worldToChunk + worldToLocal round-trip to the original world coordinate', () => {
  for (const [x, z] of [
    [0, 0],
    [15, 15],
    [16, 0],
    [-1, -1],
    [-17, 33],
  ]) {
    const [cx, cz] = worldToChunk(x, z);
    const [lx, lz] = worldToLocal(x, z);
    assert.equal(cx * CHUNK_X + lx, x);
    assert.equal(cz * CHUNK_Z + lz, z);
  }
});
