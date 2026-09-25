// Contrôle de place au spawn (Phase 38) : PUR (aucun import hors data/mobs.js, qui est
// elle-même pure donnée) -- testable sous `node --test` sans tirer three.js/canvas, cf.
// test/mob-spawn.test.js. Même séparation que world/physics.js ou entities/boat-physics.js :
// la règle d'un côté, entities/mob.js (rendu, three.js) de l'autre.

import { MOBS } from '../data/mobs.js';

// Vrai si un mob du TYPE donné tiendrait en (x, groundY, z) sans mordre sur un bloc solide.
// `collidesAtBox` : la même fonction que la physique du mob une fois posé (cf.
// entities/entity.js), avec le radius/height EXACT du type -- fiable même pour les mobs
// hauts de ~2 blocs (zombie, villageois), qu'un simple coup d'œil au bloc juste au-dessus
// du sol laisserait passer la tête dans un plafond bas. Sans ce contrôle, un mob peut
// apparaître coincé dans un bloc : immobile, sans échappatoire, donc trivial à tuer --
// ce qui n'a rien à voir avec un spawn normal.
export function hasSpawnRoom(collidesAtBox, x, groundY, z, type) {
  const { radius, height } = MOBS[type].hitbox;
  return !collidesAtBox(x, groundY, z, radius, height);
}
