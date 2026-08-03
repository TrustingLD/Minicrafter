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
export function texSnow() {
  const c = newCanvas();
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, TEX_SIZE, TEX_SIZE);
  speckle(ctx, ['#ffffff', '#ffffff'], 60);
  blotches(ctx, ['#ffffff'], 8, 1.5, 3);
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
