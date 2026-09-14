// Panneau fourneau (Phase 14 + Amélioration UX) : 3 cases (entrée / combustible / sortie),
// jauges de progression et de flamme, et intégration complète de l'inventaire du joueur
// (sac à dos + hotbar) avec interaction clic / clic droit / Maj+clic / curseur flottant.

import { HOTBAR_SLOTS, TOTAL_SLOTS, MAX_STACK, addItem } from '../entities/inventory.js';
import { createBlockIcon3D } from './block-icon-3d.js';

export function createFurnaceUI({
  elements,
  iconCanvas,
  iconFaces3D,
  SMELTING,
  FUELS,
  onClose,
  onInventoryChanged,
}) {
  const {
    panel,
    inputSlot,
    fuelSlot,
    outputSlot,
    progressFill,
    flameFill,
    invGrid,
    hotbarGrid,
    cursorEl,
    closeBtn,
  } = elements;

  let isOpen = false;
  let currentPos = null; // { x, y, z } du fourneau ouvert
  let cursor = null; // objet "tenu" par la souris lors du drag/drop

  let lastState = null;
  let lastBurnBudget = 1;
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

  function slotClick(get, set, right, shift, filter) {
    const cell = get();
    if (filter && cursor && !filter(cursor.item)) return;
    pickupOrPlace(get, set, right);
    notifyChanged();
  }

  function invSlotClick(i, right, shift) {
    const cell = lastSlots ? lastSlots[i] : null;
    if (shift && cell && lastState) {
      // Transfert rapide (Maj+clic) vers le fourneau
      if (SMELTING[cell.item]) {
        const target = lastState.input;
        if (!target) {
          lastState.input = { item: cell.item, count: cell.count };
          lastSlots[i] = null;
        } else if (target.item === cell.item && target.count < MAX_STACK) {
          const move = Math.min(MAX_STACK - target.count, cell.count);
          target.count += move;
          cell.count -= move;
          if (cell.count <= 0) lastSlots[i] = null;
        }
        notifyChanged();
        return;
      }
      if (FUELS[cell.item]) {
        const target = lastState.fuel;
        if (!target) {
          lastState.fuel = { item: cell.item, count: cell.count };
          lastSlots[i] = null;
        } else if (target.item === cell.item && target.count < MAX_STACK) {
          const move = Math.min(MAX_STACK - target.count, cell.count);
          target.count += move;
          cell.count -= move;
          if (cell.count <= 0) lastSlots[i] = null;
        }
        notifyChanged();
        return;
      }
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

  function outputSlotClick(shift) {
    if (!lastState || !lastState.output) return;
    if (shift && lastSlots) {
      const leftover = addItem(lastSlots, lastState.output.item, lastState.output.count);
      lastState.output.count = leftover;
      if (leftover <= 0) lastState.output = null;
    } else {
      if (!cursor) {
        cursor = lastState.output;
        lastState.output = null;
      } else if (cursor.item === lastState.output.item && cursor.count < MAX_STACK) {
        const move = Math.min(MAX_STACK - cursor.count, lastState.output.count);
        cursor.count += move;
        lastState.output.count -= move;
        if (lastState.output.count <= 0) lastState.output = null;
      }
    }
    notifyChanged();
  }

  function render(state, burnBudget, slots, selectedIndex) {
    lastState = state;
    lastBurnBudget = burnBudget;
    lastSlots = slots;
    lastSelectedIndex = selectedIndex;
    renderAll();
  }

  function renderAll() {
    if (!lastState) return;

    fillItemCell(inputSlot, lastState.input);
    inputSlot.classList.toggle('empty', !lastState.input);

    fillItemCell(fuelSlot, lastState.fuel);
    fuelSlot.classList.toggle('empty', !lastState.fuel);

    fillItemCell(outputSlot, lastState.output);
    outputSlot.classList.toggle('empty', !lastState.output);

    const smeltPct = Math.min(100, (lastState.smeltProgress / 5) * 100);
    progressFill.style.width = `${smeltPct}%`;
    const flamePct =
      lastBurnBudget > 0 ? Math.min(100, (lastState.burnRemaining / lastBurnBudget) * 100) : 0;
    flameFill.style.height = `${flamePct}%`;

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

  inputSlot.addEventListener('click', (ev) =>
    slotClick(
      () => lastState?.input,
      (v) => {
        if (lastState) lastState.input = v;
      },
      false,
      ev.shiftKey,
      (item) => !!SMELTING[item],
    ),
  );
  inputSlot.addEventListener('contextmenu', (ev) => {
    ev.preventDefault();
    slotClick(
      () => lastState?.input,
      (v) => {
        if (lastState) lastState.input = v;
      },
      true,
      false,
      (item) => !!SMELTING[item],
    );
  });

  fuelSlot.addEventListener('click', (ev) =>
    slotClick(
      () => lastState?.fuel,
      (v) => {
        if (lastState) lastState.fuel = v;
      },
      false,
      ev.shiftKey,
      (item) => !!FUELS[item],
    ),
  );
  fuelSlot.addEventListener('contextmenu', (ev) => {
    ev.preventDefault();
    slotClick(
      () => lastState?.fuel,
      (v) => {
        if (lastState) lastState.fuel = v;
      },
      true,
      false,
      (item) => !!FUELS[item],
    );
  });

  outputSlot.addEventListener('click', (ev) => outputSlotClick(ev.shiftKey));
  outputSlot.addEventListener('contextmenu', (ev) => {
    ev.preventDefault();
    outputSlotClick(false);
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
