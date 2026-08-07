// Construit géométrie/matériaux Three.js pour chaque type de bloc à partir des
// textures procédurales, + la fonction d'icône utilisée par le hotbar/inventaire.

import * as THREE from 'three';
import { BLOCK_TYPES } from '../data/blocks.js';
import * as tex from './textures.js';

export const BLOCK_SIZE = 1;

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
    tCoalOre = tex.texCoalOre(),
    tIronOre = tex.texIronOre(),
    tGoldOre = tex.texGoldOre(),
    tDiamondOre = tex.texDiamondOre(),
    // le côté du bâtonnet (manche + flamme) : c'est la face qui identifie la torche,
    // donc c'est elle qu'on montre dans la hotbar et sur le cube tenu en main
    tTorch = tex.texTorchStick(),
    tFurnace = tex.texFurnace(),
    tIronIngot = tex.texIronIngot(),
    tWool = tex.texWool(),
    tSand = tex.texSand(),
    tSandstone = tex.texSandstone(),
    tCactus = tex.texCactus(),
    tDeadBush = tex.texDeadBush(),
    tIce = tex.texIce();

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
      case 'wool':
        return tWool.image;
      case 'sand':
        return tSand.image;
      case 'sandstone':
        return tSandstone.image;
      case 'cactus':
        return tCactus.image;
      case 'dead_bush':
        return tDeadBush.image;
      case 'ice':
        return tIce.image;
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
      case 'stick':
        return null; // drawn separately
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
      case 'sandstone':
        return { top: tSandstone.image, left: tSandstone.image, right: tSandstone.image };
      case 'cactus':
        return { top: tCactus.image, left: tCactus.image, right: tCactus.image };
      case 'ice':
        return { top: tIce.image, left: tIce.image, right: tIce.image };
      default:
        return null;
    }
  }

  return { geometry, materials, toolTextures, iconCanvas, iconFaces3D, blockTypes: BLOCK_TYPES };
}
