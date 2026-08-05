// HUD (FPS / position / bloc visé / indice) — Phase 22, extrait de main.js.

export function createHud({ posEl, targetEl, hintEl, fpsEl }) {
  // Affichage FPS BRUT (Phase demandée : "les vrais FPS sans plafonnage").
  // Avant, une moyenne glissante (facteur 0.1, temps de convergence ~10 frames)
  // lissait la valeur affichée -- ça la rend plus lisible mais ça amortit aussi les
  // vraies variations (un pic à 144 FPS ou une chute à 15 FPS met plusieurs frames à
  // se refléter à l'écran, ce qui ressemble à un plafond alors qu'il n'y en a aucun
  // dans le calcul lui-même). On affiche maintenant directement 1/rawDt, sans aucun
  // lissage ni aucun plafond : c'est EXACTEMENT le FPS de la frame qui vient de
  // s'écouler. rawDt (et pas dt) reste utilisé : dt est plafonné à 0.05 pour la
  // physique (cf. main.js), ce qui bridait déjà l'affichage à ~20 FPS minimum avant
  // même d'ajouter le lissage.
  function updateFps(rawDt) {
    if (rawDt <= 0.001) return; // le tout premier rawDt (Clock fraîchement créé) peut être ~0
    fpsEl.textContent = `${Math.round(1 / rawDt)} FPS`;
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
