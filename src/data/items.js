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
  milk: 'Lait',
  snow: 'Neige',
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
  // Tiers pierre/fer (Phase 4b). Le fer se craft directement depuis le minerai brut :
  // pas de fourneau/fusion pour l'instant, c'est un sujet à part entière (backlog,
  // PLAN.md Phase 9 "Furnace + smelting").
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
    need: { iron_ore: 3, stick: 2 },
    give: { iron_pickaxe: 1 },
    needsTable: true,
  },
  {
    id: 'iron_axe',
    name: 'Hache en fer',
    need: { iron_ore: 3, stick: 2 },
    give: { iron_axe: 1 },
    needsTable: true,
  },
  {
    id: 'iron_sword',
    name: 'Épée en fer',
    need: { iron_ore: 2, stick: 1 },
    give: { iron_sword: 1 },
    needsTable: true,
  },
];

export const HOTBAR = [
  'grass',
  'dirt',
  'stone',
  'wood',
  'leaves',
  'planks',
  'crafting_table',
  'wood_sword',
  'wood_pickaxe',
  'wood_axe',
  'stone_sword',
  'stone_pickaxe',
  'stone_axe',
  'iron_sword',
  'iron_pickaxe',
  'iron_axe',
];

// dérivé : tout objet qui n'est pas un bloc n'est pas posable (outils, nourriture,
// ressources brutes intermédiaires comme le bâton). Une seule source de vérité :
// ajouter un objet à ITEM_NAMES sans l'ajouter à BLOCK_TYPES suffit à le rendre non posable.
export const NON_PLACEABLE = new Set(Object.keys(ITEM_NAMES).filter((id) => !BLOCK_TYPES[id]));
