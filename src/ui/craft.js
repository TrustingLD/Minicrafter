// Table de craft : inventaire + recettes (panneau modal).

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

export function canCraft(inventory, recipe) {
  for (const k in recipe.need) if ((inventory[k] || 0) < recipe.need[k]) return false;
  return true;
}

export function createCraftUI({ elements, RECIPES, itemNames, iconCanvas, playSound, onCrafted }) {
  const { craftPanel, invGrid, recipeList, craftTitle } = elements;

  function craft(inventory, recipe, getBlock, playerPos) {
    if (!canCraft(inventory, recipe)) return;
    if (recipe.needsTable && !isNearCraftingTable(getBlock, playerPos)) return;
    for (const k in recipe.need) inventory[k] -= recipe.need[k];
    for (const k in recipe.give) inventory[k] = (inventory[k] || 0) + recipe.give[k];
    playSound('craft');
    onCrafted();
  }

  function render(inventory, getBlock, playerPos) {
    invGrid.innerHTML = '';
    Object.keys(inventory).forEach((key) => {
      if (!inventory[key]) return;
      const div = document.createElement('div');
      div.className = 'invItem';
      const img = iconCanvas(key);
      if (img) {
        const image = document.createElement('img');
        image.src = img.toDataURL();
        div.appendChild(image);
      } else {
        const ic = document.createElement('div');
        ic.className = 'ic';
        ic.style.background = '#c9b27a';
        div.appendChild(ic);
      }
      const label = document.createElement('div');
      label.textContent = `${itemNames[key] || key} x${inventory[key]}`;
      div.appendChild(label);
      invGrid.appendChild(div);
    });

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
      btn.disabled = !canCraft(inventory, r);
      btn.addEventListener('click', () => {
        craft(inventory, r, getBlock, playerPos);
        render(inventory, getBlock, playerPos);
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
