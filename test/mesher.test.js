import { test } from 'node:test';
import assert from 'node:assert/strict';
import { meshChunk } from '../src/render/mesher.js';
import { CHUNK_X, CHUNK_Y, CHUNK_Z, idx } from '../src/world/chunk.js';

const FAKE_UV = { 1: { top: [0, 0, 1, 1], bottom: [0, 0, 1, 1], side: [0, 0, 1, 1] } };

test('meshChunk: an empty chunk produces no geometry', () => {
  const data = new Uint8Array(CHUNK_X * CHUNK_Y * CHUNK_Z);
  const { positions, indices } = meshChunk(data, FAKE_UV);
  assert.equal(positions.length, 0);
  assert.equal(indices.length, 0);
});

test('meshChunk: a single block surrounded by air produces exactly 6 faces', () => {
  const data = new Uint8Array(CHUNK_X * CHUNK_Y * CHUNK_Z);
  data[idx(5, 5, 5)] = 1;
  const { positions, indices } = meshChunk(data, FAKE_UV);
  assert.equal(positions.length / 3, 6 * 4); // 6 faces * 4 verts
  assert.equal(indices.length, 6 * 6); // 6 faces * 2 tris * 3 indices
});

test('meshChunk: two adjacent blocks hide their shared face', () => {
  const data = new Uint8Array(CHUNK_X * CHUNK_Y * CHUNK_Z);
  data[idx(5, 5, 5)] = 1;
  data[idx(6, 5, 5)] = 1;
  const { positions } = meshChunk(data, FAKE_UV);
  // 2 blocks * 6 faces - 2 hidden faces (one on each block) = 10 faces
  assert.equal(positions.length / 3, 10 * 4);
});
