// Villages (Phase 20, densité revue) : peuplement du monde par bourgades, généré au
// même titre que le relief -- fonction PURE des coordonnées (hash2 déterministe,
// comme treeAt ou caveEntranceSeed dans generator.js). Même chunk demandé deux fois
// -> même village.
//
// Grille de cellules de VILLAGE_CELL blocs. Chaque cellule est CANDIDATE à un
// village : son centre est tiré au hasard mais toujours à au moins VILLAGE_MARGIN
// blocs du bord de la cellule -- toujours nettement plus que VILLAGE_FOOTPRINT_RADIUS
// (la plus grande distance possible entre le centre et un bloc de structure), donc
// un village ne peut JAMAIS déborder sur une cellule voisine. Contrairement aux
// entrées de grotte (generator.js), aucun scan des cellules adjacentes n'est donc
// nécessaire : une colonne n'a besoin d'interroger que la cellule qui la contient.
//
// Le village n'est effectivement posé que si son centre tombe sur un biome
// constructible et hors de l'eau -- sinon la cellule reste vide. Le résultat n'est
// donc pas "un village exactement tous les 250 blocs" mais "une tentative tous les
// 250 blocs, réalisée quand le terrain s'y prête" (même simplification assumée que
// pour les arbres/minerais : pure fonction du bruit, jamais de coordination globale).

import { hash2 } from '../core/math.js';
import { CHUNK_X, CHUNK_Z } from './chunk.js';

// Résolus paresseusement (pas un import direct au niveau module) : generator.js
// importe ce fichier ET ce fichier a besoin de generator.js (relief/biome) --
// dépendance circulaire saine tant que rien ici n'utilise ces bindings AVANT que
// generator.js ait fini de s'évaluer (uniquement à l'intérieur de fonctions,
// jamais au niveau module). Cf. commentaire équivalent en tête de generator.js.
import { getHeight, getBiome, SEA_LEVEL } from './generator.js';

// 250 (au lieu de 1000) : villages ~4x plus fréquents, sur demande -- des bourgades
// qu'on croise vraiment en explorant, pas une curiosité qu'il faut chercher pendant
// des heures. VILLAGE_MARGIN réduit en proportion (150 -> 40), mais reste largement
// supérieur à VILLAGE_FOOTPRINT_RADIUS (~16) : la garantie "jamais à cheval sur deux
// cellules" tient toujours, juste avec moins de marge de manoeuvre pour le tirage
// aléatoire du centre à l'intérieur de sa cellule.
export const VILLAGE_CELL = 250;
const VILLAGE_MARGIN = 40; // centre <-> bord de cellule (cf. commentaire en tête de fichier)
const BUILDABLE_BIOMES = new Set(['plains', 'forest', 'snowy']);

const HOUSE_SIZE = 2; // demi-côté : empreinte de maison 5x5 (-2..2)
const WALL_H = 3; // hauteur de mur (en blocs, au-dessus du sol de la maison)
const ORBIT_MIN = 8; // distance mini centre du village <-> centre d'une maison
const ORBIT_MAX = 12; // distance maxi
const STRUCT_MARGIN = 4; // plus grande distance possible entre le centre d'UNE maison et un de ses blocs
export const VILLAGE_FOOTPRINT_RADIUS = ORBIT_MAX + STRUCT_MARGIN; // rayon aplani autour du centre du village

const villageCache = new Map();

// tire (ou relit depuis le cache) le village d'une cellule de grille -- pure
// fonction de (cellX, cellZ), jamais invalidée (comme caveEntranceSeed).
function villageAtCell(cellX, cellZ) {
  const key = cellX * 1000003 + cellZ;
  const cached = villageCache.get(key);
  if (cached !== undefined) return cached;
  let village = null;
  const span = VILLAGE_CELL - 2 * VILLAGE_MARGIN;
  const cx = cellX * VILLAGE_CELL + VILLAGE_MARGIN + Math.floor(hash2(cellX, cellZ, 9001) * span);
  const cz = cellZ * VILLAGE_CELL + VILLAGE_MARGIN + Math.floor(hash2(cellX, cellZ, 9002) * span);
  const biome = getBiome(cx, cz);
  const h = getHeight(cx, cz);
  if (BUILDABLE_BIOMES.has(biome) && h > SEA_LEVEL + 2) {
    const n = 4 + Math.floor(hash2(cellX, cellZ, 9003) * 3); // 4 à 6 maisons
    const houses = [];
    for (let i = 0; i < n; i++) {
      const angle = (i / n) * Math.PI * 2 + (hash2(cellX, cellZ, 9010 + i) - 0.5) * 0.6;
      const dist = ORBIT_MIN + hash2(cellX, cellZ, 9020 + i) * (ORBIT_MAX - ORBIT_MIN);
      const hx = cx + Math.round(Math.sin(angle) * dist);
      const hz = cz + Math.round(Math.cos(angle) * dist);
      // porte orientée vers le centre du village : l'axe dominant du vecteur
      // (centre - maison) donne le côté (0 = nord/-z, 1 = est/+x, 2 = sud/+z, 3 = ouest/-x)
      const ddx = cx - hx,
        ddz = cz - hz;
      const facing =
        Math.abs(ddx) > Math.abs(ddz) ? (ddx > 0 ? 1 : 3) : ddz > 0 ? 2 : 0;
      houses.push({ x: hx, z: hz, facing, hasCraftingTable: i === 0 });
    }
    village = { cx, cz, platformY: h, houses, key };
  }
  villageCache.set(key, village);
  return village;
}

// le seul village qui pourrait toucher ce CHUNK (ou null) -- un seul lookup par
// chunk généré, pas par colonne (cf. commentaire en tête de fichier : un village ne
// déborde jamais de sa cellule). `originX/originZ` = coin du chunk, comme dans
// generator.js.
export function findVillageForChunk(originX, originZ) {
  const midX = originX + CHUNK_X / 2,
    midZ = originZ + CHUNK_Z / 2; // CHUNK_X === CHUNK_Z (16) mais on garde les deux constantes pour rester correct si ça change
  const village = villageAtCell(Math.floor(midX / VILLAGE_CELL), Math.floor(midZ / VILLAGE_CELL));
  if (!village) return null;
  const dx = village.cx - midX,
    dz = village.cz - midZ;
  const reach = VILLAGE_FOOTPRINT_RADIUS + CHUNK_X; // marge généreuse (diagonale du chunk)
  if (dx * dx + dz * dz > reach * reach) return null;
  return village;
}

// plateforme du village sous (wx, wz), ou null si hors de son emprise -- utilisé par
// generateChunk pour aplatir le terrain avant d'y poser les structures.
export function villagePlatformAt(village, wx, wz) {
  const dx = wx - village.cx,
    dz = wz - village.cz;
  if (dx * dx + dz * dz > VILLAGE_FOOTPRINT_RADIUS * VILLAGE_FOOTPRINT_RADIUS) return null;
  return village.platformY;
}

// rotation locale -> monde selon la façade choisie pour la maison (cf. `facing`
// ci-dessus). Le gabarit canonique (ci-dessous) a sa porte au nord (lz négatif).
function rotate(lx, lz, facing) {
  switch (facing) {
    case 1:
      return [-lz, lx]; // porte à l'est : 90°
    case 2:
      return [-lx, -lz]; // porte au sud : 180°
    case 3:
      return [lz, -lx]; // porte à l'ouest : 270°
    default:
      return [lx, lz]; // porte au nord : gabarit tel quel
  }
}

// blocs d'UNE maison dans son repère local (avant rotation/translation) : sol en
// planches, murs à ossature (coins en bois, reste en planches) avec une porte de 2
// de haut au centre de la façade nord, toit plat, une torche à côté de la porte.
function houseLocalBlocks(hasCraftingTable) {
  const blocks = [];
  const S = HOUSE_SIZE;
  for (let lx = -S; lx <= S; lx++)
    for (let lz = -S; lz <= S; lz++) blocks.push({ dx: lx, dy: 0, dz: lz, block: 'planks' });
  for (let lx = -S; lx <= S; lx++) {
    for (let lz = -S; lz <= S; lz++) {
      const onEdge = Math.abs(lx) === S || Math.abs(lz) === S;
      if (!onEdge) continue;
      const corner = Math.abs(lx) === S && Math.abs(lz) === S;
      const isDoor = lx === 0 && lz === -S;
      for (let dy = 1; dy <= WALL_H; dy++) {
        if (isDoor && dy <= 2) continue; // ouverture de la porte (2 de haut)
        blocks.push({ dx: lx, dy, dz: lz, block: corner ? 'wood' : 'planks' });
      }
    }
  }
  for (let lx = -S; lx <= S; lx++)
    for (let lz = -S; lz <= S; lz++) blocks.push({ dx: lx, dy: WALL_H + 1, dz: lz, block: 'planks' });
  blocks.push({ dx: 1, dy: 2, dz: -S, block: 'torch' });
  if (hasCraftingTable) blocks.push({ dx: -1, dy: 1, dz: 1, block: 'crafting_table' });
  return blocks;
}

// place centrale : un puits (anneau de pierre autour d'un point d'eau) + deux
// torches, posé au centre exact du village.
function wellLocalBlocks() {
  const blocks = [];
  for (let lx = -1; lx <= 1; lx++)
    for (let lz = -1; lz <= 1; lz++) {
      if (lx === 0 && lz === 0) blocks.push({ dx: lx, dy: 0, dz: lz, block: 'water' });
      else blocks.push({ dx: lx, dy: 1, dz: lz, block: 'stone' });
    }
  blocks.push({ dx: -2, dy: 2, dz: -2, block: 'torch' });
  blocks.push({ dx: 2, dy: 2, dz: 2, block: 'torch' });
  return blocks;
}

// tous les blocs d'un village posé (maisons + puits), en coordonnées MONDE absolues,
// indexés par colonne pour une recherche O(1) depuis generateChunk. Mis en cache par
// village : coûteux à construire, mais toujours identique (tirage pur des coordonnées
// de la cellule).
const villageColumnsCache = new Map();
function villageColumns(village) {
  const cached = villageColumnsCache.get(village.key);
  if (cached) return cached;
  const map = new Map();
  const add = (wx, dy, wz, block) => {
    const k = wx * 1000003 + wz;
    let arr = map.get(k);
    if (!arr) map.set(k, (arr = []));
    arr.push({ y: village.platformY + dy, block });
  };
  for (const house of village.houses) {
    for (const b of houseLocalBlocks(house.hasCraftingTable)) {
      const [wx0, wz0] = rotate(b.dx, b.dz, house.facing);
      add(house.x + wx0, b.dy, house.z + wz0, b.block);
    }
  }
  for (const b of wellLocalBlocks()) add(village.cx + b.dx, b.dy, village.cz + b.dz, b.block);
  villageColumnsCache.set(village.key, map);
  return map;
}

// blocs de structure à poser pour la colonne (wx, wz) d'un village déjà résolu (via
// findVillageForChunk) -- liste de {y, block}, ou null si rien à poser ici.
export function villageStructureBlocksAt(village, wx, wz) {
  return villageColumns(village).get(wx * 1000003 + wz) || null;
}

// points d'apparition des villageois : juste devant la porte de chaque maison, au
// niveau du sol du village. Utilisé par entities/mob.js, indépendamment du chargement
// des chunks (pure fonction des coordonnées, comme le reste de ce fichier).
export function villageDoorSpots(village) {
  const S = HOUSE_SIZE;
  return village.houses.map((house) => {
    const [wx0, wz0] = rotate(0, -(S + 1), house.facing);
    return { x: house.x + wx0, z: house.z + wz0, y: village.platformY };
  });
}

// villages à portée d'un point (le joueur) -- pure fonction, ne dépend pas des
// chunks chargés. `radius` en blocs.
export function findVillagesNear(x, z, radius) {
  const cellR = Math.max(1, Math.ceil((radius + VILLAGE_FOOTPRINT_RADIUS) / VILLAGE_CELL));
  const cellX = Math.floor(x / VILLAGE_CELL),
    cellZ = Math.floor(z / VILLAGE_CELL);
  const out = [];
  for (let dcx = -cellR; dcx <= cellR; dcx++) {
    for (let dcz = -cellR; dcz <= cellR; dcz++) {
      const village = villageAtCell(cellX + dcx, cellZ + dcz);
      if (!village) continue;
      const dx = village.cx - x,
        dz = village.cz - z;
      if (dx * dx + dz * dz > radius * radius) continue;
      out.push(village);
    }
  }
  return out;
}
