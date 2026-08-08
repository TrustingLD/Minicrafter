// Registre des types de blocs. Pure donnée : aucun import.
//
// id       : identifiant numérique (1-255) stocké dans le Uint8Array du chunk (Phase 4a).
//            0 est réservé à "air" — ne jamais l'utiliser ici.
// textures : { all: key } si les 6 faces sont identiques, sinon { top, bottom, side }.
//            `key` référence une entrée de TEXTURE_FN dans render/atlas.js.
// hardness : temps de base (secondes) pour casser à mains nues.
// tool     : catégorie d'outil ('pickaxe' | 'axe' | null) qui donne un bonus de
//            cassage — une catégorie plutôt qu'un item précis, pour que n'importe
//            quel tier de pioche (bois/pierre/fer) débloque le bonus sur la pierre.
// vein     : { minY, maxY, rarity, veinSize } — uniquement les minerais (Phase 4b).
// unbreakable : bloc qu'on ne peut jamais casser (bedrock, plancher du monde).
// drops    : [{ item, min, max }] — ce qui apparaît au sol quand on casse le bloc
//            (Phase 10). Une seule entrée à quantité fixe = min===max. Un bloc sans
//            `drops` (ou tableau vide) ne laisse rien tomber (ex: feuilles).

export const BLOCK_TYPES = {
  grass: {
    id: 1,
    name: 'Herbe',
    hardness: 0.6,
    tool: null,
    textures: { top: 'grassTop', bottom: 'dirt', side: 'grassSide' },
    drops: [{ item: 'dirt', min: 1, max: 1 }],
  },
  dirt: {
    id: 2,
    name: 'Terre',
    hardness: 0.5,
    tool: null,
    textures: { all: 'dirt' },
    drops: [{ item: 'dirt', min: 1, max: 1 }],
  },
  stone: {
    id: 3,
    name: 'Pierre',
    hardness: 1.5,
    tool: 'pickaxe',
    textures: { all: 'stone' },
    drops: [{ item: 'stone', min: 1, max: 1 }],
  },
  wood: {
    id: 4,
    name: 'Bois',
    hardness: 1.2,
    tool: 'axe',
    textures: { top: 'woodTop', bottom: 'woodTop', side: 'woodSide' },
    drops: [{ item: 'wood', min: 1, max: 1 }],
  },
  leaves: {
    id: 5,
    name: 'Feuilles',
    hardness: 0.3,
    tool: null,
    textures: { all: 'leaves' },
    drops: [],
  },
  planks: {
    id: 6,
    name: 'Planches',
    hardness: 1.0,
    tool: null,
    textures: { all: 'planks' },
    drops: [{ item: 'planks', min: 1, max: 1 }],
  },
  crafting_table: {
    id: 7,
    name: 'Table de craft',
    hardness: 1.2,
    tool: 'axe',
    textures: { top: 'craftTop', bottom: 'planks', side: 'craftSide' },
    drops: [{ item: 'crafting_table', min: 1, max: 1 }],
  },
  snow: {
    id: 8,
    name: 'Neige',
    hardness: 0.3,
    tool: null,
    textures: { all: 'snow' },
    drops: [{ item: 'snow', min: 1, max: 1 }],
  },

  // Minerais (Phase 4b) : placés en veines par world/generator.js selon `vein`.
  coal_ore: {
    id: 9,
    name: 'Minerai de charbon',
    hardness: 1.5,
    tool: 'pickaxe',
    textures: { all: 'coalOre' },
    vein: { minY: 5, maxY: 60, rarity: 0.02, veinSize: 8 },
    drops: [{ item: 'coal_ore', min: 1, max: 1 }],
  },
  iron_ore: {
    id: 10,
    name: 'Minerai de fer',
    hardness: 2.0,
    tool: 'pickaxe',
    textures: { all: 'ironOre' },
    vein: { minY: 3, maxY: 40, rarity: 0.01, veinSize: 5 },
    drops: [{ item: 'iron_ore', min: 1, max: 1 }],
  },
  gold_ore: {
    id: 11,
    name: "Minerai d'or",
    hardness: 2.5,
    tool: 'pickaxe',
    textures: { all: 'goldOre' },
    vein: { minY: 2, maxY: 22, rarity: 0.004, veinSize: 4 },
    drops: [{ item: 'gold_ore', min: 1, max: 1 }],
  },
  diamond_ore: {
    id: 12,
    name: 'Minerai de diamant',
    hardness: 3.0,
    tool: 'pickaxe',
    textures: { all: 'diamondOre' },
    vein: { minY: 1, maxY: 14, rarity: 0.002, veinSize: 3 },
    drops: [{ item: 'diamond_ore', min: 1, max: 1 }],
  },
  bedrock: {
    id: 13,
    name: 'Bedrock',
    hardness: Infinity,
    tool: null,
    textures: { all: 'bedrock' },
    unbreakable: true,
    drops: [],
  },
  // Torche (Phase 13) : seul bloc non-solide et émetteur de lumière du jeu.
  // `solid: false` -> ne bloque pas le joueur/les mobs ni la lumière (cf. isOpaque
  // dans world/world.js). `emitsLight` est lu par le système de lumière (world/light.js)
  // pour semer le BFS ; les autres blocs n'ont simplement pas ce champ (= n'émettent rien).
  torch: {
    id: 14,
    name: 'Torche',
    hardness: 0.1,
    tool: null,
    solid: false,
    // 15 = maximum : la lumière perd 1 par bloc parcouru, donc une torche à 15 se
    // fait encore franchement sentir à 5 blocs (niveau 10) — ce que 14 ne donnait
    // pas tout à fait. Cf. aussi le PointLight de main.js, qui ajoute de la vraie
    // lumière 3D par-dessus cette lumière « de bloc » stockée par sommet.
    emitsLight: 15,
    // `shape` : ce bloc n'est PAS un cube plein. Le mesher émet une boîte fine et
    // haute centrée dans la cellule (un bâton), et ne laisse jamais ce bloc masquer
    // la face d'un voisin. Cf. render/mesher.js.
    shape: { width: 0.2, height: 0.62 },
    // trois tuiles distinctes : le bâton sur les côtés (manche + flamme en haut),
    // la flamme seule sur le dessus, le bois nu en dessous.
    textures: { top: 'torchFlame', bottom: 'torchWood', side: 'torchStick' },
    drops: [{ item: 'torch', min: 1, max: 1 }],
  },
  // Fourneau (Phase 14) : bloc-entité (état + horloge propres, cf. world/block-entities.js).
  // Simplification assumée : une seule texture, pas de variante "allumée" -- le mesher
  // partage un atlas UV PAR TYPE DE BLOC, donc faire varier l'apparence d'UNE instance
  // précise selon son état demanderait un système à part (comme la lumière par sommet,
  // Phase 13) ; l'état "allumé" reste visible dans le panneau (jauge de flamme), pas sur
  // le bloc lui-même pour l'instant.
  furnace: {
    id: 15,
    name: 'Fourneau',
    hardness: 3.5,
    tool: 'pickaxe',
    textures: { all: 'furnace' },
    isFurnace: true,
    drops: [{ item: 'furnace', min: 1, max: 1 }],
  },
  // Laine (Phase 18) : tondue sur un mouton, ou posée comme bloc plein classique.
  // Teignable plus tard (backlog) — une seule couleur pour l'instant.
  wool: {
    id: 16,
    name: 'Laine',
    hardness: 0.8,
    tool: null,
    textures: { all: 'wool' },
    drops: [{ item: 'wool', min: 1, max: 1 }],
  },
  // Eau / lave, comme de VRAIS blocs du chunk (Phase 16) : avant, elles vivaient dans
  // des side-lists (waterCells/lavaCells) dessinées comme des InstancedMesh à part,
  // donc invisibles pour le mesher -> chaque face de lac était dessinée, y compris
  // celles enfoncées dans la terre. `solid: false` (non-solide, on peut nager/tomber
  // dedans), `liquid: true` (marque le mesher + world/fluid.js), incassables (pas de
  // `tool`, hardness Infinity, `unbreakable`) -- on ne "mine" pas un liquide, on le
  // déplace en creusant à côté (cf. fluid.js).
  water: {
    id: 17,
    name: 'Eau',
    hardness: Infinity,
    tool: null,
    solid: false,
    liquid: true,
    unbreakable: true,
    textures: { all: 'water' },
    drops: [],
  },
  lava: {
    id: 18,
    name: 'Lave',
    hardness: Infinity,
    tool: null,
    solid: false,
    liquid: true,
    unbreakable: true,
    // niveau 11 : le BFS de world/light.js perd 1 niveau par bloc et s'arrête dès
    // qu'il atteint 1 (il ne propage plus au-delà) -> portée exacte de 10 blocs
    // (11 - 1) depuis la source, comme demandé.
    emitsLight: 11, // gratuit maintenant que la lumière existe (Phase 13) -- une mare de lave s'éclaire elle-même
    textures: { all: 'lava' },
    drops: [],
  },
  // Biomes (Phase 17.2) : blocs de désert/plage + neige-adjacent (glace).
  sand: {
    id: 19,
    name: 'Sable',
    hardness: 0.5,
    tool: null,
    textures: { all: 'sand' },
    drops: [{ item: 'sand', min: 1, max: 1 }],
  },
  sandstone: {
    id: 20,
    name: 'Grès',
    hardness: 1.2,
    tool: 'pickaxe',
    textures: { all: 'sandstone' },
    drops: [{ item: 'sandstone', min: 1, max: 1 }],
  },
  cactus: {
    id: 21,
    name: 'Cactus',
    hardness: 0.6,
    tool: null,
    textures: { all: 'cactus' },
    drops: [{ item: 'cactus', min: 1, max: 1 }],
  },
  // Buisson mort : comme la torche (Phase 13), pas un cube plein -- un bouquet de
  // brindilles fines centré dans la cellule (cf. `shape` dans render/mesher.js).
  // Avant, le buisson occupait toute la cellule avec une texture "icône" dessinée
  // dessus ; visuellement ça rendait comme un bloc de terre avec un motif, pas
  // comme un buisson isolé. `solid: false` déjà présent : on marche à travers.
  dead_bush: {
    id: 22,
    name: 'Buisson mort',
    hardness: 0.1,
    tool: null,
    solid: false,
    shape: { width: 0.55, height: 0.8 },
    textures: { all: 'deadBush' },
    drops: [],
  },
  ice: {
    id: 23,
    name: 'Glace',
    hardness: 0.9,
    tool: null,
    textures: { all: 'ice' },
    drops: [],
  },
  // Mauvaises herbes (décor) : contrairement au buisson mort (une boîte fine
  // texturée sur ses 6 faces), on veut ici de vrais brins qui se découpent dans
  // une texture à trous — `cross: true` bascule le mesher sur un rendu "en X"
  // (2 plans diagonaux à travers la cellule, texture avec fond transparent),
  // le vrai rendu "herbe haute" façon Minecraft plutôt qu'un petit cube vert.
  // Non pleine (on marche à travers), purement esthétique (aucun drop).
  weeds: {
    id: 24,
    name: 'Mauvaises herbes',
    hardness: 0.1,
    tool: null,
    solid: false,
    shape: { height: 0.7, cross: true },
    textures: { all: 'weeds' },
    drops: [],
  },
};

// tous les blocs liquides, avec leur id résolu — le mesher (faces séparées,
// culling) et fluid.js (propagation) n'ont besoin que de cette liste.
export const LIQUID_IDS = new Set(
  Object.values(BLOCK_TYPES)
    .filter((b) => b.liquid)
    .map((b) => b.id),
);

// blocs qui ne remplissent pas leur cellule (`shape`), avec leur id résolu :
// id -> { width, height }. Le mesher s'en sert pour DEUX choses indissociables —
// émettre une boîte réduite au lieu d'un cube, et ne jamais laisser ce bloc masquer
// la face d'un voisin (un bâton fin ne cache pas le mur derrière lui).
export const SHAPE_BY_ID = Object.fromEntries(
  Object.values(BLOCK_TYPES)
    .filter((b) => b.shape)
    .map((b) => [b.id, b.shape]),
);

// bloc -> catégorie d'outil qui donne un bonus de récolte, dérivé de BLOCK_TYPES
export const TOOL_FOR_BLOCK = Object.fromEntries(
  Object.entries(BLOCK_TYPES)
    .filter(([, b]) => b.tool)
    .map(([id, b]) => [id, b.tool]),
);

// nom de bloc -> id numérique et l'inverse (utilisés par le chunk Uint8Array)
export const BLOCK_ID = Object.fromEntries(Object.entries(BLOCK_TYPES).map(([k, b]) => [k, b.id]));
export const BLOCK_BY_ID = Object.fromEntries(
  Object.entries(BLOCK_TYPES).map(([k, b]) => [b.id, k]),
);

// tous les minerais, avec leur id résolu — pratique pour le générateur (Phase 4b)
export const ORE_TYPES = Object.entries(BLOCK_TYPES)
  .filter(([, b]) => b.vein)
  .map(([name, b]) => ({ name, id: b.id, ...b.vein }));
