// Textures procédurales (façon pixel-art voxel) : blocs, outils, mobs, nourriture.
// Chaque fonction dessine sur un petit canvas et retourne une THREE.CanvasTexture.

import * as THREE from 'three';

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
  ctx.fillStyle = '#5da53d';
  ctx.fillRect(0, 0, TEX_SIZE, TEX_SIZE);
  blotches(ctx, ['#529339', '#6bbf49'], 14, 2, 4.5);
  speckle(ctx, ['#4e8f31', '#75c951', '#487f2c'], 90);
  // petits brins d'herbe individuels
  ctx.strokeStyle = '#3f7a29';
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
  ctx.fillStyle = '#8b5a2b';
  ctx.fillRect(0, 0, TEX_SIZE, TEX_SIZE);
  blotches(ctx, ['#7a4d24', '#96633a'], 10, 1.5, 3.5);
  speckle(ctx, ['#6e4620', '#a06f42'], 60);
  // bande d'herbe en haut, bord irrégulier avec brins qui retombent
  const grassH = TEX_SIZE * 0.28;
  ctx.fillStyle = '#5da53d';
  for (let x = 0; x < TEX_SIZE; x++) {
    const h = grassH + (Math.random() * 4 - 2);
    ctx.fillRect(x, 0, 1, Math.max(2, h));
  }
  blotches(ctx, ['#4e8f31', '#6bbf49'], 8, 1.5, 3);
  speckle(ctx, ['#548f36', '#75c951'], 25);
  return canvasToTexture(c);
}
export function texDirt() {
  const c = newCanvas();
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#8b5a2b';
  ctx.fillRect(0, 0, TEX_SIZE, TEX_SIZE);
  blotches(ctx, ['#7a4d24', '#96633a', '#6e4620'], 22, 1.5, 4);
  speckle(ctx, ['#5f3c1a', '#a8794a'], 45);
  speckle(ctx, ['#5a4030'], 10, 2); // petits cailloux
  return canvasToTexture(c);
}
export function texStone() {
  const c = newCanvas();
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#8a8a8a';
  ctx.fillRect(0, 0, TEX_SIZE, TEX_SIZE);
  blotches(ctx, ['#7d7d7d', '#959595'], 16, 2, 4.5);
  speckle(ctx, ['#707070', '#a3a3a3', '#666666'], 70);
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
  ctx.fillStyle = '#6b4423';
  ctx.fillRect(0, 0, TEX_SIZE, TEX_SIZE);
  ctx.fillStyle = '#5a371c';
  for (let x = 0; x < TEX_SIZE; x += 6) {
    const w = 1 + Math.floor(Math.random() * 2);
    ctx.fillRect(x, 0, w, TEX_SIZE);
  }
  speckle(ctx, ['#7a5228', '#4f3018'], 40);
  // un petit noeud dans le bois
  ctx.fillStyle = '#4a2c14';
  ctx.beginPath();
  ctx.ellipse(TEX_SIZE * 0.7, TEX_SIZE * 0.4, 2.5, 4, 0, 0, Math.PI * 2);
  ctx.fill();
  return canvasToTexture(c);
}
export function texWoodTop() {
  const c = newCanvas();
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#9c7440';
  ctx.fillRect(0, 0, TEX_SIZE, TEX_SIZE);
  speckle(ctx, ['#93693a', '#a67d49'], 30);
  const cx = TEX_SIZE / 2,
    cy = TEX_SIZE / 2;
  ctx.strokeStyle = '#6b4423';
  for (let r = 2; r < TEX_SIZE / 2; r += 2.6) {
    ctx.lineWidth = 1 + (r % 5 === 0 ? 0.6 : 0);
    ctx.beginPath();
    ctx.arc(cx, cy, r + (Math.random() * 0.8 - 0.4), 0, Math.PI * 2);
    ctx.stroke();
  }
  ctx.fillStyle = '#5a371c';
  ctx.beginPath();
  ctx.arc(cx, cy, 2, 0, Math.PI * 2);
  ctx.fill();
  return canvasToTexture(c);
}
export function texLeaves() {
  const c = newCanvas();
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#2e7d32';
  ctx.fillRect(0, 0, TEX_SIZE, TEX_SIZE);
  blotches(ctx, ['#245e27', '#3d9b43', '#1f4f22'], 40, 1.5, 3.5);
  speckle(ctx, ['#1a4a1d', '#4db052'], 90);
  // petits trous/ombres pour donner du volume au feuillage
  blotches(ctx, ['rgba(0,0,0,0.15)'], 10, 1, 2.5);
  return canvasToTexture(c);
}
export function texPlanks() {
  const c = newCanvas();
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#c19a5b';
  ctx.fillRect(0, 0, TEX_SIZE, TEX_SIZE);
  const plankH = TEX_SIZE / 4;
  for (let row = 0; row < 4; row++) {
    const y = row * plankH;
    ctx.fillStyle = row % 2 === 0 ? '#c9a568' : '#bb9354';
    ctx.fillRect(0, y, TEX_SIZE, plankH);
    ctx.fillStyle = '#8f6a37';
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
    ctx.fillStyle = '#5a4326';
    ctx.beginPath();
    ctx.arc(3, y + plankH / 2, 1, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(TEX_SIZE - 3, y + plankH / 2, 1, 0, Math.PI * 2);
    ctx.fill();
  }
  speckle(ctx, ['#b78d50', '#ad8449'], 20);
  return canvasToTexture(c);
}
export function texCraftTop() {
  const c = newCanvas();
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#a97f45';
  ctx.fillRect(0, 0, TEX_SIZE, TEX_SIZE);
  speckle(ctx, ['#9c7440', '#b58c52'], 30);
  // grille de craft 2x2 gravée
  ctx.strokeStyle = '#5a371c';
  ctx.lineWidth = 1.5;
  ctx.strokeRect(2, 2, TEX_SIZE - 4, TEX_SIZE - 4);
  ctx.beginPath();
  ctx.moveTo(TEX_SIZE / 2, 3);
  ctx.lineTo(TEX_SIZE / 2, TEX_SIZE - 3);
  ctx.moveTo(3, TEX_SIZE / 2);
  ctx.lineTo(TEX_SIZE - 3, TEX_SIZE / 2);
  ctx.stroke();
  // petites icônes d'outils dans les coins
  ctx.strokeStyle = '#6b4423';
  ctx.lineWidth = 1;
  ctx.strokeRect(6, 6, 5, 5);
  ctx.strokeRect(TEX_SIZE - 11, TEX_SIZE - 11, 5, 5);
  return canvasToTexture(c);
}
export function texCraftSide() {
  const c = newCanvas();
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#8b5a2b';
  ctx.fillRect(0, 0, TEX_SIZE, TEX_SIZE);
  ctx.fillStyle = '#6b4423';
  for (let y = 0; y < TEX_SIZE; y += 8) ctx.fillRect(0, y, TEX_SIZE, 1.5);
  speckle(ctx, ['#7a4d24', '#96633a'], 30);
  ctx.strokeStyle = '#4a2f18';
  ctx.lineWidth = 1.5;
  ctx.strokeRect(3, 3, TEX_SIZE - 6, TEX_SIZE - 6);
  // poignée façon tiroir
  ctx.fillStyle = '#3a2410';
  ctx.fillRect(TEX_SIZE / 2 - 4, TEX_SIZE - 9, 8, 2.5);
  return canvasToTexture(c);
}
export function texWoodSword() {
  const c = newCanvas();
  const ctx = c.getContext('2d');
  const s = TEX_SIZE / 16; // facteur d'échelle
  ctx.fillStyle = '#c9c9c9';
  ctx.fillRect(7 * s, 1 * s, 3 * s, 8 * s);
  ctx.fillStyle = '#eeeeee';
  ctx.fillRect(8 * s, 1 * s, 1 * s, 8 * s);
  ctx.fillStyle = '#5a371c';
  ctx.fillRect(5 * s, 9 * s, 7 * s, 1 * s);
  ctx.fillStyle = '#6b4423';
  ctx.fillRect(7 * s, 10 * s, 3 * s, 5 * s);
  return canvasToTexture(c);
}
export function texWoodPickaxe() {
  const c = newCanvas();
  const ctx = c.getContext('2d');
  const s = TEX_SIZE / 16;
  ctx.strokeStyle = '#b8b8b8';
  ctx.lineWidth = 2 * s;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(2 * s, 4 * s);
  ctx.lineTo(13 * s, 2 * s);
  ctx.lineTo(14 * s, 5 * s);
  ctx.stroke();
  ctx.fillStyle = '#6b4423';
  ctx.fillRect(7 * s, 5 * s, 2 * s, 9 * s);
  return canvasToTexture(c);
}
export function texWoodAxe() {
  const c = newCanvas();
  const ctx = c.getContext('2d');
  const s = TEX_SIZE / 16;
  ctx.fillStyle = '#b8b8b8';
  ctx.beginPath();
  ctx.moveTo(9 * s, 1 * s);
  ctx.lineTo(14 * s, 3 * s);
  ctx.lineTo(14 * s, 7 * s);
  ctx.lineTo(9 * s, 6 * s);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = '#6b4423';
  ctx.fillRect(7 * s, 2 * s, 2 * s, 12 * s);
  return canvasToTexture(c);
}
export function texSnow() {
  const c = newCanvas();
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#f2f6fa';
  ctx.fillRect(0, 0, TEX_SIZE, TEX_SIZE);
  speckle(ctx, ['#e2eaf2', '#ffffff'], 60);
  blotches(ctx, ['#dbe6f0'], 8, 1.5, 3);
  return canvasToTexture(c);
}
export function texMeat() {
  const c = newCanvas();
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#c94f4f';
  ctx.fillRect(TEX_SIZE * 0.15, TEX_SIZE * 0.15, TEX_SIZE * 0.7, TEX_SIZE * 0.7);
  speckle(ctx, ['#a83a3a', '#e06a6a'], 25);
  ctx.fillStyle = '#f2e2c8';
  ctx.fillRect(TEX_SIZE * 0.35, TEX_SIZE * 0.7, TEX_SIZE * 0.3, TEX_SIZE * 0.15);
  return canvasToTexture(c);
}
export function texMilk() {
  const c = newCanvas();
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#c9c9c9';
  ctx.fillRect(TEX_SIZE * 0.2, TEX_SIZE * 0.1, TEX_SIZE * 0.6, TEX_SIZE * 0.8);
  ctx.fillStyle = '#f5f5f5';
  ctx.fillRect(TEX_SIZE * 0.25, TEX_SIZE * 0.35, TEX_SIZE * 0.5, TEX_SIZE * 0.5);
  return canvasToTexture(c);
}

// texture d'eau : vaguelettes, faite pour tourner en boucle (RepeatWrapping) et
// défiler via texture.offset — c'est ce qui donne l'impression d'eau qui coule
export function texWater() {
  const c = newCanvas();
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#3d7dca';
  ctx.fillRect(0, 0, TEX_SIZE, TEX_SIZE);
  ctx.strokeStyle = 'rgba(255,255,255,0.25)';
  ctx.lineWidth = 1;
  for (let y = 4; y < TEX_SIZE; y += 8) {
    ctx.beginPath();
    for (let x = 0; x <= TEX_SIZE; x += 4) {
      const wy = y + Math.sin((x / TEX_SIZE) * Math.PI * 2) * 1.5;
      x === 0 ? ctx.moveTo(x, wy) : ctx.lineTo(x, wy);
    }
    ctx.stroke();
  }
  speckle(ctx, ['#5a9de0'], 20);
  const t = canvasToTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
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
  ctx.fillStyle = '#f5f0e6';
  ctx.fillRect(0, 0, TEX_SIZE, TEX_SIZE);
  blotches(ctx, ['#2b2620', '#3a332a'], 6, 3, 6);
  speckle(ctx, ['#e6ddc9'], 20);
  return canvasToTexture(c);
}
// tête de zombie : visage abîmé avec des yeux, vue de face
export function texZombieFace() {
  const c = newCanvas();
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#5f8a52';
  ctx.fillRect(0, 0, TEX_SIZE, TEX_SIZE);
  blotches(ctx, ['#4d7343', '#719c62'], 10, 1.5, 3);
  speckle(ctx, ['#3f6337'], 30);
  // yeux
  ctx.fillStyle = '#1a1a1a';
  ctx.fillRect(TEX_SIZE * 0.2, TEX_SIZE * 0.35, TEX_SIZE * 0.18, TEX_SIZE * 0.14);
  ctx.fillRect(TEX_SIZE * 0.62, TEX_SIZE * 0.35, TEX_SIZE * 0.18, TEX_SIZE * 0.14);
  ctx.fillStyle = '#8b1a1a';
  ctx.fillRect(TEX_SIZE * 0.23, TEX_SIZE * 0.38, TEX_SIZE * 0.1, TEX_SIZE * 0.08);
  ctx.fillRect(TEX_SIZE * 0.65, TEX_SIZE * 0.38, TEX_SIZE * 0.1, TEX_SIZE * 0.08);
  // bouche
  ctx.fillStyle = '#2a1a15';
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
  ctx.fillStyle = '#e8a0a8';
  ctx.fillRect(0, 0, TEX_SIZE, TEX_SIZE);
  speckle(ctx, ['#c97e88'], 16);
  ctx.fillStyle = '#2a1a1a';
  ctx.fillRect(TEX_SIZE * 0.2, TEX_SIZE * 0.28, TEX_SIZE * 0.14, TEX_SIZE * 0.12);
  ctx.fillRect(TEX_SIZE * 0.66, TEX_SIZE * 0.28, TEX_SIZE * 0.14, TEX_SIZE * 0.12);
  // groin
  ctx.fillStyle = '#d67e8a';
  ctx.beginPath();
  ctx.ellipse(TEX_SIZE * 0.5, TEX_SIZE * 0.68, TEX_SIZE * 0.22, TEX_SIZE * 0.15, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#7a3a42';
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
  ctx.fillStyle = '#f5f0e6';
  ctx.fillRect(0, 0, TEX_SIZE, TEX_SIZE);
  blotches(ctx, ['#2b2620', '#3a332a'], 4, 2.5, 5);
  ctx.fillStyle = '#1a1a1a';
  ctx.fillRect(TEX_SIZE * 0.18, TEX_SIZE * 0.3, TEX_SIZE * 0.16, TEX_SIZE * 0.14);
  ctx.fillRect(TEX_SIZE * 0.66, TEX_SIZE * 0.3, TEX_SIZE * 0.16, TEX_SIZE * 0.14);
  ctx.fillStyle = '#e8d9c4';
  ctx.fillRect(TEX_SIZE * 0.28, TEX_SIZE * 0.62, TEX_SIZE * 0.44, TEX_SIZE * 0.3);
  ctx.fillStyle = '#4a3a2e';
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
  ctx.fillStyle = '#f2ece0';
  ctx.fillRect(0, 0, TEX_SIZE, TEX_SIZE);
  blotches(ctx, ['#e2dac8', '#fbf7ee'], 16, 1.5, 3.5);
  speckle(ctx, ['#d8cdb8', '#c9a35a'], 30);
  ctx.fillStyle = '#241f1a';
  ctx.fillRect(TEX_SIZE * 0.28, TEX_SIZE * 0.32, TEX_SIZE * 0.12, TEX_SIZE * 0.12);
  ctx.fillRect(TEX_SIZE * 0.6, TEX_SIZE * 0.32, TEX_SIZE * 0.12, TEX_SIZE * 0.12);
  return canvasToTexture(c);
}
export function texChickenBeak() {
  const c = newCanvas();
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#e8a828';
  ctx.fillRect(0, 0, TEX_SIZE, TEX_SIZE);
  speckle(ctx, ['#c98a1a', '#f2ba48'], 20);
  return canvasToTexture(c);
}
// vêtements en lambeaux pour le torse du zombie
export function texZombieShirt() {
  const c = newCanvas();
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#3d5a4a';
  ctx.fillRect(0, 0, TEX_SIZE, TEX_SIZE);
  blotches(ctx, ['#324c3e', '#48705a'], 12, 1.5, 3.5);
  speckle(ctx, ['#2a4234'], 30);
  // déchirures
  ctx.fillStyle = '#5f8a52';
  for (let i = 0; i < 5; i++) {
    const x = Math.random() * TEX_SIZE,
      y = Math.random() * TEX_SIZE;
    ctx.fillRect(x, y, 1 + Math.random() * 3, 1 + Math.random() * 4);
  }
  return canvasToTexture(c);
}
