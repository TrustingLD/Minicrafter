// Objets (outils, nourriture, ressources) + recettes de craft. Pure donnée :
// seul import autorisé, un autre fichier de donnée (pour dériver NON_PLACEABLE).

import { BLOCK_TYPES } from './blocks.js';

export const ITEM_NAMES = {
  wood: 'Bois',
  planks: 'Planches',
  stick: 'Bâton',
  dirt: 'Terre',
  stone: 'Pierre',
  grass: 'Herbe',
  leaves: 'Feuilles',
  crafting_table: 'Table de craft',
  wood_pickaxe: 'Pioche en bois',
  wood_axe: 'Hache en bois',
  wood_sword: 'Épée en bois',
  stone_pickaxe: 'Pioche en pierre',
  stone_axe: 'Hache en pierre',
  stone_sword: 'Épée en pierre',
  iron_pickaxe: 'Pioche en fer',
  iron_axe: 'Hache en fer',
  iron_sword: 'Épée en fer',
  coal_ore: 'Minerai de charbon',
  iron_ore: 'Minerai de fer',
  gold_ore: "Minerai d'or",
  diamond_ore: 'Minerai de diamant',
  meat: 'Viande',
  cooked_meat: 'Viande cuite',
  milk: 'Lait',
  snow: 'Neige',
  torch: 'Torche',
  furnace: 'Fourneau',
  iron_ingot: 'Lingot de fer',
  wool: 'Laine',
  sand: 'Sable',
  sandstone: 'Grès',
  cactus: 'Cactus',
};

// nourriture (Phase 11) : item -> { hunger, saturationTime }. hunger = points de
// faim (sur 20) rendus en une bouchée ; saturationTime = durée de l'animation de
// consommation en secondes. Un item sans entrée ici n'est simplement pas mangeable.
export const FOOD = {
  meat: { hunger: 3, saturationTime: 1.6 },
  cooked_meat: { hunger: 6, saturationTime: 1.6 },
  milk: { hunger: 4, saturationTime: 1.2 },
};

// item d'outil -> catégorie ('pickaxe' | 'axe' | 'sword'). blocks.js référence la
// CATÉGORIE (pas un item précis) sur `tool` : n'importe quel tier de pioche donne
// le bonus sur la pierre, pas seulement la pioche en bois.
export const TOOL_CATEGORY = {
  wood_pickaxe: 'pickaxe',
  stone_pickaxe: 'pickaxe',
  iron_pickaxe: 'pickaxe',
  wood_axe: 'axe',
  stone_axe: 'axe',
  iron_axe: 'axe',
  wood_sword: 'sword',
  stone_sword: 'sword',
  iron_sword: 'sword',
};

export const RECIPES = [
  { id: 'planks', name: 'Planches', need: { wood: 1 }, give: { planks: 4 }, needsTable: false },
  { id: 'stick', name: 'Bâton', need: { planks: 2 }, give: { stick: 4 }, needsTable: false },
  {
    id: 'table',
    name: 'Table de craft',
    need: { planks: 4 },
    give: { crafting_table: 1 },
    needsTable: false,
  },
  {
    id: 'pickaxe',
    name: 'Pioche en bois',
    need: { planks: 3, stick: 2 },
    give: { wood_pickaxe: 1 },
    needsTable: true,
  },
  {
    id: 'axe',
    name: 'Hache en bois',
    need: { planks: 3, stick: 2 },
    give: { wood_axe: 1 },
    needsTable: true,
  },
  {
    id: 'sword',
    name: 'Épée en bois',
    need: { planks: 2, stick: 1 },
    give: { wood_sword: 1 },
    needsTable: true,
  },
  // Tiers pierre/fer (Phase 4b). Le fer a besoin d'un lingot (Phase 14 : fourneau +
  // fonte), le minerai brut seul ne suffit pas -- c'est ce qui rend le fourneau
  // réellement nécessaire, pas juste une option.
  {
    id: 'stone_pickaxe',
    name: 'Pioche en pierre',
    need: { stone: 3, stick: 2 },
    give: { stone_pickaxe: 1 },
    needsTable: true,
  },
  {
    id: 'stone_axe',
    name: 'Hache en pierre',
    need: { stone: 3, stick: 2 },
    give: { stone_axe: 1 },
    needsTable: true,
  },
  {
    id: 'stone_sword',
    name: 'Épée en pierre',
    need: { stone: 2, stick: 1 },
    give: { stone_sword: 1 },
    needsTable: true,
  },
  {
    id: 'iron_pickaxe',
    name: 'Pioche en fer',
    need: { iron_ingot: 3, stick: 2 },
    give: { iron_pickaxe: 1 },
    needsTable: true,
  },
  {
    id: 'iron_axe',
    name: 'Hache en fer',
    need: { iron_ingot: 3, stick: 2 },
    give: { iron_axe: 1 },
    needsTable: true,
  },
  {
    id: 'iron_sword',
    name: 'Épée en fer',
    need: { iron_ingot: 2, stick: 1 },
    give: { iron_sword: 1 },
    needsTable: true,
  },
  // Torche (Phase 13) : simple à obtenir dès le début, pas de table nécessaire —
  // c'est ce qui rend les grottes praticables avant même d'avoir posé une table de craft.
  {
    id: 'torch',
    name: 'Torche',
    need: { stick: 1, coal_ore: 1 },
    give: { torch: 4 },
    needsTable: false,
  },
  {
    id: 'furnace',
    name: 'Fourneau',
    need: { stone: 8 },
    give: { furnace: 1 },
    needsTable: false,
  },
];

// dérivé : tout objet qui n'est pas un bloc n'est pas posable (outils, nourriture,
// ressources brutes intermédiaires comme le bâton). Une seule source de vérité :
// ajouter un objet à ITEM_NAMES sans l'ajouter à BLOCK_TYPES suffit à le rendre non posable.
export const NON_PLACEABLE = new Set(Object.keys(ITEM_NAMES).filter((id) => !BLOCK_TYPES[id]));
