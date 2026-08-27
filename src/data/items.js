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
  bed: 'Lit',
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

// Recettes de la table de craft (Phase 18 : grille 3x3 « comme Minecraft »).
// Deux formats, comme dans le vrai jeu :
//   - `shapeless: { item: count }` : la forme n'a pas d'importance, seule la somme
//     des cases remplies de la grille compte (ex. planches : 1 bûche, n'importe où).
//   - `pattern` + `key` : la disposition compte. `pattern` est un tableau de lignes
//     (chaînes), chaque caractère est traduit via `key` en id d'objet ('.' = case
//     vide). Le moteur de correspondance (src/data/crafting.js) compare la grille
//     3x3 du joueur, une fois recadrée sur son rectangle de cases remplies, contre
//     ce motif -- il matche à n'importe quelle position dans la grille, exactement
//     comme dans Minecraft (une pioche fonctionne posée en haut, au milieu ou en
//     bas de la grille, tant que la forme relative est respectée).
export const RECIPES = [
  {
    id: 'planks',
    name: 'Planches',
    shapeless: { wood: 1 },
    give: { planks: 4 },
    needsTable: false,
  },
  {
    id: 'stick',
    name: 'Bâton',
    // 2 planches empilées dans une même colonne
    pattern: ['P', 'P'],
    key: { P: 'planks' },
    give: { stick: 4 },
    needsTable: false,
  },
  {
    id: 'table',
    name: 'Table de craft',
    // carré 2x2 de planches
    pattern: ['PP', 'PP'],
    key: { P: 'planks' },
    give: { crafting_table: 1 },
    needsTable: false,
  },
  {
    id: 'pickaxe',
    name: 'Pioche en bois',
    pattern: ['PPP', '.S.', '.S.'],
    key: { P: 'planks', S: 'stick' },
    give: { wood_pickaxe: 1 },
    needsTable: true,
  },
  {
    id: 'axe',
    name: 'Hache en bois',
    pattern: ['PP', 'PS', '.S'],
    key: { P: 'planks', S: 'stick' },
    give: { wood_axe: 1 },
    needsTable: true,
  },
  {
    id: 'sword',
    name: 'Épée en bois',
    pattern: ['P', 'P', 'S'],
    key: { P: 'planks', S: 'stick' },
    give: { wood_sword: 1 },
    needsTable: true,
  },
  // Tiers pierre/fer (Phase 4b). Le fer a besoin d'un lingot (Phase 14 : fourneau +
  // fonte), le minerai brut seul ne suffit pas -- c'est ce qui rend le fourneau
  // réellement nécessaire, pas juste une option. Mêmes formes que le bois, juste
  // l'ingrédient principal qui change (P -> S pour la pierre, I pour le fer).
  {
    id: 'stone_pickaxe',
    name: 'Pioche en pierre',
    pattern: ['SSS', '.T.', '.T.'],
    key: { S: 'stone', T: 'stick' },
    give: { stone_pickaxe: 1 },
    needsTable: true,
  },
  {
    id: 'stone_axe',
    name: 'Hache en pierre',
    pattern: ['SS', 'ST', '.T'],
    key: { S: 'stone', T: 'stick' },
    give: { stone_axe: 1 },
    needsTable: true,
  },
  {
    id: 'stone_sword',
    name: 'Épée en pierre',
    pattern: ['S', 'S', 'T'],
    key: { S: 'stone', T: 'stick' },
    give: { stone_sword: 1 },
    needsTable: true,
  },
  {
    id: 'iron_pickaxe',
    name: 'Pioche en fer',
    pattern: ['III', '.S.', '.S.'],
    key: { I: 'iron_ingot', S: 'stick' },
    give: { iron_pickaxe: 1 },
    needsTable: true,
  },
  {
    id: 'iron_axe',
    name: 'Hache en fer',
    pattern: ['II', 'IS', '.S'],
    key: { I: 'iron_ingot', S: 'stick' },
    give: { iron_axe: 1 },
    needsTable: true,
  },
  {
    id: 'iron_sword',
    name: 'Épée en fer',
    pattern: ['I', 'I', 'S'],
    key: { I: 'iron_ingot', S: 'stick' },
    give: { iron_sword: 1 },
    needsTable: true,
  },
  // Torche (Phase 13) : simple à obtenir dès le début, pas de table nécessaire —
  // c'est ce qui rend les grottes praticables avant même d'avoir posé une table de
  // craft. Charbon au-dessus du bâton, comme dans Minecraft.
  {
    id: 'torch',
    name: 'Torche',
    pattern: ['C', 'S'],
    key: { C: 'coal_ore', S: 'stick' },
    give: { torch: 4 },
    needsTable: false,
  },
  {
    id: 'furnace',
    name: 'Fourneau',
    // anneau de 8 pierres, case centrale vide
    pattern: ['SSS', 'S.S', 'SSS'],
    key: { S: 'stone' },
    give: { furnace: 1 },
    needsTable: false,
  },
  // Lit (occupe 2 cases au sol, cf. tryPlaceBed dans main.js) : pas un bloc simple
  // dans BLOCK_TYPES -- 'bed' est l'item qu'on garde en poche, sa pose spéciale
  // fait apparaître 2 blocs distincts (bed_foot/bed_head). Forme identique à
  // Minecraft : 3 laines en haut, 3 planches en bas.
  {
    id: 'bed',
    name: 'Lit',
    pattern: ['WWW', 'PPP'],
    key: { W: 'wool', P: 'planks' },
    give: { bed: 1 },
    needsTable: true,
  },
];

// dérivé : tout objet qui n'est pas un bloc n'est pas posable (outils, nourriture,
// ressources brutes intermédiaires comme le bâton). Une seule source de vérité :
// ajouter un objet à ITEM_NAMES sans l'ajouter à BLOCK_TYPES suffit à le rendre non posable.
export const NON_PLACEABLE = new Set(Object.keys(ITEM_NAMES).filter((id) => !BLOCK_TYPES[id]));
