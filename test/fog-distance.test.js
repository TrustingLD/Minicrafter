import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fogNearFor, fogFarFor } from '../src/render/fog-distance.js';

test('à la distance de rendu par défaut (6 chunks) : retombe exactement sur les anciennes valeurs fixes', () => {
  assert.equal(fogNearFor(6), 25);
  assert.equal(fogFarFor(6), 70);
});

test('near < far à toute distance de rendu du curseur (2 à 32)', () => {
  for (let rd = 2; rd <= 32; rd++) {
    assert.ok(fogNearFor(rd) < fogFarFor(rd), `rd=${rd}`);
  }
});

test('croît avec la distance de rendu (plus de chunks chargés -> le fog peut reculer)', () => {
  assert.ok(fogFarFor(2) < fogFarFor(6));
  assert.ok(fogFarFor(6) < fogFarFor(32));
  assert.ok(fogNearFor(2) < fogNearFor(32));
});

test('le fog lointain reste sous le rayon de chunks chargés (16 blocs/chunk), à toute distance', () => {
  for (let rd = 2; rd <= 32; rd++) {
    assert.ok(
      fogFarFor(rd) < rd * 16,
      `rd=${rd} : far=${fogFarFor(rd)} doit rester < ${rd * 16} blocs chargés`,
    );
  }
});

test('reste dans le plan éloigné de la caméra (600) même à la distance de rendu maximale (32)', () => {
  assert.ok(fogFarFor(32) < 600);
});
