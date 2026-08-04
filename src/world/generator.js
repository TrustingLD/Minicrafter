// Génération de terrain par CHUNK (Phase 4a/4b) : `generateChunk(cx, cz)` est une
// fonction pure des coordonnées de chunk — même seed -> même chunk, à chaque appel,
// ce qui est indispensable pour pouvoir décharger un chunk puis le regénérer
// identique (le stockage ne garde que les diffs du joueur, cf. world/world.js).
// Toute la génération (arbres, veines) utilise hash2/hash3 (déterministes) plutôt
// que Math.random().

import { makeNoise2D, makeNoise3D, hash2, hash3 } from '../core/math.js';
import { BLOCK_ID, ORE_TYPES } from '../data/blocks.js';
import { CHUNK_X, CHUNK_Y, CHUNK_Z, idx, inBounds } from './chunk.js';
import { BIOMES, biomeAt, noiseContinent, noiseRiver } from './biomes.js';

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
const noiseLava = makeNoise3D(5150); // bruit dédié aux mares de lave, basse fréquence -> grosses poches

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

// masque de montagne, factorisé : getHeight ET getBiome (Phase 17) en ont besoin
// pour la même colonne, pas la peine de rééchantillonner le bruit deux fois.
function mountainMaskAt(x, z) {
  return Math.max(0, noiseMountain(x * 0.012, z * 0.012) - 0.05); // 0 en plaine, >0 = montagne
}

// Océans (Phase 17.3) : un troisième champ de bruit basse fréquence, séparé du
// relief -- là où il est très négatif, `oceanCarve` pousse toute la colonne sous
// SEA_LEVEL sur une grande échelle. C'est une version "continentale" de lakeCarve
// (même mécanique, fréquence bien plus basse), et comme la sortie est CONTINUE
// (pas un simple `if biome===ocean`), la côte n'a pas de falaise nette à la bordure.
function oceanCarve(x, z, mtMask) {
  if (mtMask > 0.05) return 0; // jamais d'océan en montagne
  const mask = Math.max(0, -noiseContinent(x * 0.004, z * 0.004) - 0.15);
  return mask * 55;
}
function isOceanAt(x, z, mtMask) {
  if (mtMask > 0.05) return false;
  return noiseContinent(x * 0.004, z * 0.004) < -0.15; // même seuil que oceanCarve
}

// Rivières (Phase 17.3) : bruit "ridged" (1 - |bruit|) — proche de son maximum le
// long de fines lignes qui serpentent, exactement où `noiseRiver` change de signe.
// `carve` est un facteur 0..1 mélangé en continu avec la hauteur normale (lerp),
// donc pas de tranchée à bord vertical, et ça reste cohérent d'un chunk à l'autre
// puisque c'est toujours une fonction pure de (x,z) — aucune coordination requise.
//
// RIVER_OFFSET (fix) : un bruit de Perlin vaut EXACTEMENT 0 sur chaque point entier
// de son treillis, donc `1 - |bruit|` y vaut 1 — le maximum. Sans décalage, le
// treillis de ce bruit (pas de 1/0.01 = 100 blocs) est aligné sur l'origine du
// monde : (0,0) était donc une tranchée de rivière GARANTIE, pile sur le point
// d'apparition du joueur. Le décalage (valeurs non entières, sans rapport simple)
// désaligne le treillis de la grille du monde ; il ne supprime pas les points de
// treillis (ils restent sur les lignes de rivière, ce qui est leur rôle), il les
// empêche juste de tomber sur des coordonnées « remarquables » comme l'origine.
const RIVER_OFFSET_X = 31.7;
const RIVER_OFFSET_Z = 17.3;
// Largeur et fond du lit. L'ancien couple (seuil 0.985, fond SEA_LEVEL-2) donnait un
// chenal d'à peine ~3 blocs de large dont le point le plus bas arrivait pile à
// SEA_LEVEL-2 : comme le remplissage ne pose de l'eau que STRICTEMENT au-dessus du
// sol et sous SEA_LEVEL, ça ne laissait qu'un unique bloc d'eau au centre, et rien du
// tout sur les 40 % de colonnes qui atterrissaient à SEA_LEVEL-1. Résultat : un lit
// de rivière parfaitement dessiné, et à sec. Le seuil élargi et le fond abaissé
// donnent un chenal d'environ 6 blocs avec 2 blocs d'eau.
const RIVER_EDGE = 0.96; // ridge au-delà duquel on commence à creuser
const RIVER_BED = SEA_LEVEL - 3; // altitude visée au coeur du chenal
function riverCarve(x, z, mtMask) {
  if (mtMask > 0.08) return 0; // pas de rivière en pleine montagne
  const ridge = 1 - Math.abs(noiseRiver(x * 0.01 + RIVER_OFFSET_X, z * 0.01 + RIVER_OFFSET_Z));
  const t = Math.min(1, Math.max(0, (ridge - RIVER_EDGE) / (1 - RIVER_EDGE)));
  // smoothstep : creuse à fond au milieu et s'aplatit sur les berges, au lieu d'une
  // rampe linéaire qui laissait tout le chenal à mi-hauteur (donc au-dessus de l'eau).
  return t * t * (3 - 2 * t);
}

export function getHeight(x, z) {
  const base = 6 + noise(x * 0.05, z * 0.05) * 5 + noise(x * 0.12, z * 0.12) * 2;
  const mtMask = mountainMaskAt(x, z);
  const mountain = mtMask * 70;
  const lake = lakeCarve(x, z, mtMask);
  const ocean = oceanCarve(x, z, mtMask);
  let h = base + mountain - lake - ocean;
  const river = riverCarve(x, z, mtMask);
  if (river > 0) h = h * (1 - river) + RIVER_BED * river;
  return Math.max(1, Math.min(58, Math.floor(h)));
}

// biome d'une colonne (Phase 17.2) — dérive du même mtMask que getHeight, plus la
// même condition d'océan que oceanCarve (cohérence : un point "océan" pour le
// relief l'est aussi pour le biome).
export function getBiome(x, z) {
  const mtMask = mountainMaskAt(x, z);
  return biomeAt(x, z, mtMask, isOceanAt(x, z, mtMask));
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

// Lave (Phase 4c) : uniquement dans le fond des cavernes déjà creusées (jamais dans
// la pierre pleine), et seulement en profondeur -> pas de lac de lave à ciel ouvert.
// Bruit dédié à basse fréquence (0.045) pour former de vraies mares connexes plutôt
// que des cellules isolées façon poivre-et-sel.
export const LAVA_LEVEL = 6;
function lavaPoolAt(wx, wy, wz) {
  if (wy > LAVA_LEVEL || wy <= 0) return false;
  return noiseLava(wx * 0.045, wy * 0.09, wz * 0.045) > 0.42;
}

const TREE_MARGIN = 4; // rayon de scan autour du chunk : le feuillage (rayon 2) d'un
// arbre raciné dans le chunk voisin peut déborder ici ; en le recalculant (déterministe)
// depuis CE chunk aussi, pas besoin de coordination entre chunks.

// essaie de faire pousser un arbre en (wx, wz) — pure fonction des coordonnées monde.
// Phase 17 : la chance d'arbre vient du BIOME (`BIOMES[x].treeChance`), pas d'une
// constante globale -- un désert (treeChance: 0) n'a plus jamais d'arbre du tout,
// sans avoir besoin d'un `if biome === 'desert'` séparé ici.
function treeAt(wx, wz) {
  const nearSpawn = Math.abs(wx) <= 3 && Math.abs(wz) <= 3; // jamais sur le point de spawn
  if (nearSpawn) return null;
  const h = getHeight(wx, wz);
  if (h <= SEA_LEVEL + 1 || h >= SNOW_LEVEL - 4) return null;
  const treeChance = BIOMES[getBiome(wx, wz)].treeChance;
  if (treeChance <= 0 || hash2(wx, wz, 1) >= treeChance) return null;
  const treeH = 4 + Math.floor(hash2(wx, wz, 2) * 2);
  return { h, treeH };
}

const DECOR_CHANCE = 0.01; // cactus/buisson mort, désert uniquement
// essaie de poser une décoration de désert (cactus 1-3 haut, ou buisson mort) en
// (wx, wz) — même schéma que treeAt : pure fonction de (x,z), rien à coordonner.
function desertDecorAt(wx, wz) {
  if (getBiome(wx, wz) !== 'desert') return null;
  const h = getHeight(wx, wz);
  if (h <= SEA_LEVEL + 1) return null;
  if (hash2(wx, wz, 3) >= DECOR_CHANCE) return null;
  const isCactus = hash2(wx, wz, 4) < 0.5;
  return isCactus
    ? { h, kind: 'cactus', height: 1 + Math.floor(hash2(wx, wz, 5) * 3) }
    : { h, kind: 'dead_bush' };
}

function setLocal(data, lx, ly, lz, blockId) {
  if (inBounds(lx, ly, lz)) data[idx(lx, ly, lz)] = blockId;
}

// génère le contenu d'un chunk : terrain + cavernes + minerais + arbres.
// Retourne { data: Uint8Array }. Eau/lave (Phase 16) sont écrites DIRECTEMENT dans
// `data` comme n'importe quel autre bloc -- fini les side-lists waterCells/lavaCells
// dessinées à part, c'est précisément ce qui empêchait le mesher de leur appliquer
// le culling de face normal.
// Épaisseur minimale de terrain au-dessus d'une veine de minerai. Sans cette marge,
// une veine pouvait remplacer le bloc de surface lui-même : en biome montagne (dont
// la surface est déjà de la pierre) on marchait littéralement sur du minerai de
// diamant à ciel ouvert. 2 = au moins deux blocs de couverture à creuser.
const ORE_SURFACE_MARGIN = 2;

export function generateChunk(cx, cz) {
  const STONE = BLOCK_ID.stone;
  const data = new Uint8Array(CHUNK_X * CHUNK_Y * CHUNK_Z);
  const originX = cx * CHUNK_X;
  const originZ = cz * CHUNK_Z;
  // hauteur de terrain par colonne, mémorisée pendant la passe 1 : la passe 2
  // (minerais) en a besoin pour savoir où est la surface, et getHeight est trop
  // coûteux pour être rappelé par bloc écrit.
  const heights = new Int16Array(CHUNK_X * CHUNK_Z);

  // 1) colonnes de terrain + cavernes creusées au passage
  for (let lx = 0; lx < CHUNK_X; lx++) {
    for (let lz = 0; lz < CHUNK_Z; lz++) {
      const wx = originX + lx,
        wz = originZ + lz;
      const h = getHeight(wx, wz);
      heights[lz * CHUNK_X + lx] = h;
      // biome : une seule fois par colonne (pas par bloc de la colonne) -- même
      // raison que `h`, le mtMask/continentalness sous-jacents ne changent pas avec y.
      const biome = BIOMES[getBiome(wx, wz)];
      for (let y = 0; y < CHUNK_Y && y <= h; y++) {
        if (y === 0) {
          data[idx(lx, y, lz)] = BLOCK_ID.bedrock;
          continue;
        }
        if (caveCarves(wx, y, wz, h)) {
          // caverne : on laisse de l'air, sauf poche de lave en profondeur
          if (lavaPoolAt(wx, y, wz)) data[idx(lx, y, lz)] = BLOCK_ID.lava;
          continue;
        }
        let type;
        if (y === h) type = h > SNOW_LEVEL ? 'snow' : biome.surface;
        else if (y > h - 3) type = h > SNOW_LEVEL ? 'dirt' : biome.subsurface;
        else type = 'stone';
        data[idx(lx, y, lz)] = BLOCK_ID[type];
      }
      // lac : le terrain de cette colonne s'arrête sous le niveau de la mer -> on
      // remplit l'air laissé au-dessus (jusqu'à SEA_LEVEL-1) avec de l'eau, un vrai
      // bloc désormais. Ne recreuse jamais la pierre pleine (la boucle ci-dessus
      // s'arrête déjà à `h`) donc aucun risque d'écraser du terrain solide.
      if (h < SEA_LEVEL) {
        for (let y = Math.max(1, h + 1); y < SEA_LEVEL; y++) data[idx(lx, y, lz)] = BLOCK_ID.water;
      }
    }
  }

  // 2) veines de minerai : ne remplacent que de la pierre déjà posée (jamais l'air
  //    d'une caverne, jamais la terre/l'herbe de surface)
  for (const ore of ORE_TYPES) {
    const radius = Math.max(1, Math.min(2.2, Math.cbrt((ore.veinSize * 3) / (4 * Math.PI))));
    const r = Math.ceil(radius);
    const yMax = Math.min(ore.maxY, CHUNK_Y - 1);
    const rarityPerBlock = ore.rarity / ore.veinSize;
    for (let lx = 0; lx < CHUNK_X; lx++) {
      for (let lz = 0; lz < CHUNK_Z; lz++) {
        const wx = originX + lx,
          wz = originZ + lz;
        for (let wy = ore.minY; wy <= yMax; wy++) {
          // sortie précoce : un test de tableau typé coûte ~50x moins qu'un hash3, et
          // la grande majorité des cellules de la bande de profondeur est de l'air
          // (au-dessus du terrain) ou déjà creusée par une caverne.
          if (data[idx(lx, wy, lz)] !== STONE) continue;
          if (wy > heights[lz * CHUNK_X + lx] - ORE_SURFACE_MARGIN) continue; // trop près de la surface
          // probabilité par bloc candidat -> ~`rarity` fraction de veines de taille
          // `veinSize` en moyenne sur la bande de profondeur
          if (hash3(wx, wy, wz, ore.id) >= rarityPerBlock) continue;
          for (let dx = -r; dx <= r; dx++)
            for (let dy = -r; dy <= r; dy++)
              for (let dz = -r; dz <= r; dz++) {
                if (dx * dx + dy * dy + dz * dz > radius * radius) continue;
                const tlx = lx + dx,
                  ty = wy + dy,
                  tlz = lz + dz;
                if (!inBounds(tlx, ty, tlz)) continue;
                // la marge vaut aussi pour l'EXPANSION de la veine, pas seulement pour
                // sa graine : un bourgeonnement en diagonale peut viser une colonne
                // voisine bien plus basse, et y ressortir à l'air libre.
                if (ty > heights[tlz * CHUNK_X + tlx] - ORE_SURFACE_MARGIN) continue;
                if (data[idx(tlx, ty, tlz)] === STONE) data[idx(tlx, ty, tlz)] = ore.id;
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

  // 4) décorations de désert (cactus / buisson mort) — même scan, pas de marge
  // nécessaire (contrairement aux arbres, rien ne déborde sur le chunk voisin).
  for (let lx = 0; lx < CHUNK_X; lx++) {
    for (let lz = 0; lz < CHUNK_Z; lz++) {
      const wx = originX + lx,
        wz = originZ + lz;
      const decor = desertDecorAt(wx, wz);
      if (!decor) continue;
      if (data[idx(lx, decor.h, lz)] === 0) continue; // rien à poser sur du vide (grotte affleurante)
      if (decor.kind === 'cactus') {
        for (let dy = 1; dy <= decor.height; dy++)
          setLocal(data, lx, decor.h + dy, lz, BLOCK_ID.cactus);
      } else {
        setLocal(data, lx, decor.h + 1, lz, BLOCK_ID.dead_bush);
      }
    }
  }

  return { data };
}

// Point d'apparition (fix) : le jeu supposait que (0,0) était une colonne jouable et
// y plaçait le joueur en dur. Rien ne le garantissait — l'origine pouvait être (et
// était) sous le niveau de la mer, donc le joueur naissait au fond d'un trou noyé,
// dans le noir, à se noyer. On CHERCHE maintenant la première colonne réellement
// habitable, en anneaux carrés autour de l'origine (donc au plus près possible).
// Pure fonction du bruit : aucun chunk n'a besoin d'être chargé pour l'appeler.
export function findSpawnColumn(maxRadius = 128) {
  for (let r = 0; r <= maxRadius; r++) {
    for (let dx = -r; dx <= r; dx++) {
      for (let dz = -r; dz <= r; dz++) {
        // seulement le nouvel anneau : l'intérieur a déjà été rejeté aux tours précédents
        if (Math.max(Math.abs(dx), Math.abs(dz)) !== r) continue;
        const h = getHeight(dx, dz);
        if (h <= SEA_LEVEL + 1) continue; // rivière / lac / océan : jamais
        if (h >= SNOW_LEVEL) continue; // ni sur un sommet enneigé
        if (getBiome(dx, dz) === 'ocean') continue;
        if (caveCarves(dx, h, dz, h)) continue; // sol de surface évidé par une grotte
        if (treeAt(dx, dz)) continue; // pas à l'intérieur d'un tronc
        return { x: dx, y: h, z: dz };
      }
    }
  }
  return { x: 0, y: getHeight(0, 0), z: 0 };
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
