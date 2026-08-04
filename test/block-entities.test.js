import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createFurnaceState, tickFurnace } from '../src/world/block-entities.js';

const SMELTING = { iron_ore: 'iron_ingot' };
const FUELS = { coal_ore: 8 };

test('tickFurnace: no input means no progress, ever', () => {
  const state = createFurnaceState();
  state.fuel = { item: 'coal_ore', count: 1 };
  tickFurnace(state, 10, SMELTING, FUELS);
  assert.equal(state.smeltProgress, 0);
  assert.equal(state.output, null);
});

test('tickFurnace: input present but no fuel does not burn', () => {
  const state = createFurnaceState();
  state.input = { item: 'iron_ore', count: 1 };
  tickFurnace(state, 10, SMELTING, FUELS);
  assert.equal(state.burnRemaining, 0);
  assert.equal(state.smeltProgress, 0);
});

test('tickFurnace: consumes one fuel unit to start burning', () => {
  const state = createFurnaceState();
  state.input = { item: 'iron_ore', count: 1 };
  state.fuel = { item: 'coal_ore', count: 2 };
  tickFurnace(state, 0.1, SMELTING, FUELS);
  assert.equal(state.fuel.count, 1); // 1 unité de charbon consommée
  assert.ok(state.burnRemaining > 0);
});

test('tickFurnace: after SMELT_TIME seconds of burning, output gains one item and input loses one', () => {
  const state = createFurnaceState();
  state.input = { item: 'iron_ore', count: 3 };
  state.fuel = { item: 'coal_ore', count: 1 };
  tickFurnace(state, 5, SMELTING, FUELS); // pile le temps de fonte
  assert.deepEqual(state.output, { item: 'iron_ingot', count: 1 });
  assert.equal(state.input.count, 2);
});

test('tickFurnace: the last input unit smelted clears the input slot to null', () => {
  const state = createFurnaceState();
  state.input = { item: 'iron_ore', count: 1 };
  state.fuel = { item: 'coal_ore', count: 1 };
  tickFurnace(state, 5, SMELTING, FUELS);
  assert.equal(state.input, null);
  assert.deepEqual(state.output, { item: 'iron_ingot', count: 1 });
});

test('tickFurnace: burn budget persists across ticks and keeps smelting without more fuel', () => {
  const state = createFurnaceState();
  state.input = { item: 'iron_ore', count: 5 };
  state.fuel = { item: 'coal_ore', count: 1 }; // 8s de combustion
  tickFurnace(state, 5, SMELTING, FUELS); // fond 1 (5s), il reste ~3s de feu
  tickFurnace(state, 3, SMELTING, FUELS); // pas assez pour un 2e (3s de progrès)
  assert.equal(state.output.count, 1);
  assert.equal(state.fuel, null); // le charbon a déjà été consommé au 1er tic
});

test('tickFurnace: a full output slot of a different item blocks smelting', () => {
  const state = createFurnaceState();
  state.input = { item: 'iron_ore', count: 1 };
  state.fuel = { item: 'coal_ore', count: 1 };
  state.output = { item: 'stone', count: 1 }; // slot occupé par autre chose
  tickFurnace(state, 5, SMELTING, FUELS);
  assert.deepEqual(state.output, { item: 'stone', count: 1 }); // inchangé
  assert.equal(state.smeltProgress, 0);
});

test('tickFurnace: removing the input mid-burn resets progress but keeps the leftover burn budget', () => {
  const state = createFurnaceState();
  state.input = { item: 'iron_ore', count: 1 };
  state.fuel = { item: 'coal_ore', count: 1 };
  tickFurnace(state, 2, SMELTING, FUELS); // allume le feu, 2s de progrès
  state.input = null;
  tickFurnace(state, 1, SMELTING, FUELS);
  assert.equal(state.smeltProgress, 0);
});
