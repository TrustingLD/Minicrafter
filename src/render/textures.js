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

// Sature légèrement TOUTES les textures procédurales (couleurs plus vives, sans
// tomber dans le flashy/dessin-animé) -- un seul réglage ici plutôt que de
// retoucher les centaines de couleurs codées en dur plus bas dans ce fichier,
// puisque canvasToTexture() est le point de passage unique de toutes (cf. les
// 4 textures de minerai, qui passent par texOre() -> canvasToTexture() aussi).
// 100% = couleurs inchangées ; monter au-delà sature, descendre désature.
const SATURATION_BOOST = 130;
function boostSaturation(c) {
  const ctx = c.getContext('2d');
  const tmp = document.createElement('canvas');
  tmp.width = c.width;
  tmp.height = c.height;
  tmp.getContext('2d').drawImage(c, 0, 0);
  ctx.clearRect(0, 0, c.width, c.height);
  ctx.filter = `saturate(${SATURATION_BOOST}%)`;
  ctx.drawImage(tmp, 0, 0);
  ctx.filter = 'none';
}

export function canvasToTexture(c) {
  boostSaturation(c);
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
  // blotches/speckle vertes confinées à la bande d'herbe (clip) : sans ce clip,
  // ces deux appels dessinent sur tout le canvas comme les autres textures et
  // laissent des points verts isolés sur la partie terre en dessous.
  ctx.save();
  ctx.beginPath();
  ctx.rect(0, 0, TEX_SIZE, grassH + 3);
  ctx.clip();
  blotches(ctx, ['#3e9119', '#62da31'], 8, 1.5, 3);
  speckle(ctx, ['#45921e', '#70e53e'], 25);
  ctx.restore();
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
// Icône plate (hotbar/inventaire/craft) pour l'item escalier : contrairement aux
// blocs pleins ci-dessus, un simple carré de texture (planches/pierre) serait
// visuellement identique à l'item "Planches"/"Pierre" -- illisible en jeu. On
// dessine donc un vrai profil en L (2 marches, silhouette + arête foncée pour la
// lecture du relief), recoloré selon le matériau (mêmes teintes que la texture du
// bloc réel, pour rester cohérent visuellement). Fond transparent, comme les icônes
// d'outils ci-dessus (texWoodSword etc.) -- pas un carré plein comme les blocs.
export function texStairsIcon(fillColor, shadeColor, edgeColor) {
  const c = newCanvas();
  const ctx = c.getContext('2d');
  const s = TEX_SIZE / 16;
  // marche basse (avant, en bas) : large et basse
  ctx.fillStyle = fillColor;
  ctx.fillRect(1 * s, 10 * s, 14 * s, 5 * s);
  // marche haute (arrière, en haut à droite) : plus étroite, posée dessus
  ctx.fillRect(7 * s, 5 * s, 8 * s, 5 * s);
  // ombre portée sur le dessus de la marche basse (partie non couverte par la
  // marche haute) -- lisible même sans les arêtes, façon éclairage du dessus.
  ctx.fillStyle = shadeColor;
  ctx.fillRect(1 * s, 10 * s, 6 * s, 1 * s);
  ctx.fillRect(7 * s, 5 * s, 8 * s, 1 * s);
  // arêtes sombres : contour du profil en L, pour bien détacher la silhouette
  ctx.strokeStyle = edgeColor;
  ctx.lineWidth = Math.max(1, s * 0.8);
  ctx.beginPath();
  ctx.moveTo(1 * s, 15 * s);
  ctx.lineTo(1 * s, 10 * s);
  ctx.lineTo(7 * s, 10 * s);
  ctx.lineTo(7 * s, 5 * s);
  ctx.lineTo(15 * s, 5 * s);
  ctx.lineTo(15 * s, 15 * s);
  ctx.closePath();
  ctx.stroke();
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
// Pomme : disque rouge (queue + petite feuille) -- même gabarit que texMeat
// (blotch principal + speckle) pour rester cohérent visuellement avec le
// reste des icônes de nourriture.
export function texApple() {
  const c = newCanvas();
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#c62828';
  ctx.beginPath();
  ctx.arc(TEX_SIZE * 0.5, TEX_SIZE * 0.58, TEX_SIZE * 0.32, 0, Math.PI * 2);
  ctx.fill();
  speckle(ctx, ['#8f1c1c', '#e34d4d'], 22);
  // reflet
  ctx.fillStyle = '#ff8a8a';
  ctx.fillRect(TEX_SIZE * 0.32, TEX_SIZE * 0.44, TEX_SIZE * 0.09, TEX_SIZE * 0.13);
  // queue
  ctx.fillStyle = '#5c3a1e';
  ctx.fillRect(TEX_SIZE * 0.47, TEX_SIZE * 0.16, TEX_SIZE * 0.06, TEX_SIZE * 0.16);
  // feuille
  ctx.fillStyle = '#4caf50';
  ctx.beginPath();
  ctx.ellipse(
    TEX_SIZE * 0.63,
    TEX_SIZE * 0.2,
    TEX_SIZE * 0.1,
    TEX_SIZE * 0.06,
    -0.5,
    0,
    Math.PI * 2,
  );
  ctx.fill();
  return canvasToTexture(c);
}
// Pomme dorée : même silhouette que texApple, teintes or à la place du rouge
// (facilement reconnaissable dans la hotbar/craft, comme les lingots d'or).
export function texGoldenApple() {
  const c = newCanvas();
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#e6b800';
  ctx.beginPath();
  ctx.arc(TEX_SIZE * 0.5, TEX_SIZE * 0.58, TEX_SIZE * 0.32, 0, Math.PI * 2);
  ctx.fill();
  speckle(ctx, ['#b8860b', '#ffd700'], 26, 2);
  ctx.fillStyle = '#fff2b3';
  ctx.fillRect(TEX_SIZE * 0.32, TEX_SIZE * 0.44, TEX_SIZE * 0.09, TEX_SIZE * 0.13);
  ctx.fillStyle = '#5c3a1e';
  ctx.fillRect(TEX_SIZE * 0.47, TEX_SIZE * 0.16, TEX_SIZE * 0.06, TEX_SIZE * 0.16);
  ctx.fillStyle = '#d4af37';
  ctx.beginPath();
  ctx.ellipse(
    TEX_SIZE * 0.63,
    TEX_SIZE * 0.2,
    TEX_SIZE * 0.1,
    TEX_SIZE * 0.06,
    -0.5,
    0,
    Math.PI * 2,
  );
  ctx.fill();
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
// Lit (Phase 20) : couverture rouge + oreiller blanc, cf. data/blocks.js
// (bed_foot/bed_head). Le dessus du pied = couverture rouge unie légèrement
// texturée ; le dessus de la tête = oreiller blanc avec une petite couture ;
// le côté = couverture rouge avec un bourrelet clair en haut (bord replié du
// drap, comme dans Minecraft) pour bien lire "c'est un lit" même de profil.
export function texBedFoot() {
  const c = newCanvas();
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#b8302f';
  ctx.fillRect(0, 0, TEX_SIZE, TEX_SIZE);
  blotches(ctx, ['#a52625', '#c94443'], 10, 2, 4);
  speckle(ctx, ['#8f1f1e', '#d65a58'], 30);
  // quelques plis de couverture
  ctx.strokeStyle = 'rgba(90,20,20,0.35)';
  ctx.lineWidth = 1;
  for (let i = 0; i < 3; i++) {
    const y = 8 + i * 8;
    ctx.beginPath();
    ctx.moveTo(2, y);
    ctx.lineTo(TEX_SIZE - 2, y + 2);
    ctx.stroke();
  }
  return canvasToTexture(c);
}
export function texBedPillow() {
  const c = newCanvas();
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#f4f1ea';
  ctx.fillRect(0, 0, TEX_SIZE, TEX_SIZE);
  blotches(ctx, ['#e6e1d4', '#ffffff'], 10, 2, 4);
  speckle(ctx, ['#d8d2c2'], 20);
  // couture du coussin (contour)
  ctx.strokeStyle = '#c9c2af';
  ctx.lineWidth = 1;
  ctx.strokeRect(3, 3, TEX_SIZE - 6, TEX_SIZE - 6);
  return canvasToTexture(c);
}
// Côté de la tête de lit : gris clair (façon cadre/tissu du sommier), pas rouge --
// c'est ce qui, dans l'image de référence, distingue visuellement l'extrémité
// "oreiller" du reste de la couverture. Même structure que texBedSide (bourrelet
// clair en haut + pieds en bois en bas) pour rester cohérent en silhouette.
export function texBedHeadSide() {
  const c = newCanvas();
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#aab2b8';
  ctx.fillRect(0, 0, TEX_SIZE, TEX_SIZE);
  speckle(ctx, ['#8f979d', '#c3cace'], 30);
  // bord replié clair en haut, comme le côté rouge
  ctx.fillStyle = '#eef1f2';
  ctx.fillRect(0, 0, TEX_SIZE, 5);
  ctx.fillStyle = '#c9ced1';
  ctx.fillRect(0, 5, TEX_SIZE, 1);
  // pieds de lit en bois, tout en bas (identique au côté rouge)
  ctx.fillStyle = '#6b4423';
  ctx.fillRect(0, TEX_SIZE - 4, TEX_SIZE, 4);
  return canvasToTexture(c);
}
export function texBedSide() {
  const c = newCanvas();
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#a8282a';
  ctx.fillRect(0, 0, TEX_SIZE, TEX_SIZE);
  speckle(ctx, ['#8f1f1e', '#c04241'], 30);
  // bord replié clair en haut de la couverture
  ctx.fillStyle = '#e8e2d4';
  ctx.fillRect(0, 0, TEX_SIZE, 5);
  ctx.fillStyle = '#c9c2af';
  ctx.fillRect(0, 5, TEX_SIZE, 1);
  // pieds de lit en bois, tout en bas
  ctx.fillStyle = '#6b4423';
  ctx.fillRect(0, TEX_SIZE - 4, TEX_SIZE, 4);
  return canvasToTexture(c);
}
// Porte (Phase 21) : comme la torche, ces tuiles habillent un bloc à `shape`
// réduite (cf. data/blocks.js), donc elles remplissent toute leur face au lieu de
// dessiner une petite porte perdue au milieu d'un fond noir -- ce qu'on voit,
// c'est directement le panneau de bois. Cadre + 2 planches verticales pour lire
// "porte" plutôt que "planches" (texPlanks) au premier coup d'oeil ; la moitié du
// bas ajoute la poignée, la seule différence entre les deux tuiles.
function doorPanel(ctx) {
  ctx.fillStyle = '#7a4a22';
  ctx.fillRect(0, 0, TEX_SIZE, TEX_SIZE);
  // cadre extérieur, un peu plus sombre
  ctx.fillStyle = '#5c3717';
  ctx.fillRect(0, 0, TEX_SIZE, 2);
  ctx.fillRect(0, TEX_SIZE - 2, TEX_SIZE, 2);
  ctx.fillRect(0, 0, 2, TEX_SIZE);
  ctx.fillRect(TEX_SIZE - 2, 0, 2, TEX_SIZE);
  // 2 planches verticales en relief (panneau plus clair, liseré sombre) --
  // proportions arbitraires mais symétriques, façon vraie porte à panneaux.
  ctx.fillStyle = '#8f5a2c';
  ctx.fillRect(4, 4, TEX_SIZE / 2 - 6, TEX_SIZE - 8);
  ctx.fillRect(TEX_SIZE / 2 + 2, 4, TEX_SIZE / 2 - 6, TEX_SIZE - 8);
  ctx.strokeStyle = '#5c3717';
  ctx.lineWidth = 1;
  ctx.strokeRect(4.5, 4.5, TEX_SIZE / 2 - 7, TEX_SIZE - 9);
  ctx.strokeRect(TEX_SIZE / 2 + 2.5, 4.5, TEX_SIZE / 2 - 7, TEX_SIZE - 9);
  speckle(ctx, ['#6b4220', '#96622f'], 14);
}
export function texDoorTop() {
  const c = newCanvas();
  const ctx = c.getContext('2d');
  doorPanel(ctx);
  return canvasToTexture(c);
}
export function texDoorBottom() {
  const c = newCanvas();
  const ctx = c.getContext('2d');
  doorPanel(ctx);
  // poignée (laiton) côté droit, à mi-hauteur -- seul repère qui distingue la
  // moitié du bas de celle du haut, comme une vraie porte.
  ctx.fillStyle = '#dfa93a';
  ctx.beginPath();
  ctx.arc(TEX_SIZE - 7, TEX_SIZE * 0.52, 2, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#8a6416';
  ctx.beginPath();
  ctx.arc(TEX_SIZE - 7, TEX_SIZE * 0.52, 2, 0, Math.PI * 2);
  ctx.stroke();
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
// Cactus : avant, juste un aplat vert + des traits verticaux plats pour les côtes.
// Ça se lisait comme "vert avec des rayures", pas comme des nervures en relief.
// Chaque côte a maintenant un sillon sombre + une arête claire juste à côté (comme
// un pli éclairé de biais), plus de petites épines blanchâtres qui accrochent l'oeil
// le long des côtes -- le détail qui rend un cactus reconnaissable au premier coup d'oeil.
export function texCactus() {
  const c = newCanvas();
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#3f7d32';
  ctx.fillRect(0, 0, TEX_SIZE, TEX_SIZE);
  blotches(ctx, ['#356b2a', '#4c8f3d'], 14, 2, 4);
  speckle(ctx, ['#2c5722', '#5aa347'], 36);
  const ridges = [];
  for (let x = TEX_SIZE * 0.15; x < TEX_SIZE; x += TEX_SIZE * 0.3) ridges.push(x);
  for (const x of ridges) {
    ctx.fillStyle = '#264d1d'; // sillon : le creux de la côte, bien sombre
    ctx.fillRect(x, 0, 1.5, TEX_SIZE);
    ctx.fillStyle = '#5ba548'; // arête : le côté éclairé du pli, juste à côté du creux
    ctx.fillRect(x + 1.5, 0, 1, TEX_SIZE);
  }
  // vrais petits pics le long des côtes : un triangle clair (l'épine elle-même)
  // qui dépasse de part et d'autre du sillon, plus une ombre courte à sa base
  // pour bien le détacher du fond -- avant ce n'était qu'un pixel isolé, trop
  // discret pour se lire comme une épine.
  const rand = mulberry32(31);
  for (const x of ridges) {
    for (let y = 2; y < TEX_SIZE; y += 5) {
      if (rand() < 0.7) {
        const spikeY = y + Math.floor(rand() * 2);
        const dir = rand() < 0.5 ? -1 : 1; // l'épine pointe à gauche ou à droite du sillon
        ctx.fillStyle = '#5a4327';
        ctx.fillRect(x - 0.5, spikeY, 1, 1); // base sombre de l'épine
        ctx.fillStyle = '#f4ecc8';
        ctx.beginPath();
        ctx.moveTo(x, spikeY);
        ctx.lineTo(x, spikeY + 1);
        ctx.lineTo(x + dir * 2.4, spikeY + 0.5);
        ctx.closePath();
        ctx.fill();
      }
    }
  }
  return canvasToTexture(c);
}
// Buisson mort : même traitement que les mauvaises herbes (cf. texWeeds juste en
// dessous) — un sprite en croix (`shape.cross` dans data/blocks.js) qui se
// découpe dans une texture à trous, pas un cube plein. Fond réellement
// transparent (alpha=0, on ne remplit rien) : c'est ce qui laisse voir à
// travers entre les brindilles au lieu d'un carré beige plein.
export function texDeadBush() {
  const c = newCanvas();
  const ctx = c.getContext('2d');
  const rand = mulberry32(7);
  const browns = ['#6b4a2a', '#523720', '#805a35', '#8a6540'];
  // plusieurs brindilles partent du pied et se ramifient en montant, avec de
  // petites branches secondaires -- un bouquet éclaté plutôt qu'une seule tige
  for (let i = 0; i < 10; i++) {
    let x = TEX_SIZE * (0.22 + rand() * 0.56);
    let y = TEX_SIZE * 0.98;
    ctx.strokeStyle = browns[i % browns.length];
    ctx.lineWidth = 1.3 + rand() * 0.9;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(x, y);
    for (let s = 0; s < 5; s++) {
      const nx = x + (rand() - 0.5) * TEX_SIZE * 0.32;
      const ny = y - (rand() * TEX_SIZE * 0.18 + TEX_SIZE * 0.06);
      ctx.lineTo(nx, ny);
      if (rand() < 0.55) {
        ctx.moveTo(nx, ny);
        ctx.lineTo(nx + (rand() - 0.5) * TEX_SIZE * 0.22, ny - rand() * TEX_SIZE * 0.14);
        ctx.moveTo(nx, ny);
      }
      x = nx;
      y = ny;
    }
    ctx.stroke();
  }
  return canvasToTexture(c);
}
// Mauvaises herbes (Phase 21, puis passage en rendu "croix" — cf. data/blocks.js
// `shape.cross`) : plus un cube texturé sur ses 6 faces, mais un vrai sprite en
// X posé dans la cellule (mesher.js). La texture DOIT donc avoir un fond
// réellement transparent (alpha=0, on laisse le canvas tel quel — pas de
// fillRect) : c'est ce qui découpe les brins et laisse voir le sol/le décor
// derrière, au lieu d'un petit carré vert plein. Le matériau du monde a un
// alphaTest (cf. atlasMaterial dans world.js) : rien à faire côté canvas
// à part NE PAS remplir le fond.
export function texWeeds() {
  const c = newCanvas();
  const ctx = c.getContext('2d');
  const rand = mulberry32(11);
  // même famille de verts que le bloc "herbe" (cf. texGrassTop ci-dessus : base
  // #50b424, blotches #439922/#62da31, brins #2c7112) -- retour utilisateur : les
  // mauvaises herbes doivent être de la même couleur que l'herbe, pas une palette à part.
  const greens = ['#439922', '#50b424', '#2c7112', '#62da31', '#3e9119'];
  // plusieurs brins fins partent du pied (bas du sprite) et montent en
  // penchant légèrement, jamais parfaitement droits ni parfaitement alignés —
  // c'est cette irrégularité qui lit comme de l'herbe plutôt qu'un motif.
  for (let i = 0; i < 9; i++) {
    let x = TEX_SIZE * (0.08 + rand() * 0.84);
    const y0 = TEX_SIZE * (0.98 + rand() * 0.05); // léger débord pour ancrer au sol
    ctx.strokeStyle = greens[i % greens.length];
    ctx.lineWidth = 1.6 + rand() * 1.1;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(x, y0);
    const lean = (rand() - 0.5) * TEX_SIZE * 0.3; // chaque brin penche un peu
    const height = TEX_SIZE * (0.55 + rand() * 0.4);
    const midX = x + lean * 0.5;
    const midY = y0 - height * 0.55;
    const tipX = x + lean;
    const tipY = y0 - height;
    ctx.quadraticCurveTo(midX, midY, tipX, tipY);
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
export function texGlass() {
  const c = newCanvas();
  const ctx = c.getContext('2d');
  ctx.clearRect(0, 0, TEX_SIZE, TEX_SIZE);

  // Cadre extérieur blanc/cyan clair semi-transparent
  ctx.fillStyle = 'rgba(215, 240, 255, 0.85)';
  ctx.fillRect(0, 0, TEX_SIZE, 1);
  ctx.fillRect(0, 0, 1, TEX_SIZE);
  ctx.fillRect(TEX_SIZE - 1, 0, 1, TEX_SIZE);
  ctx.fillRect(0, TEX_SIZE - 1, TEX_SIZE, 1);

  // Coins intérieurs
  ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
  ctx.fillRect(1, 1, 2, 1);
  ctx.fillRect(1, 1, 1, 2);
  ctx.fillRect(TEX_SIZE - 3, 1, 2, 1);
  ctx.fillRect(TEX_SIZE - 2, 1, 1, 2);
  ctx.fillRect(1, TEX_SIZE - 2, 2, 1);
  ctx.fillRect(1, TEX_SIZE - 3, 1, 2);

  // Lignes de reflets diagonales (glare)
  ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
  ctx.fillRect(4, 4, 3, 1);
  ctx.fillRect(6, 5, 3, 1);
  ctx.fillRect(8, 6, 2, 1);

  ctx.fillRect(20, 22, 3, 1);
  ctx.fillRect(22, 23, 3, 1);
  ctx.fillRect(24, 24, 2, 1);

  return canvasToTexture(c);
}
// Four : avant, un aplat gris avec un petit trou noir/orange perdu au milieu --
// trop discret pour se lire comme un four à l'échelle du bloc. La pierre est
// maintenant découpée en gros blocs façon maçonnerie (au lieu d'un bruit fin),
// et l'ouverture + la braise sont nettement agrandies pour occuper le centre
// de la texture, avec un cadre métallique épais autour du trou.
export function texFurnace() {
  const c = newCanvas();
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#5a5a5a';
  ctx.fillRect(0, 0, TEX_SIZE, TEX_SIZE);
  // gros pavés de pierre (grain plus large qu'avant) pour un aspect plus massif
  const rand = mulberry32(19);
  const stoneShades = ['#4a4a4a', '#666666', '#525252'];
  for (let gy = 0; gy < TEX_SIZE; gy += TEX_SIZE / 4) {
    for (let gx = 0; gx < TEX_SIZE; gx += TEX_SIZE / 4) {
      if (rand() < 0.6) {
        ctx.fillStyle = stoneShades[Math.floor(rand() * stoneShades.length)];
        ctx.fillRect(gx, gy, TEX_SIZE / 4, TEX_SIZE / 4);
      }
    }
  }
  speckle(ctx, ['#3f3f3f', '#787878'], 24, 2);
  // cadre métallique épais autour de l'ouverture
  ctx.fillStyle = '#2c2c2c';
  ctx.fillRect(TEX_SIZE * 0.16, TEX_SIZE * 0.2, TEX_SIZE * 0.68, TEX_SIZE * 0.6);
  // ouverture noire, bien plus grande qu'avant
  ctx.fillStyle = '#181818';
  ctx.fillRect(TEX_SIZE * 0.22, TEX_SIZE * 0.28, TEX_SIZE * 0.56, TEX_SIZE * 0.48);
  // braise orange, agrandie et avec un coeur plus clair pour la profondeur
  ctx.fillStyle = '#ff7b25';
  ctx.fillRect(TEX_SIZE * 0.3, TEX_SIZE * 0.5, TEX_SIZE * 0.4, TEX_SIZE * 0.2);
  ctx.fillStyle = '#ffd166';
  ctx.fillRect(TEX_SIZE * 0.38, TEX_SIZE * 0.54, TEX_SIZE * 0.24, TEX_SIZE * 0.1);
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
// Lingot d'or : même silhouette (trapèze) que le lingot de fer, teintes dorées.
export function texGoldIngot() {
  const c = newCanvas();
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#e0a800';
  ctx.fillRect(TEX_SIZE * 0.2, TEX_SIZE * 0.35, TEX_SIZE * 0.6, TEX_SIZE * 0.3);
  ctx.fillStyle = '#ffe066';
  ctx.fillRect(TEX_SIZE * 0.25, TEX_SIZE * 0.38, TEX_SIZE * 0.5, TEX_SIZE * 0.1);
  return canvasToTexture(c);
}
// Diamant brut : un losange (facette claire en haut-gauche, facette sombre en
// bas-droite) plutôt que le trapèze des lingots -- assez différent au premier
// coup d'oeil pour ne pas se confondre avec un lingot dans la hotbar.
export function texDiamond() {
  const c = newCanvas();
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#4dd9d0';
  ctx.beginPath();
  ctx.moveTo(TEX_SIZE * 0.5, TEX_SIZE * 0.14);
  ctx.lineTo(TEX_SIZE * 0.82, TEX_SIZE * 0.4);
  ctx.lineTo(TEX_SIZE * 0.5, TEX_SIZE * 0.86);
  ctx.lineTo(TEX_SIZE * 0.18, TEX_SIZE * 0.4);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = '#c8fbf8';
  ctx.beginPath();
  ctx.moveTo(TEX_SIZE * 0.5, TEX_SIZE * 0.14);
  ctx.lineTo(TEX_SIZE * 0.66, TEX_SIZE * 0.36);
  ctx.lineTo(TEX_SIZE * 0.5, TEX_SIZE * 0.5);
  ctx.lineTo(TEX_SIZE * 0.34, TEX_SIZE * 0.36);
  ctx.closePath();
  ctx.fill();
  return canvasToTexture(c);
}

// Armures (Phase 19) : silhouette pixel-art partagée entre les 3 matériaux (fer/
// or/diamant), seule la couleur change -- même principe que texWoodSword/
// texIronSword ci-dessus. Grille conceptuelle 16x16 (s = TEX_SIZE/16), 4 pièces :
// casque (arceau), plastron (épaulettes + torse), jambières (2 jambes), bottes
// (2 pieds). `piece` : 'helmet' | 'chestplate' | 'leggings' | 'boots'.
export function texArmorPiece(piece, baseColor, highlightColor) {
  const c = newCanvas();
  const ctx = c.getContext('2d');
  const s = TEX_SIZE / 16;
  ctx.fillStyle = baseColor;
  if (piece === 'helmet') {
    ctx.fillRect(3 * s, 2 * s, 10 * s, 3 * s); // sommet
    ctx.fillRect(3 * s, 5 * s, 3 * s, 5 * s); // flanc gauche
    ctx.fillRect(10 * s, 5 * s, 3 * s, 5 * s); // flanc droit
    ctx.fillStyle = highlightColor;
    ctx.fillRect(4 * s, 3 * s, 8 * s, 1 * s);
  } else if (piece === 'chestplate') {
    ctx.fillRect(3 * s, 2 * s, 3 * s, 3 * s); // épaulette gauche
    ctx.fillRect(10 * s, 2 * s, 3 * s, 3 * s); // épaulette droite
    ctx.fillRect(3 * s, 4 * s, 10 * s, 8 * s); // torse
    ctx.fillStyle = highlightColor;
    ctx.fillRect(4 * s, 5 * s, 2 * s, 6 * s);
  } else if (piece === 'leggings') {
    ctx.fillRect(3 * s, 2 * s, 10 * s, 4 * s); // ceinture
    ctx.fillRect(3 * s, 6 * s, 4 * s, 8 * s); // jambe gauche
    ctx.fillRect(9 * s, 6 * s, 4 * s, 8 * s); // jambe droite
    ctx.fillStyle = highlightColor;
    ctx.fillRect(4 * s, 7 * s, 1 * s, 6 * s);
  } else {
    // boots
    ctx.fillRect(3 * s, 8 * s, 4 * s, 6 * s); // pied gauche
    ctx.fillRect(9 * s, 8 * s, 4 * s, 6 * s); // pied droit
    ctx.fillStyle = highlightColor;
    ctx.fillRect(3 * s, 12 * s, 4 * s, 2 * s);
    ctx.fillRect(9 * s, 12 * s, 4 * s, 2 * s);
  }
  return canvasToTexture(c);
}
const IRON_ARMOR_COLOR = ['#d9d3c8', '#efe9de'];
const GOLD_ARMOR_COLOR = ['#e0a800', '#ffe066'];
const DIAMOND_ARMOR_COLOR = ['#4dd9d0', '#c8fbf8'];
export const texIronHelmet = () => texArmorPiece('helmet', ...IRON_ARMOR_COLOR);
export const texIronChestplate = () => texArmorPiece('chestplate', ...IRON_ARMOR_COLOR);
export const texIronLeggings = () => texArmorPiece('leggings', ...IRON_ARMOR_COLOR);
export const texIronBoots = () => texArmorPiece('boots', ...IRON_ARMOR_COLOR);
export const texGoldHelmet = () => texArmorPiece('helmet', ...GOLD_ARMOR_COLOR);
export const texGoldChestplate = () => texArmorPiece('chestplate', ...GOLD_ARMOR_COLOR);
export const texGoldLeggings = () => texArmorPiece('leggings', ...GOLD_ARMOR_COLOR);
export const texGoldBoots = () => texArmorPiece('boots', ...GOLD_ARMOR_COLOR);
export const texDiamondHelmet = () => texArmorPiece('helmet', ...DIAMOND_ARMOR_COLOR);
export const texDiamondChestplate = () => texArmorPiece('chestplate', ...DIAMOND_ARMOR_COLOR);
export const texDiamondLeggings = () => texArmorPiece('leggings', ...DIAMOND_ARMOR_COLOR);
export const texDiamondBoots = () => texArmorPiece('boots', ...DIAMOND_ARMOR_COLOR);
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
// pour défiler via texture.offset) mais en orange/rouge. Rendue plus incandescente :
// base plus claire/saturée + couches de taches (orange puis jaune puis quelques
// pixels quasi-blancs façon "point chaud") pour un effet plus lumineux, cohérent
// avec lavaMaterial en MeshBasicMaterial (non affecté par l'éclairage ambiant).
export function texLava() {
  const c = newCanvas();
  const ctx = c.getContext('2d');
  const cell = TEX_SIZE / 8;
  const cols = TEX_SIZE / cell;
  // base : rouge-orange vif au lieu du brun-rouge terne précédent
  ctx.fillStyle = '#e6420a';
  ctx.fillRect(0, 0, TEX_SIZE, TEX_SIZE);
  // grosses coulées orange
  ctx.fillStyle = '#ff8a1e';
  const blotchCount = 15;
  for (let i = 0; i < blotchCount; i++) {
    const w = 1 + Math.floor(Math.random() * 3);
    const h = 1 + Math.floor(Math.random() * 2);
    const gx = Math.min(cols - w, Math.floor(Math.random() * cols));
    const gy = Math.min(cols - h, Math.floor(Math.random() * cols));
    ctx.fillRect(gx * cell, gy * cell, w * cell, h * cell);
  }
  // taches jaune vif, plus petites et plus nombreuses -> impression de chaleur
  ctx.fillStyle = '#ffc94d';
  const hotCount = 12;
  for (let i = 0; i < hotCount; i++) {
    const w = 1;
    const h = 1;
    const gx = Math.min(cols - w, Math.floor(Math.random() * cols));
    const gy = Math.min(cols - h, Math.floor(Math.random() * cols));
    ctx.fillRect(gx * cell, gy * cell, w * cell, h * cell);
  }
  // quelques points quasi-blancs façon "coeur incandescent", en accent (peu nombreux
  // pour rester un accent, pas noyer le contraste orange/rouge)
  ctx.fillStyle = '#fff2c2';
  const coreCount = 4;
  for (let i = 0; i < coreCount; i++) {
    const gx = Math.floor(Math.random() * cols);
    const gy = Math.floor(Math.random() * cols);
    ctx.fillRect(gx * cell + cell * 0.25, gy * cell + cell * 0.25, cell * 0.5, cell * 0.5);
  }
  const t = canvasToTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return t;
}
// Silhouette de flammes sur fond transparent (pas de fillRect de fond, contrairement
// aux autres textures ci-dessus) : plusieurs langues de feu verticales, base orange
// foncé -> pointe jaune pâle, façon pixel-art (bandes, pas de dégradé lisse). Utilisée
// en croix de deux plans (cf. buildFireOverlay, entities/mob.js et entities/player.js)
// pour l'effet "en feu" -- zombie au soleil, joueur qui sort de la lave. wrapT en
// RepeatWrapping : on fait défiler l'offset comme la lave (cf. lavaTexture plus haut)
// pour donner l'impression de flammes qui montent/dansent, sans animer de géométrie.
export function texFireOverlay() {
  const c = newCanvas();
  const ctx = c.getContext('2d');
  const tongues = 4;
  const tongueW = TEX_SIZE / tongues;
  for (let i = 0; i < tongues; i++) {
    const cx = tongueW * (i + 0.5) + (Math.random() * 3 - 1.5);
    const baseW = tongueW - 1 + Math.random() * 2;
    const h = TEX_SIZE * (0.75 + Math.random() * 0.25);
    const bands = 9;
    for (let b = 0; b < bands; b++) {
      const t = b / (bands - 1); // 0 en bas (base large, orange foncé), 1 en haut (pointe, jaune pâle)
      const y = TEX_SIZE - (h * (b + 1)) / bands;
      const w = Math.max(1, baseW * (1 - t * 0.8));
      const color = t < 0.35 ? '#e6420a' : t < 0.7 ? '#ff9d2e' : '#ffe066';
      ctx.fillStyle = color;
      ctx.fillRect(Math.round(cx - w / 2), Math.round(y), Math.ceil(w), TEX_SIZE / bands + 1);
    }
  }
  const t = canvasToTexture(c);
  t.wrapS = THREE.ClampToEdgeWrapping;
  t.wrapT = THREE.RepeatWrapping;
  return t;
}
// Villageois (Phase 20) : robe de bure + visage au grand nez, pour rester lisible
// et distinct des autres mobs humanoïdes (le zombie) au premier coup d'oeil.
export function texVillagerRobe() {
  const c = newCanvas();
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#8a6a42';
  ctx.fillRect(0, 0, TEX_SIZE, TEX_SIZE);
  blotches(ctx, ['#7a5b37', '#9a7a52'], 10, 1.5, 3.5);
  speckle(ctx, ['#6b4f2e'], 20);
  return canvasToTexture(c);
}
// visage vu de face : sourcils, yeux, et le grand nez qui fait immédiatement
// reconnaître un villageois plutôt qu'un autre mob humanoïde.
export function texVillagerFace() {
  const c = newCanvas();
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#e8b98f';
  ctx.fillRect(0, 0, TEX_SIZE, TEX_SIZE);
  speckle(ctx, ['#c99468'], 16);
  ctx.fillStyle = '#2a1c12';
  ctx.fillRect(TEX_SIZE * 0.2, TEX_SIZE * 0.3, TEX_SIZE * 0.18, TEX_SIZE * 0.06);
  ctx.fillRect(TEX_SIZE * 0.62, TEX_SIZE * 0.3, TEX_SIZE * 0.18, TEX_SIZE * 0.06);
  ctx.fillStyle = '#241a12';
  ctx.fillRect(TEX_SIZE * 0.22, TEX_SIZE * 0.4, TEX_SIZE * 0.12, TEX_SIZE * 0.1);
  ctx.fillRect(TEX_SIZE * 0.66, TEX_SIZE * 0.4, TEX_SIZE * 0.12, TEX_SIZE * 0.1);
  ctx.fillStyle = '#d1a279';
  ctx.fillRect(TEX_SIZE * 0.41, TEX_SIZE * 0.4, TEX_SIZE * 0.18, TEX_SIZE * 0.36);
  ctx.fillStyle = '#b98a5f';
  ctx.fillRect(TEX_SIZE * 0.41, TEX_SIZE * 0.72, TEX_SIZE * 0.18, TEX_SIZE * 0.05);
  return canvasToTexture(c);
}
// visage du joueur vu de face : sourcils, yeux (avec pupilles), et un sourire --
// appliqué uniquement sur la face avant de la tête de l'avatar (cf. entities/player.js),
// visible en 3e personne et surtout en vue "selfie" (F5 x2) où la caméra se retourne
// pour regarder le joueur en face.
export function texPlayerFace() {
  const c = newCanvas();
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#f9b87e';
  ctx.fillRect(0, 0, TEX_SIZE, TEX_SIZE);
  speckle(ctx, ['#dd8e53'], 14);
  // sourcils
  ctx.fillStyle = '#5a3a22';
  ctx.fillRect(TEX_SIZE * 0.18, TEX_SIZE * 0.28, TEX_SIZE * 0.2, TEX_SIZE * 0.06);
  ctx.fillRect(TEX_SIZE * 0.62, TEX_SIZE * 0.28, TEX_SIZE * 0.2, TEX_SIZE * 0.06);
  // yeux (blanc + pupille)
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(TEX_SIZE * 0.2, TEX_SIZE * 0.38, TEX_SIZE * 0.16, TEX_SIZE * 0.14);
  ctx.fillRect(TEX_SIZE * 0.64, TEX_SIZE * 0.38, TEX_SIZE * 0.16, TEX_SIZE * 0.14);
  ctx.fillStyle = '#2c1c10';
  ctx.fillRect(TEX_SIZE * 0.25, TEX_SIZE * 0.41, TEX_SIZE * 0.08, TEX_SIZE * 0.08);
  ctx.fillRect(TEX_SIZE * 0.69, TEX_SIZE * 0.41, TEX_SIZE * 0.08, TEX_SIZE * 0.08);
  // nez, léger
  ctx.fillStyle = '#dd8e53';
  ctx.fillRect(TEX_SIZE * 0.46, TEX_SIZE * 0.52, TEX_SIZE * 0.08, TEX_SIZE * 0.12);
  // bouche : sourire
  ctx.fillStyle = '#8a4a3a';
  ctx.fillRect(TEX_SIZE * 0.32, TEX_SIZE * 0.72, TEX_SIZE * 0.36, TEX_SIZE * 0.07);
  ctx.fillStyle = '#5a2a20';
  ctx.fillRect(TEX_SIZE * 0.3, TEX_SIZE * 0.7, TEX_SIZE * 0.06, TEX_SIZE * 0.04);
  ctx.fillRect(TEX_SIZE * 0.64, TEX_SIZE * 0.7, TEX_SIZE * 0.06, TEX_SIZE * 0.04);
  return canvasToTexture(c);
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

// Coffre (Phase Chest) : planche de chêne avec bordure renforcée et loquet métallique
export function texChestTop() {
  const c = newCanvas();
  const ctx = c.getContext('2d');
  // fond bois
  ctx.fillStyle = '#9e6727';
  ctx.fillRect(0, 0, TEX_SIZE, TEX_SIZE);
  blotches(ctx, ['#8a571e', '#b07630'], 12, 1.5, 3.5);
  speckle(ctx, ['#724413', '#c2873d'], 30);

  // bordure sombre renforcée (cadre du coffre)
  ctx.fillStyle = '#42280e';
  ctx.fillRect(0, 0, TEX_SIZE, 2.5);
  ctx.fillRect(0, TEX_SIZE - 2.5, TEX_SIZE, 2.5);
  ctx.fillRect(0, 0, 2.5, TEX_SIZE);
  ctx.fillRect(TEX_SIZE - 2.5, 0, 2.5, TEX_SIZE);

  // planches intérieures
  ctx.strokeStyle = 'rgba(66, 40, 14, 0.4)';
  ctx.lineWidth = 1;
  for (let y = 8; y < TEX_SIZE - 4; y += 8) {
    ctx.beginPath();
    ctx.moveTo(3, y);
    ctx.lineTo(TEX_SIZE - 3, y);
    ctx.stroke();
  }

  // renforts aux coins
  ctx.fillStyle = '#2d1a08';
  ctx.fillRect(0, 0, 4, 4);
  ctx.fillRect(TEX_SIZE - 4, 0, 4, 4);
  ctx.fillRect(0, TEX_SIZE - 4, 4, 4);
  ctx.fillRect(TEX_SIZE - 4, TEX_SIZE - 4, 4, 4);

  return canvasToTexture(c);
}

export function texChestSide() {
  const c = newCanvas();
  const ctx = c.getContext('2d');
  // fond bois
  ctx.fillStyle = '#9e6727';
  ctx.fillRect(0, 0, TEX_SIZE, TEX_SIZE);
  blotches(ctx, ['#8a571e', '#b07630'], 12, 1.5, 3.5);
  speckle(ctx, ['#724413', '#c2873d'], 30);

  // bordure extérieure sombre
  ctx.fillStyle = '#42280e';
  ctx.fillRect(0, 0, TEX_SIZE, 2.5);
  ctx.fillRect(0, TEX_SIZE - 2.5, TEX_SIZE, 2.5);
  ctx.fillRect(0, 0, 2.5, TEX_SIZE);
  ctx.fillRect(TEX_SIZE - 2.5, 0, 2.5, TEX_SIZE);

  // renforts aux 4 coins
  ctx.fillStyle = '#2d1a08';
  ctx.fillRect(0, 0, 4, 4);
  ctx.fillRect(TEX_SIZE - 4, 0, 4, 4);
  ctx.fillRect(0, TEX_SIZE - 4, 4, 4);
  ctx.fillRect(TEX_SIZE - 4, TEX_SIZE - 4, 4, 4);

  // fente du couvercle (séparation horizontale)
  const seamY = Math.floor(TEX_SIZE * 0.38);
  ctx.fillStyle = '#1c1005';
  ctx.fillRect(2, seamY, TEX_SIZE - 4, 2);

  // loquet métallique au centre (fermeture argentée / noire)
  const latchW = 6;
  const latchH = 8;
  const latchX = Math.floor((TEX_SIZE - latchW) / 2);
  const latchY = seamY - 3;

  // contour sombre du loquet
  ctx.fillStyle = '#1a1a1a';
  ctx.fillRect(latchX - 0.5, latchY - 0.5, latchW + 1, latchH + 1);

  // corps du loquet (métal argenté)
  ctx.fillStyle = '#dcdcdc';
  ctx.fillRect(latchX, latchY, latchW, latchH);
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(latchX + 1, latchY + 1, 2, latchH - 2);
  ctx.fillStyle = '#8f8f8f';
  ctx.fillRect(latchX + latchW - 2, latchY + 1, 1, latchH - 2);

  // trou de serrure / rivet central
  ctx.fillStyle = '#222222';
  ctx.fillRect(latchX + 2, latchY + 3, 2, 2);

  return canvasToTexture(c);
}

/* ============================================================
   REDSTONE (Phase 22) : fil (poussière), torche à redstone, levier,
   bouton, lampe, bloc de redstone, répéteur, piston.
   ============================================================ */

// Fil de redstone : un chemin sombre/terne à l'arrêt (power=0), de plus en plus
// vif et incandescent à mesure que `power` (0..15) monte -- même principe que la
// vraie poussière de redstone (rouge sombre -> rouge/orange vif). Une texture PAR
// niveau (0..15) plutôt qu'une seule recolorée à la volée : le mesher (Phase 5)
// suppose une texture fixe par id de bloc, et l'état "puissance" est justement
// encodé comme un id de bloc différent par niveau (cf. data/blocks.js) -- pas de
// canal de métadonnées par bloc dans ce moteur (Uint8Array 1 octet/bloc).
export function texRedstoneWire(power) {
  const c = newCanvas();
  const ctx = c.getContext('2d');
  const t = power / 15;
  // interpolation sombre (t=0) -> vif (t=1)
  const lerp = (a, b) => Math.round(a + (b - a) * t);
  const r = lerp(60, 255);
  const g = lerp(6, 60);
  const b = lerp(6, 10);
  ctx.fillStyle = `rgb(${r},${g},${b})`;
  ctx.fillRect(0, 0, TEX_SIZE, TEX_SIZE);
  // croix centrale (rappel visuel du "+" que dessine le fil dans le vrai jeu)
  ctx.fillStyle = `rgb(${lerp(90, 255)}, ${lerp(10, 130)}, ${lerp(10, 20)})`;
  ctx.fillRect(TEX_SIZE * 0.3, 2, TEX_SIZE * 0.4, TEX_SIZE - 4);
  ctx.fillRect(2, TEX_SIZE * 0.3, TEX_SIZE - 4, TEX_SIZE * 0.4);
  if (power > 0) {
    // lueur centrale, seulement si alimenté
    ctx.fillStyle = `rgba(255, ${lerp(120, 220)}, 80, ${0.25 + 0.5 * t})`;
    ctx.beginPath();
    ctx.arc(TEX_SIZE / 2, TEX_SIZE / 2, 3 + 3 * t, 0, Math.PI * 2);
    ctx.fill();
  }
  speckle(ctx, [`rgba(0,0,0,0.25)`], 10);
  return canvasToTexture(c);
}

// Manche de la torche à redstone : gris pierre (contrairement à la torche normale,
// en bois) -- partagé par les 2 états (allumée/éteinte), seule la tête (flamme) change.
export function texRedstoneTorchStick() {
  const c = newCanvas();
  const ctx = c.getContext('2d');
  ctx.clearRect(0, 0, TEX_SIZE, TEX_SIZE);
  ctx.fillStyle = '#8d8d8d';
  ctx.fillRect(TEX_SIZE * 0.35, TEX_SIZE * 0.15, TEX_SIZE * 0.3, TEX_SIZE * 0.85);
  speckle(ctx, ['#6f6f6f', '#a8a8a8'], 14, 1);
  return canvasToTexture(c);
}

// Tête (flamme) de la torche à redstone : rouge vif et lumineuse allumée, terne et
// sombre éteinte -- c'est ce contraste qui rend l'inversion (Phase 22, redstone.js)
// lisible d'un coup d'œil, comme la vraie torche de redstone.
export function texRedstoneTorchFlame(on) {
  const c = newCanvas();
  const ctx = c.getContext('2d');
  ctx.clearRect(0, 0, TEX_SIZE, TEX_SIZE);
  ctx.fillStyle = '#8d8d8d';
  ctx.fillRect(TEX_SIZE * 0.35, TEX_SIZE * 0.15, TEX_SIZE * 0.3, TEX_SIZE * 0.85);
  ctx.fillStyle = on ? '#ff2e19' : '#4a1610';
  ctx.beginPath();
  ctx.arc(TEX_SIZE / 2, TEX_SIZE * 0.22, TEX_SIZE * 0.16, 0, Math.PI * 2);
  ctx.fill();
  if (on) {
    ctx.fillStyle = 'rgba(255, 200, 120, 0.6)';
    ctx.beginPath();
    ctx.arc(TEX_SIZE / 2, TEX_SIZE * 0.22, TEX_SIZE * 0.08, 0, Math.PI * 2);
    ctx.fill();
  }
  return canvasToTexture(c);
}

// Levier : petite base de pierre + le manche, couché à plat (éteint) ou dressé
// (allumé) -- ici simplifié en un seul aplat texturé (le vrai relief 3D vient du
// `shape` réduit défini dans data/blocks.js, pas de la texture).
export function texLever(on) {
  const c = newCanvas();
  const ctx = c.getContext('2d');
  ctx.clearRect(0, 0, TEX_SIZE, TEX_SIZE);
  ctx.fillStyle = '#8d8d8d';
  ctx.fillRect(TEX_SIZE * 0.15, TEX_SIZE * 0.72, TEX_SIZE * 0.7, TEX_SIZE * 0.26);
  speckle(ctx, ['#6f6f6f'], 8, 1);
  ctx.fillStyle = '#4a3420';
  ctx.fillRect(TEX_SIZE * 0.44, on ? TEX_SIZE * 0.08 : TEX_SIZE * 0.4, TEX_SIZE * 0.12, TEX_SIZE * 0.62);
  ctx.fillStyle = on ? '#ff2e19' : '#7a7a7a';
  ctx.fillRect(TEX_SIZE * 0.4, on ? TEX_SIZE * 0.04 : TEX_SIZE * 0.36, TEX_SIZE * 0.2, TEX_SIZE * 0.1);
  return canvasToTexture(c);
}

// Bouton (pierre) : petite plaquette qui ressort du support quand relâché (éteint),
// s'enfonce/s'illumine brièvement une fois pressée (allumé) -- cf. BUTTON_TIME
// dans redstone.js pour le minutage du relâchement automatique.
export function texButton(on) {
  const c = newCanvas();
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#9c9c9c';
  ctx.fillRect(0, 0, TEX_SIZE, TEX_SIZE);
  blotches(ctx, ['#8c8c8c', '#adadad'], 8, 1.5, 3);
  ctx.fillStyle = on ? '#ff5533' : '#6b6b6b';
  ctx.fillRect(TEX_SIZE * 0.28, TEX_SIZE * 0.36, TEX_SIZE * 0.44, TEX_SIZE * 0.28);
  return canvasToTexture(c);
}

// Lampe à redstone : globe terne (éteinte) ou jaune incandescent (allumée) --
// `emitsLight` (data/blocks.js) ne s'applique qu'à la variante allumée.
export function texRedstoneLamp(on) {
  const c = newCanvas();
  const ctx = c.getContext('2d');
  ctx.fillStyle = on ? '#f4c542' : '#8a7a52';
  ctx.fillRect(0, 0, TEX_SIZE, TEX_SIZE);
  ctx.strokeStyle = on ? '#c99a1e' : '#5c5136';
  ctx.lineWidth = 1;
  for (let i = 4; i < TEX_SIZE; i += 6) {
    ctx.beginPath();
    ctx.moveTo(i, 0);
    ctx.lineTo(i, TEX_SIZE);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(0, i);
    ctx.lineTo(TEX_SIZE, i);
    ctx.stroke();
  }
  if (on) {
    ctx.fillStyle = 'rgba(255, 240, 180, 0.5)';
    ctx.beginPath();
    ctx.arc(TEX_SIZE / 2, TEX_SIZE / 2, TEX_SIZE * 0.3, 0, Math.PI * 2);
    ctx.fill();
  }
  return canvasToTexture(c);
}

// Bloc de redstone : source constante (toujours allumée), rouge profond et
// incandescent -- l'équivalent "je n'ai pas besoin d'un levier pour tester mon
// circuit" du vrai jeu.
export function texRedstoneBlock() {
  const c = newCanvas();
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#a81f10';
  ctx.fillRect(0, 0, TEX_SIZE, TEX_SIZE);
  blotches(ctx, ['#8f190c', '#c93a1e'], 14, 1.5, 3.5);
  speckle(ctx, ['#ff6a3d'], 20);
  ctx.strokeStyle = '#5c0f06';
  ctx.lineWidth = 1.5;
  ctx.strokeRect(0.75, 0.75, TEX_SIZE - 1.5, TEX_SIZE - 1.5);
  return canvasToTexture(c);
}

// Dessus du répéteur : 2 "torches" (points) sur une plaque de pierre, la paire la
// plus proche du bord `facing` représentant la sortie -- la flèche donne le sens
// de propagation en un coup d'œil, comme les rails/flèches du vrai répéteur.
// `facing` = direction de sortie du signal (cf. redstone.js FACING_DELTA).
export function texRepeaterTop(facing, on) {
  const c = newCanvas();
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#9c9c9c';
  ctx.fillRect(0, 0, TEX_SIZE, TEX_SIZE);
  blotches(ctx, ['#8c8c8c', '#adadad'], 6, 1.5, 3);
  const dot = (cx, cy) => {
    ctx.fillStyle = on ? '#ff2e19' : '#5c5c5c';
    ctx.beginPath();
    ctx.arc(cx, cy, TEX_SIZE * 0.09, 0, Math.PI * 2);
    ctx.fill();
  };
  const mid = TEX_SIZE / 2;
  const near = TEX_SIZE * 0.22,
    far = TEX_SIZE * 0.78;
  // point "entrée" toujours au centre, point "sortie" décalé vers `facing`
  dot(mid, mid);
  if (facing === 'north') dot(mid, near);
  else if (facing === 'south') dot(mid, far);
  else if (facing === 'east') dot(far, mid);
  else dot(near, mid);
  // flèche fine dans l'axe de propagation
  ctx.strokeStyle = on ? '#ff6a4d' : '#707070';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  if (facing === 'north') {
    ctx.moveTo(mid, far);
    ctx.lineTo(mid, near);
  } else if (facing === 'south') {
    ctx.moveTo(mid, near);
    ctx.lineTo(mid, far);
  } else if (facing === 'east') {
    ctx.moveTo(near, mid);
    ctx.lineTo(far, mid);
  } else {
    ctx.moveTo(far, mid);
    ctx.lineTo(near, mid);
  }
  ctx.stroke();
  return canvasToTexture(c);
}

// Piston : dessus métallique clair (la face du "vérin"), côtés en bois/pierre
// composite -- même texture réutilisée sur les 4 orientations ET sur la tête
// mobile (cf. data/blocks.js piston_base_*/piston_head_* : l'orientation change
// le comportement, pas l'apparence -- simplification assumée, cf. commentaire
// dédié dans blocks.js).
export function texPistonTop() {
  const c = newCanvas();
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#b9b09a';
  ctx.fillRect(0, 0, TEX_SIZE, TEX_SIZE);
  speckle(ctx, ['#a39a84', '#cfc6b0'], 20);
  ctx.strokeStyle = '#5c5540';
  ctx.lineWidth = 2;
  ctx.strokeRect(1, 1, TEX_SIZE - 2, TEX_SIZE - 2);
  ctx.fillStyle = '#6b6450';
  ctx.fillRect(TEX_SIZE * 0.4, TEX_SIZE * 0.4, TEX_SIZE * 0.2, TEX_SIZE * 0.2);
  return canvasToTexture(c);
}
export function texPistonSide() {
  const c = newCanvas();
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#8a7a56';
  ctx.fillRect(0, 0, TEX_SIZE, TEX_SIZE);
  blotches(ctx, ['#786a49', '#9c8c63'], 10, 1.5, 3);
  ctx.fillStyle = '#b9b09a';
  ctx.fillRect(0, 0, TEX_SIZE, TEX_SIZE * 0.18);
  return canvasToTexture(c);
}
