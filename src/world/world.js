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
  getHeight,
  SEA_LEVEL,
  WORLD_BORDER,
} from './generator.js';
import { BLOCK_ID, BLOCK_BY_ID } from '../data/blocks.js';
import { buildBlockAtlas } from '../render/atlas.js';
import { meshChunk } from '../render/mesher.js';
import { texWater, texLava } from '../render/textures.js';

export { WORLD_BORDER };

const DEFAULT_RENDER_DISTANCE = 6; // en chunks (16 blocs) autour du joueur
// Budget de temps (ms) par frame pour charger de nouveaux chunks, plutôt qu'un
// nombre fixe : un compte fixe (l'ancien CHUNKS_PER_FRAME=3) ne protège pas la frame
// si un chunk particulier est plus coûteux (relief accidenté, beaucoup de veines/
// grottes à sculpter) — un budget en temps absorbe cette variance automatiquement.
const CHUNK_LOAD_BUDGET_MS = 8;
const MAX_CHUNKS_PER_FRAME = 2; // garde-fou : jamais plus que ça même si le budget temps le permettrait
const INITIAL_RADIUS = 3; // chargé de façon synchrone au démarrage (le reste suit via update())
const DIFF_STORAGE_KEY = 'minicrafter_diffs_v1';

function loadDiffs() {
  try {
    return JSON.parse(localStorage.getItem(DIFF_STORAGE_KEY) || '{}');
  } catch {
    return {};
  }
}

// renderDistance réglable (Phase 6, qualité adaptative) : un mobile tient une distance
// de rendu plus courte qu'un desktop pour le même budget de frame.
export function createWorld({ scene, renderDistance = DEFAULT_RENDER_DISTANCE }) {
  const RENDER_DISTANCE = renderDistance;
  const UNLOAD_DISTANCE = RENDER_DISTANCE + 2; // marge pour éviter de charger/décharger en boucle à la limite
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
  // cube unité : la hauteur réelle de chaque lac (variable selon la profondeur du
  // bassin) est appliquée via l'échelle de la matrice d'instance dans buildWaterMesh,
  // pas via la géométrie elle-même — ainsi un seul mesh partagé peut représenter des
  // lacs peu profonds sur les berges et bien plus profonds au centre du bassin.
  const waterGeometry = new THREE.BoxGeometry(1, 1, 1);
  const waterDummy = new THREE.Object3D();

  // Lave (Phase 4c) : même schéma que l'eau (InstancedMesh partagée par chunk), mais
  // en MeshBasicMaterial (non affecté par l'éclairage de la scène) pour qu'elle reste
  // incandescente même dans le noir complet d'une caverne profonde -- une lave "éteinte"
  // sous MeshLambertMaterial perdrait tout son intérêt visuel comme signal de danger.
  const lavaTexture = texLava();
  const lavaMaterial = new THREE.MeshBasicMaterial({ map: lavaTexture });
  const lavaGeometry = new THREE.BoxGeometry(1, 1, 1);
  const lavaDummy = new THREE.Object3D();

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
      // remplit toute la colonne du fond du bassin (cell.h + 1) jusqu'à la surface
      // (SEA_LEVEL) : avant, une simple plaque fine flottait au niveau de la mer,
      // laissant un lac "creux" et sans fond visible dès qu'on s'en approchait.
      const depth = Math.max(0.3, SEA_LEVEL - cell.h);
      waterDummy.position.set(
        record.cx * CHUNK_X + cell.lx + 0.5,
        cell.h + 1 + depth / 2 - 0.15,
        record.cz * CHUNK_Z + cell.lz + 0.5,
      );
      waterDummy.scale.set(1, depth, 1);
      waterDummy.updateMatrix();
      mesh.setMatrixAt(i, waterDummy.matrix);
    });
    mesh.instanceMatrix.needsUpdate = true;
    return mesh;
  }

  // contrairement à l'eau (une plaque de hauteur variable par colonne), une mare de
  // lave est un volume de cellules déjà creusées une à une par le générateur -> chaque
  // cellule est simplement un cube plein 1x1x1 posé à sa position exacte.
  function buildLavaMesh(record) {
    if (record.lavaCells.length === 0) return null;
    const mesh = new THREE.InstancedMesh(lavaGeometry, lavaMaterial, record.lavaCells.length);
    record.lavaCells.forEach((cell, i) => {
      lavaDummy.position.set(
        record.cx * CHUNK_X + cell.lx + 0.5,
        cell.ly + 0.5,
        record.cz * CHUNK_Z + cell.lz + 0.5,
      );
      lavaDummy.scale.set(1, 1, 1);
      lavaDummy.updateMatrix();
      mesh.setMatrixAt(i, lavaDummy.matrix);
    });
    mesh.instanceMatrix.needsUpdate = true;
    return mesh;
  }

  function ensureChunk(cx, cz) {
    const key = chunkKey(cx, cz);
    let record = chunks.get(key);
    if (record) return record;

    const { data, waterCells, lavaCells } = generateChunk(cx, cz);
    applySavedDiffs(key, data);

    // lookup rapide "lx,ly,lz" -> cellule de lave, pour isInLava() sans reparcourir
    // le tableau à chaque frame (cf. commentaire sur isInLava plus bas)
    const lavaSet = new Set(lavaCells.map((c) => `${c.lx},${c.ly},${c.lz}`));

    record = {
      cx,
      cz,
      key,
      data,
      waterCells,
      lavaCells,
      lavaSet,
      mesh: null,
      waterMesh: null,
      lavaMesh: null,
    };
    record.mesh = new THREE.Mesh(buildGeometry(data), atlasMaterial);
    record.mesh.position.set(cx * CHUNK_X, 0, cz * CHUNK_Z);
    record.mesh.receiveShadow = true;
    scene.add(record.mesh);

    record.waterMesh = buildWaterMesh(record);
    if (record.waterMesh) scene.add(record.waterMesh);

    record.lavaMesh = buildLavaMesh(record);
    if (record.lavaMesh) scene.add(record.lavaMesh);

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
    // waterGeometry/waterMaterial (et pareil pour la lave) sont partagés par tous les
    // chunks : on ne les dispose jamais ici, seulement retirer CE mesh de la scène.
    // `.dispose()` sur l'InstancedMesh lui-même ne touche ni geometry ni material —
    // il libère uniquement le buffer instanceMatrix, propre à ce mesh.
    if (record.waterMesh) {
      scene.remove(record.waterMesh);
      record.waterMesh.dispose();
      record.waterMesh = null;
    }
    if (record.lavaMesh) {
      scene.remove(record.lavaMesh);
      record.lavaMesh.dispose();
      record.lavaMesh = null;
    }
    chunks.delete(record.key);
    // NB: `diffs` n'est PAS nettoyé ici — les modifications du joueur doivent survivre
    // au déchargement, elles sont réappliquées par applySavedDiffs() au rechargement.
  }

  // Lecture PURE : ne génère jamais de chunk (c'était la cause de la chute de FPS
  // en exploration — cf. PERF_PLAN.md §0). Trois retours distincts :
  //   - une string  : le nom du bloc
  //   - null        : de l'air (ou hors du monde en Y), chunk connu
  //   - undefined   : chunk NON CHARGÉ, contenu inconnu
  function getBlock(x, y, z) {
    if (y < 0 || y >= CHUNK_Y) return null;
    const [cx, cz] = worldToChunk(x, z);
    const record = chunks.get(chunkKey(cx, cz));
    if (!record) return undefined; // inconnu != air
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

  // Un chunk non chargé est traité comme PLEIN, pas comme de l'air : sinon toute
  // entité située hors de la zone chargée tomberait à travers le monde. Le joueur
  // n'atteint jamais ces coordonnées (les chunks se chargent bien avant lui), et un
  // mob gelé loin du joueur n'a pas besoin d'une collision exacte.
  function isSolid(x, y, z) {
    const t = getBlock(x, y, z);
    if (t === undefined) return true;
    return !!t;
  }

  // la lave n'est PAS stockée dans `data` (comme l'eau) : elle est traversable/non
  // solide par nature (on doit pouvoir y tomber dedans), donc on la teste via son
  // propre index plutôt que via getBlock/isSolid.
  function isInLava(x, y, z) {
    const [cx, cz] = worldToChunk(x, z);
    const record = chunks.get(chunkKey(cx, cz));
    if (!record || record.lavaSet.size === 0) return false;
    const [lx, lz] = worldToLocal(x, z);
    const ly = Math.floor(y);
    return record.lavaSet.has(`${lx},${ly},${lz}`);
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

  // Si le chunk n'est pas chargé, getBlock renvoie `undefined` partout et le scan
  // retournerait 1 (= le joueur/mob apparaîtrait sous terre). On retombe alors sur
  // la hauteur de terrain analytique du bruit, qui ne demande aucun chunk.
  function getGroundHeight(x, z) {
    const [cx, cz] = worldToChunk(x, z);
    if (!chunks.has(chunkKey(cx, cz))) return getHeight(Math.round(x), Math.round(z)) + 1;
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

  // File de chargement persistante : la liste des chunks manquants et le scan de
  // déchargement ne dépendent QUE du chunk où se trouve le joueur. Les recalculer à
  // chaque frame (169 candidats + Array.from sur ~113 chunks) était du pur gaspillage
  // à 60 Hz alors que le joueur ne change de chunk que toutes les ~3 secondes.
  let lastPcx = null;
  let lastPcz = null;
  let loadQueue = [];

  function rebuildLoadQueue(pcx, pcz) {
    loadQueue.length = 0;
    for (let dx = -RENDER_DISTANCE; dx <= RENDER_DISTANCE; dx++) {
      for (let dz = -RENDER_DISTANCE; dz <= RENDER_DISTANCE; dz++) {
        const d2 = dx * dx + dz * dz;
        if (d2 > RENDER_DISTANCE * RENDER_DISTANCE) continue;
        const cx = pcx + dx;
        const cz = pcz + dz;
        if (Math.abs(cx * CHUNK_X) > WORLD_BORDER + CHUNK_X) continue;
        if (Math.abs(cz * CHUNK_Z) > WORLD_BORDER + CHUNK_Z) continue;
        if (!chunks.has(chunkKey(cx, cz))) loadQueue.push({ cx, cz, d2 });
      }
    }
    loadQueue.sort((a, b) => a.d2 - b.d2);
  }

  function unloadFar(pcx, pcz) {
    for (const record of chunks.values()) {
      const dx = record.cx - pcx;
      const dz = record.cz - pcz;
      if (dx * dx + dz * dz > UNLOAD_DISTANCE * UNLOAD_DISTANCE) unloadChunk(record);
    }
  }

  // appelée chaque frame : charge les chunks proches du joueur (quelques-uns par
  // frame seulement, pour ne jamais bloquer une frame entière) et décharge ceux
  // devenus trop lointains. La file/le scan ne sont reconstruits que si le joueur a
  // changé de chunk depuis la frame précédente (cf. commentaire au-dessus).
  function update(playerPos) {
    const [pcx, pcz] = worldToChunk(playerPos.x, playerPos.z);
    if (pcx !== lastPcx || pcz !== lastPcz) {
      lastPcx = pcx;
      lastPcz = pcz;
      rebuildLoadQueue(pcx, pcz);
      unloadFar(pcx, pcz);
    }
    if (loadQueue.length === 0) return;

    const start = performance.now();
    let loaded = 0;
    while (loadQueue.length > 0 && loaded < MAX_CHUNKS_PER_FRAME) {
      // budget testé AVANT : l'ancienne version chargeait toujours au moins un chunk
      // (~11-15 ms) avant de regarder l'heure, ce qui plafonnait la frame à ~55 FPS
      // en déplacement continu. On garde le tout premier chunk inconditionnel pour
      // ne jamais stagner (sinon on peut ne rien charger indéfiniment).
      if (loaded > 0 && performance.now() - start > CHUNK_LOAD_BUDGET_MS) break;
      const c = loadQueue.shift();
      if (!chunks.has(chunkKey(c.cx, c.cz))) ensureChunk(c.cx, c.cz);
      loaded++;
    }
  }

  return {
    getBlock,
    setBlock,
    isSolid,
    isInLava,
    collidesAtBox,
    getGroundHeight,
    update,
    waterTexture,
    lavaTexture,
  };
}