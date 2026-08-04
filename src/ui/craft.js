// Table de craft : inventaire (slots) + recettes (panneau modal).

import {
  HOTBAR_SLOTS,
  TOTAL_SLOTS,
  hasAtLeast,
  removeItem,
  addItem,
} from '../entities/inventory.js';

export function isNearCraftingTable(getBlock, playerPos) {
  const px = Math.round(playerPos.x),
    pz = Math.round(playerPos.z),
    py = Math.round(playerPos.y);
  for (let dx = -3; dx <= 3; dx++)
    for (let dz = -3; dz <= 3; dz++)
      for (let dy = -2; dy <= 2; dy++)
        if (getBlock(px + dx, py + dy, pz + dz) === 'crafting_table') return true;
  return false;
}

export function canCraft(slots, recipe) {
  return hasAtLeast(slots, recipe.need);
}

export function createCraftUI({
  elements,
  RECIPES,
  itemNames,
  iconCanvas,
  playSound,
  onCrafted,
  onSlotClick,
}) {
  const { craftPanel, invGrid, recipeList, craftTitle } = elements;

  function craft(slots, recipe, getBlock, playerPos) {
    if (!canCraft(slots, recipe)) return;
    if (recipe.needsTable && !isNearCraftingTable(getBlock, playerPos)) return;
    for (const k in recipe.need) removeItem(slots, k, recipe.need[k]);
    for (const k in recipe.give) addItem(slots, k, recipe.give[k]);
    playSound('craft');
    onCrafted();
  }

  // sac à dos (Phase 10) : les 27 emplacements après la hotbar. Cliquer une case
  // l'échange avec le slot hotbar actuellement sélectionné (moveSlot) — c'est ce
  // que "équiper depuis l'inventaire" veut dire avec des slots plutôt qu'un dictionnaire.
  function render(slots, getBlock, playerPos, selectedIndex) {
    invGrid.innerHTML = '';
    for (let i = HOTBAR_SLOTS; i < TOTAL_SLOTS; i++) {
      const cell = slots[i];
      const div = document.createElement('div');
      div.className = 'invItem' + (!cell ? ' empty' : '');
      if (cell) {
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
        const label = document.createElement('div');
        label.textContent = `${itemNames[cell.item] || cell.item} x${cell.count}`;
        div.appendChild(label);
        div.addEventListener('click', () => onSlotClick(i));
      }
      invGrid.appendChild(div);
    }

    const nearTable = isNearCraftingTable(getBlock, playerPos);
    craftTitle.textContent = nearTable ? 'Table de craft' : 'Inventaire (craft de base)';

    recipeList.innerHTML = '';
    RECIPES.forEach((r) => {
      if (r.needsTable && !nearTable) return; // hide advanced recipes unless near table
      const row = document.createElement('div');
      row.className = 'recipe';
      const needText = Object.entries(r.need)
        .map(([k, v]) => `${itemNames[k] || k} x${v}`)
        .join(', ');
      row.innerHTML = `<div><div class="rname">${r.name}</div><div class="rneed">Besoin: ${needText}</div></div>`;
      const btn = document.createElement('button');
      btn.textContent = 'Fabriquer';
      btn.disabled = !canCraft(slots, r);
      btn.addEventListener('click', () => {
        craft(slots, r, getBlock, playerPos);
        render(slots, getBlock, playerPos, selectedIndex);
      });
      row.appendChild(btn);
      recipeList.appendChild(row);
    });
    if (recipeList.children.length === 0) {
      recipeList.innerHTML =
        '<p style="opacity:0.7">Approche-toi d\'une table de craft pour débloquer plus de recettes.</p>';
    }
  }

  function show() {
    craftPanel.style.display = 'flex';
  }
  function hide() {
    craftPanel.style.display = 'none';
  }

  return { render, show, hide };
}
