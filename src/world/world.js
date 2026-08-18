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
import {
  CHUNK_X,
  CHUNK_Y,
  CHUNK_Z,
  idx,
  chunkKey,
  worldToChunk,
  worldToLocal,
  inBounds,
} from './chunk.js';
import {
  generateChunk,
  getGroundHeight as computeGroundHeight,
  getHeight,
  SEA_LEVEL,
  WORLD_BORDER,
} from './generator.js';
import { BLOCK_ID, BLOCK_BY_ID, BLOCK_TYPES, LIQUID_IDS, SHAPE_BY_ID } from '../data/blocks.js';
import { buildBlockAtlas } from '../render/atlas.js';
import { meshChunk, meshLiquid } from '../render/mesher.js';
import { texWater, texLava } from '../render/textures.js';
import {
  propagate as propagateLight,
  propagateSkylight,
  propagateSkylightColumn,
  removeLight,
  computeSkylightColumn,
} from './light.js';
import { stepFluidQueue } from './fluid.js';

// un bloc bloque la lumière s'il existe, n'est pas un liquide (Phase 16 : l'eau
// laisse filtrer la lumière, une mare de lave est sa propre source) et remplit
// vraiment sa cellule. La torche est exclue via SHAPE_BY_ID : ce n'est qu'un
// bâtonnet fin, il serait absurde qu'il projette une colonne d'ombre sous lui ou
// qu'il coupe le couloir qu'il est censé éclairer.
function isOpaqueBlock(id) {
  return id !== 0 && !LIQUID_IDS.has(id) && !SHAPE_BY_ID[id];
}

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

// Écoulement (Phase 16.3) : au plus FLUID_BUDGET cellules traitées par tic, à
// FLUID_TICK_RATE Hz -- jamais un balayage du monde, seulement la file active
// (cf. world/fluid.js). Un barrage cassé d'un coup ne peut donc jamais geler une frame.
const FLUID_TICK_RATE = 0.2; // 5 Hz
const FLUID_BUDGET = 48;

function loadDiffs() {
  try {
    return JSON.parse(localStorage.getItem(DIFF_STORAGE_KEY) || '{}');
  } catch {
    return {};
  }
}

// renderDistance réglable (Phase 6, qualité adaptative) : un mobile tient une distance
// de rendu plus courte qu'un desktop pour le même budget de frame.
export function createWorld({
  scene,
  renderDistance = DEFAULT_RENDER_DISTANCE,
  preloadAt = { x: 0, z: 0 },
  // (x, y, z, present) : une torche entre dans le monde chargé ou en sort. Couvre les
  // trois cas d'un coup — posée/cassée par le joueur, restaurée depuis les diffs au
  // chargement d'un chunk, retirée au déchargement — pour que l'appelant n'ait pas à
  // les suivre séparément (c'est ce qu'il faisait, et il en ratait deux sur trois).
  onTorchesChanged = (_x, _y, _z, _present) => {},
}) {
  const RENDER_DISTANCE = renderDistance;
  const UNLOAD_DISTANCE = RENDER_DISTANCE + 2; // marge pour éviter de charger/décharger en boucle à la limite
  const { texture: atlasTexture, uvByBlockId } = buildBlockAtlas();
  // vertexColors (Phase 13) : le mesher écrit un niveau de lumière par sommet dans
  // l'attribut 'color' -- zéro appel de rendu de plus, juste un buffer de plus.
  // alphaTest (pas `transparent: true`) : découpe les pixels à alpha quasi-nul
  // (herbe haute en croix, cf. mesher.js `shape.cross` + textures.js texWeeds)
  // sans activer le tri par profondeur ni le blending — tous les autres blocs de
  // l'atlas sont opaques (alpha=1 partout), donc ce réglage ne change rien pour eux.
  const atlasMaterial = new THREE.MeshLambertMaterial({
    map: atlasTexture,
    vertexColors: true,
    alphaTest: 0.5,
  });

  // Eau/lave (Phase 16) : géométrie PAR CHUNK (comme le terrain), mais matériau
  // PARTAGÉ entre tous les chunks -> animer .offset une fois dans main.js fait
  // défiler l'eau/la lave de tout le monde chargé sans avoir à les parcourir un par un.
  const waterTexture = texWater();
  const waterMaterial = new THREE.MeshLambertMaterial({
    map: waterTexture,
    vertexColors: true,
    transparent: true,
    opacity: 0.7,
  });
  const lavaTexture = texLava();
  // MeshBasicMaterial (pas affectée par l'éclairage de la scène) : une mare de lave
  // reste incandescente même dans le noir complet d'une caverne -- perdrait tout son
  // intérêt visuel comme signal de danger sous un Lambert assombri par l'ambiance nocturne.
  const lavaMaterial = new THREE.MeshBasicMaterial({ map: lavaTexture });

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

  function buildGeometry(data, lightData) {
    const { positions, normals, uvs, colors, indices } = meshChunk(
      data,
      uvByBlockId,
      lightData,
      LIQUID_IDS,
      SHAPE_BY_ID,
    );
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geo.setAttribute('normal', new THREE.BufferAttribute(normals, 3));
    geo.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));
    geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    geo.setIndex(new THREE.BufferAttribute(indices, 1));
    return geo;
  }

  function buildLiquidGeometry(data, targetId, lightData) {
    const { positions, normals, uvs, colors, indices } = meshLiquid(
      data,
      targetId,
      LIQUID_IDS,
      lightData,
    );
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geo.setAttribute('normal', new THREE.BufferAttribute(normals, 3));
    geo.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));
    geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    geo.setIndex(new THREE.BufferAttribute(indices, 1));
    return geo;
  }

  // Lumière (Phase 13) : v1, un seul lightmap par chunk, ne se propage pas au-delà
  // de ses bords (cf. world/light.js). Recalculée à chaque (re)chargement de chunk
  // plutôt que persistée : entièrement dérivable de `data` (position des torches +
  // du ciel), donc pas besoin de la sauvegarder à côté des diffs.
  const TORCH_ID = BLOCK_ID.torch;
  const LAVA_ID = BLOCK_ID.lava;
  // Retourne { lightData, torches } — `torches` est la liste des torches LOCALES
  // trouvées dans le chunk. On la remonte à l'appelant (main.js, via onTorchesChanged)
  // parce que le pool de PointLight ne connaissait jusqu'ici que les torches posées
  // à la main pendant la session : après un rechargement de page, une torche restaurée
  // depuis les diffs sauvegardés revenait bien dans le monde, mais sans sa lumière 3D.
  function computeInitialLight(data) {
    const lightData = new Uint8Array(CHUNK_X * CHUNK_Y * CHUNK_Z);
    const torches = [];
    for (let lx = 0; lx < CHUNK_X; lx++)
      for (let lz = 0; lz < CHUNK_Z; lz++)
        computeSkylightColumn(data, lightData, lx, lz, isOpaqueBlock);
    // le ciel doit aussi se diffuser LATÉRALEMENT, sinon tout ce qui est sous un
    // feuillage tombe à 0 d'un coup (ombre noire sous les arbres) — cf. light.js
    propagateSkylight(data, lightData, isOpaqueBlock);
    const sources = [];
    for (let lx = 0; lx < CHUNK_X; lx++)
      for (let ly = 0; ly < CHUNK_Y; ly++)
        for (let lz = 0; lz < CHUNK_Z; lz++) {
          const id = data[idx(lx, ly, lz)];
          if (id === TORCH_ID) {
            sources.push({ x: lx, y: ly, z: lz, level: BLOCK_TYPES.torch.emitsLight });
            torches.push({ lx, ly, lz });
          } else if (id === LAVA_ID)
            sources.push({ x: lx, y: ly, z: lz, level: BLOCK_TYPES.lava.emitsLight });
        }
    if (sources.length) propagateLight(data, lightData, sources, isOpaqueBlock);
    return { lightData, torches };
  }

  function buildLiquidMeshes(record) {
    record.waterMesh = new THREE.Mesh(
      buildLiquidGeometry(record.data, BLOCK_ID.water, record.lightData),
      waterMaterial,
    );
    record.waterMesh.position.set(record.cx * CHUNK_X, 0, record.cz * CHUNK_Z);
    scene.add(record.waterMesh);
    record.lavaMesh = new THREE.Mesh(
      buildLiquidGeometry(record.data, BLOCK_ID.lava, record.lightData),
      lavaMaterial,
    );
    record.lavaMesh.position.set(record.cx * CHUNK_X, 0, record.cz * CHUNK_Z);
    scene.add(record.lavaMesh);
  }

  function ensureChunk(cx, cz) {
    const key = chunkKey(cx, cz);
    let record = chunks.get(key);
    if (record) return record;

    const { data } = generateChunk(cx, cz);
    applySavedDiffs(key, data);
    const { lightData, torches } = computeInitialLight(data);
    for (const t of torches) onTorchesChanged(cx * CHUNK_X + t.lx, t.ly, cz * CHUNK_Z + t.lz, true);

    record = { cx, cz, key, data, lightData, torches, mesh: null, waterMesh: null, lavaMesh: null };
    record.mesh = new THREE.Mesh(buildGeometry(data, lightData), atlasMaterial);
    record.mesh.position.set(cx * CHUNK_X, 0, cz * CHUNK_Z);
    record.mesh.receiveShadow = true;
    scene.add(record.mesh);

    buildLiquidMeshes(record);

    chunks.set(key, record);
    return record;
  }

  function remesh(record) {
    record.mesh.geometry.dispose();
    record.mesh.geometry = buildGeometry(record.data, record.lightData);
    record.waterMesh.geometry.dispose();
    record.waterMesh.geometry = buildLiquidGeometry(record.data, BLOCK_ID.water, record.lightData);
    record.lavaMesh.geometry.dispose();
    record.lavaMesh.geometry = buildLiquidGeometry(record.data, BLOCK_ID.lava, record.lightData);
  }

  function unloadChunk(record) {
    // les torches de ce chunk quittent le monde chargé : sans ça le pool de PointLight
    // gardait des positions fantômes et pouvait dépenser ses 8 lumières sur des
    // torches déchargées, donc invisibles.
    for (const t of record.torches)
      onTorchesChanged(record.cx * CHUNK_X + t.lx, t.ly, record.cz * CHUNK_Z + t.lz, false);
    scene.remove(record.mesh);
    record.mesh.geometry.dispose();
    // waterMaterial/lavaMaterial sont partagés par tous les chunks : jamais disposés
    // ici, seulement la géométrie (propre à CE chunk) et le retrait de la scène.
    scene.remove(record.waterMesh);
    record.waterMesh.geometry.dispose();
    scene.remove(record.lavaMesh);
    record.lavaMesh.geometry.dispose();
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

  // File active de l'écoulement (Phase 16.3) : {x,y,z,type,dist}[], jamais un scan
  // du monde. Alimentée quand un bloc devient de l'air à côté d'un liquide (cassé
  // par le joueur) -- "breaking a block adjacent to water enqueues that cell" (PLAN.md).
  let fluidQueue = [];
  const FLUID_NEIGHBORS = [
    [1, 0, 0],
    [-1, 0, 0],
    [0, 1, 0],
    [0, -1, 0],
    [0, 0, 1],
    [0, 0, -1],
  ];
  function enqueueFluidNeighbors(x, y, z) {
    for (const [dx, dy, dz] of FLUID_NEIGHBORS) {
      const t = getBlock(x + dx, y + dy, z + dz);
      if (t && BLOCK_TYPES[t]?.liquid)
        fluidQueue.push({ x: x + dx, y: y + dy, z: z + dz, type: t, dist: 0 });
    }
  }

  function setBlock(x, y, z, type) {
    if (y < 0 || y >= CHUNK_Y) return;
    const [cx, cz] = worldToChunk(x, z);
    const record = ensureChunk(cx, cz);
    const [lx, lz] = worldToLocal(x, z);
    const i = idx(lx, y, lz);
    const id = type ? BLOCK_ID[type] : 0;
    if (record.data[i] === id) return;
    const oldType = record.data[i] ? BLOCK_BY_ID[record.data[i]] : null;
    record.data[i] = id;
    if (!diffs[record.key]) diffs[record.key] = {};
    diffs[record.key][i] = id;
    diffsDirty = true;

    if (!type) enqueueFluidNeighbors(x, y, z); // un bloc vient de disparaître : les liquides voisins peuvent s'y engouffrer

    // suivi des torches du chunk (cf. onTorchesChanged) : c'est ici, et pas chez
    // l'appelant, parce que c'est le seul point de passage de TOUTE modification.
    if (oldType === 'torch') {
      const at = record.torches.findIndex((t) => t.lx === lx && t.ly === y && t.lz === lz);
      if (at >= 0) record.torches.splice(at, 1);
      onTorchesChanged(x, y, z, false);
    }
    if (type === 'torch') {
      record.torches.push({ lx, ly: y, lz });
      onTorchesChanged(x, y, z, true);
    }

    // Lumière (Phase 13) : ne remet à jour QUE deux cas -- une torche/lave posée/cassée
    // (source ajoutée/retirée) et le ciel de CETTE colonne qui s'ouvre plus loin
    // (computeSkylightColumn refait tout le balayage top-down, donc creuser un
    // puits jusqu'à une grotte la rallume correctement). Ce que la v1 ne fait PAS :
    // reculer une lumière déjà propagée quand un mur est posé au milieu d'un couloir
    // déjà éclairé par une torche lointaine, ou effacer un rayon de ciel déjà posé
    // quand on referme le trou au-dessus -- la "couture" assumée du plan (§Phase 13),
    // qui se résorbe au prochain rechargement du chunk.
    const oldEmits = oldType && BLOCK_TYPES[oldType]?.emitsLight;
    const newEmits = type && BLOCK_TYPES[type]?.emitsLight;
    if (oldEmits) removeLight(record.data, record.lightData, lx, y, lz, isOpaqueBlock);
    if (newEmits)
      propagateLight(
        record.data,
        record.lightData,
        [{ x: lx, y, z: lz, level: newEmits }],
        isOpaqueBlock,
      );
    // Fix : un bloc plein ne porte JAMAIS de lumière (spread() refuse d'écrire dans
    // l'opaque, cf. light.js) -- sa cellule reste donc à 0 tant qu'il est là. Le
    // casser (ou le remplacer par une torche/de l'eau, non-opaques) EXPOSE cette
    // cellule à 0 aux voisins déjà éclairés (couloir éclairé à la torche, grotte
    // ouverte...) sans qu'aucun BFS ne la ré-ensemence -- d'où les faces des blocs
    // d'à côté qui tombent au minimum (quasi noir) juste après avoir creusé. On
    // relance donc propagate() depuis les 6 voisins à LEUR niveau actuel : spread()
    // recalcule tout seul la bonne valeur (niveau du voisin - 1) pour cette cellule,
    // puis continue de proche en proche si ça rallume plus loin que prévu.
    if (!isOpaqueBlock(id)) {
      const relightSources = [];
      for (const [dx, dy, dz] of FLUID_NEIGHBORS) {
        const nx = lx + dx,
          ny = y + dy,
          nz = lz + dz;
        if (!inBounds(nx, ny, nz)) continue;
        const level = record.lightData[idx(nx, ny, nz)];
        if (level > 1) relightSources.push({ x: nx, y: ny, z: nz, level });
      }
      if (relightSources.length)
        propagateLight(record.data, record.lightData, relightSources, isOpaqueBlock);
    }
    computeSkylightColumn(record.data, record.lightData, lx, lz, isOpaqueBlock);
    // même raison qu'au chargement du chunk : creuser rouvre une colonne au ciel, et
    // ce ciel doit se répandre de côté sous le trou, pas juste tomber tout droit.
    // Version colonne (pas chunk entier) : setBlock est sur le chemin chaud des
    // liquides, cf. le commentaire de propagateSkylightColumn.
    propagateSkylightColumn(record.data, record.lightData, lx, lz, isOpaqueBlock);

    remesh(record);
  }

  // appelée au tic (FLUID_TICK_RATE, pas la frame) : avance la file active d'écoulement
  // par petits lots. `getBlock` retourne déjà undefined pour un chunk non chargé, donc
  // stepFluidQueue s'arrête tout seul aux limites du monde chargé (cf. fluid.js).
  let fluidTickAccum = 0;
  function updateFluids(dt) {
    if (fluidQueue.length === 0) return;
    fluidTickAccum += dt;
    while (fluidTickAccum >= FLUID_TICK_RATE) {
      fluidTickAccum -= FLUID_TICK_RATE;
      if (fluidQueue.length === 0) break;
      const { spread, remaining } = stepFluidQueue(fluidQueue, FLUID_BUDGET, getBlock);
      fluidQueue = remaining;
      for (const cell of spread) {
        setBlock(cell.x, cell.y, cell.z, cell.type);
        fluidQueue.push(cell); // continue de se propager depuis sa nouvelle position au prochain tic
      }
    }
  }

  // Un chunk non chargé est traité comme PLEIN, pas comme de l'air : sinon toute
  // entité située hors de la zone chargée tomberait à travers le monde. Le joueur
  // n'atteint jamais ces coordonnées (les chunks se chargent bien avant lui), et un
  // mob gelé loin du joueur n'a pas besoin d'une collision exacte.
  function isSolid(x, y, z) {
    const t = getBlock(x, y, z);
    if (t === undefined) return true;
    if (!t) return false;
    return BLOCK_TYPES[t]?.solid !== false; // solide par défaut ; torche/eau/lave disent non
  }

  // Phase 16 : la lave est un vrai bloc désormais, getBlock suffit -- plus besoin
  // d'un index séparé (lavaSet) comme avant que ce ne soit stocké dans `data`.
  function isInLava(x, y, z) {
    return getBlock(Math.floor(x), Math.floor(y), Math.floor(z)) === 'lava';
  }
  function isInWater(x, y, z) {
    return getBlock(Math.floor(x), Math.floor(y), Math.floor(z)) === 'water';
  }

  // Contact avec un cactus (dégâts) : contrairement à isInLava/isInWater (un seul
  // point), le cactus est un bloc SOLIDE — collidesAtBox empêche donc la boîte du
  // joueur d'y pénétrer, elle s'arrête TOUJOURS à une distance non nulle de sa
  // face (resolveHorizontalMove rejette carrément le déplacement de la frame,
  // sans "glisser" jusqu'au contact exact -- l'écart restant peut donc être de
  // plusieurs centimètres, jusqu'à ~0.1-0.2 en marchant, plus en sprintant). Un
  // scan à ras (comme collidesAtBox) ne matcherait donc quasiment jamais : on
  // élargit la boîte d'une marge de contact pour capter "collé contre" plutôt que
  // "à l'intérieur de".
  const CACTUS_TOUCH_MARGIN = 0.25;
  function isTouchingCactus(x, y, z, radius, height) {
    const r = radius + CACTUS_TOUCH_MARGIN;
    const minX = Math.floor(x - r),
      maxX = Math.floor(x + r);
    const minZ = Math.floor(z - r),
      maxZ = Math.floor(z + r);
    const minY = Math.floor(y),
      maxY = Math.floor(y + height);
    for (let bx = minX; bx <= maxX; bx++)
      for (let bz = minZ; bz <= maxZ; bz++)
        for (let by = minY; by <= maxY; by++) if (getBlock(bx, by, bz) === 'cactus') return true;
    return false;
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
  // centré sur le point d'apparition, pas sur (0,0) : les deux ne coïncident plus
  // depuis que le spawn est cherché plutôt que supposé (cf. findSpawnColumn).
  preload(preloadAt.x, preloadAt.z, INITIAL_RADIUS);

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
  // frame seulement, pour ne jamais bloquer une frame entière), décharge ceux
  // devenus trop lointains, et avance l'écoulement des liquides. La file/le scan de
  // chargement ne sont reconstruits que si le joueur a changé de chunk (cf. plus haut).
  function update(playerPos, dt = 0) {
    const [pcx, pcz] = worldToChunk(playerPos.x, playerPos.z);
    if (pcx !== lastPcx || pcz !== lastPcz) {
      lastPcx = pcx;
      lastPcz = pcz;
      rebuildLoadQueue(pcx, pcz);
      unloadFar(pcx, pcz);
    }
    updateFluids(dt);
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
    isInWater,
    isTouchingCactus,
    collidesAtBox,
    getGroundHeight,
    update,
    waterTexture,
    lavaTexture,
  };
}
