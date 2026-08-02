// État du monde, maintenant en CHUNKS (Phase 4a) : plus de plafond MAX_INSTANCES,
// plus de `world = {}` géant tenu en mémoire — seuls les chunks proches du joueur
// existent, générés à la demande et déchargés une fois trop loin (leurs modifications
// survivent dans `diffs`, persistées dans localStorage). Le rendu utilise un atlas de
// textures + un mesher (Phase 5) : UN SEUL BufferGeometry par chunk au lieu d'un
// InstancedMesh par type de bloc — c'est ce qui fait chuter le nombre d'appels de rendu.
//
// Non fait (assumé, cf. PLAN.md §Phase 5.3) : le Web Worker. La génération + le
// meshing d'un chunk sont assez bon marché pour rester sur le thread principal tant
// qu'on les étale sur plusieurs frames (CHUNKS_PER_FRAME) — à mesurer si un jour ça
// stutter en vrai, plutôt que le construire par principe.

import * as THREE from 'three';
import { CHUNK_X, CHUNK_Y, CHUNK_Z, idx, chunkKey, worldToChunk, worldToLocal } from './chunk.js';
import {
  generateChunk,
  getGroundHeight as computeGroundHeight,
  SEA_LEVEL,
  WORLD_BORDER,
} from './generator.js';
import { BLOCK_ID, BLOCK_BY_ID } from '../data/blocks.js';
import { buildBlockAtlas } from '../render/atlas.js';
import { meshChunk } from '../render/mesher.js';
import { texWater } from '../render/textures.js';

export { WORLD_BORDER };

const RENDER_DISTANCE = 6; // en chunks (16 blocs) autour du joueur
const UNLOAD_DISTANCE = RENDER_DISTANCE + 2; // marge pour éviter de charger/décharger en boucle à la limite
const CHUNKS_PER_FRAME = 3; // étale génération+meshing sur plusieurs frames après le boot
const INITIAL_RADIUS = 3; // chargé de façon synchrone au démarrage (le reste suit via update())
const DIFF_STORAGE_KEY = 'minicrafter_diffs_v1';

function loadDiffs() {
  try {
    return JSON.parse(localStorage.getItem(DIFF_STORAGE_KEY) || '{}');
  } catch {
    return {};
  }
}

export function createWorld({ scene }) {
  const { texture: atlasTexture, uvByBlockId } = buildBlockAtlas();
  const atlasMaterial = new THREE.MeshLambertMaterial({ map: atlasTexture });

  // Lacs : une petite InstancedMesh par chunk, mais TOUTES partagent le même matériau
  // (donc la même texture) -> animer waterTexture.offset dans main.js fait défiler
  // l'eau de tous les chunks à la fois, sans avoir à les parcourir un par un.
  const waterTexture = texWater();
  const waterMaterial = new THREE.MeshLambertMaterial({
    map: waterTexture,
    transparent: true,
    opacity: 0.65,
  });
  const waterGeometry = new THREE.BoxGeometry(1, 0.24, 1);
  const waterDummy = new THREE.Object3D();

  const diffs = loadDiffs(); // "cx,cz" -> { localIdx: blockId }
  let diffsDirty = false;
  function flushDiffs() {
    if (!diffsDirty) return;
    diffsDirty = false;
    try {
      localStorage.setItem(DIFF_STORAGE_KEY, JSON.stringify(diffs));
    } catch {
      /* quota pleine ou stockage indisponible : tant pis, on continue sans persister */
    }
  }
  setInterval(flushDiffs, 2000);
  window.addEventListener('beforeunload', flushDiffs);

  const chunks = new Map(); // "cx,cz" -> record
  const chunkMeshList = []; // à plat, pour le raycasting (viseur bloc + occlusion caméra 3e perso)

  function applySavedDiffs(key, data) {
    const d = diffs[key];
    if (!d) return;
    for (const localIdx in d) data[localIdx] = d[localIdx];
  }

  function buildGeometry(data) {
    const { positions, normals, uvs, indices } = meshChunk(data, uvByBlockId);
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geo.setAttribute('normal', new THREE.BufferAttribute(normals, 3));
    geo.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));
    geo.setIndex(new THREE.BufferAttribute(indices, 1));
    return geo;
  }

  function buildWaterMesh(record) {
    if (record.waterCells.length === 0) return null;
    const mesh = new THREE.InstancedMesh(waterGeometry, waterMaterial, record.waterCells.length);
    record.waterCells.forEach((cell, i) => {
      waterDummy.position.set(
        record.cx * CHUNK_X + cell.lx + 0.5,
        SEA_LEVEL - 0.5 + 0.35,
        record.cz * CHUNK_Z + cell.lz + 0.5,
      );
      waterDummy.updateMatrix();
      mesh.setMatrixAt(i, waterDummy.matrix);
    });
    mesh.instanceMatrix.needsUpdate = true;
    return mesh;
  }

  function ensureChunk(cx, cz) {
    const key = chunkKey(cx, cz);
    let record = chunks.get(key);
    if (record) return record;

    const { data, waterCells } = generateChunk(cx, cz);
    applySavedDiffs(key, data);

    record = { cx, cz, key, data, waterCells, mesh: null, waterMesh: null };
    record.mesh = new THREE.Mesh(buildGeometry(data), atlasMaterial);
    record.mesh.position.set(cx * CHUNK_X, 0, cz * CHUNK_Z);
    record.mesh.receiveShadow = true;
    scene.add(record.mesh);
    chunkMeshList.push(record.mesh);

    record.waterMesh = buildWaterMesh(record);
    if (record.waterMesh) scene.add(record.waterMesh);

    chunks.set(key, record);
    return record;
  }

  function remesh(record) {
    record.mesh.geometry.dispose();
    record.mesh.geometry = buildGeometry(record.data);
  }

  function unloadChunk(record) {
    scene.remove(record.mesh);
    record.mesh.geometry.dispose();
    const i = chunkMeshList.indexOf(record.mesh);
    if (i >= 0) chunkMeshList.splice(i, 1);
    // waterGeometry/waterMaterial sont partagés par tous les chunks : on ne les
    // dispose jamais ici, seulement retirer CE mesh de la scène.
    if (record.waterMesh) scene.remove(record.waterMesh);
    chunks.delete(record.key);
    // NB: `diffs` n'est PAS nettoyé ici — les modifications du joueur doivent survivre
    // au déchargement, elles sont réappliquées par applySavedDiffs() au rechargement.
  }

  function getBlock(x, y, z) {
    if (y < 0 || y >= CHUNK_Y) return null;
    const [cx, cz] = worldToChunk(x, z);
    const record = ensureChunk(cx, cz);
    const [lx, lz] = worldToLocal(x, z);
    const id = record.data[idx(lx, y, lz)];
    return id ? BLOCK_BY_ID[id] : null;
  }

  function setBlock(x, y, z, type) {
    if (y < 0 || y >= CHUNK_Y) return;
    const [cx, cz] = worldToChunk(x, z);
    const record = ensureChunk(cx, cz);
    const [lx, lz] = worldToLocal(x, z);
    const i = idx(lx, y, lz);
    const id = type ? BLOCK_ID[type] : 0;
    if (record.data[i] === id) return;
    record.data[i] = id;
    if (!diffs[record.key]) diffs[record.key] = {};
    diffs[record.key][i] = id;
    diffsDirty = true;
    remesh(record);
  }

  function isSolid(x, y, z) {
    return !!getBlock(x, y, z);
  }

  // collision boîte générique (utilisée par le joueur ET les mobs) : identique à
  // l'ancienne version, seule la source des blocs (getBlock au lieu de world{}) change.
  function collidesAtBox(x, y, z, radius, height) {
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

  function getGroundHeight(x, z) {
    return computeGroundHeight(getBlock, x, z);
  }

  // charge un disque de chunks autour de (x,z) de façon SYNCHRONE (pas de budget par
  // frame) — utilisé une seule fois au boot pour que le joueur n'apparaisse pas au
  // milieu du vide. Le reste du monde suit via update(), étalé sur plusieurs frames.
  function preload(x, z, radiusChunks) {
    const [pcx, pcz] = worldToChunk(x, z);
    for (let dx = -radiusChunks; dx <= radiusChunks; dx++)
      for (let dz = -radiusChunks; dz <= radiusChunks; dz++)
        if (dx * dx + dz * dz <= radiusChunks * radiusChunks) ensureChunk(pcx + dx, pcz + dz);
  }
  preload(0, 0, INITIAL_RADIUS);

  // appelée chaque frame : charge les chunks proches du joueur (quelques-uns par
  // frame seulement, pour ne jamais bloquer une frame entière) et décharge ceux
  // devenus trop lointains.
  function update(playerPos) {
    const [pcx, pcz] = worldToChunk(playerPos.x, playerPos.z);
    const candidates = [];
    for (let dx = -RENDER_DISTANCE; dx <= RENDER_DISTANCE; dx++) {
      for (let dz = -RENDER_DISTANCE; dz <= RENDER_DISTANCE; dz++) {
        const d2 = dx * dx + dz * dz;
        if (d2 > RENDER_DISTANCE * RENDER_DISTANCE) continue;
        const cx = pcx + dx,
          cz = pcz + dz;
        if (Math.abs(cx * CHUNK_X) > WORLD_BORDER + CHUNK_X) continue;
        if (Math.abs(cz * CHUNK_Z) > WORLD_BORDER + CHUNK_Z) continue;
        if (!chunks.has(chunkKey(cx, cz))) candidates.push({ cx, cz, d2 });
      }
    }
    candidates.sort((a, b) => a.d2 - b.d2);
    for (let i = 0; i < Math.min(CHUNKS_PER_FRAME, candidates.length); i++)
      ensureChunk(candidates[i].cx, candidates[i].cz);

    for (const record of Array.from(chunks.values())) {
      const dx = record.cx - pcx,
        dz = record.cz - pcz;
      if (dx * dx + dz * dz > UNLOAD_DISTANCE * UNLOAD_DISTANCE) unloadChunk(record);
    }
  }

  return {
    getBlock,
    setBlock,
    isSolid,
    collidesAtBox,
    getGroundHeight,
    update,
    chunkMeshList,
    waterTexture,
  };
}
