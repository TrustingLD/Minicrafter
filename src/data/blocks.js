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

export const BLOCK_TYPES = {
  grass: {
    id: 1,
    name: 'Herbe',
    hardness: 0.6,
    tool: null,
    textures: { top: 'grassTop', bottom: 'dirt', side: 'grassSide' },
  },
  dirt: { id: 2, name: 'Terre', hardness: 0.5, tool: null, textures: { all: 'dirt' } },
  stone: { id: 3, name: 'Pierre', hardness: 1.5, tool: 'pickaxe', textures: { all: 'stone' } },
  wood: {
    id: 4,
    name: 'Bois',
    hardness: 1.2,
    tool: 'axe',
    textures: { top: 'woodTop', bottom: 'woodTop', side: 'woodSide' },
  },
  leaves: { id: 5, name: 'Feuilles', hardness: 0.3, tool: null, textures: { all: 'leaves' } },
  planks: { id: 6, name: 'Planches', hardness: 1.0, tool: null, textures: { all: 'planks' } },
  crafting_table: {
    id: 7,
    name: 'Table de craft',
    hardness: 1.2,
    tool: 'axe',
    textures: { top: 'craftTop', bottom: 'planks', side: 'craftSide' },
  },
  snow: { id: 8, name: 'Neige', hardness: 0.3, tool: null, textures: { all: 'snow' } },

  // Minerais (Phase 4b) : placés en veines par world/generator.js selon `vein`.
  coal_ore: {
    id: 9,
    name: 'Minerai de charbon',
    hardness: 1.5,
    tool: 'pickaxe',
    textures: { all: 'coalOre' },
    vein: { minY: 5, maxY: 60, rarity: 0.02, veinSize: 8 },
  },
  iron_ore: {
    id: 10,
    name: 'Minerai de fer',
    hardness: 2.0,
    tool: 'pickaxe',
    textures: { all: 'ironOre' },
    vein: { minY: 3, maxY: 40, rarity: 0.01, veinSize: 5 },
  },
  gold_ore: {
    id: 11,
    name: "Minerai d'or",
    hardness: 2.5,
    tool: 'pickaxe',
    textures: { all: 'goldOre' },
    vein: { minY: 2, maxY: 22, rarity: 0.004, veinSize: 4 },
  },
  diamond_ore: {
    id: 12,
    name: 'Minerai de diamant',
    hardness: 3.0,
    tool: 'pickaxe',
    textures: { all: 'diamondOre' },
    vein: { minY: 1, maxY: 14, rarity: 0.002, veinSize: 3 },
  },
  bedrock: {
    id: 13,
    name: 'Bedrock',
    hardness: Infinity,
    tool: null,
    textures: { all: 'bedrock' },
    unbreakable: true,
  },
};

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
