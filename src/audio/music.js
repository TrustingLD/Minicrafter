// Musique de fond : plusieurs pistes locales, doivent être servies depuis le
// même dossier que index.html (voir CONTRIBUTING.md pour pourquoi les chemins
// doivent être relatifs).
//
// Comportement : au démarrage on tire une piste au hasard parmi `urls`, puis
// à la fin de chaque piste on enchaîne sur la suivante (en boucle sur la
// playlist, pas juste répétition de la même piste).
//
// Nether (Phase 34, 2 pistes depuis la Phase 35) : `netherUrls` (optionnel)
// est une SECONDE playlist, utilisée à la place de la première tant que
// `setNetherMode(true)` est actif -- le paramètre accepte aussi bien un
// tableau qu'une seule URL (même souplesse que `urls`).

export function createMusic(urls, hintEl, netherUrls) {
  const overworldPlaylist = Array.isArray(urls) ? urls : [urls];
  const netherPlaylist = netherUrls ? (Array.isArray(netherUrls) ? netherUrls : [netherUrls]) : overworldPlaylist;

  const bgm = new Audio();
  bgm.volume = 0.32;
  bgm.loop = false; // on gère nous-mêmes l'enchaînement piste -> piste (même une playlist
  // d'une seule piste reboucle correctement via 'ended' ci-dessous : currentIndex
  // revient à 0 puisque playlist.length === 1)

  let playlist = overworldPlaylist;
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

  // /nether, /overworld (Phase 34, cf. main.js travelToDimension) : bascule la
  // playlist active et repart du début de celle-ci -- pas de retour à une
  // position précise dans l'ancienne piste au retour (simplification assumée,
  // comme `nextTrack` le fait déjà pour un changement manuel).
  function setNetherMode(active) {
    const wanted = active ? netherPlaylist : overworldPlaylist;
    if (wanted === playlist) return; // déjà sur la bonne playlist, rien à faire
    playlist = wanted;
    currentIndex = 0;
    loadCurrentTrack();
    if (bgmStarted && !bgmMuted) playCurrent();
  }

  return { startBgm, toggleBgmMute, nextTrack, setNetherMode };
}
