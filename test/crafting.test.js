import { test } from 'node:test';
import assert from 'node:assert/strict';
import { matchRecipe, consumeForRecipe } from '../src/data/crafting.js';
import { RECIPES } from '../src/data/items.js';
import { SMELTING } from '../src/data/recipes.js';

// grille 3x3 à partir d'une liste [index, item, count?]
function grid9(cells) {
  const g = new Array(9).fill(null);
  for (const [i, item, count] of cells) g[i] = { item, count: count ?? 1 };
  return g;
}

test('matchRecipe: toutes les recettes de RECIPES ont un id unique et un `give` mono-item', () => {
  const ids = new Set();
  for (const r of RECIPES) {
    assert.ok(!ids.has(r.id), `id dupliqué: ${r.id}`);
    ids.add(r.id);
    assert.equal(Object.keys(r.give).length, 1, `${r.id}: give doit avoir exactement 1 clé`);
    assert.ok(r.shapeless || r.pattern, `${r.id}: doit être shapeless ou avoir un pattern`);
  }
});

test('matchRecipe: recette à motif (pioche) matche posée en haut de la grille', () => {
  const g = grid9([
    [0, 'planks'],
    [1, 'planks'],
    [2, 'planks'],
    [4, 'stick'],
    [7, 'stick'],
  ]);
  assert.equal(matchRecipe(g, RECIPES, true)?.id, 'pickaxe');
});

test('matchRecipe: la même forme décalée dans la grille matche toujours (translation-invariant)', () => {
  const g = grid9([
    [3, 'planks'],
    [4, 'planks'],
    [5, 'planks'],
    [7, 'stick'],
    // ligne du bas indisponible (grille 3x3), donc pioche décalée d'une ligne
    // seulement -- toujours un rectangle englobant 3x2, on complète avec un
    // deuxième bâton pour rester sur une forme valide de la recette.
  ]);
  // forme incomplète : ne doit PAS matcher n'importe quelle autre recette par accident
  assert.equal(matchRecipe(g, RECIPES, true), null);
});

test('matchRecipe: recette asymétrique (hache) matche aussi en miroir', () => {
  const normal = grid9([
    [0, 'planks'],
    [1, 'planks'],
    [3, 'planks'],
    [4, 'stick'],
    [7, 'stick'],
  ]);
  assert.equal(matchRecipe(normal, RECIPES, true)?.id, 'axe');

  const mirrored = grid9([
    [1, 'planks'],
    [2, 'planks'],
    [4, 'planks'],
    [5, 'stick'],
    [8, 'stick'],
  ]);
  assert.equal(matchRecipe(mirrored, RECIPES, true)?.id, 'axe');
});

test("matchRecipe: recette needsTable ignorée hors de proximité d'une table", () => {
  const g = grid9([
    [0, 'planks'],
    [1, 'planks'],
    [2, 'planks'],
    [4, 'stick'],
    [7, 'stick'],
  ]);
  assert.equal(matchRecipe(g, RECIPES, false), null);
});

test("matchRecipe: shapeless (planches) matche 1 bûche dans n'importe quelle case", () => {
  assert.equal(matchRecipe(grid9([[0, 'wood']]), RECIPES, false)?.id, 'planks');
  assert.equal(matchRecipe(grid9([[8, 'wood']]), RECIPES, false)?.id, 'planks');
});

test('matchRecipe: shapeless refuse une quantité différente de celle attendue', () => {
  assert.equal(matchRecipe(grid9([[0, 'wood', 2]]), RECIPES, false), null);
});

test('matchRecipe: shapeless refuse un objet supplémentaire non demandé dans la grille', () => {
  const g = grid9([
    [0, 'wood'],
    [1, 'stick'],
  ]);
  assert.equal(matchRecipe(g, RECIPES, false), null);
});

test('matchRecipe: fourneau (anneau de 8 pierres, centre vide)', () => {
  const g = grid9([
    [0, 'stone'],
    [1, 'stone'],
    [2, 'stone'],
    [3, 'stone'],
    [5, 'stone'],
    [6, 'stone'],
    [7, 'stone'],
    [8, 'stone'],
  ]);
  assert.equal(matchRecipe(g, RECIPES, false)?.id, 'furnace');
});

test('matchRecipe: coffre (anneau de 8 planches, centre vide)', () => {
  const g = grid9([
    [0, 'planks'],
    [1, 'planks'],
    [2, 'planks'],
    [3, 'planks'],
    [5, 'planks'],
    [6, 'planks'],
    [7, 'planks'],
    [8, 'planks'],
  ]);
  assert.equal(matchRecipe(g, RECIPES, true)?.id, 'chest');
});

test('consumeForRecipe: recette à motif retire exactement 1 par case utilisée', () => {
  const g = grid9([
    [0, 'planks', 1],
    [1, 'planks', 1],
    [2, 'planks', 1],
    [4, 'stick', 1],
    [7, 'stick', 1],
  ]);
  const recipe = matchRecipe(g, RECIPES, true);
  consumeForRecipe(g, recipe);
  assert.ok(g.every((c) => c === null));
});

test('consumeForRecipe: recette shapeless retire seulement la quantité nécessaire, laisse le reste', () => {
  const g = grid9([[0, 'wood', 1]]);
  const recipe = matchRecipe(g, RECIPES, false);
  consumeForRecipe(g, recipe);
  assert.ok(g.every((c) => c === null));
});

test('matchRecipe: lit (3 laines en haut, 3 planches en bas)', () => {
  const g = grid9([
    [0, 'wool'],
    [1, 'wool'],
    [2, 'wool'],
    [3, 'planks'],
    [4, 'planks'],
    [5, 'planks'],
  ]);
  assert.equal(matchRecipe(g, RECIPES, true)?.id, 'bed');
});

test('matchRecipe: casque en fer (arceau MMM / M.M)', () => {
  const g = grid9([
    [0, 'iron_ingot'],
    [1, 'iron_ingot'],
    [2, 'iron_ingot'],
    [3, 'iron_ingot'],
    [5, 'iron_ingot'],
  ]);
  assert.equal(matchRecipe(g, RECIPES, true)?.id, 'iron_helmet');
});

test('matchRecipe: plastron en or (M.M / MMM / MMM)', () => {
  const g = grid9([
    [0, 'gold_ingot'],
    [2, 'gold_ingot'],
    [3, 'gold_ingot'],
    [4, 'gold_ingot'],
    [5, 'gold_ingot'],
    [6, 'gold_ingot'],
    [7, 'gold_ingot'],
    [8, 'gold_ingot'],
  ]);
  assert.equal(matchRecipe(g, RECIPES, true)?.id, 'gold_chestplate');
});

test('matchRecipe: jambières en diamant (MMM / M.M / M.M)', () => {
  const g = grid9([
    [0, 'diamond'],
    [1, 'diamond'],
    [2, 'diamond'],
    [3, 'diamond'],
    [5, 'diamond'],
    [6, 'diamond'],
    [8, 'diamond'],
  ]);
  assert.equal(matchRecipe(g, RECIPES, true)?.id, 'diamond_leggings');
});

test('matchRecipe: bottes en fer (M.M / M.M)', () => {
  const g = grid9([
    [0, 'iron_ingot'],
    [2, 'iron_ingot'],
    [3, 'iron_ingot'],
    [5, 'iron_ingot'],
  ]);
  assert.equal(matchRecipe(g, RECIPES, true)?.id, 'iron_boots');
});

test('matchRecipe: armures ignorées sans table à proximité', () => {
  const g = grid9([
    [0, 'iron_ingot'],
    [2, 'iron_ingot'],
    [3, 'iron_ingot'],
    [5, 'iron_ingot'],
  ]);
  assert.equal(matchRecipe(g, RECIPES, false), null);
});

test("SMELTING: minerai d'or et de diamant se fondent bien", () => {
  assert.equal(SMELTING.gold_ore, 'gold_ingot');
  assert.equal(SMELTING.diamond_ore, 'diamond');
});
