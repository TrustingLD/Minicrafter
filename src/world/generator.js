// Génération de terrain (bruit de Perlin). Les fonctions reçoivent le monde/tableau
// d'eau en paramètre plutôt que de garder un état module-level : ça les garde testables.

import { makeNoise2D } from '../core/math.js';

export const CHUNK_SIZE = 150; // taille du monde généré
export const WORLD_HEIGHT = 60; // pour accueillir les montagnes
export const SEA_LEVEL = 4;
export const SNOW_LEVEL = 26;
// mur invisible : au-delà, plus de sol généré. Un cran à l'intérieur de CHUNK_SIZE
// pour laisser une bordure de blocs visible avant le mur (sinon on tombe dans le vide).
export const WORLD_BORDER = CHUNK_SIZE / 2 - 2;

export function keyOf(x, y, z) {
  return x + ',' + y + ',' + z;
}

// blocs "de canopée" à ignorer quand on cherche la vraie surface du terrain :
// sans ça, un mob (ou le joueur au spawn) pouvait atterrir en haut d'un arbre
// au lieu du sol, faussement détecté comme "surface" la plus haute de la colonne
export const CANOPY_BLOCKS = new Set(['leaves', 'wood', 'crafting_table']);

const noise = makeNoise2D(1337);
const noiseMountain = makeNoise2D(9001); // bruit séparé, basse fréquence, pour les massifs montagneux

export function getHeight(x, z) {
  const base = 6 + noise(x * 0.05, z * 0.05) * 5 + noise(x * 0.12, z * 0.12) * 2;
  const mtMask = Math.max(0, noiseMountain(x * 0.012, z * 0.012) - 0.05); // 0 en plaine, >0 = montagne
  const mountain = mtMask * 70;
  return Math.max(1, Math.min(58, Math.floor(base + mountain)));
}

export function generateTerrain(world, waterCells) {
  const half = CHUNK_SIZE / 2;
  for (let x = -half; x < half; x++) {
    for (let z = -half; z < half; z++) {
      const h = getHeight(x, z);
      for (let y = 0; y <= h; y++) {
        let type;
        if (y === h) type = h > SNOW_LEVEL ? 'snow' : 'grass';
        else if (y > h - 3) type = 'dirt';
        else type = 'stone';
        world[keyOf(x, y, z)] = type;
      }
      if (h < SEA_LEVEL) waterCells.push({ x, z });
      // pas d'arbre près de (0,0) : c'est le point de spawn (cf. main.js) — un tronc/feuillage
      // pouvait sinon apparaître pile dessus et coincer le joueur dedans dès le chargement
      const nearSpawn = Math.abs(x) <= 3 && Math.abs(z) <= 3;
      if (!nearSpawn && Math.random() < 0.012 && h > SEA_LEVEL + 1 && h < SNOW_LEVEL - 4) {
        const treeH = 4 + Math.floor(Math.random() * 2);
        for (let ty = 1; ty <= treeH; ty++) world[keyOf(x, h + ty, z)] = 'wood';
        for (let lx = -2; lx <= 2; lx++) {
          for (let lz = -2; lz <= 2; lz++) {
            for (let ly = 0; ly <= 2; ly++) {
              if (Math.abs(lx) + Math.abs(lz) + ly <= 3 && Math.random() > 0.15) {
                world[keyOf(x + lx, h + treeH + ly - 1, z + lz)] = 'leaves';
              }
            }
          }
        }
      }
    }
  }
}

export function getGroundHeight(world, x, z) {
  const ix = Math.round(x),
    iz = Math.round(z);
  for (let y = WORLD_HEIGHT + 6; y >= 0; y--) {
    const t = world[keyOf(ix, y, iz)];
    if (t && !CANOPY_BLOCKS.has(t)) return y + 1;
  }
  return 1;
}
