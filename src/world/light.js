// Lumière de bloc (Phase 13) : BFS sur le lightmap d'un chunk. PURE — seul import
// autorisé, la géométrie du chunk (chunk.js, elle-même pure). `isOpaque(blockId)`
// est injecté plutôt qu'importé de data/blocks.js : ça garde ce fichier testable
// avec un faux "un bloc non nul bloque la lumière" sans dépendre du vrai registre.
//
// v1 assumé (documenté dans PLAN.md §Phase 13) : le BFS s'arrête aux bords du chunk,
// comme le mesher traite déjà les voisins hors-chunk comme de l'air (render/mesher.js).
// La "couture" de lumière entre deux chunks est visible et volontaire — le tremplin
// vers une v2 qui re-propage dans les chunks voisins, pas un bug à corriger ici.

import { CHUNK_X, CHUNK_Y, CHUNK_Z, idx, inBounds } from './chunk.js';

const NEIGHBORS = [
  [1, 0, 0],
  [-1, 0, 0],
  [0, 1, 0],
  [0, -1, 0],
  [0, 0, 1],
  [0, 0, -1],
];

function coordsOf(i) {
  const lx = i % CHUNK_X;
  const rest = (i - lx) / CHUNK_X;
  const lz = rest % CHUNK_Z;
  const ly = (rest - lz) / CHUNK_Z;
  return [lx, ly, lz];
}

// coeur du BFS, partagé par propagate() et propagateSkylight() : `queue` contient
// déjà les index sources, dont `lightData` porte le niveau.
function spread(chunkData, lightData, queue, isOpaque) {
  let head = 0;
  while (head < queue.length) {
    const i = queue[head++];
    const level = lightData[i];
    if (level <= 1) continue; // rien à propager plus loin qu'un niveau 0
    const [x, y, z] = coordsOf(i);
    for (const [dx, dy, dz] of NEIGHBORS) {
      const nx = x + dx,
        ny = y + dy,
        nz = z + dz;
      if (!inBounds(nx, ny, nz)) continue;
      const ni = idx(nx, ny, nz);
      if (isOpaque(chunkData[ni])) continue;
      const nextLevel = level - 1;
      if (nextLevel > lightData[ni]) {
        lightData[ni] = nextLevel;
        queue.push(ni);
      }
    }
  }
}

// étale `sources` ({x,y,z,level}) dans `lightData` (Uint8Array(CHUNK_VOLUME), une
// valeur 0-15 par bloc) par BFS, -1 par bloc traversé, bloqué par isOpaque(blockId).
export function propagate(chunkData, lightData, sources, isOpaque) {
  const queue = [];
  for (const s of sources) {
    if (!inBounds(s.x, s.y, s.z)) continue;
    const i = idx(s.x, s.y, s.z);
    // >= et pas > : removeLight() ré-ensemence depuis une cellule dont la valeur
    // stockée est déjà correcte (elle n'a jamais été éteinte) juste pour relancer
    // le BFS vers ses voisins fraîchement éteints. Avec un ">" strict, ce
    // "resparkle" serait silencieusement ignoré puisque le niveau n'augmente pas.
    if (s.level >= lightData[i]) {
      lightData[i] = s.level;
      queue.push(i);
    }
  }
  spread(chunkData, lightData, queue, isOpaque);
}

// Diffusion latérale du ciel. computeSkylightColumn ne descend qu'EN COLONNE : dès
// qu'une feuille bouche la verticale, tout ce qui est dessous restait à 0, soit
// MIN_LIGHT_FACTOR (6 % de luminosité) dans le mesher — d'où l'ombre quasi noire
// sous chaque arbre, alors que le bloc d'à côté, à un mètre, était en plein soleil.
// On rejoue donc un BFS depuis toutes les cellules déjà éclairées par le ciel : une
// case sous le feuillage reçoit 15 moins sa distance à la lumière du jour la plus
// proche, ce qui donne un dégradé au lieu d'une falaise.
//
// À appeler APRÈS computeSkylightColumn sur toutes les colonnes du chunk (les 15
// verticaux sont les sources). Comme le reste de la v1, ça s'arrête aux bords du
// chunk (cf. l'entête du fichier).
export function propagateSkylight(chunkData, lightData, isOpaque) {
  const queue = [];
  for (let i = 0; i < lightData.length; i++) if (lightData[i] === 15) queue.push(i);
  spread(chunkData, lightData, queue, isOpaque);
}

// Version d'UNE colonne, pour setBlock. Balayer les 16384 cellules du chunk à chaque
// bloc posé/cassé coûtait ~1,2 ms même quand rien ne changeait — et l'écoulement des
// liquides appelle setBlock jusqu'à 48 fois par tic, soit ~58 ms de gel. En ne
// réensemençant que la colonne modifiée, le BFS s'arrête de lui-même dès qu'il
// n'éclaire plus rien de nouveau (`spread` ne pousse que s'il AUGMENTE une valeur),
// donc le coût suit l'ampleur réelle du changement.
//
// Additif seulement : rouvrir le ciel rallume, mais reboucher un trou n'éteint pas le
// rayon déjà posé — exactement la même « couture » que la v1 assume déjà pour les
// torches (cf. le commentaire de setBlock dans world/world.js), résorbée au prochain
// rechargement du chunk.
export function propagateSkylightColumn(chunkData, lightData, lx, lz, isOpaque) {
  const queue = [];
  for (let ly = 0; ly < CHUNK_Y; ly++) {
    const i = idx(lx, ly, lz);
    if (lightData[i] === 15) queue.push(i);
  }
  spread(chunkData, lightData, queue, isOpaque);
}

// Le "harder half" du plan : éteindre une source ne peut pas juste écrire 0 dessus,
// il faut éteindre tout ce qui ne tenait SA lumière QUE d'elle, puis re-propager
// depuis les cellules encore éclairées par une autre source trouvées à la frontière
// de la zone éteinte (le "resparkle").
export function removeLight(chunkData, lightData, x, y, z, isOpaque) {
  if (!inBounds(x, y, z)) return;
  const startLevel = lightData[idx(x, y, z)];
  lightData[idx(x, y, z)] = 0;
  if (startLevel === 0) return;

  const queue = [{ i: idx(x, y, z), level: startLevel }];
  const resparkle = [];
  let head = 0;
  while (head < queue.length) {
    const { i, level } = queue[head++];
    const [cx, cy, cz] = coordsOf(i);
    for (const [dx, dy, dz] of NEIGHBORS) {
      const nx = cx + dx,
        ny = cy + dy,
        nz = cz + dz;
      if (!inBounds(nx, ny, nz)) continue;
      const ni = idx(nx, ny, nz);
      const nLevel = lightData[ni];
      if (nLevel === 0) continue;
      if (nLevel < level) {
        // ce voisin ne tenait sa lumière QUE de la source qu'on efface -> l'éteindre aussi
        lightData[ni] = 0;
        queue.push({ i: ni, level: nLevel });
      } else {
        // alimenté par une lumière au moins aussi forte venant d'ailleurs -> à
        // re-propager depuis là une fois l'extinction terminée
        resparkle.push({ x: nx, y: ny, z: nz, level: nLevel });
      }
    }
  }
  propagate(chunkData, lightData, resparkle, isOpaque);
}

// v1 du ciel (Phase 13) : toute colonne à l'air libre reçoit 15 jusqu'au sol —
// pas de BFS, un simple balayage top-down par colonne (le générateur connaît déjà
// la hauteur de terrain, donc c'est ~gratuit à calculer pendant la génération).
export function computeSkylightColumn(chunkData, lightData, lx, lz, isOpaque) {
  let sky = true;
  for (let ly = CHUNK_Y - 1; ly >= 0; ly--) {
    const i = idx(lx, ly, lz);
    if (sky && isOpaque(chunkData[i])) sky = false;
    if (sky) lightData[i] = 15;
  }
}
