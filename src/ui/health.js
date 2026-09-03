// Barre de vie (coeurs pleins/vides).

export function createHealthUI(healthEl) {
  function render(player) {
    healthEl.innerHTML = '';
    // 10 coeurs de base (20 PV) ; la pomme dorée pousse temporairement
    // maxHealth à 30 (cf. entities/player.js / main.js tryEat) -- les coeurs
    // au-delà des 10 premiers sont donc du bonus, affiché en jaune (.bonus).
    const totalHearts = Math.ceil((player.maxHealth ?? 20) / 2);
    const filledHearts = Math.ceil(player.health / 2);
    for (let i = 0; i < totalHearts; i++) {
      const h = document.createElement('div');
      const isBonus = i >= 10;
      h.className =
        'heart' + (isBonus ? ' bonus' : '') + (i < filledHearts ? '' : ' empty');
      healthEl.appendChild(h);
    }
  }
  return { render };
}
