// Panneau fourneau (Phase 14) : 3 cases (entrée / combustible / sortie) + une jauge
// de progression + une jauge de flamme. Pas de glisser-déposer : cliquer la case
// entrée/combustible y transfère l'objet actuellement sélectionné dans la hotbar
// (jusqu'à une pile), cliquer la sortie récupère tout ce qu'elle contient — le
// "click-to-move" que PLAN.md juge suffisant pour cette phase.

export function createFurnaceUI({ elements, iconCanvas, onClose }) {
  const { panel, inputSlot, fuelSlot, outputSlot, progressFill, flameFill, closeBtn } = elements;
  let isOpen = false;
  let currentPos = null; // { x, y, z } du fourneau ouvert

  function renderSlot(el, cell) {
    el.innerHTML = '';
    if (!cell) {
      el.classList.add('empty');
      return;
    }
    el.classList.remove('empty');
    const img = iconCanvas(cell.item);
    if (img) {
      const image = document.createElement('img');
      image.src = img.toDataURL();
      el.appendChild(image);
    }
    const count = document.createElement('span');
    count.className = 'fCount';
    count.textContent = cell.count;
    el.appendChild(count);
  }

  // `state` vient de world/block-entities.js ; `burnBudget` est le combustible max
  // du dernier item brûlé (pour normaliser la jauge de flamme entre 0 et 1).
  function render(state, burnBudget) {
    renderSlot(inputSlot, state.input);
    renderSlot(fuelSlot, state.fuel);
    renderSlot(outputSlot, state.output);
    const smeltPct = Math.min(100, (state.smeltProgress / 5) * 100);
    progressFill.style.width = `${smeltPct}%`;
    const flamePct = burnBudget > 0 ? Math.min(100, (state.burnRemaining / burnBudget) * 100) : 0;
    flameFill.style.height = `${flamePct}%`;
  }

  function open(x, y, z) {
    isOpen = true;
    currentPos = { x, y, z };
    panel.style.display = 'flex';
  }
  function close() {
    isOpen = false;
    currentPos = null;
    panel.style.display = 'none';
    onClose?.();
  }

  closeBtn.addEventListener('click', close);
  inputSlot.addEventListener('click', () => handlers.onInputClick?.());
  fuelSlot.addEventListener('click', () => handlers.onFuelClick?.());
  outputSlot.addEventListener('click', () => handlers.onOutputClick?.());

  const handlers = {};
  function setHandlers(h) {
    Object.assign(handlers, h);
  }

  return {
    open,
    close,
    render,
    setHandlers,
    get isOpen() {
      return isOpen;
    },
    get currentPos() {
      return currentPos;
    },
  };
}
