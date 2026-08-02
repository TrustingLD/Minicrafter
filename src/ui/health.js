// Barre de vie (coeurs pleins/vides).

export function createHealthUI(healthEl) {
  function render(player) {
    healthEl.innerHTML = '';
    for (let i = 0; i < 10; i++) {
      const h = document.createElement('div');
      h.className = 'heart' + (i < Math.ceil(player.health / 2) ? '' : ' empty');
      healthEl.appendChild(h);
    }
  }
  return { render };
}
