// État du joueur, avatar 3e personne (F5), main + objet tenu en 1ère personne.

import * as THREE from 'three';
import { voxelRaycast } from '../core/raycast.js';
import { createPlayerMaterials, createArmorMaterials, buildPlayerAvatar } from './player-model.js';
import { texFireOverlay } from '../render/textures.js';

export function createPlayer({
  scene,
  camera,
  materials,
  blockTypes,
  toolTextures,
  stairsGeometry,
  stairsMaterials,
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
    maxHealth: 20,
    // Pomme dorée : coeurs bonus temporaires (jaunes), ajoutés à maxHealth
    // pendant bonusHealthTimer secondes (cf. tryEat() dans main.js) puis
    // retirés -- même principe que l'absorption de Minecraft, en plus simple
    // (pas de pool séparé : on augmente/rabaisse maxHealth directement).
    bonusHealth: 0,
    bonusHealthTimer: 0,
    hunger: 20, // Phase 11 : sur 20, comme la vie
    breath: 15, // secondes d'air restantes sous l'eau
    maxBreath: 15,
    flying: false, // /fly (Phase 15) : gravité coupée, Espace/Maj montent/descendent
    flySpeedMultiplier: 1, // /speedfly : multiplie player.speed, mais seulement pendant le vol
    // Knockback (coup de zombie, cf. world/physics.js applyPlayerKnockback/
    // resolveKnockback et entities/mob.js) : vitesse horizontale constante
    // appliquée pendant knockbackTimer secondes, puis retombe à 0.
    knockbackTimer: 0,
    knockbackVX: 0,
    knockbackVZ: 0,
    // Sortie de lave (Phase burn, cf. main.js) : secondes de combustion restantes.
    // Se réarme en continu tant qu'on reste dans la lave, décompte une fois sorti
    // -- cf. la boucle principale (main.js) qui pilote ce timer et applique les
    // dégâts au tic ; ici on ne fait que déclarer le champ et gérer le VISUEL
    // (cf. setOnFire plus bas).
    fireTimer: 0,
  };
  camera.position.copy(player.pos);

  // Matériaux du modèle 3D (corps + armure) : construits UNE fois ici et
  // réutilisés tels quels pour l'aperçu de l'inventaire (cf. buildAvatar plus
  // bas et ui/char-preview.js) -- garantit que l'avatar en jeu et celui de
  // l'inventaire sont, au sens propre, LE MÊME modèle.
  const playerMats = createPlayerMaterials();
  const armorMats = createArmorMaterials();
  const playerSkinMat = playerMats.skinMat; // réutilisé plus bas pour le poing (handMesh)

  // avatar visible uniquement à la 3e personne (F5) - construit comme les mobs, avec des pivots articulés
  const playerAvatar = buildPlayerAvatar(playerMats, armorMats);
  playerAvatar.group.visible = false;
  scene.add(playerAvatar.group);

  // Overlay "en feu" (même technique que les mobs, cf. entities/mob.js
  // buildFireOverlay) : deux plans texturés en croix, ajoutés à l'avatar 3e
  // personne pour rester visible dans cette vue -- caché par défaut, affiché
  // par setOnFire() tant que player.fireTimer > 0 (piloté depuis main.js).
  // Texture propre au joueur (pas partagée avec mobAssets.fireOverlay) : son
  // offset défile indépendamment dans updateVisuals(), plus simple que de
  // faire transiter la texture des mobs jusqu'ici.
  const fireTexture = texFireOverlay();
  const fireOverlay = (() => {
    const w = player.radius * 2 * 1.5;
    const h = player.height * 1.15;
    const geo = new THREE.PlaneGeometry(w, h);
    const mat = new THREE.MeshBasicMaterial({
      map: fireTexture,
      transparent: true,
      depthWrite: false,
      side: THREE.DoubleSide,
    });
    const planeA = new THREE.Mesh(geo, mat);
    const planeB = new THREE.Mesh(geo, mat);
    planeB.rotation.y = Math.PI / 2;
    const group = new THREE.Group();
    group.position.y = h / 2;
    group.add(planeA, planeB);
    group.visible = false;
    return group;
  })();
  playerAvatar.group.add(fireOverlay);
  let onFire = false;
  function setOnFire(on) {
    onFire = on;
    fireOverlay.visible = on;
  }

  // fabrique un second avatar INDÉPENDANT (mesh/group propres, donc utilisable
  // dans une autre scène simultanément) mais partageant les mêmes matériaux --
  // c'est ce que ui/char-preview.js appelle pour peupler l'aperçu 3D du
  // panneau d'inventaire avec littéralement le même modèle.
  function buildAvatar() {
    return buildPlayerAvatar(playerMats, armorMats);
  }

  // reflète l'armure équipée (armorSlots + data/items.js ARMOR_ITEMS, résolus
  // côté main.js) sur l'avatar en jeu -- cf. setArmor dans player-model.js
  // pour le format attendu de `visual`.
  function setArmor(visual) {
    playerAvatar.setArmor(visual);
  }

  // main + objet tenu, attachés à la caméra (vue 1ère personne uniquement)
  const handPivot = new THREE.Group();
  handPivot.position.set(0.45, -0.5, -0.65);
  handPivot.rotation.set(0.55, -0.1, -0.2);
  camera.add(handPivot);
  const handMesh = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.45, 0.18), playerSkinMat);
  handMesh.position.y = -0.22;
  handPivot.add(handMesh);

  function buildHeldItemMesh(type) {
    // escaliers : vraie géométrie en L (cf. render/block-assets.js
    // buildStairsGeometry), échelle réduite comme le cube ci-dessous (0.26) --
    // AVANT tout autre check, sinon `materials[type]` (qui existe aussi pour ces
    // items, pour les particules de cassage/le fallback du drop) ferait passer
    // par le cube plein générique à la place.
    if (stairsMaterials[type]) {
      const mesh = new THREE.Mesh(stairsGeometry, stairsMaterials[type]);
      mesh.scale.setScalar(0.26);
      return { mesh };
    }
    // `materials[type]` (pas `blockTypes[type]`) est la vraie condition "cet item
    // a un aperçu cube plein" -- couvre les blocs normaux ET les items "virtuels"
    // qui posent un bloc différent d'eux-mêmes (bed, stairs_wood/stairs_stone,
    // cf. data/items.js NON_PLACEABLE) : `blockTypes[type]` (= BLOCK_TYPES[type])
    // est undefined pour ceux-là puisqu'ils ne sont volontairement PAS des clés
    // de BLOCK_TYPES, donc l'ancienne condition les laissait sans rien en main.
    if (materials[type]) {
      return { mesh: new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.26, 0.26), materials[type]) };
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
      // handMesh (le poing) est centré en (0, -0.22, 0) avec un rayon de 0.09 sur
      // x/y/z (cf. plus haut) : le point de préhension doit donc rester proche de
      // z≈0, pas s'en éloigner. Avant, les objets étaient posés à z=-0.32/-0.52,
      // bien au-delà du poing (qui s'arrête à z=-0.09) : ils flottaient devant la
      // main plutôt que d'être tenus dedans.
      if (flat) {
        mesh.position.set(0.1, 0.03, -0.18);
        mesh.rotation.set(0, 0, Math.PI / 4);
        heldItemParent = flatHolder;
      } else {
        mesh.position.set(0, 0.02, -0.06);
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
  // Genou plié : la cuisse pivote vers l'avant (hanche) et le tibia replie vers
  // l'arrière (genou, angle plus grand que la hanche pour que le pied ne parte
  // pas trop loin vers l'avant) -- un vrai pli articulé plutôt qu'une jambe
  // raide tournée d'un bloc (l'ancien CROUCH_LEG_BEND).
  const CROUCH_HIP_BEND = 0.6;
  const CROUCH_KNEE_BEND = 1.1;
  const CROUCH_LERP_SPEED = 10; // /s -- assez rapide pour rester réactif à la touche Maj
  function triggerHandSwing() {
    handSwing = 1;
    playerAvatar._swing = 1;
  }

  function updateVisuals(dt, isMoving, yaw, pitch, crouching) {
    // Flammes (cf. setOnFire) : offset animé seulement quand visible -- inutile de
    // faire défiler une texture qui ne s'affiche pas.
    if (onFire) fireTexture.offset.y = (fireTexture.offset.y + dt * 1.3) % 1;

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
    playerAvatar.legs.forEach(({ hip, knee }, i) => {
      const bend = i % 2 === 0 ? walkSwing : -walkSwing;
      // Le point tourné (genou/pied) est SOUS le pivot (hanche), pas au-dessus comme
      // pour le buste : sur un pivot dont le contenu pend en dessous, une rotation
      // POSITIVE amène ce contenu vers l'avant (-z, cf. commentaire buste plus bas).
      // J'avais inversé ça dans la version précédente -- la cuisse partait donc en
      // arrière au lieu d'avancer. Le genou compense en NÉGATIF (dans le repère déjà
      // tourné de la hanche) pour replier le tibia sous le corps, comme un vrai pli.
      hip.rotation.x = bend + crouchAmount * CROUCH_HIP_BEND;
      knee.rotation.x = -crouchAmount * CROUCH_KNEE_BEND;
    });
    playerAvatar.arms.forEach((pivot, i) => {
      // Contrairement au buste (qui part en avant), les bras doivent partir vers
      // l'ARRIÈRE en s'accroupissant. La main pend sous le pivot épaule (comme la
      // cuisse sous la hanche) : une rotation NÉGATIVE l'envoie donc vers l'arrière.
      pivot.rotation.x = (i % 2 === 0 ? -walkSwing : walkSwing) * 0.6 - crouchAmount * CROUCH_LEAN;
      // épaule qui suit le buste vers le bas (cf. commentaire sur restY.arm plus
      // haut) : sans ça les bras restaient au niveau du cou pendant que le reste
      // du corps s'accroupissait dessous.
      pivot.position.y = playerAvatar.restY.arm - crouchAmount * CROUCH_LOWER;
    });
    // buste + tête : s'abaissent et se penchent en AVANT (rotation.x négative,
    // cf. note ci-dessus sur le sens de rotation) -- c'est ce qui rend
    // l'accroupissement "visible" en 3e personne, pas juste une hitbox plus basse
    playerAvatar.body.position.y = playerAvatar.restY.body - crouchAmount * CROUCH_LOWER;
    playerAvatar.body.rotation.x = -crouchAmount * CROUCH_LEAN;
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
    // la mort dissipe le bonus de la pomme dorée, comme dans Minecraft
    player.maxHealth = 20;
    player.bonusHealth = 0;
    player.bonusHealthTimer = 0;
    player.health = 20;
    player.hunger = 20;
    player.breath = player.maxBreath;
    player.fallDistance = 0;
    player.fireTimer = 0;
    setOnFire(false);
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
    setArmor,
    buildAvatar,
    setOnFire,
    get thirdPerson() {
      return viewMode !== VIEW_FIRST;
    },
    get viewMode() {
      return viewMode;
    },
  };
}
