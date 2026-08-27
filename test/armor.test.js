import { test } from 'node:test';
import assert from 'node:assert/strict';
import { computeArmorReduction, applyArmorReduction } from '../src/entities/armor.js';
import { ARMOR_ITEMS, ARMOR_MATERIAL_REDUCTION } from '../src/data/items.js';

function armor4(items) {
  // items: { 0: 'iron_helmet', ... } -- index = slot (0 casque, 1 plastron, 2 jambières, 3 bottes)
  const a = new Array(4).fill(null);
  for (const i in items) a[i] = { item: items[i], count: 1 };
  return a;
}

test('computeArmorReduction: aucune armure équipée -> 0', () => {
  assert.equal(computeArmorReduction(armor4({}), ARMOR_ITEMS, ARMOR_MATERIAL_REDUCTION), 0);
});

test('computeArmorReduction: set complet en fer -> 20%', () => {
  const a = armor4({
    0: 'iron_helmet',
    1: 'iron_chestplate',
    2: 'iron_leggings',
    3: 'iron_boots',
  });
  assert.ok(
    Math.abs(computeArmorReduction(a, ARMOR_ITEMS, ARMOR_MATERIAL_REDUCTION) - 0.2) < 1e-9,
  );
});

test('computeArmorReduction: set complet en or -> 30%', () => {
  const a = armor4({
    0: 'gold_helmet',
    1: 'gold_chestplate',
    2: 'gold_leggings',
    3: 'gold_boots',
  });
  assert.ok(
    Math.abs(computeArmorReduction(a, ARMOR_ITEMS, ARMOR_MATERIAL_REDUCTION) - 0.3) < 1e-9,
  );
});

test('computeArmorReduction: set complet en diamant -> 60%', () => {
  const a = armor4({
    0: 'diamond_helmet',
    1: 'diamond_chestplate',
    2: 'diamond_leggings',
    3: 'diamond_boots',
  });
  assert.ok(
    Math.abs(computeArmorReduction(a, ARMOR_ITEMS, ARMOR_MATERIAL_REDUCTION) - 0.6) < 1e-9,
  );
});

test('computeArmorReduction: une seule pièce -> 1/4 de la réduction du matériau', () => {
  const a = armor4({ 1: 'diamond_chestplate' });
  assert.ok(
    Math.abs(computeArmorReduction(a, ARMOR_ITEMS, ARMOR_MATERIAL_REDUCTION) - 0.15) < 1e-9,
  );
});

test('computeArmorReduction: mix de matériaux s\'additionne normalement', () => {
  const a = armor4({
    0: 'diamond_helmet', // 0.6/4 = 0.15
    1: 'iron_chestplate', // 0.2/4 = 0.05
  });
  assert.ok(
    Math.abs(computeArmorReduction(a, ARMOR_ITEMS, ARMOR_MATERIAL_REDUCTION) - 0.2) < 1e-9,
  );
});

test('applyArmorReduction: 60% de réduction divise les dégâts par 2.5', () => {
  const a = armor4({
    0: 'diamond_helmet',
    1: 'diamond_chestplate',
    2: 'diamond_leggings',
    3: 'diamond_boots',
  });
  const result = applyArmorReduction(10, a, ARMOR_ITEMS, ARMOR_MATERIAL_REDUCTION);
  assert.ok(Math.abs(result - 4) < 1e-9);
});

test('applyArmorReduction: sans armure, dégâts inchangés', () => {
  const result = applyArmorReduction(10, armor4({}), ARMOR_ITEMS, ARMOR_MATERIAL_REDUCTION);
  assert.equal(result, 10);
});
