/* ============================================================
   MINICRAFTER - moteur voxel avec Three.js
   Point d'entrée : construit scène/monde/joueur/UI et lance la boucle.
   ============================================================ */
import * as THREE from 'three';

import { createEventBus } from './core/events.js';
import { voxelRaycast } from './core/raycast.js';
import { parseCommand } from './core/commands.js';
import { COMMANDS } from './data/commands.js';
import { createBlockAssets } from './render/block-assets.js';
import { texCrackStage } from './render/textures.js';
import { BLOCK_TYPES, TOOL_FOR_BLOCK } from './data/blocks.js';
import { ITEM_NAMES, RECIPES, NON_PLACEABLE, TOOL_CATEGORY, FOOD } from './data/items.js';
import { SMELTING, FUELS } from './data/recipes.js';
import { createBlockEntitySystem } from './world/block-entities.js';
import { SEA_LEVEL, getHeight, findSpawnColumn } from './world/generator.js';
import { createWorld } from './world/world.js';
import { createClouds } from './world/clouds.js';
import { createSky } from './world/sky.js';
import { createSfx } from './audio/sfx.js';
import { createMusic } from './audio/music.js';
import { createMobTextures, createMobSystem } from './entities/mob.js';
import { createPlayer } from './entities/player.js';
import { createParticleSystem } from './entities/particles.js';
import {
  resolveHorizontalMove,
  resolveVerticalPhysics,
  tryJump,
  resolveFlyingVertical,
} from './world/physics.js';
import { createHud } from './ui/hud.js';
import {
  createSlots,
  addItem,
  removeItem,
  countOf,
  moveSlot,
  HOTBAR_SLOTS,
} from './entities/inventory.js';
import { createItemEntitySystem } from './entities/item-entity.js';
import { createHotbarUI } from './ui/hotbar.js';
import { createHealthUI } from './ui/health.js';
import { createHungerUI, createBreathUI } from './ui/hunger.js';
import { createCraftUI } from './ui/craft.js';
import { createFurnaceUI } from './ui/furnace.js';
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
const music = createMusic(['./luft-mini.mp3', './minicrafter_theme_final.mp3', './nightpersonas.mp3', './mini-hands.mp3', './mini-city3.mp3'], musicHintEl);
document.getElementById('musicHint').addEventListener('click', music.toggleBgmMute);

/* ---------- Monde ---------- */
// Colonne d'apparition : calculée AVANT createWorld, parce que c'est autour d'ELLE
// que le disque initial de chunks doit être préchargé — pas autour de (0,0), qui
// n'est plus forcément l'endroit où le joueur apparaît (cf. findSpawnColumn).
// Un chunk non chargé compte comme plein dans isSolid() : apparaître hors du disque
// préchargé enfermerait le joueur dans un mur invisible.
const SPAWN_COLUMN = findSpawnColumn();

// Monde en chunks (Phase 4a) : createWorld précharge un petit disque de chunks
// autour du point d'apparition de façon synchrone (le joueur n'apparaît jamais dans
// le vide), le reste se charge à la volée via worldApi.update(player.pos) dans animate().
const blockAssets = createBlockAssets();
const particleSystem = createParticleSystem({ scene, blockAssets });
const renderDistance = touchMode ? 4 : 6;
const torchPositions = new Map(); // "x,y,z" -> {x,y,z} — alimenté par worldApi, cf. plus bas
const worldApi = createWorld({
  scene,
  renderDistance,
  preloadAt: { x: SPAWN_COLUMN.x, z: SPAWN_COLUMN.z },
  onTorchesChanged: (x, y, z, present) => {
    const key = `${x},${y},${z}`;
    if (present) torchPositions.set(key, { x, y, z });
    else torchPositions.delete(key);
  },
});
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

// Pose : léger "pop" (Phase 19) -- un cube blanc translucide qui rétrécit de 1.35x
// à rien sur 0.15s au-dessus du bloc fraîchement posé. Purement décoratif, un seul
// mesh réutilisé (jamais plus d'une pose active à la fois, contrairement aux
// particules de cassage qui peuvent se chevaucher).
const placeFeedbackMat = new THREE.MeshBasicMaterial({
  color: 0xffffff,
  transparent: true,
  opacity: 0.5,
  depthWrite: false,
});
const placeFeedbackMesh = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), placeFeedbackMat);
placeFeedbackMesh.visible = false;
scene.add(placeFeedbackMesh);
let placeFeedbackTimer = 0;
const PLACE_FEEDBACK_DURATION = 0.15;
function triggerPlaceFeedback(x, y, z) {
  placeFeedbackMesh.position.set(x + 0.5, y + 0.5, z + 0.5);
  placeFeedbackMesh.visible = true;
  placeFeedbackTimer = PLACE_FEEDBACK_DURATION;
}

/* ---------- Inventaire ---------- */
// Slots (Phase 10) : plus un dictionnaire { item: count } mais un tableau de 36
// emplacements (9 hotbar + 27 sac à dos), cf. entities/inventory.js. Vide au départ —
// casser un bloc ou ramasser un drop au sol (item-entity.js) le remplit.
const slots = createSlots();

let selectedIndex = 0;
let selectedBlock = slots[selectedIndex]?.item ?? null;

/* ---------- UI ---------- */
const hotbarUI = createHotbarUI({
  hotbarEl: document.getElementById('hotbar'),
  blockTypes: BLOCK_TYPES,
  itemNames: ITEM_NAMES,
  iconCanvas: blockAssets.iconCanvas,
  onSelect: selectSlot,
});
hotbarUI.setSelectedIndex(selectedIndex);
hotbarUI.render(slots);
bus.on('inventory:changed', () => hotbarUI.render(slots));

const healthUI = createHealthUI(document.getElementById('healthbar'));
bus.on('player:health', () => healthUI.render(player));

// Vignette de dégâts (Phase 19) : ne flashe que sur une VRAIE perte de vie, pas sur
// chaque event player:health (la régénération de faim > 18 en émet un aussi).
const hurtVignetteEl = document.getElementById('hurtVignette');
let lastHealth = 20; // vie de départ (cf. entities/player.js) -- `player` n'existe pas encore ici
bus.on('player:health', () => {
  if (player.health < lastHealth) {
    hurtVignetteEl.classList.add('flash');
    setTimeout(() => hurtVignetteEl.classList.remove('flash'), 80);
  }
  lastHealth = player.health;
});

const hungerUI = createHungerUI(document.getElementById('hungerbar'));
bus.on('player:hunger', () => hungerUI.render(player));

const breathUI = createBreathUI(document.getElementById('breathbar'));
bus.on('player:breath', () => breathUI.render(player));

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
  // cliquer une case du sac à dos l'échange avec le slot hotbar sélectionné —
  // "équiper depuis l'inventaire" (E) devient un moveSlot plutôt qu'une sélection
  // par nom, cohérent avec le reste du système à slots.
  onSlotClick: (backpackIndex) => {
    moveSlot(slots, backpackIndex, selectedIndex);
    selectedBlock = slots[selectedIndex]?.item ?? null;
    refreshHeldItem(selectedBlock);
    bus.emit('inventory:changed');
    craftUI.render(slots, worldApi.getBlock, player.pos, selectedIndex);
  },
});
let craftOpen = false;
function openCraft() {
  craftOpen = true;
  craftUI.show();
  document.exitPointerLock();
  craftUI.render(slots, worldApi.getBlock, player.pos, selectedIndex);
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

/* ---------- Fourneau (Phase 14) ---------- */
// État + horloge (world/block-entities.js) séparés du rendu (ui/furnace.js) — le
// même découpage "state pur / representation" que Phase 10 (inventaire) et 13 (lumière).
const blockEntities = createBlockEntitySystem();
const furnaceUI = createFurnaceUI({
  elements: {
    panel: document.getElementById('furnacePanel'),
    inputSlot: document.getElementById('fInput'),
    fuelSlot: document.getElementById('fFuel'),
    outputSlot: document.getElementById('fOutput'),
    progressFill: document.getElementById('furnaceProgressFill'),
    flameFill: document.getElementById('furnaceFlameFill'),
    closeBtn: document.getElementById('closeFurnace'),
  },
  iconCanvas: blockAssets.iconCanvas,
  onClose: () => {
    if (!touchMode && document.pointerLockElement !== renderer.domElement)
      blocker.style.display = 'flex';
  },
});
let furnaceOpen = false;
function furnaceStateAt() {
  const p = furnaceUI.currentPos;
  return p ? blockEntities.ensure(p.x, p.y, p.z) : null;
}
function renderFurnace() {
  const state = furnaceStateAt();
  if (!state) return;
  const burnBudget = state.fuel ? FUELS[state.fuel.item] || 1 : FUELS[state.input?.item] || 8;
  furnaceUI.render(state, Math.max(1, burnBudget));
}
// clic sur une case entrée/combustible = "charge l'objet actuellement en main"
// (jusqu'à un plein slot) ; clic sur la sortie = "récupère tout ce qu'il y a".
// Pas de glisser-déposer (cf. PLAN.md Phase 14) : click-to-move suffit.
function loadFromHotbar(field, predicate) {
  const state = furnaceStateAt();
  if (!state || !selectedBlock || !predicate(selectedBlock)) return;
  const have = countOf(slots, selectedBlock);
  if (have <= 0) return;
  const existing = state[field];
  if (existing && existing.item !== selectedBlock) return; // case déjà occupée par autre chose
  const room = 64 - (existing?.count || 0);
  const move = Math.min(room, have);
  if (move <= 0) return;
  removeItem(slots, selectedBlock, move);
  state[field] = { item: selectedBlock, count: (existing?.count || 0) + move };
  bus.emit('inventory:changed');
  renderFurnace();
}
furnaceUI.setHandlers({
  onInputClick: () => loadFromHotbar('input', (item) => !!SMELTING[item]),
  onFuelClick: () => loadFromHotbar('fuel', (item) => !!FUELS[item]),
  onOutputClick: () => {
    const state = furnaceStateAt();
    if (!state || !state.output) return;
    const leftover = addItem(slots, state.output.item, state.output.count);
    state.output.count = leftover;
    if (leftover <= 0) state.output = null;
    bus.emit('inventory:changed');
    renderFurnace();
  },
});
function openFurnace(x, y, z) {
  furnaceOpen = true;
  furnaceUI.open(x, y, z);
  document.exitPointerLock();
  renderFurnace();
}
function closeFurnace() {
  furnaceOpen = false;
  furnaceUI.close();
}
// E ferme le panneau ouvert (fourneau prioritaire sur craft), ou ouvre craft sinon —
// jamais les deux en même temps. Partagé par la touche E et le bouton tactile inventaire.
function toggleCraftOrClose() {
  if (furnaceOpen) closeFurnace();
  else if (craftOpen) closeCraft();
  else openCraft();
}

/* ---------- Joueur ---------- */
// Apparition ET réapparition passent par la MÊME colonne sûre (SPAWN_COLUMN, calculée
// plus haut avec le monde) : le point d'origine en dur ne l'était pas — il pouvait
// tomber au fond d'une rivière, sous l'eau. `+ 1` : les pieds se posent juste
// au-dessus du bloc de surface, pas dedans.
function spawnPoint() {
  return new THREE.Vector3(SPAWN_COLUMN.x + 0.5, SPAWN_COLUMN.y + 1, SPAWN_COLUMN.z + 0.5);
}

const { player, updateVisuals, refreshHeldItem, toggleThirdPerson, triggerHandSwing, respawn } =
  createPlayer({
    scene,
    camera,
    materials: blockAssets.materials,
    blockTypes: blockAssets.blockTypes,
    toolTextures: blockAssets.toolTextures,
    collidesAtBox: worldApi.collidesAtBox,
    getBlock: worldApi.getBlock,
    spawnPos: spawnPoint(),
  });
healthUI.render(player);
hungerUI.render(player);
breathUI.render(player);
refreshHeldItem(selectedBlock);

function selectSlot(i) {
  if (i !== selectedIndex) sfx.playSound('equip');
  selectedIndex = i;
  selectedBlock = slots[i]?.item ?? null;
  hotbarUI.setSelectedIndex(i);
  hotbarUI.render(slots);
  refreshHeldItem(selectedBlock);
}

/* ---------- Items au sol (Phase 10) ---------- */
const itemSystem = createItemEntitySystem({
  scene,
  blockAssets,
  collidesAtBox: worldApi.collidesAtBox,
  playSound: sfx.playSound,
});
// appelé par itemSystem.update() quand une entité au sol est à portée de ramassage ;
// retourne la quantité réellement absorbée (l'inventaire peut être plein).
function pickupItem(item, count) {
  const leftover = addItem(slots, item, count);
  const taken = count - leftover;
  if (taken > 0) {
    bus.emit('inventory:changed');
    if (item === selectedBlock) refreshHeldItem(selectedBlock); // 1er pickup d'un slot vide tenu en main
  }
  return taken;
}

/* ---------- Lumière des torches (Phase 13) ---------- */
// Un PointLight par torche tuerait le framerate (c'est la leçon de la phase) : un
// petit pool de PointLight (8) réaffecté aux torches les plus proches du joueur,
// recalculé 2x/s (pas à chaque frame). Le vertex-color du mesher (world/light.js +
// render/mesher.js) reste la SEULE source de lumière pour tout le reste des torches.
const MAX_TORCH_LIGHTS = 8;
// Portée voulue : la lumière de la torche doit se voir jusqu'à ~5 blocs (demande
// explicite). `decay: 2` est l'atténuation physique en 1/d² — à 5 blocs il ne reste
// que 4 % de l'intensité, autant dire rien, c'est pourquoi les torches semblaient
// n'éclairer qu'elles-mêmes. `decay: 1` (linéaire) tient la distance, et `distance`
// fixe l'extinction complète nettement au-delà des 5 blocs utiles.
const TORCH_LIGHT_RANGE = 14;
const torchLightPool = Array.from({ length: MAX_TORCH_LIGHTS }, () => {
  const light = new THREE.PointLight(0xffb066, 2.6, TORCH_LIGHT_RANGE, 1);
  light.visible = false;
  scene.add(light);
  return light;
});
let torchLightTimer = 0;
function updateTorchLights(playerPos) {
  const nearest = [...torchPositions.values()]
    .map((p) => ({
      p,
      d2: (p.x - playerPos.x) ** 2 + (p.y - playerPos.y) ** 2 + (p.z - playerPos.z) ** 2,
    }))
    .sort((a, b) => a.d2 - b.d2)
    .slice(0, MAX_TORCH_LIGHTS);
  torchLightPool.forEach((light, i) => {
    const entry = nearest[i];
    light.visible = !!entry;
    // +0.55 en Y : la flamme est en HAUT du bâtonnet (cf. `shape` de la torche dans
    // data/blocks.js), pas au centre d'un cube — la lumière part donc d'où elle brûle.
    if (entry) light.position.set(entry.p.x + 0.5, entry.p.y + 0.55, entry.p.z + 0.5);
  });
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
  getBlock: worldApi.getBlock,
  isNight: skyApi.isNight,
  renderDistance,
  itemSystem,
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

/* ---------- Chat (T) + commandes / (Phase 15) ---------- */
const chatUI = createChatUI({
  logEl: document.getElementById('chatLog'),
  historyEl: document.getElementById('chatHistory'),
  inputBoxEl: document.getElementById('chatInputBox'),
  inputEl: document.getElementById('chatInput'),
  onSend: (text) => bus.emit('chat:message', text),
  onClose: () => {
    if (!touchMode && document.pointerLockElement !== renderer.domElement)
      blocker.style.display = 'flex';
  },
});

// Une commande = un nom (table COMMANDS, data/commands.js) -> un handler ici. Le
// parseur (core/commands.js) valide juste la forme (nom connu, bon nombre
// d'arguments) ; c'est ici, et seulement ici, qu'on touche l'état du jeu. Chaque
// handler renvoie le texte de confirmation à afficher dans le chat.
const commandHandlers = {
  help() {
    return Object.values(COMMANDS)
      .map((c) => c.help)
      .join('  |  ');
  },
  heal() {
    player.health = 20;
    bus.emit('player:health');
    return 'Vie remplie.';
  },
  fly() {
    player.flying = !player.flying;
    player.fallDistance = 0; // pas de dégâts de chute au retour au sol après un vol
    return player.flying ? 'Vol activé.' : 'Vol désactivé.';
  },
  time([value]) {
    let t;
    if (value === 'day') t = 0.5;
    else if (value === 'night') t = 0;
    else t = parseFloat(value);
    if (Number.isNaN(t)) return `Valeur invalide : ${value} (attendu day, night ou 0-1).`;
    skyApi.setTime(t);
    return `Heure réglée sur ${value}.`;
  },
  tp([xs, ys, zs]) {
    const x = parseFloat(xs),
      y = parseFloat(ys),
      z = parseFloat(zs);
    if ([x, y, z].some(Number.isNaN)) return 'Coordonnées invalides.';
    player.pos.set(x, y, z);
    player.velY = 0;
    return `Téléporté à ${x}, ${y}, ${z}.`;
  },
  give([item, countStr]) {
    if (!ITEM_NAMES[item]) {
      const suggestion = Object.keys(ITEM_NAMES).find((k) => k.startsWith(item));
      return suggestion
        ? `Item inconnu : ${item}. Tu voulais dire /give ${suggestion} ?`
        : `Item inconnu : ${item}.`;
    }
    const count = countStr ? parseInt(countStr, 10) : 1;
    if (!Number.isInteger(count) || count <= 0) return 'Quantité invalide.';
    const leftover = addItem(slots, item, count);
    bus.emit('inventory:changed');
    const given = count - leftover;
    return leftover > 0
      ? `${given}x ${ITEM_NAMES[item]} ajouté (inventaire plein pour le reste).`
      : `${given}x ${ITEM_NAMES[item]} ajouté.`;
  },
};

bus.on('chat:message', (text) => {
  const parsed = parseCommand(text, COMMANDS);
  if (parsed === null) {
    chatUI.addMessage(text); // chat normal : pas de réseau encore (Phase 21), juste local
    return;
  }
  if (parsed.error) {
    chatUI.addMessage(parsed.error, true);
    return;
  }
  const result = commandHandlers[parsed.name](parsed.args);
  chatUI.addMessage(result);
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
    toggleCraftOrClose();
    e.preventDefault();
    return;
  }
  if (e.code === 'KeyM') {
    music.toggleBgmMute();
    return;
  }
  if (e.code === 'KeyT') {
    if (!craftOpen && !furnaceOpen && !chatUI.isOpen) {
      chatUI.open();
      document.exitPointerLock();
    }
    e.preventDefault();
    return;
  }
  if (craftOpen || furnaceOpen || chatUI.isOpen) return;
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
  const digitMatch = e.code.match(/^Digit([1-9])$/);
  if (digitMatch) {
    const idx = parseInt(digitMatch[1], 10) - 1; // 1..9 -> slots hotbar 0..8
    if (idx < HOTBAR_SLOTS) selectSlot(idx);
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
    if (craftOpen || furnaceOpen) return;
    e.preventDefault();
    selectedIndex = (selectedIndex + (e.deltaY > 0 ? 1 : -1) + HOTBAR_SLOTS) % HOTBAR_SLOTS;
    selectedBlock = slots[selectedIndex]?.item ?? null;
    hotbarUI.setSelectedIndex(selectedIndex);
    hotbarUI.render(slots);
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
  if (!craftOpen && !furnaceOpen) renderer.domElement.requestPointerLock();
});
blocker.addEventListener('click', () => {
  sfx.resumeAudio();
  music.startBgm();
  renderer.domElement.requestPointerLock();
});
document.addEventListener('pointerlockchange', () => {
  blocker.style.display =
    document.pointerLockElement === renderer.domElement
      ? 'none'
      : craftOpen || furnaceOpen
        ? 'none'
        : 'flex';
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
    !!category && TOOL_CATEGORY[selectedBlock] === category && countOf(slots, selectedBlock) > 0
  );
}
function breakTimeFor(type) {
  const hardness = BLOCK_TYPES[type]?.hardness ?? 1;
  return hasRightToolFor(type) ? hardness / 2 : hardness;
}
// Phase 10 : casser un bloc ne remplit plus l'inventaire directement — il fait
// apparaître ses `drops` (data/blocks.js) au sol, à ramasser comme n'importe quel
// autre item. Le bonus d'outil double la quantité de chaque drop, comme avant.
function breakBlockAt(x, y, z, type) {
  const multiplier = hasRightToolFor(type) ? 2 : 1;
  const drops = BLOCK_TYPES[type]?.drops || [];
  drops.forEach(({ item, min, max }) => {
    const count = (min + Math.floor(Math.random() * (max - min + 1))) * multiplier;
    if (count > 0) itemSystem.spawn(x + 0.5, y + 0.3, z + 0.5, item, count);
  });
  worldApi.setBlock(x, y, z, null);
  particleSystem.burst(x + 0.5, y + 0.5, z + 0.5, type, 10);
  if (type === 'furnace') {
    const state = blockEntities.remove(x, y, z);
    if (
      furnaceOpen &&
      furnaceUI.currentPos?.x === x &&
      furnaceUI.currentPos?.y === y &&
      furnaceUI.currentPos?.z === z
    )
      closeFurnace();
    // rend au joueur ce qui restait dedans plutôt que de le perdre en silence
    [state?.input, state?.fuel, state?.output].forEach((cell) => {
      if (cell) itemSystem.spawn(x + 0.5, y + 0.3, z + 0.5, cell.item, cell.count);
    });
  }
  bus.emit('block:broken', { x, y, z, type });
  player.hunger = Math.max(0, player.hunger - 0.005); // coût ponctuel (Phase 11)
  bus.emit('player:hunger');
  sfx.playSound('break');
}

let leftMouseDown = false;
let breakKey = null;
let breakProgress = 0;
let breakTickTimer = 0; // Phase 19 : throttle du tic sonore de minage

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
    const hasSword = TOOL_CATEGORY[selectedBlock] === 'sword' && countOf(slots, selectedBlock) > 0;
    mobHit.mob.hit(hasSword ? 5 : 1);
    return;
  }
  // le cassage lui-même est géré dans animate() : il faut maintenir l'action
  // pointée sur le même bloc pendant breakTimeFor(type) secondes
}

// Manger (Phase 11) : clic droit avec un item de data/items.js FOOD sélectionné,
// que le viseur pointe un bloc ou non — contrairement à poser, manger n'a pas besoin
// d'une case adjacente. Retourne true si un item a bien été consommé.
function tryEat() {
  const food = FOOD[selectedBlock];
  if (!food || countOf(slots, selectedBlock) <= 0 || player.hunger >= 20) return false;
  removeItem(slots, selectedBlock, 1);
  player.hunger = Math.min(20, player.hunger + food.hunger);
  bus.emit('player:hunger');
  bus.emit('inventory:changed');
  sfx.playSound('eat');
  triggerHandSwing();
  return true;
}

// Tondre (Phase 18) : clic droit sur un mouton avec une épée équipée, prioritaire
// sur manger/poser (comme l'attaque au clic gauche est prioritaire sur casser).
function tryShear() {
  const mobHit = cachedMobHit;
  if (!mobHit || mobHit.mob.type !== 'sheep') return false;
  const hasSword = TOOL_CATEGORY[selectedBlock] === 'sword' && countOf(slots, selectedBlock) > 0;
  if (!hasSword) return false;
  return mobHit.mob.shear();
}

// Poser un bloc / ouvrir la table de craft (clic droit desktop, ▦ tactile).
function performSecondaryAction() {
  if (tryShear()) return;
  if (tryEat()) return;
  const blockHit = cachedBlockHit;
  if (!blockHit) return;
  const { x: tx, y: ty, z: tz } = blockHit.block; // bloc visé (existant)
  const targetedType = worldApi.getBlock(tx, ty, tz);
  if (targetedType === 'crafting_table') {
    openCraft();
    return;
  }
  if (targetedType === 'furnace') {
    openFurnace(tx, ty, tz);
    return;
  }
  if (NON_PLACEABLE.has(selectedBlock)) {
    hotbarUI.flashEmptySlot(selectedIndex);
    return;
  }
  if (countOf(slots, selectedBlock) <= 0) {
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
    triggerPlaceFeedback(x, y, z);
    removeItem(slots, selectedBlock, 1);
    bus.emit('inventory:changed');
    sfx.playSound('place');
  }
}

renderer.domElement.addEventListener('mousedown', (e) => {
  if (document.pointerLockElement !== renderer.domElement || craftOpen || furnaceOpen) return;
  if (e.button === 0) performPrimaryAction();
  else if (e.button === 2) performSecondaryAction();
});
renderer.domElement.addEventListener('contextmenu', (e) => e.preventDefault());
function stopBreaking() {
  leftMouseDown = false;
  breakKey = null;
  breakProgress = 0;
  breakTickTimer = 0;
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
      if (!craftOpen && !furnaceOpen && !chatUI.isOpen) performPrimaryAction();
    },
    onBreakEnd: stopBreaking,
    onPlace: () => {
      if (!craftOpen && !furnaceOpen && !chatUI.isOpen) performSecondaryAction();
    },
    onJump: (down) => {
      keys['Space'] = down;
    },
    onInventory: toggleCraftOrClose,
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
let hungerTickTimer = 4; // Phase 11 : dégâts de faim / régénération, au tic (4s), pas à la frame
let drownDamageTimer = 0; // même mécanique que lavaDamageTimer, une fois le souffle à 0
const hud = createHud({
  posEl: document.getElementById('pos'),
  targetEl: document.getElementById('target'),
  hintEl: document.getElementById('hint'),
  fpsEl: document.getElementById('fps'),
});

const STAND_HEIGHT = player.height,
  CROUCH_HEIGHT = player.height * 0.8;

// Phase 16 : l'eau est un vrai bloc, donc "être sous l'eau" = avoir la tête dans une
// cellule d'eau. Avant Phase 16, c'était un check analytique (hauteur de terrain vs
// SEA_LEVEL) car l'eau n'existait pas dans `data` -- remplacé maintenant que c'est le cas.
function isUnderwater() {
  return worldApi.isInWater(player.pos.x, player.pos.y + player.height * 0.85, player.pos.z);
}

function isInLava() {
  return worldApi.isInLava(player.pos.x, player.pos.y, player.pos.z);
}

function respawnPlayer() {
  respawn(spawnPoint());
  // Mort = on perd tout l'inventaire (hotbar + sac à dos), comme dans Minecraft.
  slots.fill(null);
  selectedBlock = slots[selectedIndex]?.item ?? null;
  refreshHeldItem(selectedBlock);
  bus.emit('inventory:changed');
  bus.emit('player:health');
  bus.emit('player:hunger');
  bus.emit('player:breath');
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
  hud.updateFps(rawDt);

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
  worldApi.update(player.pos, dt); // charge/décharge les chunks proches (Phase 4a) + écoulement des liquides (Phase 16)
  cloudsApi.update(dt, player.pos);

  torchLightTimer -= dt;
  if (torchLightTimer <= 0) {
    torchLightTimer = 0.5;
    updateTorchLights(player.pos);
  }

  particleSystem.update(dt);
  if (placeFeedbackTimer > 0) {
    placeFeedbackTimer -= dt;
    if (placeFeedbackTimer <= 0) placeFeedbackMesh.visible = false;
    else
      placeFeedbackMesh.scale.setScalar(1 + 0.35 * (placeFeedbackTimer / PLACE_FEEDBACK_DURATION));
  }

  // joystick/visée tactiles coupés pendant craft/chat, comme le reste des contrôles
  if (touchUI) touchUI.setActive(!craftOpen && !furnaceOpen && !chatUI.isOpen);

  blockEntities.update(dt, SMELTING, FUELS);
  if (furnaceOpen) renderFurnace();

  if (!craftOpen && !furnaceOpen && !chatUI.isOpen) {
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

    // Faim (Phase 11) : un taux continu (sprint > marche/idle) plus deux coûts
    // ponctuels (saut, minage — ce dernier est débité directement dans breakBlockAt).
    // La même forme "taux par seconde" que les dégâts de lave ci-dessus, mais lissée
    // en continu plutôt qu'en tic, car il n'y a pas besoin d'à-coup visible ici.
    const isMoving = dx !== 0 || dz !== 0;
    const hungerRate = sprinting && isMoving ? 0.05 : 0.005;
    player.hunger = Math.max(0, player.hunger - hungerRate * dt);

    // au tic (toutes les 4s, pas chaque frame) : famine si à 0, régénération si > 18
    hungerTickTimer -= dt;
    if (hungerTickTimer <= 0) {
      hungerTickTimer = 4;
      if (player.hunger <= 0) {
        player.health = Math.max(0, player.health - 1);
        bus.emit('player:health');
      } else if (player.hunger > 18 && player.health < 20) {
        player.health = Math.min(20, player.health + 1);
        player.hunger = Math.max(0, player.hunger - 1); // la régénération coûte de la faim
        bus.emit('player:health');
      }
      bus.emit('player:hunger');
    }

    // Noyade (Phase 11) : le souffle se vide sous l'eau, se remplit instantanément
    // hors de l'eau. isUnderwater() est encore le check analytique (hauteur de
    // terrain vs SEA_LEVEL) -- Phase 16 le repointera sur getBlock(...) === 'water'
    // une fois l'eau stockée comme un vrai bloc (cf. commentaire sur isUnderwater plus haut).
    if (underwater) {
      player.breath = Math.max(0, player.breath - dt);
      if (player.breath <= 0) {
        drownDamageTimer -= dt;
        if (drownDamageTimer <= 0) {
          player.health = Math.max(0, player.health - 1);
          bus.emit('player:health');
          sfx.playSound('drown');
          drownDamageTimer = 1;
        }
      } else {
        drownDamageTimer = 0;
      }
      bus.emit('player:breath');
    } else if (player.breath < player.maxBreath) {
      player.breath = player.maxBreath;
      drownDamageTimer = 0;
      bus.emit('player:breath');
    }

    if (isMoving) {
      resolveHorizontalMove(player, dx, dz, yaw, speed, dt, crouching, worldApi.collidesAtBox);
      if (player.onGround) {
        footstepTimer -= dt;
        if (footstepTimer <= 0) {
          sfx.playSound(underwater ? 'footstepWater' : 'footstep');
          footstepTimer = 0.38;
        }
      }
    }

    if (player.flying) {
      const vertical = (keys['Space'] ? 1 : 0) - (crouching ? 1 : 0);
      resolveFlyingVertical(player, dt, vertical, worldApi.collidesAtBox);
    } else if (underwater) {
      // Nage (Phase 16) : flottabilité (chute très ralentie, pas de "coulé comme une
      // pierre") + Espace nage vers la surface au lieu d'un saut plein — la même
      // résolution de collision que la gravité normale, juste une échelle différente.
      resolveVerticalPhysics(player, dt, worldApi.collidesAtBox, 0.25);
      if (keys['Space']) player.velY = Math.max(player.velY, 2.2);
    } else {
      const { landed, fallDistance } = resolveVerticalPhysics(player, dt, worldApi.collidesAtBox);
      if (landed) {
        sfx.playSound('land');
        // Dégâts de chute : la vie va de 0 à 20 pour 10 cœurs (health.js), donc
        // 1 point de vie = un demi-cœur. Les 3 premiers blocs de chute sont sans
        // dégât ; au-delà, 1 demi-cœur par bloc -- donc une chute de 4 blocs
        // (1 bloc au-delà de la franchise) retire bien 1 demi-cœur, comme demandé.
        const FALL_DAMAGE_FREE_BLOCKS = 3;
        const HALF_HEART = 1; // 1 point de vie == un demi-cœur affiché
        if (fallDistance > FALL_DAMAGE_FREE_BLOCKS) {
          const excessBlocks = Math.floor(fallDistance - FALL_DAMAGE_FREE_BLOCKS);
          if (excessBlocks > 0) {
            player.health = Math.max(0, player.health - excessBlocks * HALF_HEART);
            bus.emit('player:health');
            sfx.playSound('hurt');
          }
        }
      }
      if (keys['Space'] && tryJump(player)) {
        player.hunger = Math.max(0, player.hunger - 0.1); // coût ponctuel (Phase 11)
        bus.emit('player:hunger');
        sfx.playSound('jump');
      }
    }

    if (player.pos.y < -10) respawnPlayer();
    if (player.health <= 0) respawnPlayer();

    camera.rotation.order = 'YXZ';
    camera.rotation.y = yaw;
    camera.rotation.x = pitch;
    updateVisuals(dt, isMoving, yaw, pitch); // positionne la caméra (1ère/3e personne) + anime main et avatar

    mobSystem.update(dt, player.pos);
    itemSystem.update(dt, player.pos, pickupItem);
  }

  hud.updatePos(player.pos);
  refreshAimCache();
  const mobHit = cachedMobHit;
  const blockHit = cachedBlockHit;
  hud.updateTarget({ mobHit, blockHit, getBlock: worldApi.getBlock, blockTypes: BLOCK_TYPES });

  // Cassage progressif : maintenir le clic sur un bloc l'use au fil du temps. Le clic
  // relâché (ou craft/chat ouvert) arrête et remet à zéro pour de vrai. Mais un simple
  // raté d'UNE frame (micro-tremblement de souris à la limite des 6 blocs de portée,
  // le viseur qui rate le bloc pour une image) ne doit PAS effacer la progression —
  // sinon casser un bloc en bout de portée devient quasi impossible dans les faits.
  const mustStopBreaking =
    !leftMouseDown ||
    craftOpen ||
    furnaceOpen ||
    chatUI.isOpen ||
    (!touchMode && document.pointerLockElement !== renderer.domElement);
  if (mustStopBreaking) {
    breakKey = null;
    breakProgress = 0;
    breakTickTimer = 0;
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
          breakTickTimer = 0;
        }
        const total = breakTimeFor(type);
        breakProgress += dt;
        if (breakProgress >= total) {
          breakBlockAt(x, y, z, type);
          breakKey = null;
          breakProgress = 0;
          crackMesh.visible = false;
        } else {
          const ratio = breakProgress / total;
          const stage = Math.min(9, Math.floor(ratio * 10));
          crackMesh.position.set(x + 0.5, y + 0.5, z + 0.5);
          // wobble (Phase 19) : léger tremblement du bloc visé pendant le minage,
          // proportionnel au temps écoulé (pas à breakProgress seul, sinon la
          // fréquence ralentirait sur les blocs plus durs)
          const wobble = 1 + 0.02 * Math.sin(breakProgress * 40);
          crackMesh.scale.setScalar(wobble);
          crackMat.map = crackTextures[stage];
          crackMesh.visible = true;
          breakTickTimer -= dt;
          if (breakTickTimer <= 0) {
            breakTickTimer = 0.15;
            sfx.playBreakTick(ratio);
          }
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
