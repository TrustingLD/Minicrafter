// Aperçu 3D de l'avatar dans le panneau d'inventaire (Phase 20). Rend
// littéralement le MÊME modèle (cf. entities/player-model.js -- mêmes
// matériaux/textures, même géométrie articulée) que l'avatar en jeu à la 3e
// personne (F5), dans une mini scène/caméra/renderer séparés -- pas un sosie
// dessiné en CSS, un second exemplaire du même avatar THREE.js. La tête suit
// le curseur de la souris tant que le panneau est ouvert (remplace l'ancienne
// rotation CSS de .charHead).

import * as THREE from 'three';

const MAX_TURN_Y = (35 * Math.PI) / 180; // gauche/droite
const MAX_TURN_X = (20 * Math.PI) / 180; // haut/bas
const TURN_LERP = 0.3; // vitesse de rattrapage vers la cible, par frame

export function createCharPreview({ canvas, buildAvatar }) {
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(35, 1, 0.1, 10);
  // L'avatar fait face à -z par convention (cf. player-model.js, même repère
  // que l'avatar en jeu) : une caméra placée du côté -z et regardant vers +z
  // se retrouve donc naturellement face au personnage.
  camera.position.set(0, 1.05, -2.3);
  camera.lookAt(0, 1.05, 0);

  const renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true });
  renderer.setClearColor(0x000000, 0);

  scene.add(new THREE.AmbientLight(0xffffff, 0.75));
  const key = new THREE.DirectionalLight(0xffffff, 0.55);
  key.position.set(-1, 2, -1.6); // du côté caméra (-z), pour bien éclairer le visage
  scene.add(key);

  const avatar = buildAvatar();
  avatar.group.visible = true;
  scene.add(avatar.group);

  const baseHeadX = avatar.head.rotation.x;
  const baseHeadY = avatar.head.rotation.y;
  let targetTurnX = 0,
    targetTurnY = 0;

  function onMouseMove(ev) {
    const rect = canvas.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) return;
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height * 0.35; // vise la tête, pas le centre du corps
    const dx = ev.clientX - cx;
    const dy = ev.clientY - cy;
    targetTurnY = Math.max(-MAX_TURN_Y, Math.min(MAX_TURN_Y, (dx / rect.width) * (Math.PI / 2)));
    targetTurnX = Math.max(
      -MAX_TURN_X,
      Math.min(MAX_TURN_X, -(dy / rect.height) * (Math.PI * 0.6)),
    );
  }

  function resize() {
    const rect = canvas.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    renderer.setPixelRatio(dpr);
    renderer.setSize(rect.width, rect.height, false);
    camera.aspect = rect.width / rect.height;
    camera.updateProjectionMatrix();
  }

  function renderFrame() {
    avatar.head.rotation.y += (baseHeadY + targetTurnY - avatar.head.rotation.y) * TURN_LERP;
    avatar.head.rotation.x += (baseHeadX + targetTurnX - avatar.head.rotation.x) * TURN_LERP;
    resize();
    renderer.render(scene, camera);
  }

  let running = false;
  let rafId = null;
  function loop() {
    if (!running) return;
    renderFrame();
    rafId = requestAnimationFrame(loop);
  }

  function show() {
    if (running) return;
    running = true;
    document.addEventListener('mousemove', onMouseMove);
    loop();
  }
  function hide() {
    running = false;
    if (rafId) cancelAnimationFrame(rafId);
    rafId = null;
    document.removeEventListener('mousemove', onMouseMove);
  }

  // met à jour l'armure affichée -- fonctionne même panneau fermé (ex: appelé
  // juste après avoir équipé puis refermé l'inventaire) en forçant un rendu
  // ponctuel, pour que la prochaine ouverture affiche déjà le bon résultat.
  function setArmor(visual) {
    avatar.setArmor(visual);
    if (!running) renderFrame();
  }

  return { show, hide, setArmor };
}
