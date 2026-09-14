// Registre des mobs. Pure donnée : aucun import. Ajouter un mob = ajouter une
// entrée ici (stats + modèle en boîtes) — plus besoin de toucher entities/mob.js.
//
// model.parts[i] : { size:[w,h,d], at:[x,y,z], tex, faceTex?, face? }
//   - tex : texture uniforme sur les 6 faces
//   - faceTex + face ('+x'|'-x'|'+y'|'-y'|'+z'|'-z', défaut '+z') : remplace UNE face
//     (utilisé pour mettre un visage sur la tête sans le répéter partout)
// model.limbs[i] : { group:'legs'|'arms', count, size:[w,h,d], jointY, positions:[[x,z],...], tex }
//   - membres articulés (pivot à jointY), animés en alternance par entities/mob.js

export const MOBS = {
  pig: {
    name: 'Cochon',
    speed: 1.1,
    health: 4,
    hitbox: { radius: 0.42, height: 0.9 },
    ai: 'wander',
    drops: [{ item: 'meat', min: 1, max: 1 }],
    model: {
      parts: [
        { size: [0.9, 0.6, 1.3], at: [0, 0.5, 0], tex: 'pigSkin' },
        { size: [0.5, 0.5, 0.5], at: [0, 0.65, 0.75], tex: 'pigSkin', faceTex: 'pigFace' },
      ],
      limbs: [
        {
          group: 'legs',
          size: [0.18, 0.35, 0.18],
          jointY: 0.35,
          positions: [
            [-0.3, -0.5],
            [0.3, -0.5],
            [-0.3, 0.5],
            [0.3, 0.5],
          ],
          tex: 'pigSkin',
        },
      ],
    },
  },
  cow: {
    name: 'Vache',
    speed: 0.9,
    health: 5,
    hitbox: { radius: 0.55, height: 1.15 },
    ai: 'wander',
    drops: [
      { item: 'meat', min: 1, max: 1 },
      { item: 'milk', min: 1, max: 1 },
    ],
    model: {
      parts: [
        { size: [1.125, 0.75, 1.625], at: [0, 0.625, 0], tex: 'cowSkin' },
        {
          size: [0.625, 0.625, 0.625],
          at: [0, 0.8125, 0.9375],
          tex: 'cowSkin',
          faceTex: 'cowFace',
        },
      ],
      limbs: [
        {
          group: 'legs',
          size: [0.225, 0.4375, 0.225],
          jointY: 0.4375,
          positions: [
            [-0.375, -0.625],
            [0.375, -0.625],
            [-0.375, 0.625],
            [0.375, 0.625],
          ],
          tex: 'cowSkin',
        },
      ],
    },
  },
  zombie: {
    name: 'Zombie',
    speed: 1.6,
    health: 6,
    hitbox: { radius: 0.32, height: 1.9 },
    ai: 'hostile',
    drops: [],
    // Mort-vivant : prend feu en plein jour à ciel dégagé (cf. entities/mob.js,
    // Mob.update()) -- seul mob concerné, donc porté par les données plutôt que
    // codé en dur sur le type 'zombie' dans la logique.
    burnsInSunlight: true,
    model: {
      parts: [
        { size: [0.6, 0.9, 0.35], at: [0, 1.05, 0], tex: 'zombieShirt' },
        { size: [0.5, 0.5, 0.5], at: [0, 1.75, 0], tex: 'zombieSkin', faceTex: 'zombieFace' },
      ],
      limbs: [
        {
          // bras alignés sur le buste : même hauteur (0.9) et pivot au sommet du
          // buste (1.05 + 0.9/2 = 1.5), donc le bas du bras retombe au niveau du
          // bas du buste (0.6), comme pour le joueur (cf. entities/player.js).
          group: 'arms',
          size: [0.18, 0.9, 0.18],
          jointY: 1.5,
          positions: [
            [-0.39, 0],
            [0.39, 0],
          ],
          tex: 'zombieSkin',
        },
        {
          group: 'legs',
          size: [0.2, 0.6, 0.2],
          jointY: 0.6,
          positions: [
            [-0.15, 0],
            [0.15, 0],
          ],
          tex: 'zombieShirt',
        },
      ],
    },
  },
  // Mouton (Phase 18) : preuve que le design data-driven marche -- ~30 lignes de
  // donnée, zéro nouvelle logique dans entities/mob.js à part la tonte (état, pas
  // un nouveau système). `wool: true` sur la partie "corps" marque QUELLE boîte
  // change de texture quand on tond (cf. shear()/regrow() dans entities/mob.js) ;
  // la tête garde son visage, seul le corps redevient "nu".
  sheep: {
    name: 'Mouton',
    speed: 1.0,
    health: 4,
    hitbox: { radius: 0.42, height: 1.2 },
    ai: 'wander',
    drops: [
      { item: 'wool', min: 1, max: 1 },
      { item: 'meat', min: 1, max: 2 },
    ],
    model: {
      parts: [
        { size: [1.0, 0.7, 1.3], at: [0, 0.6, 0], tex: 'sheepWool', wool: true },
        // `faceTex` (et non `tex: 'sheepFace'`) : sans lui, la tête n'a qu'UN matériau,
        // donc le visage était plaqué sur les six faces du cube — un mouton avec des
        // yeux devant, derrière et sur les côtés. `tex` habille les 5 autres faces.
        { size: [0.5, 0.5, 0.5], at: [0, 0.9, 0.75], tex: 'sheepWool', faceTex: 'sheepFace' },
      ],
      limbs: [
        {
          group: 'legs',
          size: [0.2, 0.4, 0.2],
          jointY: 0.4,
          positions: [
            [-0.32, -0.5],
            [0.32, -0.5],
            [-0.32, 0.5],
            [0.32, 0.5],
          ],
          tex: 'sheepSkin',
        },
      ],
    },
  },
  // Villageois (Phase 20) : peuple les villages générés (cf. world/villages.js).
  // Même gabarit humanoïde que le zombie (corps + tête + bras + membres), juste
  // reskinné -- pas de nouvelle logique de modèle à écrire. `ai: 'wander'` : il
  // erre autour de chez lui comme n'importe quel mob passif, rien de spécifique.
  villager: {
    name: 'Villageois',
    speed: 0.85,
    health: 8,
    hitbox: { radius: 0.32, height: 1.9 },
    ai: 'wander',
    drops: [],
    model: {
      parts: [
        { size: [0.6, 0.9, 0.35], at: [0, 1.05, 0], tex: 'villagerRobe' },
        { size: [0.5, 0.5, 0.5], at: [0, 1.75, 0], tex: 'villagerSkin', faceTex: 'villagerFace' },
      ],
      limbs: [
        {
          // bras alignés sur le buste : même hauteur (0.9) et pivot au sommet du
          // buste (1.05 + 0.9/2 = 1.5), donc le bas du bras retombe au niveau du
          // bas du buste (0.6), comme pour le joueur (cf. entities/player.js).
          group: 'arms',
          size: [0.18, 0.9, 0.18],
          jointY: 1.5,
          positions: [
            [-0.39, 0],
            [0.39, 0],
          ],
          tex: 'villagerRobe',
        },
        {
          group: 'legs',
          size: [0.2, 0.6, 0.2],
          jointY: 0.6,
          positions: [
            [-0.15, 0],
            [0.15, 0],
          ],
          tex: 'villagerRobe',
        },
      ],
    },
  },
  chicken: {
    name: 'Poulet',
    speed: 1.3,
    health: 3,
    hitbox: { radius: 0.28, height: 0.6 },
    ai: 'wander',
    drops: [{ item: 'meat', min: 1, max: 2 }],
    model: {
      parts: [
        { size: [0.4, 0.4, 0.5], at: [0, 0.42, 0], tex: 'chickenBody' },
        { size: [0.3, 0.3, 0.3], at: [0, 0.75, 0.28], tex: 'chickenBody' },
        { size: [0.1, 0.1, 0.15], at: [0, 0.72, 0.48], tex: 'chickenBeak' },
      ],
      limbs: [
        {
          group: 'legs',
          size: [0.08, 0.3, 0.08],
          jointY: 0.3,
          positions: [
            [-0.1, 0],
            [0.1, 0],
          ],
          tex: 'chickenBeak',
        },
      ],
    },
  },
};
