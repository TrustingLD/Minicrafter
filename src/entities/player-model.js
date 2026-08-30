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
  // Casque : seulement la moitié supérieure du visage (comme dans Minecraft),
  // pas toute la tête -- une boîte pleine cachait complètement le visage,
  // texture comprise. HEAD_H = hauteur de `head` (0.45) : la moitié haute va
  // donc de y=0 (ligne médiane) à y=+0.225, plus un léger débord vers le haut
  // pour flotter sur le sommet du crâne sans z-fighting.
  // Casque : construit à partir de PLUSIEURS boîtes (dôme + flanc gauche +
  // flanc droit + arrière) plutôt qu'un seul pavé plein, pour laisser une
  // vraie encoche à l'avant, à hauteur des yeux -- sinon le bas du casque
  // (qui tombait pile sur la ligne des yeux, cf. texPlayerFace) cachait le
  // regard du personnage. Le dôme couvre le dessus/sourcils, les flancs et
  // l'arrière couvrent le tour de tête à hauteur des yeux, et seul le
  // centre-avant reste ouvert (zone des yeux dans texPlayerFace : x environ
  // [-0.135, 0.135] en coordonnées locales de `head`).
  const HEAD_H = 0.45;
  const EYE_LINE = 0.06; // limite haute de l'encoche : juste au-dessus des sourcils
  const BAND_BOTTOM = 0; // bas du casque, ligne médiane de la tête (comme avant)
  const EYES_HALF_W = 0.135; // demi-largeur de la zone des yeux
  const OVERHANG = 0.25; // demi-largeur/profondeur du casque (0.5 total, contre 0.45 pour la tête, pour flotter sans z-fighting)

  const helmetGroup = new THREE.Group();
  const helmetPieces = [];
  function addHelmetPiece(w, h, d, x, y, z) {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), armorMats.iron);
    mesh.position.set(x, y, z);
    helmetGroup.add(mesh);
    helmetPieces.push(mesh);
  }
  // dôme : tout le dessus de la tête, jusqu'au-dessus des sourcils.
  addHelmetPiece(
    OVERHANG * 2,
    HEAD_H / 2 - EYE_LINE,
    OVERHANG * 2,
    0,
    (EYE_LINE + HEAD_H / 2) / 2,
    0,
  );
  // flanc gauche et flanc droit : de l'extérieur de la tête jusqu'au bord de
  // la zone des yeux, sur toute la profondeur (avant-arrière).
  const sideW = OVERHANG - EYES_HALF_W;
  addHelmetPiece(
    sideW,
    EYE_LINE - BAND_BOTTOM,
    OVERHANG * 2,
    -(EYES_HALF_W + sideW / 2),
    (BAND_BOTTOM + EYE_LINE) / 2,
    0,
  );
  addHelmetPiece(
    sideW,
    EYE_LINE - BAND_BOTTOM,
    OVERHANG * 2,
    EYES_HALF_W + sideW / 2,
    (BAND_BOTTOM + EYE_LINE) / 2,
    0,
  );
  // arrière : referme le tour de tête à hauteur des yeux, côté nuque
  // uniquement (z positif) -- le centre-avant (z négatif = face) reste
  // ouvert, c'est l'encoche des yeux.
  addHelmetPiece(
    EYES_HALF_W * 2,
    EYE_LINE - BAND_BOTTOM,
    OVERHANG,
    0,
    (BAND_BOTTOM + EYE_LINE) / 2,
    OVERHANG / 2,
  );
  helmetGroup.visible = false;
  head.add(helmetGroup);

  // Plastron : torse + 2 épaulettes qui débordent sur le côté, vers le haut des
  // bras (retour utilisateur : "doit aller un peu sur les épaules") -- un
  // simple pavé calé sur `body` s'arrêtait pile au bord du torse et ne
  // débordait jamais sur l'épaule comme un vrai plastron.
  // ATTENTION : le haut du torse (y local = +0.4) est exactement calé sur le
  // bas de la tête (head bottom = 1.55 monde = 0.4 en local de `body`, cf.
  // HEAD_H/head.position.y plus haut) -- les épaulettes ne doivent JAMAIS
  // dépasser cette hauteur, sinon elles rentrent dans le cube de la tête et
  // ça z-fight (c'était le bug du screenshot : bande trop large + artefacts
  // noirs près du cou). Elles débordent donc en LARGEUR (vers l'épaule/le
  // bras), pas en hauteur.
  const chestGroup = new THREE.Group();
  const chestPieces = [];
  function addChestPiece(w, h, d, x, y, z) {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), armorMats.iron);
    mesh.position.set(x, y, z);
    chestGroup.add(mesh);
    chestPieces.push(mesh);
  }
  // torse : comme avant, légèrement plus grand que `body` pour flotter dessus
  // sans z-fighting.
  addChestPiece(0.58, 0.8, 0.36, 0, 0, 0);
  // épaulettes : un petit bloc de chaque côté, accolé au bord du torse (pas de
  // chevauchement en X avec le torse -> pas de z-fighting sur la face du haut)
  // et qui déborde vers l'extérieur jusqu'au bout de l'épaule/du bras (retour
  // utilisateur : "faut que ça aille jusqu'au bout des épaules"), avec un
  // petit surplomb (comme les autres pièces d'armure) pour flotter sans
  // z-fighting avec le bras. Plafonné à y=+0.4 (haut du torse), jamais plus
  // haut (cf. note ci-dessus sur la tête).
  const TORSO_EDGE = 0.29; // bord du torse (0.58 / 2)
  const ARM_OUTER_EDGE = 0.34 + 0.16 / 2; // bord extérieur du bras (ax=0.34, largeur 0.16)
  const SHOULDER_OUTER = ARM_OUTER_EDGE + 0.02; // léger surplomb, comme le torse sur `body`
  const SHOULDER_W = SHOULDER_OUTER - TORSO_EDGE;
  const SHOULDER_BOTTOM = 0.18;
  const SHOULDER_TOP = 0.4; // <= haut du torse, ne remonte jamais dans la tête
  [-1, 1].forEach((side) => {
    addChestPiece(
      SHOULDER_W,
      SHOULDER_TOP - SHOULDER_BOTTOM,
      0.4,
      side * (TORSO_EDGE + SHOULDER_W / 2),
      (SHOULDER_BOTTOM + SHOULDER_TOP) / 2,
      0,
    );
  });
  chestGroup.visible = false;
  body.add(chestGroup);

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
    const bootTop = -SHIN_H / 2 + BOOT_H; // repère local à `shin`, haut de la botte
    bootsMesh.position.y = -SHIN_H / 2 + BOOT_H / 2;
    bootsMesh.visible = false;
    shin.add(bootsMesh);

    // jambières (suite) : la cuisse s'arrête au genou, mais le mollet
    // continuait à nu jusqu'aux bottes -- retour utilisateur "les jambières
    // doivent aller jusqu'au niveau des bottes". On ajoute donc un second
    // morceau, attaché à `shin` (pas à `thigh`) pour qu'il suive la bonne
    // rotation quand le genou plie (accroupi) plutôt que de se détacher
    // visuellement de la jambe -- il comble tout l'espace entre le genou et
    // le haut de la botte, avec un léger chevauchement des deux côtés pour
    // qu'aucune jointure ne soit visible.
    const shinLeggingsTop = SHIN_H / 2 + 0.03; // chevauche la jambière de cuisse, sous le genou
    const shinLeggingsBottom = bootTop - 0.02; // chevauche le haut de la botte
    const shinLeggingsMesh = new THREE.Mesh(
      new THREE.BoxGeometry(0.23, shinLeggingsTop - shinLeggingsBottom, 0.23),
      armorMats.iron,
    );
    shinLeggingsMesh.position.y = (shinLeggingsTop + shinLeggingsBottom) / 2;
    shinLeggingsMesh.visible = false;
    shin.add(shinLeggingsMesh);

    return { leggingsMesh, shinLeggingsMesh, bootsMesh };
  });

  function applyPiece(mesh, material) {
    if (material && armorMats[material]) {
      mesh.visible = true;
      mesh.material = armorMats[material];
    } else {
      mesh.visible = false;
    }
  }

  // Variante pour le casque (plusieurs meshes à mettre à jour ensemble) : la
  // visibilité se pilote sur le groupe, le matériau sur chaque morceau.
  function applyGroupPiece(group, pieces, material) {
    if (material && armorMats[material]) {
      group.visible = true;
      pieces.forEach((mesh) => (mesh.material = armorMats[material]));
    } else {
      group.visible = false;
    }
  }

  // `visual` : { helmet, chest, legs, feet } où chaque valeur est
  // 'iron' | 'gold' | 'diamond' | null|undefined (rien d'équipé sur ce slot).
  function setArmor(visual = {}) {
    applyGroupPiece(helmetGroup, helmetPieces, visual.helmet);
    applyGroupPiece(chestGroup, chestPieces, visual.chest);
    legArmor.forEach(({ leggingsMesh, shinLeggingsMesh, bootsMesh }) => {
      applyPiece(leggingsMesh, visual.legs);
      applyPiece(shinLeggingsMesh, visual.legs);
      applyPiece(bootsMesh, visual.feet);
    });
  }

  return { group, legs, arms, body, head, restY, setArmor };
}
