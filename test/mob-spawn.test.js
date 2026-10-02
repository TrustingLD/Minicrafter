import { test } from 'node:test';
import assert from 'node:assert/strict';
import { hasSpawnRoom, mobActiveRadiusSqFor } from '../src/entities/mob-spawn.js';
import { MOBS } from '../src/data/mobs.js';
import { ITEM_NAMES, NON_PLACEABLE } from '../src/data/items.js';

// Petit monde synthétique : `solidCells` est un Set de "x,y,z" (blocs pleins). collidesAtBox
// balaie les cases que la boîte recoupe -- même contrat que world/world.js.
function makeCollides(solidCells) {
  return (x, y, z, radius, height) => {
    for (let bx = Math.floor(x - radius); bx <= Math.floor(x + radius); bx++)
      for (let bz = Math.floor(z - radius); bz <= Math.floor(z + radius); bz++)
        for (let by = Math.floor(y); by <= Math.floor(y + height); by++)
          if (solidCells.has(`${bx},${by},${bz}`)) return true;
    return false;
  };
}

test('espace dégagé (plaine à ciel ouvert) : tous les mobs, même les plus hauts, ont leur place', () => {
  const collides = makeCollides(new Set(['0,3,0'])); // un seul bloc de sol, sous les pieds
  for (const type of Object.keys(MOBS)) {
    assert.equal(hasSpawnRoom(collides, 0, 4, 0, type), true, type);
  }
});

test('plafond bas (1 bloc de libre) : les mobs courts passent, les hauts (zombie/villageois) non', () => {
  // sol en y=3, plafond en y=5 -> une seule case libre (y=4)
  const collides = makeCollides(new Set(['0,3,0', '0,5,0']));
  assert.equal(hasSpawnRoom(collides, 0, 4, 0, 'chicken'), true); // hauteur 0.6
  assert.equal(hasSpawnRoom(collides, 0, 4, 0, 'pig'), true); // hauteur 0.9
  assert.equal(hasSpawnRoom(collides, 0, 4, 0, 'zombie'), false); // hauteur 1.9 : la tête mord le plafond
  assert.equal(hasSpawnRoom(collides, 0, 4, 0, 'villager'), false); // hauteur 1.9, idem
});

test('un bloc empiète depuis le côté (mur voisin) : refusé si le rayon du mob y mord', () => {
  // sol continu en y=3 ; un mur solide occupe toute la colonne (1,*,0)
  const solid = new Set(['0,3,0', '1,3,0', '1,4,0', '1,5,0']);
  const collides = makeCollides(solid);
  // vache : radius 0.55 -> à x=0.5, [x-r, x+r] = [-0.05, 1.05] mord sur la colonne x=1
  assert.equal(hasSpawnRoom(collides, 0.5, 4, 0, 'cow'), false);
  // poulet : radius 0.28 -> [0.22, 0.78] ne mord pas sur x=1
  assert.equal(hasSpawnRoom(collides, 0.5, 4, 0, 'chicken'), true);
});

test('dans le sol (groundY mal calculé) : jamais de place, quel que soit le type', () => {
  const collides = makeCollides(new Set(['0,4,0'])); // bloc plein exactement là où on veut poser le mob
  for (const type of Object.keys(MOBS)) {
    assert.equal(hasSpawnRoom(collides, 0, 4, 0, type), false, type);
  }
});

test('chaque type de MOBS a un radius/height positif (sinon le contrôle ne veut rien dire)', () => {
  for (const [type, data] of Object.entries(MOBS)) {
    assert.ok(data.hitbox.radius > 0, type);
    assert.ok(data.hitbox.height > 0, type);
  }
});

/* ---------- Rampant (Phase 44) ---------- */

test('le Rampant est bien un mob "qui explose" : ai dédiée, et des gouttes de poudre à canon QUAND IL EST TUÉ (pas quand il explose -- ça, c\'est entities/mob.js : Mob.explode())', () => {
  const rampant = MOBS.rampant;
  assert.equal(rampant.ai, 'explode');
  assert.deepEqual(rampant.drops, [{ item: 'gunpowder', min: 1, max: 1 }]);
});

test('le Rampant a 4 pattes et pas de bras (silhouette à quatre pattes, pas humanoïde)', () => {
  const legs = MOBS.rampant.model.limbs.find((l) => l.group === 'legs');
  assert.equal(legs.positions.length, 4);
  assert.ok(!MOBS.rampant.model.limbs.some((l) => l.group === 'arms'));
});

test('la tête du Rampant a bien un visage dédié (faceTex), distinct de la texture du corps', () => {
  const head = MOBS.rampant.model.parts.find((p) => p.faceTex);
  assert.ok(head, 'une des parties doit porter faceTex');
  assert.notEqual(head.tex, head.faceTex);
});

test('la poudre à canon existe comme objet non posable, nommé « Poudre à canon »', () => {
  assert.equal(ITEM_NAMES.gunpowder, 'Poudre à canon');
  assert.ok(NON_PLACEABLE.has('gunpowder'));
});

/* ---------- mobActiveRadiusSqFor (rayon de simulation des mobs, Phase 43) ---------- */

test("à la distance de rendu par défaut (6 chunks, chunk=16 blocs) : retombe sur le rayon fixe d'origine (56 blocs)", () => {
  assert.equal(mobActiveRadiusSqFor(6, 16, 56), 56 * 56);
});

test('à faible distance de rendu : se réduit pour ne jamais dépasser le rayon de chunks chargés', () => {
  // 2 chunks * 16 - 16 = 16 blocs, bien en dessous des 56 par défaut
  assert.equal(mobActiveRadiusSqFor(2, 16, 56), 16 * 16);
});

test('à grande distance de rendu : plafonné au rayon par défaut, ne grandit jamais au-delà', () => {
  assert.equal(mobActiveRadiusSqFor(32, 16, 56), 56 * 56);
  assert.equal(mobActiveRadiusSqFor(32, 16, 56), mobActiveRadiusSqFor(10, 16, 56));
});

test('jamais négatif même à la distance de rendu minimale (2 chunks)', () => {
  assert.ok(mobActiveRadiusSqFor(2, 16, 56) >= 0);
});
