// Recettes de fonte (Phase 14). Pure donnée : aucun import.
// SMELTING : item brut -> item fondu. FUELS : item combustible -> secondes de combustion.
// `sand -> glass` (mentionné dans PLAN.md) arrive avec le bloc `sand` en Phase 17 —
// pas d'entrée ici tant que l'item n'existe pas, ce serait une recette invocable
// mais jamais atteignable, un bruit mort dans la table.

export const SMELTING = {
  iron_ore: 'iron_ingot',
  meat: 'cooked_meat',
};

export const FUELS = {
  coal_ore: 8,
  planks: 1.5,
  stick: 0.5,
};
