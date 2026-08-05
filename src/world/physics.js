// Résolution de mouvement du joueur (Phase 22) : extrait de main.js, qui ne faisait
// plus que grossir. PURE — aucun import, juste des fonctions données un `player`
// ({ pos, velY, onGround, radius, height, speed, jumpForce }) et un `collidesAtBox`
// injecté (world/world.js en vrai, un faux prévisible dans les tests). Mute `player`
// en place plutôt que de retourner un nouvel objet : main.js garde LE même player
// depuis sa création (caméra, avatar 3e personne... y pointent tous).

const GRAVITY = 20;

// dx/dz : axes d'intention -1..1 (pas forcément normalisés — normalisé ici).
// yaw : direction caméra. Ne bouge PAS si dx=dz=0 (rien à normaliser).
export function resolveHorizontalMove(player, dx, dz, yaw, speed, dt, crouching, collidesAtBox) {
  if (dx === 0 && dz === 0) return;
  const len = Math.hypot(dx, dz);
  const ndx = dx / len,
    ndz = dz / len;
  const moveX = (ndz * Math.sin(yaw) + ndx * Math.cos(yaw)) * speed * dt;
  const moveZ = (ndz * Math.cos(yaw) - ndx * Math.sin(yaw)) * speed * dt;
  const collidesAt = (x, z) => collidesAtBox(x, player.pos.y, z, player.radius, player.height);
  // accroupi : n'avance que si le sol continue sous les pieds (empêche de marcher
  // dans le vide en étant accroupi, contrairement à la marche normale qui laisse tomber)
  const canStand = (x, z) =>
    !crouching || !player.onGround || collidesAtBox(x, player.pos.y - 0.1, z, player.radius, 0.15);
  const nx = player.pos.x + moveX;
  if (!collidesAt(nx, player.pos.z) && canStand(nx, player.pos.z)) player.pos.x = nx;
  const nz = player.pos.z + moveZ;
  if (!collidesAt(player.pos.x, nz) && canStand(player.pos.x, nz)) player.pos.z = nz;
}

// gravité + collision verticale normale (hors vol). Retourne { landed, fallDistance } :
// `landed` est true uniquement sur la frame où le joueur touche le sol pour la
// première fois (pour jouer le son d'atterrissage une seule fois, pas à chaque
// frame au sol). `fallDistance` (blocs) n'est renseigné que sur cette même frame :
// c'est le cumul de la descente depuis le dernier moment où les pieds touchaient le
// sol (la montée d'un saut n'y contribue pas, seule la chute compte, comme dans
// Minecraft) -- sert à calculer les dégâts de chute côté appelant.
// `gravityScale` (Phase 16, nage) : < 1 flotte, la même fonction sert donc aussi de
// "gravité sous l'eau" sans dupliquer la résolution de collision.
export function resolveVerticalPhysics(player, dt, collidesAtBox, gravityScale = 1) {
  const collidesAt = (y) =>
    collidesAtBox(player.pos.x, y, player.pos.z, player.radius, player.height);
  const wasOnGround = player.onGround;
  player.velY -= GRAVITY * gravityScale * dt;
  const newY = player.pos.y + player.velY * dt;
  if (player.velY < 0) {
    if (collidesAt(newY)) {
      player.velY = 0;
      player.onGround = true;
    } else {
      player.fallDistance = (player.fallDistance || 0) + (player.pos.y - newY);
      player.pos.y = newY;
      player.onGround = false;
    }
  } else if (!collidesAt(newY)) {
    player.pos.y = newY;
  } else {
    player.velY = 0;
  }
  const landed = !wasOnGround && player.onGround;
  let fallDistance = 0;
  if (landed) {
    fallDistance = player.fallDistance || 0;
    player.fallDistance = 0;
  }
  return { landed, fallDistance };
}

// true si le saut a effectivement eu lieu (au sol au moment de l'appel)
export function tryJump(player) {
  if (!player.onGround) return false;
  player.velY = player.jumpForce;
  player.onGround = false;
  return true;
}

// /fly (Phase 15) : pas de gravité, verticalInput -1..1 (Maj/Espace) déplace
// librement, toujours bloqué par collidesAtBox comme le reste.
export function resolveFlyingVertical(player, dt, verticalInput, collidesAtBox) {
  player.velY = 0;
  player.onGround = false;
  if (verticalInput === 0) return;
  const newY = player.pos.y + verticalInput * player.speed * dt;
  if (!collidesAtBox(player.pos.x, newY, player.pos.z, player.radius, player.height))
    player.pos.y = newY;
}
