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
  // Le cadrage (position, lookAt) est calculé dynamiquement dans resize(),
  // à partir de la boîte englobante réelle de l'avatar -- voir plus bas.

  const renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true });
  renderer.setClearColor(0x000000, 0);

  scene.add(new THREE.AmbientLight(0xffffff, 0.75));
  const key = new THREE.DirectionalLight(0xffffff, 0.55);
  key.position.set(-1, 2, -1.6); // du côté caméra (-z), pour bien éclairer le visage
  scene.add(key);

  const avatar = buildAvatar();
  avatar.group.visible = true;
  scene.add(avatar.group);

  // Cadrage caméra calculé à partir de la vraie boîte englobante de l'avatar
  // plutôt qu'une position fixe tâtonnée à la main -- Box3.setFromObject
  // inclut TOUTE la géométrie, y compris les pièces d'armure actuellement
  // invisibles (elle ne filtre pas sur `.visible`), donc ça capture d'emblée
  // le pire cas (casque + plastron/épaulettes + jambières + bottes) et
  // évite que le perso déborde du cadre dès qu'on équipe une armure --
  // c'était le bug remonté ("le personnage ne rentre plus dans l'espace").
  // Recalculé à chaque resize() pour s'adapter à l'aspect ratio du panneau.
  const bounds = new THREE.Box3().setFromObject(avatar.group);
  const boundsSize = bounds.getSize(new THREE.Vector3());
  const boundsCenter = bounds.getCenter(new THREE.Vector3());
  const FIT_MARGIN = 1.15; // un peu d'air autour du perso, pas collé aux bords
  const targetY = boundsCenter.y + boundsSize.y * 0.03; // très légèrement au-dessus du centre, pour privilégier le visage

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

    // distance nécessaire pour que toute la boîte englobante tienne dans le
    // champ de vision, à la fois en hauteur ET en largeur (le facteur qui
    // demande le plus de recul l'emporte) -- indispensable pour les panneaux
    // très larges/bas comme la table de craft, où c'est la hauteur qui
    // manque le plus.
    const vFov = (camera.fov * Math.PI) / 180;
    const distForHeight = boundsSize.y / 2 / Math.tan(vFov / 2);
    const hFov = 2 * Math.atan(Math.tan(vFov / 2) * camera.aspect);
    const distForWidth = boundsSize.x / 2 / Math.tan(hFov / 2);
    const dist = Math.max(distForHeight, distForWidth) * FIT_MARGIN + boundsSize.z / 2;

    // L'avatar fait face à -z par convention (cf. player-model.js) : une
    // caméra placée du côté -z et regardant vers +z se retrouve donc
    // naturellement face au personnage.
    camera.position.set(boundsCenter.x, targetY, boundsCenter.z - dist);
    camera.lookAt(boundsCenter.x, targetY, boundsCenter.z);
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
