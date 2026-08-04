// Textures procédurales (façon pixel-art voxel) : blocs, outils, mobs, nourriture.
// Chaque fonction dessine sur un petit canvas et retourne une THREE.CanvasTexture.

import * as THREE from 'three';
import { mulberry32 } from '../core/math.js';

export const TEX_SIZE = 32; // texture fine pour plus de détail

export function newCanvas() {
  const c = document.createElement('canvas');
  c.width = TEX_SIZE;
  c.height = TEX_SIZE;
  return c;
}

// speckle : pose des points de bruit de 1 ou 2px pour casser la platitude des couleurs
export function speckle(ctx, colors, count, maxSize) {
  maxSize = maxSize || 1;
  for (let i = 0; i < count; i++) {
    ctx.fillStyle = colors[Math.floor(Math.random() * colors.length)];
    const s = 1 + Math.floor(Math.random() * maxSize);
    ctx.fillRect(Math.floor(Math.random() * TEX_SIZE), Math.floor(Math.random() * TEX_SIZE), s, s);
  }
}

// blotch : taches organiques plus grosses (touffes d'herbe, feuillage, mottes de terre...)
export function blotches(ctx, colors, count, minR, maxR) {
  for (let i = 0; i < count; i++) {
    ctx.fillStyle = colors[Math.floor(Math.random() * colors.length)];
    const r = minR + Math.random() * (maxR - minR);
    const x = Math.random() * TEX_SIZE,
      y = Math.random() * TEX_SIZE;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }
}

export function canvasToTexture(c) {
  const t = new THREE.CanvasTexture(c);
  t.magFilter = THREE.NearestFilter;
  t.minFilter = THREE.NearestFilter;
  return t;
}

export function texGrassTop() {
  const c = newCanvas();
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#50b424';
  ctx.fillRect(0, 0, TEX_SIZE, TEX_SIZE);
  blotches(ctx, ['#439922', '#62da31'], 14, 2, 4.5);
  speckle(ctx, ['#3e9119', '#70e53e', '#377915'], 90);
  // petits brins d'herbe individuels
  ctx.strokeStyle = '#2c7112';
  for (let i = 0; i < 26; i++) {
    const x = Math.random() * TEX_SIZE,
      y = Math.random() * TEX_SIZE;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + (Math.random() * 2 - 1), y - 2 - Math.random() * 2);
    ctx.stroke();
  }
  return canvasToTexture(c);
}
export function texGrassSide() {
  const c = newCanvas();
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#8a4d12';
  ctx.fillRect(0, 0, TEX_SIZE, TEX_SIZE);
  blotches(ctx, ['#6f3c0d', '#9d5922'], 10, 1.5, 3.5);
  speckle(ctx, ['#5c320a', '#ad692b'], 60);
  // bande d'herbe en haut, bord irrégulier avec brins qui retombent
  const grassH = TEX_SIZE * 0.28;
  ctx.fillStyle = '#50b424';
  for (let x = 0; x < TEX_SIZE; x++) {
    const h = grassH + (Math.random() * 4 - 2);
    ctx.fillRect(x, 0, 1, Math.max(2, h));
  }
  blotches(ctx, ['#3e9119', '#62da31'], 8, 1.5, 3);
  speckle(ctx, ['#45921e', '#70e53e'], 25);
  return canvasToTexture(c);
}
export function texDirt() {
  const c = newCanvas();
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#8a4d12';
  ctx.fillRect(0, 0, TEX_SIZE, TEX_SIZE);
  blotches(ctx, ['#6f3c0d', '#9d5922', '#5c320a'], 22, 1.5, 4);
  speckle(ctx, ['#442506', '#ba7734'], 45);
  speckle(ctx, ['#462b1b'], 10, 2); // petits cailloux
  return canvasToTexture(c);
}
export function texStone() {
  const c = newCanvas();
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#8e8e8e';
  ctx.fillRect(0, 0, TEX_SIZE, TEX_SIZE);
  blotches(ctx, ['#7c7c7c', '#9d9d9d'], 16, 2, 4.5);
  speckle(ctx, ['#6b6b6b', '#afafaf', '#5d5d5d'], 70);
  // quelques fissures
  ctx.strokeStyle = 'rgba(90,90,90,0.6)';
  ctx.lineWidth = 1;
  for (let i = 0; i < 3; i++) {
    let x = Math.random() * TEX_SIZE,
      y = Math.random() * TEX_SIZE;
    ctx.beginPath();
    ctx.moveTo(x, y);
    for (let s = 0; s < 4; s++) {
      x += Math.random() * 8 - 4;
      y += Math.random() * 8 - 4;
      ctx.lineTo(x, y);
    }
    ctx.stroke();
  }
  return canvasToTexture(c);
}
export function texWoodSide() {
  const c = newCanvas();
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#59300e';
  ctx.fillRect(0, 0, TEX_SIZE, TEX_SIZE);
  ctx.fillStyle = '#3e2008';
  for (let x = 0; x < TEX_SIZE; x += 6) {
    const w = 1 + Math.floor(Math.random() * 2);
    ctx.fillRect(x, 0, w, TEX_SIZE);
  }
  speckle(ctx, ['#704211', '#2c1606'], 40);
  // un petit noeud dans le bois
  ctx.fillStyle = '#231103';
  ctx.beginPath();
  ctx.ellipse(TEX_SIZE * 0.7, TEX_SIZE * 0.4, 2.5, 4, 0, 0, Math.PI * 2);
  ctx.fill();
  return canvasToTexture(c);
}
export function texWoodTop() {
  const c = newCanvas();
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#a77029';
  ctx.fillRect(0, 0, TEX_SIZE, TEX_SIZE);
  speckle(ctx, ['#996123', '#b77c33'], 30);
  const cx = TEX_SIZE / 2,
    cy = TEX_SIZE / 2;
  ctx.strokeStyle = '#59300e';
  for (let r = 2; r < TEX_SIZE / 2; r += 2.6) {
    ctx.lineWidth = 1 + (r % 5 === 0 ? 0.6 : 0);
    ctx.beginPath();
    ctx.arc(cx, cy, r + (Math.random() * 0.8 - 0.4), 0, Math.PI * 2);
    ctx.stroke();
  }
  ctx.fillStyle = '#3e2008';
  ctx.beginPath();
  ctx.arc(cx, cy, 2, 0, Math.PI * 2);
  ctx.fill();
  return canvasToTexture(c);
}
export function texLeaves() {
  const c = newCanvas();
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#17761c';
  ctx.fillRect(0, 0, TEX_SIZE, TEX_SIZE);
  blotches(ctx, ['#0f4712', '#25a52d', '#0b300d'], 40, 1.5, 3.5);
  speckle(ctx, ['#072709', '#37c63e'], 90);
  // petits trous/ombres pour donner du volume au feuillage
  blotches(ctx, ['rgba(0,0,0,0.15)'], 10, 1, 2.5);
  return canvasToTexture(c);
}
export function texPlanks() {
  const c = newCanvas();
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#daa44c';
  ctx.fillRect(0, 0, TEX_SIZE, TEX_SIZE);
  const plankH = TEX_SIZE / 4;
  for (let row = 0; row < 4; row++) {
    const y = row * plankH;
    ctx.fillStyle = row % 2 === 0 ? '#e2b261' : '#d39b41';
    ctx.fillRect(0, y, TEX_SIZE, plankH);
    ctx.fillStyle = '#926220';
    ctx.fillRect(0, y, TEX_SIZE, 1);
    // veinure horizontale légère
    ctx.strokeStyle = 'rgba(140,105,60,0.5)';
    for (let i = 0; i < 3; i++) {
      const gy = y + 2 + Math.random() * (plankH - 4);
      ctx.beginPath();
      ctx.moveTo(0, gy);
      ctx.lineTo(TEX_SIZE, gy + (Math.random() * 2 - 1));
      ctx.stroke();
    }
    // clous aux extrémités
    ctx.fillStyle = '#422d11';
    ctx.beginPath();
    ctx.arc(3, y + plankH / 2, 1, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(TEX_SIZE - 3, y + plankH / 2, 1, 0, Math.PI * 2);
    ctx.fill();
  }
  speckle(ctx, ['#cf933b', '#c18632'], 20);
  return canvasToTexture(c);
}
export function texCraftTop() {
  const c = newCanvas();
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#bb7f2d';
  ctx.fillRect(0, 0, TEX_SIZE, TEX_SIZE);
  speckle(ctx, ['#a77029', '#cc913e'], 30);
  // grille de craft 2x2 gravée
  ctx.strokeStyle = '#3e2008';
  ctx.lineWidth = 1.5;
  ctx.strokeRect(2, 2, TEX_SIZE - 4, TEX_SIZE - 4);
  ctx.beginPath();
  ctx.moveTo(TEX_SIZE / 2, 3);
  ctx.lineTo(TEX_SIZE / 2, TEX_SIZE - 3);
  ctx.moveTo(3, TEX_SIZE / 2);
  ctx.lineTo(TEX_SIZE - 3, TEX_SIZE / 2);
  ctx.stroke();
  // petites icônes d'outils dans les coins
  ctx.strokeStyle = '#59300e';
  ctx.lineWidth = 1;
  ctx.strokeRect(6, 6, 5, 5);
  ctx.strokeRect(TEX_SIZE - 11, TEX_SIZE - 11, 5, 5);
  return canvasToTexture(c);
}
export function texCraftSide() {
  const c = newCanvas();
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#8a4d12';
  ctx.fillRect(0, 0, TEX_SIZE, TEX_SIZE);
  ctx.fillStyle = '#59300e';
  for (let y = 0; y < TEX_SIZE; y += 8) ctx.fillRect(0, y, TEX_SIZE, 1.5);
  speckle(ctx, ['#6f3c0d', '#9d5922'], 30);
  ctx.strokeStyle = '#251406';
  ctx.lineWidth = 1.5;
  ctx.strokeRect(3, 3, TEX_SIZE - 6, TEX_SIZE - 6);
  // poignée façon tiroir
  ctx.fillStyle = '#0a0501';
  ctx.fillRect(TEX_SIZE / 2 - 4, TEX_SIZE - 9, 8, 2.5);
  return canvasToTexture(c);
}
// bladeColor/highlightColor paramétrables : les outils pierre/fer (Phase 4b) réutilisent
// exactement la même forme, seule la couleur de la tête change.
export function texWoodSword(bladeColor = '#e3e3e3', highlightColor = '#ffffff') {
  const c = newCanvas();
  const ctx = c.getContext('2d');
  const s = TEX_SIZE / 16; // facteur d'échelle
  ctx.fillStyle = bladeColor;
  ctx.fillRect(7 * s, 1 * s, 3 * s, 8 * s);
  ctx.fillStyle = highlightColor;
  ctx.fillRect(8 * s, 1 * s, 1 * s, 8 * s);
  ctx.fillStyle = '#3e2008';
  ctx.fillRect(5 * s, 9 * s, 7 * s, 1 * s);
  ctx.fillStyle = '#59300e';
  ctx.fillRect(7 * s, 10 * s, 3 * s, 5 * s);
  return canvasToTexture(c);
}
export function texWoodPickaxe(headColor = '#cccccc') {
  const c = newCanvas();
  const ctx = c.getContext('2d');
  const s = TEX_SIZE / 16;
  ctx.strokeStyle = headColor;
  ctx.lineWidth = 2 * s;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(2 * s, 4 * s);
  ctx.lineTo(13 * s, 2 * s);
  ctx.lineTo(14 * s, 5 * s);
  ctx.stroke();
  ctx.fillStyle = '#59300e';
  ctx.fillRect(7 * s, 5 * s, 2 * s, 9 * s);
  return canvasToTexture(c);
}
export function texWoodAxe(headColor = '#cccccc') {
  const c = newCanvas();
  const ctx = c.getContext('2d');
  const s = TEX_SIZE / 16;
  ctx.fillStyle = headColor;
  ctx.beginPath();
  ctx.moveTo(9 * s, 1 * s);
  ctx.lineTo(14 * s, 3 * s);
  ctx.lineTo(14 * s, 7 * s);
  ctx.lineTo(9 * s, 6 * s);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = '#59300e';
  ctx.fillRect(7 * s, 2 * s, 2 * s, 12 * s);
  return canvasToTexture(c);
}
// tiers pierre/fer (Phase 4b) : mêmes formes que le bois, tête recolorée.
export const texStonePickaxe = () => texWoodPickaxe('#8e8e8e');
export const texStoneAxe = () => texWoodAxe('#8e8e8e');
export const texStoneSword = () => texWoodSword('#a3a3a3', '#cccccc');
export const texIronPickaxe = () => texWoodPickaxe('#ffffff');
export const texIronAxe = () => texWoodAxe('#ffffff');
export const texIronSword = () => texWoodSword('#ffffff', '#ffffff');
// Neige. L'ancienne version était du blanc pur specké de blanc pur sur des taches
// blanches : strictement invisible, le bloc rendait comme un aplat. Une surface
// enneigée se lit par son OMBRE, pas par son blanc — d'où des creux bleutés froids
// (la neige diffuse la lumière du ciel) et quelques cristaux plus clairs par-dessus.
export function texSnow() {
  const c = newCanvas();
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#f4f7fb';
  ctx.fillRect(0, 0, TEX_SIZE, TEX_SIZE);
  // congères : creux doux, à peine bleutés
  blotches(ctx, ['#dfe7f2', '#e8eef7'], 10, 2, 4.5);
  // bosses tassées, plus claires que le fond
  blotches(ctx, ['#ffffff'], 8, 1.5, 3);
  // grain fin : ombre froide + éclats de cristal
  speckle(ctx, ['#cdd8e8', '#e4ebf5'], 26);
  speckle(ctx, ['#ffffff'], 34);
  return canvasToTexture(c);
}
export function texMeat() {
  const c = newCanvas();
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#e53b3b';
  ctx.fillRect(TEX_SIZE * 0.15, TEX_SIZE * 0.15, TEX_SIZE * 0.7, TEX_SIZE * 0.7);
  speckle(ctx, ['#b82020', '#fb6969'], 25);
  ctx.fillStyle = '#fffefd';
  ctx.fillRect(TEX_SIZE * 0.35, TEX_SIZE * 0.7, TEX_SIZE * 0.3, TEX_SIZE * 0.15);
  return canvasToTexture(c);
}
export function texCookedMeat() {
  const c = newCanvas();
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#8a4a26';
  ctx.fillRect(TEX_SIZE * 0.15, TEX_SIZE * 0.15, TEX_SIZE * 0.7, TEX_SIZE * 0.7);
  speckle(ctx, ['#5c2f16', '#a5622f'], 25);
  ctx.fillStyle = '#3a1c0c';
  ctx.fillRect(TEX_SIZE * 0.2, TEX_SIZE * 0.25, TEX_SIZE * 0.6, TEX_SIZE * 0.08);
  ctx.fillRect(TEX_SIZE * 0.2, TEX_SIZE * 0.55, TEX_SIZE * 0.6, TEX_SIZE * 0.08);
  return canvasToTexture(c);
}
export function texMilk() {
  const c = newCanvas();
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#e3e3e3';
  ctx.fillRect(TEX_SIZE * 0.2, TEX_SIZE * 0.1, TEX_SIZE * 0.6, TEX_SIZE * 0.8);
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(TEX_SIZE * 0.25, TEX_SIZE * 0.35, TEX_SIZE * 0.5, TEX_SIZE * 0.5);
  return canvasToTexture(c);
}

// minerais (Phase 4b) : base pierre + taches de la couleur du minerai, pour rester
// lisibles au premier coup d'oeil sans redessiner toute la texture de pierre.
function texOre(specks) {
  const c = newCanvas();
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#8e8e8e';
  ctx.fillRect(0, 0, TEX_SIZE, TEX_SIZE);
  blotches(ctx, ['#7c7c7c', '#9d9d9d'], 10, 2, 4);
  speckle(ctx, ['#6b6b6b', '#afafaf'], 30);
  blotches(ctx, specks, 7, 1.8, 3.2);
  return canvasToTexture(c);
}
export function texCoalOre() {
  return texOre(['#000000', '#111111']);
}
export function texIronOre() {
  return texOre(['#e48e4c', '#f9bb81']);
}
export function texGoldOre() {
  return texOre(['#ffd345', '#ffe584']);
}
export function texDiamondOre() {
  return texOre(['#71fafa', '#c4ffff']);
}
// Torche (Phase 13) : simplification assumée -- rendue comme un bloc plein via le
// mesher de chunk (pas une croix/tige fine à géométrie dédiée, cf. commentaire dans
// world/world.js), donc la texture doit rester lisible comme "torche" même en cube complet.
// Torche. Ce n'est plus un cube plein (cf. `shape` dans data/blocks.js) mais un
// bâtonnet fin et haut, donc ces tuiles habillent le BÂTON lui-même : elles
// remplissent toute leur face au lieu de dessiner une petite torche perdue au milieu
// d'un carré de fond noir. `torchStick` couvre les 4 côtés (manche en bas, flamme en
// haut), `torchFlame` la face du dessus, `torchWood` celle du dessous.
export function texTorchStick() {
  const c = newCanvas();
  const ctx = c.getContext('2d');
  const flameTop = TEX_SIZE * 0.34; // hauteur occupée par la flamme, en haut de la tuile

  // manche : bois avec quelques veines verticales
  ctx.fillStyle = '#6b4423';
  ctx.fillRect(0, flameTop, TEX_SIZE, TEX_SIZE - flameTop);
  ctx.fillStyle = '#54341a';
  for (let x = 2; x < TEX_SIZE; x += 7) ctx.fillRect(x, flameTop, 2, TEX_SIZE - flameTop);
  ctx.fillStyle = '#82562e';
  for (let x = 5; x < TEX_SIZE; x += 9) ctx.fillRect(x, flameTop, 1, TEX_SIZE - flameTop);
  // charbon : transition sombre entre le bois et la flamme
  ctx.fillStyle = '#2b1a0d';
  ctx.fillRect(0, flameTop, TEX_SIZE, TEX_SIZE * 0.06);

  // flamme : coeur clair au centre, dégradé vers l'orange sur les bords
  const g = ctx.createLinearGradient(0, 0, 0, flameTop);
  g.addColorStop(0, '#fff3b0');
  g.addColorStop(0.45, '#ffc93c');
  g.addColorStop(1, '#f07818');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, TEX_SIZE, flameTop);
  ctx.fillStyle = '#fffbe0';
  ctx.fillRect(TEX_SIZE * 0.3, 0, TEX_SIZE * 0.4, flameTop * 0.55);
  return canvasToTexture(c);
}
export function texTorchFlame() {
  const c = newCanvas();
  const ctx = c.getContext('2d');
  const g = ctx.createRadialGradient(
    TEX_SIZE / 2,
    TEX_SIZE / 2,
    0,
    TEX_SIZE / 2,
    TEX_SIZE / 2,
    TEX_SIZE / 2,
  );
  g.addColorStop(0, '#fffdf0');
  g.addColorStop(0.5, '#ffd254');
  g.addColorStop(1, '#ef7a16');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, TEX_SIZE, TEX_SIZE);
  return canvasToTexture(c);
}
export function texTorchWood() {
  const c = newCanvas();
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#6b4423';
  ctx.fillRect(0, 0, TEX_SIZE, TEX_SIZE);
  speckle(ctx, ['#54341a', '#82562e'], 18);
  return canvasToTexture(c);
}
export function texWool() {
  const c = newCanvas();
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#e8e2d4';
  ctx.fillRect(0, 0, TEX_SIZE, TEX_SIZE);
  blotches(ctx, ['#d9d1bc', '#f2eddf'], 14, 1.5, 3.5);
  speckle(ctx, ['#cfc7b0'], 25);
  return canvasToTexture(c);
}
// Sable. Avant : un aplat + du bruit uniforme, donc aucune structure — de loin ça
// rendait comme une couleur plate. Le sable se lit à ses RIDES : des ondulations
// douces laissées par le vent, plus quelques grains sombres épars.
export function texSand() {
  const c = newCanvas();
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#e2cb8e';
  ctx.fillRect(0, 0, TEX_SIZE, TEX_SIZE);
  // Rides : ondulations horizontales, espacées et à faible contraste. Volontairement
  // discrètes — poussées plus loin, les lignes se lisent comme des planches, pas
  // comme du sable. Elles sont là pour casser l'aplat, pas pour faire motif.
  const rand = mulberry32(21);
  for (let y = 3; y < TEX_SIZE; y += 7) {
    for (let x = 0; x < TEX_SIZE; x++) {
      const wave = Math.round(Math.sin((x / TEX_SIZE) * Math.PI * 2 + y) * 2);
      if (rand() < 0.25) continue; // ride interrompue par endroits
      ctx.fillStyle = '#d6be7e';
      ctx.fillRect(x, y + wave, 1, 1);
      ctx.fillStyle = '#ecdaa6'; // crête à peine éclairée, juste au-dessus du creux
      ctx.fillRect(x, y + wave - 1, 1, 1);
    }
    if (rand() < 0.5) y += 1; // espacement irrégulier : pas un motif de papier peint
  }
  speckle(ctx, ['#c9ae6c', '#efdda6'], 34);
  return canvasToTexture(c);
}
export function texSandstone() {
  const c = newCanvas();
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#d3bd83';
  ctx.fillRect(0, 0, TEX_SIZE, TEX_SIZE);
  for (let y = 0; y < TEX_SIZE; y += TEX_SIZE / 6) ctx.fillRect(0, y, TEX_SIZE, 1);
  speckle(ctx, ['#c1aa70'], 20);
  return canvasToTexture(c);
}
export function texCactus() {
  const c = newCanvas();
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#3f7d32';
  ctx.fillRect(0, 0, TEX_SIZE, TEX_SIZE);
  speckle(ctx, ['#356b2a', '#4c8f3d'], 20);
  ctx.fillStyle = '#2c5722';
  for (let x = TEX_SIZE * 0.15; x < TEX_SIZE; x += TEX_SIZE * 0.3)
    ctx.fillRect(x, 0, 1.5, TEX_SIZE);
  return canvasToTexture(c);
}
export function texDeadBush() {
  // pas de transparence : rendu comme un cube plein (même simplification que torch/wool,
  // cf. leurs commentaires) donc un fond opaque plutôt qu'un canvas alpha=0 qui
  // ressortirait noir sur le matériau non-transparent partagé de l'atlas.
  const c = newCanvas();
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#e0c88a';
  ctx.fillRect(0, 0, TEX_SIZE, TEX_SIZE);
  ctx.strokeStyle = '#6b4a2a';
  ctx.lineWidth = 1.2;
  const rand = mulberry32(7);
  for (let i = 0; i < 14; i++) {
    let x = TEX_SIZE / 2,
      y = TEX_SIZE * 0.9;
    ctx.beginPath();
    ctx.moveTo(x, y);
    for (let s = 0; s < 4; s++) {
      x += (rand() - 0.5) * TEX_SIZE * 0.3;
      y -= rand() * TEX_SIZE * 0.2;
      ctx.lineTo(x, y);
    }
    ctx.stroke();
  }
  return canvasToTexture(c);
}
export function texIce() {
  const c = newCanvas();
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#a8d8f0';
  ctx.fillRect(0, 0, TEX_SIZE, TEX_SIZE);
  ctx.strokeStyle = 'rgba(255,255,255,0.5)';
  ctx.lineWidth = 1;
  const rand = mulberry32(11);
  for (let i = 0; i < 6; i++) {
    ctx.beginPath();
    ctx.moveTo(rand() * TEX_SIZE, rand() * TEX_SIZE);
    ctx.lineTo(rand() * TEX_SIZE, rand() * TEX_SIZE);
    ctx.stroke();
  }
  return canvasToTexture(c);
}
export function texFurnace() {
  const c = newCanvas();
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#5a5a5a';
  ctx.fillRect(0, 0, TEX_SIZE, TEX_SIZE);
  speckle(ctx, ['#4a4a4a', '#6c6c6c'], 30);
  ctx.fillStyle = '#232323';
  ctx.fillRect(TEX_SIZE * 0.28, TEX_SIZE * 0.32, TEX_SIZE * 0.44, TEX_SIZE * 0.4);
  ctx.fillStyle = '#ff7b25';
  ctx.fillRect(TEX_SIZE * 0.34, TEX_SIZE * 0.5, TEX_SIZE * 0.32, TEX_SIZE * 0.14);
  return canvasToTexture(c);
}
export function texIronIngot() {
  const c = newCanvas();
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#d9d3c8';
  ctx.fillRect(TEX_SIZE * 0.2, TEX_SIZE * 0.35, TEX_SIZE * 0.6, TEX_SIZE * 0.3);
  ctx.fillStyle = '#efe9de';
  ctx.fillRect(TEX_SIZE * 0.25, TEX_SIZE * 0.38, TEX_SIZE * 0.5, TEX_SIZE * 0.1);
  return canvasToTexture(c);
}
export function texBedrock() {
  const c = newCanvas();
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#232326';
  ctx.fillRect(0, 0, TEX_SIZE, TEX_SIZE);
  blotches(ctx, ['#101013', '#38383f'], 18, 2, 5);
  speckle(ctx, ['#040405', '#494952'], 60);
  return canvasToTexture(c);
}

// texture d'eau : façon pixel-art voxel classique (deux bleus, blocs rectangulaires
// irréguliers) — pas de dégradé ni de lignes de vagues, juste des pavés plats. Faite
// pour tourner en boucle (RepeatWrapping) et défiler via texture.offset ; les blocs
// sont alignés sur une grille interne donc les bords se raccordent proprement.
export function texWater() {
  const c = newCanvas();
  const ctx = c.getContext('2d');
  const cell = TEX_SIZE / 8; // grille 8x8 de "pavés" façon pixel-art
  const cols = TEX_SIZE / cell;
  ctx.fillStyle = '#2157fc'; // bleu de fond
  ctx.fillRect(0, 0, TEX_SIZE, TEX_SIZE);
  ctx.fillStyle = '#3b6cfd'; // bleu clair des pavés
  const blotchCount = 15;
  for (let i = 0; i < blotchCount; i++) {
    const w = 1 + Math.floor(Math.random() * 3);
    const h = 1 + Math.floor(Math.random() * 2);
    const gx = Math.min(cols - w, Math.floor(Math.random() * cols));
    const gy = Math.min(cols - h, Math.floor(Math.random() * cols));
    ctx.fillRect(gx * cell, gy * cell, w * cell, h * cell);
  }
  const t = canvasToTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return t;
}

// overlay de craquelures posé SUR le bloc visé pendant qu'on le casse (pas un effet
// d'écran) : fond transparent, seed fixe -> chaque stage redessine depuis zéro mais
// avec plus de segments, donc les fissures du stage précédent restent visibles + s'étendent
export function texCrackStage(stage) {
  const c = newCanvas();
  const ctx = c.getContext('2d');
  const rand = mulberry32(42);
  const segments = 4 + stage * 4;
  ctx.strokeStyle = 'rgba(15,15,15,0.85)';
  ctx.lineWidth = 1;
  let x = TEX_SIZE / 2,
    y = TEX_SIZE / 2;
  for (let i = 0; i < segments; i++) {
    if (i % 5 === 0) {
      x = rand() * TEX_SIZE;
      y = rand() * TEX_SIZE;
    }
    const nx = x + (rand() * 12 - 6),
      ny = y + (rand() * 12 - 6);
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(nx, ny);
    ctx.stroke();
    x = nx;
    y = ny;
  }
  const t = canvasToTexture(c);
  t.premultiplyAlpha = false;
  return t;
}

export function texMobSkin(base, dark) {
  const c = newCanvas();
  const ctx = c.getContext('2d');
  ctx.fillStyle = base;
  ctx.fillRect(0, 0, TEX_SIZE, TEX_SIZE);
  speckle(ctx, [dark], 20);
  return canvasToTexture(c);
}
export function texCowSkin() {
  const c = newCanvas();
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, TEX_SIZE, TEX_SIZE);
  blotches(ctx, ['#070605', '#1c1812'], 6, 3, 6);
  speckle(ctx, ['#fbf8f2'], 20);
  return canvasToTexture(c);
}
// tête de zombie : visage abîmé avec des yeux, vue de face
export function texZombieFace() {
  const c = newCanvas();
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#538e42';
  ctx.fillRect(0, 0, TEX_SIZE, TEX_SIZE);
  blotches(ctx, ['#3d6c30', '#6ba955'], 10, 1.5, 3);
  speckle(ctx, ['#2c5423'], 30);
  // yeux
  ctx.fillStyle = '#000000';
  ctx.fillRect(TEX_SIZE * 0.2, TEX_SIZE * 0.35, TEX_SIZE * 0.18, TEX_SIZE * 0.14);
  ctx.fillRect(TEX_SIZE * 0.62, TEX_SIZE * 0.35, TEX_SIZE * 0.18, TEX_SIZE * 0.14);
  ctx.fillStyle = '#850000';
  ctx.fillRect(TEX_SIZE * 0.23, TEX_SIZE * 0.38, TEX_SIZE * 0.1, TEX_SIZE * 0.08);
  ctx.fillRect(TEX_SIZE * 0.65, TEX_SIZE * 0.38, TEX_SIZE * 0.1, TEX_SIZE * 0.08);
  // bouche
  ctx.fillStyle = '#000000';
  ctx.fillRect(TEX_SIZE * 0.3, TEX_SIZE * 0.68, TEX_SIZE * 0.4, TEX_SIZE * 0.1);
  // griffures
  ctx.strokeStyle = 'rgba(40,30,20,0.5)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(TEX_SIZE * 0.55, TEX_SIZE * 0.15);
  ctx.lineTo(TEX_SIZE * 0.7, TEX_SIZE * 0.5);
  ctx.stroke();
  return canvasToTexture(c);
}
// tête de cochon vue de face : yeux + groin
export function texPigFace() {
  const c = newCanvas();
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#fbbdc4';
  ctx.fillRect(0, 0, TEX_SIZE, TEX_SIZE);
  speckle(ctx, ['#df818e'], 16);
  ctx.fillStyle = '#020101';
  ctx.fillRect(TEX_SIZE * 0.2, TEX_SIZE * 0.28, TEX_SIZE * 0.14, TEX_SIZE * 0.12);
  ctx.fillRect(TEX_SIZE * 0.66, TEX_SIZE * 0.28, TEX_SIZE * 0.14, TEX_SIZE * 0.12);
  // groin
  ctx.fillStyle = '#ee8493';
  ctx.beginPath();
  ctx.ellipse(TEX_SIZE * 0.5, TEX_SIZE * 0.68, TEX_SIZE * 0.22, TEX_SIZE * 0.15, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#75252f';
  ctx.beginPath();
  ctx.ellipse(
    TEX_SIZE * 0.42,
    TEX_SIZE * 0.68,
    TEX_SIZE * 0.035,
    TEX_SIZE * 0.05,
    0,
    0,
    Math.PI * 2,
  );
  ctx.fill();
  ctx.beginPath();
  ctx.ellipse(
    TEX_SIZE * 0.58,
    TEX_SIZE * 0.68,
    TEX_SIZE * 0.035,
    TEX_SIZE * 0.05,
    0,
    0,
    Math.PI * 2,
  );
  ctx.fill();
  return canvasToTexture(c);
}
// tête de vache vue de face : taches + yeux + museau
export function texSheepFace() {
  const c = newCanvas();
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#e8dfd0';
  ctx.fillRect(0, 0, TEX_SIZE, TEX_SIZE);
  speckle(ctx, ['#d5c9b3'], 20);
  ctx.fillStyle = '#111111';
  ctx.fillRect(TEX_SIZE * 0.22, TEX_SIZE * 0.32, TEX_SIZE * 0.14, TEX_SIZE * 0.12);
  ctx.fillRect(TEX_SIZE * 0.64, TEX_SIZE * 0.32, TEX_SIZE * 0.14, TEX_SIZE * 0.12);
  ctx.fillStyle = '#5a5044';
  ctx.fillRect(TEX_SIZE * 0.4, TEX_SIZE * 0.62, TEX_SIZE * 0.2, TEX_SIZE * 0.1);
  return canvasToTexture(c);
}
export function texCowFace() {
  const c = newCanvas();
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, TEX_SIZE, TEX_SIZE);
  blotches(ctx, ['#070605', '#1c1812'], 4, 2.5, 5);
  ctx.fillStyle = '#000000';
  ctx.fillRect(TEX_SIZE * 0.18, TEX_SIZE * 0.3, TEX_SIZE * 0.16, TEX_SIZE * 0.14);
  ctx.fillRect(TEX_SIZE * 0.66, TEX_SIZE * 0.3, TEX_SIZE * 0.16, TEX_SIZE * 0.14);
  ctx.fillStyle = '#fbf5ed';
  ctx.fillRect(TEX_SIZE * 0.28, TEX_SIZE * 0.62, TEX_SIZE * 0.44, TEX_SIZE * 0.3);
  ctx.fillStyle = '#312318';
  ctx.beginPath();
  ctx.ellipse(
    TEX_SIZE * 0.42,
    TEX_SIZE * 0.78,
    TEX_SIZE * 0.04,
    TEX_SIZE * 0.05,
    0,
    0,
    Math.PI * 2,
  );
  ctx.fill();
  ctx.beginPath();
  ctx.ellipse(
    TEX_SIZE * 0.58,
    TEX_SIZE * 0.78,
    TEX_SIZE * 0.04,
    TEX_SIZE * 0.05,
    0,
    0,
    Math.PI * 2,
  );
  ctx.fill();
  return canvasToTexture(c);
}
// plumage de poulet : blanc cassé tacheté + petits yeux (visibles sur toutes les faces
// de la tête, pas seulement l'avant : un poulet n'a pas vraiment de "face" distincte)
export function texChickenBody() {
  const c = newCanvas();
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, TEX_SIZE, TEX_SIZE);
  blotches(ctx, ['#f8f5ee', '#ffffff'], 16, 1.5, 3.5);
  speckle(ctx, ['#eee5d5', '#e4b04c'], 30);
  ctx.fillStyle = '#000000';
  ctx.fillRect(TEX_SIZE * 0.28, TEX_SIZE * 0.32, TEX_SIZE * 0.12, TEX_SIZE * 0.12);
  ctx.fillRect(TEX_SIZE * 0.6, TEX_SIZE * 0.32, TEX_SIZE * 0.12, TEX_SIZE * 0.12);
  return canvasToTexture(c);
}
export function texChickenBeak() {
  const c = newCanvas();
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#ffb217';
  ctx.fillRect(0, 0, TEX_SIZE, TEX_SIZE);
  speckle(ctx, ['#d98b00', '#ffc550'], 20);
  return canvasToTexture(c);
}
// texture de lave : même principe que texWater (pavés façon pixel-art, RepeatWrapping
// pour défiler via texture.offset) mais en orange/rouge.
export function texLava() {
  const c = newCanvas();
  const ctx = c.getContext('2d');
  const cell = TEX_SIZE / 8;
  const cols = TEX_SIZE / cell;
  ctx.fillStyle = '#b33500';
  ctx.fillRect(0, 0, TEX_SIZE, TEX_SIZE);
  ctx.fillStyle = '#ff8a1e';
  const blotchCount = 15;
  for (let i = 0; i < blotchCount; i++) {
    const w = 1 + Math.floor(Math.random() * 3);
    const h = 1 + Math.floor(Math.random() * 2);
    const gx = Math.min(cols - w, Math.floor(Math.random() * cols));
    const gy = Math.min(cols - h, Math.floor(Math.random() * cols));
    ctx.fillRect(gx * cell, gy * cell, w * cell, h * cell);
  }
  const t = canvasToTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return t;
}
// vêtements en lambeaux pour le torse du zombie
export function texZombieShirt() {
  const c = newCanvas();
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#294938';
  ctx.fillRect(0, 0, TEX_SIZE, TEX_SIZE);
  blotches(ctx, ['#1c3527', '#36694d'], 12, 1.5, 3.5);
  speckle(ctx, ['#13251b'], 30);
  // déchirures
  ctx.fillStyle = '#538e42';
  for (let i = 0; i < 5; i++) {
    const x = Math.random() * TEX_SIZE,
      y = Math.random() * TEX_SIZE;
    ctx.fillRect(x, y, 1 + Math.random() * 3, 1 + Math.random() * 4);
  }
  return canvasToTexture(c);
}
