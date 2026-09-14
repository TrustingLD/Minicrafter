// Nuages (façon voxel plat, cf. Minecraft) : une seule InstancedMesh représentant
// un motif de "pavés" nuageux sur une grille carrée de PATTERN_SIZE unités, générée
// une fois avec du bruit déterministe (mêmes règles que generator.js : pas de
// Math.random(), pour rester cohérent avec le reste du monde même si ici il n'y a
// pas de contrainte de rechargement identique — juste une habitude du projet).
//
// Astuce pour un "ciel infini" sans regénérer la géométrie à chaque frame : le motif
// se répète exactement tous les PATTERN_SIZE, donc on se contente de repositionner
// tout le mesh sur la grille (Math.floor(joueur / PATTERN_SIZE) * PATTERN_SIZE) —
// le raccord est invisible puisque le motif est identique d'une tuile à l'autre.
// Une dérive lente et continue (driftX/driftZ, indépendante de cet accrochage) donne
// l'impression que les nuages avancent dans le ciel.

import * as THREE from 'three';
import { makeNoise2D } from '../core/math.js';

const CLOUD_Y = 105; // au-dessus du point culminant du terrain (montagnes jusqu'à 58) mais dans la brume (fog far=170) — remonté de 20 blocs
const CELL = 8; // taille d'un pavé de nuage, en blocs
const GRID = 16; // grille GRID x GRID cellules -> motif de PATTERN_SIZE de côté
const PATTERN_SIZE = CELL * GRID;
const NOISE_FREQ = 0.16; // fréquence du bruit : grosses touffes façon Minecraft
const THRESHOLD = 0.08; // couverture nuageuse (plus bas = plus de nuages)
const DRIFT_SPEED_X = 0.35; // unités/s : dérive lente dans le ciel
const DRIFT_SPEED_Z = 0.12;

export function createClouds({ scene }) {
  const noise2D = makeNoise2D(1337);

  // motif précalculé une seule fois : liste des cellules "nuageuses" de la grille
  const cells = [];
  for (let gx = 0; gx < GRID; gx++) {
    for (let gz = 0; gz < GRID; gz++) {
      if (noise2D(gx * NOISE_FREQ, gz * NOISE_FREQ) > THRESHOLD) {
        cells.push({ gx, gz });
      }
    }
  }

  const geometry = new THREE.BoxGeometry(CELL * 0.92, 3, CELL * 0.92);
  const material = new THREE.MeshLambertMaterial({
    color: 0xffffff,
    transparent: true,
    opacity: 0.85,
  });
  const mesh = new THREE.InstancedMesh(geometry, material, cells.length);
  mesh.position.y = CLOUD_Y;
  const dummy = new THREE.Object3D();
  cells.forEach((cell, i) => {
    // centré sur (0,0) : la moitié de la grille de part et d'autre de l'origine
    dummy.position.set((cell.gx - GRID / 2) * CELL, 0, (cell.gz - GRID / 2) * CELL);
    dummy.updateMatrix();
    mesh.setMatrixAt(i, dummy.matrix);
  });
  mesh.instanceMatrix.needsUpdate = true;
  scene.add(mesh);

  let driftX = 0,
    driftZ = 0;

  function update(dt, playerPos) {
    driftX = (driftX + dt * DRIFT_SPEED_X) % PATTERN_SIZE;
    driftZ = (driftZ + dt * DRIFT_SPEED_Z) % PATTERN_SIZE;
    // accroche le motif au joueur par pas de PATTERN_SIZE (raccord invisible, motif
    // périodique) puis ajoute la dérive continue par-dessus
    const snapX = Math.floor(playerPos.x / PATTERN_SIZE) * PATTERN_SIZE;
    const snapZ = Math.floor(playerPos.z / PATTERN_SIZE) * PATTERN_SIZE;
    mesh.position.x = snapX + driftX;
    mesh.position.z = snapZ + driftZ;
  }

  return { mesh, update };
}
