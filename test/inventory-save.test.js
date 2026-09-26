import { test } from 'node:test';
import assert from 'node:assert/strict';
import { serializeInventory, deserializeInventory } from '../src/entities/inventory-save.js';

test('aller-retour simple : ce qui est sérialisé ressort identique', () => {
  const slots = new Array(36).fill(null);
  slots[0] = { item: 'planks', count: 12 };
  slots[8] = { item: 'diamond_pickaxe', count: 1 };
  const armorSlots = [null, { item: 'iron_chestplate', count: 1 }, null, null];
  const json = serializeInventory(slots, armorSlots, 3);
  const back = deserializeInventory(json, 36, 4);
  assert.deepEqual(back.slots[0], { item: 'planks', count: 12 });
  assert.deepEqual(back.slots[8], { item: 'diamond_pickaxe', count: 1 });
  assert.equal(back.slots[1], null);
  assert.deepEqual(back.armorSlots[1], { item: 'iron_chestplate', count: 1 });
  assert.equal(back.selectedIndex, 3);
});

test('rien de sauvegardé (première partie) : null, pas une exception', () => {
  assert.equal(deserializeInventory(null, 36, 4), null);
  assert.equal(deserializeInventory('', 36, 4), null);
  assert.equal(deserializeInventory(undefined, 36, 4), null);
});

test("JSON corrompu ou de forme inattendue : null plutôt qu'une exception", () => {
  assert.equal(deserializeInventory('{pas du json', 36, 4), null);
  assert.equal(deserializeInventory('42', 36, 4), null);
  assert.equal(deserializeInventory('null', 36, 4), null);
  assert.equal(
    deserializeInventory(JSON.stringify({ slots: 'oops', armorSlots: [] }), 36, 4),
    null,
  );
  assert.equal(deserializeInventory(JSON.stringify({ slots: [], armorSlots: null }), 36, 4), null);
});

test('cases invalides normalisées à null : pas de count, count négatif, item non-string', () => {
  const json = JSON.stringify({
    slots: [{ item: 'stick' }, { item: 'wood', count: -3 }, { item: 42, count: 1 }, null, 'oops'],
    armorSlots: [],
    selectedIndex: 0,
  });
  const back = deserializeInventory(json, 5, 4);
  assert.deepEqual(back.slots, [null, null, null, null, null]);
});

test('compte non entier tronqué (Math.floor), jamais de virgule flottante conservée', () => {
  const json = serializeInventory([{ item: 'sand', count: 5 }], [], 0);
  // sérialisé tel quel (5 est déjà entier) -- on vérifie surtout la désérialisation d'un
  // compte flottant qui aurait pu être écrit par une version future/bricolée du fichier
  const tampered = JSON.parse(json);
  tampered.slots[0].count = 5.9;
  const back = deserializeInventory(JSON.stringify(tampered), 1, 0);
  assert.equal(back.slots[0].count, 5);
});

test('taille différente de la sauvegarde (le jeu a changé) : tronque plutôt que de tout rejeter', () => {
  const oldSlots = new Array(30).fill(null);
  oldSlots[29] = { item: 'torch', count: 4 };
  const json = serializeInventory(oldSlots, [null, null, null], 0);
  const back = deserializeInventory(json, 36, 4); // taille ACTUELLE, plus grande
  assert.equal(back.slots.length, 36);
  assert.equal(back.armorSlots.length, 4);
  assert.deepEqual(back.slots[29], { item: 'torch', count: 4 }); // dans les deux tailles : conservé
  assert.equal(back.slots[35], null); // au-delà de ce qui existait dans la sauvegarde : vide
  const shrunk = deserializeInventory(json, 10, 4); // taille ACTUELLE, plus petite : tronqué
  assert.equal(shrunk.slots.length, 10);
});

test('selectedIndex hors limites (sauvegarde corrompue ou taille réduite) : retombe sur 0', () => {
  const json = serializeInventory(new Array(9).fill(null), [], 99);
  const back = deserializeInventory(json, 9, 0);
  assert.equal(back.selectedIndex, 0);
  const negative = JSON.parse(json);
  negative.selectedIndex = -1;
  assert.equal(deserializeInventory(JSON.stringify(negative), 9, 0).selectedIndex, 0);
});

test('inventaire entièrement vide : sérialise et redonne un inventaire vide (pas null)', () => {
  const json = serializeInventory(new Array(36).fill(null), new Array(4).fill(null), 0);
  const back = deserializeInventory(json, 36, 4);
  assert.ok(back.slots.every((c) => c === null));
  assert.ok(back.armorSlots.every((c) => c === null));
});
