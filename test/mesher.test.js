import { test } from 'node:test';
import assert from 'node:assert/strict';
import { meshChunk, meshLiquid } from '../src/render/mesher.js';
import { CHUNK_X, CHUNK_Y, CHUNK_Z, idx } from '../src/world/chunk.js';

const FAKE_UV = { 1: { top: [0, 0, 1, 1], bottom: [0, 0, 1, 1], side: [0, 0, 1, 1] } };

test('meshChunk: an empty chunk produces no geometry', () => {
  const data = new Uint8Array(CHUNK_X * CHUNK_Y * CHUNK_Z);
  const { positions, indices } = meshChunk(data, FAKE_UV);
  assert.equal(positions.length, 0);
  assert.equal(indices.length, 0);
});

test('meshChunk: a single block surrounded by air produces exactly 6 faces', () => {
  const data = new Uint8Array(CHUNK_X * CHUNK_Y * CHUNK_Z);
  data[idx(5, 5, 5)] = 1;
  const { positions, indices } = meshChunk(data, FAKE_UV);
  assert.equal(positions.length / 3, 6 * 4); // 6 faces * 4 verts
  assert.equal(indices.length, 6 * 6); // 6 faces * 2 tris * 3 indices
});

test('meshChunk: two adjacent blocks hide their shared face', () => {
  const data = new Uint8Array(CHUNK_X * CHUNK_Y * CHUNK_Z);
  data[idx(5, 5, 5)] = 1;
  data[idx(6, 5, 5)] = 1;
  const { positions } = meshChunk(data, FAKE_UV);
  // 2 blocks * 6 faces - 2 hidden faces (one on each block) = 10 faces
  assert.equal(positions.length / 3, 10 * 4);
});

test('meshChunk: without a lightmap, every face is full brightness (pre-Phase-13 behaviour)', () => {
  const data = new Uint8Array(CHUNK_X * CHUNK_Y * CHUNK_Z);
  data[idx(5, 5, 5)] = 1;
  const { colors } = meshChunk(data, FAKE_UV);
  assert.ok(colors.every((c) => c === 1));
});

test('meshChunk: a face exposed to a dark (level 0) neighbour gets the dim floor colour', () => {
  const data = new Uint8Array(CHUNK_X * CHUNK_Y * CHUNK_Z);
  data[idx(5, 5, 5)] = 1;
  const lightData = new Uint8Array(CHUNK_X * CHUNK_Y * CHUNK_Z); // tout à 0 : aucune lumière nulle part
  const { colors } = meshChunk(data, FAKE_UV, lightData);
  // jamais un noir absolu (cf. MIN_LIGHT_FACTOR dans mesher.js) : lisible même dans le noir complet
  assert.ok(colors.every((c) => c > 0 && c < 0.2));
});

test('meshChunk: a face exposed to a fully-lit (level 15) neighbour is full brightness', () => {
  const data = new Uint8Array(CHUNK_X * CHUNK_Y * CHUNK_Z);
  data[idx(5, 5, 5)] = 1;
  const lightData = new Uint8Array(CHUNK_X * CHUNK_Y * CHUNK_Z).fill(15);
  const { colors } = meshChunk(data, FAKE_UV, lightData);
  assert.ok(colors.every((c) => c === 1));
});

// --- Phase 16 : eau/lave comme blocs réels, opacité vis-à-vis du mesher ---
const WATER_ID = 17;
const LIQUID_IDS = new Set([WATER_ID]);

test('meshChunk: a stone block still draws its face against an adjacent liquid (water is not opaque)', () => {
  const data = new Uint8Array(CHUNK_X * CHUNK_Y * CHUNK_Z);
  data[idx(5, 5, 5)] = 1; // "stone" (peu importe le vrai id ici, FAKE_UV le couvre)
  data[idx(6, 5, 5)] = WATER_ID;
  const { positions } = meshChunk(data, FAKE_UV, undefined, LIQUID_IDS);
  // le bloc 1 garde ses 6 faces (aucune culling contre le liquide) ; l'eau elle-même
  // n'est jamais dans cette géométrie (meshLiquid s'en charge séparément)
  assert.equal(positions.length / 3, 6 * 4);
});

test('meshChunk: liquid cells are never emitted by the opaque pass', () => {
  const data = new Uint8Array(CHUNK_X * CHUNK_Y * CHUNK_Z);
  data[idx(5, 5, 5)] = WATER_ID;
  const { positions } = meshChunk(data, FAKE_UV, undefined, LIQUID_IDS);
  assert.equal(positions.length, 0);
});

test('meshLiquid: a single water cell surrounded by air emits all 6 faces', () => {
  const data = new Uint8Array(CHUNK_X * CHUNK_Y * CHUNK_Z);
  data[idx(5, 5, 5)] = WATER_ID;
  const { positions } = meshLiquid(data, WATER_ID, LIQUID_IDS);
  assert.equal(positions.length / 3, 6 * 4);
});

test('meshLiquid: two adjacent water cells cull their shared face (no face between water and water)', () => {
  const data = new Uint8Array(CHUNK_X * CHUNK_Y * CHUNK_Z);
  data[idx(5, 5, 5)] = WATER_ID;
  data[idx(6, 5, 5)] = WATER_ID;
  const { positions } = meshLiquid(data, WATER_ID, LIQUID_IDS);
  assert.equal(positions.length / 3, 10 * 4); // comme deux blocs solides adjacents : 10 faces
});

test('meshLiquid: water buried inside solid stone emits zero faces (the actual TODO item)', () => {
  const data = new Uint8Array(CHUNK_X * CHUNK_Y * CHUNK_Z);
  const STONE = 99; // n'importe quel id non-liquide
  for (let x = 4; x <= 6; x++)
    for (let y = 4; y <= 6; y++) for (let z = 4; z <= 6; z++) data[idx(x, y, z)] = STONE;
  data[idx(5, 5, 5)] = WATER_ID; // au centre du cube 3x3x3, entouré de pierre de tous côtés
  const { positions } = meshLiquid(data, WATER_ID, LIQUID_IDS);
  assert.equal(positions.length, 0);
});

test('meshLiquid: water next to lava draws a face (different liquids are not culled against each other)', () => {
  const data = new Uint8Array(CHUNK_X * CHUNK_Y * CHUNK_Z);
  const LAVA_ID = 18;
  const bothLiquids = new Set([WATER_ID, LAVA_ID]);
  data[idx(5, 5, 5)] = WATER_ID;
  data[idx(6, 5, 5)] = LAVA_ID;
  const { positions } = meshLiquid(data, WATER_ID, bothLiquids);
  assert.equal(positions.length / 3, 6 * 4); // aucune face culled : lave != eau
});

test('meshLiquid: the top face sits at y+0.875, not a full cube (shoreline reads as a surface)', () => {
  const data = new Uint8Array(CHUNK_X * CHUNK_Y * CHUNK_Z);
  data[idx(5, 5, 5)] = WATER_ID;
  const { positions } = meshLiquid(data, WATER_ID, LIQUID_IDS);
  const ys = [];
  for (let i = 1; i < positions.length; i += 3) ys.push(positions[i]);
  assert.ok(ys.some((y) => Math.abs(y - (5 + 0.875)) < 1e-6));
  assert.ok(!ys.some((y) => y > 5 + 0.875 + 1e-6)); // jamais au-dessus de 0.875
});

test('meshLiquid: topOnly emits only the top face, even surrounded by air on every side', () => {
  const data = new Uint8Array(CHUNK_X * CHUNK_Y * CHUNK_Z);
  data[idx(5, 5, 5)] = WATER_ID;
  const { positions, normals } = meshLiquid(data, WATER_ID, LIQUID_IDS, undefined, true);
  assert.equal(positions.length / 3, 1 * 4); // une seule face -> 4 sommets
  for (let i = 0; i < normals.length; i += 3) {
    assert.deepEqual([normals[i], normals[i + 1], normals[i + 2]], [0, 1, 0]);
  }
});

test('meshLiquid: topOnly still culls the top face against water/air above (unaffected by the flag)', () => {
  const data = new Uint8Array(CHUNK_X * CHUNK_Y * CHUNK_Z);
  data[idx(5, 5, 5)] = WATER_ID;
  data[idx(5, 6, 5)] = WATER_ID; // même liquide juste au-dessus -> pas de face à cet endroit
  const { positions } = meshLiquid(data, WATER_ID, LIQUID_IDS, undefined, true);
  assert.equal(positions.length / 3, 1 * 4); // seule la face du dessus de la cellule du haut reste
});

test('meshLiquid: topOnly avoids side faces at the chunk boundary (no border between adjacent chunks)', () => {
  // Cellule d'eau collée au bord du chunk (x = CHUNK_X - 1) : sans topOnly, une
  // face latérale serait TOUJOURS dessinée ici (voisin hors-chunk traité comme
  // de l'air, cf. commentaire en tête du mesher), même si le chunk voisin
  // continue avec de l'eau -> bordure visible. Avec topOnly, cette face latérale
  // n'existe plus : seule la face du dessus (indépendante des chunks voisins) l'est.
  const data = new Uint8Array(CHUNK_X * CHUNK_Y * CHUNK_Z);
  data[idx(CHUNK_X - 1, 5, 5)] = WATER_ID;
  const { positions } = meshLiquid(data, WATER_ID, LIQUID_IDS, undefined, true);
  assert.equal(positions.length / 3, 1 * 4);
});

// Formes réduites (`shape` dans data/blocks.js) : la torche n'est pas un cube plein
// mais un bâtonnet. Deux propriétés indissociables — la boîte émise est plus petite
// que la cellule, ET un tel bloc ne masque jamais la face de son voisin.
const SHAPE_UV = {
  1: { top: [0, 0, 1, 1], bottom: [0, 0, 1, 1], side: [0, 0, 1, 1] },
  2: { top: [0, 0, 1, 1], bottom: [0, 0, 1, 1], side: [0, 0, 1, 1] },
};
const SHAPES = { 2: { width: 0.2, height: 0.62 } };

test('meshChunk: a shaped block emits a slim box, centred in its cell and standing on its floor', () => {
  const data = new Uint8Array(CHUNK_X * CHUNK_Y * CHUNK_Z);
  data[idx(8, 10, 8)] = 2;
  const { positions } = meshChunk(data, SHAPE_UV, null, null, SHAPES);

  assert.equal(positions.length / 3, 6 * 4, 'all 6 faces: a slim box can never be hidden');
  const xs = [],
    ys = [],
    zs = [];
  for (let i = 0; i < positions.length / 3; i++) {
    xs.push(positions[i * 3]);
    ys.push(positions[i * 3 + 1]);
    zs.push(positions[i * 3 + 2]);
  }
  // centré en x/z sur la cellule (8..9 -> milieu 8.5), largeur 0.2
  assert.ok(Math.abs(Math.min(...xs) - 8.4) < 1e-6);
  assert.ok(Math.abs(Math.max(...xs) - 8.6) < 1e-6);
  assert.ok(Math.abs(Math.min(...zs) - 8.4) < 1e-6);
  assert.ok(Math.abs(Math.max(...zs) - 8.6) < 1e-6);
  // posé sur le sol de la cellule, pas flottant en son centre
  assert.ok(Math.abs(Math.min(...ys) - 10) < 1e-6);
  assert.ok(Math.abs(Math.max(...ys) - 10.62) < 1e-6);
});

test('meshChunk: a shaped block never hides the face of the block it is placed against', () => {
  const alone = new Uint8Array(CHUNK_X * CHUNK_Y * CHUNK_Z);
  alone[idx(8, 10, 8)] = 1;
  const solo = meshChunk(alone, SHAPE_UV, null, null, SHAPES).positions.length / 12;

  const withTorch = new Uint8Array(CHUNK_X * CHUNK_Y * CHUNK_Z);
  withTorch[idx(8, 10, 8)] = 1;
  withTorch[idx(9, 10, 8)] = 2; // le bâtonnet, collé au mur
  const both = meshChunk(withTorch, SHAPE_UV, null, null, SHAPES).positions.length / 12;

  assert.equal(solo, 6);
  assert.equal(both, 12, 'the wall keeps all 6 of its faces, the stick adds its own 6');
});

test('meshChunk: a shaped block is lit by its OWN cell, not by the wall it leans on', () => {
  const data = new Uint8Array(CHUNK_X * CHUNK_Y * CHUNK_Z);
  data[idx(8, 10, 8)] = 1; // mur opaque, lumière 0
  data[idx(9, 10, 8)] = 2; // torche contre le mur
  const light = new Uint8Array(CHUNK_X * CHUNK_Y * CHUNK_Z);
  light[idx(9, 10, 8)] = 15; // la torche s'éclaire elle-même
  const { colors, positions } = meshChunk(data, SHAPE_UV, light, null, SHAPES);

  // les sommets du bâtonnet sont ceux dont le x sort de la cellule du mur
  let torchVerts = 0;
  for (let i = 0; i < positions.length / 3; i++) {
    if (positions[i * 3] > 9) {
      assert.ok(colors[i * 3] > 0.9, 'the stick must render at full brightness, not wall-dark');
      torchVerts++;
    }
  }
  assert.ok(torchVerts > 0, 'sanity: some stick vertices were actually checked');
});

// Forme "croix" (`shape.cross`, herbe haute) : contrairement à la boîte réduite
// ci-dessus, ce n'est PAS un petit cube texturé sur ses 6 faces — 2 plans
// diagonaux qui traversent toute la cellule (coin à coin), chacun recto-verso,
// avec une texture à trous (alpha). Cf. commentaire dans mesher.js pour le détail.
const CROSS_SHAPES = { 3: { height: 0.7, cross: true } };
const CROSS_UV = {
  1: { top: [0, 0, 1, 1], bottom: [0, 0, 1, 1], side: [0, 0, 1, 1] },
  3: { top: [0, 0, 1, 1], bottom: [0, 0, 1, 1], side: [0.2, 0.1, 0.8, 0.9] },
};

test('meshChunk: a cross-shaped block emits 2 double-sided diagonal planes, not a box', () => {
  const data = new Uint8Array(CHUNK_X * CHUNK_Y * CHUNK_Z);
  data[idx(8, 10, 8)] = 3;
  const { positions, indices } = meshChunk(data, CROSS_UV, null, null, CROSS_SHAPES);

  // 2 diagonales x (recto + verso) = 4 quads, jamais 6 comme la boîte réduite
  assert.equal(positions.length / 3, 4 * 4);
  assert.equal(indices.length, 4 * 6);

  // les coins touchent bien les 2 coins opposés de la cellule (pas rétréci au
  // centre comme la boîte réduite) : x/z vont de 8 à 9, jamais de valeur entre
  const xs = [];
  for (let i = 0; i < positions.length / 3; i++) xs.push(positions[i * 3]);
  assert.ok(xs.some((v) => Math.abs(v - 8) < 1e-6));
  assert.ok(xs.some((v) => Math.abs(v - 9) < 1e-6));
  assert.ok(
    xs.every((v) => Math.abs(v - 8) < 1e-6 || Math.abs(v - 9) < 1e-6),
    'diagonal corners only — never a shrunk centred box',
  );
});

test('meshChunk: a cross-shaped block is never culled and always full brightness in flat light (own cell)', () => {
  // entouré de pierre pleine des deux côtés : une boîte réduite garderait ses 6
  // faces (déjà couvert plus haut) ; on vérifie ici que le croix, lui, garde
  // bien ses 4 faces (jamais culled par isOpaque) même collé contre un mur.
  const data = new Uint8Array(CHUNK_X * CHUNK_Y * CHUNK_Z);
  data[idx(8, 10, 8)] = 1; // mur opaque
  data[idx(9, 10, 8)] = 3; // touffe collée au mur
  const { positions } = meshChunk(data, CROSS_UV, null, null, CROSS_SHAPES);
  // mur : 6 faces (aucune cachée par la touffe non pleine) + touffe : 4 quads
  assert.equal(positions.length / 3, (6 + 4) * 4);
});
