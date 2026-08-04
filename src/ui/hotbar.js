// Barre d'objets (hotbar) : rendu DOM + sélection de slot. Phase 10 : la hotbar
// n'est plus une liste fixe de types, ce sont les 9 premiers emplacements de
// l'inventaire à slots (slots[0..HOTBAR_SLOTS-1]) — ce que le joueur y range lui
// appartient, comme dans n'importe quel jeu à inventaire.

import { HOTBAR_SLOTS } from '../entities/inventory.js';

export function createHotbarUI({ hotbarEl, blockTypes, itemNames, iconCanvas, onSelect }) {
  let selectedIndex = 0;

  function render(slots) {
    hotbarEl.innerHTML = '';
    for (let i = 0; i < HOTBAR_SLOTS; i++) {
      const cell = slots[i];
      const slot = document.createElement('div');
      slot.className = 'slot' + (i === selectedIndex ? ' selected' : '') + (!cell ? ' empty' : '');
      const img = cell ? iconCanvas(cell.item) : null;
      const swatch = document.createElement('div');
      swatch.className = 'swatch';
      if (img) swatch.style.backgroundImage = `url(${img.toDataURL()})`;
      const key = document.createElement('span');
      key.className = 'key';
      key.textContent = String(i + 1);
      const cnt = document.createElement('span');
      cnt.className = 'count';
      cnt.textContent = cell ? cell.count : '';
      slot.appendChild(key);
      slot.appendChild(swatch);
      slot.appendChild(cnt);
      slot.title = cell
        ? (blockTypes[cell.item] && blockTypes[cell.item].name) || itemNames[cell.item] || cell.item
        : '';
      slot.addEventListener('click', () => onSelect(i));
      hotbarEl.appendChild(slot);
    }
  }

  function setSelectedIndex(i) {
    selectedIndex = i;
  }

  function flashEmptySlot(i) {
    const slotEl = hotbarEl.children[i];
    if (!slotEl) return;
    slotEl.classList.add('flash');
    setTimeout(() => slotEl.classList.remove('flash'), 250);
  }

  return { render, setSelectedIndex, flashEmptySlot };
}
