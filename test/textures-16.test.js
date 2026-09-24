import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { mkdirSync, writeFileSync, rmSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

// ---------- 1) Vérification STRUCTURELLE de textures-16.js, sans l'exécuter ----------
// Ce fichier importe textures.js, qui importe 'three' -- non installé ici (le jeu charge
// vendor/three.module.js via l'import map du navigateur, cf. tools/gen-pixel16.mjs pour le
// même souci côté génération). Plutôt que de reproduire le stub pour un simple contrôle de
// forme, on relit la SOURCE et on vérifie par une regex que chaque texture est une grille
// RÉELLE de 16 lignes de 16 caractères et que sa palette couvre bien tous les caractères
// utilisés -- exactement l'invariant dont dépend pixelTex() à l'exécution.
const here = dirname(fileURLToPath(import.meta.url));
const src = readFileSync(join(here, '../src/render/textures-16.js'), 'utf8');

const ROWS_RE = /const (tex\w+)Rows = \[\n((?:\s*'[^']*',\n)+)\];/g;
const PALETTE_RE = /const (tex\w+)Palette = \{ ([^}]*) \};/g;

function parseAll(re, src) {
  const out = {};
  let m;
  while ((m = re.exec(src))) out[m[1]] = m[2];
  return out;
}

test('textures-16.js : 49 textures, chacune une grille 16x16 (comme le bateau, BOAT_PIXELS)', () => {
  const rowsBlocks = parseAll(ROWS_RE, src);
  assert.equal(Object.keys(rowsBlocks).length, 49);
  for (const [name, block] of Object.entries(rowsBlocks)) {
    const rows = [...block.matchAll(/'([^']*)'/g)].map((m) => m[1]);
    assert.equal(rows.length, 16, `${name} : 16 lignes attendues`);
    for (const row of rows)
      assert.equal(row.length, 16, `${name} : ligne de 16 caractères attendue`);
  }
});

test("textures-16.js : chaque caractère utilisé dans les lignes a bien une couleur dans la palette (sauf '.', transparent)", () => {
  const rowsBlocks = parseAll(ROWS_RE, src);
  const paletteBlocks = parseAll(PALETTE_RE, src);
  assert.equal(Object.keys(paletteBlocks).length, 49);
  for (const name of Object.keys(rowsBlocks)) {
    const rows = [...rowsBlocks[name].matchAll(/'([^']*)'/g)].map((m) => m[1]);
    const palette = Object.fromEntries(
      [...paletteBlocks[name].matchAll(/(\w+): '(#[0-9a-f]{6})'/g)].map((m) => [m[1], m[2]]),
    );
    assert.ok(Object.keys(palette).length >= 1, `${name} : palette non vide`);
    const used = new Set([...rows.join('')]);
    for (const ch of used) {
      assert.ok(
        ch === '.' || palette[ch],
        `${name} : caractère '${ch}' sans couleur dans la palette`,
      );
    }
  }
});

test('textures-16.js : deux blocs différents (herbe/pierre) ont des grilles différentes', () => {
  const rowsBlocks = parseAll(ROWS_RE, src);
  assert.notEqual(rowsBlocks.texGrassTop, rowsBlocks.texStone);
});

// ---------- 2) textures-select.js : le sélecteur base/16x16, exécuté pour de vrai ----------
// Ici il FAUT exécuter le module (localStorage, la fusion `{ ...base, ...pixel16 }`), donc on
// pose temporairement un faux paquet 'three' (mêmes 2 exports que textures.js utilise) le temps
// du test, comme tools/gen-pixel16.mjs -- et on le retire ensuite pour ne rien laisser qui
// gênerait un `npm install three` réel plus tard.
const projectRoot = join(here, '..');
const fakeThreeDir = join(projectRoot, 'node_modules', 'three');
const alreadyInstalled = existsSync(join(fakeThreeDir, 'package.json'));
if (!alreadyInstalled) {
  mkdirSync(fakeThreeDir, { recursive: true });
  writeFileSync(
    join(fakeThreeDir, 'package.json'),
    '{"name":"three","type":"module","main":"index.js"}',
  );
  writeFileSync(
    join(fakeThreeDir, 'index.js'),
    "export class CanvasTexture { constructor(c){ this.image=c; } }\nexport const NearestFilter = 'nearest';\n",
  );
}

// Faux <canvas> : juste assez pour que textures.js dessine dessus sans lever d'exception
// (fillRect/clearRect/fillStyle/filter, pas de vrai rendu -- on ne vérifie pas les pixels ici,
// seulement la logique de sélection/fusion, déjà couverte pixel par pixel par les tests ci-dessus).
function fakeCanvas() {
  return {
    width: 0,
    height: 0,
    getContext: () => ({
      fillStyle: '',
      filter: '',
      fillRect() {},
      clearRect() {},
      drawImage() {},
      getImageData: () => ({ data: new Uint8ClampedArray(4) }),
    }),
  };
}
globalThis.document = { createElement: () => fakeCanvas() };
const store = {};
globalThis.localStorage = {
  getItem: (k) => store[k] ?? null,
  setItem: (k, v) => {
    store[k] = v;
  },
};
globalThis.location = { reload() {} };

const selectMod = await import('../src/render/textures-select.js');
const base = await import('../src/render/textures.js');
const pixel16 = await import('../src/render/textures-16.js');
if (!alreadyInstalled) rmSync(fakeThreeDir, { recursive: true, force: true });

test('getTextureStyle : "base" par défaut, lit ce que setTextureStyle a écrit', () => {
  delete store[selectMod.TEXTURE_STYLE_KEY];
  assert.equal(selectMod.getTextureStyle(), 'base');
  selectMod.setTextureStyle('pixel16');
  assert.equal(store[selectMod.TEXTURE_STYLE_KEY], 'pixel16');
  assert.equal(selectMod.getTextureStyle(), 'pixel16');
});

test("getTextureStyle : une valeur inconnue en localStorage retombe sur 'base'", () => {
  store[selectMod.TEXTURE_STYLE_KEY] = "n'importe quoi";
  assert.equal(selectMod.getTextureStyle(), 'base');
});

test('tex (fusion) : les 49 clés du pack 16x16 sont bien celles de textures.js, jamais de clé en trop', () => {
  const pixelKeys = Object.keys(pixel16).filter((k) => k.startsWith('tex'));
  assert.equal(pixelKeys.length, 49);
  for (const k of pixelKeys)
    assert.equal(typeof base[k], 'function', `${k} doit aussi exister dans textures.js`);
});
