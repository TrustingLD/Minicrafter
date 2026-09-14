// Table de craft : inventaire (slots) + grille de craft 3x3 façon Minecraft (Phase 18).
//
// La grille 3x3 (`grid`, 9 cases locales à ce module, PAS dans `slots`) et le
// "curseur" (`cursor`, l'objet actuellement "tenu" par la souris) sont l'état
// propre à ce panneau : ni l'un ni l'autre ne fait partie de l'inventaire tant
// qu'ils n'y sont pas replacés (à la fermeture du panneau, cf. flushToInventory).
// L'interaction suit le patron classique de Minecraft : clic gauche = ramasser/
// poser/fusionner toute la pile, clic droit = ramasser la moitié / poser une
// seule unité -- c'est ce qui permet de répartir une pile de planches sur
// plusieurs cases de la grille sans avoir à casser l'inventaire en piles de 1
// au préalable. La correspondance forme/recette est déléguée à data/crafting.js
// (pur, testable, aucun DOM).

import { HOTBAR_SLOTS, TOTAL_SLOTS, MAX_STACK, addItem } from '../entities/inventory.js';
import { matchRecipe, consumeForRecipe } from '../data/crafting.js';
import { createBlockIcon3D } from './block-icon-3d.js';

const GRID_CELLS = 9;

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

export function createCraftUI({
  elements,
  RECIPES,
  itemNames,
  iconCanvas,
  iconFaces3D,
  playSound,
  armorItems,
  onCrafted,
  onSlotClick,
  onHotbarSlotClick,
}) {
  const {
    craftPanel,
    invGrid,
    hotbarGrid,
    armorSlotEls,
    craftTitle,
    craftGridEls, // tableau de 9 <div> (cases de la grille de craft)
    craftOutputEl, // <div> unique (résultat)
    cursorEl, // <div> flottant qui suit la souris (objet "tenu")
    recipeList, // panneau de référence (formes des recettes), optionnel
  } = elements;

  // grille de craft 3x3 : null | { item, count }, index = row*3 + col.
  const grid = new Array(GRID_CELLS).fill(null);
  // objet "tenu" par la souris, entre deux clics -- comme le curseur d'inventaire
  // de Minecraft. null = rien en main.
  let cursor = null;

  let lastSlots = null,
    lastGetBlock = null,
    lastPlayerPos = null,
    lastSelectedIndex = 0,
    lastArmorSlots = null;

  // remplit une case (armure/sac à dos/hotbar-dans-le-panneau/grille de craft)
  // avec l'icône de `cell` — mutualisé pour que toutes les grilles aient le même
  // rendu. `size` : taille du cube CSS 3D en px, plus petit pour les miniatures
  // du panneau de référence (recipeShapeCell, cases de 16px) que pour les vraies
  // cases cliquables (36px).
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

  // objet "tenu" (cursor) qui suit la souris tant que l'inventaire est ouvert,
  // comme dans l'inventaire de Minecraft. La rotation "tête vers le curseur" de
  // l'avatar, elle, est désormais gérée en 3D par ui/char-preview.js (le même
  // avatar que l'avatar en jeu, cf. entities/player-model.js) -- ce module ne
  // s'occupe plus que du curseur flottant.
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

  // Interaction générique "ramasser/poser/fusionner/échanger", utilisée par
  // TOUTES les grilles cliquables (sac à dos, hotbar dupliquée, grille de craft) :
  // c'est le même geste partout, seule la case concernée (get/set) change.
  // `right` = clic droit (ramasse la moitié / pose une seule unité, pour
  // répartir une pile sur plusieurs cases sans devoir la casser à la main).
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
    // objets différents : échange complet (même au clic droit -- poser "une
    // seule unité" d'un objet différent par-dessus un autre n'a pas de sens ici).
    const prevCursor = cursor;
    cursor = cell;
    set(prevCursor);
  }

  function nearTableNow() {
    return lastGetBlock && lastPlayerPos
      ? isNearCraftingTable(lastGetBlock, lastPlayerPos)
      : false;
  }

  function currentMatch() {
    return matchRecipe(grid, RECIPES, nearTableNow());
  }

  function craftGridCellClick(i, right) {
    // Contrairement à Minecraft, la grille 3x3 reste TOUJOURS entièrement
    // utilisable, même sans table à proximité : c'est chaque recette (le flag
    // `needsTable`) qui décide si elle peut matcher, pas la taille de la
    // grille. Simplification volontaire -- certaines recettes sans table
    // (le fourneau : anneau de 8 pierres) utilisent la grille entière, donc la
    // restreindre à un coin 2x2 les aurait rendues impossibles à fabriquer.
    pickupOrPlace(
      () => grid[i],
      (v) => (grid[i] = v),
      right,
    );
    renderAll();
  }

  function craftOutputClick() {
    const recipe = currentMatch();
    if (!recipe) return;
    const [giveItem, giveCount] = Object.entries(recipe.give)[0];
    if (cursor && cursor.item !== giveItem) return; // curseur incompatible : rien à faire
    if (cursor && cursor.count + giveCount > MAX_STACK) return; // pile pleine
    consumeForRecipe(grid, recipe);
    if (cursor) cursor.count += giveCount;
    else cursor = { item: giveItem, count: giveCount };
    playSound('craft');
    onCrafted();
    renderAll();
  }

  // Emplacements d'armure (casque/plastron/jambières/bottes) : même geste
  // "curseur" que le reste des grilles -- clic pour ramasser/poser/échanger,
  // clic droit pour une unité (armorItems : items.js ARMOR_ITEMS, item -> {slot}).
  // Seule restriction : on refuse de POSER un objet qui n'est pas la pièce
  // d'armure attendue pour ce slot (un casque ne rentre pas dans "bottes") --
  // le RETRAIT (poser le curseur vide, ou ramasser ce qui est déjà équipé)
  // n'est lui jamais bloqué.
  function armorSlotClick(i, right) {
    if (cursor && (!armorItems[cursor.item] || armorItems[cursor.item].slot !== i)) return;
    pickupOrPlace(
      () => lastArmorSlots[i],
      (v) => (lastArmorSlots[i] = v),
      right,
    );
    onCrafted(); // même signal que craftOutputClick : prévient main.js (bus 'inventory:changed')
    renderAll();
  }

  // à la fermeture du panneau : on ne veut JAMAIS perdre les objets posés dans
  // la grille ou tenus par le curseur -- tout repart dans l'inventaire (sac à
  // dos, puis hotbar si besoin, via addItem). L'armure ÉQUIPÉE (armorSlots),
  // elle, reste sciemment en place -- fermer l'inventaire ne déshabille pas
  // le joueur, exactement comme dans Minecraft.
  function flushToInventory(slots) {
    if (!slots) return;
    for (let i = 0; i < GRID_CELLS; i++) {
      const cell = grid[i];
      if (cell) addItem(slots, cell.item, cell.count);
      grid[i] = null;
    }
    if (cursor) {
      addItem(slots, cursor.item, cursor.count);
      cursor = null;
    }
  }

  // représentation 3x3 (avec cases vides) d'une recette, pour le panneau de
  // référence -- shapeless -> un unique objet centré ; pattern -> tel quel,
  // recadré/complété à 3x3 pour un rendu visuel homogène entre recettes.
  function recipeCells(r) {
    const out = new Array(9).fill(null).map(() => ({ item: null }));
    if (r.shapeless) {
      const [item] = Object.keys(r.shapeless);
      out[4] = { item };
      return out;
    }
    const rows = r.pattern.length,
      cols = r.pattern[0].length;
    const offR = Math.floor((3 - rows) / 2),
      offC = Math.floor((3 - cols) / 2);
    for (let rr = 0; rr < rows; rr++)
      for (let cc = 0; cc < cols; cc++) {
        const ch = r.pattern[rr][cc];
        const item = r.key[ch] ?? null;
        out[(offR + rr) * 3 + (offC + cc)] = { item };
      }
    return out;
  }

  function render(slots, getBlock, playerPos, selectedIndex, armorSlots) {
    lastSlots = slots;
    lastGetBlock = getBlock;
    lastPlayerPos = playerPos;
    lastSelectedIndex = selectedIndex;
    lastArmorSlots = armorSlots;
    renderAll();
  }

  function renderAll() {
    const slots = lastSlots,
      getBlock = lastGetBlock,
      playerPos = lastPlayerPos,
      selectedIndex = lastSelectedIndex,
      armorSlots = lastArmorSlots;
    if (!slots || !getBlock || !playerPos) return;

    // sac à dos (Phase 10) : les 27 emplacements après la hotbar.
    invGrid.innerHTML = '';
    for (let i = HOTBAR_SLOTS; i < TOTAL_SLOTS; i++) {
      const cell = slots[i];
      const div = document.createElement('div');
      div.className = 'invItem' + (!cell ? ' empty' : '');
      fillItemCell(div, cell);
      div.addEventListener('click', () => {
        pickupOrPlace(
          () => slots[i],
          (v) => (slots[i] = v),
          false,
        );
        onInventoryChanged();
      });
      div.addEventListener('contextmenu', (ev) => {
        ev.preventDefault();
        pickupOrPlace(
          () => slots[i],
          (v) => (slots[i] = v),
          true,
        );
        onInventoryChanged();
      });
      invGrid.appendChild(div);
    }

    // hotbar dupliquée dans le panneau (comme dans l'inventaire de Minecraft) :
    // cliquer change la sélection -- SAUF si on tient déjà un objet (cursor),
    // auquel cas un clic pose/échange, comme n'importe quelle autre case.
    if (hotbarGrid) {
      hotbarGrid.innerHTML = '';
      for (let i = 0; i < HOTBAR_SLOTS; i++) {
        const cell = slots[i];
        const div = document.createElement('div');
        div.className =
          'invItem' + (!cell ? ' empty' : '') + (i === selectedIndex ? ' selected' : '');
        fillItemCell(div, cell);
        div.addEventListener('click', () => {
          if (cursor) {
            pickupOrPlace(
              () => slots[i],
              (v) => (slots[i] = v),
              false,
            );
            onInventoryChanged();
          } else if (onHotbarSlotClick) {
            onHotbarSlotClick(i);
          }
        });
        div.addEventListener('contextmenu', (ev) => {
          ev.preventDefault();
          pickupOrPlace(
            () => slots[i],
            (v) => (slots[i] = v),
            true,
          );
          onInventoryChanged();
        });
        hotbarGrid.appendChild(div);
      }
    }

    // 4 cases d'armure (casque/plastron/jambières/bottes).
    if (armorSlotEls && armorSlots) {
      armorSlotEls.forEach((el, i) => {
        const cell = armorSlots[i];
        el.classList.toggle('filled', !!cell);
        if (cell) fillItemCell(el, cell);
        else el.innerHTML = el.dataset.placeholder || '';
      });
    }

    const nearTable = isNearCraftingTable(getBlock, playerPos);
    craftTitle.textContent = nearTable ? 'Table de craft (3x3)' : 'Inventaire (craft rapide)';

    // grille de craft 3x3 (toujours entièrement utilisable, cf. craftGridCellClick).
    if (craftGridEls) {
      craftGridEls.forEach((el, i) => {
        const cell = grid[i];
        el.classList.toggle('empty', !cell);
        fillItemCell(el, cell);
      });
    }

    // case de résultat.
    if (craftOutputEl) {
      const recipe = matchRecipe(grid, RECIPES, nearTable);
      craftOutputEl.classList.toggle('empty', !recipe);
      craftOutputEl.classList.toggle('craftable', !!recipe);
      craftOutputEl.innerHTML = '';
      if (recipe) {
        const [giveItem, giveCount] = Object.entries(recipe.give)[0];
        fillItemCell(craftOutputEl, { item: giveItem, count: giveCount });
      }
    }

    // panneau de référence : la forme de chaque recette connue, pour que le
    // joueur sache quoi reproduire dans la grille (le craft se fait uniquement
    // en remplissant la vraie grille -- ceci n'est qu'un aide-mémoire, pas un
    // bouton "Fabriquer" en un clic).
    if (recipeList) {
      recipeList.innerHTML = '';
      RECIPES.forEach((r) => {
        if (r.needsTable && !nearTable) return;
        const row = document.createElement('div');
        row.className = 'recipe';
        const [, giveCount] = Object.entries(r.give)[0];
        const nameEl = document.createElement('div');
        nameEl.className = 'rname';
        nameEl.textContent = `${r.name} (x${giveCount})`;
        const shapeEl = document.createElement('div');
        shapeEl.className = 'recipeShape';
        recipeCells(r).forEach(({ item }) => {
          const c = document.createElement('div');
          c.className = 'recipeShapeCell' + (item ? '' : ' empty');
          if (item) fillItemCell(c, { item, count: 1 }, 14);
          shapeEl.appendChild(c);
        });
        row.appendChild(nameEl);
        row.appendChild(shapeEl);
        recipeList.appendChild(row);
      });
      if (recipeList.children.length === 0) {
        recipeList.innerHTML =
          '<p style="opacity:0.7">Approche-toi d\'une table de craft pour débloquer plus de recettes.</p>';
      }
    }

    renderCursor();
  }

  // un clic dans le sac à dos / la hotbar a changé l'inventaire : prévenir
  // main.js (rafraîchit l'objet en main, la hotbar affichée, etc.) puis
  // redessiner ce panneau. -1 = signal générique, pas un index de case.
  function onInventoryChanged() {
    onSlotClick && onSlotClick(-1);
    renderAll();
  }

  // écouteurs de la grille de craft + de la case de résultat, posés une seule
  // fois (les éléments sont statiques dans le DOM, seul leur contenu change).
  if (craftGridEls) {
    craftGridEls.forEach((el, i) => {
      el.addEventListener('click', () => craftGridCellClick(i, false));
      el.addEventListener('contextmenu', (ev) => {
        ev.preventDefault();
        craftGridCellClick(i, true);
      });
    });
  }
  if (craftOutputEl) {
    craftOutputEl.addEventListener('click', () => craftOutputClick());
    craftOutputEl.addEventListener('contextmenu', (ev) => {
      ev.preventDefault();
      craftOutputClick();
    });
  }

  // écouteurs des 4 cases d'armure : même patron clic gauche/droit que la grille
  // de craft (armorSlotClick, cf. plus haut) -- posés une seule fois (les
  // éléments sont statiques dans le DOM, seul leur contenu change à chaque render()).
  if (armorSlotEls) {
    armorSlotEls.forEach((el, i) => {
      el.dataset.placeholder = el.innerHTML; // pictogramme d'origine, pour le ré-afficher quand la case se vide
      el.addEventListener('click', () => armorSlotClick(i, false));
      el.addEventListener('contextmenu', (ev) => {
        ev.preventDefault();
        armorSlotClick(i, true);
      });
    });
  }

  function show() {
    craftPanel.style.display = 'flex';
    startCursorTracking();
  }
  function hide() {
    // tout ce qui traîne dans la grille de craft ou sous le curseur retourne
    // dans l'inventaire -- jamais d'objet perdu en fermant le panneau. On ne
    // sait pas d'avance s'il y avait quelque chose à récupérer, donc on
    // prévient systématiquement (même signal que onCrafted -- bus:inventory
    // côté main.js -- pour que la hotbar affichée reflète le retour éventuel).
    flushToInventory(lastSlots);
    onCrafted && onCrafted();
    craftPanel.style.display = 'none';
    stopCursorTracking();
    renderCursor();
  }

  return { render, show, hide };
}
