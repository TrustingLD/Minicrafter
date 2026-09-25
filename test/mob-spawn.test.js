import { test } from 'node:test';
import assert from 'node:assert/strict';
import { hasSpawnRoom } from '../src/entities/mob-spawn.js';
import { MOBS } from '../src/data/mobs.js';

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
