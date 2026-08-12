// Musique de fond : plusieurs pistes locales, doivent être servies depuis le
// même dossier que index.html (voir CONTRIBUTING.md pour pourquoi les chemins
// doivent être relatifs).
//
// Comportement : au démarrage on tire une piste au hasard parmi `urls`, puis
// à la fin de chaque piste on enchaîne sur la suivante (en boucle sur la
// playlist, pas juste répétition de la même piste).

export function createMusic(urls, hintEl) {
  const playlist = Array.isArray(urls) ? urls : [urls];

  const bgm = new Audio();
  bgm.volume = 0.32;
  bgm.loop = false; // on gère nous-mêmes l'enchaînement piste -> piste

  // Ordre de lecture : on démarre sur une piste aléatoire, puis on continue
  // dans l'ordre de la playlist en revenant au début une fois la fin atteinte.
  let currentIndex = Math.floor(Math.random() * playlist.length);
  let bgmStarted = false;
  let bgmMuted = false;

  function loadCurrentTrack() {
    bgm.src = playlist[currentIndex];
  }
  loadCurrentTrack();

  function playCurrent() {
    bgm.play().catch(() => {
      bgmStarted = false; // autoplay bloqué tant qu'il n'y a pas eu de clic
    });
  }

  bgm.addEventListener('ended', () => {
    currentIndex = (currentIndex + 1) % playlist.length;
    loadCurrentTrack();
    if (bgmStarted && !bgmMuted) playCurrent();
  });

  function nextTrack() {
    currentIndex = (currentIndex + 1) % playlist.length;
    loadCurrentTrack();
    if (bgmStarted && !bgmMuted) playCurrent();
  }

  function startBgm() {
    if (bgmStarted || bgmMuted) return;
    bgmStarted = true;
    playCurrent();
  }
  function toggleBgmMute() {
    bgmMuted = !bgmMuted;
    if (bgmMuted) bgm.pause();
    else if (bgmStarted) playCurrent();
    if (hintEl) hintEl.textContent = bgmMuted ? '🔇 Musique coupée (M)' : '🔊 Musique (M)';
  }

  return { startBgm, toggleBgmMute, nextTrack };
}
