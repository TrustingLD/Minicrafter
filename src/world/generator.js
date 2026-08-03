// Génération de terrain par CHUNK (Phase 4a/4b) : `generateChunk(cx, cz)` est une
// fonction pure des coordonnées de chunk — même seed -> même chunk, à chaque appel,
// ce qui est indispensable pour pouvoir décharger un chunk puis le regénérer
// identique (le stockage ne garde que les diffs du joueur, cf. world/world.js).
// Toute la génération (arbres, veines) utilise hash2/hash3 (déterministes) plutôt
// que Math.random().

import { makeNoise2D, makeNoise3D, hash2, hash3 } from '../core/math.js';
import { BLOCK_ID, ORE_TYPES } from '../data/blocks.js';
import { CHUNK_X, CHUNK_Y, CHUNK_Z, idx, inBounds } from './chunk.js';

// taille "logique" du monde (TODO 9) : les chunks au-delà ne sont simplement jamais
// générés/rendus, donc ce nombre ne coûte plus de mémoire (Phase 4a lève l'ancien
// plafond MAX_INSTANCES qui limitait le monde à 150x150).
export const WORLD_SIZE = 1000;
export const SEA_LEVEL = 4;
export const SNOW_LEVEL = 26;
// mur invisible : un cran à l'intérieur de WORLD_SIZE pour laisser une bordure de
// blocs visible avant le mur (sinon on tombe dans le vide en le touchant).
export const WORLD_BORDER = WORLD_SIZE / 2 - 2;

// blocs "de canopée" à ignorer quand on cherche la vraie surface du terrain :
// sans ça, un mob (ou le joueur au spawn) pouvait atterrir en haut d'un arbre
// au lieu du sol, faussement détecté comme "surface" la plus haute de la colonne
export const CANOPY_BLOCKS = new Set(['leaves', 'wood', 'crafting_table']);

const noise = makeNoise2D(1337);
const noiseMountain = makeNoise2D(9001); // bruit séparé, basse fréquence, pour les massifs montagneux
const noiseLake = makeNoise2D(2024); // bruit basse fréquence dédié aux cuvettes de lac
const noiseCave = makeNoise3D(4242); // bruit 3D principal pour les cavernes (Phase 4b)
const noiseCaveDetail = makeNoise3D(7777); // 2e octave, plus fine, pour des tunnels moins "en boule"

// Lacs : avant ce fix, un point ne passait sous SEA_LEVEL que par accident (creux
// isolé du bruit de base `noise`), donc quasi invisible en jeu. `lakeMask` est un
// champ dédié, à très basse fréquence, indépendant du relief : quand il dépasse un
// seuil il creuse une VRAIE cuvette large (échelle ~50 blocs) qui passe sous le
// niveau de la mer, avec un fond qui remonte doucement vers les berges.
function lakeCarve(x, z, mtMask) {
  if (mtMask > 0.02) return 0; // jamais de lac en flanc de montagne (pas de lac perché)
  const mask = Math.max(0, noiseLake(x * 0.02, z * 0.02) - 0.35);
  return mask * 40; // jusqu'à ~26 blocs de creux au coeur du bassin
}

export function getHeight(x, z) {
  const base = 6 + noise(x * 0.05, z * 0.05) * 5 + noise(x * 0.12, z * 0.12) * 2;
  const mtMask = Math.max(0, noiseMountain(x * 0.012, z * 0.012) - 0.05); // 0 en plaine, >0 = montagne
  const mountain = mtMask * 70;
  const lake = lakeCarve(x, z, mtMask);
  return Math.max(1, Math.min(58, Math.floor(base + mountain - lake)));
}

// seuil de sculpture d'une caverne en un point donné, `surfaceH` déjà connu par
// l'appelant (évite de rappeler getHeight, coûteux, pour chaque bloc de la colonne)
//
// Fix (entrées de grottes trop rares) : l'ancienne version interdisait TOUTE caverne
// à moins de 3 blocs sous la surface (`return false` dur) — une grotte ne pouvait
// donc déboucher à l'air libre que via une pente très abrupte (rare, le relief est
// lisse). On remplace le blocage dur par un seuil qui monte progressivement en
// approchant de la surface : ça laisse une vraie chance d'entrée naturelle (rare,
// mais pas quasi-nulle) sans transformer la surface en gruyère.
function caveCarves(wx, wy, wz, surfaceH) {
  const depth = surfaceH - wy;
  const n = noiseCave(wx * 0.09, wy * 0.12, wz * 0.09);
  const detail = noiseCaveDetail(wx * 0.22, wy * 0.22, wz * 0.22);
  let threshold = wy < 8 ? 0.58 : 0.53; // un peu plus dur près de la bedrock : pas de gruyère
  if (depth < 4) threshold += (4 - depth) * 0.16; // de plus en plus dur près de la surface
  return n + detail * 0.25 > threshold;
}

const TREE_CHANCE = 0.012;
const TREE_MARGIN = 4; // rayon de scan autour du chunk : le feuillage (rayon 2) d'un
// arbre raciné dans le chunk voisin peut déborder ici ; en le recalculant (déterministe)
// depuis CE chunk aussi, pas besoin de coordination entre chunks.

// essaie de faire pousser un arbre en (wx, wz) — pure fonction des coordonnées monde
function treeAt(wx, wz) {
  const nearSpawn = Math.abs(wx) <= 3 && Math.abs(wz) <= 3; // jamais sur le point de spawn
  if (nearSpawn) return null;
  const h = getHeight(wx, wz);
  if (h <= SEA_LEVEL + 1 || h >= SNOW_LEVEL - 4) return null;
  if (hash2(wx, wz, 1) >= TREE_CHANCE) return null;
  const treeH = 4 + Math.floor(hash2(wx, wz, 2) * 2);
  return { h, treeH };
}

function setLocal(data, lx, ly, lz, blockId) {
  if (inBounds(lx, ly, lz)) data[idx(lx, ly, lz)] = blockId;
}

// génère le contenu d'un chunk : terrain + cavernes + minerais + arbres.
// Retourne { data: Uint8Array, waterCells: [{lx,lz}] }.
export function generateChunk(cx, cz) {
  const data = new Uint8Array(CHUNK_X * CHUNK_Y * CHUNK_Z);
  const waterCells = [];
  const originX = cx * CHUNK_X;
  const originZ = cz * CHUNK_Z;

  // 1) colonnes de terrain + cavernes creusées au passage
  for (let lx = 0; lx < CHUNK_X; lx++) {
    for (let lz = 0; lz < CHUNK_Z; lz++) {
      const wx = originX + lx,
        wz = originZ + lz;
      const h = getHeight(wx, wz);
      for (let y = 0; y < CHUNK_Y && y <= h; y++) {
        if (y === 0) {
          data[idx(lx, y, lz)] = BLOCK_ID.bedrock;
          continue;
        }
        if (caveCarves(wx, y, wz, h)) continue; // caverne : on laisse de l'air
        let type;
        if (y === h) type = h > SNOW_LEVEL ? 'snow' : 'grass';
        else if (y > h - 3) type = 'dirt';
        else type = 'stone';
        data[idx(lx, y, lz)] = BLOCK_ID[type];
      }
      if (h < SEA_LEVEL) waterCells.push({ lx, lz, h }); // `h` : hauteur du fond, pour remplir toute la colonne d'eau (cf. world.js)
    }
  }

  // 2) veines de minerai : ne remplacent que de la pierre déjà posée (jamais l'air
  //    d'une caverne, jamais la terre/l'herbe de surface)
  for (const ore of ORE_TYPES) {
    const radius = Math.max(1, Math.min(2.2, Math.cbrt((ore.veinSize * 3) / (4 * Math.PI))));
    const r = Math.ceil(radius);
    const yMax = Math.min(ore.maxY, CHUNK_Y - 1);
    for (let lx = 0; lx < CHUNK_X; lx++) {
      for (let lz = 0; lz < CHUNK_Z; lz++) {
        const wx = originX + lx,
          wz = originZ + lz;
        for (let wy = ore.minY; wy <= yMax; wy++) {
          // probabilité par bloc candidat -> ~`rarity` fraction de veines de taille
          // `veinSize` en moyenne sur la bande de profondeur
          if (hash3(wx, wy, wz, ore.id) >= ore.rarity / ore.veinSize) continue;
          for (let dx = -r; dx <= r; dx++)
            for (let dy = -r; dy <= r; dy++)
              for (let dz = -r; dz <= r; dz++) {
                if (dx * dx + dy * dy + dz * dz > radius * radius) continue;
                const tlx = lx + dx,
                  ty = wy + dy,
                  tlz = lz + dz;
                if (!inBounds(tlx, ty, tlz)) continue;
                if (data[idx(tlx, ty, tlz)] === BLOCK_ID.stone) data[idx(tlx, ty, tlz)] = ore.id;
              }
        }
      }
    }
  }

  // 3) arbres (scan avec marge, cf. commentaire sur TREE_MARGIN)
  for (let lx = -TREE_MARGIN; lx < CHUNK_X + TREE_MARGIN; lx++) {
    for (let lz = -TREE_MARGIN; lz < CHUNK_Z + TREE_MARGIN; lz++) {
      const wx = originX + lx,
        wz = originZ + lz;
      const t = treeAt(wx, wz);
      if (!t) continue;
      const { h, treeH } = t;
      for (let ty = 1; ty <= treeH; ty++) setLocal(data, lx, h + ty, lz, BLOCK_ID.wood);
      for (let dx = -2; dx <= 2; dx++) {
        for (let dz = -2; dz <= 2; dz++) {
          for (let dy = 0; dy <= 2; dy++) {
            if (Math.abs(dx) + Math.abs(dz) + dy > 3) continue;
            const ly = h + treeH + dy - 1;
            if (hash3(wx + dx, ly, wz + dz, 7) < 0.15) continue; // trou occasionnel dans le feuillage
            const tlx = lx + dx,
              tlz = lz + dz;
            if (inBounds(tlx, ly, tlz) && data[idx(tlx, ly, tlz)] === 0)
              data[idx(tlx, ly, tlz)] = BLOCK_ID.leaves;
          }
        }
      }
    }
  }

  return { data, waterCells };
}

// hauteur du sol réellement solide (creuse au travers des cavernes/arbres) en un
// point donné. `getBlock(x,y,z)` doit déjà avoir chargé le chunk concerné — c'est
// world.js qui s'en assure avant d'appeler cette fonction.
export function getGroundHeight(getBlock, x, z) {
  const ix = Math.round(x),
    iz = Math.round(z);
  for (let y = CHUNK_Y - 1; y >= 0; y--) {
    const t = getBlock(ix, y, iz);
    if (t && !CANOPY_BLOCKS.has(t)) return y + 1;
  }
  return 1;
}
