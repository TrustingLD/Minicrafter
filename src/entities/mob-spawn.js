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

// Rayon (en blocs, au carré) au-delà duquel un mob n'est plus simulé du tout (Phase 43 :
// dépend maintenant de la distance de rendu, réglable dans Options, plutôt que d'une
// constante fixe). Doit rester STRICTEMENT inférieur au rayon de chunks chargés
// (renderDistance * CHUNK_X, cf. world/chunk.js), sans quoi un mob simulé hors zone
// chargée ne verrait que des blocs "inconnus" et n'aurait de toute façon aucune collision
// utile -- d'où le `- 16` de marge. Ne dépasse jamais `defaultRadius` (56 blocs par
// défaut, cf. entities/mob.js) même à très grande distance de rendu : au-delà, plus de
// mobs actifs à la fois ne ferait qu'aggraver la chute de FPS déjà attendue, sans rien
// apporter (un mob à 200 blocs ne se voit pas).
export function mobActiveRadiusSqFor(renderDistance, chunkSize, defaultRadius) {
  return Math.min(defaultRadius, renderDistance * chunkSize - 16) ** 2;
}
