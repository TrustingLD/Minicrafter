import { test } from 'node:test';
import assert from 'node:assert/strict';
import { serializePosition, deserializePosition } from '../src/entities/position-save.js';

test('aller-retour simple : position, orientation et dimension ressortent identiques', () => {
  const json = serializePosition(12.5, 64, -3.25, 1.57, -0.3, 'overworld');
  const back = deserializePosition(json);
  assert.deepEqual(back, {
    x: 12.5,
    y: 64,
    z: -3.25,
    yaw: 1.57,
    pitch: -0.3,
    dimension: 'overworld',
  });
});

test('dimension "nether" conservée ; toute autre valeur retombe sur "overworld"', () => {
  assert.equal(deserializePosition(serializePosition(0, 0, 0, 0, 0, 'nether')).dimension, 'nether');
  assert.equal(deserializePosition(serializePosition(0, 0, 0, 0, 0, 'end')).dimension, 'overworld');
  assert.equal(
    deserializePosition(serializePosition(0, 0, 0, 0, 0, undefined)).dimension,
    'overworld',
  );
});

test('rien de sauvegardé (première partie) : null, pas une exception', () => {
  assert.equal(deserializePosition(null), null);
  assert.equal(deserializePosition(''), null);
  assert.equal(deserializePosition(undefined), null);
});

test("JSON corrompu ou de forme inattendue : null plutôt qu'une exception", () => {
  assert.equal(deserializePosition('{pas du json'), null);
  assert.equal(deserializePosition('42'), null);
  assert.equal(deserializePosition('null'), null);
  assert.equal(deserializePosition('"une chaine"'), null);
});

test('coordonnée manquante ou non numérique (NaN, Infinity, texte) : null', () => {
  assert.equal(deserializePosition(JSON.stringify({ x: 1, y: 2, yaw: 0, pitch: 0 })), null); // z manquant
  assert.equal(deserializePosition(JSON.stringify({ x: 1, y: 2, z: NaN, yaw: 0, pitch: 0 })), null);
  assert.equal(
    deserializePosition(JSON.stringify({ x: 1, y: Infinity, z: 3, yaw: 0, pitch: 0 })),
    null,
  );
  assert.equal(deserializePosition(JSON.stringify({ x: '1', y: 2, z: 3, yaw: 0, pitch: 0 })), null);
});

test('0 est une position/orientation valide (pas confondu avec "manquant")', () => {
  const back = deserializePosition(serializePosition(0, 0, 0, 0, 0, 'overworld'));
  assert.deepEqual(back, { x: 0, y: 0, z: 0, yaw: 0, pitch: 0, dimension: 'overworld' });
});
