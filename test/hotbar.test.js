import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHotbarUI } from '../src/ui/hotbar.js';

// Faux DOM minimal (pas de navigateur sous node --test)
function fakeEl() {
  return {
    className: '',
    textContent: '',
    innerHTML: '',
    title: '',
    style: {},
    children: [],
    appendChild(c) {
      this.children.push(c);
    },
    addEventListener() {},
  };
}
globalThis.document = { createElement: () => fakeEl() };

function setup(extra = {}) {
  const hotbarEl = fakeEl();
  const ui = createHotbarUI({
    hotbarEl,
    blockTypes: {},
    itemNames: { stick: 'Bâton' },
    iconCanvas: () => null,
    iconFaces3D: () => null,
    onSelect() {},
    ...extra,
  });
  const slots = new Array(36).fill(null);
  slots[0] = { item: 'stick', count: 3 };
  return { ui, hotbarEl, slots };
}

test("sans taille imposée : aucune taille en ligne (c'est le CSS qui décide)", () => {
  const { ui, hotbarEl, slots } = setup();
  ui.render(slots);
  assert.equal(hotbarEl.children.length, 9);
  assert.equal(hotbarEl.children[0].style.width, undefined);
});

test('setSlotSize : chaque case et chaque icône reçoivent la taille en ligne', () => {
  const { ui, hotbarEl, slots } = setup();
  ui.setSlotSize(30);
  ui.render(slots);
  for (const slot of hotbarEl.children) {
    assert.equal(slot.style.width, '30px');
    assert.equal(slot.style.height, '30px');
    const swatch = slot.children.find((c) => c.className === 'swatch');
    assert.equal(swatch.style.width, '24px');
    assert.equal(swatch.style.height, '24px');
  }
});

test('setSlotSize(null) : retour à la taille du CSS', () => {
  const { ui, hotbarEl, slots } = setup();
  ui.setSlotSize(30);
  ui.setSlotSize(null);
  ui.render(slots);
  assert.equal(hotbarEl.children[0].style.width, undefined);
});
