// Construit géométrie/matériaux Three.js pour chaque type de bloc à partir des
// textures procédurales, + la fonction d'icône utilisée par le hotbar/inventaire.

import * as THREE from 'three';
import { BLOCK_TYPES } from '../data/blocks.js';
import * as tex from './textures.js';

export const BLOCK_SIZE = 1;

// Géométrie en L de l'escalier, réutilisée telle quelle pour l'item lâché au sol
// (item-entity.js, InstancedMesh) ET l'objet tenu en main (player.js) -- les deux
// sont de VRAIS objets Three.js (contrairement à l'icône CSS de l'inventaire, cf.
// ui/block-icon-3d.js, qui doit reconstruire l'équivalent en pur CSS 3D). Même
// décomposition en 2 boîtes sans chevauchement que render/mesher.js (cf. son
// commentaire pour le détail), mais ici en unités CENTRÉES sur l'origine
// (-0.5..0.5, pas 0..1) pour matcher la convention de `geometry` ci-dessus
// (BoxGeometry(1,1,1) est centrée par défaut) -- l'orientation ('sud' figée)
// n'a aucune importance ici, cette géométrie n'est jamais posée telle quelle
// dans le monde (seuls les 4 blocs stairs_*_* de data/blocks.js le sont).
// Un seul matériau (pas un tableau par face) : les 2 textures possibles
// (planches/pierre) sont `{ all: ... }`, donc UNE texture uniforme suffit sur
// toutes les faces des 2 boîtes -- plus simple qu'un groupe par face comme le
// cube plein ci-dessus.
const STAIRS_ICON_BOXES = [
  [0, 1, 0, 1, 0, 0.5], // dossier (arrière), pleine hauteur
  [0, 1, 0, 0.5, 0.5, 1], // marche basse (avant), mi-hauteur
];
const STAIRS_FACES = [
  {
    n: [1, 0, 0],
    v: [
      [1, 0, 0],
      [1, 1, 0],
      [1, 1, 1],
      [1, 0, 1],
    ],
  },
  {
    n: [-1, 0, 0],
    v: [
      [0, 0, 1],
      [0, 1, 1],
      [0, 1, 0],
      [0, 0, 0],
    ],
  },
  {
    n: [0, 1, 0],
    v: [
      [0, 1, 1],
      [1, 1, 1],
      [1, 1, 0],
      [0, 1, 0],
    ],
  },
  {
    n: [0, -1, 0],
    v: [
      [0, 0, 0],
      [1, 0, 0],
      [1, 0, 1],
      [0, 0, 1],
    ],
  },
  {
    n: [0, 0, 1],
    v: [
      [1, 0, 1],
      [1, 1, 1],
      [0, 1, 1],
      [0, 0, 1],
    ],
  },
  {
    n: [0, 0, -1],
    v: [
      [0, 0, 0],
      [0, 1, 0],
      [1, 1, 0],
      [1, 0, 0],
    ],
  },
];
const STAIRS_QUAD_UVS = [
  [0, 1],
  [0, 0],
  [1, 0],
  [1, 1],
];
function buildStairsGeometry() {
  const positions = [],
    normals = [],
    uvs = [];
  for (const [x0, x1, y0, y1, z0, z1] of STAIRS_ICON_BOXES) {
    for (const face of STAIRS_FACES) {
      const [nx, ny, nz] = face.n;
      const quad = face.v.map(([cx, cy, cz]) => [
        (cx ? x1 : x0) - 0.5,
        (cy ? y1 : y0) - 0.5,
        (cz ? z1 : z0) - 0.5,
      ]);
      for (const i of [0, 1, 2, 0, 2, 3]) {
        positions.push(...quad[i]);
        normals.push(nx, ny, nz);
        uvs.push(...STAIRS_QUAD_UVS[i]);
      }
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geo.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  return geo;
}

export function createBlockAssets() {
  const geometry = new THREE.BoxGeometry(BLOCK_SIZE, BLOCK_SIZE, BLOCK_SIZE);
  const mat = (t) => new THREE.MeshLambertMaterial({ map: t });

  const tGrassTop = tex.texGrassTop(),
    tGrassSide = tex.texGrassSide(),
    tDirt = tex.texDirt(),
    tStone = tex.texStone(),
    tWoodSide = tex.texWoodSide(),
    tWoodTop = tex.texWoodTop(),
    tLeaves = tex.texLeaves(),
    tPlanks = tex.texPlanks(),
    tCraftTop = tex.texCraftTop(),
    tCraftSide = tex.texCraftSide(),
    tWoodSword = tex.texWoodSword(),
    tWoodPickaxe = tex.texWoodPickaxe(),
    tWoodAxe = tex.texWoodAxe(),
    tStoneSword = tex.texStoneSword(),
    tStonePickaxe = tex.texStonePickaxe(),
    tStoneAxe = tex.texStoneAxe(),
    tIronSword = tex.texIronSword(),
    tIronPickaxe = tex.texIronPickaxe(),
    tIronAxe = tex.texIronAxe(),
    tSnow = tex.texSnow(),
    tMeat = tex.texMeat(),
    tCookedMeat = tex.texCookedMeat(),
    tMilk = tex.texMilk(),
    tApple = tex.texApple(),
    tGoldenApple = tex.texGoldenApple(),
    tCoalOre = tex.texCoalOre(),
    tIronOre = tex.texIronOre(),
    tGoldOre = tex.texGoldOre(),
    tDiamondOre = tex.texDiamondOre(),
    // le côté du bâtonnet (manche + flamme) : c'est la face qui identifie la torche,
    // donc c'est elle qu'on montre dans la hotbar et sur le cube tenu en main
    tTorch = tex.texTorchStick(),
    tFurnace = tex.texFurnace(),
    tIronIngot = tex.texIronIngot(),
    tGoldIngot = tex.texGoldIngot(),
    tDiamond = tex.texDiamond(),
    tIronHelmet = tex.texIronHelmet(),
    tIronChestplate = tex.texIronChestplate(),
    tIronLeggings = tex.texIronLeggings(),
    tIronBoots = tex.texIronBoots(),
    tGoldHelmet = tex.texGoldHelmet(),
    tGoldChestplate = tex.texGoldChestplate(),
    tGoldLeggings = tex.texGoldLeggings(),
    tGoldBoots = tex.texGoldBoots(),
    tDiamondHelmet = tex.texDiamondHelmet(),
    tDiamondChestplate = tex.texDiamondChestplate(),
    tDiamondLeggings = tex.texDiamondLeggings(),
    tDiamondBoots = tex.texDiamondBoots(),
    tWool = tex.texWool(),
    tSand = tex.texSand(),
    tSandstone = tex.texSandstone(),
    tCactus = tex.texCactus(),
    tDeadBush = tex.texDeadBush(),
    tIce = tex.texIce(),
    tWeeds = tex.texWeeds(),
    tBedFoot = tex.texBedFoot(),
    tBedPillow = tex.texBedPillow(),
    tBedSide = tex.texBedSide(),
    tBedHeadSide = tex.texBedHeadSide(),
    tDoorTop = tex.texDoorTop(),
    tDoorBottom = tex.texDoorBottom(),
    tGlass = tex.texGlass(),
    tChestTop = tex.texChestTop(),
    tChestSide = tex.texChestSide(),
    // icônes plates dédiées (cf. commentaire de texStairsIcon) : teintes reprises
    // de texPlanks (#daa44c/#e2b261) et texStone (#8e8e8e/#7c7c7c) pour rester
    // cohérent avec la texture du bloc réel, arêtes plus sombres pour le relief.
    tStairsWoodIcon = tex.texStairsIcon('#daa44c', '#e2b261', '#59300e'),
    tStairsStoneIcon = tex.texStairsIcon('#8e8e8e', '#9d9d9d', '#4a4a4a'),
    // Redstone (Phase 22) : icônes hotbar/inventaire + rendu "tenu en main"/"au
    // sol". `redstone` (poussière), `redstone_torch`, `lever`, `button`,
    // `repeater` restent des icônes plates (comme la torche/le bâtonnet
    // au-dessus) -- ce ne sont pas de vrais cubes en jeu. `redstone_lamp` et
    // `piston` SONT de vrais cubes pleins, donc ont aussi une entrée dans
    // `materials`/`iconFaces3D` plus bas pour un rendu 3D correct.
    tRedstoneWireIcon = tex.texRedstoneWire(15), // pleine puissance -- plus lisible en icône qu'à 0
    tRedstoneTorchIcon = tex.texRedstoneTorchFlame(true),
    tLeverIcon = tex.texLever(false),
    tButtonIcon = tex.texButton(false),
    tRepeaterIcon = tex.texRepeaterTop('south', false),
    tRedstoneLamp = tex.texRedstoneLamp(false),
    tRedstoneBlockTex = tex.texRedstoneBlock(),
    tPistonTop = tex.texPistonTop(),
    tPistonSide = tex.texPistonSide();

  // face order for BoxGeometry groups: [+x, -x, +y, -y, +z, -z]
  const materials = {
    grass: [
      mat(tGrassSide),
      mat(tGrassSide),
      mat(tGrassTop),
      mat(tDirt),
      mat(tGrassSide),
      mat(tGrassSide),
    ],
    dirt: [mat(tDirt), mat(tDirt), mat(tDirt), mat(tDirt), mat(tDirt), mat(tDirt)],
    stone: [mat(tStone), mat(tStone), mat(tStone), mat(tStone), mat(tStone), mat(tStone)],
    wood: [
      mat(tWoodSide),
      mat(tWoodSide),
      mat(tWoodTop),
      mat(tWoodTop),
      mat(tWoodSide),
      mat(tWoodSide),
    ],
    leaves: [mat(tLeaves), mat(tLeaves), mat(tLeaves), mat(tLeaves), mat(tLeaves), mat(tLeaves)],
    planks: [mat(tPlanks), mat(tPlanks), mat(tPlanks), mat(tPlanks), mat(tPlanks), mat(tPlanks)],
    crafting_table: [
      mat(tCraftSide),
      mat(tCraftSide),
      mat(tCraftTop),
      mat(tPlanks),
      mat(tCraftSide),
      mat(tCraftSide),
    ],
    snow: [mat(tSnow), mat(tSnow), mat(tSnow), mat(tSnow), mat(tSnow), mat(tSnow)],
    torch: [mat(tTorch), mat(tTorch), mat(tTorch), mat(tTorch), mat(tTorch), mat(tTorch)],
    furnace: [
      mat(tFurnace),
      mat(tFurnace),
      mat(tFurnace),
      mat(tFurnace),
      mat(tFurnace),
      mat(tFurnace),
    ],
    wool: [mat(tWool), mat(tWool), mat(tWool), mat(tWool), mat(tWool), mat(tWool)],
    glass: [mat(tGlass), mat(tGlass), mat(tGlass), mat(tGlass), mat(tGlass), mat(tGlass)],
    chest: [
      mat(tChestSide),
      mat(tChestSide),
      mat(tChestTop),
      mat(tChestTop),
      mat(tChestSide),
      mat(tChestSide),
    ],
    // Redstone (Phase 22) : même principe que `torch` plus haut -- une seule
    // texture reprise sur les 6 faces pour l'aperçu tenu en main/lâché au sol,
    // même pour les items dont le VRAI bloc en jeu a une forme réduite (fil,
    // torche, levier, bouton, répéteur ne sont pas de vrais cubes une fois
    // posés, cf. leur `shape` dans data/blocks.js -- seul cet aperçu l'est).
    redstone: [
      mat(tRedstoneWireIcon),
      mat(tRedstoneWireIcon),
      mat(tRedstoneWireIcon),
      mat(tRedstoneWireIcon),
      mat(tRedstoneWireIcon),
      mat(tRedstoneWireIcon),
    ],
    redstone_torch: [
      mat(tRedstoneTorchIcon),
      mat(tRedstoneTorchIcon),
      mat(tRedstoneTorchIcon),
      mat(tRedstoneTorchIcon),
      mat(tRedstoneTorchIcon),
      mat(tRedstoneTorchIcon),
    ],
    lever: [mat(tLeverIcon), mat(tLeverIcon), mat(tLeverIcon), mat(tLeverIcon), mat(tLeverIcon), mat(tLeverIcon)],
    button: [
      mat(tButtonIcon),
      mat(tButtonIcon),
      mat(tButtonIcon),
      mat(tButtonIcon),
      mat(tButtonIcon),
      mat(tButtonIcon),
    ],
    repeater: [
      mat(tRepeaterIcon),
      mat(tRepeaterIcon),
      mat(tRepeaterIcon),
      mat(tRepeaterIcon),
      mat(tRepeaterIcon),
      mat(tRepeaterIcon),
    ],
    redstone_lamp: [
      mat(tRedstoneLamp),
      mat(tRedstoneLamp),
      mat(tRedstoneLamp),
      mat(tRedstoneLamp),
      mat(tRedstoneLamp),
      mat(tRedstoneLamp),
    ],
    redstone_block: [
      mat(tRedstoneBlockTex),
      mat(tRedstoneBlockTex),
      mat(tRedstoneBlockTex),
      mat(tRedstoneBlockTex),
      mat(tRedstoneBlockTex),
      mat(tRedstoneBlockTex),
    ],
    piston: [
      mat(tPistonSide),
      mat(tPistonSide),
      mat(tPistonTop),
      mat(tPistonTop),
      mat(tPistonSide),
      mat(tPistonSide),
    ],
    sand: [mat(tSand), mat(tSand), mat(tSand), mat(tSand), mat(tSand), mat(tSand)],
    sandstone: [
      mat(tSandstone),
      mat(tSandstone),
      mat(tSandstone),
      mat(tSandstone),
      mat(tSandstone),
      mat(tSandstone),
    ],
    cactus: [mat(tCactus), mat(tCactus), mat(tCactus), mat(tCactus), mat(tCactus), mat(tCactus)],
    dead_bush: [
      mat(tDeadBush),
      mat(tDeadBush),
      mat(tDeadBush),
      mat(tDeadBush),
      mat(tDeadBush),
      mat(tDeadBush),
    ],
    ice: [mat(tIce), mat(tIce), mat(tIce), mat(tIce), mat(tIce), mat(tIce)],
    weeds: [mat(tWeeds), mat(tWeeds), mat(tWeeds), mat(tWeeds), mat(tWeeds), mat(tWeeds)],
    // Le lit ("bed") tient dans un seul slot d'inventaire même s'il pose 2 blocs
    // au sol (cf. data/blocks.js bed_foot/bed_head) : ici, juste un aperçu cube
    // (couverture rouge dessus, côtés + pied de lit en bois) pour la hotbar/le
    // craft/l'item lâché au sol — même simplification que la torche ci-dessus,
    // qui est aussi un item "shape" affiché en cube plein dans ces aperçus.
    bed: [mat(tBedSide), mat(tBedSide), mat(tBedFoot), mat(tPlanks), mat(tBedSide), mat(tBedSide)],
    // mêmes matériaux pour les 2 moitiés réellement posées en jeu (bed_foot/bed_head)
    // -- sert uniquement aux particules de cassage (particles.js), qui piochent par
    // TYPE DE BLOC cassé, pas par item ; sans ça elles retomberaient sur le gris pierre.
    bed_foot: [
      mat(tBedSide),
      mat(tBedSide),
      mat(tBedFoot),
      mat(tPlanks),
      mat(tBedSide),
      mat(tBedSide),
    ],
    bed_head: [
      mat(tBedHeadSide),
      mat(tBedHeadSide),
      mat(tBedPillow),
      mat(tPlanks),
      mat(tBedHeadSide),
      mat(tBedHeadSide),
    ],
    // Escaliers : même simplification que le lit -- l'item tenu/lâché au sol
    // (item-entity.js) et les particules de cassage (particles.js, une par
    // ORIENTATION réellement posée) affichent un cube plein texturé plutôt que
    // le vrai profil en L, purement pour ces aperçus rapides. `stairs_wood`/
    // `stairs_stone` couvrent l'item en poche ; les 8 entrées `stairs_*_*`
    // couvrent les particules quand on casse le bloc réellement posé (son nom
    // exact dépend de l'orientation, cf. data/blocks.js).
    stairs_wood: [
      mat(tPlanks),
      mat(tPlanks),
      mat(tPlanks),
      mat(tPlanks),
      mat(tPlanks),
      mat(tPlanks),
    ],
    stairs_stone: [mat(tStone), mat(tStone), mat(tStone), mat(tStone), mat(tStone), mat(tStone)],
    // Porte ("door") : comme le lit, tient dans un seul slot d'inventaire même si
    // elle pose 2 blocs (cf. data/blocks.js door_bottom_*/door_top_*) -- aperçu
    // cube simple (poignée dessus, panneau nu sur les côtés) pour hotbar/craft/item
    // au sol, même simplification que le lit/la torche ci-dessus.
    door: [
      mat(tDoorBottom),
      mat(tDoorBottom),
      mat(tDoorBottom),
      mat(tDoorBottom),
      mat(tDoorBottom),
      mat(tDoorBottom),
    ],
  };
  for (const dir of ['north', 'south', 'east', 'west']) {
    materials[`stairs_wood_${dir}`] = materials.stairs_wood;
    materials[`stairs_stone_${dir}`] = materials.stairs_stone;
  }
  // mêmes matériaux pour les 8 blocs réellement posés en jeu (2 axes x 2 états x 2
  // moitiés, cf. data/blocks.js) -- sert uniquement aux particules de cassage
  // (particles.js), qui piochent par TYPE DE BLOC cassé, pas par item ; sans ça
  // elles retomberaient sur le gris pierre (fallback de particles.js).
  const doorBottomMat = [
    mat(tDoorBottom),
    mat(tDoorBottom),
    mat(tDoorBottom),
    mat(tDoorBottom),
    mat(tDoorBottom),
    mat(tDoorBottom),
  ];
  const doorTopMat = [
    mat(tDoorTop),
    mat(tDoorTop),
    mat(tDoorTop),
    mat(tDoorTop),
    mat(tDoorTop),
    mat(tDoorTop),
  ];
  for (const axis of ['x', 'z']) {
    for (const state of ['closed', 'open']) {
      materials[`door_bottom_${axis}_${state}`] = doorBottomMat;
      materials[`door_top_${axis}_${state}`] = doorTopMat;
    }
  }

  // vraie géométrie en L (cf. buildStairsGeometry plus haut) + 1 matériau simple
  // (texture uniforme) par variante -- utilisés par item-entity.js (item lâché au
  // sol) et player.js (objet tenu en main) pour un rendu 3D fidèle au bloc réel,
  // plutôt que le cube plein générique (`geometry`/`materials`) utilisé pour tous
  // les autres blocs.
  const stairsGeometry = buildStairsGeometry();
  const stairsMaterials = {
    stairs_wood: new THREE.MeshLambertMaterial({ map: tPlanks }),
    stairs_stone: new THREE.MeshLambertMaterial({ map: tStone }),
  };

  const toolTextures = {
    wood_sword: tWoodSword,
    wood_pickaxe: tWoodPickaxe,
    wood_axe: tWoodAxe,
    stone_sword: tStoneSword,
    stone_pickaxe: tStonePickaxe,
    stone_axe: tStoneAxe,
    iron_sword: tIronSword,
    iron_pickaxe: tIronPickaxe,
    iron_axe: tIronAxe,
    // pomme / pomme dorée : réutilise le mécanisme "icône plate tenue en main"
    // (cf. entities/player.js buildHeldItemMesh) déjà utilisé pour les outils --
    // ni un cube (materials[type]) ni un escalier, donc sinon rien ne s'affichait
    // dans la main quand on les tient.
    apple: tApple,
    golden_apple: tGoldenApple,
  };

  function iconCanvas(type) {
    // used for hotbar / inventory previews
    switch (type) {
      case 'grass':
        return tGrassTop.image;
      case 'dirt':
        return tDirt.image;
      case 'stone':
        return tStone.image;
      case 'wood':
        return tWoodSide.image;
      case 'leaves':
        return tLeaves.image;
      case 'planks':
        return tPlanks.image;
      case 'crafting_table':
        return tCraftTop.image;
      case 'snow':
        return tSnow.image;
      case 'torch':
        return tTorch.image;
      case 'furnace':
        return tFurnace.image;
      case 'iron_ingot':
        return tIronIngot.image;
      case 'gold_ingot':
        return tGoldIngot.image;
      case 'diamond':
        return tDiamond.image;
      case 'iron_helmet':
        return tIronHelmet.image;
      case 'iron_chestplate':
        return tIronChestplate.image;
      case 'iron_leggings':
        return tIronLeggings.image;
      case 'iron_boots':
        return tIronBoots.image;
      case 'gold_helmet':
        return tGoldHelmet.image;
      case 'gold_chestplate':
        return tGoldChestplate.image;
      case 'gold_leggings':
        return tGoldLeggings.image;
      case 'gold_boots':
        return tGoldBoots.image;
      case 'diamond_helmet':
        return tDiamondHelmet.image;
      case 'diamond_chestplate':
        return tDiamondChestplate.image;
      case 'diamond_leggings':
        return tDiamondLeggings.image;
      case 'diamond_boots':
        return tDiamondBoots.image;
      case 'wool':
        return tWool.image;
      case 'sand':
        return tSand.image;
      case 'glass':
        return tGlass.image;
      case 'sandstone':
        return tSandstone.image;
      case 'cactus':
        return tCactus.image;
      case 'dead_bush':
        return tDeadBush.image;
      case 'ice':
        return tIce.image;
      case 'weeds':
        return tWeeds.image;
      case 'bed':
        return tBedFoot.image;
      case 'door':
        return tDoorBottom.image;
      case 'chest':
        return tChestSide.image;
      case 'stairs_wood':
        return tStairsWoodIcon.image;
      case 'stairs_stone':
        return tStairsStoneIcon.image;
      case 'wood_sword':
        return tWoodSword.image;
      case 'wood_pickaxe':
        return tWoodPickaxe.image;
      case 'wood_axe':
        return tWoodAxe.image;
      case 'stone_sword':
        return tStoneSword.image;
      case 'stone_pickaxe':
        return tStonePickaxe.image;
      case 'stone_axe':
        return tStoneAxe.image;
      case 'iron_sword':
        return tIronSword.image;
      case 'iron_pickaxe':
        return tIronPickaxe.image;
      case 'iron_axe':
        return tIronAxe.image;
      case 'coal_ore':
        return tCoalOre.image;
      case 'iron_ore':
        return tIronOre.image;
      case 'gold_ore':
        return tGoldOre.image;
      case 'diamond_ore':
        return tDiamondOre.image;
      case 'meat':
        return tMeat.image;
      case 'cooked_meat':
        return tCookedMeat.image;
      case 'milk':
        return tMilk.image;
      case 'apple':
        return tApple.image;
      case 'golden_apple':
        return tGoldenApple.image;
      case 'stick':
        return null; // drawn separately
      case 'redstone':
        return tRedstoneWireIcon.image;
      case 'redstone_torch':
        return tRedstoneTorchIcon.image;
      case 'lever':
        return tLeverIcon.image;
      case 'button':
        return tButtonIcon.image;
      case 'repeater':
        return tRepeaterIcon.image;
      case 'redstone_lamp':
        return tRedstoneLamp.image;
      case 'redstone_block':
        return tRedstoneBlockTex.image;
      case 'piston':
        return tPistonTop.image;
      default:
        return tStone.image;
    }
  }

  // Faces (mêmes canvases procéduraux que les blocs réels, cf. `materials` plus
  // haut) pour l'icône 3D d'un bloc dans l'inventaire/hotbar/four -- uniquement
  // les blocs qui sont de vrais cubes pleins en jeu. `null` pour tout le reste
  // (outils, nourriture, minerais, bâtonnet, torche, buisson mort...) : ceux-là
  // gardent l'icône plate 2D habituelle (iconCanvas), un fin bâtonnet ou une
  // torche rendus en mini-cube ferait moins sens visuellement qu'un vrai bloc.
  function iconFaces3D(type) {
    switch (type) {
      case 'grass':
        return { top: tGrassTop.image, left: tGrassSide.image, right: tGrassSide.image };
      case 'dirt':
        return { top: tDirt.image, left: tDirt.image, right: tDirt.image };
      case 'stone':
        return { top: tStone.image, left: tStone.image, right: tStone.image };
      case 'wood':
        return { top: tWoodTop.image, left: tWoodSide.image, right: tWoodSide.image };
      case 'leaves':
        return { top: tLeaves.image, left: tLeaves.image, right: tLeaves.image };
      case 'planks':
        return { top: tPlanks.image, left: tPlanks.image, right: tPlanks.image };
      case 'crafting_table':
        return { top: tCraftTop.image, left: tCraftSide.image, right: tCraftSide.image };
      case 'snow':
        return { top: tSnow.image, left: tSnow.image, right: tSnow.image };
      case 'furnace':
        return { top: tFurnace.image, left: tFurnace.image, right: tFurnace.image };
      case 'wool':
        return { top: tWool.image, left: tWool.image, right: tWool.image };
      case 'sand':
        return { top: tSand.image, left: tSand.image, right: tSand.image };
      case 'glass':
        return { top: tGlass.image, left: tGlass.image, right: tGlass.image };
      case 'sandstone':
        return { top: tSandstone.image, left: tSandstone.image, right: tSandstone.image };
      case 'cactus':
        return { top: tCactus.image, left: tCactus.image, right: tCactus.image };
      case 'ice':
        return { top: tIce.image, left: tIce.image, right: tIce.image };
      case 'bed':
        return { top: tBedFoot.image, left: tBedSide.image, right: tBedSide.image };
      case 'door':
        return { top: tDoorBottom.image, left: tDoorBottom.image, right: tDoorBottom.image };
      case 'chest':
        return { top: tChestTop.image, left: tChestSide.image, right: tChestSide.image };
      // `shape: 'stairs'` : lu par ui/block-icon-3d.js pour composer 2 boîtes en
      // vrai profil L en CSS 3D (au lieu d'un cube plein) -- un cube texturé
      // planches/pierre serait ici indiscernable de l'item "Planches"/"Pierre".
      case 'stairs_wood':
        return { top: tPlanks.image, left: tPlanks.image, right: tPlanks.image, shape: 'stairs' };
      case 'stairs_stone':
        return { top: tStone.image, left: tStone.image, right: tStone.image, shape: 'stairs' };
      // Redstone (Phase 22) : seuls les 3 VRAIS cubes pleins ont droit à l'aperçu
      // 3D CSS -- fil/torche/levier/bouton/répéteur retombent sur iconCanvas
      // (icône plate) ci-dessus, comme la torche normale/le bâtonnet.
      case 'redstone_lamp':
        return { top: tRedstoneLamp.image, left: tRedstoneLamp.image, right: tRedstoneLamp.image };
      case 'redstone_block':
        return {
          top: tRedstoneBlockTex.image,
          left: tRedstoneBlockTex.image,
          right: tRedstoneBlockTex.image,
        };
      case 'piston':
        return { top: tPistonTop.image, left: tPistonSide.image, right: tPistonSide.image };
      default:
        return null;
    }
  }

  return {
    geometry,
    materials,
    toolTextures,
    iconCanvas,
    iconFaces3D,
    blockTypes: BLOCK_TYPES,
    stairsGeometry,
    stairsMaterials,
  };
}
