// Moteur de correspondance pour la grille de craft 3x3 (Phase 18). PURE —
// aucun import, aucun DOM : ne connaît que des tableaux de 9 cases
// (`null | { item, count }`, index = row*3 + col) et les recettes de items.js
// (cf. le commentaire en tête de ce fichier pour le format `shapeless`/`pattern`).
//
// Comme dans Minecraft : une recette à motif matche à N'IMPORTE QUELLE position
// dans la grille (une pioche fonctionne construite en haut, au milieu ou en bas),
// et on tolère le mirroir horizontal (une hache "dans l'autre sens" doit quand
// même fonctionner -- sinon le joueur qui pose ses planches à droite au lieu de
// gauche se retrouve bloqué sans aucun indice de ce qui cloche).

const GRID_SIZE = 3;

// rectangle englobant des cases non-vides, ou null si la grille est entièrement vide.
function boundsOf(grid) {
  let minR = GRID_SIZE,
    maxR = -1,
    minC = GRID_SIZE,
    maxC = -1;
  for (let r = 0; r < GRID_SIZE; r++)
    for (let c = 0; c < GRID_SIZE; c++) {
      if (!grid[r * GRID_SIZE + c]) continue;
      if (r < minR) minR = r;
      if (r > maxR) maxR = r;
      if (c < minC) minC = c;
      if (c > maxC) maxC = c;
    }
  if (maxR < 0) return null;
  return { minR, maxR, minC, maxC };
}

// `pattern` (tableau de chaînes) + `key` (caractère -> id d'objet) -> grille 2D
// d'ids ('.' ou tout caractère absent de `key` -> null = case vide).
function patternToIds(pattern, key) {
  return pattern.map((row) => [...row].map((ch) => key[ch] ?? null));
}

function idsEqual(a, b) {
  if (a.length !== b.length) return false;
  for (let r = 0; r < a.length; r++) {
    if (a[r].length !== b[r].length) return false;
    for (let c = 0; c < a[r].length; c++) if (a[r][c] !== b[r][c]) return false;
  }
  return true;
}

function mirrorH(ids) {
  return ids.map((row) => [...row].reverse());
}

function matchesShaped(grid, recipe) {
  const b = boundsOf(grid);
  if (!b) return false;
  const h = b.maxR - b.minR + 1,
    w = b.maxC - b.minC + 1;
  const pat = patternToIds(recipe.pattern, recipe.key);
  if (pat.length !== h || pat[0].length !== w) return false;
  const sub = [];
  for (let r = 0; r < h; r++) {
    const row = [];
    for (let c = 0; c < w; c++) {
      const cell = grid[(b.minR + r) * GRID_SIZE + (b.minC + c)];
      row.push(cell ? cell.item : null);
    }
    sub.push(row);
  }
  return idsEqual(sub, pat) || idsEqual(sub, mirrorH(pat));
}

function matchesShapeless(grid, recipe) {
  const totals = {};
  let filledCells = 0;
  for (const cell of grid) {
    if (!cell) continue;
    filledCells++;
    totals[cell.item] = (totals[cell.item] || 0) + cell.count;
  }
  if (filledCells === 0) return false;
  const need = recipe.shapeless;
  const neededTypes = Object.keys(need);
  if (Object.keys(totals).length !== neededTypes.length) return false;
  for (const type of neededTypes) if (totals[type] !== need[type]) return false;
  return true;
}

// Retourne la recette qui matche la grille (en tenant compte de `nearTable`
// pour ignorer les recettes qui exigent une table), ou null si aucune ne matche.
export function matchRecipe(grid, recipes, nearTable) {
  for (const recipe of recipes) {
    if (recipe.needsTable && !nearTable) continue;
    if (recipe.shapeless ? matchesShapeless(grid, recipe) : matchesShaped(grid, recipe)) {
      return recipe;
    }
  }
  return null;
}

// Consomme les ingrédients de `recipe` dans `grid`, EN PLACE. Recettes à motif :
// chaque case remplie correspond à 1 unité consommée (cf. commentaire de RECIPES
// dans items.js -- tous les motifs actuels n'utilisent qu'1 unité par case).
// Recettes shapeless : retire exactement les quantités de `recipe.shapeless`,
// en piochant dans les cases concernées dans l'ordre de la grille.
export function consumeForRecipe(grid, recipe) {
  if (recipe.shapeless) {
    for (const item in recipe.shapeless) {
      let remaining = recipe.shapeless[item];
      for (let i = 0; i < grid.length && remaining > 0; i++) {
        const cell = grid[i];
        if (!cell || cell.item !== item) continue;
        const take = Math.min(cell.count, remaining);
        cell.count -= take;
        remaining -= take;
        if (cell.count <= 0) grid[i] = null;
      }
    }
    return;
  }
  for (let i = 0; i < grid.length; i++) {
    if (!grid[i]) continue;
    grid[i].count -= 1;
    if (grid[i].count <= 0) grid[i] = null;
  }
}
