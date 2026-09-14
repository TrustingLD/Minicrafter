// Inventaire à emplacements (Phase 10) : remplace le dictionnaire plat { item: count }
// par un tableau de slots. PURE — aucun import, testable sans navigateur.
// slot = null | { item: string, count: number }

export const HOTBAR_SLOTS = 9;
export const BACKPACK_SLOTS = 27;
export const TOTAL_SLOTS = HOTBAR_SLOTS + BACKPACK_SLOTS;
export const MAX_STACK = 64;

// emplacements d'armure (casque / plastron / jambières / bottes) : un tableau à
// part (pas ajouté à `slots`) pour ne pas décaler HOTBAR_SLOTS/TOTAL_SLOTS et
// casser tout le code qui itère déjà sur l'inventaire principal.
export const ARMOR_SLOTS = 4;
export const ARMOR_NAMES = ['head', 'chest', 'legs', 'feet'];

export function createSlots() {
  return new Array(TOTAL_SLOTS).fill(null);
}

export function createArmorSlots() {
  return new Array(ARMOR_SLOTS).fill(null);
}

// échange le contenu d'une case d'armure avec une case de l'inventaire principal
// (typiquement le slot hotbar sélectionné) — même logique "clic pour échanger"
// que le sac à dos, cf. ui/craft.js: onSlotClick.
export function swapArmor(armorSlots, slots, armorIndex, slotIndex) {
  const tmp = armorSlots[armorIndex];
  armorSlots[armorIndex] = slots[slotIndex];
  slots[slotIndex] = tmp;
}

// remplit les stacks partiels existants d'abord, puis les emplacements vides.
// Retourne la quantité qui n'a pas pu être placée (0 si tout est rangé).
export function addItem(slots, item, count) {
  let remaining = count;
  for (let i = 0; i < slots.length && remaining > 0; i++) {
    const s = slots[i];
    if (s && s.item === item && s.count < MAX_STACK) {
      const add = Math.min(MAX_STACK - s.count, remaining);
      s.count += add;
      remaining -= add;
    }
  }
  for (let i = 0; i < slots.length && remaining > 0; i++) {
    if (!slots[i]) {
      const add = Math.min(MAX_STACK, remaining);
      slots[i] = { item, count: add };
      remaining -= add;
    }
  }
  return remaining;
}

// retire jusqu'à `count` unités de `item`, en vidant les slots à 0 (-> null).
// Retourne la quantité réellement retirée (peut être < count si l'inventaire n'en a pas assez).
export function removeItem(slots, item, count) {
  let remaining = count;
  for (let i = 0; i < slots.length && remaining > 0; i++) {
    const s = slots[i];
    if (s && s.item === item) {
      const take = Math.min(s.count, remaining);
      s.count -= take;
      remaining -= take;
      if (s.count === 0) slots[i] = null;
    }
  }
  return count - remaining;
}

export function countOf(slots, item) {
  let total = 0;
  for (const s of slots) if (s && s.item === item) total += s.count;
  return total;
}

export function hasAtLeast(slots, need) {
  for (const item in need) if (countOf(slots, item) < need[item]) return false;
  return true;
}

// déplace/échange deux slots. Même item -> fusion (dans la limite de MAX_STACK,
// le reste stagne dans `from`). Items différents (ou l'un des deux vide) -> échange.
// Sert de base au drag & drop (Phase 10 ne fait que cliquer, pas glisser).
export function moveSlot(slots, from, to) {
  if (from === to) return;
  const a = slots[from];
  const b = slots[to];
  if (a && b && a.item === b.item) {
    const space = MAX_STACK - b.count;
    const move = Math.min(space, a.count);
    b.count += move;
    a.count -= move;
    if (a.count === 0) slots[from] = null;
    return;
  }
  slots[from] = b;
  slots[to] = a;
}

// true si l'inventaire est saturé (aucun slot vide ni stack pouvant absorber une
// unité de plus de `item`) — utile pour savoir si un drop au sol pourra être ramassé.
export function canFit(slots, item, count) {
  let remaining = count;
  for (const s of slots) {
    if (!s) return true;
    if (s.item === item && s.count < MAX_STACK) remaining -= MAX_STACK - s.count;
    if (remaining <= 0) return true;
  }
  return false;
}
