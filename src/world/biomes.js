// Biomes (Phase 17.2) : deux champs de bruit basse fréquence de plus (température,
// humidité), échantillonnés PAR COLONNE, comme getHeight l'est déjà dans generator.js.
// PURE — aucun import hors core/math.js. Chaque biome est DONNÉE (surface, sous-sol,
// fréquence d'arbres, mobs) : ajouter un biome n'ajoute pas de branche `if` ailleurs.
//
// Simplification assumée (documentée dans PLAN.md §Phase 17) : la limite entre deux
// biomes reste un choix discret (pas d'interpolation entre deux jeux de blocs) —
// seule la HAUTEUR du terrain doit rester continue pour éviter une falaise à chaque
// frontière, et elle l'est déjà (temperature/humidity ne pilotent que le bloc de
// surface, jamais `getHeight`; océans/rivières, qui EUX modifient la hauteur, sont
// portés par un champ de bruit continu, cf. oceanCarve/riverCarve dans generator.js).

import { makeNoise2D } from '../core/math.js';

const noiseTemp = makeNoise2D(3333);
const noiseHumidity = makeNoise2D(4444);
export const noiseContinent = makeNoise2D(5555); // aussi utilisé par generator.js (océans)
export const noiseRiver = makeNoise2D(6666); // idem (rivières)

export const BIOMES = {
  ocean: { name: 'Océan', surface: 'sand', subsurface: 'sandstone', treeChance: 0, mobs: [] },
  plains: {
    name: 'Plaine',
    surface: 'grass',
    subsurface: 'dirt',
    treeChance: 0.006,
    mobs: ['pig', 'cow', 'sheep', 'chicken'],
  },
  forest: {
    name: 'Forêt',
    surface: 'grass',
    subsurface: 'dirt',
    treeChance: 0.03,
    mobs: ['pig', 'cow', 'sheep', 'chicken'],
  },
  desert: { name: 'Désert', surface: 'sand', subsurface: 'sandstone', treeChance: 0, mobs: [] },
  snowy: {
    name: 'Toundra',
    surface: 'snow',
    subsurface: 'dirt',
    treeChance: 0.01,
    mobs: ['sheep'],
  },
  mountains: { name: 'Montagnes', surface: 'stone', subsurface: 'stone', treeChance: 0, mobs: [] },
  swamp: {
    name: 'Marécage',
    surface: 'grass',
    subsurface: 'dirt',
    treeChance: 0.02,
    mobs: ['pig'],
  },
};

// [0,1] plutôt que [-1,1] : plus simple à seuiller (0.5 = "normal") pour qui lit le code.
// Fréquence 0.0008 : mesuré empiriquement (longueur moyenne d'un « run » d'un même
// biome le long d'un axe) pour retomber sur ~500 blocs avec les nouveaux seuils de
// biomeAt ci-dessous (les seuils resserrés près de 0.5 sont franchis plus souvent par
// le bruit qu'une fréquence donnée -> il faut une fréquence plus basse qu'avec les
// anciens seuils extrêmes pour obtenir la même taille de biome).
export function temperature(x, z) {
  return (noiseTemp(x * 0.0008, z * 0.0008) + 1) / 2;
}
export function humidity(x, z) {
  return (noiseHumidity(x * 0.0008, z * 0.0008) + 1) / 2;
}

// Seuil du biome « montagnes ». `mountainMask` vaut l'élévation supplémentaire de la
// colonne divisée par 70 (cf. `mountain = mtMask * 70` dans generator.js), donc 0.18
// = ~13 blocs au-dessus du relief de base : une vraie montagne. L'ancien seuil de
// 0.05 ne représentait que ~3,5 blocs de dénivelé — une simple bosse basculait donc
// en biome montagne, dont la surface ET le sous-sol sont de la pierre. Résultat :
// des plaques grises en plein herbage plat, avec les veines de minerai affleurantes.
const MOUNTAIN_MASK_THRESHOLD = 0.18;

// `mountainMask` : déjà calculé par getHeight (mtMask de generator.js) — évite de
// resampler le même bruit deux fois pour la même colonne.
//
// Seuils recalibrés (avant : 0.3 / 0.65+0.35 / 0.6) : le bruit de Perlin est concentré
// autour de 0.5 (10e/90e centile mesurés à ~0.36/0.64, cf. Git history) — les anciens
// seuils extrêmes (t<0.3, t>0.65 ET h<0.35) ne couvraient donc qu'une poignée de % de
// la carte chacun : neige ~3 %, désert ~1 % à peine. Rapprocher les seuils de 0.5 fait
// que CHAQUE biome couvre une part significative (mesuré : plaine ~37 %, désert ~10 %,
// forêt ~21 %, neige ~18 %, marécage ~14 %) — plus aucun biome n'est anecdotique.
export function biomeAt(x, z, mountainMask, isOcean) {
  if (isOcean) return 'ocean';
  if (mountainMask > MOUNTAIN_MASK_THRESHOLD) return 'mountains';
  const t = temperature(x, z);
  const h = humidity(x, z);
  if (t < 0.4) return 'snowy';
  if (t > 0.55 && h < 0.45) return 'desert';
  if (h > 0.52) return t > 0.55 ? 'swamp' : 'forest';
  return 'plains';
}
