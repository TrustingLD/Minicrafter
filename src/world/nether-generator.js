// Génération du Nether (Phase 29). Même moule que world/generator.js (fonction
// PURE des coordonnées de chunk -- même seed -> même chunk, cf. son commentaire
// en tête de fichier) mais une dimension entièrement séparée : pas de ciel, pas
// de colonnes "hauteur de terrain", une immense caverne continue entre un
// plafond et un sol de bedrock, remplie de netherrack, coupée de lave en
// profondeur, avec 2 "biomes" régionaux (vallées d'âme, deltas de basalte) et
// du minerai de quartz + de la lueur de pierre semés dedans.
//
// Portée assumée (demandé explicitement "juste la génération") : pas de
// portail à construire/allumer, pas de structures (forteresse du Nether,
// bastion...), pas de mobs propres au Nether -- seul le TERRAIN est généré en
// détail. Le passage entre dimensions se fait via /nether et /overworld
// (cf. main.js), pas un portail en jeu.

import { makeNoise2D, makeNoise3D, hash3 } from '../core/math.js';
import { BLOCK_ID } from '../data/blocks.js';
import { CHUNK_X, CHUNK_Y, CHUNK_Z, idx } from './chunk.js';

export const NETHER_LAVA_LEVEL = 31; // même proportion que le vrai jeu (mer de lave ~Y31)
// Notre monde va jusqu'à Y=127 (CHUNK_Y), qui correspond pile à la hauteur du VRAI
// Nether historique (0-127) -- les proportions ci-dessous (mer de lave à 31, plafond
// autour de 123+) reprennent donc directement celles du vrai jeu, pas une simple règle
// de 3 approximative.
const CEIL_SOLID_Y = CHUNK_Y - 5; // 123 : au-delà, TOUJOURS de la bedrock (plafond franc)
const CEIL_ROUGH_FROM_Y = CHUNK_Y - 9; // 119 : zone de transition, bedrock de plus en plus probable

// Bruits dédiés, seeds propres au Nether (aucune ne réutilise celles de
// generator.js) -- sans quoi le Nether calquerait exactement le relief du
// monde normal au même endroit, un comble pour une dimension censée être
// méconnaissable.
const noiseCavern = makeNoise3D(6661); // grande cavité principale -- basse fréquence, larges poches
const noiseCavernDetail = makeNoise3D(6662); // aspérité fine sur les parois de la précédente
const noiseBiome = makeNoise2D(6663); // régions à grande échelle : déchets / vallée d'âme / deltas de basalte
const noisePillar = makeNoise2D(6664); // position des piliers de basalte (deltas uniquement)

const QUARTZ_ID = BLOCK_ID.nether_quartz_ore;
const NETHERRACK_ID = BLOCK_ID.netherrack;
const GLOWSTONE_ID = BLOCK_ID.glowstone;
const SOUL_SAND_ID = BLOCK_ID.soul_sand;
const BASALT_ID = BLOCK_ID.basalt;
const LAVA_ID = BLOCK_ID.lava;
const BEDROCK_ID = BLOCK_ID.bedrock;

// Minerai de quartz (Phase 29) : contrairement aux minerais du monde normal
// (world/generator.js ORE_TYPES, des "veines" -- un seed + expansion en boule
// dans un rayon), ici un simple tirage PAR BLOC de pierre (hash3, déterministe)
// -- assumé plus simple qu'une vraie vénale, donne un semis dispersé plutôt que
// de vrais amas, mais largement suffisant visuellement et beaucoup moins cher à
// calculer sur tout le volume d'un chunk de 128 de haut (pas juste un sous-sol).
const QUARTZ_CHANCE = 0.025;
const QUARTZ_SEED = 6665;
// Lueur de pierre (Phase 29, ajusté Phase 30) : même principe, tirage par bloc
// plutôt que de vrais amas -- un bloc de netherrack qui touche du vide PAR LE
// DESSUS (donc "accroché au plafond" d'une poche, comme le vrai jeu) a une
// chance de devenir de la lueur de pierre. Rendue BEAUCOUP plus rare qu'au
// premier jet (0.09 -> 0.012, ~7x moins) : demandé explicitement, elle
// éclairait presque tous les plafonds de poche, ce qui étouffait l'ambiance
// sombre propre au Nether (sa seule autre source de lumière est la lave).
const GLOWSTONE_CHANCE = 0.012;
const GLOWSTONE_SEED = 6666;

// Chutes de lave (Phase 30, corrigé Phase 33) : partent d'un point du plafond
// d'une poche (repéré comme la lueur de pierre ci-dessus, mais en zone
// "wastes" uniquement -- jamais dans les biomes régionaux, pour ne pas
// dénaturer leur identité visuelle) et tombent tout droit jusqu'au premier
// obstacle (sol, autre liquide déjà là) -- PAS de longueur maximale (retiré
// après coup : une caverne haute de plus de 40 blocs coupait la chute avant
// qu'elle touche le sol, donnant une colonne "flottante" qui s'arrêtait en
// plein vide). La boucle qui suit la poche ouverte vers le bas s'arrête déjà
// toute seule au premier bloc plein ou à y=0 (bedrock), donc rien ne peut
// boucler indéfiniment sans ce plafond artificiel. Simplification assumée :
// un simple tirage PAR COLONNE (pas une vraie mécanique d'écoulement -- ce
// moteur ne fait pas propager tout seuls les liquides posés à la génération,
// cf. le commentaire de la mer de lave plus bas) -- l'animation existante de
// la texture de lave (cf. main.js, `worldApi.lavaTexture.offset`) suffit à
// donner une impression de mouvement même sur une colonne figée.
const LAVAFALL_CHANCE = 0.006;
const LAVAFALL_SEED = 6667;
// Mare au pied de la chute (Phase 33) : une fois le sol atteint, la lave
// "continue de couler" latéralement plutôt que de s'arrêter net en pilier --
// simple remplissage par propagation (BFS), borné en nombre de cases (pas une
// vraie physique de fluide), qui ne s'étend que sur des cases avec un vrai
// sol plein juste en dessous (jamais dans le vide, jamais par-dessus une
// autre poche ouverte).
const LAVAPOOL_MAX_CELLS = 26;

// Régions du Nether (Phase 29) : bruit à TRÈS basse fréquence -> de vastes
// zones cohérentes (des centaines de blocs), pas une mosaïque bruitée bloc
// par bloc -- comme les biomes du monde normal (biomes.js), en plus simple
// (2 seuils, 3 régions, pas de table pondérée).
function netherRegionAt(wx, wz) {
  const v = noiseBiome(wx * 0.006, wz * 0.006);
  if (v > 0.32) return 'basalt_deltas';
  if (v < -0.32) return 'soul_sand_valley';
  return 'wastes';
}

// Statut "ouvert" (caverne) d'une case -- calibré par échantillonnage (cf. le
// commit qui a suivi celui-ci, sweep de seuils) pour ~55% d'espace ouvert en
// profondeur -- un Nether est BEAUCOUP plus creux que le monde normal, cf. le
// commentaire en tête de fichier ("une immense caverne continue", pas un
// réseau de tunnels étroits).
function isOpenAt(wx, wy, wz) {
  const base = noiseCavern(wx * 0.022, wy * 0.03, wz * 0.022);
  const detail = noiseCavernDetail(wx * 0.07, wy * 0.09, wz * 0.07) * 0.18;
  return base + detail > -0.02;
}

// Bedrock du plafond : franche au-delà de CEIL_SOLID_Y, puis transition rugueuse
// (probabilité décroissante) jusqu'à CEIL_ROUGH_FROM_Y -- un plafond parfaitement
// plat aurait l'air artificiel, cf. le vrai jeu dont le plafond de bedrock est
// lui-même irrégulier.
function isCeilingBedrock(wx, wy, wz) {
  if (wy >= CEIL_SOLID_Y) return true;
  if (wy < CEIL_ROUGH_FROM_Y) return false;
  const t = (wy - CEIL_ROUGH_FROM_Y) / (CEIL_SOLID_Y - CEIL_ROUGH_FROM_Y); // 0 en bas de la zone, 1 en haut
  return hash3(wx, wy, wz, 6660) < t;
}

// cf. le commentaire de LAVAPOOL_MAX_CELLS plus haut -- `open`/`data` viennent
// de generateNetherChunk (fermeture), pas de paramètres séparés à retenir.
function spreadLavaPool(data, open, startLx, y, startLz) {
  const queue = [[startLx, startLz]];
  const visited = new Set([`${startLx},${startLz}`]);
  let count = 0;
  while (queue.length && count < LAVAPOOL_MAX_CELLS) {
    const [lx, lz] = queue.shift();
    if (lx < 0 || lx >= CHUNK_X || lz < 0 || lz >= CHUNK_Z) continue;
    if (!open(lx, y, lz)) continue; // pas de place libre ici (déjà plein/lave)
    if (open(lx, y - 1, lz)) continue; // pas de vrai sol dessous -- ne coule pas dans le vide
    data[idx(lx, y, lz)] = LAVA_ID;
    count++;
    for (const [dx, dz] of [
      [1, 0],
      [-1, 0],
      [0, 1],
      [0, -1],
    ]) {
      const k = `${lx + dx},${lz + dz}`;
      if (!visited.has(k)) {
        visited.add(k);
        queue.push([lx + dx, lz + dz]);
      }
    }
  }
}

export function generateNetherChunk(cx, cz) {
  const data = new Uint8Array(CHUNK_X * CHUNK_Y * CHUNK_Z);
  const originX = cx * CHUNK_X;
  const originZ = cz * CHUNK_Z;

  // 1) grille "ouvert/plein" pré-calculée pour TOUT le chunk -- une seule
  // évaluation de bruit par case (même leçon que le bug de perf du gravier
  // dans generator.js : ne JAMAIS rappeler le bruit pour chaque voisin d'une
  // case candidate, toujours précalculer une bonne fois puis ne relire que le
  // tableau ensuite).
  const openGrid = new Uint8Array(CHUNK_X * CHUNK_Y * CHUNK_Z);
  for (let lx = 0; lx < CHUNK_X; lx++) {
    for (let lz = 0; lz < CHUNK_Z; lz++) {
      const wx = originX + lx,
        wz = originZ + lz;
      for (let y = 1; y < CHUNK_Y - 1; y++) {
        if (isCeilingBedrock(wx, y, wz)) continue; // reste à 0 (jamais "ouvert" dans la bedrock)
        if (isOpenAt(wx, y, wz)) openGrid[idx(lx, y, lz)] = 1;
      }
    }
  }
  const open = (lx, y, lz) => {
    if (lx < 0 || lx >= CHUNK_X || lz < 0 || lz >= CHUNK_Z || y < 0 || y >= CHUNK_Y) return false;
    return openGrid[idx(lx, y, lz)] === 1;
  };

  // 2) remplissage : bedrock (sol + plafond), netherrack/lave/région ailleurs.
  for (let lx = 0; lx < CHUNK_X; lx++) {
    for (let lz = 0; lz < CHUNK_Z; lz++) {
      const wx = originX + lx,
        wz = originZ + lz;
      const region = netherRegionAt(wx, wz);
      for (let y = 0; y < CHUNK_Y; y++) {
        const i = idx(lx, y, lz);
        if (y === 0 || isCeilingBedrock(wx, y, wz)) {
          data[i] = BEDROCK_ID;
          continue;
        }
        if (open(lx, y, lz)) {
          // caverne : vide, sauf sous le niveau de la mer de lave -- remplie en
          // dur comme la mer de lave du monde normal (même raison : le liquide
          // ne se propage pas tout seul, cf. generator.js).
          if (y <= NETHER_LAVA_LEVEL) data[i] = LAVA_ID;
          continue;
        }
        // case pleine : netherrack par défaut, sauf surface (touche une case
        // ouverte -- paroi/sol/plafond d'une poche) selon la région, +
        // minerai de quartz / lueur de pierre semés dedans (cf. leurs
        // commentaires plus haut).
        const isSurface =
          open(lx + 1, y, lz) ||
          open(lx - 1, y, lz) ||
          open(lx, y + 1, lz) ||
          open(lx, y - 1, lz) ||
          open(lx, y, lz + 1) ||
          open(lx, y, lz - 1);

        let id = NETHERRACK_ID;
        if (isSurface && region === 'soul_sand_valley') id = SOUL_SAND_ID;
        else if (isSurface && region === 'basalt_deltas') id = BASALT_ID;
        else if (isSurface && open(lx, y + 1, lz) && hash3(wx, y, wz, GLOWSTONE_SEED) < GLOWSTONE_CHANCE) {
          // lueur de pierre : UNIQUEMENT accrochée par le dessus (comme le vrai
          // jeu -- jamais sur un mur ou un sol), jamais dans les 2 biomes
          // régionaux (elle se mêlerait mal au sable des âmes/au basalte).
          id = GLOWSTONE_ID;
        } else if (!isSurface && hash3(wx, y, wz, QUARTZ_SEED) < QUARTZ_CHANCE) {
          id = QUARTZ_ID;
        }
        data[i] = id;
      }

      // Piliers de basalte (Phase 29, deltas uniquement) : quelques colonnes
      // rares qui percent une poche ouverte du sol jusqu'au plafond de la
      // poche, comme le vrai jeu -- juste un tirage par colonne (pas un vrai
      // système de "collision avec le plafond de la poche" complet, cf.
      // simplifications assumées plus haut) : si CETTE colonne est tirée,
      // remplit de basalte toute case ouverte contiguë depuis le bas jusqu'à
      // la première case déjà pleine rencontrée en montant.
      if (region === 'basalt_deltas' && noisePillar(wx * 0.15, wz * 0.15) > 0.82) {
        let y = 1;
        while (y < CHUNK_Y - 1 && !open(lx, y, lz)) y++; // trouve le bas de la première poche
        while (y < CHUNK_Y - 1 && open(lx, y, lz)) {
          data[idx(lx, y, lz)] = BASALT_ID;
          y++;
        }
      }

      // Chutes de lave (Phase 30, cf. LAVAFALL_CHANCE plus haut) : une seule
      // par colonne tirée, part du premier plafond de poche trouvé en
      // scannant du haut vers le bas (zone "wastes" uniquement).
      if (region === 'wastes' && hash3(wx, 0, wz, LAVAFALL_SEED) < LAVAFALL_CHANCE) {
        for (let y = CEIL_ROUGH_FROM_Y - 2; y > NETHER_LAVA_LEVEL + 4; y--) {
          if (!open(lx, y, lz) || !open(lx, y - 1, lz)) continue; // pas un plafond de poche ici
          let yy = y - 1;
          while (yy > 0 && open(lx, yy, lz)) {
            data[idx(lx, yy, lz)] = LAVA_ID;
            yy--;
          }
          // `yy` pointe maintenant la première case NON ouverte sous la chute
          // (le vrai sol où elle atterrit) -- si elle a atterri au-dessus du
          // niveau de la mer de lave (donc sur un vrai sol, pas juste
          // fusionné avec la mer déjà remplie plus bas), elle continue de
          // couler latéralement plutôt que de s'arrêter net en pilier (cf.
          // spreadLavaPool plus haut).
          if (yy + 1 > NETHER_LAVA_LEVEL) spreadLavaPool(data, open, lx, yy + 1, lz);
          break; // une seule chute par colonne, on s'arrête au premier plafond valable
        }
      }
    }
  }

  return { data };
}

// Trouve un point d'atterrissage sûr pour /nether et /overworld (cf. main.js) :
// scanne une colonne du plafond vers le sol et s'arrête à la première poche
// ouverte de 2 cases de haut (assez pour tenir debout) au-dessus d'une case
// pleine -- jamais en pleine bedrock, jamais en pleine lave. `getBlock` est
// celui du monde Nether déjà chargé (cf. worldApi.getGroundHeight côté
// world.js) -- si la colonne n'a par malchance aucune poche adaptée (rare,
// mais une colonne 100% bedrock/lave n'est pas mathématiquement impossible),
// on retombe sur une hauteur fixe raisonnable plutôt que de renvoyer null et
// complexifier tous les appelants.
export function findNetherLanding(getBlock, x, z) {
  const ix = Math.round(x),
    iz = Math.round(z);
  for (let y = CEIL_ROUGH_FROM_Y - 1; y > NETHER_LAVA_LEVEL + 1; y--) {
    const here = getBlock(ix, y, iz);
    const above = getBlock(ix, y + 1, iz);
    const below = getBlock(ix, y - 1, iz);
    if (!here && !above && below && below !== 'lava') return y;
  }
  return NETHER_LAVA_LEVEL + 4; // repli : juste au-dessus de la mer de lave, mieux que rien
}
