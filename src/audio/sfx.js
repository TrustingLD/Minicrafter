// Sons générés en Web Audio, aucun fichier externe nécessaire.

export function createSfx() {
  const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  const masterGain = audioCtx.createGain();
  masterGain.gain.value = 0.35;
  masterGain.connect(audioCtx.destination);

  // bruit blanc mis en cache pour les sons de type "impact"
  const noiseBuffer = (() => {
    const buf = audioCtx.createBuffer(1, audioCtx.sampleRate * 0.5, audioCtx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
    return buf;
  })();

  function resumeAudio() {
    if (audioCtx.state === 'suspended') audioCtx.resume();
  }

  function playTone(freq, duration, type, gainVal, freqEnd) {
    if (audioCtx.state !== 'running') return;
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.type = type || 'sine';
    osc.frequency.value = freq;
    gain.gain.value = gainVal;
    osc.connect(gain).connect(masterGain);
    const t = audioCtx.currentTime;
    if (freqEnd) osc.frequency.exponentialRampToValueAtTime(Math.max(20, freqEnd), t + duration);
    gain.gain.exponentialRampToValueAtTime(0.001, t + duration);
    osc.start(t);
    osc.stop(t + duration + 0.02);
  }
  function playNoiseBurst(duration, filterFreq, gainVal, filterType) {
    if (audioCtx.state !== 'running') return;
    const src = audioCtx.createBufferSource();
    src.buffer = noiseBuffer;
    const filter = audioCtx.createBiquadFilter();
    filter.type = filterType || 'bandpass';
    filter.frequency.value = filterFreq;
    const gain = audioCtx.createGain();
    gain.gain.value = gainVal;
    src.connect(filter).connect(gain).connect(masterGain);
    const t = audioCtx.currentTime;
    gain.gain.exponentialRampToValueAtTime(0.001, t + duration);
    src.start(t);
    src.stop(t + duration + 0.02);
  }
  function playSound(name) {
    switch (name) {
      case 'break':
        playNoiseBurst(0.15, 900, 0.3);
        break;
      case 'place':
        playNoiseBurst(0.08, 1500, 0.22);
        break;
      case 'jump':
        playTone(300, 0.15, 'sine', 0.18, 520);
        break;
      case 'land':
        playNoiseBurst(0.08, 300, 0.15, 'lowpass');
        break;
      case 'hurt':
        playTone(180, 0.25, 'sawtooth', 0.22, 80);
        break;
      case 'hit':
        playNoiseBurst(0.07, 2200, 0.25);
        break;
      case 'mobDeath':
        playTone(220, 0.3, 'triangle', 0.22, 55);
        break;
      case 'footstep':
        playNoiseBurst(0.06, 450, 0.1, 'lowpass');
        break;
      case 'footstepWater':
        playNoiseBurst(0.1, 250, 0.14, 'lowpass');
        break;
      case 'craft':
        playTone(700, 0.08, 'square', 0.15, 1000);
        break;
      case 'equip':
        playTone(500, 0.06, 'square', 0.12, 700);
        break;
    }
  }

  return { resumeAudio, playSound };
}
