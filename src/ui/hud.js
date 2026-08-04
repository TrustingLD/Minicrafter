// HUD (FPS / position / bloc visé / indice) — Phase 22, extrait de main.js.

export function createHud({ posEl, targetEl, hintEl, fpsEl }) {
  let fpsSmoothed = 60;

  // rawDt (non plafonné) et pas dt : dt est plafonné à 0.05 pour que le mouvement ne
  // saute pas après un lag, mais ça implique que 1/dt ne peut jamais afficher moins de
  // ~20 FPS -- précisément quand on a besoin de voir le vrai chiffre (chargement de chunks).
  function updateFps(rawDt) {
    if (rawDt <= 0.001) return; // le tout premier rawDt (Clock fraîchement créé) peut être ~0
    fpsSmoothed += (1 / rawDt - fpsSmoothed) * 0.1;
    fpsEl.textContent = `${Math.round(fpsSmoothed)} FPS`;
  }

  function updatePos(pos) {
    posEl.textContent = `${pos.x.toFixed(1)}, ${pos.y.toFixed(1)}, ${pos.z.toFixed(1)}`;
  }

  function updateTarget({ mobHit, blockHit, getBlock, blockTypes }) {
    if (mobHit && (!blockHit || mobHit.dist < blockHit.dist)) {
      targetEl.textContent = `${mobHit.mob.data.name} (${mobHit.mob.health}/${mobHit.mob.maxHealth} PV)`;
      hintEl.style.display = 'none';
    } else if (blockHit) {
      const t = getBlock(blockHit.block.x, blockHit.block.y, blockHit.block.z);
      targetEl.textContent = `${blockTypes[t]?.name || '?'} (${blockHit.block.x}, ${blockHit.block.y}, ${blockHit.block.z})`;
      hintEl.style.display = t === 'crafting_table' || t === 'furnace' ? 'block' : 'none';
    } else {
      targetEl.textContent = '-';
      hintEl.style.display = 'none';
    }
  }

  return { updateFps, updatePos, updateTarget };
}
