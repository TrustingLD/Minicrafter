// Mobs (cochons, vaches, poulets, zombies). Ne dépend d'aucun autre système de jeu
// par import direct : tout ce qu'un Mob doit lire/déclencher (collisions, dégâts au
// joueur, inventaire, son, mort) lui est passé via `ctx` au constructeur. Ça garde
// le graphe de dépendances un DAG sans avoir encore besoin du bus d'événements
// (Phase 3). Stats + apparence viennent de data/mobs.js : ajouter un mob ne touche
// plus ce fichier.

import * as THREE from 'three';
import { buildBoxModel } from './model.js';
import * as tex from '../render/textures.js';
import { MOBS } from '../data/mobs.js';
import { Entity } from './entity.js';
import { voxelRaycast } from '../core/raycast.js';
import { worldToChunk, CHUNK_X, CHUNK_Y, CHUNK_Z } from '../world/chunk.js';
import { getBiome } from '../world/generator.js';
import { BIOMES } from '../world/biomes.js';

export function createMobTextures() {
  return {
    pigSkin: tex.texMobSkin('#fbbdc4', '#df818e'),
    pigFace: tex.texPigFace(),
    cowSkin: tex.texCowSkin(),
    cowFace: tex.texCowFace(),
    zombieSkin: tex.texMobSkin('#538e42', '#3d6c30'),
    zombieFace: tex.texZombieFace(),
    zombieShirt: tex.texZombieShirt(),
    chickenBody: tex.texChickenBody(),
    chickenBeak: tex.texChickenBeak(),
    sheepWool: tex.texMobSkin('#f2ede0', '#d8d2c0'),
    sheepSkin: tex.texMobSkin('#e8b98f', '#c99468'), // corps "nu" une fois tondu
    sheepFace: tex.texSheepFace(),
  };
}

export function buildMobMesh(type, mobAssets) {
  return buildBoxModel(MOBS[type].model, mobAssets);
}

function randInt(min, max) {
  return min + Math.floor(Math.random() * (max - min + 1));
}

// hauteur max qu'un mob peut "monter" en un pas (comme le joueur ne peut pas
// escalader plus d'un bloc d'un coup) — c'est ce qui empêche les mobs de se
// retrouver téléportés en haut d'un arbre ou d'une falaise
const MOB_STEP_HEIGHT = 1;

// Rayon (en blocs) au-delà duquel un mob n'est plus simulé du tout. Doit rester
// STRICTEMENT inférieur au rayon de chunks chargés (RENDER_DISTANCE * 16 = 96 blocs
// sur desktop, 64 sur mobile) : un mob simulé hors zone chargée ne verrait que des
// blocs "inconnus" et n'aurait de toute façon aucune collision utile.
const MOB_ACTIVE_RADIUS = 56;
const MOB_ACTIVE_RADIUS_SQ = MOB_ACTIVE_RADIUS * MOB_ACTIVE_RADIUS;

// Ligne de vue (Phase 12) : réutilise voxelRaycast (core/raycast.js), déjà écrit pour
// le viseur du joueur — un algorithme "bloc touché par un rayon" résout aussi bien
// "que vise le joueur" que "le zombie voit-il le joueur", sans rien réécrire.
const AGGRO_RANGE = 9;
const LOS_RECHECK_INTERVAL = 0.25; // s — pas la peine de relancer le DDA à 60Hz par mob
const LOS_GRACE = 3; // s sans ligne de vue avant de perdre l'aggro et repartir en errance
function canSeeTarget(getBlock, from, to) {
  const dx = to.x - from.x,
    dy = to.y - from.y,
    dz = to.z - from.z;
  const dist = Math.hypot(dx, dy, dz);
  if (dist < 1e-6) return true;
  const dir = { x: dx / dist, y: dy / dist, z: dz / dist };
  return !voxelRaycast(getBlock, from, dir, dist);
}

export class Mob extends Entity {
  // ctx: { scene, mobAssets, collidesAtBox, getGroundHeight, itemSystem,
  //        playSound, onPlayerHurt, onDeath }
  constructor(type, x, z, ctx) {
    const data = MOBS[type];
    super(x, ctx.getGroundHeight(x, z), z, {
      radius: data.hitbox.radius,
      height: data.hitbox.height,
      collidesAtBox: ctx.collidesAtBox,
    });
    this.ctx = ctx;
    this.type = type;
    this.data = data;
    this.speed = data.speed;
    this.health = data.health;
    this.maxHealth = data.health;
    const built = buildMobMesh(type, ctx.mobAssets);
    this.group = built.group;
    built.parts.forEach((p) => (p.userData.mob = this));
    this.hitParts = built.parts;
    this.legs = built.legs;
    this.arms = built.arms;
    // Tonte (Phase 18) : `built.parts[i]` correspond à `data.model.parts[i]` dans le
    // même ordre (buildBoxModel pousse les parts avant les membres) -- on garde les
    // meshes marqués `wool: true` pour pouvoir changer juste leur texture.
    this.woolMeshes = (data.model.parts || [])
      .map((p, i) => (p.wool ? built.parts[i] : null))
      .filter(Boolean);
    this.sheared = false;
    this.regrowTimer = 0;
    this.group.position.copy(this.pos);
    ctx.scene.add(this.group);
    this.wanderAngle = Math.random() * Math.PI * 2;
    this.wanderTimer = 0;
    this.hitCooldown = 0;
    this.onGround = true;
    this.walkPhase = 0;
    // ligne de vue (Phase 12) : recalculée au plus 4x/s (pas à chaque frame pour
    // chaque mob), le résultat reste valable entre deux tests
    this.sightTimer = Math.random() * 0.25; // décalé pour ne pas tester tous les mobs la même frame
    this.canSeePlayer = false;
    this.aggroTimer = 0; // temps restant avant de perdre l'aggro si la vue est coupée
  }
  // essaie de déplacer le mob sur un axe ; si un bloc bloque le chemin, autorise
  // à "monter la marche" seulement si l'obstacle ne fait pas plus de 1 bloc de haut
  moveAxis(axis, delta) {
    const { collidesAtBox } = this.ctx;
    const nx = axis === 'x' ? this.pos.x + delta : this.pos.x;
    const nz = axis === 'z' ? this.pos.z + delta : this.pos.z;
    if (!collidesAtBox(nx, this.pos.y, nz, this.radius, this.height)) {
      this.pos.x = nx;
      this.pos.z = nz;
      return true;
    }
    if (
      this.onGround &&
      !collidesAtBox(nx, this.pos.y + MOB_STEP_HEIGHT, nz, this.radius, this.height)
    ) {
      this.pos.x = nx;
      this.pos.z = nz;
      this.pos.y += MOB_STEP_HEIGHT;
      this.velY = 0;
      return true;
    }
    return false; // bloqué (obstacle trop haut)
  }
  // Tonte (Phase 18) : le premier mob avec un ÉTAT visuel qui change dans le temps
  // sans mourir -- ni un simple aller-retour d'animation, une vraie transition
  // "tondu" -> (60s) -> "regarni". `randInt` (drops) est réutilisé pour la quantité.
  shear() {
    if (this.sheared || this.woolMeshes.length === 0) return false;
    const { itemSystem, playSound } = this.ctx;
    this.sheared = true;
    this.regrowTimer = 60;
    const bareTex = this.ctx.mobAssets.sheepSkin;
    this.woolMeshes.forEach((mesh) => {
      mesh.material.map = bareTex;
      mesh.material.needsUpdate = true;
    });
    const count = randInt(1, 3);
    itemSystem.spawn(this.pos.x, this.pos.y + this.height * 0.5, this.pos.z, 'wool', count);
    playSound('break'); // pas de son dédié -- le clic de tonte ressemble à un "snip"
    return true;
  }
  regrow() {
    this.sheared = false;
    const woolTex = this.ctx.mobAssets.sheepWool;
    this.woolMeshes.forEach((mesh) => {
      mesh.material.map = woolTex;
      mesh.material.needsUpdate = true;
    });
  }
  update(dt, playerPos) {
    if (!this.alive) return;
    const { playSound, onPlayerHurt } = this.ctx;
    if (this.sheared) {
      this.regrowTimer -= dt;
      if (this.regrowTimer <= 0) this.regrow();
    }
    this.wanderTimer -= dt;
    this.hitCooldown -= dt;
    let moveAngle = this.wanderAngle;
    let moving = true;

    const dx = playerPos.x - this.pos.x,
      dz = playerPos.z - this.pos.z;
    const distToPlayer = Math.hypot(dx, dz);

    if (this.data.ai === 'hostile' && distToPlayer < AGGRO_RANGE) {
      // Phase 12 : ne chasse (et ne frappe) que s'il y a une ligne de vue dégagée
      // vers le joueur — recalculée au plus 4x/s, pas à chaque frame pour chaque mob.
      this.sightTimer -= dt;
      if (this.sightTimer <= 0) {
        this.sightTimer = LOS_RECHECK_INTERVAL;
        const eyes = { x: this.pos.x, y: this.pos.y + this.height * 0.9, z: this.pos.z };
        const target = { x: playerPos.x, y: playerPos.y + 1.2, z: playerPos.z };
        this.canSeePlayer = canSeeTarget(this.ctx.getBlock, eyes, target);
      }
      if (this.canSeePlayer) this.aggroTimer = LOS_GRACE;
      else this.aggroTimer -= dt;

      if (this.aggroTimer > 0) {
        moveAngle = Math.atan2(dx, dz);
        this.wanderAngle = moveAngle;
        if (distToPlayer < 1.1 && this.hitCooldown <= 0 && this.canSeePlayer) {
          onPlayerHurt(1);
          this.hitCooldown = 1.0;
          playSound('hurt');
        }
      } else if (this.wanderTimer <= 0) {
        // vue perdue depuis plus de LOS_GRACE : retombe en errance, comme un mob passif
        this.wanderAngle = Math.random() * Math.PI * 2;
        this.wanderTimer = 2 + Math.random() * 3;
        moving = Math.random() > 0.3;
        moveAngle = this.wanderAngle;
      } else {
        moveAngle = this.wanderAngle;
      }
    } else {
      this.aggroTimer = 0;
      if (this.wanderTimer <= 0) {
        this.wanderAngle = Math.random() * Math.PI * 2;
        this.wanderTimer = 2 + Math.random() * 3;
        moving = Math.random() > 0.3;
      }
      moveAngle = this.wanderAngle;
    }

    let actuallyMoved = false;
    if (moving) {
      const stepX = Math.sin(moveAngle) * this.speed * dt;
      const stepZ = Math.cos(moveAngle) * this.speed * dt;
      const movedX = this.moveAxis('x', stepX);
      const movedZ = this.moveAxis('z', stepZ);
      actuallyMoved = movedX || movedZ;
    }

    // gravité + collision verticale, comme le joueur : ça fait vraiment "tomber"
    // et "toucher le sol" le mob, au lieu de le clipper directement sur la surface
    // (Phase 10 : extraite dans entities/entity.js, partagée avec item-entity.js)
    this.applyGravity(dt);

    this.group.position.copy(this.pos);
    this.group.rotation.y = moveAngle;

    // animation de marche : balancier des pattes/bras en opposition de phase,
    // uniquement quand le mob avance réellement et touche le sol
    if (actuallyMoved && this.onGround) this.walkPhase += dt * this.speed * 6;
    else this.walkPhase *= 1 - Math.min(1, dt * 6); // retour progressif au repos
    const swing = Math.sin(this.walkPhase) * 0.6;
    this.legs.forEach((pivot, i) => {
      pivot.rotation.x = i % 2 === 0 ? swing : -swing;
    });
    this.arms.forEach((pivot, i) => {
      pivot.rotation.x = (i % 2 === 0 ? -swing : swing) * 0.6;
    });
  }
  hit(dmg) {
    const { scene, itemSystem, playSound, onDeath } = this.ctx;
    this.health -= dmg;
    playSound('hit');
    if (this.health <= 0 && this.alive) {
      this.alive = false;
      scene.remove(this.group);
      // Phase 10 : la mort ne remplit plus l'inventaire directement, elle fait
      // apparaître des items au sol (comme casser un bloc) — le joueur doit
      // s'approcher pour les ramasser.
      this.data.drops.forEach(({ item, min, max }) => {
        const count = randInt(min, max);
        if (count > 0)
          itemSystem.spawn(this.pos.x, this.pos.y + this.height * 0.5, this.pos.z, item, count);
      });
      playSound('mobDeath');
      onDeath(this);
    }
  }
}

// Gère la collection de mobs vivants + la liste plate de hitboxes utilisée par
// le raycast d'attaque. `makeCtx` construit le ctx d'un Mob (voir plus haut) et
// reçoit le mob à sa mort pour que l'appelant puisse le retirer de `mobs`.
// Phase 12.2 : spawn continu autour du joueur, pas juste au boot.
const SPAWN_INTERVAL = 4; // s
const MIN_SPAWN_DIST = 24; // jamais littéralement sur le joueur
const MAX_SPAWN_ATTEMPTS = 6; // par vague — si rien ne convainc en 6 essais, tant pis pour ce tour
const MAX_MOBS_TOTAL = 40;
// Plafond SÉPARÉ pour les animaux. Sans lui, MAX_MOBS_TOTAL était le seul frein : le
// jour, comme rien d'hostile ne peut apparaître, les vagues remplissaient les 40
// places avec des bêtes et le joueur finissait cerné par un troupeau. Les hostiles
// gardent le plafond global, donc les nuits restent peuplées.
const MAX_PASSIVE_MOBS = 16;
const MAX_MOBS_PER_CHUNK = 4;
const DESPAWN_HARD_DIST = 80; // au-delà : despawn immédiat
const DESPAWN_SOFT_DIST = 56; // au-delà pendant DESPAWN_SOFT_TIME : despawn aussi
const DESPAWN_SOFT_TIME = 60;
const HOSTILE_TYPES = ['zombie'];

// « Cette case voit-elle le ciel ? » — remonte la colonne depuis (x, y) et cherche
// le premier bloc plein. Remplace l'ancienne heuristique `groundY < 12`, qui était
// fausse : le relief de base tourne autour de y = 6-10, donc la quasi-totalité de la
// SURFACE passait pour « souterraine » et faisait apparaître des zombies en plein
// jour sur l'herbe. Un chunk inconnu compte comme ciel dégagé (on ne suppose pas un
// plafond qu'on n'a pas lu) : au pire un mob passif de plus, jamais un zombie de trop.
function hasSkyAbove(getBlock, x, y, z) {
  for (let sy = y + 1; sy < CHUNK_Y; sy++) {
    const b = getBlock(x, sy, z);
    if (b === undefined) return true;
    if (b) return false;
  }
  return true;
}

export function createMobSystem({
  scene,
  mobAssets,
  collidesAtBox,
  getGroundHeight,
  getHeight,
  getBlock,
  isNight,
  itemSystem,
  playSound,
  onPlayerHurt,
  spawnHalf,
  seaLevel,
  renderDistance,
  onMobDeath,
}) {
  const mobs = [];
  let mobHitboxes = [];
  let spawnTimer = SPAWN_INTERVAL;
  const farTimers = new Map(); // mob -> secondes passées au-delà de DESPAWN_SOFT_DIST

  function refreshMobHitboxes() {
    mobHitboxes = [];
    mobs.forEach((m) => m.hitParts.forEach((p) => mobHitboxes.push(p)));
  }

  function makeCtx() {
    return {
      scene,
      mobAssets,
      collidesAtBox,
      getGroundHeight,
      getBlock,
      itemSystem,
      playSound,
      onPlayerHurt,
      onDeath(mob) {
        const idx = mobs.indexOf(mob);
        if (idx >= 0) mobs.splice(idx, 1);
        farTimers.delete(mob);
        refreshMobHitboxes();
        onMobDeath();
      },
    };
  }

  // peuplement initial, au boot. PASSIFS UNIQUEMENT (fix) : l'ancienne version
  // incluait `zombie: 14` dans `counts`, donc 14 hostiles apparaissaient à moins de
  // `spawnHalf` blocs du joueur avant même la première frame, quelle que soit
  // l'heure — d'où la meute qui sautait sur le joueur au démarrage. Les hostiles
  // relèvent maintenant exclusivement de trySpawnAroundPlayer (nuit ou grotte),
  // qui respecte MIN_SPAWN_DIST.
  // Densité : les anciens comptes (20 cochons, 14 vaches, 16 poulets, 14 moutons)
  // faisaient 64 tentatives, soit ~55 bêtes réellement posées dans le carré de 80x80
  // autour du joueur — une ferme, pas une plaine. Pire, la boucle ne regardait même pas
  // MAX_MOBS_TOTAL (40), donc le peuplement initial dépassait à lui seul le plafond du
  // jeu et bloquait tout spawn ultérieur jusqu'aux premiers despawns. Ces comptes-ci
  // donnent une quinzaine d'animaux dispersés, et le plafond est respecté.
  const INITIAL_COUNTS = { pig: 5, cow: 4, chicken: 5, sheep: 4 };
  function spawnMobs() {
    const half = spawnHalf;
    Object.entries(INITIAL_COUNTS).forEach(([type, n]) => {
      for (let i = 0; i < n; i++) {
        if (mobs.length >= MAX_MOBS_TOTAL) return; // le plafond vaut aussi au boot
        const x = Math.floor((Math.random() * 2 - 1) * half);
        const z = Math.floor((Math.random() * 2 - 1) * half);
        if (getHeight(x, z) < seaLevel) continue; // pas de mobs dans les lacs
        // le biome décide qui vit ici (même règle que trySpawnAroundPlayer) : plus
        // de vaches en plein désert ni de poulets au milieu de l'océan
        if (!BIOMES[getBiome(x, z)].mobs.includes(type)) continue;
        mobs.push(new Mob(type, x, z, makeCtx()));
      }
    });
    refreshMobHitboxes();
  }

  function passiveCount() {
    let n = 0;
    for (const m of mobs) if (!HOSTILE_TYPES.includes(m.type)) n++;
    return n;
  }

  function chunkMobCount(cx, cz) {
    let n = 0;
    for (const m of mobs) {
      const [mcx, mcz] = worldToChunk(m.pos.x, m.pos.z);
      if (mcx === cx && mcz === cz) n++;
    }
    return n;
  }

  // une vague : tente de faire apparaître un petit lot de mobs dans un anneau
  // [MIN_SPAWN_DIST, renderDistance*CHUNK_X] autour du joueur, sur un sol chargé,
  // solide, non liquide, avec de l'air au-dessus (cf. Phase 12.2 du plan).
  function trySpawnAroundPlayer(playerPos) {
    if (mobs.length >= MAX_MOBS_TOTAL) return;
    const maxDist = Math.max(MIN_SPAWN_DIST + 8, renderDistance * CHUNK_X - 16);
    for (let attempt = 0; attempt < MAX_SPAWN_ATTEMPTS && mobs.length < MAX_MOBS_TOTAL; attempt++) {
      const angle = Math.random() * Math.PI * 2;
      const dist = MIN_SPAWN_DIST + Math.random() * (maxDist - MIN_SPAWN_DIST);
      const x = Math.round(playerPos.x + Math.sin(angle) * dist);
      const z = Math.round(playerPos.z + Math.cos(angle) * dist);

      const [cx, cz] = worldToChunk(x, z);
      if (chunkMobCount(cx, cz) >= MAX_MOBS_PER_CHUNK) continue;

      const groundY = getGroundHeight(x, z);
      const floorType = getBlock(x, groundY - 1, z);
      if (floorType === undefined) continue; // chunk pas encore chargé : pas de spawn au hasard dedans
      if (!floorType) continue; // pas de sol solide (au-dessus du vide/d'une grotte non détectée)
      const airAbove = getBlock(x, groundY, z);
      if (airAbove) continue; // pas de place pour se tenir debout

      const night = isNight();
      const underground = !hasSkyAbove(getBlock, x, groundY, z); // pas de ciel visible -> "grotte"
      let type;
      if (night || underground) {
        type = HOSTILE_TYPES[randInt(0, HOSTILE_TYPES.length - 1)];
      } else {
        if (passiveCount() >= MAX_PASSIVE_MOBS) continue; // troupeau déjà au complet
        // Phase 17 : le biome pilote QUI peut spawner ici -- des moutons en plaine,
        // rien dans l'océan/le désert/les montagnes (BIOMES[x].mobs, cf. world/biomes.js).
        const biomeMobs = BIOMES[getBiome(x, z)].mobs;
        if (biomeMobs.length === 0) continue;
        type = biomeMobs[randInt(0, biomeMobs.length - 1)];
      }

      mobs.push(new Mob(type, x, z, makeCtx()));
      refreshMobHitboxes();
    }
  }

  function despawnFar(dt, playerPos) {
    for (let i = mobs.length - 1; i >= 0; i--) {
      const m = mobs[i];
      const dx = m.pos.x - playerPos.x,
        dz = m.pos.z - playerPos.z;
      const d2 = dx * dx + dz * dz;
      if (d2 > DESPAWN_HARD_DIST * DESPAWN_HARD_DIST) {
        m.alive = false;
        scene.remove(m.group);
        mobs.splice(i, 1);
        farTimers.delete(m);
        continue;
      }
      if (d2 > DESPAWN_SOFT_DIST * DESPAWN_SOFT_DIST) {
        const t = (farTimers.get(m) || 0) + dt;
        if (t > DESPAWN_SOFT_TIME) {
          m.alive = false;
          scene.remove(m.group);
          mobs.splice(i, 1);
          farTimers.delete(m);
          continue;
        }
        farTimers.set(m, t);
      } else if (farTimers.has(m)) {
        farTimers.delete(m); // revenu à portée : le sursis est annulé
      }
    }
    refreshMobHitboxes();
  }

  function update(dt, playerPos) {
    spawnTimer -= dt;
    if (spawnTimer <= 0) {
      spawnTimer = SPAWN_INTERVAL;
      trySpawnAroundPlayer(playerPos);
      despawnFar(dt, playerPos);
    }
    for (const m of mobs) {
      const dx = m.pos.x - playerPos.x;
      const dz = m.pos.z - playerPos.z;
      const far = dx * dx + dz * dz > MOB_ACTIVE_RADIUS_SQ;
      // masqué aussi côté rendu : un mob gelé à 150 blocs n'a rien à coûter au GPU
      if (m.group.visible === far) m.group.visible = !far;
      if (far) continue;
      m.update(dt, playerPos);
    }
  }

  return {
    mobs,
    get mobHitboxes() {
      return mobHitboxes;
    },
    spawnMobs,
    refreshMobHitboxes,
    update,
  };
}
