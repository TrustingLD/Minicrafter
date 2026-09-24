// Choix du pack de textures (Phase 37) : bureau ET atlas.js/block-assets.js passent par ICI
// plutôt que d'importer render/textures.js directement, pour que le réglage des options
// (menu Options -> Textures) s'applique partout d'un coup. `localStorage` est lu une seule
// fois, AU CHARGEMENT DU MODULE (donc au démarrage de la page) : changer le réglage prend
// effet après un rechargement, pas en direct -- l'atlas de blocs est construit une seule
// fois au boot (cf. world/world.js) et le rebâtir à chaud impliquerait de reconstruire tous
// les chunks déjà maillés. Un simple rechargement est plus simple et sans risque ; c'est
// setTextureStyle() (appelée par ui/options.js) qui le déclenche.

import * as base from './textures.js';
import * as pixel16 from './textures-16.js';

export const TEXTURE_STYLE_KEY = 'mc_texture_style';
export const TEXTURE_STYLES = {
  base: 'Textures de base',
  pixel16: 'Textures 16x16 (pixel art)',
};

export function getTextureStyle() {
  const v = localStorage.getItem(TEXTURE_STYLE_KEY);
  return v === 'pixel16' ? 'pixel16' : 'base';
}

// Change le réglage puis recharge la page (cf. le commentaire ci-dessus : indispensable pour
// reconstruire l'atlas et tous les chunks avec le nouveau pack).
export function setTextureStyle(style) {
  localStorage.setItem(TEXTURE_STYLE_KEY, style === 'pixel16' ? 'pixel16' : 'base');
  location.reload();
}

// Fusion : le pack 16x16 ne couvre QUE les 49 faces de bloc (cf. textures-16.js) -- tout le
// reste (outils, nourriture, mobs, armures, états on/off) retombe sur `base` automatiquement,
// qu'on soit en mode 'base' ou 'pixel16'.
export const tex = getTextureStyle() === 'pixel16' ? { ...base, ...pixel16 } : base;
