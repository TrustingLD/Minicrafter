// Fourneau (Phase 14) : un bloc avec un état et une horloge, qui avance tout seul
// même quand le joueur ne regarde pas — la simulation tourne à son propre tic (4 Hz),
// pas au framerate. `tickFurnace` est PURE (aucun import) et testable seule ;
// `createBlockEntitySystem` est la partie impure qui garde ces états en mémoire et
// les persiste (localStorage, comme les diffs de blocs dans world/world.js, mais dans
// sa propre clé — un fourneau n'est pas un bloc du Uint8Array, juste posé dessus).

const SMELT_TIME = 5; // secondes pour fondre 1 unité, une fois le feu allumé

// slot = null | { item, count }. Avance le fourneau d'un pas `dt` (le tic, pas la
// frame). Retourne le même objet `state`, muté en place.
export function createFurnaceState() {
  return { input: null, fuel: null, output: null, burnRemaining: 0, smeltProgress: 0 };
}

export function tickFurnace(state, dt, SMELTING, FUELS) {
  const recipeOutput = state.input && SMELTING[state.input.item];
  const outputHasRoom =
    !state.output || (state.output.item === recipeOutput && state.output.count < 64);
  const canSmelt = !!recipeOutput && outputHasRoom;

  if (!canSmelt) {
    state.smeltProgress = 0; // pas de flux -> la progression retombe à 0 (comme retirer l'input dans Minecraft)
    return state;
  }

  if (state.burnRemaining <= 0 && state.fuel && FUELS[state.fuel.item]) {
    state.burnRemaining += FUELS[state.fuel.item];
    state.fuel.count -= 1;
    if (state.fuel.count <= 0) state.fuel = null;
  }
  if (state.burnRemaining <= 0) return state; // pas de combustible : rien n'avance

  state.burnRemaining -= dt;
  state.smeltProgress += dt;
  if (state.smeltProgress >= SMELT_TIME) {
    state.smeltProgress -= SMELT_TIME;
    state.input.count -= 1;
    if (state.input.count <= 0) state.input = null;
    if (state.output) state.output.count += 1;
    else state.output = { item: recipeOutput, count: 1 };
  }
  return state;
}

const STORAGE_KEY = 'minicrafter_furnaces_v1';
const TICK_RATE = 0.25; // 4 Hz

function loadSaved() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
  } catch {
    return {};
  }
}

export function createBlockEntitySystem() {
  const furnaces = new Map(); // "x,y,z" -> state
  const saved = loadSaved();
  for (const key in saved) furnaces.set(key, saved[key]);
  let dirty = false;
  let tickAccum = 0;

  const key = (x, y, z) => `${x},${y},${z}`;

  function ensure(x, y, z) {
    const k = key(x, y, z);
    let state = furnaces.get(k);
    if (!state) {
      state = createFurnaceState();
      furnaces.set(k, state);
    }
    return state;
  }
  function get(x, y, z) {
    return furnaces.get(key(x, y, z)) || null;
  }
  // retourne le contenu au moment de la casse (Phase 14) : rendu au joueur comme
  // des drops au sol par l'appelant, plutôt que silencieusement perdu.
  function remove(x, y, z) {
    const k = key(x, y, z);
    const state = furnaces.get(k);
    furnaces.delete(k);
    dirty = true;
    return state || null;
  }
  function flush() {
    if (!dirty) return;
    dirty = false;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(Object.fromEntries(furnaces)));
    } catch {
      /* quota pleine ou stockage indisponible : tant pis, on continue sans persister */
    }
  }
  function update(dt, SMELTING, FUELS) {
    tickAccum += dt;
    while (tickAccum >= TICK_RATE) {
      tickAccum -= TICK_RATE;
      for (const state of furnaces.values()) tickFurnace(state, TICK_RATE, SMELTING, FUELS);
      dirty = true;
    }
  }
  setInterval(flush, 2000);
  window.addEventListener('beforeunload', flush);

  return { ensure, get, remove, update, flush };
}
