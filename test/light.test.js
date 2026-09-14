import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  propagate,
  propagateSkylight,
  propagateSkylightColumn,
  removeLight,
  computeSkylightColumn,
} from '../src/world/light.js';
import { CHUNK_X, CHUNK_Y, CHUNK_Z, idx, createChunkData } from '../src/world/chunk.js';

// isOpaque de test : tout bloc non nul bloque la lumière (comme la pierre en vrai jeu)
const isOpaque = (id) => id !== 0;

function newLightmap() {
  return new Uint8Array(CHUNK_X * CHUNK_Y * CHUNK_Z);
}

test('propagate: a single torch lights its cell at full level, neighbours at level-1', () => {
  const data = createChunkData();
  const light = newLightmap();
  propagate(data, light, [{ x: 8, y: 32, z: 8, level: 14 }], isOpaque);

  assert.equal(light[idx(8, 32, 8)], 14);
  assert.equal(light[idx(9, 32, 8)], 13);
  assert.equal(light[idx(7, 32, 8)], 13);
  assert.equal(light[idx(8, 33, 8)], 13);
  assert.equal(light[idx(8, 31, 8)], 13);
  assert.equal(light[idx(8, 32, 9)], 13);
  assert.equal(light[idx(8, 32, 7)], 13);
});

test('propagate: light decreases by 1 per block travelled, in a straight line', () => {
  const data = createChunkData();
  const light = newLightmap();
  propagate(data, light, [{ x: 0, y: 32, z: 8, level: 10 }], isOpaque);
  for (let dx = 0; dx < 10; dx++) {
    assert.equal(light[idx(dx, 32, 8)], 10 - dx);
  }
  assert.equal(light[idx(10, 32, 8)], 0); // hors de portée
});

test('propagate: a solid wall blocks light from reaching beyond it', () => {
  const data = createChunkData();
  // un mur plein (toute la tranche x=9, chaque y/z du chunk) : une seule cellule
  // opaque n'empêcherait rien, la lumière contournerait par y/z (elle se propage
  // dans les 6 directions) — il faut une vraie cloison pour tester un vrai blocage.
  for (let ly = 0; ly < CHUNK_Y; ly++)
    for (let lz = 0; lz < CHUNK_Z; lz++) data[idx(9, ly, lz)] = 3;
  const light = newLightmap();
  propagate(data, light, [{ x: 8, y: 32, z: 8, level: 14 }], isOpaque);

  // le mur lui-même ne reçoit jamais de lumière (isOpaque le bloque en entrée de boucle)
  assert.equal(light[idx(9, 32, 8)], 0);
  // et rien au-delà du mur sur cet axe n'est éclairé
  assert.equal(light[idx(10, 32, 8)], 0);
});

test('propagate: two sources merge, each cell keeps the brighter of the two contributions', () => {
  const data = createChunkData();
  const light = newLightmap();
  propagate(
    data,
    light,
    [
      { x: 2, y: 32, z: 8, level: 10 },
      { x: 6, y: 32, z: 8, level: 6 },
    ],
    isOpaque,
  );
  // à mi-chemin (x=4), la source de gauche (10-2=8) l'emporte sur celle de droite (6-2=4)
  assert.equal(light[idx(4, 32, 8)], 8);
});

test('removeLight: erasing the only source in the map returns everything to 0', () => {
  const data = createChunkData();
  const light = newLightmap();
  propagate(data, light, [{ x: 8, y: 32, z: 8, level: 14 }], isOpaque);
  removeLight(data, light, 8, 32, 8, isOpaque);
  assert.ok(light.every((v) => v === 0));
});

test('removeLight: a second nearby source keeps lighting the cells it reaches (resparkle)', () => {
  const data = createChunkData();
  const light = newLightmap();
  propagate(
    data,
    light,
    [
      { x: 2, y: 32, z: 8, level: 14 },
      { x: 8, y: 32, z: 8, level: 14 },
    ],
    isOpaque,
  );
  removeLight(data, light, 8, 32, 8, isOpaque);
  // la 2e torche a disparu, mais la 1ère (à x=2) doit toujours éclairer x=8 (distance 6 -> niveau 8)
  assert.equal(light[idx(8, 32, 8)], 8);
  assert.equal(light[idx(2, 32, 8)], 14);
});

test('computeSkylightColumn: an open column is lit to 15 down to the first solid roof', () => {
  const data = createChunkData();
  data[idx(5, 10, 5)] = 3; // un "toit" à y=10
  const light = newLightmap();
  computeSkylightColumn(data, light, 5, 5, isOpaque);
  assert.equal(light[idx(5, CHUNK_Y - 1, 5)], 15);
  assert.equal(light[idx(5, 11, 5)], 15);
  assert.equal(light[idx(5, 10, 5)], 0); // le toit lui-même n'est jamais éclairé (bloc opaque)
  assert.equal(light[idx(5, 9, 5)], 0); // sous le toit : hors de portée du balayage v1
});

// Régression : computeSkylightColumn ne descend qu'en colonne, donc dès qu'une feuille
// bouchait la verticale, TOUT ce qui était en dessous restait à 0 — soit 6 % de
// luminosité dans le mesher, une ombre quasi noire sous le moindre arbre, à un bloc
// du plein soleil. propagateSkylight rejoue un BFS depuis le ciel pour lisser ça.
function groundWithCanopy() {
  const data = createChunkData();
  const light = newLightmap();
  for (let x = 0; x < CHUNK_X; x++)
    for (let z = 0; z < CHUNK_Z; z++) for (let y = 0; y <= 9; y++) data[idx(x, y, z)] = 1;
  // feuillage 5x5 à y=13 centré en (8,8) : l'air en y=10..12 dessous est à l'ombre
  for (let x = 6; x <= 10; x++) for (let z = 6; z <= 10; z++) data[idx(x, 13, z)] = 2;
  for (let x = 0; x < CHUNK_X; x++)
    for (let z = 0; z < CHUNK_Z; z++) computeSkylightColumn(data, light, x, z, isOpaque);
  return { data, light };
}

test('computeSkylightColumn alone leaves everything under a canopy pitch black', () => {
  const { light } = groundWithCanopy();
  assert.equal(light[idx(8, 10, 8)], 0, 'the bug this guards: 0 = MIN_LIGHT_FACTOR in the mesher');
  assert.equal(light[idx(6, 10, 6)], 0);
});

test('propagateSkylight: shade under a canopy is a gradient, not a cliff', () => {
  const { data, light } = groundWithCanopy();
  propagateSkylight(data, light, isOpaque);

  // le bord du feuillage est à un bloc du plein jour -> à peine assombri
  assert.equal(light[idx(6, 10, 6)], 14);
  // le centre est à 2 blocs de chaque bord -> assombri, mais loin du noir
  assert.equal(light[idx(8, 10, 8)], 12);
});

test('propagateSkylight leaves open sky at 15 and solid rock at 0', () => {
  const { data, light } = groundWithCanopy();
  propagateSkylight(data, light, isOpaque);

  assert.equal(light[idx(0, 10, 0)], 15, 'open sky, far from the tree, must stay full daylight');
  assert.equal(light[idx(8, 5, 8)], 0, 'the inside of the ground must stay dark');
});

test('propagateSkylightColumn: re-opening one column relights what is under it', () => {
  const { data, light } = groundWithCanopy();
  propagateSkylight(data, light, isOpaque);
  const before = light[idx(8, 12, 8)];

  // le joueur casse la feuille juste au-dessus (8, 13, 8) : la colonne voit le ciel
  data[idx(8, 13, 8)] = 0;
  computeSkylightColumn(data, light, 8, 8, isOpaque);
  propagateSkylightColumn(data, light, 8, 8, isOpaque);

  assert.equal(light[idx(8, 12, 8)], 15, 'directly under the new hole: full daylight');
  assert.ok(before < 15, 'sanity: it really was shaded before the hole was dug');
  // et le rayon frais déborde sur les voisins encore couverts
  assert.equal(light[idx(7, 12, 8)], 14);
});
