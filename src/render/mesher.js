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
const FACE_UV = [
  [0, 0],
  [1, 0],
  [1, 1],
  [0, 1],
];

function faceSlot(nx, ny) {
  if (ny === 1) return 'top';
  if (ny === -1) return 'bottom';
  return 'side';
}

// data: Uint8Array(CHUNK_X*CHUNK_Y*CHUNK_Z), uvByBlockId: voir render/atlas.js
export function meshChunk(data, uvByBlockId) {
  const positions = [];
  const normals = [];
  const uvs = [];
  const indices = [];
  let vertCount = 0;

  function get(x, y, z) {
    if (x < 0 || x >= CHUNK_X || y < 0 || y >= CHUNK_Y || z < 0 || z >= CHUNK_Z) return 0;
    return data[idx(x, y, z)];
  }

  for (let x = 0; x < CHUNK_X; x++) {
    for (let y = 0; y < CHUNK_Y; y++) {
      for (let z = 0; z < CHUNK_Z; z++) {
        const id = get(x, y, z);
        if (!id) continue;
        const uv = uvByBlockId[id];
        for (const face of FACES) {
          const [nx, ny, nz] = face.n;
          if (get(x + nx, y + ny, z + nz)) continue; // face cachée
          const rect = uv[faceSlot(nx, ny)];
          const base = vertCount;
          face.v.forEach((corner, i) => {
            positions.push(x + corner[0], y + corner[1], z + corner[2]);
            normals.push(nx, ny, nz);
            const [s, t] = FACE_UV[i];
            uvs.push(rect[0] + s * (rect[2] - rect[0]), rect[1] + t * (rect[3] - rect[1]));
          });
          indices.push(base, base + 1, base + 2, base, base + 2, base + 3);
          vertCount += 4;
        }
      }
    }
  }

  return {
    positions: new Float32Array(positions),
    normals: new Float32Array(normals),
    uvs: new Float32Array(uvs),
    indices: vertCount > 65535 ? new Uint32Array(indices) : new Uint16Array(indices),
  };
}
