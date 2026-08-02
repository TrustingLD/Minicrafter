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
    tMilk = tex.texMilk(),
    tCoalOre = tex.texCoalOre(),
    tIronOre = tex.texIronOre(),
    tGoldOre = tex.texGoldOre(),
    tDiamondOre = tex.texDiamondOre();

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
      case 'milk':
        return tMilk.image;
      case 'stick':
        return null; // drawn separately
      default:
        return tStone.image;
    }
  }

  return { geometry, materials, toolTextures, iconCanvas, blockTypes: BLOCK_TYPES };
}
