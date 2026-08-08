// Table de craft : inventaire (slots) + recettes (panneau modal).

import {
  HOTBAR_SLOTS,
  TOTAL_SLOTS,
  hasAtLeast,
  removeItem,
  addItem,
} from '../entities/inventory.js';
import { createBlockIcon3D } from './block-icon-3d.js';

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
  iconFaces3D,
  playSound,
  onCrafted,
  onSlotClick,
  onHotbarSlotClick,
  onArmorSlotClick,
}) {
  const { craftPanel, invGrid, hotbarGrid, armorSlotEls, charHead, craftTitle } = elements;

  // remplit une case (armure/sac à dos/hotbar-dans-le-panneau) avec l'icône de
  // `cell` — mutualisé pour que les 3 grilles aient le même rendu.
  function fillItemCell(div, cell) {
    div.innerHTML = '';
    if (!cell) return;
    const faces = iconFaces3D(cell.item);
    if (faces) {
      div.appendChild(createBlockIcon3D(faces, 36));
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
      label.textContent = `x${cell.count}`;
      div.appendChild(label);
    }
  }

  // la tête du personnage tourne vers le curseur tant que l'inventaire est
  // ouvert (cf. #charDoll / .charHead dans style.css). On limite l'amplitude
  // pour que ça reste crédible (pas de tête à 360°).
  const MAX_TURN_Y = 35; // degrés, gauche/droite
  const MAX_TURN_X = 20; // degrés, haut/bas
  let trackingHead = false;
  function onMouseMoveTrackHead(ev) {
    if (!charHead) return;
    const rect = charHead.parentElement.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height * 0.35;
    const dx = ev.clientX - cx;
    const dy = ev.clientY - cy;
    const turnY = Math.max(-MAX_TURN_Y, Math.min(MAX_TURN_Y, (dx / rect.width) * 90));
    const turnX = Math.max(-MAX_TURN_X, Math.min(MAX_TURN_X, -(dy / rect.height) * 60));
    charHead.style.transform = `rotateY(${turnY}deg) rotateX(${turnX}deg)`;
  }
  function startHeadTracking() {
    if (trackingHead) return;
    trackingHead = true;
    document.addEventListener('mousemove', onMouseMoveTrackHead);
  }
  function stopHeadTracking() {
    trackingHead = false;
    document.removeEventListener('mousemove', onMouseMoveTrackHead);
  }

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
  function render(slots, getBlock, playerPos, selectedIndex, armorSlots) {
    invGrid.innerHTML = '';
    for (let i = HOTBAR_SLOTS; i < TOTAL_SLOTS; i++) {
      const cell = slots[i];
      const div = document.createElement('div');
      div.className = 'invItem' + (!cell ? ' empty' : '');
      if (cell) {
        // vrai bloc (cf. iconFaces3D) -> petit cube 3D CSS, sinon icône plate 2D
        const faces = iconFaces3D(cell.item);
        if (faces) {
          div.appendChild(createBlockIcon3D(faces, 36));
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
        const label = document.createElement('div');
        label.textContent = `${itemNames[cell.item] || cell.item} x${cell.count}`;
        div.appendChild(label);
        div.addEventListener('click', () => onSlotClick(i));
      }
      invGrid.appendChild(div);
    }

    // hotbar dupliquée dans le panneau (comme dans l'inventaire de Minecraft) :
    // même contenu que la hotbar toujours affichée en bas de l'écran, cliquable
    // pour changer la sélection sans fermer l'inventaire.
    if (hotbarGrid) {
      hotbarGrid.innerHTML = '';
      for (let i = 0; i < HOTBAR_SLOTS; i++) {
        const cell = slots[i];
        const div = document.createElement('div');
        div.className = 'invItem' + (!cell ? ' empty' : '') + (i === selectedIndex ? ' selected' : '');
        fillItemCell(div, cell);
        div.addEventListener('click', () => onHotbarSlotClick && onHotbarSlotClick(i));
        hotbarGrid.appendChild(div);
      }
    }

    // 4 cases d'armure (casque/plastron/jambières/bottes) : cliquer échange
    // avec le slot hotbar actuellement sélectionné, comme le sac à dos.
    if (armorSlotEls && armorSlots) {
      armorSlotEls.forEach((el, i) => {
        const cell = armorSlots[i];
        el.classList.toggle('filled', !!cell);
        if (cell) {
          fillItemCell(el, cell);
        } else {
          // pas de pièce équipée -> ré-affiche le pictogramme d'emplacement d'origine
          el.innerHTML = el.dataset.placeholder || '';
        }
      });
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

  // écouteurs des 4 cases d'armure : posés une seule fois (les éléments sont
  // statiques dans le DOM, seul leur contenu change à chaque render()).
  if (armorSlotEls && onArmorSlotClick) {
    armorSlotEls.forEach((el, i) => {
      el.dataset.placeholder = el.innerHTML; // pictogramme d'origine, pour le ré-afficher quand la case se vide
      el.addEventListener('click', () => onArmorSlotClick(i));
    });
  }

  function show() {
    craftPanel.style.display = 'flex';
    startHeadTracking();
  }
  function hide() {
    craftPanel.style.display = 'none';
    stopHeadTracking();
  }

  return { render, show, hide };
}
