import { test } from 'node:test';
import assert from 'node:assert/strict';
import { explosionSpares, explosionDamageAt } from '../src/world/explosion.js';

/* ---------- explosionSpares ---------- */

test('bloc incassable (hardness Infinity, ex. bedrock/eau/lave) : toujours épargné', () => {
  assert.equal(explosionSpares('bedrock', { hardness: Infinity }), true);
  assert.equal(explosionSpares('water', { hardness: Infinity }), true);
});

test('bloc ordinaire cassable : jamais épargné', () => {
  assert.equal(explosionSpares('stone', { hardness: 1.5 }), false);
  assert.equal(explosionSpares('dirt', { hardness: 0.5 }), false);
});

test('aucune définition de bloc (inconnu ou air) : épargné -- rien à détruire', () => {
  assert.equal(explosionSpares('air', undefined), true);
  assert.equal(explosionSpares('mystere', null), true);
});

test('structures multi-blocs (lit, porte, piston) : toujours épargnées, quelle que soit la variante', () => {
  for (const type of [
    'bed_foot',
    'bed_head',
    'door_bottom_x_closed',
    'door_top_z_open',
    'piston_base_x_extended',
    'piston_head_z',
  ]) {
    assert.equal(explosionSpares(type, { hardness: 1.5 }), true, type);
  }
});

/* ---------- explosionDamageAt ---------- */

test('à bout portant (dist=0) : dégâts maximaux', () => {
  assert.equal(explosionDamageAt(0, 3.5, 10), 10);
});

test('au rayon exact ou au-delà : aucun dégât', () => {
  assert.equal(explosionDamageAt(3.5, 3.5, 10), 0);
  assert.equal(explosionDamageAt(5, 3.5, 10), 0);
});

test("dégressif entre les deux, jamais 0 strictement à l'intérieur du rayon", () => {
  const near = explosionDamageAt(1, 3.5, 10);
  const far = explosionDamageAt(3, 3.5, 10);
  assert.ok(near > far, `near=${near} doit être > far=${far}`);
  assert.ok(far > 0, `far=${far} doit rester > 0 juste avant le bord`);
});

test("arrondi au supérieur (jamais 0 dégâts par troncature tant qu'on est dans le rayon)", () => {
  // à 99% du rayon, le calcul brut donne 0.1 -- doit arrondir à 1, pas tomber à 0
  const dmg = explosionDamageAt(3.465, 3.5, 10);
  assert.equal(dmg, 1);
});
