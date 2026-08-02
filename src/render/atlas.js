// Atlas de textures (Phase 5) : bake toutes les textures de blocs procédurales
// (textures.js) dans UN SEUL canvas, + une table blockId -> UV. Ça permet au mesher
// de produire un unique BufferGeometry par chunk avec un unique matériau, au lieu
// d'un InstancedMesh par (chunk x type de bloc) — c'est ce qui fait chuter le nombre
// d'appels de rendu.

import * as THREE from 'three';
import * as tex from './textures.js';
import { TEX_SIZE } from './textures.js';
import { BLOCK_TYPES } from '../data/blocks.js';

const TEXTURE_FN = {
  grassTop: tex.texGrassTop,
  grassSide: tex.texGrassSide,
  dirt: tex.texDirt,
  stone: tex.texStone,
  woodTop: tex.texWoodTop,
  woodSide: tex.texWoodSide,
  leaves: tex.texLeaves,
  planks: tex.texPlanks,
  craftTop: tex.texCraftTop,
  craftSide: tex.texCraftSide,
  snow: tex.texSnow,
  coalOre: tex.texCoalOre,
  ironOre: tex.texIronOre,
  goldOre: tex.texGoldOre,
  diamondOre: tex.texDiamondOre,
  bedrock: tex.texBedrock,
};

// construit l'atlas + la table d'UV. Appelé une seule fois au boot.
export function buildBlockAtlas() {
  const keys = Object.keys(TEXTURE_FN);
  const cols = Math.ceil(Math.sqrt(keys.length));
  const rows = Math.ceil(keys.length / cols);
  const canvas = document.createElement('canvas');
  canvas.width = cols * TEX_SIZE;
  canvas.height = rows * TEX_SIZE;
  const ctx = canvas.getContext('2d');

  const rectByKey = {};
  keys.forEach((key, i) => {
    const cx = i % cols,
      cy = Math.floor(i / cols);
    const srcCanvas = TEXTURE_FN[key]().image; // .image = le <canvas> qui alimente la CanvasTexture
    ctx.drawImage(srcCanvas, cx * TEX_SIZE, cy * TEX_SIZE);
    rectByKey[key] = [
      (cx * TEX_SIZE) / canvas.width,
      (cy * TEX_SIZE) / canvas.height,
      ((cx + 1) * TEX_SIZE) / canvas.width,
      ((cy + 1) * TEX_SIZE) / canvas.height,
    ];
  });

  const texture = new THREE.CanvasTexture(canvas);
  texture.magFilter = THREE.NearestFilter;
  texture.minFilter = THREE.NearestFilter;
  // pas de mipmaps : avec un atlas + NearestFilter, le mipmapping mélangerait les
  // tuiles voisines sur les bords (bleeding) — inutile de toute façon en voxel.
  texture.generateMipmaps = false;

  // blockId -> { top, bottom, side } chacun [u0,v0,u1,v1]
  const uvByBlockId = {};
  for (const name in BLOCK_TYPES) {
    const b = BLOCK_TYPES[name];
    const t = b.textures;
    uvByBlockId[b.id] = {
      top: rectByKey[t.all || t.top],
      bottom: rectByKey[t.all || t.bottom],
      side: rectByKey[t.all || t.side],
    };
  }

  return { texture, uvByBlockId };
}

// direction de face normalisée -> quel slot de la table UV utiliser
export function faceSlot(nx, ny, nz) {
  if (ny === 1) return 'top';
  if (ny === -1) return 'bottom';
  return 'side';
}
