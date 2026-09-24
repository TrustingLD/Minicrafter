// Script de génération (Phase 37) : régénère src/render/textures-16.js à partir des
// textures procédurales de textures.js (réduction 32x32 -> 16x16 + k-means ~10 couleurs).
// À relancer si une texture de bloc change dans textures.js et qu'on veut que le pack
// 16x16 suive. Nécessite le paquet npm `canvas` (rendu de <canvas> hors navigateur) :
//   npm install --no-save canvas
//   node tools/gen-pixel16.mjs
// Écrit src/render/textures-16.js directement (mêmes 49 clés que render/atlas.js, à
// l'exclusion des textures avec état on/off et des variantes de repeaterTop/redstoneWire).
//
// textures.js importe 'three' (jamais installé ici : le jeu charge vendor/three.module.js
// via l'import map du navigateur, pas via node_modules) -- on pose un faux paquet 'three'
// juste le temps du script (assez pour CanvasTexture/NearestFilter, cf. textures.js), et on
// le retire à la fin pour ne rien laisser qui gênerait un vrai `npm install three` plus tard.
import { createCanvas } from 'canvas';
import { mkdirSync, writeFileSync as writeFileSyncStub, rmSync, existsSync } from 'fs';
import { fileURLToPath as toPath } from 'url';
import { dirname as dirOf, join as joinPath } from 'path';
const projectRoot = joinPath(dirOf(toPath(import.meta.url)), '..');
const fakeThreeDir = joinPath(projectRoot, 'node_modules', 'three');
const threeAlreadyInstalled = existsSync(joinPath(fakeThreeDir, 'package.json'));
if (!threeAlreadyInstalled) {
  mkdirSync(fakeThreeDir, { recursive: true });
  writeFileSyncStub(joinPath(fakeThreeDir, 'package.json'), '{"name":"three","type":"module","main":"index.js"}');
  writeFileSyncStub(
    joinPath(fakeThreeDir, 'index.js'),
    'export class CanvasTexture { constructor(c){ this.image=c; this.needsUpdate=true; } }\nexport const NearestFilter = \'nearest\';\n',
  );
}
globalThis.document = {
  createElement(tag) {
    if (tag === 'canvas') return createCanvas(1, 1);
    throw new Error('unsupported tag ' + tag);
  },
};
// import DYNAMIQUE et non statique : un import statique serait résolu (donc échouerait,
// 'three' n'existant pas encore) AVANT même la première ligne de ce fichier, les imports
// ES étant tous résolus par avance -- le stub ci-dessus doit être en place avant ce point.
const tex = await import('../src/render/textures.js');
if (!threeAlreadyInstalled) rmSync(fakeThreeDir, { recursive: true, force: true });

const NAMES = Object.keys(tex).filter((k) => k.startsWith('tex') && typeof tex[k] === 'function');
// Fonctions qui prennent des arguments (variantes d'armure / marches / mobs...) : on ne les
// couvre pas ici -- seules les faces de BLOCS proprement dites (arité 0) nous intéressent.
const zeroArg = NAMES.filter((n) => tex[n].length === 0);

function kmeans(points, k, iters = 10) {
  // sous-échantillonne les points de départ pour des centres bien répartis
  const centers = [];
  for (let i = 0; i < k; i++) centers.push(points[Math.floor((i * points.length) / k)].slice());
  let labels = new Array(points.length).fill(0);
  for (let it = 0; it < iters; it++) {
    for (let i = 0; i < points.length; i++) {
      let best = 0,
        bestD = Infinity;
      for (let c = 0; c < k; c++) {
        const d =
          (points[i][0] - centers[c][0]) ** 2 +
          (points[i][1] - centers[c][1]) ** 2 +
          (points[i][2] - centers[c][2]) ** 2;
        if (d < bestD) {
          bestD = d;
          best = c;
        }
      }
      labels[i] = best;
    }
    const sums = Array.from({ length: k }, () => [0, 0, 0, 0]);
    for (let i = 0; i < points.length; i++) {
      const c = labels[i];
      sums[c][0] += points[i][0];
      sums[c][1] += points[i][1];
      sums[c][2] += points[i][2];
      sums[c][3]++;
    }
    for (let c = 0; c < k; c++) {
      if (sums[c][3] > 0) {
        centers[c] = [sums[c][0] / sums[c][3], sums[c][1] / sums[c][3], sums[c][2] / sums[c][3]];
      }
    }
  }
  return { centers, labels };
}

function toHex([r, g, b]) {
  const h = (n) => Math.max(0, Math.min(255, Math.round(n))).toString(16).padStart(2, '0');
  return `#${h(r)}${h(g)}${h(b)}`;
}

const CHARS = 'abcdefghijklmnop';
const results = {};

for (const name of zeroArg) {
  let texObj;
  try {
    texObj = tex[name]();
  } catch (e) {
    console.error('skip', name, e.message);
    continue;
  }
  const src = texObj.image; // canvas node (32x32)
  const S = src.width;
  const ctx = src.getContext('2d');
  const { data } = ctx.getImageData(0, 0, S, S);
  const cell = S / 16;
  // moyenne (avec alpha, pour les textures qui ont des trous -- torche, porte...) par case 16x16
  const avg = []; // [r,g,b,a] * 256
  for (let ty = 0; ty < 16; ty++) {
    for (let tx = 0; tx < 16; tx++) {
      let r = 0,
        g = 0,
        b = 0,
        a = 0,
        n = 0;
      for (let y = 0; y < cell; y++) {
        for (let x = 0; x < cell; x++) {
          const px = Math.floor(tx * cell + x);
          const py = Math.floor(ty * cell + y);
          const idx = (py * S + px) * 4;
          const alpha = data[idx + 3] / 255;
          r += data[idx] * alpha;
          g += data[idx + 1] * alpha;
          b += data[idx + 2] * alpha;
          a += data[idx + 3];
          n++;
        }
      }
      avg.push([r / n, g / n, b / n, a / n]);
    }
  }
  const hasAlpha = avg.some((p) => p[3] < 200);
  const opaquePts = avg.filter((p) => p[3] >= 40).map((p) => [p[0], p[1], p[2]]);
  const k = Math.min(10, Math.max(2, new Set(opaquePts.map((p) => p.join(','))).size));
  const { centers } = opaquePts.length ? kmeans(opaquePts, k) : { centers: [[0, 0, 0]] };
  // ré-assigne CHAQUE case (y compris transparentes) au centre le plus proche, ou '.' si transparente
  const palette = {};
  centers.forEach((c, i) => {
    palette[CHARS[i]] = toHex(c);
  });
  const rows = [];
  for (let ty = 0; ty < 16; ty++) {
    let row = '';
    for (let tx = 0; tx < 16; tx++) {
      const p = avg[ty * 16 + tx];
      if (hasAlpha && p[3] < 40) {
        row += '.';
        continue;
      }
      let best = 0,
        bestD = Infinity;
      centers.forEach((c, i) => {
        const d = (p[0] - c[0]) ** 2 + (p[1] - c[1]) ** 2 + (p[2] - c[2]) ** 2;
        if (d < bestD) {
          bestD = d;
          best = i;
        }
      });
      row += CHARS[best];
    }
    rows.push(row);
  }
  results[name] = { rows, palette, hasAlpha };
}

const KEYS = [
  'texGrassTop', 'texGrassSide', 'texDirt', 'texStone', 'texWoodTop', 'texWoodSide', 'texLeaves', 'texPlanks',
  'texCraftTop', 'texCraftSide', 'texSnow', 'texCoalOre', 'texIronOre', 'texGoldOre', 'texDiamondOre', 'texRedstoneOre',
  'texBedrock', 'texTorchStick', 'texTorchFlame', 'texTorchWood', 'texFurnace', 'texWool', 'texSand', 'texSandstone',
  'texCactus', 'texDeadBush', 'texIce', 'texWeeds', 'texBedFoot', 'texBedPillow', 'texBedSide', 'texBedHeadSide',
  'texDoorTop', 'texDoorBottom', 'texGlass', 'texChestTop', 'texChestSide', 'texRedstoneTorchStick', 'texRedstoneBlock',
  'texPistonTop', 'texPistonSide', 'texObsidian', 'texGravel', 'texNetherrack', 'texSoulSand', 'texBasaltEnd',
  'texBasaltSide', 'texGlowstone', 'texNetherQuartzOre',
];

const lines = [];
lines.push("// Pack de textures « 16x16 » (Phase 37) : GÉNÉRÉ par tools/gen-pixel16.mjs, pas dessiné");
lines.push("// à la main -- chaque bloc ci-dessous est une grille RÉELLE de 16x16 cases (cf. pixelTex");
lines.push("// plus bas, même technique que le bateau dans textures.js : BOAT_PIXELS/BOAT_PALETTE),");
lines.push("// obtenue en réduisant la texture procédurale d'origine (32x32) case par case puis en");
lines.push("// regroupant ses couleurs en un petit nuancier (k-means, ~10 teintes) -- le rendu \"gros");
lines.push("// pixels\" typique d'un pack 16x16, à la place du bruit fin de la texture de base.");
lines.push("//");
lines.push("// Couvre les 49 FACES DE BLOC du monde (celles de render/atlas.js) ; les outils, la");
lines.push("// nourriture, les mobs et les états on/off (redstone, leviers, boutons, répéteur) ne");
lines.push("// sont PAS repris ici et restent sur la texture de base même quand ce pack est actif");
lines.push("// (cf. textures-select.js) : ce ne sont pas des faces de bloc.");
lines.push("");
lines.push("import { newCanvas, canvasToTexture, TEX_SIZE } from './textures.js';");
lines.push("");
lines.push("function pixelTex(rows, palette) {");
lines.push("  const c = newCanvas();");
lines.push("  const ctx = c.getContext('2d');");
lines.push("  ctx.clearRect(0, 0, TEX_SIZE, TEX_SIZE);");
lines.push("  const px = TEX_SIZE / rows.length;");
lines.push("  rows.forEach((row, y) => {");
lines.push("    [...row].forEach((ch, x) => {");
lines.push("      const color = palette[ch];");
lines.push("      if (!color) return; // '.' : transparent (torche, porte, lit...)");
lines.push("      ctx.fillStyle = color;");
lines.push("      ctx.fillRect(x * px, y * px, px, px);");
lines.push("    });");
lines.push("  });");
lines.push("  return canvasToTexture(c);");
lines.push("}");
lines.push("");

for (const k of KEYS) {
  if (!results[k]) { console.error('MANQUANT :', k); continue; }
  const { rows, palette } = results[k];
  const palStr = Object.entries(palette).map(([ch, color]) => `${ch}: '${color}'`).join(', ');
  lines.push(`const ${k}Rows = [`);
  for (const r of rows) lines.push(`  '${r}',`);
  lines.push('];');
  lines.push(`const ${k}Palette = { ${palStr} };`);
  lines.push(`export function ${k}() {`);
  lines.push(`  return pixelTex(${k}Rows, ${k}Palette);`);
  lines.push('}');
  lines.push('');
}

import { writeFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
const outPath = join(dirname(fileURLToPath(import.meta.url)), '../src/render/textures-16.js');
writeFileSync(outPath, lines.join('\n'));
console.log('écrit :', outPath, '--', KEYS.length, 'textures');
