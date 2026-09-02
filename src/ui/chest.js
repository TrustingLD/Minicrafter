// Panneau de coffre : 27 cases de stockage (3 lignes de 9 cases) + inventaire du joueur
// (sac à dos 27 cases + hotbar 9 cases) avec interaction clic / clic droit / Maj+clic / curseur flottant.

import { HOTBAR_SLOTS, TOTAL_SLOTS, MAX_STACK, addItem } from '../entities/inventory.js';
import { CHEST_SLOTS } from '../world/block-entities.js';
import { createBlockIcon3D } from './block-icon-3d.js';

export function createChestUI({ elements, iconCanvas, iconFaces3D, onClose, onInventoryChanged }) {
  const { panel, chestGrid, invGrid, hotbarGrid, cursorEl, closeBtn } = elements;

  let isOpen = false;
  let currentPos = null; // { x, y, z } du coffre ouvert
  let cursor = null; // objet "tenu" par la souris lors du drag/drop

  let lastState = null;
  let lastSlots = null;
  let lastSelectedIndex = 0;

  function fillItemCell(div, cell, size = 36) {
    div.innerHTML = '';
    if (!cell || !cell.item) return;
    const faces = iconFaces3D(cell.item);
    if (faces) {
      div.appendChild(createBlockIcon3D(faces, size));
    } else {
      const img = iconCanvas(cell.item);
      if (img) {
        const image = document.createElement('img');
        image.src = img.toDataURL();
        div.appendChild(image);
      } else {
        const ic = document.createElement('div');
        ic.className = 'ic';
        ic.style.background = '#dfc27b';
        div.appendChild(ic);
      }
    }
    if (cell.count > 1) {
      const label = document.createElement('div');
      label.className = 'cellCount';
      label.textContent = `x${cell.count}`;
      div.appendChild(label);
    }
  }

  let tracking = false;
  function onMouseMoveTrackCursor(ev) {
    if (cursorEl) {
      cursorEl.style.left = `${ev.clientX}px`;
      cursorEl.style.top = `${ev.clientY}px`;
    }
  }
  function startCursorTracking() {
    if (tracking) return;
    tracking = true;
    document.addEventListener('mousemove', onMouseMoveTrackCursor);
  }
  function stopCursorTracking() {
    tracking = false;
    document.removeEventListener('mousemove', onMouseMoveTrackCursor);
  }

  function renderCursor() {
    if (!cursorEl) return;
    if (!cursor) {
      cursorEl.style.display = 'none';
      return;
    }
    cursorEl.style.display = 'block';
    fillItemCell(cursorEl, cursor);
  }

  function pickupOrPlace(get, set, right) {
    const cell = get();
    if (!cursor) {
      if (!cell) return;
      if (right) {
        const take = Math.ceil(cell.count / 2);
        const rest = cell.count - take;
        cursor = { item: cell.item, count: take };
        set(rest > 0 ? { item: cell.item, count: rest } : null);
      } else {
        cursor = cell;
        set(null);
      }
      return;
    }
    if (!cell) {
      if (right) {
        set({ item: cursor.item, count: 1 });
        cursor.count -= 1;
        if (cursor.count <= 0) cursor = null;
      } else {
        set(cursor);
        cursor = null;
      }
      return;
    }
    if (cell.item === cursor.item) {
      if (right) {
        if (cell.count < MAX_STACK) {
          set({ item: cell.item, count: cell.count + 1 });
          cursor.count -= 1;
          if (cursor.count <= 0) cursor = null;
        }
      } else {
        const space = MAX_STACK - cell.count;
        const move = Math.min(space, cursor.count);
        if (move > 0) set({ item: cell.item, count: cell.count + move });
        cursor.count -= move;
        if (cursor.count <= 0) cursor = null;
      }
      return;
    }
    const prevCursor = cursor;
    cursor = cell;
    set(prevCursor);
  }

  function notifyChanged() {
    onInventoryChanged?.();
    renderAll();
  }

  function chestSlotClick(i, right, shift) {
    if (!lastState || !lastState.slots) return;
    const cell = lastState.slots[i];
    if (shift && cell && lastSlots) {
      // Transfert rapide (Maj+clic) du coffre vers l'inventaire du joueur
      const leftover = addItem(lastSlots, cell.item, cell.count);
      if (leftover <= 0) {
        lastState.slots[i] = null;
      } else {
        cell.count = leftover;
      }
      notifyChanged();
      return;
    }

    pickupOrPlace(
      () => lastState.slots[i],
      (v) => {
        lastState.slots[i] = v;
      },
      right,
    );
    notifyChanged();
  }

  function invSlotClick(i, right, shift) {
    const cell = lastSlots ? lastSlots[i] : null;
    if (shift && cell && lastState && lastState.slots) {
      // Transfert rapide (Maj+clic) de l'inventaire vers le coffre
      const leftover = addItem(lastState.slots, cell.item, cell.count);
      if (leftover <= 0) {
        lastSlots[i] = null;
      } else {
        cell.count = leftover;
      }
      notifyChanged();
      return;
    }
    pickupOrPlace(
      () => (lastSlots ? lastSlots[i] : null),
      (v) => {
        if (lastSlots) lastSlots[i] = v;
      },
      right,
    );
    notifyChanged();
  }

  function render(state, slots, selectedIndex) {
    lastState = state;
    lastSlots = slots;
    lastSelectedIndex = selectedIndex;
    renderAll();
  }

  function renderAll() {
    if (!lastState) return;

    // Grille du coffre (27 slots)
    if (chestGrid && lastState.slots) {
      chestGrid.innerHTML = '';
      for (let i = 0; i < CHEST_SLOTS; i++) {
        const cell = lastState.slots[i];
        const div = document.createElement('div');
        div.className = 'invItem' + (!cell ? ' empty' : '');
        fillItemCell(div, cell);
        div.addEventListener('click', (ev) => chestSlotClick(i, false, ev.shiftKey));
        div.addEventListener('contextmenu', (ev) => {
          ev.preventDefault();
          chestSlotClick(i, true, false);
        });
        chestGrid.appendChild(div);
      }
    }

    // Grille de sac à dos
    if (invGrid && lastSlots) {
      invGrid.innerHTML = '';
      for (let i = HOTBAR_SLOTS; i < TOTAL_SLOTS; i++) {
        const cell = lastSlots[i];
        const div = document.createElement('div');
        div.className = 'invItem' + (!cell ? ' empty' : '');
        fillItemCell(div, cell);
        div.addEventListener('click', (ev) => invSlotClick(i, false, ev.shiftKey));
        div.addEventListener('contextmenu', (ev) => {
          ev.preventDefault();
          invSlotClick(i, true, false);
        });
        invGrid.appendChild(div);
      }
    }

    // Grille de hotbar
    if (hotbarGrid && lastSlots) {
      hotbarGrid.innerHTML = '';
      for (let i = 0; i < HOTBAR_SLOTS; i++) {
        const cell = lastSlots[i];
        const div = document.createElement('div');
        div.className =
          'invItem' + (!cell ? ' empty' : '') + (i === lastSelectedIndex ? ' selected' : '');
        fillItemCell(div, cell);
        div.addEventListener('click', (ev) => invSlotClick(i, false, ev.shiftKey));
        div.addEventListener('contextmenu', (ev) => {
          ev.preventDefault();
          invSlotClick(i, true, false);
        });
        hotbarGrid.appendChild(div);
      }
    }

    renderCursor();
  }

  function flushToInventory(slots) {
    if (!slots || !cursor) return;
    addItem(slots, cursor.item, cursor.count);
    cursor = null;
  }

  function show(x, y, z) {
    isOpen = true;
    currentPos = { x, y, z };
    panel.style.display = 'flex';
    startCursorTracking();
  }

  function hide() {
    flushToInventory(lastSlots);
    isOpen = false;
    currentPos = null;
    panel.style.display = 'none';
    stopCursorTracking();
    renderCursor();
    onClose?.();
  }

  closeBtn.addEventListener('click', (ev) => {
    ev.preventDefault();
    ev.stopPropagation();
    hide();
  });

  return {
    show,
    hide,
    render,
    get isOpen() {
      return isOpen;
    },
    get currentPos() {
      return currentPos;
    },
  };
}
