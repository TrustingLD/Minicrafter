// Barre de faim (pilons pleins/vides, même forme que health.js) + barre de bulles
// d'air (Phase 11, uniquement affichée sous l'eau). Deux jauges "ressource qui se
// vide avec le temps", donc un seul petit fichier plutôt que deux quasi-identiques.

export function createHungerUI(hungerEl) {
  function render(player) {
    hungerEl.innerHTML = '';
    for (let i = 0; i < 10; i++) {
      const d = document.createElement('div');
      d.className = 'drumstick' + (i < Math.ceil(player.hunger / 2) ? '' : ' empty');
      hungerEl.appendChild(d);
    }
  }
  return { render };
}

export function createBreathUI(breathEl) {
  function render(player) {
    // masquée tant qu'on n'est pas en train de suffoquer/reprendre son souffle —
    // pas de bulles à l'écran en permanence sur la terre ferme
    if (player.breath >= player.maxBreath) {
      breathEl.style.display = 'none';
      return;
    }
    breathEl.style.display = 'flex';
    breathEl.innerHTML = '';
    const bubbles = Math.ceil((player.breath / player.maxBreath) * 10);
    for (let i = 0; i < 10; i++) {
      const b = document.createElement('div');
      b.className = 'bubble' + (i < bubbles ? '' : ' empty');
      breathEl.appendChild(b);
    }
  }
  return { render };
}
