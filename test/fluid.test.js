import { test } from 'node:test';
import assert from 'node:assert/strict';
import { stepFluidQueue, MAX_SPREAD_DISTANCE } from '../src/world/fluid.js';

// petit monde de test : Map "x,y,z" -> nom de bloc | null (air). Tout ce qui n'est
// pas dans la map est traité comme un chunk non chargé (undefined), comme en vrai.
function makeWorld(cells) {
  const map = new Map(Object.entries(cells));
  return (x, y, z) => {
    const key = `${x},${y},${z}`;
    return map.has(key) ? map.get(key) : undefined;
  };
}

test('stepFluidQueue: falling water (air below) always spreads down, ignoring distance budget', () => {
  const getBlock = makeWorld({ '0,4,0': null }); // air en dessous de la cellule d'eau
  const queue = [{ x: 0, y: 5, z: 0, type: 'water', dist: MAX_SPREAD_DISTANCE }]; // distance déjà épuisée
  const { spread } = stepFluidQueue(queue, 10, getBlock);
  assert.deepEqual(spread, [{ x: 0, y: 4, z: 0, type: 'water', dist: MAX_SPREAD_DISTANCE }]);
});

test('stepFluidQueue: a solid floor makes it spread sideways into air instead', () => {
  const getBlock = makeWorld({
    '0,4,0': 'stone', // plancher solide
    '1,5,0': null,
    '-1,5,0': null,
    '0,5,1': null,
    '0,5,-1': null,
  });
  const queue = [{ x: 0, y: 5, z: 0, type: 'water', dist: 0 }];
  const { spread } = stepFluidQueue(queue, 10, getBlock);
  assert.equal(spread.length, 4); // les 4 voisins horizontaux, tous de l'air
  assert.ok(spread.every((c) => c.dist === 1));
});

test('stepFluidQueue: does not spread sideways into an already-loaded solid or already-liquid cell', () => {
  const getBlock = makeWorld({
    '0,4,0': 'stone',
    '1,5,0': 'stone', // occupé
    '-1,5,0': 'water', // déjà de l'eau : pas une cible valide (pas === null)
    '0,5,1': null, // seule case vraiment vide
    '0,5,-1': undefined, // chunk non chargé : jamais une cible (cf. Phase 16.3, "if unloaded, drop it")
  });
  const queue = [{ x: 0, y: 5, z: 0, type: 'water', dist: 0 }];
  const { spread } = stepFluidQueue(queue, 10, getBlock);
  assert.deepEqual(spread, [{ x: 0, y: 5, z: 1, type: 'water', dist: 1 }]);
});

test('stepFluidQueue: refuses to spread sideways once the distance budget is exhausted', () => {
  const getBlock = makeWorld({
    '0,4,0': 'stone',
    '1,5,0': null,
  });
  const queue = [{ x: 0, y: 5, z: 0, type: 'water', dist: MAX_SPREAD_DISTANCE }];
  const { spread } = stepFluidQueue(queue, 10, getBlock);
  assert.deepEqual(spread, []); // portée déjà épuisée -> cette branche s'arrête net
});

test('stepFluidQueue: only processes up to `budget` cells per call, the rest stays queued', () => {
  const getBlock = makeWorld({ '0,4,0': null, '1,4,0': null, '2,4,0': null });
  const queue = [
    { x: 0, y: 5, z: 0, type: 'water', dist: 0 },
    { x: 1, y: 5, z: 0, type: 'water', dist: 0 },
    { x: 2, y: 5, z: 0, type: 'water', dist: 0 },
  ];
  const { spread, remaining } = stepFluidQueue(queue, 2, getBlock);
  assert.equal(spread.length, 2);
  assert.equal(remaining.length, 1);
  assert.equal(remaining[0].x, 2);
});

test('stepFluidQueue: lava behaves identically (the rule is generic over `type`)', () => {
  const getBlock = makeWorld({ '0,4,0': null });
  const queue = [{ x: 0, y: 5, z: 0, type: 'lava', dist: 0 }];
  const { spread } = stepFluidQueue(queue, 10, getBlock);
  assert.deepEqual(spread, [{ x: 0, y: 4, z: 0, type: 'lava', dist: 0 }]);
});
