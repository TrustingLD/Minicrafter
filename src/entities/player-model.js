// Avatar joueur 3D partagé (Phase 20). Construit le même modèle (buste, tête,
// bras et jambes articulés, + 4 overlays d'armure) pour DEUX usages : l'avatar
// en jeu (3e personne, F5, cf. entities/player.js) et l'aperçu dans le panneau
// d'inventaire (cf. ui/char-preview.js) -- littéralement le même modèle et les
// mêmes matériaux/textures dans les deux cas, pas juste un sosie qui se
// ressemble : c'est tout le sens de la demande "le personnage dans
// l'inventaire doit être le même que celui en jeu en 3D".

import * as THREE from 'three';
import { makeLimb } from './limb.js';
import { texMobSkin, texPlayerFace } from '../render/textures.js';

// Couleurs des 3 matériaux d'armure -- mêmes teintes que les icônes 2D (cf.
// render/textures.js texArmorPiece/IRON_ARMOR_COLOR etc.), pour qu'une pièce
// ait la même couleur dans la hotbar, sur l'avatar en jeu et dans l'aperçu
// d'inventaire.
export const ARMOR_VISUAL_COLOR = {
  iron: 0xd9d3c8,
  gold: 0xe0a800,
  diamond: 0x4dd9d0,
};

// Matériaux du corps (peau/chemise/pantalon/visage) : un seul jeu de textures
// procédurales, à construire UNE fois et à partager entre tous les avatars
// (en jeu + aperçu inventaire) -- économise la génération de textures et
// garantit un rendu identique.
export function createPlayerMaterials() {
  const tPlayerSkin = texMobSkin('#f9b87e', '#dd8e53');
  const tPlayerShirt = texMobSkin('#2068b4', '#16467a');
  const tPlayerPants = texMobSkin('#353537', '#19191b');
  const skinMat = new THREE.MeshLambertMaterial({ map: tPlayerSkin });
  const shirtMat = new THREE.MeshLambertMaterial({ map: tPlayerShirt });
  const pantsMat = new THREE.MeshLambertMaterial({ map: tPlayerPants });
  const faceMat = new THREE.MeshLambertMaterial({ map: texPlayerFace() });
  // ordre des matériaux d'un BoxGeometry : [+x, -x, +y, -y, +z, -z] -- seule la
  // face -z (index 5) porte le visage (cf. commentaire détaillé dans player.js
  // sur pourquoi c'est cette face précise qui doit regarder la caméra en vue
  // selfie).
  const headMaterials = [skinMat, skinMat, skinMat, skinMat, skinMat, faceMat];
  return { skinMat, shirtMat, pantsMat, faceMat, headMaterials };
}

// Un matériau (couleur unie, sans texture) par matériau d'armure -- partagé
// entre tous les overlays de tous les avatars, pas besoin d'une instance par
// pièce/par avatar.
export function createArmorMaterials() {
  const mats = {};
  for (const [material, color] of Object.entries(ARMOR_VISUAL_COLOR)) {
    mats[material] = new THREE.MeshLambertMaterial({ color });
  }
  return mats;
}

// Construit un avatar complet. `mats` : cf. createPlayerMaterials(). `armorMats` :
// cf. createArmorMaterials() (un jeu par défaut est créé si omis, mais pour
// garantir un rendu identique entre 2 avatars il vaut mieux leur passer le
// MÊME objet).
export function buildPlayerAvatar(mats, armorMats = createArmorMaterials()) {
  const group = new THREE.Group();
  const legs = [],
    arms = [];

  const body = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.75, 0.28), mats.shirtMat);
  body.position.y = 1.15;
  body.castShadow = true;
  group.add(body);

  const head = new THREE.Mesh(new THREE.BoxGeometry(0.45, 0.45, 0.45), mats.headMaterials);
  head.position.y = 1.775;
  head.castShadow = true;
  group.add(head);

  // longueur et niveau des bras alignés sur le buste : le pivot (épaule) est
  // placé au sommet du buste et le bras a la même hauteur que le buste, donc
  // son bas retombe exactement au niveau du bas du buste.
  const ARM_H = 0.75;
  const ARM_JOINT_Y = 1.15 + 0.75 / 2;
  [
    [-0.34, ARM_JOINT_Y],
    [0.34, ARM_JOINT_Y],
  ].forEach(([ax, ay]) => {
    const { pivot } = makeLimb(0.16, ARM_H, 0.16, mats.skinMat, ax, ay, 0);
    group.add(pivot);
    arms.push(pivot);
  });

  // Jambes en deux segments (cuisse + tibia, articulés au genou) plutôt qu'un
  // seul bloc rigide pivoté à la hanche : un accroupissement doit PLIER le
  // genou, pas faire tourner toute la jambe raide vers l'avant.
  const LEG_TOTAL_H = 0.775;
  const THIGH_H = 0.39;
  const SHIN_H = LEG_TOTAL_H - THIGH_H;
  [
    [-0.13, LEG_TOTAL_H],
    [0.13, LEG_TOTAL_H],
  ].forEach(([lx, ly]) => {
    const hip = new THREE.Group();
    hip.position.set(lx, ly, 0);
    const thigh = new THREE.Mesh(new THREE.BoxGeometry(0.18, THIGH_H, 0.18), mats.pantsMat);
    thigh.position.y = -THIGH_H / 2;
    thigh.castShadow = true;
    hip.add(thigh);

    const knee = new THREE.Group();
    knee.position.y = -THIGH_H;
    hip.add(knee);
    const shin = new THREE.Mesh(new THREE.BoxGeometry(0.18, SHIN_H, 0.18), mats.pantsMat);
    shin.position.y = -SHIN_H / 2;
    shin.castShadow = true;
    knee.add(shin);

    group.add(hip);
    legs.push({ hip, knee, thigh, shin });
  });

  // positions "debout" de repos, pour pouvoir revenir dessus en s'accroupissant
  // sans les re-calculer à chaque frame.
  const restY = { body: body.position.y, head: head.position.y, arm: ARM_JOINT_Y };

  // --- Overlays d'armure (Phase 20) : un mesh par pièce, légèrement plus grand
  // que la partie du corps qu'il habille (pour "flotter" dessus sans
  // z-fighting), enfant direct du mesh concerné -- il hérite donc gratuitement
  // de toutes ses animations (balancier de marche, accroupissement, swing).
  // Masqués par défaut (visible=false) tant que rien n'est équipé sur ce slot.
  const helmetMesh = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.5, 0.5), armorMats.iron);
  helmetMesh.visible = false;
  head.add(helmetMesh);

  const chestMesh = new THREE.Mesh(new THREE.BoxGeometry(0.58, 0.8, 0.36), armorMats.iron);
  chestMesh.visible = false;
  body.add(chestMesh);

  const BOOT_H = SHIN_H * 0.55;
  const legArmor = legs.map(({ thigh, shin }) => {
    // jambières : habillent toute la cuisse (position 0 = centre local de `thigh`).
    const leggingsMesh = new THREE.Mesh(
      new THREE.BoxGeometry(0.23, THIGH_H + 0.06, 0.23),
      armorMats.iron,
    );
    leggingsMesh.visible = false;
    thigh.add(leggingsMesh);

    // bottes : juste le bas du tibia (le pied), pas tout le mollet.
    const bootsMesh = new THREE.Mesh(new THREE.BoxGeometry(0.23, BOOT_H, 0.23), armorMats.iron);
    bootsMesh.position.y = -SHIN_H / 2 + BOOT_H / 2;
    bootsMesh.visible = false;
    shin.add(bootsMesh);

    return { leggingsMesh, bootsMesh };
  });

  function applyPiece(mesh, material) {
    if (material && armorMats[material]) {
      mesh.visible = true;
      mesh.material = armorMats[material];
    } else {
      mesh.visible = false;
    }
  }

  // `visual` : { helmet, chest, legs, feet } où chaque valeur est
  // 'iron' | 'gold' | 'diamond' | null|undefined (rien d'équipé sur ce slot).
  function setArmor(visual = {}) {
    applyPiece(helmetMesh, visual.helmet);
    applyPiece(chestMesh, visual.chest);
    legArmor.forEach(({ leggingsMesh, bootsMesh }) => {
      applyPiece(leggingsMesh, visual.legs);
      applyPiece(bootsMesh, visual.feet);
    });
  }

  return { group, legs, arms, body, head, restY, setArmor };
}
