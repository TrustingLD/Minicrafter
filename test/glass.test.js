import test from 'node:test';
import assert from 'node:assert/strict';

import { BLOCK_TYPES, BLOCK_ID, TRANSPARENT_IDS } from '../src/data/blocks.js';
import { ITEM_NAMES } from '../src/data/items.js';
import { SMELTING } from '../src/data/recipes.js';
import { meshChunk } from '../src/render/mesher.js';
import { CHUNK_X, CHUNK_Y, CHUNK_Z, idx } from '../src/world/chunk.js';

test('glass block definition and registration', () => {
  assert.ok(BLOCK_TYPES.glass, 'glass block definition exists');
  assert.equal(BLOCK_TYPES.glass.name, 'Verre');
  assert.equal(BLOCK_TYPES.glass.transparent, true);
  assert.ok(TRANSPARENT_IDS.has(BLOCK_TYPES.glass.id), 'glass id is included in TRANSPARENT_IDS');
  assert.equal(ITEM_NAMES.glass, 'Verre', 'glass is in ITEM_NAMES');
});

test('glass smelting recipe', () => {
  assert.equal(SMELTING.sand, 'glass', 'sand smelts into glass in SMELTING dictionary');
});

test('meshChunk handles glass transparent block culling correctly', () => {
  const dummyUV = {
    [BLOCK_ID.stone]: { top: [0, 0, 1, 1], bottom: [0, 0, 1, 1], side: [0, 0, 1, 1] },
    [BLOCK_ID.glass]: { top: [0, 0, 1, 1], bottom: [0, 0, 1, 1], side: [0, 0, 1, 1] },
  };

  // Case A: 1 glass block isolated in air -> 6 faces (24 vertices)
  const data1 = new Uint8Array(CHUNK_X * CHUNK_Y * CHUNK_Z);
  data1[idx(5, 5, 5)] = BLOCK_ID.glass;
  const result1 = meshChunk(data1, dummyUV);
  assert.equal(result1.positions.length / (4 * 3), 6, 'single glass block has 6 faces');

  // Case B: 2 adjacent glass blocks -> shared face is culled (10 faces total: 6 + 6 - 2 = 10 faces)
  const data2 = new Uint8Array(CHUNK_X * CHUNK_Y * CHUNK_Z);
  data2[idx(5, 5, 5)] = BLOCK_ID.glass;
  data2[idx(6, 5, 5)] = BLOCK_ID.glass;
  const result2 = meshChunk(data2, dummyUV);
  assert.equal(result2.positions.length / (4 * 3), 10, 'two adjacent glass blocks cull their shared internal face');

  // Case C: stone block adjacent to glass block -> stone draws its face facing glass
  const data3 = new Uint8Array(CHUNK_X * CHUNK_Y * CHUNK_Z);
  data3[idx(5, 5, 5)] = BLOCK_ID.stone;
  data3[idx(6, 5, 5)] = BLOCK_ID.glass;
  const result3 = meshChunk(data3, dummyUV);
  // stone: 6 faces (face towards glass is NOT culled because glass is transparent)
  // glass: 5 exposed faces (facing air) + face towards stone culled against opaque stone = 5 faces
  // Total: 11 faces
  assert.equal(result3.positions.length / (4 * 3), 11, 'stone block draws face adjacent to transparent glass');
});
