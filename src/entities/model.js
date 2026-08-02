// Construit un mesh Three.js à partir d'un modèle en boîtes (voir data/mobs.js).
// Sépare la donnée (schéma boîtes/membres) de la construction (Three.js) : ajouter
// un mob ne touche plus à ce fichier, seulement à data/mobs.js.

import * as THREE from 'three';
import { makeLimb } from './limb.js';

const FACE_INDEX = { '+x': 0, '-x': 1, '+y': 2, '-y': 3, '+z': 4, '-z': 5 };

function matFor(textures, texName) {
  return new THREE.MeshLambertMaterial({ map: textures[texName] });
}

function materialFor(part, textures) {
  if (!part.faceTex) return matFor(textures, part.tex);
  const base = matFor(textures, part.tex);
  const arr = [base, base, base, base, base, base];
  arr[FACE_INDEX[part.face || '+z']] = matFor(textures, part.faceTex);
  return arr;
}

// textures : { texName: THREE.Texture }. Retourne { group, parts, legs, arms } —
// `parts` est la liste plate des meshes cliquables (raycast de dégâts), `legs`/`arms`
// les pivots animés en alternance (i pair / impair) par entities/mob.js.
export function buildBoxModel(model, textures) {
  const group = new THREE.Group();
  const parts = [];
  const limbGroups = {};

  (model.parts || []).forEach((p) => {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(...p.size), materialFor(p, textures));
    mesh.position.set(p.at[0], p.at[1], p.at[2]);
    mesh.castShadow = true;
    group.add(mesh);
    parts.push(mesh);
  });

  (model.limbs || []).forEach((l) => {
    const mat = matFor(textures, l.tex);
    const pivots = limbGroups[l.group] || (limbGroups[l.group] = []);
    l.positions.forEach(([lx, lz]) => {
      const { pivot, mesh } = makeLimb(l.size[0], l.size[1], l.size[2], mat, lx, l.jointY, lz);
      group.add(pivot);
      parts.push(mesh);
      pivots.push(pivot);
    });
  });

  return { group, parts, legs: limbGroups.legs || [], arms: limbGroups.arms || [] };
}
