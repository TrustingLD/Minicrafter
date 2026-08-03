// État du joueur, avatar 3e personne (F5), main + objet tenu en 1ère personne.

import * as THREE from 'three';
import { makeLimb } from './limb.js';
import { texMobSkin } from '../render/textures.js';

export function createPlayer({
  scene,
  camera,
  materials,
  blockTypes,
  toolTextures,
  collidesAtBox,
  instancedMeshList,
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
      return new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.32, 0.32), materials[type]);
    }
    const iconTex = toolTextures[type];
    if (iconTex) {
      const m = new THREE.MeshLambertMaterial({
        map: iconTex,
        transparent: true,
        side: THREE.DoubleSide,
      });
      return new THREE.Mesh(new THREE.PlaneGeometry(0.55, 0.55), m);
    }
    return null;
  }
  let heldItemMesh = null;
  function refreshHeldItem(selectedBlock) {
    if (heldItemMesh) {
      handPivot.remove(heldItemMesh);
      heldItemMesh = null;
    }
    const mesh = buildHeldItemMesh(selectedBlock);
    if (mesh) {
      mesh.position.set(0, 0.08, -0.32);
      mesh.rotation.set(0.2, 0.6, 0.1);
      handPivot.add(mesh);
      heldItemMesh = mesh;
    }
  }

  // bascule 1ère / 3e personne (touche F5)
  let thirdPerson = false;
  const thirdPersonDistance = 4.5;
  const camForward = new THREE.Vector3();
  const camRayOrigin = new THREE.Vector3();
  const cameraRaycaster = new THREE.Raycaster();
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
      cameraRaycaster.set(eyePos, camForward.clone().negate());
      cameraRaycaster.far = thirdPersonDistance;
      const hits = cameraRaycaster.intersectObjects(instancedMeshList);
      if (hits.length > 0) dist = Math.max(0.6, hits[0].distance - 0.3);
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
