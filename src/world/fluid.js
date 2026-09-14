// Écoulement des liquides (Phase 16.3) : automate cellulaire sur une FILE ACTIVE,
// jamais un balayage du monde entier — seules les cellules dont on sait qu'elles
// viennent de changer (un bloc cassé à côté d'un liquide) sont réévaluées. PURE :
// `getBlock` est injecté (retourne un nom de bloc, `null` pour de l'air connue,
// `undefined` pour un chunk non chargé — mêmes conventions que world/world.js).
//
// Simplification assumée (pas de 8 niveaux façon Minecraft, cf. PLAN.md Phase 16) :
// un liquide est une cellule pleine ou vide, pas un niveau 1-8. La portée horizontale
// est donc plafonnée par une DISTANCE parcourue depuis la source (`MAX_SPREAD_DISTANCE`)
// plutôt que par un niveau qui décroît — même effet (empêche un lac de tout inonder à
// l'infini), calcul plus simple, mais pas de rivage qui s'amincit visuellement.

export const MAX_SPREAD_DISTANCE = 4;

const NEIGHBORS_H = [
  [1, 0, 0],
  [-1, 0, 0],
  [0, 0, 1],
  [0, 0, -1],
];

// avance d'un pas jusqu'à `budget` cellules de `queue` (les plus anciennes en
// premier). Retourne { spread, remaining } : `spread` = nouvelles cellules à
// transformer en liquide MAINTENANT (à écrire côté appelant, qui sait persister),
// `remaining` = ce qu'il reste dans la queue après ce budget (pas encore traité).
export function stepFluidQueue(queue, budget, getBlock) {
  const spread = [];
  const processed = queue.slice(0, budget);
  const remaining = queue.slice(budget);

  for (const cell of processed) {
    const { x, y, z, type, dist } = cell;
    const below = getBlock(x, y - 1, z);
    if (below === null) {
      // l'air en dessous prime toujours sur les côtés : un liquide tombe avant de
      // s'étaler, une chute ne consomme pas de distance (sinon un puits profond
      // assècherait la source avant même d'atteindre le fond)
      spread.push({ x, y: y - 1, z, type, dist });
      continue;
    }
    if (dist >= MAX_SPREAD_DISTANCE) continue; // portée épuisée sur cette branche
    for (const [dx, dy, dz] of NEIGHBORS_H) {
      const nx = x + dx,
        ny = y + dy,
        nz = z + dz;
      if (getBlock(nx, ny, nz) === null) spread.push({ x: nx, y: ny, z: nz, type, dist: dist + 1 });
    }
  }

  return { spread, remaining };
}
