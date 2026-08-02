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
  meat: 'Viande',
  milk: 'Lait',
  snow: 'Neige',
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
];

// dérivé : tout objet qui n'est pas un bloc n'est pas posable (outils, nourriture,
// ressources brutes intermédiaires comme le bâton). Une seule source de vérité :
// ajouter un objet à ITEM_NAMES sans l'ajouter à BLOCK_TYPES suffit à le rendre non posable.
export const NON_PLACEABLE = new Set(Object.keys(ITEM_NAMES).filter((id) => !BLOCK_TYPES[id]));
