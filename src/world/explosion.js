// Règles d'explosion (Phase 44, Rampant) : PUR (aucun import), testable sous `node --test`
// sans three.js/DOM -- même séparation que entities/boat-physics.js ou entities/mob-spawn.js.
// main.js (ctx.explode, appelé par entities/mob.js : Mob.explode()) s'occupe de tout le
// reste (itérer la sphère de blocs, le hasard du bord du cratère, les particules, le son,
// la destruction/les dégâts eux-mêmes) ; ici il n'y a que la DÉCISION.

// Vrai si le bloc `type` résiste à l'explosion : incassable (bedrock, eau, lave --
// `hardness: Infinity`, cf. data/blocks.js) ou structure multi-blocs (lit, porte, piston)
// qu'on préfère laisser intacte plutôt que de risquer un état à moitié détruit (ex. un
// pied de lit sans sa tête). `blockDef` : l'entrée BLOCK_TYPES[type], ou `undefined`/`null`
// pour un bloc inconnu (air compris) -- épargné aussi, il n'y a rien à détruire.
export function explosionSpares(type, blockDef) {
  if (!blockDef || blockDef.hardness === Infinity) return true;
  return type.startsWith('bed_') || type.startsWith('door_') || type.startsWith('piston_');
}

// Dégâts au joueur à `dist` blocs du centre de l'explosion : dégressifs, nuls à `radius`
// et au-delà, `maxDamage` à bout portant (dist = 0). Arrondi au supérieur comme le reste
// des dégâts du jeu (cf. damagePlayer, main.js) -- jamais 0 dégâts tant qu'on est dans le
// rayon, même très près du bord.
export function explosionDamageAt(dist, radius, maxDamage) {
  if (dist >= radius) return 0;
  return Math.ceil(maxDamage * (1 - dist / radius));
}
