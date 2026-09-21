import { test, mock } from 'node:test';
import assert from 'node:assert/strict';
import { createChatUI } from '../src/ui/chat.js';

// Faux DOM minimal : assez pour createChatUI (pas de vrai navigateur sous node --test).
// Les fondus de messages passent par setTimeout : on les fige pour ne pas retenir le process.
mock.timers.enable({ apis: ['setTimeout'] });
globalThis.document = {
  createElement: () => ({
    className: '',
    textContent: '',
    style: {},
    remove() {},
  }),
};

function fakeEl() {
  const listeners = {};
  return {
    style: {},
    value: '',
    innerHTML: '',
    children: [],
    scrollTop: 0,
    scrollHeight: 0,
    get firstChild() {
      return this.children[0];
    },
    appendChild(c) {
      this.children.push(c);
    },
    removeChild(c) {
      this.children.splice(this.children.indexOf(c), 1);
    },
    focus() {
      this.focused = true;
    },
    blur() {
      this.focused = false;
    },
    addEventListener(type, fn) {
      listeners[type] = fn;
    },
    fire(type, ev = {}) {
      listeners[type]({ preventDefault() {}, stopPropagation() {}, ...ev });
    },
  };
}

function setup() {
  const els = {
    logEl: fakeEl(),
    historyEl: fakeEl(),
    inputBoxEl: fakeEl(),
    inputEl: fakeEl(),
    sendBtnEl: fakeEl(),
    closeBtnEl: fakeEl(),
  };
  const sent = [];
  let closed = 0;
  const chat = createChatUI({ ...els, onSend: (t) => sent.push(t), onClose: () => closed++ });
  return { chat, els, sent, closed: () => closed };
}

test('open() affiche la saisie et la focalise ; close() la masque', () => {
  const { chat, els, closed } = setup();
  chat.open();
  assert.equal(chat.isOpen, true);
  assert.equal(els.inputBoxEl.style.display, 'block');
  assert.equal(els.inputEl.focused, true);
  chat.close();
  assert.equal(chat.isOpen, false);
  assert.equal(els.inputBoxEl.style.display, 'none');
  assert.equal(closed(), 1);
});

test('bouton ➤ : envoie le texte tapé puis referme (tactile)', () => {
  const { chat, els, sent } = setup();
  chat.open();
  els.inputEl.value = '  /give boat 1  ';
  els.sendBtnEl.fire('click');
  assert.deepEqual(sent, ['/give boat 1']);
  assert.equal(chat.isOpen, false);
});

test("bouton ➤ avec un champ vide : rien d'envoyé, mais le chat se referme", () => {
  const { chat, els, sent } = setup();
  chat.open();
  els.sendBtnEl.fire('click');
  assert.deepEqual(sent, []);
  assert.equal(chat.isOpen, false);
});

test('bouton ✕ : referme sans rien envoyer', () => {
  const { chat, els, sent } = setup();
  chat.open();
  els.inputEl.value = 'brouillon';
  els.closeBtnEl.fire('click');
  assert.deepEqual(sent, []);
  assert.equal(chat.isOpen, false);
});

test('les boutons ne font rien quand le chat est fermé', () => {
  const { chat, els, sent } = setup();
  els.inputEl.value = 'fantôme';
  els.sendBtnEl.fire('click');
  els.closeBtnEl.fire('click');
  assert.deepEqual(sent, []);
  assert.equal(chat.isOpen, false);
});

test('Entrée d\'un clavier virtuel (code vide, key = "Enter") envoie aussi', () => {
  const { chat, els, sent } = setup();
  chat.open();
  els.inputEl.value = 'salut';
  els.inputEl.fire('keydown', { code: '', key: 'Enter' });
  assert.deepEqual(sent, ['salut']);
  assert.equal(chat.isOpen, false);
});

test('Entrée du clavier physique et Échap fonctionnent toujours', () => {
  const { chat, els, sent } = setup();
  chat.open();
  els.inputEl.value = 'coucou';
  els.inputEl.fire('keydown', { code: 'Enter', key: 'Enter' });
  assert.deepEqual(sent, ['coucou']);
  chat.open();
  els.inputEl.value = 'annulé';
  els.inputEl.fire('keydown', { code: 'Escape', key: 'Escape' });
  assert.deepEqual(sent, ['coucou']);
  assert.equal(chat.isOpen, false);
});

test('les boutons sont facultatifs (version clavier/souris)', () => {
  const els = { logEl: fakeEl(), historyEl: fakeEl(), inputBoxEl: fakeEl(), inputEl: fakeEl() };
  const sent = [];
  const chat = createChatUI({ ...els, onSend: (t) => sent.push(t) });
  chat.open();
  els.inputEl.value = 'ok';
  els.inputEl.fire('keydown', { code: 'Enter', key: 'Enter' });
  assert.deepEqual(sent, ['ok']);
});

test('rappel ↑ : remet le dernier message envoyé dans le champ', () => {
  const { chat, els } = setup();
  chat.open();
  els.inputEl.value = 'premier';
  els.inputEl.fire('keydown', { code: 'Enter', key: 'Enter' });
  chat.open();
  els.inputEl.fire('keydown', { code: 'ArrowUp', key: 'ArrowUp' });
  assert.equal(els.inputEl.value, 'premier');
});
