/* ============================================================
   MINICRAFTER - moteur voxel avec Three.js
   Point d'entrée : construit scène/monde/joueur/UI et lance la boucle.
   ============================================================ */
import * as THREE from 'three';

import { createBlockAssets } from './render/block-assets.js';
import { BLOCK_TYPES, TOOL_FOR_BLOCK } from './data/blocks.js';
import { ITEM_NAMES, RECIPES, HOTBAR, NON_PLACEABLE } from './data/items.js';
import {
  CHUNK_SIZE,
  SEA_LEVEL,
  getHeight,
  generateTerrain,
  getGroundHeight,
  keyOf,
} from './world/generator.js';
import { createWorld } from './world/world.js';
import { createSfx } from './audio/sfx.js';
import { createMusic } from './audio/music.js';
import { createMobTextures, createMobSystem } from './entities/mob.js';
import { createPlayer } from './entities/player.js';
import { createHotbarUI } from './ui/hotbar.js';
import { createHealthUI } from './ui/health.js';
import { createCraftUI } from './ui/craft.js';

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

/* ---------- Audio ---------- */
const sfx = createSfx();
const musicHintEl = document.getElementById('musicHint');
const music = createMusic('./luft-mini.mp3', musicHintEl);
document.getElementById('musicHint').addEventListener('click', music.toggleBgmMute);

/* ---------- Monde ---------- */
const blockAssets = createBlockAssets();
const waterCells = []; // {x,z} des colonnes sous le niveau de la mer (rendues séparément)
const worldApi = createWorld({
  scene,
  geometry: blockAssets.geometry,
  materials: blockAssets.materials,
  blockTypes: blockAssets.blockTypes,
  waterCells,
});
generateTerrain(worldApi.world, waterCells);
worldApi.buildInitialMeshes();
worldApi.buildWaterMesh(SEA_LEVEL);

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

const healthUI = createHealthUI(document.getElementById('healthbar'));

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
  onCrafted: () => hotbarUI.render(inventory),
});
let craftOpen = false;
function openCraft() {
  craftOpen = true;
  craftUI.show();
  document.exitPointerLock();
  craftUI.render(inventory, worldApi.world, player.pos);
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
  instancedMeshList: worldApi.instancedMeshList,
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

/* ---------- Mobs ---------- */
const mobAssets = createMobTextures();
const mobSystem = createMobSystem({
  scene,
  mobAssets,
  collidesAtBox: worldApi.collidesAtBox,
  getGroundHeight: (x, z) => getGroundHeight(worldApi.world, x, z),
  getHeight,
  inventory,
  playSound: sfx.playSound,
  onPlayerHurt: (dmg) => {
    player.health = Math.max(0, player.health - dmg);
    healthUI.render(player);
  },
  chunkSize: CHUNK_SIZE,
  seaLevel: SEA_LEVEL,
  onMobDeath: () => hotbarUI.render(inventory),
});
mobSystem.spawnMobs();

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
  if (craftOpen) return;
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
document.addEventListener('keyup', (e) => (keys[e.code] = false));
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
const center = new THREE.Vector2(0, 0);

function getTargetedBlock() {
  raycaster.setFromCamera(center, camera);
  const intersects = raycaster.intersectObjects(worldApi.instancedMeshList);
  if (intersects.length === 0) return null;
  const hit = intersects[0];
  const type = hit.object.userData.blockType;
  const key = worldApi.instanceKeys[type][hit.instanceId];
  if (!key) return null;
  const [x, y, z] = key.split(',').map(Number);
  const normal = hit.face.normal;
  return {
    block: { x, y, z },
    place: { x: x + normal.x, y: y + normal.y, z: z + normal.z },
    dist: hit.distance,
  };
}
function getTargetedMob() {
  raycaster.setFromCamera(center, camera);
  const intersects = raycaster.intersectObjects(mobSystem.mobHitboxes);
  if (intersects.length === 0) return null;
  return { mob: intersects[0].object.userData.mob, dist: intersects[0].distance };
}

renderer.domElement.addEventListener('mousedown', (e) => {
  if (document.pointerLockElement !== renderer.domElement || craftOpen) return;
  const mobHit = getTargetedMob();
  const blockHit = getTargetedBlock();

  if (e.button === 0) {
    triggerHandSwing();
    // priorité au mob si plus proche que le bloc
    if (mobHit && (!blockHit || mobHit.dist < blockHit.dist)) {
      const hasSword = selectedBlock === 'wood_sword' && (inventory.wood_sword || 0) > 0;
      mobHit.mob.hit(hasSword ? 5 : 1);
      return;
    }
    if (blockHit) {
      const { x, y, z } = blockHit.block;
      const type = worldApi.world[keyOf(x, y, z)];
      // bonus de récolte si le bon outil est équipé (pioche pour la pierre, hache pour le bois)
      const rightTool = TOOL_FOR_BLOCK[type];
      const hasRightTool =
        rightTool && selectedBlock === rightTool && (inventory[rightTool] || 0) > 0;
      inventory[type] = (inventory[type] || 0) + (hasRightTool ? 2 : 1);
      delete worldApi.world[keyOf(x, y, z)];
      worldApi.removeBlockMesh(x, y, z);
      worldApi.refreshAround(x, y, z);
      hotbarUI.render(inventory);
      sfx.playSound('break');
    }
  } else if (e.button === 2) {
    if (blockHit) {
      const { x: tx, y: ty, z: tz } = blockHit.block; // bloc visé (existant)
      if (worldApi.world[keyOf(tx, ty, tz)] === 'crafting_table') {
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
      if (!(x === px && z === pz && (y === py0 || y === py1)) && !worldApi.world[keyOf(x, y, z)]) {
        worldApi.world[keyOf(x, y, z)] = selectedBlock;
        inventory[selectedBlock]--;
        worldApi.refreshAround(x, y, z);
        hotbarUI.render(inventory);
        sfx.playSound('place');
      }
    }
  }
});
renderer.domElement.addEventListener('contextmenu', (e) => e.preventDefault());

/* ============================================================
   BOUCLE PRINCIPALE
   ============================================================ */
const clock = new THREE.Clock();
let footstepTimer = 0;
const posEl = document.getElementById('pos');
const targetEl = document.getElementById('target');
const hintEl = document.getElementById('hint');

function respawnPlayer() {
  respawn(new THREE.Vector3(0, getHeight(0, 0) + 3, 0));
  healthUI.render(player);
}

function animate() {
  requestAnimationFrame(animate);
  const dt = Math.min(clock.getDelta(), 0.05);

  if (!craftOpen) {
    let dx = 0,
      dz = 0;
    if (keys['KeyW'] || keys['ArrowUp']) dz -= 1;
    if (keys['KeyS'] || keys['ArrowDown']) dz += 1;
    if (keys['KeyA'] || keys['ArrowLeft']) dx -= 1;
    if (keys['KeyD'] || keys['ArrowRight']) dx += 1;

    const isMoving = dx !== 0 || dz !== 0;
    if (isMoving) {
      const len = Math.hypot(dx, dz);
      dx /= len;
      dz /= len;
      // vecteur "avant" caméra = (sin(yaw), cos(yaw)) ; vecteur "droite" = (cos(yaw), -sin(yaw))
      const moveX = (dz * Math.sin(yaw) + dx * Math.cos(yaw)) * player.speed * dt;
      const moveZ = (dz * Math.cos(yaw) - dx * Math.sin(yaw)) * player.speed * dt;
      if (!collidesAt(player.pos.x + moveX, player.pos.y, player.pos.z)) player.pos.x += moveX;
      if (!collidesAt(player.pos.x, player.pos.y, player.pos.z + moveZ)) player.pos.z += moveZ;
      if (player.onGround) {
        footstepTimer -= dt;
        if (footstepTimer <= 0) {
          sfx.playSound('footstep');
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
    targetEl.textContent = `${mobHit.mob.type === 'zombie' ? 'Zombie' : 'Cochon'} (${mobHit.mob.health}/${mobHit.mob.maxHealth} PV)`;
    hintEl.style.display = 'none';
  } else if (blockHit) {
    const t = worldApi.world[keyOf(blockHit.block.x, blockHit.block.y, blockHit.block.z)];
    targetEl.textContent = `${BLOCK_TYPES[t]?.name || '?'} (${blockHit.block.x}, ${blockHit.block.y}, ${blockHit.block.z})`;
    hintEl.style.display = t === 'crafting_table' ? 'block' : 'none';
  } else {
    targetEl.textContent = '-';
    hintEl.style.display = 'none';
  }

  renderer.render(scene, camera);
}
animate();

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});
