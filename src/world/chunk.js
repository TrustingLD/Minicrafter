// Structure de données d'un chunk : un Uint8Array plat (1 octet/bloc) plutôt que
// l'ancien `world = {}` (une entrée d'objet JS + clé string par bloc, ~100 octets/bloc).
// PURE — aucun import, testable sans navigateur. Voir PLAN.md Phase 4a.

export const CHUNK_X = 16;
export const CHUNK_Y = 64; // couvre les montagnes (max ~58) + un peu de marge
export const CHUNK_Z = 16;
export const CHUNK_VOLUME = CHUNK_X * CHUNK_Y * CHUNK_Z;

// index plat d'un bloc DANS un chunk, à partir de coordonnées locales [0, CHUNK_*)
export function idx(lx, ly, lz) {
  return (ly * CHUNK_Z + lz) * CHUNK_X + lx;
}

export function createChunkData() {
  return new Uint8Array(CHUNK_VOLUME);
}

export function inBounds(lx, ly, lz) {
  return lx >= 0 && lx < CHUNK_X && ly >= 0 && ly < CHUNK_Y && lz >= 0 && lz < CHUNK_Z;
}

export function chunkKey(cx, cz) {
  return cx + ',' + cz;
}

// coordonnées monde -> coordonnées du chunk qui le contient
export function worldToChunk(x, z) {
  return [Math.floor(x / CHUNK_X), Math.floor(z / CHUNK_Z)];
}

// coordonnées monde -> coordonnées locales À L'INTÉRIEUR de son chunk (toujours positives)
export function worldToLocal(x, z) {
  const lx = ((x % CHUNK_X) + CHUNK_X) % CHUNK_X;
  const lz = ((z % CHUNK_Z) + CHUNK_Z) % CHUNK_Z;
  return [lx, lz];
}
