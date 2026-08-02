// Barre d'objets (hotbar) : rendu DOM + sélection de slot.

export function createHotbarUI({ hotbarEl, HOTBAR, blockTypes, itemNames, iconCanvas, onSelect }) {
  let selectedIndex = 0;

  function render(inventory) {
    hotbarEl.innerHTML = '';
    HOTBAR.forEach((type, i) => {
      const count = inventory[type] || 0;
      const slot = document.createElement('div');
      slot.className =
        'slot' + (i === selectedIndex ? ' selected' : '') + (count === 0 ? ' empty' : '');
      const img = iconCanvas(type);
      const swatch = document.createElement('div');
      swatch.className = 'swatch';
      if (img) swatch.style.backgroundImage = `url(${img.toDataURL()})`;
      const key = document.createElement('span');
      key.className = 'key';
      key.textContent = i + 1;
      const cnt = document.createElement('span');
      cnt.className = 'count';
      cnt.textContent = count;
      slot.appendChild(key);
      slot.appendChild(swatch);
      slot.appendChild(cnt);
      slot.title = (blockTypes[type] && blockTypes[type].name) || itemNames[type] || type;
      slot.addEventListener('click', () => onSelect(i));
      hotbarEl.appendChild(slot);
    });
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
