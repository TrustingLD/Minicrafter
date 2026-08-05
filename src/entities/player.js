// État du joueur, avatar 3e personne (F5), main + objet tenu en 1ère personne.

import * as THREE from 'three';
import { makeLimb } from './limb.js';
import { texMobSkin } from '../render/textures.js';
import { voxelRaycast } from '../core/raycast.js';

export function createPlayer({
  scene,
  camera,
  materials,
  blockTypes,
  toolTextures,
  collidesAtBox,
  getBlock,
  spawnPos,
}) {
  const player = {
    pos: spawnPos.clone(),
    velY: 0,
    onGround: false,
    height: 1.7,
    radius: 0.3,
    speed: 5.5,
    jumpForce: 7,
    health: 20,
    hunger: 20, // Phase 11 : sur 20, comme la vie
    breath: 15, // secondes d'air restantes sous l'eau
    maxBreath: 15,
    flying: false, // /fly (Phase 15) : gravité coupée, Espace/Maj montent/descendent
  };
  camera.position.copy(player.pos);

  const tPlayerSkin = texMobSkin('#f9b87e', '#dd8e53');
  const tPlayerShirt = texMobSkin('#2068b4', '#16467a');
  const tPlayerPants = texMobSkin('#353537', '#19191b');
  const playerSkinMat = new THREE.MeshLambertMaterial({ map: tPlayerSkin });
  const playerShirtMat = new THREE.MeshLambertMaterial({ map: tPlayerShirt });
  const playerPantsMat = new THREE.MeshLambertMaterial({ map: tPlayerPants });

  // avatar visible uniquement à la 3e personne (F5) - construit comme les mobs, avec des pivots articulés
  function buildPlayerAvatar() {
    const group = new THREE.Group();
    const legs = [],
      arms = [];

    const body = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.75, 0.28), playerShirtMat);
    body.position.y = 1.15;
    body.castShadow = true;
    group.add(body);

    const head = new THREE.Mesh(new THREE.BoxGeometry(0.45, 0.45, 0.45), playerSkinMat);
    head.position.y = 1.775;
    head.castShadow = true;
    group.add(head);

    [
      [-0.34, 1.5],
      [0.34, 1.5],
    ].forEach(([ax, ay]) => {
      const { pivot } = makeLimb(0.16, 0.7, 0.16, playerSkinMat, ax, ay, 0);
      group.add(pivot);
      arms.push(pivot);
    });
    [
      [-0.13, 0.775],
      [0.13, 0.775],
    ].forEach(([lx, ly]) => {
      const { pivot } = makeLimb(0.18, 0.775, 0.18, playerPantsMat, lx, ly, 0);
      group.add(pivot);
      legs.push(pivot);
    });

    return { group, legs, arms };
  }
  const playerAvatar = buildPlayerAvatar();
  playerAvatar.group.visible = false;
  scene.add(playerAvatar.group);

  // main + objet tenu, attachés à la caméra (vue 1ère personne uniquement)
  const handPivot = new THREE.Group();
  handPivot.position.set(0.45, -0.5, -0.65);
  handPivot.rotation.set(0.55, -0.1, -0.2);
  camera.add(handPivot);
  const handMesh = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.45, 0.18), playerSkinMat);
  handMesh.position.y = -0.22;
  handPivot.add(handMesh);

  function buildHeldItemMesh(type) {
    if (blockTypes[type]) {
      return { mesh: new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.32, 0.32), materials[type]) };
    }
    const iconTex = toolTextures[type];
    if (iconTex) {
      // MeshBasic et non Lambert : le sprite est un plan sans volume, son unique
      // normale pointait souvent à l'opposé du soleil et l'outil virait au noir selon
      // l'orientation de la caméra. Non éclairé, il reste lisible partout.
      const m = new THREE.MeshBasicMaterial({
        map: iconTex,
        transparent: true,
        alphaTest: 0.5, // pixel-art : un texel est opaque ou absent, jamais à moitié
        side: THREE.DoubleSide,
      });
      return { mesh: new THREE.Mesh(new THREE.PlaneGeometry(0.62, 0.62), m), flat: true };
    }
    return null;
  }

  // La main est posée dans le repère de la caméra avec une rotation de repos
  // (HAND_REST) qui l'incline vers l'intérieur de l'écran. Un CUBE tenu s'en
  // accommode — il a du volume, il est lisible sous n'importe quel angle. Un sprite
  // plat, lui, se retrouvait vu presque par la tranche : d'où des épées/pioches/haches
  // réduites à une lamelle. `flatHolder` annule la pose de repos de la main, puis
  // incline l'outil de 45° dans le plan de l'écran — le manche pointe vers le bas à
  // droite, la tête vers le haut à gauche, comme un outil vraiment tenu. Les
  // animations (swing, balancier de marche) restent portées par handPivot, donc
  // l'outil bouge toujours avec la main.
  const HAND_REST = new THREE.Euler(0.55, -0.1, -0.2);
  const flatHolder = new THREE.Group();
  flatHolder.quaternion.setFromEuler(HAND_REST).invert();
  handPivot.add(flatHolder);

  let heldItemMesh = null;
  let heldItemParent = null;
  function refreshHeldItem(selectedBlock) {
    if (heldItemMesh) {
      heldItemParent.remove(heldItemMesh);
      heldItemMesh = null;
      heldItemParent = null;
    }
    const built = buildHeldItemMesh(selectedBlock);
    if (built) {
      const { mesh, flat } = built;
      if (flat) {
        mesh.position.set(0.12, 0.06, -0.52);
        mesh.rotation.set(0, 0, Math.PI / 4);
        heldItemParent = flatHolder;
      } else {
        mesh.position.set(0, 0.08, -0.32);
        mesh.rotation.set(0.2, 0.6, 0.1);
        heldItemParent = handPivot;
      }
      heldItemParent.add(mesh);
      heldItemMesh = mesh;
    }
  }

  // bascule 1ère / 3e personne (touche F5)
  let thirdPerson = false;
  const thirdPersonDistance = 4.5;
  const camForward = new THREE.Vector3();
  const camRayOrigin = new THREE.Vector3();
  function toggleThirdPerson() {
    thirdPerson = !thirdPerson;
    playerAvatar.group.visible = thirdPerson;
    handPivot.visible = !thirdPerson;
  }

  // animation : swing de la main (casser/attaquer) et balancier de marche (main + avatar)
  let handSwing = 0; // 0 = repos, monte vers 1 puis redescend quand on clique
  let walkPhasePlayer = 0;
  function triggerHandSwing() {
    handSwing = 1;
    playerAvatar._swing = 1;
  }

  function updateVisuals(dt, isMoving, yaw, pitch) {
    // -- swing (casser/attaquer) --
    if (handSwing > 0) handSwing = Math.max(0, handSwing - dt * 4.5);
    const swingOffset = Math.sin(handSwing * Math.PI) * 0.9;

    // -- balancier de marche (bras/jambes) --
    if (isMoving && player.onGround) walkPhasePlayer += dt * (player.speed / 5.5) * 8;
    else walkPhasePlayer *= 1 - Math.min(1, dt * 6);
    const walkSwing = Math.sin(walkPhasePlayer) * 0.55;

    // main FPS : pose de repos + swing + léger bob de marche
    handPivot.rotation.x =
      0.55 -
      swingOffset * 0.9 +
      (isMoving && player.onGround ? Math.sin(walkPhasePlayer * 2) * 0.03 : 0);
    handPivot.rotation.y = -0.1 - swingOffset * 0.5;
    handPivot.position.y =
      -0.5 + (isMoving && player.onGround ? Math.abs(Math.sin(walkPhasePlayer)) * 0.025 : 0);

    // avatar 3e personne : jambes toujours animées, bras aussi (sauf pendant un swing d'attaque)
    playerAvatar.legs.forEach((pivot, i) => {
      pivot.rotation.x = i % 2 === 0 ? walkSwing : -walkSwing;
    });
    playerAvatar.arms.forEach((pivot, i) => {
      pivot.rotation.x = (i % 2 === 0 ? -walkSwing : walkSwing) * 0.6;
    });
    playerAvatar.group.position.set(player.pos.x, player.pos.y, player.pos.z);
    playerAvatar.group.rotation.y = yaw;

    if (thirdPerson) {
      const eyePos = camRayOrigin.set(player.pos.x, player.pos.y + player.height, player.pos.z);
      camForward.set(0, 0, -1).applyEuler(new THREE.Euler(pitch, yaw, 0, 'YXZ'));
      let dist = thirdPersonDistance;
      // DDA voxel plutôt qu'un raycast triangle contre tous les meshes de chunks :
      // même correctif que celui déjà appliqué au viseur bloc (cf. core/raycast.js).
      const back = camForward.clone().negate();
      const hit = voxelRaycast(getBlock, eyePos, back, thirdPersonDistance);
      if (hit) dist = Math.max(0.6, hit.dist - 0.3);
      const camPos = eyePos.clone().addScaledVector(camForward, -dist);
      camera.position.copy(camPos);
    } else {
      camera.position.set(player.pos.x, player.pos.y + player.height, player.pos.z);
    }
  }

  function collidesAt(x, y, z) {
    return collidesAtBox(x, y, z, player.radius, player.height);
  }

  function respawn(spawnAt) {
    player.pos.copy(spawnAt);
    player.velY = 0;
    player.health = 20;
    player.hunger = 20;
    player.breath = player.maxBreath;
    player.fallDistance = 0;
  }

  return {
    player,
    playerAvatar,
    handPivot,
    refreshHeldItem,
    toggleThirdPerson,
    triggerHandSwing,
    updateVisuals,
    collidesAt,
    respawn,
    get thirdPerson() {
      return thirdPerson;
    },
  };
}
