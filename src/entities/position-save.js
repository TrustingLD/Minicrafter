// Sauvegarde de la position (Phase 42) : PUR (aucun import, aucun accès à localStorage) --
// même séparation que entities/inventory-save.js (voir ce fichier pour le détail du choix).
// Couvre position (x,y,z), orientation (yaw/pitch -- sans ça, réapparaître au bon endroit
// mais face à un mur au hasard resterait à moitié restauré) et dimension ('overworld' ou
// 'nether' -- cf. world/world.js, deux mondes distincts).

export const POSITION_STORAGE_KEY = 'minicrafter_position_v1';

export function serializePosition(x, y, z, yaw, pitch, dimension) {
  return JSON.stringify({
    v: 1,
    x,
    y,
    z,
    yaw,
    pitch,
    dimension: dimension === 'nether' ? 'nether' : 'overworld',
  });
}

// Reconstruit { x, y, z, yaw, pitch, dimension }, ou `null` si `json` est vide/corrompu/
// d'une forme inattendue -- l'appelant garde alors le point d'apparition par défaut
// (spawnPoint()), comme pour une toute première partie.
export function deserializePosition(json) {
  if (!json) return null;
  let data;
  try {
    data = JSON.parse(json);
  } catch {
    return null;
  }
  if (!data || typeof data !== 'object') return null;
  const { x, y, z, yaw, pitch } = data;
  if (![x, y, z, yaw, pitch].every(Number.isFinite)) return null;
  return { x, y, z, yaw, pitch, dimension: data.dimension === 'nether' ? 'nether' : 'overworld' };
}
