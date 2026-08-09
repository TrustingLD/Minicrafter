// Neige qui tombe (retour utilisateur) : ambiance légère en biome "toundra"
// (BIOMES.snowy, cf. world/biomes.js), même patron que clouds.js/sky.js --
// createSnowWeather({ scene }) renvoie { update(dt, playerPos, active) }, appelé une
// fois par frame depuis main.js.
//
// Astuce "monde infini" : comme les étoiles de sky.js, UN SEUL THREE.Points recentré
// sur le joueur chaque frame -- pas de vrai flocon positionné dans le monde (ça
// impliquerait de suivre des milliers de particules par chunk chargé). Chaque flocon
// n'est qu'un décalage (offsets) autour du joueur ; sa hauteur boucle en dents de scie
// dans [0, HEIGHT) pour retomber sans fin sans jamais être recréé.
//
// "pas trop" (consigne explicite) : peu de flocons (SNOW_COUNT), chute lente, rayon
// resserré -- une ambiance discrète, pas un blizzard qui gênerait la lisibilité.

import * as THREE from 'three';

const SNOW_COUNT = 220;
const RADIUS_XZ = 22; // rayon horizontal du volume de flocons autour du joueur
const HEIGHT = 16; // hauteur du volume (les flocons bouclent dans cette plage)
const FALL_SPEED = 1.1; // unités/s -- lente dérive, pas une tempête
const DRIFT_SPEED = 0.22; // léger balancement horizontal (vent faible)
const TARGET_OPACITY = 0.75;
const FADE_SPEED = 2.5; // fondu doux à la frontière du biome plutôt qu'un pop in/out net

// petit disque doux : même technique que texGlowDisc dans sky.js, un flocon carré
// ferait trop "pixel art" et casserait le rendu voxel du reste du jeu
function texSnowflake() {
  const c = document.createElement('canvas');
  c.width = 16;
  c.height = 16;
  const ctx = c.getContext('2d');
  const g = ctx.createRadialGradient(8, 8, 0, 8, 8, 8);
  g.addColorStop(0, 'rgba(255,255,255,1)');
  g.addColorStop(0.6, 'rgba(255,255,255,0.6)');
  g.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 16, 16);
  return new THREE.CanvasTexture(c);
}

export function createSnowWeather({ scene }) {
  // offsets : position de chaque flocon RELATIVE au joueur (recopiée dans `position`
  // chaque frame, cf. update) -- offsets[i*3+1] est la seule coordonnée qui évolue
  // dans le temps (la chute), x/z restent fixes pour ce flocon (+ un léger balancement).
  const offsets = new Float32Array(SNOW_COUNT * 3);
  const phase = new Float32Array(SNOW_COUNT); // déphasage individuel du balancement
  for (let i = 0; i < SNOW_COUNT; i++) {
    offsets[i * 3] = (Math.random() - 0.5) * RADIUS_XZ * 2;
    offsets[i * 3 + 1] = Math.random() * HEIGHT;
    offsets[i * 3 + 2] = (Math.random() - 0.5) * RADIUS_XZ * 2;
    phase[i] = Math.random() * Math.PI * 2;
  }

  const geometry = new THREE.BufferGeometry();
  const positions = new Float32Array(SNOW_COUNT * 3); // positions MONDE, recalculées chaque frame
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  const material = new THREE.PointsMaterial({
    map: texSnowflake(),
    size: 0.16,
    color: 0xffffff,
    transparent: true,
    opacity: 0,
    depthWrite: false,
    fog: false,
  });
  const points = new THREE.Points(geometry, material);
  scene.add(points);

  let time = 0;
  let opacity = 0; // valeur lissée, indépendante de `active` (cf. FADE_SPEED)

  function update(dt, playerPos, active) {
    time += dt;
    opacity += ((active ? TARGET_OPACITY : 0) - opacity) * Math.min(1, dt * FADE_SPEED);
    material.opacity = opacity;
    points.visible = opacity > 0.01; // évite de mettre à jour 220 positions pour rien hors toundra
    if (!points.visible) return;

    const pos = geometry.attributes.position.array;
    for (let i = 0; i < SNOW_COUNT; i++) {
      // dents de scie dans [0, HEIGHT) : `((x % n) + n) % n` reste positif même quand
      // FALL_SPEED*dt dépasse la valeur courante (mod JS garde le signe de l'opérande).
      offsets[i * 3 + 1] = (((offsets[i * 3 + 1] - FALL_SPEED * dt) % HEIGHT) + HEIGHT) % HEIGHT;
      const sway = Math.sin(time * 0.8 + phase[i]) * DRIFT_SPEED;
      pos[i * 3] = playerPos.x + offsets[i * 3] + sway;
      // volume centré un peu au-dessus du joueur (0.3*HEIGHT) : plus de flocons
      // visibles en tombant devant/au-dessus qu'en dessous du niveau des pieds.
      pos[i * 3 + 1] = playerPos.y + offsets[i * 3 + 1] - HEIGHT * 0.3;
      pos[i * 3 + 2] = playerPos.z + offsets[i * 3 + 2];
    }
    geometry.attributes.position.needsUpdate = true;
  }

  return { update };
}
