/* ============================================================
   MINICRAFTER - moteur voxel avec Three.js
   Point d'entrée : construit scène/monde/joueur/UI et lance la boucle.
   ============================================================ */
import * as THREE from 'three';

import { createEventBus } from './core/events.js';
import { createBlockAssets } from './render/block-assets.js';
import { texCrackStage } from './render/textures.js';
import { BLOCK_TYPES, TOOL_FOR_BLOCK } from './data/blocks.js';
import { ITEM_NAMES, RECIPES, HOTBAR, NON_PLACEABLE, TOOL_CATEGORY } from './data/items.js';
import { SEA_LEVEL, getHeight } from './world/generator.js';
import { createWorld } from './world/world.js';
import { createSfx } from './audio/sfx.js';
import { createMusic } from './audio/music.js';
import { createMobTextures, createMobSystem } from './entities/mob.js';
import { createPlayer } from './entities/player.js';
import { createHotbarUI } from './ui/hotbar.js';
import { createHealthUI } from './ui/health.js';
import { createCraftUI } from './ui/craft.js';
import { createChatUI } from './ui/chat.js';

/* ---------- Bus d'événements ---------- */
// L'UI s'abonne ici une fois pour toutes ; la logique de jeu n'a plus besoin
// d'appeler hotbarUI.render/healthUI.render à chaque endroit qui change l'état.
const bus = createEventBus();

/* ---------- Scène / caméra / renderer ---------- */
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x87ceeb);
scene.fog = new THREE.Fog(0x87ceeb, 55, 170);

const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
scene.add(camera); // nécessaire pour que les objets attachés à la caméra (main FPS) soient rendus
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
document.body.appendChild(renderer.domElement);

const ambient = new THREE.AmbientLight(0xffffff, 0.65);
scene.add(ambient);
const sun = new THREE.DirectionalLight(0xffffff, 0.8);
sun.position.set(50, 80, 30);
sun.castShadow = true;
sun.shadow.camera.left = -60;
sun.shadow.camera.right = 60;
sun.shadow.camera.top = 60;
sun.shadow.camera.bottom = -60;
sun.shadow.mapSize.set(512, 512); // réduit : moins coûteux à calculer
scene.add(sun);
scene.add(sun.target);

// billboard du soleil (juste visuel — fog:false pour qu'il reste visible loin dans le ciel)
// + la lumière directionnelle suit sa position : base pour le cycle jour/nuit (Phase 9,
// qui n'aura qu'à ajouter des rampes de couleur, le mouvement existe déjà)
const sunMesh = new THREE.Mesh(
  new THREE.SphereGeometry(8, 12, 12),
  new THREE.MeshBasicMaterial({ color: 0xfff2a8, fog: false }),
);
scene.add(sunMesh);
let sunAngle = Math.PI / 3;
const SUN_LIGHT_DIST = 100,
  SUN_MESH_DIST = 300;
function updateSun(dt) {
  sunAngle += dt * 0.01; // cycle complet ~10 min : lent, on veut le voir bouger, pas un jour/nuit complet
  const dirX = Math.cos(sunAngle),
    dirZ = Math.sin(sunAngle),
    // élévation ~52-62° tout le temps (comme la position fixe d'origine) : le soleil
    // tourne à l'horizontale mais reste toujours haut, jamais rasant/terne façon crépuscule
    dirY = 1.6 + Math.sin(sunAngle * 0.5) * 0.3;
  sun.position.set(dirX * SUN_LIGHT_DIST, dirY * SUN_LIGHT_DIST, dirZ * SUN_LIGHT_DIST);
  sunMesh.position.set(dirX * SUN_MESH_DIST, dirY * SUN_MESH_DIST, dirZ * SUN_MESH_DIST);
}

/* ---------- Audio ---------- */
const sfx = createSfx();
const musicHintEl = document.getElementById('musicHint');
const music = createMusic('./luft-mini.mp3', musicHintEl);
document.getElementById('musicHint').addEventListener('click', music.toggleBgmMute);

/* ---------- Monde ---------- */
// Monde en chunks (Phase 4a) : createWorld précharge un petit disque de chunks
// autour de (0,0) de façon synchrone (le joueur n'apparaît jamais dans le vide),
// le reste se charge à la volée via worldApi.update(player.pos) dans animate().
const blockAssets = createBlockAssets();
const worldApi = createWorld({ scene });

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
const inventory = {
  wood: 5,
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
  // pour reprendre le contrôle de la caméra (sinon la souris semblait "morte")
  if (document.pointerLockElement !== renderer.domElement) blocker.style.display = 'flex';
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
  instancedMeshList: worldApi.chunkMeshList,
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
    if (document.pointerLockElement !== renderer.domElement) blocker.style.display = 'flex';
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

function getTargetedBlock() {
  aimRaycast();
  const intersects = raycaster.intersectObjects(worldApi.chunkMeshList);
  if (intersects.length === 0) return null;
  const hit = intersects[0];
  const n = hit.face.normal; // le mesh de chunk n'a qu'une translation (pas de rotation
  // ni d'échelle), donc la normale locale de la face EST la normale monde
  const p = hit.point; // déjà en coordonnées monde
  // le point d'impact tombe pile sur la face du cube [x,x+1) : reculer d'un demi-bloc
  // le long de -normale retombe toujours sur le coin (x,y,z) du bloc visé, quelle que
  // soit la face touchée (cf. PLAN.md §3.1 sur le décalage +0.5 des blocs)
  const x = Math.floor(p.x - n.x * 0.5);
  const y = Math.floor(p.y - n.y * 0.5);
  const z = Math.floor(p.z - n.z * 0.5);
  return {
    block: { x, y, z },
    place: { x: x + n.x, y: y + n.y, z: z + n.z },
    dist: hit.distance,
  };
}
function getTargetedMob() {
  aimRaycast();
  const intersects = raycaster.intersectObjects(mobSystem.mobHitboxes);
  if (intersects.length === 0) return null;
  return { mob: intersects[0].object.userData.mob, dist: intersects[0].distance };
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

renderer.domElement.addEventListener('mousedown', (e) => {
  if (document.pointerLockElement !== renderer.domElement || craftOpen) return;
  const mobHit = getTargetedMob();
  const blockHit = getTargetedBlock();

  if (e.button === 0) {
    triggerHandSwing();
    leftMouseDown = true;
    // priorité au mob si plus proche que le bloc
    if (mobHit && (!blockHit || mobHit.dist < blockHit.dist)) {
      const hasSword =
        TOOL_CATEGORY[selectedBlock] === 'sword' && (inventory[selectedBlock] || 0) > 0;
      mobHit.mob.hit(hasSword ? 5 : 1);
      return;
    }
    // le cassage lui-même est géré dans animate() : il faut maintenir le clic
    // pointé sur le même bloc pendant breakTimeFor(type) secondes
  } else if (e.button === 2) {
    if (blockHit) {
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
  }
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

/* ============================================================
   BOUCLE PRINCIPALE
   ============================================================ */
const clock = new THREE.Clock();
let footstepTimer = 0;
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

function respawnPlayer() {
  respawn(new THREE.Vector3(0, getHeight(0, 0) + 3, 0));
  bus.emit('player:health');
}

function animate() {
  requestAnimationFrame(animate);
  const dt = Math.min(clock.getDelta(), 0.05);

  // FPS (moyenne glissante — la valeur instantanée saute trop pour être lisible).
  // Le tout premier dt (juste après la création du Clock) peut être ~0 : on l'ignore
  // pour ne pas injecter une division par zéro dans la moyenne.
  if (dt > 0.001) {
    fpsSmoothed += (1 / dt - fpsSmoothed) * 0.1;
    fpsEl.textContent = `${Math.round(fpsSmoothed)} FPS`;
  }

  // zoom (C) : interpolation douce du FOV, indépendante du reste (marche même en 3e personne)
  const targetFov = zoomed ? 25 : 75;
  if (Math.abs(camera.fov - targetFov) > 0.05) {
    camera.fov += (targetFov - camera.fov) * Math.min(1, dt * 8);
    camera.updateProjectionMatrix();
  }

  updateSun(dt);
  worldApi.waterTexture.offset.x = (worldApi.waterTexture.offset.x + dt * 0.025) % 1;
  worldApi.waterTexture.offset.y = (worldApi.waterTexture.offset.y + dt * 0.015) % 1;
  worldApi.update(player.pos); // charge/décharge les chunks proches (Phase 4a)

  if (!craftOpen && !chatUI.isOpen) {
    let dx = 0,
      dz = 0;
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
    const speed =
      player.speed * (sprinting ? 1.6 : 1) * (crouching ? 0.6 : 1) * (underwater ? 0.5 : 1);

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
  const mobHit = getTargetedMob();
  const blockHit = getTargetedBlock();
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
    document.pointerLockElement !== renderer.domElement;
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
