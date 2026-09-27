// Distance de fog en fonction de la distance de rendu (Phase 43, Options -> Distance de
// rendu, 2 à 32 chunks). PUR (aucun import) : testable sous `node --test` sans DOM/three.js,
// même séparation que entities/boat-physics.js ou entities/mob-spawn.js.
//
// Le ratio est calé pour retomber EXACTEMENT sur les anciennes valeurs fixes (near=25,
// far=70) à la distance de rendu par défaut (6 chunks, cf. main.js avant ce réglage), et
// rester à la même proportion du rayon de chunks chargés (renderDistance*16 blocs) à toute
// autre valeur -- assez pour cacher l'apparition des chunks à la limite (~73 % du rayon
// chargé), quelle que soit la distance choisie.
export function fogNearFor(renderDistance) {
  return (25 / 6) * renderDistance;
}

export function fogFarFor(renderDistance) {
  return (70 / 6) * renderDistance;
}
