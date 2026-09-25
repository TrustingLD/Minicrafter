import { test } from 'node:test';
import assert from 'node:assert/strict';

// ---------- sfx.js : masterGain.gain.value doit suivre setVolume, borné à [0,1] ----------
// Fausse AudioContext : juste assez pour que createSfx() s'exécute sans lever d'exception
// (aucun son n'est vraiment produit sous Node) -- on ne teste que le réglage du gain.
class FakeGain {
  constructor() {
    this.gain = { value: 1 };
  }
  connect() {
    return this;
  }
}
const createdGains = []; // dans l'ordre de création -- le tout premier est masterGain (cf. audio/sfx.js)
class FakeAudioContext {
  constructor() {
    this.state = 'suspended';
    this.sampleRate = 44100;
    this.destination = {};
    this.currentTime = 0;
  }
  createGain() {
    const g = new FakeGain();
    createdGains.push(g);
    return g;
  }
  createBuffer(channels, length) {
    return { getChannelData: () => new Float32Array(length) };
  }
  resume() {
    this.state = 'running';
  }
}
globalThis.window = { AudioContext: FakeAudioContext };

const { createSfx } = await import('../src/audio/sfx.js');

test('createSfx : volume par défaut 0.35, setVolume règle le gain, borné à [0, 1]', () => {
  createdGains.length = 0;
  const sfx = createSfx();
  const masterGain = createdGains[0]; // premier createGain() de createSfx() (cf. audio/sfx.js)
  assert.equal(masterGain.gain.value, 0.35);
  sfx.setVolume(0.7);
  assert.equal(masterGain.gain.value, 0.7);
  sfx.setVolume(2); // au-delà de 1 -> plafonné
  assert.equal(masterGain.gain.value, 1);
  sfx.setVolume(-1); // en dessous de 0 -> plancher
  assert.equal(masterGain.gain.value, 0);
});

// ---------- music.js : bgm.volume doit suivre setVolume, indépendamment du mute ----------
const createdAudios = []; // dans l'ordre de création -- le tout premier est `bgm` (cf. audio/music.js)
class FakeAudio {
  constructor() {
    this.volume = 1;
    this.loop = false;
    this.src = '';
    this._listeners = {};
    createdAudios.push(this);
  }
  addEventListener(type, fn) {
    this._listeners[type] = fn;
  }
  play() {
    return Promise.resolve();
  }
  pause() {}
}
globalThis.Audio = FakeAudio;

const { createMusic } = await import('../src/audio/music.js');

test('createMusic : setVolume règle bgm.volume, borné à [0, 1]', () => {
  createdAudios.length = 0;
  const music = createMusic(['./a.mp3']);
  const bgm = createdAudios[0];
  music.setVolume(0.5);
  assert.equal(bgm.volume, 0.5);
  music.setVolume(2);
  assert.equal(bgm.volume, 1);
  music.setVolume(-1);
  assert.equal(bgm.volume, 0);
});

test('createMusic : setVolume ne réactive pas la musique coupée (M)', () => {
  createdAudios.length = 0;
  const played = [];
  const music = createMusic(['./a.mp3']);
  const bgm = createdAudios[0];
  const originalPlay = bgm.play.bind(bgm);
  bgm.play = () => {
    played.push('play');
    return originalPlay();
  };
  music.startBgm();
  assert.deepEqual(played, ['play']);
  music.toggleBgmMute(); // coupée
  music.setVolume(0.9); // ne doit pas la relancer
  assert.deepEqual(played, ['play']); // toujours un seul appel : setVolume n'a pas rejoué
  assert.equal(bgm.volume, 0.9); // le volume est bien retenu pour la prochaine lecture
});
