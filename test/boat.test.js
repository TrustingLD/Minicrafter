import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  BOAT_HEIGHT,
  BOAT_RADIUS,
  BoatStatus,
  WATER_SURFACE,
  createBoatState,
  findDismountSpot,
  rayBoatBox,
  stepBoat,
  waterFraction,
} from '../src/entities/boat-physics.js';
import { matchRecipe } from '../src/data/crafting.js';
import { ITEM_NAMES, NON_PLACEABLE, RECIPES } from '../src/data/items.js';
import {
  MAX_STACK,
  addItem,
  canFit,
  createSlots,
  maxStackOf,
  moveSlot,
} from '../src/entities/inventory.js';

// Petit monde de test : `blocks(x,y,z)` renvoie 'water' | 'stone' | 'ice' | null. Mêmes
// contrats que world/world.js : isSolid = tout sauf air/eau, collidesAtBox = balayage des
// cases (bornes incluses) que la boîte recoupe.
function makeEnv(blocks) {
  const getBlock = (x, y, z) => blocks(x, y, z) ?? null;
  const isSolid = (x, y, z) => {
    const t = getBlock(x, y, z);
    return !!t && t !== 'water';
  };
  const collidesAtBox = (x, y, z, r, h) => {
    for (let bx = Math.floor(x - r); bx <= Math.floor(x + r); bx++)
      for (let bz = Math.floor(z - r); bz <= Math.floor(z + r); bz++)
        for (let by = Math.floor(y); by <= Math.floor(y + h); by++)
          if (isSolid(bx, by, bz)) return true;
    return false;
  };
  return { getBlock, isSolid, collidesAtBox };
}

// mer : pierre jusqu'à y=0, eau de y=1 à y=4 (surface visible à 4.875)
const SEA = makeEnv((x, y) => (y <= 0 ? 'stone' : y <= 4 ? 'water' : null));
const SURFACE = 4 + WATER_SURFACE;
// terre ferme : pierre jusqu'à y=4 (dessus à y=5)
const LAND = makeEnv((x, y) => (y <= 4 ? 'stone' : null));
const ICE = makeEnv((x, y) => (y <= 4 ? 'ice' : null));

function run(env, boat, ticks, input = null) {
  const all = [];
  for (let i = 0; i < ticks; i++) all.push(stepBoat(env, boat, input));
  return all;
}
const FORWARD = { left: false, right: false, forward: true, back: false };

test("waterFraction: la case du dessus d'une colonne = surface visible, dessous = pleine", () => {
  assert.equal(waterFraction(SEA, 0, 4, 0), WATER_SURFACE);
  assert.equal(waterFraction(SEA, 0, 3, 0), 1);
  assert.equal(waterFraction(SEA, 0, 5, 0), 0);
  assert.equal(waterFraction(SEA, 0, 0, 0), 0);
});

test("un bateau lâché sur l'eau flotte, le bas 0.366 sous la surface (comme le vrai jeu)", () => {
  const b = createBoatState(0.5, SURFACE, 0.5);
  run(SEA, b, 300);
  assert.equal(b.status, BoatStatus.IN_WATER);
  assert.ok(Math.abs(b.y - (SURFACE - 0.65 * BOAT_HEIGHT)) < 0.02, `y=${b.y}`);
  assert.ok(Math.abs(b.vy) < 1e-3);
});

test("à pleine vitesse sur l'eau : ~0.4 bloc/tic (8 blocs/s)", () => {
  const b = createBoatState(0.5, SURFACE, 0.5);
  run(SEA, b, 60); // se stabilise
  const z0 = b.z;
  run(SEA, b, 100, FORWARD);
  const perTick = (z0 - b.z) / 100;
  // en plus, on a accéléré depuis 0 : la moyenne est un peu sous le régime établi
  assert.ok(perTick > 0.36 && perTick < 0.41, `perTick=${perTick}`);
  run(SEA, b, 200, FORWARD);
  const before = b.z;
  run(SEA, b, 1, FORWARD);
  assert.ok(Math.abs(before - b.z - 0.4) < 0.005, `régime établi=${before - b.z}`);
});

test('yaw 0 avance vers -z, yaw +90° vers -x (même convention que le joueur)', () => {
  const a = createBoatState(0.5, SURFACE, 0.5, 0);
  run(SEA, a, 80, FORWARD);
  assert.ok(a.z < -5 && Math.abs(a.x - 0.5) < 1e-6);

  const b = createBoatState(0.5, SURFACE, 0.5, Math.PI / 2);
  run(SEA, b, 80, FORWARD);
  assert.ok(b.x < -5 && Math.abs(b.z - 0.5) < 1e-6);
});

test('gauche augmente le yaw, droite le diminue, ~10°/tic en régime établi', () => {
  const l = createBoatState(0.5, SURFACE, 0.5);
  run(SEA, l, 60, { left: true, right: false, forward: false, back: false });
  assert.ok(l.yaw > 0);
  const r = createBoatState(0.5, SURFACE, 0.5);
  run(SEA, r, 60, { left: false, right: true, forward: false, back: false });
  assert.ok(r.yaw < 0);
  assert.ok(Math.abs(l.yaw + r.yaw) < 1e-9, 'symétrique');
  assert.ok(l.deltaRotation > 9.5 && l.deltaRotation < 10.5, `delta=${l.deltaRotation}`);
});

test('tourner sans avancer pousse quand même un peu (0.005/tic)', () => {
  const b = createBoatState(0.5, SURFACE, 0.5);
  run(SEA, b, 200, { left: true, right: false, forward: false, back: false });
  assert.ok(Math.hypot(b.vx, b.vz) > 0.001);
});

test('les pagaies : avancer fait ramer les deux, virer à droite fait ramer la gauche', () => {
  const b = createBoatState(0.5, SURFACE, 0.5);
  stepBoat(SEA, b, FORWARD);
  assert.ok(b.paddleLeft && b.paddleRight);
  stepBoat(SEA, b, { left: false, right: true, forward: false, back: false });
  assert.ok(b.paddleLeft && !b.paddleRight);
  stepBoat(SEA, b, null);
  assert.ok(!b.paddleLeft && !b.paddleRight);
});

test("sans pilote, un bateau lancé continue de glisser puis s'arrête (friction 0.9)", () => {
  const b = createBoatState(0.5, SURFACE, 0.5);
  run(SEA, b, 60);
  b.vz = -0.4;
  run(SEA, b, 3);
  assert.ok(b.z < 0.5 - 0.9, `a déjà dérivé de ~1 bloc, z=${b.z}`);
  run(SEA, b, 200);
  assert.ok(b.z < 0.5 - 3, `distance totale de glisse ~3.6 blocs, z=${b.z}`);
  assert.ok(Math.hypot(b.vx, b.vz) < 1e-6);
});

test('à terre : lent (friction 0.6 -> 0.1 bloc/tic = 2 blocs/s au mieux)', () => {
  const b = createBoatState(0.5, 5, 0.5);
  run(LAND, b, 20);
  assert.equal(b.status, BoatStatus.ON_LAND);
  assert.ok(b.onGround);
  const z0 = b.z;
  run(LAND, b, 100, FORWARD);
  const perTick = (z0 - b.z) / 100;
  assert.ok(perTick > 0.08 && perTick < 0.12, `perTick=${perTick}`);
  run(LAND, b, 20);
  assert.ok(Math.hypot(b.vx, b.vz) < 1e-3, 'stoppe net une fois relâché');
});

test('sur la glace : ça glisse (adhérence 0.98)', () => {
  const b = createBoatState(0.5, 5, 0.5);
  run(ICE, b, 20);
  run(ICE, b, 100, FORWARD);
  assert.ok(Math.hypot(b.vx, b.vz) > 1, `v=${Math.hypot(b.vx, b.vz)}`);
});

test("un mur arrête le bateau, même très rapide (pas de traversée d'un mur d'un bloc)", () => {
  // mur d'1 bloc d'épaisseur en x=-8 (occupe [-8,-7))
  const env = makeEnv((x, y) => {
    if (y <= 0) return 'ice';
    if (y === 1 && x === -8) return 'stone';
    return null;
  });
  const b = createBoatState(0.5, 1, 0.5, Math.PI / 2); // cap vers -x
  run(env, b, 200, FORWARD);
  assert.ok(b.x > -7 + BOAT_RADIUS - 1e-6 - 0.001, `x=${b.x}`);
  assert.ok(b.x < 0.5);
  assert.equal(b.vx, 0);
});

test('chute de plus de 3 blocs sur la terre : le bateau se brise, dégâts = ceil(chute - 3)', () => {
  const b = createBoatState(0.5, 15, 0.5);
  const events = run(LAND, b, 200);
  const broke = events.find((e) => e.broke);
  assert.ok(broke, 'doit se briser');
  assert.equal(broke.fallDamage, 7); // 15 -> 5 : 10 blocs de chute, 10 - 3
});

test('chute de 2 blocs sur la terre : rien ne casse', () => {
  const b = createBoatState(0.5, 7, 0.5);
  const events = run(LAND, b, 200);
  assert.ok(!events.some((e) => e.broke));
});

test("tomber de haut DANS l'eau ne casse pas le bateau, il se pose à la surface", () => {
  const b = createBoatState(0.5, 40, 0.5);
  const events = run(SEA, b, 400);
  assert.ok(!events.some((e) => e.broke));
  assert.equal(b.status, BoatStatus.IN_WATER);
  assert.ok(Math.abs(b.y - (SURFACE - 0.65 * BOAT_HEIGHT)) < 0.03, `y=${b.y}`);
});

test("entièrement sous l'eau : il coule, et éjecte le passager au bout de 60 tics", () => {
  const b = createBoatState(0.5, 1.2, 0.5);
  const events = run(SEA, b, 70);
  assert.equal(events[0].eject, false);
  assert.equal(b.status, BoatStatus.UNDER_WATER);
  assert.equal(events[58].eject, false); // 59 tics sous l'eau
  assert.equal(events[59].eject, true); // 60e tic
});

test('rayBoatBox : touche la boîte de face, la rate à côté, respecte maxDist', () => {
  const b = createBoatState(0, 10, 0);
  const o = { x: 0, y: 10.3, z: 5 };
  const d = { x: 0, y: 0, z: -1 };
  const t = rayBoatBox(b, o, d, 6);
  assert.ok(Math.abs(t - (5 - BOAT_RADIUS)) < 1e-9);
  assert.equal(rayBoatBox(b, { x: 3, y: 10.3, z: 5 }, d, 6), null);
  assert.equal(rayBoatBox(b, o, d, 3), null);
  // par au-dessus (visée vers le bas)
  const down = { x: 0, y: -1, z: 0 };
  assert.ok(
    Math.abs(rayBoatBox(b, { x: 0.1, y: 12, z: 0 }, down, 6) - (12 - (10 + BOAT_HEIGHT))) < 1e-9,
  );
});

test("findDismountSpot : pose le passager sur la rive, sinon sur le bateau (à l'eau)", () => {
  // rive à droite (x >= 3) : pierre jusqu'à y=4, l'eau ailleurs
  const shore = makeEnv((x, y) => {
    if (y <= 0) return 'stone';
    if (x >= 3 && y <= 4) return 'stone';
    if (y <= 4) return 'water';
    return null;
  });
  const b = createBoatState(1.5, 4.5, 0.5, Math.PI / 2); // cap vers -x -> sa droite est vers -z... test générique :
  const spot = findDismountSpot(shore, b, 0.3, 1.7);
  assert.ok(
    shore.isSolid(Math.floor(spot.x), spot.y - 1, Math.floor(spot.z)),
    'debout sur du solide',
  );
  assert.ok(!shore.collidesAtBox(spot.x, spot.y, spot.z, 0.3, 1.7));

  const open = findDismountSpot(SEA, createBoatState(0.5, 4.5, 0.5), 0.3, 1.7);
  assert.equal(open.x, 0.5);
  assert.ok(open.y > 4.5);
});

/* ---------- objet, recette, pile ---------- */

test('le bateau existe comme objet non posable, nommé « Bateau »', () => {
  assert.equal(ITEM_NAMES.boat, 'Bateau');
  assert.ok(NON_PLACEABLE.has('boat'));
});

function grid9(cells) {
  const g = new Array(9).fill(null);
  for (const [i, item] of cells) g[i] = { item, count: 1 };
  return g;
}

test('recette : 5 planches en U -> 1 bateau, table de craft requise', () => {
  const u = grid9([
    [0, 'planks'],
    [2, 'planks'],
    [3, 'planks'],
    [4, 'planks'],
    [5, 'planks'],
  ]);
  assert.equal(matchRecipe(u, RECIPES, true)?.give.boat, 1);
  assert.equal(matchRecipe(u, RECIPES, false), null, 'pas sans table');
  // n'importe où dans la grille : décalé d'une ligne vers le bas
  const low = grid9([
    [3, 'planks'],
    [5, 'planks'],
    [6, 'planks'],
    [7, 'planks'],
    [8, 'planks'],
  ]);
  assert.equal(matchRecipe(low, RECIPES, true)?.give.boat, 1);
});

test("recette : le U à l'envers, ou avec un trou de trop, ne donne pas de bateau", () => {
  const flipped = grid9([
    [0, 'planks'],
    [1, 'planks'],
    [2, 'planks'],
    [3, 'planks'],
    [5, 'planks'],
  ]);
  assert.ok(!matchRecipe(flipped, RECIPES, true)?.give.boat);
  const four = grid9([
    [0, 'planks'],
    [2, 'planks'],
    [3, 'planks'],
    [4, 'planks'],
  ]);
  assert.equal(matchRecipe(four, RECIPES, true), null);
});

test("un bateau ne s'empile pas (1 par case), le reste continue à 64", () => {
  assert.equal(maxStackOf('boat'), 1);
  assert.equal(maxStackOf('planks'), MAX_STACK);

  const slots = createSlots();
  assert.equal(addItem(slots, 'boat', 3), 0);
  assert.deepEqual(slots.slice(0, 3), [
    { item: 'boat', count: 1 },
    { item: 'boat', count: 1 },
    { item: 'boat', count: 1 },
  ]);
  // fusion refusée : moveSlot échange au lieu de fusionner
  moveSlot(slots, 0, 1);
  assert.equal(slots[0].count, 1);
  assert.equal(slots[1].count, 1);
  // canFit compte des cases, pas des piles de 64
  const full = createSlots().map(() => ({ item: 'boat', count: 1 }));
  assert.equal(canFit(full, 'boat', 1), false);
});
