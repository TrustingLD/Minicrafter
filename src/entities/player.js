// État du joueur, avatar 3e personne (F5), main + objet tenu en 1ère personne.

import * as THREE from 'three';
import { makeLimb } from './limb.js';
import { texMobSkin, texPlayerFace } from '../render/textures.js';
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
    flySpeedMultiplier: 1, // /speedfly : multiplie player.speed, mais seulement pendant le vol
  };
  camera.position.copy(player.pos);

  const tPlayerSkin = texMobSkin('#f9b87e', '#dd8e53');
  const tPlayerShirt = texMobSkin('#2068b4', '#16467a');
  const tPlayerPants = texMobSkin('#353537', '#19191b');
  const playerSkinMat = new THREE.MeshLambertMaterial({ map: tPlayerSkin });
  const playerShirtMat = new THREE.MeshLambertMaterial({ map: tPlayerShirt });
  const playerPantsMat = new THREE.MeshLambertMaterial({ map: tPlayerPants });
  const playerFaceMat = new THREE.MeshLambertMaterial({ map: texPlayerFace() });
  // ordre des matériaux d'un BoxGeometry : [+x, -x, +y, -y, +z, -z]. L'avatar tourne
  // avec `yaw` (cf. updateVisuals) selon la même convention que camForward -- à yaw=0
  // le joueur regarde vers -z monde, donc c'est la face locale -z (index 5) qui pointe
  // dans la direction visée. En vue selfie (F5 x2) la caméra est placée devant le
  // joueur dans cette même direction et retournée vers lui : la face -z, donc le
  // visage, se retrouve naturellement face à la caméra, quel que soit le yaw.
  const headMaterials = [
    playerSkinMat,
    playerSkinMat,
    playerSkinMat,
    playerSkinMat,
    playerSkinMat,
    playerFaceMat,
  ];

  // avatar visible uniquement à la 3e personne (F5) - construit comme les mobs, avec des pivots articulés
  function buildPlayerAvatar() {
    const group = new THREE.Group();
    const legs = [],
      arms = [];

    const body = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.75, 0.28), playerShirtMat);
    body.position.y = 1.15;
    body.castShadow = true;
    group.add(body);

    const head = new THREE.Mesh(new THREE.BoxGeometry(0.45, 0.45, 0.45), headMaterials);
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

    // positions "debout" de repos, pour pouvoir revenir dessus en s'accroupissant
    // (cf. crouchAmount dans updateVisuals) sans les re-calculer à chaque frame
    const restY = { body: body.position.y, head: head.position.y };

    return { group, legs, arms, body, head, restY };
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

  // bascule de vue (touche F5) : 1ère personne -> 3e personne (dos) -> vue de
  // face "selfie" (6 blocs devant, caméra tournée vers le joueur) -> 1ère personne
  const VIEW_FIRST = 0;
  const VIEW_THIRD = 1;
  const VIEW_SELFIE = 2;
  let viewMode = VIEW_FIRST;
  const thirdPersonDistance = 4.5;
  const selfieDistance = 6;
  const camForward = new THREE.Vector3();
  const camRayOrigin = new THREE.Vector3();
  function toggleThirdPerson() {
    viewMode = (viewMode + 1) % 3;
    // avatar visible dès qu'on quitte la 1ère personne (3e personne ET selfie)
    playerAvatar.group.visible = viewMode !== VIEW_FIRST;
    handPivot.visible = viewMode === VIEW_FIRST;
  }

  // animation : swing de la main (casser/attaquer) et balancier de marche (main + avatar)
  let handSwing = 0; // 0 = repos, monte vers 1 puis redescend quand on clique
  let walkPhasePlayer = 0;
  let crouchAmount = 0; // 0 = debout, 1 = accroupi -- lissé dans le temps, cf. updateVisuals
  const CROUCH_LOWER = 0.22; // combien le buste/la tête s'abaissent, en unités monde
  const CROUCH_LEAN = 0.35; // inclinaison avant du buste (radians)
  const CROUCH_LEG_BEND = 0.55; // flexion des jambes au repos, en plus du balancier de marche
  const CROUCH_LERP_SPEED = 10; // /s -- assez rapide pour rester réactif à la touche Maj
  function triggerHandSwing() {
    handSwing = 1;
    playerAvatar._swing = 1;
  }

  function updateVisuals(dt, isMoving, yaw, pitch, crouching) {
    // -- swing (casser/attaquer) --
    if (handSwing > 0) handSwing = Math.max(0, handSwing - dt * 4.5);
    const swingOffset = Math.sin(handSwing * Math.PI) * 0.9;

    // -- balancier de marche (bras/jambes) --
    if (isMoving && player.onGround) walkPhasePlayer += dt * (player.speed / 5.5) * 8;
    else walkPhasePlayer *= 1 - Math.min(1, dt * 6);
    const walkSwing = Math.sin(walkPhasePlayer) * 0.55;

    // -- accroupi (Maj, cf. main.js) : lissage vers 0 (debout) ou 1 (accroupi) pour
    // une transition fluide plutôt qu'un pop instantané --
    const crouchTarget = crouching ? 1 : 0;
    crouchAmount += (crouchTarget - crouchAmount) * Math.min(1, dt * CROUCH_LERP_SPEED);

    // main FPS : pose de repos + swing + léger bob de marche
    handPivot.rotation.x =
      0.55 -
      swingOffset * 0.9 +
      (isMoving && player.onGround ? Math.sin(walkPhasePlayer * 2) * 0.03 : 0);
    handPivot.rotation.y = -0.1 - swingOffset * 0.5;
    handPivot.position.y =
      -0.5 +
      (isMoving && player.onGround ? Math.abs(Math.sin(walkPhasePlayer)) * 0.025 : 0) -
      crouchAmount * (CROUCH_LOWER * 0.5); // la vue FPS s'abaisse un peu aussi, plus discret que l'avatar

    // avatar 3e personne : jambes toujours animées, bras aussi (sauf pendant un swing d'attaque)
    playerAvatar.legs.forEach((pivot, i) => {
      const bend = i % 2 === 0 ? walkSwing : -walkSwing;
      pivot.rotation.x = bend + crouchAmount * CROUCH_LEG_BEND;
    });
    playerAvatar.arms.forEach((pivot, i) => {
      pivot.rotation.x = (i % 2 === 0 ? -walkSwing : walkSwing) * 0.6 - crouchAmount * 0.2;
    });
    // buste + tête : s'abaissent et se penchent en avant -- c'est ce qui rend
    // l'accroupissement "visible" en 3e personne, pas juste une hitbox plus basse
    playerAvatar.body.position.y = playerAvatar.restY.body - crouchAmount * CROUCH_LOWER;
    playerAvatar.body.rotation.x = crouchAmount * CROUCH_LEAN;
    playerAvatar.head.position.y =
      playerAvatar.restY.head - crouchAmount * (CROUCH_LOWER + Math.sin(CROUCH_LEAN) * 0.35);
    playerAvatar.group.position.set(player.pos.x, player.pos.y, player.pos.z);
    playerAvatar.group.rotation.y = yaw;
    // tangage de la tête (haut/bas) : jusqu'ici seul le lacet (yaw) du corps entier
    // orientait l'avatar, la tête restait toujours à plat. En vue selfie la caméra,
    // elle, monte/descend avec `pitch` -- sans ce tangage la tête ne "suivait" donc
    // la caméra qu'à gauche/droite, jamais quand on regarde vers le haut ou le bas.
    // rotation.x est dans le repère local du groupe (déjà tourné en yaw), donc ceci
    // s'ajoute au lacet plutôt que de le remplacer.
    playerAvatar.head.rotation.x = pitch;

    if (viewMode === VIEW_THIRD) {
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
    } else if (viewMode === VIEW_SELFIE) {
      // vue "selfie" : caméra placée 6 blocs DEVANT le joueur (dans la direction
      // visée), mais tournée pour regarder VERS le joueur -- comme une perche à
      // selfie. On raycast vers l'avant pour ne pas passer à travers un mur.
      const eyePos = camRayOrigin.set(player.pos.x, player.pos.y + player.height, player.pos.z);
      camForward.set(0, 0, -1).applyEuler(new THREE.Euler(pitch, yaw, 0, 'YXZ'));
      let dist = selfieDistance;
      const hit = voxelRaycast(getBlock, eyePos, camForward, selfieDistance);
      if (hit) dist = Math.max(0.6, hit.dist - 0.3);
      const camPos = eyePos.clone().addScaledVector(camForward, dist);
      camera.position.copy(camPos);
      // face le joueur : demi-tour par rapport au regard, tangage inversé
      camera.rotation.y = yaw + Math.PI;
      camera.rotation.x = -pitch;
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
      return viewMode !== VIEW_FIRST;
    },
    get viewMode() {
      return viewMode;
    },
  };
}
