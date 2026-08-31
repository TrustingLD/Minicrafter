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
import { BLOCK_TYPES, TOOL_FOR_BLOCK, STAIRS_VARIANTS } from './data/blocks.js';
import {
  ITEM_NAMES,
  RECIPES,
  NON_PLACEABLE,
  TOOL_CATEGORY,
  FOOD,
  ARMOR_ITEMS,
  ARMOR_MATERIAL_REDUCTION,
} from './data/items.js';
import { SMELTING, FUELS } from './data/recipes.js';
import { createBlockEntitySystem } from './world/block-entities.js';
import { SEA_LEVEL, getHeight, getBiome, findSpawnColumn } from './world/generator.js';
import { createWorld } from './world/world.js';
import { createClouds } from './world/clouds.js';
import { createSky } from './world/sky.js';
import { createSnowWeather } from './world/weather.js';
import { createSfx } from './audio/sfx.js';
import { createMusic } from './audio/music.js';
import { createMobTextures, createMobSystem } from './entities/mob.js';
import { createPlayer } from './entities/player.js';
import { createParticleSystem } from './entities/particles.js';
import { computeArmorReduction as armorComputeReduction } from './entities/armor.js';
import {
  resolveHorizontalMove,
  resolveVerticalPhysics,
  tryJump,
  resolveFlyingVertical,
  applyPlayerKnockback,
  resolveKnockback,
} from './world/physics.js';
import { createHud } from './ui/hud.js';
import {
  createSlots,
  createArmorSlots,
  addItem,
  removeItem,
  countOf,
  HOTBAR_SLOTS,
} from './entities/inventory.js';
import { createItemEntitySystem } from './entities/item-entity.js';
import { createHotbarUI } from './ui/hotbar.js';
import { createHealthUI } from './ui/health.js';
import { createHungerUI, createBreathUI } from './ui/hunger.js';
import { createCraftUI } from './ui/craft.js';
import { createCharPreview } from './ui/char-preview.js';
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
scene.fog = new THREE.Fog(0x87ceeb, 25, 70);

// Teinte sous l'eau : mêmes valeurs "à sec" que ci-dessus, réutilisées pour
// restaurer le fog chaque frame où on n'est PAS sous l'eau (sky.js, lui, ne
// touche qu'à la couleur du fog, jamais à near/far -- cf. isUnderwater plus bas).
const FOG_NEAR_DRY = 25,
  FOG_FAR_DRY = 70;
const UNDERWATER_COLOR = new THREE.Color(0x1f4f8f);
const UNDERWATER_FOG_NEAR = 0,
  UNDERWATER_FOG_FAR = 18;

const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 600);
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
const music = createMusic(
  [
    './luft-mini.mp3',
    './minicrafter_theme_final.mp3',
    './nightpersonas.mp3',
    './mini-hands.mp3',
    './mini-city3.mp3',
  ],
  musicHintEl,
);
document.getElementById('musicHint').addEventListener('click', music.toggleBgmMute);
document.getElementById('musicNextBtn').addEventListener('click', music.nextTrack);

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
const snowWeatherApi = createSnowWeather({ scene });

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
const armorSlots = createArmorSlots(); // 4 emplacements casque/plastron/jambières/bottes (cf. E)

// Réduction de dégâts (Phase 19) : pur import depuis entities/armor.js
// (testable), voir ce module pour le détail du calcul.
function computeArmorReduction() {
  return armorComputeReduction(armorSlots, ARMOR_ITEMS, ARMOR_MATERIAL_REDUCTION);
}

// Applique l'armure puis retire les points de vie -- centralise ce que faisaient
// jusqu'ici plusieurs `player.health = Math.max(0, player.health - dmg)` séparés
// (mobs, lave, cactus, chute), pour que l'armure s'applique UNIFORMÉMENT à toutes
// ces sources. Comme dans Minecraft, la faim et la noyade ignorent l'armure --
// ces deux-là continuent d'appeler player.health directement, sans passer par ici.
function damagePlayer(amount) {
  const reduced = amount * (1 - computeArmorReduction());
  player.health = Math.max(0, player.health - reduced);
  bus.emit('player:health');
}

let selectedIndex = 0;
let selectedBlock = slots[selectedIndex]?.item ?? null;

/* ---------- UI ---------- */
const hotbarUI = createHotbarUI({
  hotbarEl: document.getElementById('hotbar'),
  blockTypes: BLOCK_TYPES,
  itemNames: ITEM_NAMES,
  iconCanvas: blockAssets.iconCanvas,
  iconFaces3D: blockAssets.iconFaces3D,
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

// Secousse de caméra sur dégât : la caméra part à 20° d'inclinaison puis revient
// SOUPLEMENT à 0, comme un ressort qui se relâche (pas un aller-retour instantané).
// `hurtTiltAngle` est l'inclinaison courante (en radians) ; on la fait décroître
// exponentiellement vers 0 à chaque frame dans la boucle de rendu, à côté de
// rotation.x/y (cf. plus bas). L'angle est signé aléatoirement à chaque coup pour
// que la caméra ne penche pas toujours du même côté.
const HURT_TILT_ANGLE = (20 * Math.PI) / 180; // 20°
const HURT_TILT_DECAY = 10; // plus haut = retour au neutre plus rapide
let hurtTiltAngle = 0;

bus.on('player:health', () => {
  if (player.health < lastHealth) {
    hurtVignetteEl.classList.add('flash');
    setTimeout(() => hurtVignetteEl.classList.remove('flash'), 80);
    hurtTiltAngle = HURT_TILT_ANGLE * (Math.random() < 0.5 ? -1 : 1);
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
    hotbarGrid: document.getElementById('invHotbarGrid'),
    armorSlotEls: Array.from(document.querySelectorAll('.armorSlot')),
    recipeList: document.getElementById('recipeList'),
    craftTitle: document.getElementById('craftTitle'),
    craftGridEls: Array.from(document.querySelectorAll('.craftCell')),
    craftOutputEl: document.getElementById('craftOutput'),
    cursorEl: document.getElementById('craftCursor'),
  },
  RECIPES,
  itemNames: ITEM_NAMES,
  iconCanvas: blockAssets.iconCanvas,
  iconFaces3D: blockAssets.iconFaces3D,
  playSound: sfx.playSound,
  armorItems: ARMOR_ITEMS,
  onCrafted: () => bus.emit('inventory:changed'),
  // le sac à dos/la hotbar/les emplacements d'armure utilisent tous le même
  // patron "curseur" (ramasser/poser/fusionner à la souris, cf. ui/craft.js) --
  // onSlotClick n'est plus qu'un signal générique ("l'inventaire vient de
  // changer") pour resynchroniser l'objet en main.
  onSlotClick: () => {
    selectedBlock = slots[selectedIndex]?.item ?? null;
    refreshHeldItem(selectedBlock);
    bus.emit('inventory:changed');
  },
  // cliquer une case de la hotbar dupliquée dans le panneau = changer la
  // sélection active, sans fermer l'inventaire.
  onHotbarSlotClick: (hotbarIndex) => {
    selectSlot(hotbarIndex);
    craftUI.render(slots, worldApi.getBlock, player.pos, selectedIndex, armorSlots);
  },
});
let craftOpen = false;
function openCraft() {
  craftOpen = true;
  craftUI.show();
  charPreview.show();
  document.exitPointerLock();
  craftUI.render(slots, worldApi.getBlock, player.pos, selectedIndex, armorSlots);
}
function closeCraft() {
  craftOpen = false;
  blocker.style.display = 'none';
  blocker.classList.remove('paused');
  resumePointerLock();
  craftUI.hide();
  charPreview.hide();
}
document.getElementById('closeCraft').addEventListener('click', (e) => {
  e.preventDefault();
  e.stopPropagation();
  closeCraft();
});

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
    invGrid: document.getElementById('furnaceInvGrid'),
    hotbarGrid: document.getElementById('furnaceHotbarGrid'),
    cursorEl: document.getElementById('craftCursor'),
    closeBtn: document.getElementById('closeFurnace'),
  },
  iconCanvas: blockAssets.iconCanvas,
  iconFaces3D: blockAssets.iconFaces3D,
  SMELTING,
  FUELS,
    onClose: () => {
    furnaceOpen = false;
    blocker.style.display = 'none';
    blocker.classList.remove('paused');
    resumePointerLock();
  },
  onInventoryChanged: () => {
    selectedBlock = slots[selectedIndex]?.item ?? null;
    refreshHeldItem(selectedBlock);
    bus.emit('inventory:changed');
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
  furnaceUI.render(state, Math.max(1, burnBudget), slots, selectedIndex);
}
function openFurnace(x, y, z) {
  furnaceOpen = true;
  furnaceUI.show(x, y, z);
  if (!touchMode && document.pointerLockElement === renderer.domElement) {
    document.exitPointerLock();
  }
  renderFurnace();
}
function closeFurnace() {
  furnaceOpen = false;
  blocker.style.display = 'none';
  blocker.classList.remove('paused');
  resumePointerLock();
  furnaceUI.hide();
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

// on garde une référence à l'objet complet (playerCtrl) en plus des propriétés
// déstructurées : `viewMode` est un getter posé sur cet objet, pas sur `player`
// (qui n'est que l'état position/vie/faim). Le déstructurer directement aurait
// figé sa valeur au moment de l'appel au lieu de la relire à chaque F5.
const playerCtrl = createPlayer({
  scene,
  camera,
  materials: blockAssets.materials,
  blockTypes: blockAssets.blockTypes,
  toolTextures: blockAssets.toolTextures,
  stairsGeometry: blockAssets.stairsGeometry,
  stairsMaterials: blockAssets.stairsMaterials,
  collidesAtBox: worldApi.collidesAtBox,
  getBlock: worldApi.getBlock,
  spawnPos: spawnPoint(),
});
const {
  player,
  playerAvatar,
  handPivot,
  updateVisuals,
  refreshHeldItem,
  toggleThirdPerson,
  triggerHandSwing,
  respawn,
  setArmor,
  buildAvatar,
} = playerCtrl;
healthUI.render(player);
hungerUI.render(player);
breathUI.render(player);
refreshHeldItem(selectedBlock);

// Aperçu 3D de l'inventaire (Phase 20) : un second exemplaire du MÊME avatar
// (buildAvatar réutilise les matériaux/textures de playerCtrl, cf.
// entities/player-model.js) rendu dans le petit canvas du panneau de craft.
const charPreview = createCharPreview({
  canvas: document.getElementById('charPreviewCanvas'),
  buildAvatar,
});

// Réduction de dégâts + affichage de l'armure (Phase 19/20) : dérive, à partir
// des 4 emplacements d'armure, l'objet { helmet, chest, legs, feet } attendu
// par setArmor -- réutilisé pour l'avatar en jeu (F5) ET l'aperçu d'inventaire,
// pour qu'ils affichent toujours la même chose.
const ARMOR_SLOT_KEY = ['helmet', 'chest', 'legs', 'feet'];
function computeArmorVisual() {
  const visual = {};
  armorSlots.forEach((cell, i) => {
    if (!cell) return;
    const meta = ARMOR_ITEMS[cell.item];
    if (meta) visual[ARMOR_SLOT_KEY[i]] = meta.material;
  });
  return visual;
}
function refreshArmorVisual() {
  const visual = computeArmorVisual();
  setArmor(visual);
  charPreview.setArmor(visual);
}
refreshArmorVisual(); // état initial (rien d'équipé au démarrage, mais garde les 2 avatars synchronisés dès le départ)
bus.on('inventory:changed', refreshArmorVisual);

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

// Jeter un objet (touche A sur clavier AZERTY = physiquement la même touche que
// le Q anglais/QWERTY, cf. e.code plus bas -- exactement le raccourci "drop" de
// Minecraft). Retire 1 unité du slot hotbar sélectionné et fait apparaître un
// item au sol devant le joueur, propulsé dans la direction regardée.
const dropDir = new THREE.Vector3();
const THROW_SPEED = 4;
function dropSelectedItem() {
  const stack = slots[selectedIndex];
  if (!stack) return; // rien à jeter dans le slot actif
  const item = stack.item;
  stack.count -= 1;
  if (stack.count <= 0) slots[selectedIndex] = null;
  selectedBlock = slots[selectedIndex]?.item ?? null;
  hotbarUI.render(slots);
  refreshHeldItem(selectedBlock);
  bus.emit('inventory:changed');

  getAimDirection(dropDir); // direction visée (yaw + pitch) -- indépendante de la caméra (vue selfie)
  const eyeY = player.pos.y + player.height;
  // apparaît un peu devant les yeux du joueur pour ne pas se fondre avec le bloc visé/le corps
  const spawnX = player.pos.x + dropDir.x * 0.6;
  const spawnY = eyeY + dropDir.y * 0.6;
  const spawnZ = player.pos.z + dropDir.z * 0.6;
  const dropped = itemSystem.spawn(spawnX, spawnY, spawnZ, item, 1);
  if (dropped) {
    dropped.velX = dropDir.x * THROW_SPEED;
    dropped.velY = dropDir.y * THROW_SPEED + 2; // petit boost vertical, comme un vrai lancer
    dropped.velZ = dropDir.z * THROW_SPEED;
  }
  sfx.playSound('equip'); // pas de son dédié pour l'instant, réutilise le clic d'équipement
  triggerHandSwing();
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
  onPlayerHurt: (dmg, attackerPos) => {
    damagePlayer(dmg);
    // Knockback (retour utilisateur) : le joueur recule quand un zombie le
    // touche, comme les mobs reculent déjà quand le joueur les frappe.
    if (attackerPos) applyPlayerKnockback(player, attackerPos.x, attackerPos.z);
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
    resumePointerLock();
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
  speedfly([raw]) {
    // accepte "x2" comme "2" ; borne large pour éviter un vol inutilisable (trop
    // lent) ou qui traverse les chunks non générés (trop rapide)
    const value = parseFloat(raw.replace(/^x/i, ''));
    if (Number.isNaN(value) || value <= 0) {
      return `Valeur invalide : ${raw} (attendu par ex. x2, x0.5).`;
    }
    const clamped = Math.min(10, Math.max(0.25, value));
    player.flySpeedMultiplier = clamped;
    return `Vitesse de vol réglée sur x${clamped}.`;
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
    if (sleeping) return; // le lit impose déjà sa propre vue -- pas de bascule pendant qu'on dort
    toggleThirdPerson();
    // le viseur (croix centrale) n'a de sens que quand la caméra regarde dans la
    // direction visée -- en vue selfie elle regarde le joueur, donc on la masque.
    const crosshair = document.getElementById('crosshair');
    // caché dès qu'on quitte la 1ère personne (viewMode 0) : 3e personne (1) ET selfie (2)
    if (crosshair) crosshair.style.display = playerCtrl.viewMode !== 0 ? 'none' : '';
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
    if (!sleeping && !gameOverOpen) toggleCraftOrClose();
    e.preventDefault();
    return;
  }
  if (e.code === 'KeyM') {
    music.toggleBgmMute();
    return;
  }
  if (e.code === 'KeyL') {
    music.nextTrack();
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
  if (sleeping || craftOpen || furnaceOpen || chatUI.isOpen || gameOverOpen) return;
  if (e.code === 'KeyC') {
    zoomed = !zoomed;
    return;
  }
  if (e.code === 'KeyQ' && !e.repeat) {
    // Touche "A" en AZERTY = même position physique que "Q" en QWERTY (comme le
    // ZQSD des déplacements, cf. plus haut) -> jeter un objet, raccourci Minecraft.
    dropSelectedItem();
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
const soloBtn = document.getElementById('soloBtn');
// `false` tant qu'on est sur l'écran-titre initial, `true` dès qu'on a cliqué
// "Solo" (ou qu'on est en tactile) -- distingue le TOUT PREMIER affichage du
// #blocker (vrai menu principal) d'un éventuel réaffichage plus tard (perte
// de pointer lock imprévue, cf. showResumeBlocker() ci-dessous).
let gameStarted = false;
// Redemande directement le pointer lock (ZQSD/souris repris tout de suite,
// sans écran intermédiaire) -- appelé depuis les endroits où on VIENT de
// fermer un panneau nous-mêmes (E pour l'inventaire, bouton fermer du
// fourneau, fermeture du chat, sortie de lit) : dans tous ces cas on est
// dans le handler d'un vrai geste utilisateur (touche ou clic), donc le
// navigateur autorise requestPointerLock() sans autre interaction. Retour
// utilisateur : "on doit juste cliquer sur E ... et reprendre la partie
// direct", pas de "cliquez pour reprendre".
function resumePointerLock() {
  if (!touchMode) {
    try {
      const p = renderer.domElement.requestPointerLock();
      if (p && typeof p.catch === 'function') {
        p.catch(() => {
          showResumeBlocker();
        });
      }
    } catch {
      showResumeBlocker();
    }
  }
}
function showResumeBlocker() {
  if (gameStarted && !craftOpen && !furnaceOpen && !chatUI.isOpen && !sleeping && !gameOverOpen) {
    blocker.classList.add('paused');
    blocker.style.display = 'flex';
  }
}
renderer.domElement.addEventListener('click', () => {
  sfx.resumeAudio();
  music.startBgm();
  if (!sleeping && !craftOpen && !furnaceOpen && !chatUI.isOpen && !gameOverOpen) {
    if (document.pointerLockElement !== renderer.domElement) {
      resumePointerLock();
    }
  }
});
soloBtn.addEventListener('click', () => {
  sfx.resumeAudio();
  music.startBgm();
  gameStarted = true;
  if (touchMode)
    blocker.style.display = 'none';
  else resumePointerLock();
});
document.addEventListener('pointerlockchange', () => {
  if (document.pointerLockElement === renderer.domElement) {
    blocker.style.display = 'none';
    blocker.classList.remove('paused');
  } else if (sleeping || craftOpen || furnaceOpen || chatUI.isOpen || gameOverOpen) {
    blocker.style.display = 'none';
  } else {
    showResumeBlocker();
  }
});
blocker.addEventListener('click', () => {
  if (gameStarted && !craftOpen && !furnaceOpen && !chatUI.isOpen && !sleeping && !gameOverOpen) {
    resumePointerLock();
  }
});
let pointerLockRetryTimer = null;
document.addEventListener('pointerlockerror', () => {
  if (gameStarted && !craftOpen && !furnaceOpen && !chatUI.isOpen && !sleeping && !gameOverOpen) {
    showResumeBlocker();
    if (!pointerLockRetryTimer) {
      pointerLockRetryTimer = setTimeout(() => {
        pointerLockRetryTimer = null;
        resumePointerLock();
      }, 500);
    }
  }
});
document.addEventListener('mousemove', (e) => {
  if (document.pointerLockElement !== renderer.domElement) return;
  yaw -= e.movementX * 0.0025;
  pitch -= e.movementY * 0.0025;
  pitch = Math.max(-Math.PI / 2 + 0.01, Math.min(Math.PI / 2 - 0.01, pitch));
});

// Direction visée, calculée depuis yaw/pitch plutôt que via camera.getWorldDirection() :
// en vue selfie (F5 x2, cf. player.js) la caméra est tournée pour regarder VERS le
// joueur, donc son orientation ne correspond plus du tout à la direction réellement
// visée par le joueur (viseur bloc, lancer d'objet doivent rester basés sur yaw/pitch).
function getAimDirection(out) {
  return out.set(0, 0, -1).applyEuler(new THREE.Euler(pitch, yaw, 0, 'YXZ'));
}

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
  getAimDirection(rayDir);
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
  if (type === 'bed_foot' || type === 'bed_head') {
    breakBed(x, y, z, type);
    return;
  }
  if (type.startsWith('door_')) {
    breakDoor(x, y, z, type);
    return;
  }
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

// Casser une moitié de lit casse l'autre avec elle et ne rend qu'UN SEUL item
// "lit" (pas deux) : recherche la moitié voisine (N/S/E/O) du bon type, plutôt
// que de retenir une orientation stockée à part.
function breakBed(x, y, z, type) {
  const otherType = type === 'bed_foot' ? 'bed_head' : 'bed_foot';
  const neighbors = [
    [x + 1, y, z],
    [x - 1, y, z],
    [x, y, z + 1],
    [x, y, z - 1],
  ];
  const pair = neighbors.find(([nx, ny, nz]) => worldApi.getBlock(nx, ny, nz) === otherType);
  worldApi.setBlock(x, y, z, null);
  particleSystem.burst(x + 0.5, y + 0.5, z + 0.5, type, 10);
  if (pair) {
    const [px, py, pz] = pair;
    worldApi.setBlock(px, py, pz, null);
    particleSystem.burst(px + 0.5, py + 0.5, pz + 0.5, otherType, 10);
  }
  itemSystem.spawn(x + 0.5, y + 0.3, z + 0.5, 'bed', 1);
  bus.emit('block:broken', { x, y, z, type });
  player.hunger = Math.max(0, player.hunger - 0.005);
  bus.emit('player:hunger');
  sfx.playSound('break');
}

// Casser une moitié de porte casse l'autre avec elle et ne rend qu'UN SEUL item
// "porte" (peu importe l'état ouvert/fermé au moment de la casse, ni l'axe) --
// contrairement au lit (paire horizontale, recherche N/S/E/O), la moitié jumelle
// d'une porte est toujours juste au-dessus (si on casse le bas) ou en-dessous (si
// on casse le haut), jamais besoin de chercher.
function breakDoor(x, y, z, type) {
  const isBottom = type.includes('_bottom_');
  const otherY = isBottom ? y + 1 : y - 1;
  const otherType = worldApi.getBlock(x, otherY, z);
  worldApi.setBlock(x, y, z, null);
  particleSystem.burst(x + 0.5, y + 0.5, z + 0.5, type, 10);
  if (otherType && otherType.startsWith('door_')) {
    worldApi.setBlock(x, otherY, z, null);
    particleSystem.burst(x + 0.5, otherY + 0.5, z + 0.5, otherType, 10);
  }
  itemSystem.spawn(x + 0.5, y + 0.3, z + 0.5, 'door', 1);
  bus.emit('block:broken', { x, y, z, type });
  player.hunger = Math.max(0, player.hunger - 0.005);
  bus.emit('player:hunger');
  sfx.playSound('break');
}

/* ---------- Dormir (clic droit sur un lit) ---------- */
// Fige le joueur, pose l'avatar allongé en travers du lit et place la caméra
// façon "selfie" (F5 x2) fixe pour qu'il se voie couché -- jusqu'au clic sur
// #leaveBedBtn. `player.pos` n'est volontairement PAS déplacé (seul l'avatar
// visuel + la caméra bougent) : pas besoin de mémoriser/restaurer une position
// debout, et la physique reste simplement gelée pendant le sommeil (cf. le
// `!sleeping` ajouté à la grosse condition de mise à jour dans animate()).
let sleeping = false;
const sleepOverlay = document.getElementById('sleepOverlay');
function trySleep(x, y, z, type) {
  if (sleeping || craftOpen || furnaceOpen || chatUI.isOpen || gameOverOpen) return;
  // même recherche de la moitié jumelle que breakBed() : le lit est toujours
  // posé en paire adjacente (N/S/E/O), jamais stocké comme une seule entité.
  const otherType = type === 'bed_foot' ? 'bed_head' : 'bed_foot';
  const neighbors = [
    [x + 1, y, z],
    [x - 1, y, z],
    [x, y, z + 1],
    [x, y, z - 1],
  ];
  const pair = neighbors.find(([nx, ny, nz]) => worldApi.getBlock(nx, ny, nz) === otherType);
  if (!pair) return; // lit incomplet (ne devrait pas arriver) -- on ignore plutôt que de planter
  const foot = type === 'bed_foot' ? { x, y, z } : { x: pair[0], y: pair[1], z: pair[2] };
  const head = type === 'bed_head' ? { x, y, z } : { x: pair[0], y: pair[1], z: pair[2] };
  const dx = head.x - foot.x,
    dz = head.z - foot.z;
  // même convention que getAimDirection() (forward = (0,0,-1).applyEuler(yaw)) --
  // inversée ici pour retrouver le yaw qui pointe du pied vers la tête du lit.
  const bedYaw = Math.atan2(-dx, -dz);

  sleeping = true;

  // avatar couché : on réutilise le groupe 3e personne (habituellement caché en
  // vue 1ère personne) plutôt que de créer un modèle dédié -- une rotation de
  // 90° autour de l'axe X local (après le lacet vers la tête de lit) suffit à
  // coucher toute la hiérarchie articulée (torse/tête/bras/jambes) d'un coup.
  playerAvatar.group.visible = true;
  handPivot.visible = false;
  playerAvatar.group.position.set(foot.x + 0.5, foot.y + 0.56, foot.z + 0.5);
  playerAvatar.group.rotation.order = 'YXZ';
  playerAvatar.group.rotation.y = bedYaw;
  playerAvatar.group.rotation.x = -Math.PI / 2;

  // caméra fixe, en retrait et légèrement au-dessus du lit, tournée vers le
  // joueur couché -- le même principe que la vue selfie (F5 x2) mais figé sur
  // le lit plutôt que suivant la visée en direct (le pointeur est relâché
  // pendant le sommeil, yaw/pitch ne bougent plus de toute façon).
  const camDist = 3;
  camera.position.set(
    foot.x + 0.5 + Math.sin(bedYaw) * camDist,
    foot.y + 2.2,
    foot.z + 0.5 + Math.cos(bedYaw) * camDist,
  );
  camera.rotation.order = 'YXZ';
  camera.lookAt(foot.x + 0.5 + dx * 0.5, foot.y + 0.7, foot.z + 0.5 + dz * 0.5);

  const crosshair = document.getElementById('crosshair');
  if (crosshair) crosshair.style.display = 'none';
  document.exitPointerLock();
  sleepOverlay.style.display = 'flex';
}
function leaveBed() {
  if (!sleeping) return;
  sleeping = false;
  sleepOverlay.style.display = 'none';
  // updateVisuals() ne remet jamais group.rotation.x à zéro (il ne pose que
  // .rotation.y, cf. player.js) -- sans ce reset explicite le joueur restait
  // visuellement couché pour toujours après avoir quitté le lit, y compris en
  // vue F5/selfie.
  playerAvatar.group.rotation.x = 0;
  // .visible n'est lui non plus jamais touché par updateVisuals -- seul
  // toggleThirdPerson() le fait (cf. player.js). trySleep() l'avait forcé à
  // `true` (+ handPivot à `false`) pour qu'on se voie couché même en vue 1ère
  // personne ; sans ce reset, en vue 1ère personne on restait ensuite avec
  // l'avatar (buste bleu) planté dans la caméra au lieu de la main tenue.
  playerAvatar.group.visible = playerCtrl.thirdPerson;
  handPivot.visible = !playerCtrl.thirdPerson;
  // pas de repositionnement à faire par ailleurs : le prochain appel à updateVisuals (débloqué
  // dès que `sleeping` repasse à false) replace avatar/caméra/main selon le mode
  // de vue (F5) et la position réelle du joueur, exactement comme à chaque frame
  // normale -- cf. le `!sleeping` dans la grosse condition de animate().
  const crosshair = document.getElementById('crosshair');
  if (crosshair) crosshair.style.display = playerCtrl.viewMode !== 0 ? 'none' : '';
  if (!touchMode && document.pointerLockElement !== renderer.domElement) resumePointerLock();
}
sleepOverlay.querySelector('#leaveBedBtn').addEventListener('click', leaveBed);

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
    mobHit.mob.hit(hasSword ? 5 : 1, player.pos);
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

// Poser un lit (Phase 20) : pose 2 blocs (bed_foot + bed_head) d'un coup au lieu
// d'un seul, dans le sens où le joueur regarde (arrondi à l'axe N/S/E/O le plus
// proche). Appelée en amont du placement générique dans performSecondaryAction --
// le lit n'est volontairement PAS dans BLOCK_TYPES (pas de placement 1-bloc générique
// possible pour lui), donc NON_PLACEABLE le considère à tort comme "non posable" ;
// c'est pour ça qu'on l'intercepte avant ce check plutôt que d'essayer de le contourner.
function tryPlaceBed() {
  if (countOf(slots, 'bed') <= 0) {
    hotbarUI.flashEmptySlot(selectedIndex);
    return;
  }
  const blockHit = cachedBlockHit;
  if (!blockHit) return;
  const { x, y, z } = blockHit.place; // case vide où poser le pied du lit

  const px = Math.floor(player.pos.x),
    py0 = Math.floor(player.pos.y),
    py1 = Math.floor(player.pos.y + player.height),
    pz = Math.floor(player.pos.z);
  const insidePlayer = (cx, cy, cz) => cx === px && cz === pz && (cy === py0 || cy === py1);

  // direction horizontale regardée, arrondie à l'axe dominant (N/S/E/O) : la tête
  // du lit se pose une case plus loin dans cette direction.
  const dir = new THREE.Vector3(0, 0, -1).applyEuler(new THREE.Euler(0, yaw, 0, 'YXZ'));
  let dx = 0,
    dz = 0;
  if (Math.abs(dir.x) > Math.abs(dir.z)) dx = Math.sign(dir.x);
  else dz = Math.sign(dir.z);
  const hx = x + dx,
    hy = y,
    hz = z + dz;

  if (insidePlayer(x, y, z) || insidePlayer(hx, hy, hz)) return;
  // les 2 cases doivent être libres, ET avoir un sol sous elles (sinon le lit flotte)
  if (worldApi.getBlock(x, y, z) || worldApi.getBlock(hx, hy, hz)) {
    hotbarUI.flashEmptySlot(selectedIndex);
    return;
  }
  if (!worldApi.getBlock(x, y - 1, z) || !worldApi.getBlock(hx, hy - 1, hz)) {
    hotbarUI.flashEmptySlot(selectedIndex);
    return;
  }

  worldApi.setBlock(x, y, z, 'bed_foot');
  worldApi.setBlock(hx, hy, hz, 'bed_head');
  triggerPlaceFeedback(x, y, z);
  triggerHandSwing();
  removeItem(slots, 'bed', 1);
  bus.emit('inventory:changed');
  sfx.playSound('place');
}

// Poser un escalier (bois ou pierre) : comme tryPlaceBed ci-dessus, un seul
// item en poche ('stairs_wood'/'stairs_stone') mais 4 blocs réels possibles
// selon l'orientation -- ici, la direction regardée par le joueur (arrondie à
// l'axe N/S/E/O dominant, même calcul que le lit) devient `facing` : la marche
// basse s'ouvre du côté par lequel on regarde, donc on peut avancer et monter
// directement dessus dans la foulée. Un seul bloc posé (pas 2 comme le lit),
// donc appelée en amont du placement générique, sur le même principe.
function tryPlaceStairs(item) {
  if (countOf(slots, item) <= 0) {
    hotbarUI.flashEmptySlot(selectedIndex);
    return;
  }
  const blockHit = cachedBlockHit;
  if (!blockHit) return;
  const { x, y, z } = blockHit.place;

  const px = Math.floor(player.pos.x),
    py0 = Math.floor(player.pos.y),
    py1 = Math.floor(player.pos.y + player.height),
    pz = Math.floor(player.pos.z);
  if (x === px && z === pz && (y === py0 || y === py1)) return;
  if (worldApi.getBlock(x, y, z)) return;

  // `dir` pointe du joueur vers le bloc posé (même calcul que tryPlaceBed) --
  // la marche basse doit s'ouvrir du côté le plus proche du joueur (celui par
  // lequel il vient de s'approcher), donc `facing` prend le sens INVERSE de
  // `dir` : si le joueur regarde vers +z (il est du côté -z, "nord"), la marche
  // basse doit être au nord.
  const dir = new THREE.Vector3(0, 0, -1).applyEuler(new THREE.Euler(0, yaw, 0, 'YXZ'));
  const facing =
    Math.abs(dir.x) > Math.abs(dir.z)
      ? dir.x > 0
        ? 'west'
        : 'east'
      : dir.z > 0
        ? 'north'
        : 'south';

  worldApi.setBlock(x, y, z, STAIRS_VARIANTS[item][facing]);
  triggerPlaceFeedback(x, y, z);
  triggerHandSwing();
  removeItem(slots, item, 1);
  bus.emit('inventory:changed');
  sfx.playSound('place');
}

// Poser une porte (Phase 21) : 2 blocs empilés à LA VERTICALE (bas + haut), pas à
// l'horizontale comme le lit -- un seul point de pose (`blockHit.place`) suffit
// donc, la seconde case est juste celle du dessus. L'axe ('x'/'z', cf. commentaire
// de data/blocks.js) est choisi pour que le panneau barre bien le passage devant
// le joueur : perpendiculaire à son regard, comme un vrai battant de porte.
function tryPlaceDoor() {
  if (countOf(slots, 'door') <= 0) {
    hotbarUI.flashEmptySlot(selectedIndex);
    return;
  }
  const blockHit = cachedBlockHit;
  if (!blockHit) return;
  const { x, y, z } = blockHit.place; // case du bas

  const px = Math.floor(player.pos.x),
    py0 = Math.floor(player.pos.y),
    py1 = Math.floor(player.pos.y + player.height),
    pz = Math.floor(player.pos.z);
  const insidePlayer = (cx, cy, cz) => cx === px && cz === pz && (cy === py0 || cy === py1);
  if (insidePlayer(x, y, z) || insidePlayer(x, y + 1, z)) return;

  // les 2 cases (bas + haut) doivent être libres, ET avoir un sol sous le bas
  // (même exigence que le lit -- pas de porte flottante dans le vide).
  if (worldApi.getBlock(x, y, z) || worldApi.getBlock(x, y + 1, z)) {
    hotbarUI.flashEmptySlot(selectedIndex);
    return;
  }
  if (!worldApi.getBlock(x, y - 1, z)) {
    hotbarUI.flashEmptySlot(selectedIndex);
    return;
  }

  // même calcul de direction regardée que le lit/l'escalier, arrondi à l'axe
  // dominant : si le joueur regarde surtout selon X (est/ouest), le panneau doit
  // couvrir Z pour lui barrer la route -> axe 'z' ; et inversement.
  const dir = new THREE.Vector3(0, 0, -1).applyEuler(new THREE.Euler(0, yaw, 0, 'YXZ'));
  const axis = Math.abs(dir.x) > Math.abs(dir.z) ? 'z' : 'x';

  worldApi.setBlock(x, y, z, `door_bottom_${axis}_closed`);
  worldApi.setBlock(x, y + 1, z, `door_top_${axis}_closed`);
  triggerPlaceFeedback(x, y, z);
  triggerHandSwing();
  removeItem(slots, 'door', 1);
  bus.emit('inventory:changed');
  sfx.playSound('place');
}

// Ouvrir/fermer une porte (clic droit dessus, Phase 21) : bascule 'closed'<->'open'
// sur LES DEUX moitiés d'un coup, en gardant l'axe d'origine intact dans le nom
// (cf. commentaire de data/blocks.js) -- ce n'est qu'un remplacement de nom, pas
// un état séparé à mémoriser ailleurs, exactement comme les 4 blocs d'escalier
// encodent déjà leur orientation dans leur id.
function toggleDoorName(name) {
  return name.includes('_closed')
    ? name.replace('_closed', '_open')
    : name.replace('_open', '_closed');
}
function toggleDoor(x, y, z, type) {
  const isBottom = type.includes('_bottom_');
  const otherY = isBottom ? y + 1 : y - 1;
  const otherType = worldApi.getBlock(x, otherY, z);
  worldApi.setBlock(x, y, z, toggleDoorName(type));
  if (otherType && otherType.startsWith('door_')) {
    worldApi.setBlock(x, otherY, z, toggleDoorName(otherType));
  }
  sfx.playSound('door');
}

// Poser un bloc / ouvrir la table de craft (clic droit desktop, ▦ tactile).
function performSecondaryAction() {
  if (tryShear()) return;
  if (tryEat()) return;
  const blockHit = cachedBlockHit;
  if (!blockHit) return;
  const { x: tx, y: ty, z: tz } = blockHit.block; // bloc visé (existant)
  const targetedType = worldApi.getBlock(tx, ty, tz);
  if (targetedType === 'bed_foot' || targetedType === 'bed_head') {
    trySleep(tx, ty, tz, targetedType);
    return;
  }
  if (targetedType && targetedType.startsWith('door_')) {
    toggleDoor(tx, ty, tz, targetedType);
    return;
  }
  if (targetedType === 'crafting_table') {
    openCraft();
    return;
  }
  if (targetedType === 'furnace') {
    openFurnace(tx, ty, tz);
    return;
  }
  if (selectedBlock === 'bed') {
    tryPlaceBed();
    return;
  }
  if (selectedBlock === 'stairs_wood' || selectedBlock === 'stairs_stone') {
    tryPlaceStairs(selectedBlock);
    return;
  }
  if (selectedBlock === 'door') {
    tryPlaceDoor();
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
    triggerHandSwing(); // un seul coup de main au moment de poser, pas de mouvement continu
    removeItem(slots, selectedBlock, 1);
    bus.emit('inventory:changed');
    sfx.playSound('place');
  }
}

renderer.domElement.addEventListener('mousedown', (e) => {
  if (document.pointerLockElement !== renderer.domElement || sleeping || craftOpen || furnaceOpen)
    return;
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
  // le menu (#blocker) reste affiché jusqu'au tap sur "Solo" -- cf. le
  // gestionnaire de soloBtn plus haut, qui masque le blocker sans pointer
  // lock sur tactile.

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
      if (!sleeping && !craftOpen && !furnaceOpen && !chatUI.isOpen && !gameOverOpen)
        performPrimaryAction();
    },
    onBreakEnd: stopBreaking,
    onPlace: () => {
      if (!sleeping && !craftOpen && !furnaceOpen && !chatUI.isOpen && !gameOverOpen)
        performSecondaryAction();
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
let cactusDamageTimer = 0; // même mécanique, tant qu'on reste collé à un cactus
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

let gameOverOpen = false;
const gameOverScreen = document.getElementById('gameOverScreen');
const respawnBtn = document.getElementById('respawnBtn');

// Mort = écran rouge "Game Over" + bouton "Respawn" (comme Minecraft), le jeu se
// fige (cf. gameOverOpen dans la grosse condition de mise à jour joueur plus bas)
// tant qu'on n'a pas cliqué -- le drop de l'inventaire au sol et le repositionnement
// n'ont lieu qu'au clic (respawnPlayer), à l'endroit exact de la mort puisque rien
// ne bouge plus entre-temps.
function showGameOver() {
  if (gameOverOpen) return;
  gameOverOpen = true;
  stopBreaking();
  if (sleeping) {
    // le lit n'a plus de sens une fois mort -- referme sa vue dédiée pour que
    // seul l'écran "Game Over" reste visible (et pour débloquer la grosse
    // condition de mise à jour joueur, qui sinon resterait gelée par `sleeping`
    // en plus de `gameOverOpen`).
    sleeping = false;
    sleepOverlay.style.display = 'none';
    playerAvatar.group.rotation.x = 0; // idem leaveBed() : éviter un avatar figé couché
    playerAvatar.group.visible = playerCtrl.thirdPerson; // idem leaveBed() : éviter le buste planté en vue 1ère personne
    handPivot.visible = !playerCtrl.thirdPerson;
  }
  for (const k in keys) keys[k] = false;
  document.exitPointerLock();
  gameOverScreen.style.display = 'flex';
}
respawnBtn.addEventListener('click', () => {
  gameOverOpen = false;
  gameOverScreen.style.display = 'none';
  respawnPlayer();
  if (!touchMode) renderer.domElement.requestPointerLock();
});

function respawnPlayer() {
  // Mort = on drop tout l'inventaire (hotbar + sac à dos) au sol, à l'endroit
  // de la mort -- comme dans Minecraft, on ne perd rien "en fumée", tout reste
  // ramassable (avec le même item magnet que n'importe quel autre drop).
  const deathX = player.pos.x,
    deathY = player.pos.y + player.height * 0.5,
    deathZ = player.pos.z;
  for (let i = 0; i < slots.length; i++) {
    const stack = slots[i];
    if (!stack) continue;
    const dropped = itemSystem.spawn(deathX, deathY, deathZ, stack.item, stack.count);
    if (dropped) {
      // petite dispersion aléatoire pour ne pas empiler tous les drops au même endroit
      dropped.velX = (Math.random() - 0.5) * 3;
      dropped.velZ = (Math.random() - 0.5) * 3;
    }
    slots[i] = null;
  }

  respawn(spawnPoint());
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

  // zoom (C) : interpolation douce du FOV, indépendante du reste (marche même en 3e personne).
  // Le sprint ajoute un léger élargissement par-dessus (comme Minecraft), sauf en zoom où
  // l'effet resterait imperceptible et casserait la valeur de zoom voulue par le joueur.
  const targetFov = zoomed ? 25 : sprinting ? 85 : 75;
  if (Math.abs(camera.fov - targetFov) > 0.05) {
    camera.fov += (targetFov - camera.fov) * Math.min(1, dt * 8);
    camera.updateProjectionMatrix();
  }

  skyApi.update(dt, player.pos);
  // Teinte bleue sous l'eau : après skyApi.update (qui vient de poser la couleur
  // jour/nuit sur scene.fog/scene.background), on écrase par un fog bleu très
  // rapproché tant qu'on a la tête dans l'eau -- tout ce qu'on voit (terrain,
  // mobs, ciel visible entre deux vagues) passe donc par ce fog et ressort teinté,
  // comme la vue "trouble" sous l'eau de Minecraft. Hors de l'eau, on remet juste
  // near/far à leurs valeurs normales (la couleur, elle, est déjà à jour via sky.js
  // -- rien à restaurer de ce côté).
  if (isUnderwater()) {
    scene.fog.color.copy(UNDERWATER_COLOR);
    scene.fog.near = UNDERWATER_FOG_NEAR;
    scene.fog.far = UNDERWATER_FOG_FAR;
    scene.background = UNDERWATER_COLOR;
  } else {
    scene.fog.near = FOG_NEAR_DRY;
    scene.fog.far = FOG_FAR_DRY;
  }
  worldApi.waterTexture.offset.x = (worldApi.waterTexture.offset.x + dt * 0.025) % 1;
  worldApi.waterTexture.offset.y = (worldApi.waterTexture.offset.y + dt * 0.015) % 1;
  worldApi.lavaTexture.offset.x = (worldApi.lavaTexture.offset.x + dt * 0.012) % 1;
  worldApi.lavaTexture.offset.y = (worldApi.lavaTexture.offset.y + dt * 0.008) % 1;
  worldApi.update(player.pos, dt); // charge/décharge les chunks proches (Phase 4a) + écoulement des liquides (Phase 16)
  cloudsApi.update(dt, player.pos);
  // biome du joueur : un seul échantillonnage de bruit par frame, négligeable (même
  // ordre de coût qu'un seul getHeight, déjà rappelé ailleurs sans souci de perf)
  snowWeatherApi.update(dt, player.pos, getBiome(player.pos.x, player.pos.z) === 'snowy');

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
  if (touchUI)
    touchUI.setActive(!sleeping && !craftOpen && !furnaceOpen && !chatUI.isOpen && !gameOverOpen);

  blockEntities.update(dt, SMELTING, FUELS);
  if (furnaceOpen) renderFurnace();

  if (!sleeping && !craftOpen && !furnaceOpen && !chatUI.isOpen && !gameOverOpen) {
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
      (underwater || inLava ? 0.5 : 1) *
      (player.flying ? player.flySpeedMultiplier || 1 : 1); // /speedfly, pas d'effet hors vol

    // dégâts en tic (pas à chaque frame) tant qu'on reste dans la lave -- même
    // mécanique que onPlayerHurt utilisé par les mobs (cf. main.js plus haut)
    if (inLava) {
      lavaDamageTimer -= dt;
      if (lavaDamageTimer <= 0) {
        damagePlayer(4);
        sfx.playSound('hurt');
        lavaDamageTimer = 0.5;
      }
    } else {
      lavaDamageTimer = 0;
    }

    // dégâts en tic tant qu'on reste collé à un cactus -- même mécanique que la
    // lave ci-dessus, mais moins punitif (1 point, comme dans Minecraft) : le
    // cactus est un bloc solide, donc "être collé" = la boîte du joueur touche
    // une cellule de cactus (cf. isTouchingCactus dans world/world.js).
    if (
      worldApi.isTouchingCactus(
        player.pos.x,
        player.pos.y,
        player.pos.z,
        player.radius,
        player.height,
      )
    ) {
      cactusDamageTimer -= dt;
      if (cactusDamageTimer <= 0) {
        damagePlayer(1);
        sfx.playSound('hurt');
        cactusDamageTimer = 0.5;
      }
    } else {
      cactusDamageTimer = 0;
    }

    // Faim (Phase 11) : un taux continu (sprint > marche/idle) plus deux coûts
    // ponctuels (saut, minage — ce dernier est débité directement dans breakBlockAt).
    // La même forme "taux par seconde" que les dégâts de lave ci-dessus, mais lissée
    // en continu plutôt qu'en tic, car il n'y a pas besoin d'à-coup visible ici.
    const isMoving = dx !== 0 || dz !== 0;
    const hungerRate = sprinting && isMoving ? 0.05 : 0.005;
    player.hunger = Math.max(0, player.hunger - hungerRate * dt);

    // au tic (toutes les 4s, pas chaque frame) : famine si à 0, régénération si la
    // barre de faim est PLEINE (20/20) -- pas juste "presque pleine" comme avant
    hungerTickTimer -= dt;
    if (hungerTickTimer <= 0) {
      hungerTickTimer = 4;
      if (player.hunger <= 0) {
        // pas d'armure ici : la famine ignore la réduction de dégâts (cf.
        // damagePlayer plus haut), comme dans Minecraft.
        player.health = Math.max(0, player.health - 1);
        bus.emit('player:health');
      } else if (player.hunger >= 20 && player.health < 20) {
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
          // pas d'armure ici non plus : la noyade ignore la réduction de
          // dégâts, comme dans Minecraft (cf. damagePlayer plus haut).
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

    // Knockback (coup de zombie, cf. onPlayerHurt plus haut) : s'ajoute au
    // déplacement normal ci-dessus, qu'on soit en train de bouger ou non.
    resolveKnockback(player, dt, worldApi.collidesAtBox);

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
            damagePlayer(excessBlocks * HALF_HEART);
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

    if (player.pos.y < -10 || player.health <= 0) showGameOver();

    camera.rotation.order = 'YXZ';
    camera.rotation.y = yaw;
    camera.rotation.x = pitch;

    // Ramène fluidement l'inclinaison de dégât vers 0 (décroissance exponentielle,
    // indépendante du framerate) plutôt qu'un saut brutal à l'angle puis retour
    // instantané (cf. déclenchement dans le listener player:health).
    hurtTiltAngle *= Math.exp(-HURT_TILT_DECAY * dt);
    if (Math.abs(hurtTiltAngle) < 0.0005) hurtTiltAngle = 0;
    camera.rotation.z = hurtTiltAngle;

    updateVisuals(dt, isMoving, yaw, pitch, crouching); // positionne la caméra (1ère/3e personne) + anime main et avatar

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
    sleeping ||
    craftOpen ||
    furnaceOpen ||
    chatUI.isOpen ||
    gameOverOpen ||
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
            // Anime la main en continu tant qu'on mine, au même rythme que le tic
            // sonore ci-dessus, plutôt qu'un seul swing au clic qui se termine bien
            // avant que le bloc ne casse (cf. performPrimaryAction : un seul
            // triggerHandSwing() au mousedown ne suffit pas pour un minage qui dure).
            triggerHandSwing();
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
