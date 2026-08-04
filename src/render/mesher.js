// Chunk mesher (Phase 5) : Uint8Array de voxels -> un unique jeu de tableaux
// typés (positions/normales/uv/indices) prêt à devenir UN SEUL BufferGeometry.
// PURE-ish : pas d'import THREE (juste des tableaux), donc testable sans navigateur —
// on peut lui donner un petit tableau 3x3x3 et compter les faces produites.
//
// Simplification assumée (documentée dans PLAN.md §Phase 4a) : les voisins hors du
// chunk sont traités comme de l'air, donc les faces en bordure de chunk sont TOUJOURS
// dessinées (pas de fuite de données entre chunks). Léger surcoût de triangles aux
// coutures, mais aucun risque de trou/incohérence entre deux chunks voisins.

import { CHUNK_X, CHUNK_Y, CHUNK_Z, idx } from '../world/chunk.js';

const EMPTY_SET = new Set();
const EMPTY_OBJECT = {};

// [normale, verts relatifs au coin (x,y,z) du bloc, dans l'ordre qui donne un
// enroulement CCW vu de l'extérieur (donc la normale calculée par produit vectoriel
// correspond bien à la face) ]
const FACES = [
  {
    n: [1, 0, 0],
    v: [
      [1, 0, 0],
      [1, 1, 0],
      [1, 1, 1],
      [1, 0, 1],
    ],
  },
  {
    n: [-1, 0, 0],
    v: [
      [0, 0, 1],
      [0, 1, 1],
      [0, 1, 0],
      [0, 0, 0],
    ],
  },
  {
    n: [0, 1, 0],
    v: [
      [0, 1, 1],
      [1, 1, 1],
      [1, 1, 0],
      [0, 1, 0],
    ],
  },
  {
    n: [0, -1, 0],
    v: [
      [0, 0, 0],
      [1, 0, 0],
      [1, 0, 1],
      [0, 0, 1],
    ],
  },
  {
    n: [0, 0, 1],
    v: [
      [1, 0, 1],
      [1, 1, 1],
      [0, 1, 1],
      [0, 0, 1],
    ],
  },
  {
    n: [0, 0, -1],
    v: [
      [0, 0, 0],
      [0, 1, 0],
      [1, 1, 0],
      [1, 0, 0],
    ],
  },
];
function faceSlot(nx, ny) {
  if (ny === 1) return 'top';
  if (ny === -1) return 'bottom';
  return 'side';
}

// niveau de lumière (0-15, cf. world/light.js) -> facteur RGB multiplié sur la
// texture. Plancher à 0.06 plutôt que 0 : à lumière nulle un sommet à (0,0,0) donne
// un noir total qui plaque la face en silhouette pure, illisible ; un vrai voxel game
// garde un minimum de "gris" visible même dans le noir complet (cf. PLAN.md Phase 13).
// Remonté à 0.14 (retour utilisateur) : un tunnel miné en ligne droite sans torche
// tombe légitimement à 0 au bout d'une quinzaine de blocs (la lumière décroît de 1
// par bloc depuis la source la plus proche, cf. world/light.js) -- ce N'EST PAS un
// bug, les torches restent nécessaires pour vraiment voir. Mais à 0.06 le tunnel
// devenait totalement illisible (silhouette plate, aucun relief) plutôt que "sombre
// et sans repère" ; 0.14 garde ce sentiment tout en laissant deviner les parois.
const MIN_LIGHT_FACTOR = 0.14;
function lightFactor(level) {
  return MIN_LIGHT_FACTOR + (1 - MIN_LIGHT_FACTOR) * (level / 15);
}

// data: Uint8Array(CHUNK_X*CHUNK_Y*CHUNK_Z), uvByBlockId: voir render/atlas.js,
// lightData: Uint8Array(CHUNK_X*CHUNK_Y*CHUNK_Z) optionnel (Phase 13) — un niveau
// 0-15 par bloc ; omis (ou absent) = plein jour partout (comportement d'avant Phase 13).
// liquidIds: Set<blockId> optionnel (Phase 16) — l'eau/la lave ne sont PAS des blocs
// opaques : elles ne sont jamais rendues ici (cf. meshLiquid plus bas, une passe à
// part avec son propre matériau transparent/animé), et elles ne bloquent pas non
// plus les faces des blocs opaques voisins (un mur de terre à côté d'un lac doit
// quand même dessiner sa face — avant Phase 16, l'eau était hors du chunk `data`
// donc ce problème n'existait pas DANS le mesher, mais se manifestait comme "aucune
// face nulle part" côté rendu séparé ; maintenant que l'eau est un vrai bloc, il faut
// explicitement l'exclure du test d'opacité).
//
// Fix perf : l'ancienne version poussait dans des Array JS dynamiques (positions.push(...))
// puis les convertissait en Float32Array/Uint16Array à la fin — chaque push peut déclencher
// un redimensionnement interne, et la conversion finale recopie tout une seconde fois.
// Pour un chunk avec beaucoup de faces visibles (relief accidenté, grottes = beaucoup de
// surfaces exposées), ça fait beaucoup d'allocations/copies pour rien. On fait donc deux
// passes : la 1ère ne fait QUE compter les faces visibles (aucune allocation), la 2e
// remplit directement des tableaux typés déjà dimensionnés à la bonne taille.
export function meshChunk(data, uvByBlockId, lightData, liquidIds, shapeById) {
  const liquids = liquidIds || EMPTY_SET;
  const shapes = shapeById || EMPTY_OBJECT;
  function get(x, y, z) {
    if (x < 0 || x >= CHUNK_X || y < 0 || y >= CHUNK_Y || z < 0 || z >= CHUNK_Z) return 0;
    return data[idx(x, y, z)];
  }
  // opaque = un bloc plein qui n'est PAS un liquide (l'air ne l'est pas non plus, id 0)
  // ni une forme réduite : une torche est un bâtonnet fin, elle ne remplit pas sa
  // cellule, donc elle ne peut pas masquer la face du bloc d'à côté.
  function isOpaque(x, y, z) {
    const id = get(x, y, z);
    return id !== 0 && !liquids.has(id) && !shapes[id];
  }
  // lumière du voisin exposé (celui qui a fait accepter la face) : hors-chunk ou pas
  // de lightData fourni -> plein jour (15), même simplification que `get()` pour les
  // voisins hors-chunk (cf. commentaire en tête de fichier).
  function getLight(x, y, z) {
    if (!lightData) return 15;
    if (x < 0 || x >= CHUNK_X || y < 0 || y >= CHUNK_Y || z < 0 || z >= CHUNK_Z) return 15;
    return lightData[idx(x, y, z)];
  }

  // hauteur du plus haut bloc non-vide du chunk : au-dessus, tout est de l'air, il est
  // inutile de balayer les tranches. Un chunk de plaine n'utilise que ~15 des 64 niveaux.
  let maxY = -1;
  for (let i = data.length - 1; i >= 0; i--) {
    if (data[i]) {
      maxY = Math.floor(i / (CHUNK_X * CHUNK_Z));
      break;
    }
  }
  if (maxY < 0) {
    // chunk entièrement vide (ne devrait pas arriver, mais évite d'allouer pour rien)
    return {
      positions: new Float32Array(0),
      normals: new Float32Array(0),
      uvs: new Float32Array(0),
      colors: new Float32Array(0),
      indices: new Uint16Array(0),
    };
  }
  const yLimit = Math.min(CHUNK_Y - 1, maxY + 1); // +1 : les faces du dessus du bloc le plus haut

  // passe 1 : compter
  let faceCount = 0;
  for (let x = 0; x < CHUNK_X; x++) {
    for (let y = 0; y <= yLimit; y++) {
      for (let z = 0; z < CHUNK_Z; z++) {
        const id = get(x, y, z);
        if (!id || liquids.has(id)) continue; // les liquides sont rendus par meshLiquid()
        // forme réduite : la boîte est plus petite que la cellule, donc AUCUNE de ses
        // faces ne peut être cachée par un voisin — les 6 comptent toujours.
        if (shapes[id]) {
          faceCount += 6;
          continue;
        }
        for (const face of FACES) {
          const [nx, ny, nz] = face.n;
          if (!isOpaque(x + nx, y + ny, z + nz)) faceCount++;
        }
      }
    }
  }

  const vertCountTotal = faceCount * 4;
  const positions = new Float32Array(vertCountTotal * 3);
  const normals = new Float32Array(vertCountTotal * 3);
  const uvs = new Float32Array(vertCountTotal * 2);
  const colors = new Float32Array(vertCountTotal * 3);
  const indices =
    vertCountTotal > 65535 ? new Uint32Array(faceCount * 6) : new Uint16Array(faceCount * 6);

  // passe 2 : remplir
  let vertCount = 0;
  let pOff = 0,
    nOff = 0,
    uOff = 0,
    cOff = 0,
    iOff = 0;
  for (let x = 0; x < CHUNK_X; x++) {
    for (let y = 0; y <= yLimit; y++) {
      for (let z = 0; z < CHUNK_Z; z++) {
        const id = get(x, y, z);
        if (!id || liquids.has(id)) continue;
        const uv = uvByBlockId[id];
        const shape = shapes[id];
        for (const face of FACES) {
          const [nx, ny, nz] = face.n;
          if (!shape && isOpaque(x + nx, y + ny, z + nz)) continue; // face cachée
          const rect = uv[faceSlot(nx, ny)];
          const base = vertCount;
          // lumière plate par face (pas de lissage entre coins) : le niveau de la
          // cellule voisine exposée, celle-là même qui a fait accepter la face.
          // Pour une forme réduite, la cellule voisine peut être de la pierre pleine
          // (niveau 0) alors que la torche est posée CONTRE ce mur : on prend donc sa
          // propre cellule, qui porte la lumière qu'elle émet.
          const factor = lightFactor(shape ? getLight(x, y, z) : getLight(x + nx, y + ny, z + nz));
          for (const corner of face.v) {
            // `corner` reste le coin du cube unité (0..1) pour les UV plus bas ; seule
            // la POSITION est ramenée aux dimensions de la boîte, centrée en x/z et
            // posée sur le sol de la cellule.
            if (shape) {
              positions[pOff++] = x + 0.5 + (corner[0] - 0.5) * shape.width;
              positions[pOff++] = y + corner[1] * shape.height;
              positions[pOff++] = z + 0.5 + (corner[2] - 0.5) * shape.width;
            } else {
              positions[pOff++] = x + corner[0];
              positions[pOff++] = y + corner[1];
              positions[pOff++] = z + corner[2];
            }
            normals[nOff++] = nx;
            normals[nOff++] = ny;
            normals[nOff++] = nz;
            colors[cOff++] = factor;
            colors[cOff++] = factor;
            colors[cOff++] = factor;
            // UV par sommet dérivé de sa position dans le bloc (pas d'une table fixe
            // indexée par i) : pour une face verticale, l'axe texture V DOIT suivre
            // l'axe monde Y, sinon la bande herbe/terre de grassSide s'aligne sur X/Z
            // au lieu du haut du bloc — bug "herbe en diagonale" vu de profil. v=0 de
            // l'atlas = haut du canvas = herbe (flipY=false, cf. atlas.js), donc
            // y=1 (haut du bloc) -> t=0, y=0 (bas) -> t=1.
            let s, t;
            if (ny !== 0) {
              s = corner[0];
              t = corner[2];
            } else {
              t = 1 - corner[1];
              s = nx !== 0 ? corner[2] : corner[0];
            }
            uvs[uOff++] = rect[0] + s * (rect[2] - rect[0]);
            uvs[uOff++] = rect[1] + t * (rect[3] - rect[1]);
          }
          indices[iOff++] = base;
          indices[iOff++] = base + 1;
          indices[iOff++] = base + 2;
          indices[iOff++] = base;
          indices[iOff++] = base + 2;
          indices[iOff++] = base + 3;
          vertCount += 4;
        }
      }
    }
  }

  return { positions, normals, uvs, colors, indices };
}

// Passe liquide séparée (Phase 16) : UV 0..1 par face, pas d'atlas -- ces blocs
// utilisent leur propre texture (RepeatWrapping + offset animé dans world/world.js),
// pas le canvas partagé grass/dirt/stone/etc. `targetId` : quel liquide on mesh
// (eau et lave sont deux geometries/matériaux séparés, un chunk peut avoir les deux).
// Face émise seulement si le voisin est de l'air ou un AUTRE liquide -- jamais contre
// un bloc opaque (inutile, il dessine déjà sa propre face côté meshChunk, cf. plus
// haut) ni contre le MÊME liquide (deux cellules d'eau collées n'ont rien à se montrer).
export function meshLiquid(data, targetId, liquidIds, lightData) {
  function get(x, y, z) {
    if (x < 0 || x >= CHUNK_X || y < 0 || y >= CHUNK_Y || z < 0 || z >= CHUNK_Z) return 0;
    return data[idx(x, y, z)];
  }
  function shouldDraw(id) {
    return id === 0 || (liquidIds.has(id) && id !== targetId);
  }
  function getLight(x, y, z) {
    if (!lightData) return 15;
    if (x < 0 || x >= CHUNK_X || y < 0 || y >= CHUNK_Y || z < 0 || z >= CHUNK_Z) return 15;
    return lightData[idx(x, y, z)];
  }

  let faceCount = 0;
  for (let x = 0; x < CHUNK_X; x++)
    for (let y = 0; y < CHUNK_Y; y++)
      for (let z = 0; z < CHUNK_Z; z++) {
        if (get(x, y, z) !== targetId) continue;
        for (const face of FACES) {
          const [nx, ny, nz] = face.n;
          if (shouldDraw(get(x + nx, y + ny, z + nz))) faceCount++;
        }
      }

  const vertCountTotal = faceCount * 4;
  const positions = new Float32Array(vertCountTotal * 3);
  const normals = new Float32Array(vertCountTotal * 3);
  const uvs = new Float32Array(vertCountTotal * 2);
  const colors = new Float32Array(vertCountTotal * 3);
  const indices =
    vertCountTotal > 65535 ? new Uint32Array(faceCount * 6) : new Uint16Array(faceCount * 6);

  let vertCount = 0;
  let pOff = 0,
    nOff = 0,
    uOff = 0,
    cOff = 0,
    iOff = 0;
  for (let x = 0; x < CHUNK_X; x++) {
    for (let y = 0; y < CHUNK_Y; y++) {
      for (let z = 0; z < CHUNK_Z; z++) {
        if (get(x, y, z) !== targetId) continue;
        for (const face of FACES) {
          const [nx, ny, nz] = face.n;
          if (!shouldDraw(get(x + nx, y + ny, z + nz))) continue;
          const base = vertCount;
          const factor = lightFactor(getLight(x + nx, y + ny, z + nz));
          for (const corner of face.v) {
            // surface légèrement enfoncée (0.875 au lieu de 1) -- lisible comme un
            // niveau d'eau, pas un cube plein à ras bord (cf. PLAN.md Phase 16.2)
            const cy = corner[1] === 1 ? 0.875 : corner[1];
            positions[pOff++] = x + corner[0];
            positions[pOff++] = y + cy;
            positions[pOff++] = z + corner[2];
            normals[nOff++] = nx;
            normals[nOff++] = ny;
            normals[nOff++] = nz;
            colors[cOff++] = factor;
            colors[cOff++] = factor;
            colors[cOff++] = factor;
            let s, t;
            if (ny !== 0) {
              s = corner[0];
              t = corner[2];
            } else {
              t = 1 - corner[1];
              s = nx !== 0 ? corner[2] : corner[0];
            }
            uvs[uOff++] = s;
            uvs[uOff++] = t;
          }
          indices[iOff++] = base;
          indices[iOff++] = base + 1;
          indices[iOff++] = base + 2;
          indices[iOff++] = base;
          indices[iOff++] = base + 2;
          indices[iOff++] = base + 3;
          vertCount += 4;
        }
      }
    }
  }

  return { positions, normals, uvs, colors, indices };
}
