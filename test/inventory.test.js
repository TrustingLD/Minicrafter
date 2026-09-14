import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  createSlots,
  addItem,
  removeItem,
  countOf,
  moveSlot,
  canFit,
  hasAtLeast,
  TOTAL_SLOTS,
  MAX_STACK,
} from '../src/entities/inventory.js';

test('createSlots: an empty inventory has TOTAL_SLOTS null slots', () => {
  const slots = createSlots();
  assert.equal(slots.length, TOTAL_SLOTS);
  assert.ok(slots.every((s) => s === null));
});

test('addItem: fills empty slots one stack of MAX_STACK at a time', () => {
  const slots = createSlots();
  const leftover = addItem(slots, 'stone', 130);
  assert.equal(leftover, 0);
  assert.deepEqual(slots[0], { item: 'stone', count: 64 });
  assert.deepEqual(slots[1], { item: 'stone', count: 64 });
  assert.deepEqual(slots[2], { item: 'stone', count: 2 });
  assert.equal(slots[3], null);
});

test('addItem: tops up an existing partial stack before opening a new slot', () => {
  const slots = createSlots();
  slots[0] = { item: 'stone', count: 60 };
  const leftover = addItem(slots, 'stone', 10);
  assert.equal(leftover, 0);
  assert.equal(slots[0].count, 64);
  assert.deepEqual(slots[1], { item: 'stone', count: 6 });
});

test('addItem: filling the whole inventory then adding one more returns leftover 1', () => {
  const slots = createSlots();
  for (let i = 0; i < TOTAL_SLOTS; i++) slots[i] = { item: 'stone', count: MAX_STACK };
  const leftover = addItem(slots, 'stone', 1);
  assert.equal(leftover, 1);
});

test('addItem: a different item never merges into another item stack', () => {
  const slots = createSlots();
  slots[0] = { item: 'stone', count: 64 };
  addItem(slots, 'dirt', 5);
  assert.deepEqual(slots[0], { item: 'stone', count: 64 });
  assert.deepEqual(slots[1], { item: 'dirt', count: 5 });
});

test('removeItem: removes across multiple stacks and clears emptied slots to null', () => {
  const slots = createSlots();
  slots[0] = { item: 'wood', count: 64 };
  slots[1] = { item: 'wood', count: 20 };
  const removed = removeItem(slots, 'wood', 70);
  assert.equal(removed, 70);
  assert.equal(slots[0], null);
  assert.deepEqual(slots[1], { item: 'wood', count: 14 });
});

test('removeItem: removing more than available returns only what was actually removed', () => {
  const slots = createSlots();
  slots[0] = { item: 'wood', count: 5 };
  const removed = removeItem(slots, 'wood', 20);
  assert.equal(removed, 5);
  assert.equal(slots[0], null);
});

test('countOf: sums an item across every slot', () => {
  const slots = createSlots();
  slots[0] = { item: 'stone', count: 64 };
  slots[5] = { item: 'stone', count: 3 };
  slots[10] = { item: 'dirt', count: 99 };
  assert.equal(countOf(slots, 'stone'), 67);
  assert.equal(countOf(slots, 'nonexistent'), 0);
});

test('hasAtLeast: true only when every required item meets its threshold', () => {
  const slots = createSlots();
  slots[0] = { item: 'planks', count: 3 };
  slots[1] = { item: 'stick', count: 2 };
  assert.ok(hasAtLeast(slots, { planks: 3, stick: 2 }));
  assert.ok(!hasAtLeast(slots, { planks: 4 }));
});

test('moveSlot: swaps two different items', () => {
  const slots = createSlots();
  slots[0] = { item: 'stone', count: 10 };
  slots[1] = { item: 'dirt', count: 5 };
  moveSlot(slots, 0, 1);
  assert.deepEqual(slots[0], { item: 'dirt', count: 5 });
  assert.deepEqual(slots[1], { item: 'stone', count: 10 });
});

test('moveSlot: merges same item into destination, capped at MAX_STACK, remainder stays at source', () => {
  const slots = createSlots();
  slots[0] = { item: 'stone', count: 30 };
  slots[1] = { item: 'stone', count: 50 };
  moveSlot(slots, 0, 1);
  assert.deepEqual(slots[1], { item: 'stone', count: 64 });
  assert.deepEqual(slots[0], { item: 'stone', count: 16 });
});

test('moveSlot: moving into an empty slot just relocates the stack', () => {
  const slots = createSlots();
  slots[0] = { item: 'stone', count: 10 };
  moveSlot(slots, 0, 4);
  assert.equal(slots[0], null);
  assert.deepEqual(slots[4], { item: 'stone', count: 10 });
});

test('canFit: true when an empty slot exists', () => {
  const slots = createSlots();
  assert.ok(canFit(slots, 'stone', 1));
});

test('canFit: false when every slot is a full stack of a different item', () => {
  const slots = createSlots();
  for (let i = 0; i < TOTAL_SLOTS; i++) slots[i] = { item: 'dirt', count: MAX_STACK };
  assert.ok(!canFit(slots, 'stone', 1));
});

test('canFit: true when a same-item stack still has room', () => {
  const slots = createSlots();
  for (let i = 0; i < TOTAL_SLOTS; i++) slots[i] = { item: 'dirt', count: MAX_STACK };
  slots[0] = { item: 'stone', count: 63 };
  assert.ok(canFit(slots, 'stone', 1));
});
