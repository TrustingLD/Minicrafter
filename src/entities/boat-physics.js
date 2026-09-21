// Physique du bateau (Phase 36) : PURE -- aucun import, aucune dépendance à Three.js
// ni au DOM, donc testable sous `node --test` (cf. test/boat.test.js), exactement
// comme world/physics.js pour le joueur. Le rendu, la souris et l'inventaire vivent
// dans entities/boat.js et main.js ; ici il n'y a que l'état d'un bateau et la
// règle qui le fait avancer d'UN tic.
//
// Les règles sont celles du vrai jeu (Boat.java, Minecraft Java) : mêmes constantes,
// même ordre des opérations, tic fixe de 20 Hz. C'est ce qui donne le « toucher »
// d'un bateau (dérive, virage qui ralentit, quasi immobile à terre, patinoire sur
// la glace...) plutôt qu'une approximation « avance à vitesse constante ».
//
// Unités : blocs et TICS (1 tic = 1/20 s), comme le vrai jeu -- vitesse en blocs/tic,
// rotation en degrés/tic (deltaRotation). Un bateau a `y` = le BAS de sa boîte de
// collision (comme player.pos.y = les pieds), `x`/`z` = son centre.
//
// Convention d'angle (celle du joueur, cf. main.js : yaw += vers la gauche, l'avant
// est (-sin yaw, -cos yaw)) : virer à GAUCHE augmente le yaw, à droite le diminue.

export const TICK_SECONDS = 1 / 20;

// boîte de collision : 1,375 x 0,5625 x 1,375, comme le vrai jeu
export const BOAT_RADIUS = 1.375 / 2;
export const BOAT_HEIGHT = 0.5625;

export const BoatStatus = Object.freeze({
  IN_WATER: 'in_water',
  UNDER_WATER: 'under_water',
  IN_AIR: 'in_air',
  ON_LAND: 'on_land',
});

// La surface d'une colonne d'eau est dessinée 0.875 au lieu de 1 (cf.
// render/mesher.js meshLiquid) : la même valeur sert de « hauteur du fluide » ici,
// sinon le bateau flotterait à côté de la surface qu'on voit à l'écran.
export const WATER_SURFACE = 0.875;

const GRAVITY = 0.04; // blocs/tic² (vitesse verticale -= 0.04 par tic)
const BUOYANCY_GAIN = 0.06153846016296973;
const DEG = Math.PI / 180;

// Adhérence du sol (« slipperiness » du vrai jeu) : 0.6 partout, la glace glisse.
// Seul cet écart existe dans ce moteur (pas de glace bleue, ni de slime).
const DEFAULT_FRICTION = 0.6;
const FRICTION_BY_BLOCK = { ice: 0.98 };

export function createBoatState(x, y, z, yaw = 0) {
  return {
    x,
    y,
    z,
    yaw,
    vx: 0,
    vy: 0,
    vz: 0,
    deltaRotation: 0, // degrés/tic, s'amortit comme la vitesse
    // null au départ (comme le vrai jeu) : un bateau posé DANS l'eau n'a pas « atterri »
    // depuis les airs, il ne doit pas être téléporté à la surface au 1er tic
    status: null,
    oldStatus: null,
    waterLevel: -Infinity,
    landFriction: DEFAULT_FRICTION,
    fallDistance: 0,
    outOfControlTicks: 0, // tics passés entièrement sous l'eau -> éjecte le passager à 60
    paddleLeft: false, // pagaies actives ce tic (animation, cf. boat.js)
    paddleRight: false,
    onGround: false,
  };
}

/* ---------- Lecture du monde ---------- */
// `env` : { getBlock(x,y,z), isSolid(x,y,z), collidesAtBox(x,y,z,radius,height) } -- exactement
// les mêmes fonctions que celles exposées par world/world.js (main.js les passe telles
// quelles). Un chunk non chargé = getBlock undefined / isSolid true (cf. world.js).

function isWaterCell(env, x, y, z) {
  return env.getBlock(x, y, z) === 'water';
}

// hauteur (0..1) de l'eau dans la case : 0 = pas d'eau, 1 = pleine (de l'eau juste
// au-dessus), WATER_SURFACE = la case du dessus d'une colonne (la surface visible).
export function waterFraction(env, x, y, z) {
  if (!isWaterCell(env, x, y, z)) return 0;
  return isWaterCell(env, x, y + 1, z) ? 1 : WATER_SURFACE;
}

function frictionAt(env, x, y, z) {
  return FRICTION_BY_BLOCK[env.getBlock(x, y, z)] ?? DEFAULT_FRICTION;
}

// cases dont la colonne (x,z) recoupe la boîte du bateau : [floor(minX), ceil(maxX))
function footprint(b) {
  return {
    x0: Math.floor(b.x - BOAT_RADIUS),
    x1: Math.ceil(b.x + BOAT_RADIUS),
    z0: Math.floor(b.z - BOAT_RADIUS),
    z1: Math.ceil(b.z + BOAT_RADIUS),
  };
}

// Surface de l'eau juste au-dessus du bateau : on remonte couche par couche tant que
// l'eau est pleine (fraction 1), et on s'arrête à la première couche dont la surface
// est visible (getWaterLevelAbove du vrai jeu). Sert à repositionner un bateau qui
// vient de tomber dans l'eau.
function waterLevelAbove(env, b) {
  const { x0, x1, z0, z1 } = footprint(b);
  const startY = Math.floor(b.y);
  for (let cy = startY; cy < startY + 256; cy++) {
    let f = 0;
    for (let bx = x0; bx < x1; bx++)
      for (let bz = z0; bz < z1; bz++) f = Math.max(f, waterFraction(env, bx, cy, bz));
    if (f < 1) return cy + f;
  }
  return b.y + BOAT_HEIGHT;
}

// L'état du bateau CE tic (Boat.getStatus du vrai jeu). Ordre de priorité : tête sous
// l'eau > pieds dans l'eau > posé sur un sol > en l'air.
function computeStatus(env, b) {
  const { x0, x1, z0, z1 } = footprint(b);

  // 1) le HAUT de la boîte est sous la surface -> le bateau coule
  const topY = b.y + BOAT_HEIGHT;
  const topCell = Math.floor(topY);
  for (let bx = x0; bx < x1; bx++)
    for (let bz = z0; bz < z1; bz++) {
      const f = waterFraction(env, bx, topCell, bz);
      if (f > 0 && topY + 0.001 < topCell + f) {
        b.waterLevel = topY;
        return BoatStatus.UNDER_WATER;
      }
    }

  // 2) le BAS de la boîte est sous la surface -> il flotte
  const bottomCell = Math.floor(b.y);
  let level = -Infinity;
  let inWater = false;
  for (let bx = x0; bx < x1; bx++)
    for (let bz = z0; bz < z1; bz++) {
      const f = waterFraction(env, bx, bottomCell, bz);
      if (f > 0) {
        level = Math.max(level, bottomCell + f);
        if (b.y < bottomCell + f) inWater = true;
      }
    }
  if (inWater) {
    b.waterLevel = level;
    return BoatStatus.IN_WATER;
  }

  // 3) posé sur quelque chose de solide (bande de 1 mm sous la boîte) : adhérence moyenne
  const groundCell = Math.floor(b.y - 0.001);
  let sum = 0;
  let count = 0;
  for (let bx = x0; bx < x1; bx++)
    for (let bz = z0; bz < z1; bz++)
      if (env.isSolid(bx, groundCell, bz)) {
        sum += frictionAt(env, bx, groundCell, bz);
        count++;
      }
  if (count > 0) {
    b.landFriction = sum / count;
    return BoatStatus.ON_LAND;
  }
  return BoatStatus.IN_AIR;
}

/* ---------- Un tic de simulation ---------- */

function updateMotion(env, b) {
  let gravity = -GRAVITY;
  let buoyancy = 0;
  let inv = 0.05;
  if (
    b.oldStatus === BoatStatus.IN_AIR &&
    b.status !== BoatStatus.IN_AIR &&
    b.status !== BoatStatus.ON_LAND
  ) {
    // vient de tomber dans l'eau : on le pose à la surface (le haut dépasse de 10 cm)
    // plutôt que de le laisser plonger puis rebondir
    b.waterLevel = b.y + BOAT_HEIGHT;
    b.y = waterLevelAbove(env, b) - BOAT_HEIGHT + 0.101;
    b.vy = 0;
    b.status = BoatStatus.IN_WATER;
    return;
  }
  if (b.status === BoatStatus.IN_WATER) {
    buoyancy = (b.waterLevel - b.y) / BOAT_HEIGHT;
    inv = 0.9;
  } else if (b.status === BoatStatus.UNDER_WATER) {
    buoyancy = 0.01;
    inv = 0.45;
  } else if (b.status === BoatStatus.IN_AIR) {
    inv = 0.9;
  } else if (b.status === BoatStatus.ON_LAND) {
    inv = b.landFriction;
  }
  b.vx *= inv;
  b.vy += gravity;
  b.vz *= inv;
  b.deltaRotation *= inv;
  if (buoyancy > 0) b.vy = (b.vy + buoyancy * BUOYANCY_GAIN) * 0.75;
}

// input : { left, right, forward, back } (booléens) ou null si personne ne pilote
function controlBoat(b, input) {
  b.paddleLeft = false;
  b.paddleRight = false;
  if (!input) return;
  let accel = 0;
  if (input.left) b.deltaRotation += 1;
  if (input.right) b.deltaRotation -= 1;
  // tourner sans avancer pousse quand même un peu (0.005), comme les coups de pagaie
  if (input.left !== input.right && !input.forward && !input.back) accel += 0.005;
  b.yaw += b.deltaRotation * DEG;
  if (input.forward) accel += 0.04;
  if (input.back) accel -= 0.005;
  b.vx += -Math.sin(b.yaw) * accel;
  b.vz += -Math.cos(b.yaw) * accel;
  // virer à droite = la pagaie de GAUCHE rame (et inversement), avancer = les deux
  b.paddleLeft = (input.right && !input.left) || !!input.forward;
  b.paddleRight = (input.left && !input.right) || !!input.forward;
}

// déplacement avec collision, axe par axe (Y d'abord, puis X, puis Z, comme le vrai
// jeu), en sous-pas <= 0.4 bloc : à 40 blocs/s sur la glace un seul saut de 2 blocs
// traverserait un mur d'un bloc d'épaisseur. Retourne { landed } (vrai si contact sol
// vers le bas pendant ce tic).
function moveBoat(env, b) {
  const collides = (x, y, z) => env.collidesAtBox(x, y, z, BOAT_RADIUS, BOAT_HEIGHT);
  let landed = false;

  // --- vertical ---
  const startY = b.y;
  if (b.vy !== 0) {
    const n = Math.max(1, Math.ceil(Math.abs(b.vy) / 0.4));
    const step = b.vy / n;
    for (let i = 0; i < n; i++) {
      const ny = b.y + step;
      if (!collides(b.x, ny, b.z)) {
        b.y = ny;
        continue;
      }
      if (step < 0) {
        // colle exactement au-dessus du bloc rencontré (pas d'écart résiduel d'un
        // sous-pas : la détection « posé sur le sol » ne tolère que 1 mm)
        const snapped = Math.floor(ny) + 1;
        if (!collides(b.x, snapped, b.z) && snapped <= b.y) b.y = snapped;
        landed = true;
      }
      b.vy = 0;
      break;
    }
  }
  const dy = b.y - startY;
  b.onGround = landed;

  // --- horizontal ---
  const dist = Math.hypot(b.vx, b.vz);
  if (dist > 0) {
    const n = Math.max(1, Math.ceil(dist / 0.4));
    const sx = b.vx / n;
    const sz = b.vz / n;
    for (let i = 0; i < n; i++) {
      if (b.vx !== 0) {
        if (!collides(b.x + sx, b.y, b.z)) b.x += sx;
        else b.vx = 0;
      }
      if (b.vz !== 0) {
        if (!collides(b.x, b.y, b.z + sz)) b.z += sz;
        else b.vz = 0;
      }
    }
  }
  return { landed, dy };
}

// Un tic complet. Retourne des ÉVÉNEMENTS (rien n'est appliqué ici au-delà de l'état
// du bateau) : { broke, fallDamage, eject } --
//   broke      : le bateau a heurté le sol après une chute de plus de 3 blocs (il se brise)
//   fallDamage : dégâts de chute à infliger au passager s'il y en a un (>= 0)
//   eject      : le bateau est resté 3 s entièrement sous l'eau, le passager est éjecté
export function stepBoat(env, b, input) {
  b.oldStatus = b.status;
  b.status = computeStatus(env, b);

  // 3 s (60 tics) d'affilée sous l'eau -> le passager est éjecté
  if (b.status === BoatStatus.UNDER_WATER) b.outOfControlTicks += 1;
  else b.outOfControlTicks = 0;

  updateMotion(env, b);
  controlBoat(b, input);
  const { landed, dy } = moveBoat(env, b);

  // chute : ne compte que dans l'air/à terre ; tomber dans l'eau remet à zéro
  const events = { broke: false, fallDamage: 0, eject: b.outOfControlTicks >= 60 };
  if (b.status === BoatStatus.IN_WATER || b.status === BoatStatus.UNDER_WATER) {
    b.fallDistance = 0;
  } else if (dy < 0) {
    b.fallDistance += -dy;
  }
  if (landed) {
    const splash = waterFraction(env, Math.floor(b.x), Math.floor(b.y), Math.floor(b.z)) > 0;
    if (b.fallDistance > 3 && !splash) {
      events.broke = true;
      events.fallDamage = Math.ceil(b.fallDistance - 3);
    }
    b.fallDistance = 0;
  }
  return events;
}

/* ---------- Utilitaires géométriques (raycast + descente du passager) ---------- */

// Intersection rayon / boîte alignée sur les axes (méthode des dalles) : distance
// d'entrée, ou null si le rayon la rate / la boîte est plus loin que maxDist. Un rayon
// qui part déjà DANS la boîte renvoie 0.
export function rayBoatBox(b, origin, dir, maxDist) {
  const min = [b.x - BOAT_RADIUS, b.y, b.z - BOAT_RADIUS];
  const max = [b.x + BOAT_RADIUS, b.y + BOAT_HEIGHT, b.z + BOAT_RADIUS];
  const o = [origin.x, origin.y, origin.z];
  const d = [dir.x, dir.y, dir.z];
  let tNear = 0;
  let tFar = maxDist;
  for (let i = 0; i < 3; i++) {
    if (Math.abs(d[i]) < 1e-9) {
      if (o[i] < min[i] || o[i] > max[i]) return null;
      continue;
    }
    let t1 = (min[i] - o[i]) / d[i];
    let t2 = (max[i] - o[i]) / d[i];
    if (t1 > t2) [t1, t2] = [t2, t1];
    tNear = Math.max(tNear, t1);
    tFar = Math.min(tFar, t2);
    if (tNear > tFar) return null;
  }
  return tNear;
}

// Où poser le joueur qui descend du bateau : d'abord sur la terre ferme AUTOUR (à
// droite du bateau en priorité, comme le vrai jeu, puis à gauche, à l'arrière, à
// l'avant, et les diagonales), de plus en plus loin ; à défaut, sur le bateau même
// (le joueur se retrouve à l'eau et nage). `radius`/`height` : la boîte du joueur.
export function findDismountSpot(env, b, radius, height) {
  const offsets = [
    -Math.PI / 2, // droite du bateau
    Math.PI / 2, // gauche
    Math.PI, // arrière
    0, // avant
    -Math.PI / 4,
    Math.PI / 4,
    (-3 * Math.PI) / 4,
    (3 * Math.PI) / 4,
  ];
  for (const dist of [1.3, 1.8, 2.3]) {
    for (const off of offsets) {
      const a = b.yaw + off;
      // (-sin a, -cos a) = « l'avant » pour un yaw a
      const px = b.x - Math.sin(a) * dist;
      const pz = b.z - Math.cos(a) * dist;
      const cx = Math.floor(px);
      const cz = Math.floor(pz);
      // cherche un sol : de 2 cases au-dessus à 2 cases sous le bateau
      for (let cy = Math.floor(b.y) + 2; cy >= Math.floor(b.y) - 2; cy--) {
        if (!env.isSolid(cx, cy, cz)) continue;
        const standY = cy + 1;
        if (!env.collidesAtBox(px, standY, pz, radius, height)) return { x: px, y: standY, z: pz };
        break; // ce sol-là est bouché : inutile de chercher plus bas dans la même colonne
      }
    }
  }
  return { x: b.x, y: b.y + 0.6, z: b.z };
}
