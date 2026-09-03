// crée un "membre" articulé : un pivot placé à l'articulation (hanche/épaule) qui
// contient le mesh décalé vers le bas, pour pouvoir tourner le pivot et obtenir
// un vrai mouvement de balancier (au lieu de faire flotter/tourner un bloc entier)

import * as THREE from 'three';

export function makeLimb(w, h, d, mat, jointX, jointY, jointZ) {
  const pivot = new THREE.Group();
  pivot.position.set(jointX, jointY, jointZ);
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
  mesh.position.y = -h / 2;
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  pivot.add(mesh);
  return { pivot, mesh };
}
