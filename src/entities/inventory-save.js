// Sauvegarde de l'inventaire (Phase 41) : PUR (aucun import, aucun accès à localStorage) --
// testable sous `node --test` sans DOM, même séparation que world/physics.js ou
// entities/boat-physics.js. main.js fait le lien avec localStorage (clé
// INVENTORY_STORAGE_KEY) et appelle serializeInventory/deserializeInventory ; voir aussi
// world/world.js (diffs de blocs) et world/block-entities.js (coffres/fourneaux), qui
// suivent la même convention de nommage `minicrafter_<chose>_v1`.

export const INVENTORY_STORAGE_KEY = 'minicrafter_inventory_v1';

// Une case d'inventaire valide est soit `null` (vide), soit `{ item: string, count: number }`
// avec un compte entier strictement positif -- jamais autre chose de sérialisable en JSON.
function normalizeCell(cell) {
  if (!cell || typeof cell !== 'object') return null;
  if (typeof cell.item !== 'string' || !cell.item) return null;
  if (!Number.isFinite(cell.count) || cell.count <= 0) return null;
  return { item: cell.item, count: Math.floor(cell.count) };
}

// slots/armorSlots : tableaux de cases (cf. entities/inventory.js : createSlots/
// createArmorSlots). selectedIndex : emplacement de hotbar tenu en main.
export function serializeInventory(slots, armorSlots, selectedIndex) {
  return JSON.stringify({
    v: 1,
    slots: slots.map(normalizeCell),
    armorSlots: armorSlots.map(normalizeCell),
    selectedIndex,
  });
}

// Reconstruit { slots, armorSlots, selectedIndex } depuis le JSON sauvegardé -- ou `null`
// si `json` est vide/corrompu/d'une forme inattendue, auquel cas l'appelant garde les
// tableaux vides déjà créés par createSlots()/createArmorSlots() (un inventaire flambant
// neuf, pas une erreur). `slotCount`/`armorCount` : la taille ATTENDUE aujourd'hui
// (HOTBAR_SLOTS+sac à dos, ARMOR_SLOTS) -- une sauvegarde d'une taille différente (le jeu
// a changé depuis) est tronquée ou complétée de cases vides plutôt que rejetée en bloc,
// pour ne perdre que le strict nécessaire.
export function deserializeInventory(json, slotCount, armorCount) {
  if (!json) return null;
  let data;
  try {
    data = JSON.parse(json);
  } catch {
    return null;
  }
  if (!data || !Array.isArray(data.slots) || !Array.isArray(data.armorSlots)) return null;

  const slots = new Array(slotCount).fill(null);
  for (let i = 0; i < Math.min(slotCount, data.slots.length); i++) {
    slots[i] = normalizeCell(data.slots[i]);
  }
  const armorSlots = new Array(armorCount).fill(null);
  for (let i = 0; i < Math.min(armorCount, data.armorSlots.length); i++) {
    armorSlots[i] = normalizeCell(data.armorSlots[i]);
  }
  const selectedIndex =
    Number.isInteger(data.selectedIndex) &&
    data.selectedIndex >= 0 &&
    data.selectedIndex < slotCount
      ? data.selectedIndex
      : 0;
  return { slots, armorSlots, selectedIndex };
}
