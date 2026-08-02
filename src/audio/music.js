// Musique de fond : fichier local, doit être servi depuis le même dossier que
// index.html (voir CONTRIBUTING.md pour pourquoi les chemins doivent être relatifs).

export function createMusic(url, hintEl) {
  const bgm = new Audio(url);
  bgm.loop = true;
  bgm.volume = 0.32;
  let bgmStarted = false;
  let bgmMuted = false;

  function startBgm() {
    if (bgmStarted || bgmMuted) return;
    bgmStarted = true;
    bgm.play().catch(() => {
      bgmStarted = false;
    }); // autoplay bloqué tant qu'il n'y a pas eu de clic
  }
  function toggleBgmMute() {
    bgmMuted = !bgmMuted;
    if (bgmMuted) bgm.pause();
    else if (bgmStarted) bgm.play().catch(() => {});
    if (hintEl) hintEl.textContent = bgmMuted ? '🔇 Musique coupée (M)' : '🔊 Musique (M)';
  }

  return { startBgm, toggleBgmMute };
}
