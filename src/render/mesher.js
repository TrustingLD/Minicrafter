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

// data: Uint8Array(CHUNK_X*CHUNK_Y*CHUNK_Z), uvByBlockId: voir render/atlas.js
//
// Fix perf : l'ancienne version poussait dans des Array JS dynamiques (positions.push(...))
// puis les convertissait en Float32Array/Uint16Array à la fin — chaque push peut déclencher
// un redimensionnement interne, et la conversion finale recopie tout une seconde fois.
// Pour un chunk avec beaucoup de faces visibles (relief accidenté, grottes = beaucoup de
// surfaces exposées), ça fait beaucoup d'allocations/copies pour rien. On fait donc deux
// passes : la 1ère ne fait QUE compter les faces visibles (aucune allocation), la 2e
// remplit directement des tableaux typés déjà dimensionnés à la bonne taille.
export function meshChunk(data, uvByBlockId) {
  function get(x, y, z) {
    if (x < 0 || x >= CHUNK_X || y < 0 || y >= CHUNK_Y || z < 0 || z >= CHUNK_Z) return 0;
    return data[idx(x, y, z)];
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
      indices: new Uint16Array(0),
    };
  }
  const yLimit = Math.min(CHUNK_Y - 1, maxY + 1); // +1 : les faces du dessus du bloc le plus haut

  // passe 1 : compter
  let faceCount = 0;
  for (let x = 0; x < CHUNK_X; x++) {
    for (let y = 0; y <= yLimit; y++) {
      for (let z = 0; z < CHUNK_Z; z++) {
        if (!get(x, y, z)) continue;
        for (const face of FACES) {
          const [nx, ny, nz] = face.n;
          if (!get(x + nx, y + ny, z + nz)) faceCount++;
        }
      }
    }
  }

  const vertCountTotal = faceCount * 4;
  const positions = new Float32Array(vertCountTotal * 3);
  const normals = new Float32Array(vertCountTotal * 3);
  const uvs = new Float32Array(vertCountTotal * 2);
  const indices =
    vertCountTotal > 65535 ? new Uint32Array(faceCount * 6) : new Uint16Array(faceCount * 6);

  // passe 2 : remplir
  let vertCount = 0;
  let pOff = 0,
    nOff = 0,
    uOff = 0,
    iOff = 0;
  for (let x = 0; x < CHUNK_X; x++) {
    for (let y = 0; y <= yLimit; y++) {
      for (let z = 0; z < CHUNK_Z; z++) {
        const id = get(x, y, z);
        if (!id) continue;
        const uv = uvByBlockId[id];
        for (const face of FACES) {
          const [nx, ny, nz] = face.n;
          if (get(x + nx, y + ny, z + nz)) continue; // face cachée
          const rect = uv[faceSlot(nx, ny)];
          const base = vertCount;
          for (const corner of face.v) {
            positions[pOff++] = x + corner[0];
            positions[pOff++] = y + corner[1];
            positions[pOff++] = z + corner[2];
            normals[nOff++] = nx;
            normals[nOff++] = ny;
            normals[nOff++] = nz;
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

  return { positions, normals, uvs, indices };
}
