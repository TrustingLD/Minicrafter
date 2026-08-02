// Registre des types de blocs. Pure donnée : aucun import.

export const BLOCK_TYPES = {
  grass: { name: 'Herbe' },
  dirt: { name: 'Terre' },
  stone: { name: 'Pierre' },
  wood: { name: 'Bois' },
  leaves: { name: 'Feuilles' },
  planks: { name: 'Planches' },
  crafting_table: { name: 'Table de craft' },
  snow: { name: 'Neige' },
};

// bloc -> outil qui donne un bonus de récolte
export const TOOL_FOR_BLOCK = {
  wood: 'wood_axe',
  stone: 'wood_pickaxe',
  crafting_table: 'wood_axe',
};
