// Bateaux (Phase 36) : le SYSTÈME qui possède tous les bateaux posés dans le monde --
// modèle 3D, simulation à tic fixe (20 Hz, cf. boat-physics.js pour les règles),
// clic gauche (les casser), passager (monter/descendre). Comme mob.js/item-entity.js,
// main.js n'en connaît que l'API (createBoatSystem) : rien ici ne touche au DOM,
// à la souris ou à l'inventaire -- tout ce qui vient de l'extérieur (le monde, les
// drops, le son) est injecté.
//
// Rendu : la physique tourne à 20 Hz, l'affichage à la fréquence de l'écran -> chaque
// bateau garde son état du tic précédent (`prev`) et est dessiné INTERPOLÉ entre les
// deux, sinon il avancerait par à-coups de 50 ms. La caméra du passager lit la même
// position interpolée (riderAnchor), donc rien ne « tremble » à l'écran.

import * as THREE from 'three';
import {
  BOAT_HEIGHT,
  BOAT_RADIUS,
  BoatStatus,
  TICK_SECONDS,
  createBoatState,
  findDismountSpot,
  rayBoatBox,
  stepBoat,
} from './boat-physics.js';

// Portée pour viser un bateau (monter, frapper) : la même que le viseur bloc/mob de ce
// moteur (raycaster.far = 6 dans main.js), pas les 3 blocs du vrai jeu -- sinon monter
// serait plus pénible que casser un bloc du même endroit.
export const BOAT_INTERACT_REACH = 6;

// Position du passager par rapport au bas du bateau : dans le vrai jeu, ses PIEDS sont
// 0.45 sous le bas de la boîte du bateau (assis dans la coque) et ses yeux à 1.62 des
// pieds. Ici player.height = 1.7 (yeux à player.pos.y + 1.7), donc on descend encore de
// 0.08 pour retrouver exactement la hauteur d'yeux du vrai jeu, à ras de l'eau.
export const RIDER_Y_OFFSET = -0.45 - (1.7 - 1.62);

// Le regard du passager reste dans ±105° de l'axe du bateau (il ne peut pas se
// retourner complètement), comme le vrai jeu.
export const RIDER_MAX_LOOK = (105 * Math.PI) / 180;

const MAX_CATCHUP_TICKS = 5; // après un gros lag : on rattrape au plus 5 tics, pas 40
const HURT_TICKS = 10;
const DAMAGE_LIMIT = 40; // > 40 de dégâts cumulés (coup x10) : le bateau casse
const PADDLE_TICK_ADVANCE = Math.PI / 8; // phase de pagaie/tic quand elle rame

/* ---------- Modèle 3D ---------- */
// Repère local : origine = centre du bateau AU BAS de sa boîte de collision, l'avant
// (la proue) vers -z, comme l'avatar du joueur. Dimensions en blocs, calées sur le
// modèle du vrai jeu (coque 1.75 x 1.0, bords de 0.375).
function buildGeometries() {
  const box = (w, h, d) => new THREE.BoxGeometry(w, h, d);
  return {
    floor: box(1.0, 0.125, 1.75),
    side: box(0.125, 0.375, 1.75),
    end: box(0.75, 0.375, 0.125),
    inner: box(0.75, 0.02, 1.5),
    shaft: box(0.95, 0.06, 0.06),
    blade: box(0.3, 0.03, 0.2),
    mask: new THREE.PlaneGeometry(0.75, 1.5),
  };
}

function buildBoatModel(geos, materials) {
  const model = new THREE.Group(); // ce groupe-là reçoit le tremblement quand on le frappe
  const add = (geo, mat, x, y, z) => {
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.set(x, y, z);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    model.add(mesh);
    return mesh;
  };
  add(geos.floor, materials.wood, 0, 0.125, 0);
  add(geos.side, materials.wood, -0.4375, 0.375, 0);
  add(geos.side, materials.wood, 0.4375, 0.375, 0);
  add(geos.end, materials.wood, 0, 0.375, -0.8125); // proue
  add(geos.end, materials.wood, 0, 0.375, 0.8125); // poupe
  add(geos.inner, materials.inner, 0, 0.1875 + 0.01, 0).receiveShadow = true;

  // Masque d'eau : plan invisible (aucune couleur écrite) posé sur l'ouverture de la
  // coque, qui n'écrit QUE la profondeur -- comme le « water mask » du vrai jeu. La
  // surface de l'eau (transparente, dessinée après tout l'opaque) passe par la coque
  // ouverte : sans ce plan on verrait l'eau « dans » le bateau. renderOrder 1 = APRÈS
  // les meshes opaques normaux (sinon le fond de la coque, derrière le plan, serait
  // rejeté par le test de profondeur au lieu d'être dessiné).
  const mask = new THREE.Mesh(geos.mask, materials.mask);
  mask.rotation.x = -Math.PI / 2;
  mask.position.set(0, BOAT_HEIGHT, 0);
  mask.renderOrder = 1;
  model.add(mask);

  // Pagaies : une par bord, à l'arrière (z > 0). `side` +1 = droite, -1 = gauche.
  const paddles = [-1, 1].map((side) => {
    const pivot = new THREE.Group();
    pivot.position.set(side * 0.47, 0.5, 0.3);
    const shaft = new THREE.Mesh(geos.shaft, materials.wood);
    shaft.position.x = side * 0.3;
    const blade = new THREE.Mesh(geos.blade, materials.wood);
    blade.position.x = side * 0.75;
    shaft.castShadow = blade.castShadow = true;
    pivot.add(shaft, blade);
    model.add(pivot);
    return { pivot, side };
  });
  return { model, paddles };
}

function poseBoatPaddles(paddles, phase, active) {
  paddles.forEach(({ pivot, side }, i) => {
    // repos : la pagaie pend vers l'extérieur, un peu vers l'arrière ; en action :
    // elle balaie d'arrière en avant, en plongeant à chaque coup
    const p = phase[i];
    const stroke = active[i] ? Math.sin(p) : 0;
    pivot.rotation.z = -side * (0.5 + (active[i] ? 0.15 * Math.sin(p + Math.PI / 2) : 0));
    pivot.rotation.y = side * (-0.45 + 0.6 * stroke);
  });
}

/* ---------- Système ---------- */
// env : { getBlock, isSolid, collidesAtBox } -- les mêmes fonctions que worldApi.
// materials : { wood, inner, mask } (cf. main.js : `wood` = le matériau des planches de
//   block-assets, partagé -- une seule texture pour tout le jeu).
// spawnItem(item, x, y, z, count) : lâche un objet au sol.
// playSound(name) : cf. audio/sfx.js.
// onEject(spot, reason) : le passager doit être remis à `spot` ({x,y,z}) -- le bateau a
//   été détruit ('destroyed') ou est resté 3 s sous l'eau ('sunk').
// onRiderFall(damage) : le bateau s'est brisé en tombant de trop haut avec quelqu'un
//   dedans -- le passager encaisse `damage` (appelé AVANT l'éjection correspondante).
export function createBoatSystem({
  scene,
  materials,
  env,
  spawnItem,
  playSound,
  onEject,
  onRiderFall,
}) {
  const group = new THREE.Group(); // main.js le masque en entrant dans le Nether
  scene.add(group);
  const geos = buildGeometries();
  const boats = [];
  let accumulator = 0;
  let alpha = 0;
  let riding = null;

  function makeBoat(x, y, z, yaw) {
    const { model, paddles } = buildBoatModel(geos, materials);
    const root = new THREE.Group();
    root.add(model);
    group.add(root);
    const state = createBoatState(x, y, z, yaw);
    const boat = {
      state,
      prev: { x, y, z, yaw },
      root,
      model,
      paddles,
      paddlePhase: [0, 0],
      prevPaddlePhase: [0, 0],
      hurtTime: 0,
      hurtDir: 1,
      damage: 0,
      hasPassenger: false,
      active: true,
      paddleSoundTicks: 0,
    };
    boats.push(boat);
    return boat;
  }

  function isLoadedAt(x, y, z) {
    // un chunk non chargé renvoie `undefined` pour getBlock (cf. world.js) : le bateau
    // n'y est ni simulé ni dessiné, plutôt que de flotter dans le vide
    return env.getBlock(Math.floor(x), Math.floor(y), Math.floor(z)) !== undefined;
  }

  // Poser un bateau en (x,y,z) [le BAS de sa boîte], tourné de `yaw`. Comme le vrai jeu :
  // refusé si la boîte mordrait sur un bloc solide. Retourne le bateau, ou null.
  function place(x, y, z, yaw) {
    if (env.collidesAtBox(x, y, z, BOAT_RADIUS, BOAT_HEIGHT)) return null;
    return makeBoat(x, y, z, yaw);
  }

  // Le bateau visé le plus proche (hors celui qu'on monte), ou null.
  function raycast(origin, dir, maxDist = BOAT_INTERACT_REACH) {
    let best = null;
    for (const boat of boats) {
      if (boat === riding || !boat.active) continue;
      const dist = rayBoatBox(boat.state, origin, dir, maxDist);
      if (dist !== null && (!best || dist < best.dist)) best = { boat, dist };
    }
    return best;
  }

  function mount(boat) {
    if (riding || boat.hasPassenger) return false;
    boat.hasPassenger = true;
    riding = boat;
    return true;
  }

  // Descend le passager. Retourne l'endroit où le poser ({x,y,z}, cf. findDismountSpot),
  // ou null si personne n'était monté. `radius`/`height` : la boîte du joueur.
  function dismount(radius, height) {
    if (!riding) return null;
    const boat = riding;
    boat.hasPassenger = false;
    riding = null;
    return findDismountSpot(env, boat.state, radius, height);
  }

  function removeBoat(boat) {
    const i = boats.indexOf(boat);
    if (i >= 0) boats.splice(i, 1);
    group.remove(boat.root);
    // les géométries/matériaux sont PARTAGÉS par tous les bateaux (cf. buildGeometries) :
    // on ne les libère jamais ici, seul le groupe de ce bateau disparaît
  }

  // Casse le bateau. `drops` : 'boat' (coups : on récupère le bateau) ou 'wreck' (chute
  // de plus de 3 blocs : 3 planches + 2 bâtons, comme le vrai jeu).
  function destroy(boat, drops, playerRadius = 0.3, playerHeight = 1.7) {
    const s = boat.state;
    if (boat === riding) {
      const spot = dismount(playerRadius, playerHeight);
      if (spot) onEject?.(spot, 'destroyed');
    }
    const cx = s.x,
      cy = s.y + 0.3,
      cz = s.z;
    if (drops === 'boat') spawnItem('boat', cx, cy, cz, 1);
    else if (drops === 'wreck') {
      for (let i = 0; i < 3; i++) spawnItem('planks', cx, cy, cz, 1);
      for (let i = 0; i < 2; i++) spawnItem('stick', cx, cy, cz, 1);
    }
    removeBoat(boat);
    playSound?.('break');
  }

  // Un coup sur le bateau (clic gauche). `amount` = dégâts de l'arme (main 1, épée 5 dans
  // ce moteur) ; comme le vrai jeu, les dégâts sont multipliés par 10 puis cumulés
  // (ils retombent de 1 par tic) : 5 coups de poing, 1 coup d'épée. `instant` : /instant.
  // Retourne true si le bateau vient de casser.
  function hit(boat, amount, instant = false) {
    boat.hurtDir = -boat.hurtDir;
    boat.hurtTime = HURT_TICKS;
    boat.damage += amount * 10;
    playSound?.('hit');
    if (instant || boat.damage > DAMAGE_LIMIT) {
      destroy(boat, 'boat');
      return true;
    }
    return false;
  }

  function interpolated(boat, out) {
    const s = boat.state;
    const p = boat.prev;
    out.x = p.x + (s.x - p.x) * alpha;
    out.y = p.y + (s.y - p.y) * alpha;
    out.z = p.z + (s.z - p.z) * alpha;
    out.yaw = p.yaw + (s.yaw - p.yaw) * alpha;
    return out;
  }

  const tmp = { x: 0, y: 0, z: 0, yaw: 0 };

  function tickBoat(boat, input) {
    const s = boat.state;
    boat.prev.x = s.x;
    boat.prev.y = s.y;
    boat.prev.z = s.z;
    boat.prev.yaw = s.yaw;
    boat.prevPaddlePhase[0] = boat.paddlePhase[0];
    boat.prevPaddlePhase[1] = boat.paddlePhase[1];

    const events = stepBoat(env, s, boat === riding ? input : null);

    if (boat.hurtTime > 0) boat.hurtTime -= 1;
    if (boat.damage > 0) boat.damage = Math.max(0, boat.damage - 1);
    if (s.paddleLeft) boat.paddlePhase[0] += PADDLE_TICK_ADVANCE;
    if (s.paddleRight) boat.paddlePhase[1] += PADDLE_TICK_ADVANCE;

    // clapotis de rame : une fois toutes les 0.5 s, seulement pour SON bateau
    if (boat === riding && (s.paddleLeft || s.paddleRight) && s.status === BoatStatus.IN_WATER) {
      boat.paddleSoundTicks += 1;
      if (boat.paddleSoundTicks >= 10) {
        boat.paddleSoundTicks = 0;
        playSound?.('footstepWater');
      }
    } else {
      boat.paddleSoundTicks = 0;
    }
    return events;
  }

  // Avance la simulation de `dt` secondes. `input` : { left, right, forward, back } du
  // passager (ignoré s'il n'y en a pas). `playerBox` : { radius, height } pour la
  // descente forcée (coulé/cassé).
  function update(dt, input, playerBox = { radius: 0.3, height: 1.7 }) {
    accumulator += dt;
    let ticks = 0;
    while (accumulator >= TICK_SECONDS && ticks < MAX_CATCHUP_TICKS) {
      accumulator -= TICK_SECONDS;
      ticks += 1;
      for (const boat of boats.slice()) {
        // hors du monde chargé : gelé et invisible (cf. isLoadedAt)
        boat.active = isLoadedAt(boat.state.x, boat.state.y, boat.state.z);
        if (!boat.active) continue;
        const events = tickBoat(boat, input);
        if (events.broke) {
          // le passager encaisse la chute AVANT d'être éjecté (par destroy, juste après)
          if (boat === riding) onRiderFall?.(events.fallDamage);
          destroy(boat, 'wreck', playerBox.radius, playerBox.height);
        } else if (events.eject && boat === riding) {
          const spot = dismount(playerBox.radius, playerBox.height);
          if (spot) onEject?.(spot, 'sunk');
        }
      }
    }
    // rattrapage impossible (lag énorme) : on jette le reste plutôt que de le cumuler
    if (ticks === MAX_CATCHUP_TICKS) accumulator = 0;
    alpha = accumulator / TICK_SECONDS;

    for (const boat of boats) {
      boat.root.visible = boat.active;
      if (!boat.active) continue;
      interpolated(boat, tmp);
      boat.root.position.set(tmp.x, tmp.y, tmp.z);
      boat.root.rotation.y = tmp.yaw;

      // tremblement quand on le frappe (cf. BoatRenderer du vrai jeu) : roulis autour de
      // l'axe gauche-droite, d'autant plus fort que les dégâts cumulés sont élevés
      const f = boat.hurtTime - alpha;
      const wobble =
        f > 0 ? (Math.sin(f) * f * Math.max(boat.damage - alpha, 0) * boat.hurtDir) / 10 : 0;
      boat.model.rotation.x = (wobble * Math.PI) / 180;

      const phase = [
        boat.prevPaddlePhase[0] + (boat.paddlePhase[0] - boat.prevPaddlePhase[0]) * alpha,
        boat.prevPaddlePhase[1] + (boat.paddlePhase[1] - boat.prevPaddlePhase[1]) * alpha,
      ];
      poseBoatPaddles(boat.paddles, phase, [boat.state.paddleLeft, boat.state.paddleRight]);
    }
  }

  // Position (interpolée, celle qu'on VOIT) et cap du bateau monté, ou null. Le passager
  // s'y accroche : `pos` reçoit ses pieds (x, y + RIDER_Y_OFFSET, z).
  function riderAnchor(pos) {
    if (!riding) return null;
    interpolated(riding, tmp);
    pos.x = tmp.x;
    pos.y = tmp.y + RIDER_Y_OFFSET;
    pos.z = tmp.z;
    return { yaw: tmp.yaw, status: riding.state.status };
  }

  return {
    boats,
    group,
    place,
    raycast,
    mount,
    dismount,
    hit,
    destroy,
    update,
    riderAnchor,
    get riding() {
      return riding;
    },
  };
}
