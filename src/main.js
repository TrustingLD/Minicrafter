/* ============================================================
   MINICRAFTER - moteur voxel avec Three.js
   Point d'entrée : construit scène/monde/joueur/UI et lance la boucle.
   ============================================================ */
import * as THREE from 'three';

import { createEventBus } from './core/events.js';
import { voxelRaycast } from './core/raycast.js';
import { createBlockAssets } from './render/block-assets.js';
import { texCrackStage } from './render/textures.js';
import { BLOCK_TYPES, TOOL_FOR_BLOCK } from './data/blocks.js';
import { ITEM_NAMES, RECIPES, HOTBAR, NON_PLACEABLE, TOOL_CATEGORY } from './data/items.js';
import { SEA_LEVEL, getHeight } from './world/generator.js';
import { createWorld } from './world/world.js';
import { createClouds } from './world/clouds.js';
import { createSky } from './world/sky.js';
import { createSfx } from './audio/sfx.js';
import { createMusic } from './audio/music.js';
import { createMobTextures, createMobSystem } from './entities/mob.js';
import { createPlayer } from './entities/player.js';
import { createHotbarUI } from './ui/hotbar.js';
import { createHealthUI } from './ui/health.js';
import { createCraftUI } from './ui/craft.js';
import { createChatUI } from './ui/chat.js';
import { isTouchDevice, createTouchUI } from './ui/touch.js';

/* ---------- Bus d'événements ---------- */
// L'UI s'abonne ici une fois pour toutes ; la logique de jeu n'a plus besoin
// d'appeler hotbarUI.render/healthUI.render à chaque endroit qui change l'état.
const bus = createEventBus();

// Phase 6 : le tactile n'ajoute pas un second jeu de règles, juste un second
// producteur des mêmes actions (cf. src/ui/touch.js). Tout ce qui suit qui teste
// `touchMode` sert soit à éviter le pointer lock (absent sur tactile), soit à
// baisser la qualité (distance de rendu, ombres, pixel ratio) pour tenir 60 FPS
// sur un GPU de téléphone.
const touchMode = isTouchDevice();

/* ---------- Scène / caméra / renderer ---------- */
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x87ceeb);
scene.fog = new THREE.Fog(0x87ceeb, 55, 170);

const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
scene.add(camera); // nécessaire pour que les objets attachés à la caméra (main FPS) soient rendus
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, touchMode ? 1 : 2));
renderer.shadowMap.enabled = !touchMode;
document.body.appendChild(renderer.domElement);

const ambient = new THREE.AmbientLight(0xffffff, 0.65);
scene.add(ambient);
const sun = new THREE.DirectionalLight(0xffffff, 0.8);
sun.position.set(50, 80, 30);
sun.castShadow = !touchMode;
sun.shadow.camera.left = -60;
sun.shadow.camera.right = 60;
sun.shadow.camera.top = 60;
sun.shadow.camera.bottom = -60;
sun.shadow.mapSize.set(512, 512); // réduit : moins coûteux à calculer
scene.add(sun);
scene.add(sun.target);


/* ---------- Audio ---------- */
const sfx = createSfx();
const musicHintEl = document.getElementById('musicHint');
const music = createMusic(['./luft-mini.mp3', './minicrafter_theme_final.mp3'], musicHintEl);
document.getElementById('musicHint').addEventListener('click', music.toggleBgmMute);

/* ---------- Monde ---------- */
// Monde en chunks (Phase 4a) : createWorld précharge un petit disque de chunks
// autour de (0,0) de façon synchrone (le joueur n'apparaît jamais dans le vide),
// le reste se charge à la volée via worldApi.update(player.pos) dans animate().
const blockAssets = createBlockAssets();
const worldApi = createWorld({ scene, renderDistance: touchMode ? 4 : 6 });
const cloudsApi = createClouds({ scene });
const skyApi = createSky({ scene, ambientLight: ambient, sunLight: sun });

// Bordure du monde : mur purement invisible, seule la collision existe (cf.
// collidesAtBox dans world.js). Pas de plan rouge/brume — juste un stop net.

// Overlay de cassage (TODO 16) : une boîte légèrement plus grande que le bloc visé,
// posée dessus, texturée avec des craquelures — PAS un effet d'écran/viseur. On la
// déplace sur le bloc ciblé et on change sa texture (10 stades) au fil de breakProgress.
const crackTextures = Array.from({ length: 10 }, (_, i) => texCrackStage(i));
const crackMat = new THREE.MeshBasicMaterial({
  map: crackTextures[0],
  transparent: true,
  depthWrite: false,
  polygonOffset: true,
  polygonOffsetFactor: -4,
  polygonOffsetUnits: -4,
});
const crackMesh = new THREE.Mesh(new THREE.BoxGeometry(1.01, 1.01, 1.01), crackMat);
crackMesh.visible = false;
scene.add(crackMesh);

/* ---------- Inventaire ---------- */
// Vide au départ (Phase X) : avant, le joueur démarrait avec 5 bois gratuits. Casser
// un bloc (breakBlockAt, plus bas) incrémente déjà `inventory[type]` tout seul, donc
// l'inventaire se remplit naturellement au fil du jeu sans rien avoir à changer là-bas.
const inventory = {
  wood: 0,
  planks: 0,
  stick: 0,
  dirt: 0,
  stone: 0,
  grass: 0,
  leaves: 0,
  crafting_table: 0,
  wood_pickaxe: 0,
  wood_axe: 0,
  wood_sword: 0,
  meat: 0,
  milk: 0,
};

let selectedIndex = HOTBAR.findIndex((t) => (inventory[t] || 0) > 0);
if (selectedIndex < 0) selectedIndex = 0;
let selectedBlock = HOTBAR[selectedIndex];

/* ---------- UI ---------- */
const hotbarUI = createHotbarUI({
  hotbarEl: document.getElementById('hotbar'),
  HOTBAR,
  blockTypes: BLOCK_TYPES,
  itemNames: ITEM_NAMES,
  iconCanvas: blockAssets.iconCanvas,
  onSelect: selectSlot,
});
hotbarUI.setSelectedIndex(selectedIndex);
hotbarUI.render(inventory);
bus.on('inventory:changed', () => hotbarUI.render(inventory));

const healthUI = createHealthUI(document.getElementById('healthbar'));
bus.on('player:health', () => healthUI.render(player));

const craftUI = createCraftUI({
  elements: {
    craftPanel: document.getElementById('craftPanel'),
    invGrid: document.getElementById('invGrid'),
    recipeList: document.getElementById('recipeList'),
    craftTitle: document.getElementById('craftTitle'),
  },
  RECIPES,
  itemNames: ITEM_NAMES,
  iconCanvas: blockAssets.iconCanvas,
  playSound: sfx.playSound,
  onCrafted: () => bus.emit('inventory:changed'),
  onSelectItem: selectItem,
});
let craftOpen = false;
function openCraft() {
  craftOpen = true;
  craftUI.show();
  document.exitPointerLock();
  craftUI.render(inventory, worldApi.getBlock, player.pos, selectedBlock);
}
function closeCraft() {
  craftOpen = false;
  craftUI.hide();
  // le pointeur a été relâché à l'ouverture : on invite le joueur à re-cliquer
  // pour reprendre le contrôle de la caméra (sinon la souris semblait "morte").
  // Non pertinent sur tactile : il n'y a jamais eu de pointer lock à reprendre.
  if (!touchMode && document.pointerLockElement !== renderer.domElement)
    blocker.style.display = 'flex';
}
document.getElementById('closeCraft').addEventListener('click', closeCraft);

/* ---------- Joueur ---------- */
const {
  player,
  updateVisuals,
  refreshHeldItem,
  toggleThirdPerson,
  triggerHandSwing,
  collidesAt,
  respawn,
} = createPlayer({
  scene,
  camera,
  materials: blockAssets.materials,
  blockTypes: blockAssets.blockTypes,
  toolTextures: blockAssets.toolTextures,
  collidesAtBox: worldApi.collidesAtBox,
  getBlock: worldApi.getBlock,
  spawnPos: new THREE.Vector3(0, getHeight(0, 0) + 3, 0),
});
healthUI.render(player);
refreshHeldItem(selectedBlock);

function selectSlot(i) {
  if (i !== selectedIndex) sfx.playSound('equip');
  selectedIndex = i;
  selectedBlock = HOTBAR[i];
  hotbarUI.setSelectedIndex(i);
  hotbarUI.render(inventory);
  refreshHeldItem(selectedBlock);
}

// équiper un objet qui n'a pas d'emplacement dans la hotbar fixe (minerais bruts,
// tiers pierre/fer) : cliqué depuis l'inventaire (E), pas depuis la hotbar.
function selectItem(key) {
  if (key !== selectedBlock) sfx.playSound('equip');
  selectedBlock = key;
  const hotbarIdx = HOTBAR.indexOf(key);
  selectedIndex = hotbarIdx; // -1 si hors hotbar : aucun slot ne s'affiche sélectionné
  hotbarUI.setSelectedIndex(hotbarIdx);
  hotbarUI.render(inventory);
  refreshHeldItem(selectedBlock);
}

/* ---------- Mobs ---------- */
// rayon de spawn volontairement plus petit que WORLD_BORDER : au-delà, les chunks
// ne sont pas encore préchargés au boot, donc getGroundHeight y forcerait une
// génération synchrone de tous les chunks traversés — inutile, le monde entier
// n'a pas besoin d'être peuplé de mobs dès la première frame.
const MOB_SPAWN_HALF = 40;
const mobAssets = createMobTextures();
const mobSystem = createMobSystem({
  scene,
  mobAssets,
  collidesAtBox: worldApi.collidesAtBox,
  getGroundHeight: worldApi.getGroundHeight,
  getHeight,
  inventory,
  playSound: sfx.playSound,
  onPlayerHurt: (dmg) => {
    player.health = Math.max(0, player.health - dmg);
    bus.emit('player:health');
  },
  spawnHalf: MOB_SPAWN_HALF,
  seaLevel: SEA_LEVEL,
  onMobDeath: () => bus.emit('inventory:changed'),
});
mobSystem.spawnMobs();

/* ---------- Chat (T) ---------- */
const chatUI = createChatUI({
  logEl: document.getElementById('chatLog'),
  inputBoxEl: document.getElementById('chatInputBox'),
  inputEl: document.getElementById('chatInput'),
  onSend: (text) => bus.emit('chat:message', text),
  onClose: () => {
    if (!touchMode && document.pointerLockElement !== renderer.domElement)
      blocker.style.display = 'flex';
  },
});

/* ---------- Entrées clavier / souris ---------- */
document.addEventListener('keydown', (e) => {
  if (e.code === 'F5') {
    e.preventDefault();
    toggleThirdPerson();
  }
});

const keys = {};
const MOVE_CODES = new Set([
  'KeyW',
  'KeyA',
  'KeyS',
  'KeyD',
  'ArrowUp',
  'ArrowDown',
  'ArrowLeft',
  'ArrowRight',
  'Space',
]);
// zoom (C, façon longue-vue) : bascule + interpolé dans la boucle animate()
let zoomed = false;
// sprint (double-tap W/Z) : deux appuis rapprochés déclenchent la course
let sprinting = false;
let lastForwardTapTime = -Infinity;
const SPRINT_TAP_WINDOW = 300; // ms

document.addEventListener('keydown', (e) => {
  if (e.code === 'KeyE') {
    craftOpen ? closeCraft() : openCraft();
    e.preventDefault();
    return;
  }
  if (e.code === 'KeyM') {
    music.toggleBgmMute();
    return;
  }
  if (e.code === 'KeyT') {
    if (!craftOpen && !chatUI.isOpen) {
      chatUI.open();
      document.exitPointerLock();
    }
    e.preventDefault();
    return;
  }
  if (craftOpen || chatUI.isOpen) return;
  if (e.code === 'KeyC') {
    zoomed = !zoomed;
    return;
  }
  if (e.code === 'KeyW' && !e.repeat) {
    const now = performance.now();
    if (now - lastForwardTapTime < SPRINT_TAP_WINDOW) sprinting = true;
    lastForwardTapTime = now;
  }
  if (MOVE_CODES.has(e.code)) e.preventDefault(); // évite le scroll de page avec Espace/flèches
  keys[e.code] = true;
  // e.code = position physique de la touche : fonctionne en QWERTY comme en AZERTY
  // (pas besoin de Shift pour les chiffres sur clavier français)
  const digitMatch = e.code.match(/^Digit([0-9])$/);
  if (digitMatch) {
    const n = parseInt(digitMatch[1], 10);
    const idx = n === 0 ? 9 : n - 1; // touche 0 -> 10e emplacement
    if (idx < HOTBAR.length) selectSlot(idx);
  }
});
document.addEventListener('keyup', (e) => {
  keys[e.code] = false;
  if (e.code === 'KeyW' || e.code === 'KeyS') sprinting = false; // lâcher/reculer arrête la course
});
// si la fenêtre perd le focus (alt-tab, clic ailleurs), on relâche toutes les touches
// pour éviter que le joueur continue d'avancer tout seul
window.addEventListener('blur', () => {
  for (const k in keys) keys[k] = false;
});
document.addEventListener(
  'wheel',
  (e) => {
    if (craftOpen) return;
    e.preventDefault();
    selectedIndex = (selectedIndex + (e.deltaY > 0 ? 1 : -1) + HOTBAR.length) % HOTBAR.length;
    selectedBlock = HOTBAR[selectedIndex];
    hotbarUI.setSelectedIndex(selectedIndex);
    hotbarUI.render(inventory);
    refreshHeldItem(selectedBlock);
  },
  { passive: false },
);

let yaw = 0,
  pitch = 0;
const blocker = document.getElementById('blocker');
renderer.domElement.addEventListener('click', () => {
  sfx.resumeAudio();
  music.startBgm();
  if (!craftOpen) renderer.domElement.requestPointerLock();
});
blocker.addEventListener('click', () => {
  sfx.resumeAudio();
  music.startBgm();
  renderer.domElement.requestPointerLock();
});
document.addEventListener('pointerlockchange', () => {
  blocker.style.display =
    document.pointerLockElement === renderer.domElement ? 'none' : craftOpen ? 'none' : 'flex';
});
document.addEventListener('mousemove', (e) => {
  if (document.pointerLockElement !== renderer.domElement) return;
  yaw -= e.movementX * 0.0025;
  pitch -= e.movementY * 0.0025;
  pitch = Math.max(-Math.PI / 2 + 0.01, Math.min(Math.PI / 2 - 0.01, pitch));
});

/* ---------- Interaction (raycast blocs + mobs) ---------- */
const raycaster = new THREE.Raycaster();
raycaster.far = 6;
const rayDir = new THREE.Vector3();
const rayEye = new THREE.Vector3();

// Portée à 6 blocs mesurée depuis le JOUEUR, pas la caméra : en 3e personne (F5) la
// caméra est jusqu'à 4.5 unités derrière/au-dessus — un rayon parti de la caméra aurait
// une portée effective bien plus courte depuis le joueur. On garde la direction visée
// (celle de la caméra, donc le viseur reste juste à l'écran) mais l'origine est l'oeil du joueur.
function aimRaycast() {
  camera.getWorldDirection(rayDir);
  rayEye.set(player.pos.x, player.pos.y + player.height, player.pos.z);
  raycaster.set(rayEye, rayDir);
}

// Fix (chute de FPS 60->20 qui s'aggrave à mesure que le monde se génère) : l'ancienne
// version faisait `raycaster.intersectObjects(worldApi.chunkMeshList)`, un test
// triangle-par-triangle contre TOUS les meshes de chunks chargés (jusqu'à ~110 avec
// RENDER_DISTANCE=6), appelé plusieurs fois par frame. Le coût grandit avec le nombre
// de chunks chargés/explorés, indépendamment de la portée réelle (6 blocs). Un DDA
// voxel (`voxelRaycast` dans core/raycast.js) coûte O(portée), donc ~6 itérations,
// quel que soit le nombre de chunks générés autour du joueur.
function getTargetedBlock() {
  aimRaycast();
  return voxelRaycast(worldApi.getBlock, rayEye, rayDir, raycaster.far);
}
function getTargetedMob() {
  aimRaycast();
  // seuls les mobs actifs (donc visibles, cf. MOB_ACTIVE_RADIUS dans mob.js) sont
  // testés : inutile de faire tester des centaines de hitboxes à Three pour une
  // portée de 6 blocs.
  const targets = mobSystem.mobHitboxes.filter((p) => p.userData.mob?.group.visible);
  if (targets.length === 0) return null;
  const intersects = raycaster.intersectObjects(targets);
  if (intersects.length === 0) return null;
  return { mob: intersects[0].object.userData.mob, dist: intersects[0].distance };
}

// Le viseur bloc/mob ne change qu'une fois par frame : on le calcule une seule fois
// dans animate() et on réutilise le résultat partout ailleurs (clic gauche/droit),
// plutôt que de relancer le raycast à chaque appel.
let cachedBlockHit = null;
let cachedMobHit = null;
function refreshAimCache() {
  cachedMobHit = getTargetedMob();
  cachedBlockHit = getTargetedBlock();
}

// Cassage progressif (TODO 16) : maintenir le clic use le temps réel plutôt que de
// casser au premier clic. breakTimeFor() lit hardness/tool depuis data/blocks.js —
// la donnée ajoutée en Phase 2 sert enfin à quelque chose de visible.
// hasRightTool compare des CATÉGORIES d'outil ('pickaxe'/'axe'), pas un item précis :
// n'importe quel tier de pioche (bois/pierre/fer) donne le bonus sur la pierre.
function hasRightToolFor(type) {
  const category = TOOL_FOR_BLOCK[type];
  return (
    !!category && TOOL_CATEGORY[selectedBlock] === category && (inventory[selectedBlock] || 0) > 0
  );
}
function breakTimeFor(type) {
  const hardness = BLOCK_TYPES[type]?.hardness ?? 1;
  return hasRightToolFor(type) ? hardness / 2 : hardness;
}
function breakBlockAt(x, y, z, type) {
  inventory[type] = (inventory[type] || 0) + (hasRightToolFor(type) ? 2 : 1);
  worldApi.setBlock(x, y, z, null);
  bus.emit('inventory:changed');
  bus.emit('block:broken', { x, y, z, type });
  sfx.playSound('break');
}

let leftMouseDown = false;
let breakKey = null;
let breakProgress = 0;

// Casser/attaquer (clic gauche desktop, ⛏ maintenu sur tactile) : factorisé pour que
// les deux entrées appellent exactement la même logique (cf. Phase 6 : le tactile est
// un second producteur des mêmes actions, pas un second chemin de code).
function performPrimaryAction() {
  const mobHit = cachedMobHit;
  const blockHit = cachedBlockHit;
  triggerHandSwing();
  leftMouseDown = true;
  // priorité au mob si plus proche que le bloc
  if (mobHit && (!blockHit || mobHit.dist < blockHit.dist)) {
    const hasSword =
      TOOL_CATEGORY[selectedBlock] === 'sword' && (inventory[selectedBlock] || 0) > 0;
    mobHit.mob.hit(hasSword ? 5 : 1);
    return;
  }
  // le cassage lui-même est géré dans animate() : il faut maintenir l'action
  // pointée sur le même bloc pendant breakTimeFor(type) secondes
}

// Poser un bloc / ouvrir la table de craft (clic droit desktop, ▦ tactile).
function performSecondaryAction() {
  const blockHit = cachedBlockHit;
  if (!blockHit) return;
  const { x: tx, y: ty, z: tz } = blockHit.block; // bloc visé (existant)
  if (worldApi.getBlock(tx, ty, tz) === 'crafting_table') {
    openCraft();
    return;
  }
  if (NON_PLACEABLE.has(selectedBlock)) {
    hotbarUI.flashEmptySlot(selectedIndex);
    return;
  }
  if ((inventory[selectedBlock] || 0) <= 0) {
    hotbarUI.flashEmptySlot(selectedIndex);
    return;
  }
  const { x, y, z } = blockHit.place; // case vide adjacente où poser le nouveau bloc
  const px = Math.floor(player.pos.x),
    py0 = Math.floor(player.pos.y),
    py1 = Math.floor(player.pos.y + player.height),
    pz = Math.floor(player.pos.z);
  if (!(x === px && z === pz && (y === py0 || y === py1)) && !worldApi.getBlock(x, y, z)) {
    worldApi.setBlock(x, y, z, selectedBlock);
    inventory[selectedBlock]--;
    bus.emit('inventory:changed');
    sfx.playSound('place');
  }
}

renderer.domElement.addEventListener('mousedown', (e) => {
  if (document.pointerLockElement !== renderer.domElement || craftOpen) return;
  if (e.button === 0) performPrimaryAction();
  else if (e.button === 2) performSecondaryAction();
});
renderer.domElement.addEventListener('contextmenu', (e) => e.preventDefault());
function stopBreaking() {
  leftMouseDown = false;
  breakKey = null;
  breakProgress = 0;
  crackMesh.visible = false;
}
renderer.domElement.addEventListener('mouseup', (e) => {
  if (e.button === 0) stopBreaking();
});
window.addEventListener('blur', stopBreaking);

/* ---------- Contrôles tactiles (Phase 6) ---------- */
let touchMoveVec = { x: 0, z: 0 };
let touchUI = null; // référencé dans animate() pour désactiver joystick/visée pendant craft/chat
if (touchMode) {
  blocker.style.display = 'none'; // pas de pointer lock sur tactile : on démarre directement

  touchUI = createTouchUI({
    onMove: (dx, dz) => {
      touchMoveVec.x = dx;
      touchMoveVec.z = dz;
    },
    onLook: (dYaw, dPitch) => {
      yaw -= dYaw;
      pitch -= dPitch;
      pitch = Math.max(-Math.PI / 2 + 0.01, Math.min(Math.PI / 2 - 0.01, pitch));
    },
    onBreakStart: () => {
      if (!craftOpen && !chatUI.isOpen) performPrimaryAction();
    },
    onBreakEnd: stopBreaking,
    onPlace: () => {
      if (!craftOpen && !chatUI.isOpen) performSecondaryAction();
    },
    onJump: (down) => {
      keys['Space'] = down;
    },
    onInventory: () => (craftOpen ? closeCraft() : openCraft()),
  });

  // premier contact = geste utilisateur requis pour débloquer l'audio et tenter le
  // plein écran / wake lock (échouent silencieusement si le navigateur refuse)
  window.addEventListener(
    'touchstart',
    function unlockOnce() {
      sfx.resumeAudio();
      music.startBgm();
      document.documentElement.requestFullscreen?.().catch(() => {});
      if ('wakeLock' in navigator) {
        navigator.wakeLock.request('screen').catch(() => {});
      }
      window.removeEventListener('touchstart', unlockOnce);
    },
    { once: true },
  );
}

/* ============================================================
   BOUCLE PRINCIPALE
   ============================================================ */
const clock = new THREE.Clock();
let footstepTimer = 0;
let lavaDamageTimer = 0; // cooldown entre deux tics de dégâts tant qu'on reste dans la lave
const posEl = document.getElementById('pos');
const targetEl = document.getElementById('target');
const hintEl = document.getElementById('hint');
const fpsEl = document.getElementById('fps');
let fpsSmoothed = 60;

const STAND_HEIGHT = player.height,
  CROUCH_HEIGHT = player.height * 0.8;

function isUnderwater() {
  // une colonne est un lac si sa hauteur de terrain (bruit, pas les chunks chargés)
  // est sous le niveau de la mer — identique au critère utilisé pour poser les lacs
  // dans world/generator.js, mais lisible sans avoir à charger le chunk.
  return (
    player.pos.y < SEA_LEVEL + 0.6 &&
    getHeight(Math.round(player.pos.x), Math.round(player.pos.z)) < SEA_LEVEL
  );
}

function isInLava() {
  return worldApi.isInLava(player.pos.x, player.pos.y, player.pos.z);
}

function respawnPlayer() {
  respawn(new THREE.Vector3(0, getHeight(0, 0) + 3, 0));
  bus.emit('player:health');
}

function animate() {
  requestAnimationFrame(animate);
  const rawDt = clock.getDelta();
  const dt = Math.min(rawDt, 0.05); // plafonné pour la physique/mouvement (évite les gros sauts en cas de lag)

  // FPS (moyenne glissante — la valeur instantanée saute trop pour être lisible).
  // IMPORTANT : on utilise rawDt (non plafonné) et pas dt ici. dt est plafonné à 0.05
  // pour que le mouvement ne saute pas d'un coup après un lag, mais ça implique que
  // 1/dt ne peut jamais descendre sous 20 — en réutilisant dt pour le FPS, le compteur
  // ne pouvait donc jamais afficher moins de ~20 FPS, même en cas de vrai ralentissement
  // (précisément quand on a besoin de voir le vrai chiffre, ex. pendant le chargement
  // des chunks). Le tout premier rawDt (juste après la création du Clock) peut être ~0 :
  // on l'ignore pour ne pas injecter une division par zéro dans la moyenne.
  if (rawDt > 0.001) {
    fpsSmoothed += (1 / rawDt - fpsSmoothed) * 0.1;
    fpsEl.textContent = `${Math.round(fpsSmoothed)} FPS`;
  }

  // zoom (C) : interpolation douce du FOV, indépendante du reste (marche même en 3e personne)
  const targetFov = zoomed ? 25 : 75;
  if (Math.abs(camera.fov - targetFov) > 0.05) {
    camera.fov += (targetFov - camera.fov) * Math.min(1, dt * 8);
    camera.updateProjectionMatrix();
  }

  skyApi.update(dt, player.pos);
  worldApi.waterTexture.offset.x = (worldApi.waterTexture.offset.x + dt * 0.025) % 1;
  worldApi.waterTexture.offset.y = (worldApi.waterTexture.offset.y + dt * 0.015) % 1;
  worldApi.lavaTexture.offset.x = (worldApi.lavaTexture.offset.x + dt * 0.012) % 1;
  worldApi.lavaTexture.offset.y = (worldApi.lavaTexture.offset.y + dt * 0.008) % 1;
  worldApi.update(player.pos); // charge/décharge les chunks proches (Phase 4a)
  cloudsApi.update(dt, player.pos);

  // joystick/visée tactiles coupés pendant craft/chat, comme le reste des contrôles
  if (touchUI) touchUI.setActive(!craftOpen && !chatUI.isOpen);

  if (!craftOpen && !chatUI.isOpen) {
    let dx = touchMoveVec.x,
      dz = touchMoveVec.z;
    if (keys['KeyW'] || keys['ArrowUp']) dz -= 1;
    if (keys['KeyS'] || keys['ArrowDown']) dz += 1;
    if (keys['KeyA'] || keys['ArrowLeft']) dx -= 1;
    if (keys['KeyD'] || keys['ArrowRight']) dx += 1;

    // accroupi (Maj) : abaisse les yeux/hitbox, ralentit, et interdit de marcher
    // dans le vide (contrairement à la marche normale qui laisse tomber du bord)
    const crouching = !!keys['ShiftLeft'] || !!keys['ShiftRight'];
    player.height = crouching ? CROUCH_HEIGHT : STAND_HEIGHT;
    if (crouching) sprinting = false;
    const underwater = isUnderwater();
    const inLava = isInLava();
    const speed =
      player.speed *
      (sprinting ? 1.6 : 1) *
      (crouching ? 0.6 : 1) *
      (underwater || inLava ? 0.5 : 1);

    // dégâts en tic (pas à chaque frame) tant qu'on reste dans la lave -- même
    // mécanique que onPlayerHurt utilisé par les mobs (cf. main.js plus haut)
    if (inLava) {
      lavaDamageTimer -= dt;
      if (lavaDamageTimer <= 0) {
        player.health = Math.max(0, player.health - 4);
        bus.emit('player:health');
        sfx.playSound('hurt');
        lavaDamageTimer = 0.5;
      }
    } else {
      lavaDamageTimer = 0;
    }

    const isMoving = dx !== 0 || dz !== 0;
    if (isMoving) {
      const len = Math.hypot(dx, dz);
      dx /= len;
      dz /= len;
      // vecteur "avant" caméra = (sin(yaw), cos(yaw)) ; vecteur "droite" = (cos(yaw), -sin(yaw))
      const moveX = (dz * Math.sin(yaw) + dx * Math.cos(yaw)) * speed * dt;
      const moveZ = (dz * Math.cos(yaw) - dx * Math.sin(yaw)) * speed * dt;
      const canStand = (x, z) =>
        !crouching ||
        !player.onGround ||
        worldApi.collidesAtBox(x, player.pos.y - 0.1, z, player.radius, 0.15);
      const nx = player.pos.x + moveX;
      if (!collidesAt(nx, player.pos.y, player.pos.z) && canStand(nx, player.pos.z))
        player.pos.x = nx;
      const nz = player.pos.z + moveZ;
      if (!collidesAt(player.pos.x, player.pos.y, nz) && canStand(player.pos.x, nz))
        player.pos.z = nz;
      if (player.onGround) {
        footstepTimer -= dt;
        if (footstepTimer <= 0) {
          sfx.playSound(underwater ? 'footstepWater' : 'footstep');
          footstepTimer = 0.38;
        }
      }
    }

    const wasOnGround = player.onGround;
    player.velY -= 20 * dt;
    const newY = player.pos.y + player.velY * dt;
    if (player.velY < 0) {
      if (collidesAt(player.pos.x, newY, player.pos.z)) {
        player.velY = 0;
        player.onGround = true;
      } else {
        player.pos.y = newY;
        player.onGround = false;
      }
    } else {
      if (!collidesAt(player.pos.x, newY, player.pos.z)) player.pos.y = newY;
      else player.velY = 0;
    }
    if (!wasOnGround && player.onGround) sfx.playSound('land');
    if (keys['Space'] && player.onGround) {
      player.velY = player.jumpForce;
      player.onGround = false;
      sfx.playSound('jump');
    }

    if (player.pos.y < -10) respawnPlayer();
    if (player.health <= 0) respawnPlayer();

    camera.rotation.order = 'YXZ';
    camera.rotation.y = yaw;
    camera.rotation.x = pitch;
    updateVisuals(dt, isMoving, yaw, pitch); // positionne la caméra (1ère/3e personne) + anime main et avatar

    mobSystem.update(dt, player.pos);
  }

  posEl.textContent = `${player.pos.x.toFixed(1)}, ${player.pos.y.toFixed(1)}, ${player.pos.z.toFixed(1)}`;
  refreshAimCache();
  const mobHit = cachedMobHit;
  const blockHit = cachedBlockHit;
  if (mobHit && (!blockHit || mobHit.dist < blockHit.dist)) {
    targetEl.textContent = `${mobHit.mob.data.name} (${mobHit.mob.health}/${mobHit.mob.maxHealth} PV)`;
    hintEl.style.display = 'none';
  } else if (blockHit) {
    const t = worldApi.getBlock(blockHit.block.x, blockHit.block.y, blockHit.block.z);
    targetEl.textContent = `${BLOCK_TYPES[t]?.name || '?'} (${blockHit.block.x}, ${blockHit.block.y}, ${blockHit.block.z})`;
    hintEl.style.display = t === 'crafting_table' ? 'block' : 'none';
  } else {
    targetEl.textContent = '-';
    hintEl.style.display = 'none';
  }

  // Cassage progressif : maintenir le clic sur un bloc l'use au fil du temps. Le clic
  // relâché (ou craft/chat ouvert) arrête et remet à zéro pour de vrai. Mais un simple
  // raté d'UNE frame (micro-tremblement de souris à la limite des 6 blocs de portée,
  // le viseur qui rate le bloc pour une image) ne doit PAS effacer la progression —
  // sinon casser un bloc en bout de portée devient quasi impossible dans les faits.
  const mustStopBreaking =
    !leftMouseDown ||
    craftOpen ||
    chatUI.isOpen ||
    (!touchMode && document.pointerLockElement !== renderer.domElement);
  if (mustStopBreaking) {
    breakKey = null;
    breakProgress = 0;
    crackMesh.visible = false;
  } else {
    const targetingBlock = blockHit && !(mobHit && mobHit.dist < blockHit.dist);
    if (targetingBlock) {
      const { x, y, z } = blockHit.block;
      const key = `${x},${y},${z}`;
      const type = worldApi.getBlock(x, y, z);
      if (type && !BLOCK_TYPES[type]?.unbreakable) {
        if (key !== breakKey) {
          breakKey = key;
          breakProgress = 0;
        }
        const total = breakTimeFor(type);
        breakProgress += dt;
        if (breakProgress >= total) {
          breakBlockAt(x, y, z, type);
          breakKey = null;
          breakProgress = 0;
          crackMesh.visible = false;
        } else {
          const stage = Math.min(9, Math.floor((breakProgress / total) * 10));
          crackMesh.position.set(x + 0.5, y + 0.5, z + 0.5);
          crackMat.map = crackTextures[stage];
          crackMesh.visible = true;
        }
      }
    } else {
      // rien visé cette frame (ou mob prioritaire) : on met en pause sans effacer,
      // la progression reprendra si le viseur revient sur le même bloc
      crackMesh.visible = false;
    }
  }

  renderer.render(scene, camera);
}
animate();

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});