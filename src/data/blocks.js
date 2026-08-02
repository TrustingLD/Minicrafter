// Registre des types de blocs. Pure donnée : aucun import.
// hardness : temps de base (secondes) pour casser à mains nues — utilisé pour
// l'animation de cassage (Phase 3) ; avec le bon outil, cassage 2x plus rapide.
// tool : outil qui donne ce bonus (et un bonus de récolte, cf. main.js).

export const BLOCK_TYPES = {
  grass: { name: 'Herbe', hardness: 0.6, tool: null },
  dirt: { name: 'Terre', hardness: 0.5, tool: null },
  stone: { name: 'Pierre', hardness: 1.5, tool: 'wood_pickaxe' },
  wood: { name: 'Bois', hardness: 1.2, tool: 'wood_axe' },
  leaves: { name: 'Feuilles', hardness: 0.3, tool: null },
  planks: { name: 'Planches', hardness: 1.0, tool: null },
  crafting_table: { name: 'Table de craft', hardness: 1.2, tool: 'wood_axe' },
  snow: { name: 'Neige', hardness: 0.3, tool: null },
};

// bloc -> outil qui donne un bonus de récolte, dérivé de BLOCK_TYPES (une seule
// source de vérité : ajouter un bloc avec `tool` suffit, pas besoin d'y repenser ici)
export const TOOL_FOR_BLOCK = Object.fromEntries(
  Object.entries(BLOCK_TYPES)
    .filter(([, b]) => b.tool)
    .map(([id, b]) => [id, b.tool]),
);
