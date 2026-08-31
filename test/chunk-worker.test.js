import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildChunkResult, collectTransferables } from '../src/worker/chunk-worker.js';
import { generateChunk } from '../src/world/generator.js';
import { meshChunk, meshLiquid } from '../src/render/mesher.js';
import { BLOCK_TYPES, LIQUID_IDS, SHAPE_BY_ID, TRANSPARENT_IDS, BLOCK_ID } from '../src/data/blocks.js';

// pas de vrai atlas ici (buildBlockAtlas() a besoin de `document`, absent sous
// node --test) : un rect [0,0,1,1] identique pour chaque bloc suffit à vérifier
// que le worker produit EXACTEMENT ce que le chemin synchrone produirait.
const FAKE_UV = Object.fromEntries(
  Object.values(BLOCK_TYPES).map((b) => [
    b.id,
    { top: [0, 0, 1, 1], bottom: [0, 0, 1, 1], side: [0, 0, 1, 1] },
  ]),
);

test('buildChunkResult: produces the exact same block data as calling generateChunk directly', () => {
  const fromWorker = buildChunkResult(2, -3, FAKE_UV);
  const direct = generateChunk(2, -3);
  assert.deepEqual(Array.from(fromWorker.data), Array.from(direct.data));
});

test('buildChunkResult: the opaque/water/lava geometries match calling the mesher directly on the same data', () => {
  const { data, opaque, water, lava } = buildChunkResult(1, 1, FAKE_UV);
  const expectedOpaque = meshChunk(data, FAKE_UV, undefined, LIQUID_IDS, SHAPE_BY_ID, TRANSPARENT_IDS);
  // topOnly=true pour l'eau : le worker (chunk-worker.js) applique le même réglage,
  // cf. mesher.js meshLiquid.
  const expectedWater = meshLiquid(data, BLOCK_ID.water, LIQUID_IDS, undefined, true);
  const expectedLava = meshLiquid(data, BLOCK_ID.lava, LIQUID_IDS);
  assert.deepEqual(Array.from(opaque.positions), Array.from(expectedOpaque.positions));
  assert.deepEqual(Array.from(water.positions), Array.from(expectedWater.positions));
  assert.deepEqual(Array.from(lava.positions), Array.from(expectedLava.positions));
});

test('buildChunkResult: is deterministic across repeated calls, same as the synchronous path', () => {
  const a = buildChunkResult(5, 5, FAKE_UV);
  const b = buildChunkResult(5, 5, FAKE_UV);
  assert.deepEqual(Array.from(a.data), Array.from(b.data));
  assert.deepEqual(Array.from(a.opaque.indices), Array.from(b.opaque.indices));
});

test('collectTransferables: lists every typed array buffer produced (1 block grid + 3 geometries x 5 arrays)', () => {
  const result = buildChunkResult(0, 0, FAKE_UV);
  const buffers = collectTransferables(result);
  assert.equal(buffers.length, 1 + 3 * 5);
  assert.ok(buffers.every((b) => b instanceof ArrayBuffer));
});
