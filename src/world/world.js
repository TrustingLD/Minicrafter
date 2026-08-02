// État du monde (voxels) + rendu via InstancedMesh : au lieu d'un Mesh (donc
// plusieurs appels de rendu) PAR bloc, chaque type de bloc a un unique objet GPU
// qui dessine toutes ses instances en un coup. C'est ce qui évite le lag sur un
// grand monde. (Le cap MAX_INSTANCES est la limite que Phase 4 des chunks lève.)

import * as THREE from 'three';
import { keyOf, WORLD_BORDER } from './generator.js';
import { texWater } from '../render/textures.js';

export const MAX_INSTANCES = 55000;

export function createWorld({ scene, geometry, materials, blockTypes, waterCells }) {
  const world = {};
  const instancedMeshes = {}; // type -> THREE.InstancedMesh
  const instanceKeys = {}; // type -> [key à l'index i, ...] (pour le swap-remove)
  const instancedMeshList = []; // liste à plat pour le raycasting
  const blockIndex = {}; // "x,y,z" -> { type, idx }
  const dummyObj = new THREE.Object3D();
  const tmpMatrix = new THREE.Matrix4();

  for (const type in blockTypes) {
    const im = new THREE.InstancedMesh(geometry, materials[type], MAX_INSTANCES);
    im.count = 0;
    im.castShadow = false; // le terrain ne projette pas d'ombre sur lui-même (coûteux) ...
    im.receiveShadow = true; // ... mais reçoit bien celle des mobs/arbres
    im.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    im.userData.blockType = type;
    // le bounding sphere par défaut ne couvre qu'un seul bloc : sans ça, des instances
    // visibles pourraient être supprimées à tort par le frustum culling
    im.frustumCulled = false;
    scene.add(im);
    instancedMeshes[type] = im;
    instanceKeys[type] = [];
  }

  function isSolid(x, y, z) {
    return !!world[keyOf(x, y, z)];
  }
  // collision boîte générique (utilisée par le joueur ET les mobs) : vérifie si une
  // boîte de rayon `radius` / hauteur `height` centrée en (x,z) et posée en y touche un bloc solide
  function collidesAtBox(x, y, z, radius, height) {
    // mur invisible en bordure du monde : bloque avant de jamais toucher isSolid,
    // pour ne pas avoir à générer/rendre de vrais blocs juste pour arrêter le joueur
    if (x - radius < -WORLD_BORDER || x + radius > WORLD_BORDER) return true;
    if (z - radius < -WORLD_BORDER || z + radius > WORLD_BORDER) return true;
    const minX = Math.floor(x - radius),
      maxX = Math.floor(x + radius);
    const minZ = Math.floor(z - radius),
      maxZ = Math.floor(z + radius);
    const minY = Math.floor(y),
      maxY = Math.floor(y + height);
    for (let bx = minX; bx <= maxX; bx++)
      for (let bz = minZ; bz <= maxZ; bz++)
        for (let by = minY; by <= maxY; by++) if (isSolid(bx, by, bz)) return true;
    return false;
  }
  function shouldRender(x, y, z) {
    return !(
      isSolid(x + 1, y, z) &&
      isSolid(x - 1, y, z) &&
      isSolid(x, y + 1, z) &&
      isSolid(x, y - 1, z) &&
      isSolid(x, y, z + 1) &&
      isSolid(x, y, z - 1)
    );
  }
  function addBlockMesh(x, y, z, type) {
    const key = keyOf(x, y, z);
    if (blockIndex[key]) return;
    const im = instancedMeshes[type];
    const idx = im.count;
    if (idx >= MAX_INSTANCES) return; // capacité atteinte (monde très dense) : on ignore silencieusement
    // +0.5 : BoxGeometry est centrée sur son origine, mais la grille de collision
    // (Math.floor dans collidesAtBox/isSolid) traite le bloc (x,y,z) comme occupant
    // [x, x+1) — sans ce décalage le rendu et la collision divergent de 0.5 sur les 3 axes.
    dummyObj.position.set(x + 0.5, y + 0.5, z + 0.5);
    dummyObj.scale.set(1, 1, 1);
    dummyObj.updateMatrix();
    im.setMatrixAt(idx, dummyObj.matrix);
    im.count = idx + 1;
    im.instanceMatrix.needsUpdate = true;
    instanceKeys[type][idx] = key;
    blockIndex[key] = { type, idx };
  }
  function removeBlockMesh(x, y, z) {
    const key = keyOf(x, y, z);
    const info = blockIndex[key];
    if (!info) return;
    const { type, idx } = info;
    const im = instancedMeshes[type];
    const lastIdx = im.count - 1;
    if (idx !== lastIdx) {
      // on déplace la dernière instance à la place de celle qu'on supprime (swap-remove)
      im.getMatrixAt(lastIdx, tmpMatrix);
      im.setMatrixAt(idx, tmpMatrix);
      const lastKey = instanceKeys[type][lastIdx];
      instanceKeys[type][idx] = lastKey;
      blockIndex[lastKey] = { type, idx };
    }
    im.count = lastIdx;
    im.instanceMatrix.needsUpdate = true;
    instanceKeys[type].length = lastIdx;
    delete blockIndex[key];
  }
  function refreshAround(x, y, z, radius = 1) {
    for (let dx = -radius; dx <= radius; dx++)
      for (let dy = -radius; dy <= radius; dy++)
        for (let dz = -radius; dz <= radius; dz++) {
          const bx = x + dx,
            by = y + dy,
            bz = z + dz;
          const type = world[keyOf(bx, by, bz)];
          if (type && shouldRender(bx, by, bz)) addBlockMesh(bx, by, bz, type);
          else removeBlockMesh(bx, by, bz);
        }
  }

  function buildInitialMeshes() {
    for (const key in world) {
      const [x, y, z] = key.split(',').map(Number);
      if (shouldRender(x, y, z)) addBlockMesh(x, y, z, world[key]);
    }
    Object.values(instancedMeshes).forEach((im) => instancedMeshList.push(im));
  }

  // Lacs : simple surface d'eau semi-transparente au niveau de la mer, rendue à
  // part (non solide, non interactive) pour rester légère.
  function buildWaterMesh(seaLevel) {
    const waterTex = texWater();
    const waterMat = new THREE.MeshLambertMaterial({
      map: waterTex,
      transparent: true,
      opacity: 0.65,
    });
    const waterMesh = new THREE.InstancedMesh(geometry, waterMat, Math.max(1, waterCells.length));
    waterMesh.frustumCulled = false;
    waterCells.forEach((cell, i) => {
      dummyObj.position.set(cell.x + 0.5, seaLevel + 0.35, cell.z + 0.5);
      dummyObj.scale.set(1, 0.12, 1);
      dummyObj.updateMatrix();
      waterMesh.setMatrixAt(i, dummyObj.matrix);
    });
    dummyObj.scale.set(1, 1, 1); // remise à zéro : dummyObj est réutilisé par addBlockMesh
    waterMesh.count = waterCells.length;
    waterMesh.instanceMatrix.needsUpdate = true;
    scene.add(waterMesh);
    return { mesh: waterMesh, texture: waterTex };
  }

  return {
    world,
    instancedMeshes,
    instanceKeys,
    instancedMeshList,
    blockIndex,
    isSolid,
    collidesAtBox,
    shouldRender,
    addBlockMesh,
    removeBlockMesh,
    refreshAround,
    buildInitialMeshes,
    buildWaterMesh,
  };
}
