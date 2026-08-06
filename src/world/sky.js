// Cycle jour/nuit : couleur du ciel, intensité des lumières, soleil, lune et étoiles.
// Suit le même patron que clouds.js : createSky({ scene, ... }) renvoie { update(dt, playerPos) }
// que main.js appelle une fois par frame. Toute la logique Three.js du ciel vit ici pour ne
// pas alourdir main.js (qui ne fait plus que du câblage).
//
// Le cycle avance avec `dt` (comme la physique du joueur et les nuages), pas avec
// performance.now() : ça évite toute dérive et ça se met en pause naturellement si le jeu
// est en arrière-plan (dt vient de clock.getDelta(), plafonné, dans main.js).

import * as THREE from 'three';

const DAY_LENGTH_SECONDS = 720; // durée d'un cycle complet jour+nuit, en secondes (12 min)
// instant du cycle au démarrage : 0 = minuit, 0.5 = midi. 0.35 = milieu de matinée —
// pleine lumière, et il reste ~2 minutes de jour avant la première nuit.
const START_CYCLE_T = 0.35;
const SUN_MOON_DIST = 300; // distance du disque soleil/lune (assez loin pour rester net dans la brume)
const LIGHT_DIST = 100; // distance de la position des lumières directionnelles

const SKY_DAY = new THREE.Color(0x87ceeb);
const SKY_NIGHT = new THREE.Color(0x060a1f);
const SKY_DUSK = new THREE.Color(0xff9a5a);

function smoothstep(edge0, edge1, x) {
  const t = Math.min(1, Math.max(0, (x - edge0) / (edge1 - edge0)));
  return t * t * (3 - 2 * t);
}

// disque lumineux (soleil/lune) : dégradé radial sur un petit canvas, utilisé comme
// texture d'un Sprite (toujours face caméra, donc jamais "plat" vu de côté comme le
// serait une simple sphère éclairée par une seule direction de lumière)
function texGlowDisc(coreColor, glowColor) {
  const c = document.createElement('canvas');
  c.width = 128;
  c.height = 128;
  const ctx = c.getContext('2d');
  const g = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
  g.addColorStop(0, coreColor);
  g.addColorStop(0.35, coreColor);
  g.addColorStop(0.55, glowColor);
  g.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 128, 128);
  return new THREE.CanvasTexture(c);
}

export function createSky({ scene, ambientLight, sunLight }) {
  // lune : lumière douce et froide qui prend le relais du soleil la nuit
  const moonLight = new THREE.DirectionalLight(0xaac0ff, 0);
  scene.add(moonLight);
  scene.add(moonLight.target);

  // soleil : sprite plus gros et plus lumineux que l'ancienne sphère pleine
  // (36 unités de large, contre 16 pour l'ancien sunMesh de rayon 8)
  // Fix (retour utilisateur) : depthTest était à false -- le sprite se dessinait donc
  // TOUJOURS par-dessus le reste, terrain compris, d'où le soleil/la lune visibles à
  // travers les blocs. depthTest: true le fait comparer normalement au depth buffer
  // (donc bien caché derrière une montagne) ; depthWrite reste à false, comme avant,
  // pour ne pas boucher le fond avec le carré du sprite derrière son propre glow
  // transparent (étoiles, ciel...). La distance (300, cf. SUN_MOON_DIST) reste bien
  // dans le camera.far (1000, main.js), donc aucun souci de clipping.
  const sunSprite = new THREE.Sprite(
    new THREE.SpriteMaterial({
      map: texGlowDisc('#fae102', 'rgb(255, 225, 0)'),
      transparent: true,
      depthWrite: false,
      depthTest: true,
      fog: false,
      blending: THREE.AdditiveBlending,
    }),
  );
  sunSprite.scale.set(36, 36, 1);
  scene.add(sunSprite);

  // lune : plus petite que le soleil, teinte froide, même traitement
  const moonSprite = new THREE.Sprite(
    new THREE.SpriteMaterial({
      map: texGlowDisc('#f4f6ff', 'rgba(180,200,255,0.45)'),
      transparent: true,
      depthWrite: false,
      depthTest: true,
      fog: false,
      blending: THREE.AdditiveBlending,
    }),
  );
  moonSprite.scale.set(24, 24, 1);
  scene.add(moonSprite);

  // étoiles : semis de points sur une grande sphère recentrée sur le joueur chaque
  // frame (illusion d'un ciel infiniment loin, pas de parallax). Concentrées vers le
  // haut du ciel (phi favorise le zénith) pour ne pas en avoir sous l'horizon.
  const STAR_COUNT = 900;
  const starPositions = new Float32Array(STAR_COUNT * 3);
  for (let i = 0; i < STAR_COUNT; i++) {
    const theta = Math.random() * Math.PI * 2;
    const phi = Math.acos(Math.random() * 1.4 - 0.7);
    const r = 280 + Math.random() * 40;
    starPositions[i * 3] = r * Math.sin(phi) * Math.cos(theta);
    starPositions[i * 3 + 1] = Math.abs(r * Math.cos(phi)) + 20;
    starPositions[i * 3 + 2] = r * Math.sin(phi) * Math.sin(theta);
  }
  const starGeo = new THREE.BufferGeometry();
  starGeo.setAttribute('position', new THREE.BufferAttribute(starPositions, 3));
  const starMat = new THREE.PointsMaterial({
    color: 0xffffff,
    size: 1.6,
    transparent: true,
    opacity: 0,
    depthWrite: false,
    fog: false,
  });
  const stars = new THREE.Points(starGeo, starMat);
  scene.add(stars);

  const skyColor = new THREE.Color();
  // fix : `elapsed = 0` correspond à cycleT = 0, c'est-à-dire MINUIT (cf. setTime plus
  // bas). La partie démarrait donc en pleine nuit — écran noir et zombies dès la
  // première seconde. On démarre en milieu de matinée, soleil déjà bien haut.
  let elapsed = DAY_LENGTH_SECONDS * START_CYCLE_T;
  // même valeur que celle que `update()` calculera à la première frame : sans ça,
  // isNight() répondrait « nuit » (0 < -0.05 est faux, mais l'ancien 0 mentait sur
  // l'état réel du ciel) avant le tout premier update.
  // (même formule que dans update() : sunDir = (cos a, sin a, 0.2).normalize())
  let lastSunHeight = Math.sin(START_CYCLE_T * Math.PI * 2 - Math.PI / 2) / Math.hypot(1, 0.2);

  function update(dt, playerPos) {
    elapsed += dt;
    const cycleT = (elapsed % DAY_LENGTH_SECONDS) / DAY_LENGTH_SECONDS;
    const angle = cycleT * Math.PI * 2 - Math.PI / 2;
    const sunDir = new THREE.Vector3(Math.cos(angle), Math.sin(angle), 0.2).normalize();
    const sunHeight = sunDir.y;
    lastSunHeight = sunHeight;

    const dayAmount = smoothstep(-0.2, 0.15, sunHeight);
    const duskAmount = Math.max(0, 1 - Math.abs(sunHeight) / 0.28);

    skyColor
      .copy(SKY_NIGHT)
      .lerp(SKY_DAY, dayAmount)
      .lerp(SKY_DUSK, duskAmount * 0.5);
    scene.background = skyColor;
    scene.fog.color.copy(skyColor);

    ambientLight.intensity = 0.12 + dayAmount * 0.53;
    sunLight.intensity = dayAmount * 0.85;
    moonLight.intensity = (1 - dayAmount) * 0.22;

    sunLight.position.copy(playerPos).addScaledVector(sunDir, LIGHT_DIST);
    sunLight.target.position.copy(playerPos);
    sunLight.target.updateMatrixWorld();
    sunSprite.position.copy(playerPos).addScaledVector(sunDir, SUN_MOON_DIST);
    const sunOpacity = smoothstep(-0.03, 0.08, sunHeight);
    sunSprite.material.opacity = sunOpacity;
    sunSprite.visible = sunOpacity > 0.01;

    const moonDir = sunDir.clone().negate();
    moonLight.position.copy(playerPos).addScaledVector(moonDir, LIGHT_DIST);
    moonLight.target.position.copy(playerPos);
    moonLight.target.updateMatrixWorld();
    moonSprite.position.copy(playerPos).addScaledVector(moonDir, SUN_MOON_DIST);
    const moonOpacity = smoothstep(-0.03, 0.08, moonDir.y);
    moonSprite.material.opacity = moonOpacity;
    moonSprite.visible = moonOpacity > 0.01;

    stars.position.copy(playerPos);
    starMat.opacity = (1 - dayAmount) * 0.85;
  }

  // /time (Phase 15) : cycleT 0.5 = midi (plein jour), 0 = minuit (nuit complète) —
  // cf. le calcul de sunDir ci-dessus (sin(angle), angle = cycleT*2π - π/2).
  function setTime(cycleT) {
    elapsed = (((cycleT % 1) + 1) % 1) * DAY_LENGTH_SECONDS;
  }
  // seuil sunHeight < -0.05 : mobs hostiles + spawn nocturne (Phase 12) veulent un
  // "vraiment nuit", pas juste "un peu après le coucher du soleil".
  function isNight() {
    return lastSunHeight < -0.05;
  }

  return { update, setTime, isNight };
}
