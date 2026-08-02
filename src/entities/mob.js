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

export function createMobTextures() {
  return {
    pigSkin: tex.texMobSkin('#e8a0a8', '#c97e88'),
    pigFace: tex.texPigFace(),
    cowSkin: tex.texCowSkin(),
    cowFace: tex.texCowFace(),
    zombieSkin: tex.texMobSkin('#5f8a52', '#4d7343'),
    zombieFace: tex.texZombieFace(),
    zombieShirt: tex.texZombieShirt(),
    chickenBody: tex.texChickenBody(),
    chickenBeak: tex.texChickenBeak(),
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

export class Mob {
  // ctx: { scene, mobAssets, collidesAtBox, getGroundHeight, inventory,
  //        playSound, onPlayerHurt, onDeath }
  constructor(type, x, z, ctx) {
    this.ctx = ctx;
    this.type = type;
    const data = MOBS[type];
    this.data = data;
    this.speed = data.speed;
    this.health = data.health;
    this.maxHealth = data.health;
    // gabarit de collision (comme player.radius / player.height)
    this.radius = data.hitbox.radius;
    this.height = data.hitbox.height;
    const built = buildMobMesh(type, ctx.mobAssets);
    this.group = built.group;
    built.parts.forEach((p) => (p.userData.mob = this));
    this.hitParts = built.parts;
    this.legs = built.legs;
    this.arms = built.arms;
    this.pos = new THREE.Vector3(x, ctx.getGroundHeight(x, z), z);
    this.group.position.copy(this.pos);
    ctx.scene.add(this.group);
    this.wanderAngle = Math.random() * Math.PI * 2;
    this.wanderTimer = 0;
    this.alive = true;
    this.hitCooldown = 0;
    this.velY = 0;
    this.onGround = true;
    this.walkPhase = 0;
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
  update(dt, playerPos) {
    if (!this.alive) return;
    const { collidesAtBox, playSound, onPlayerHurt } = this.ctx;
    this.wanderTimer -= dt;
    this.hitCooldown -= dt;
    let moveAngle = this.wanderAngle;
    let moving = true;

    const dx = playerPos.x - this.pos.x,
      dz = playerPos.z - this.pos.z;
    const distToPlayer = Math.hypot(dx, dz);

    if (this.data.ai === 'hostile' && distToPlayer < 9) {
      moveAngle = Math.atan2(dx, dz);
      this.wanderAngle = moveAngle;
      if (distToPlayer < 1.1 && this.hitCooldown <= 0) {
        onPlayerHurt(1);
        this.hitCooldown = 1.0;
        playSound('hurt');
      }
    } else {
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
    this.velY -= 20 * dt;
    const newY = this.pos.y + this.velY * dt;
    if (this.velY < 0) {
      if (collidesAtBox(this.pos.x, newY, this.pos.z, this.radius, this.height)) {
        this.velY = 0;
        this.onGround = true;
      } else {
        this.pos.y = newY;
        this.onGround = false;
      }
    } else if (!collidesAtBox(this.pos.x, newY, this.pos.z, this.radius, this.height)) {
      this.pos.y = newY;
    }

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
    const { scene, inventory, playSound, onDeath } = this.ctx;
    this.health -= dmg;
    playSound('hit');
    if (this.health <= 0 && this.alive) {
      this.alive = false;
      scene.remove(this.group);
      this.data.drops.forEach(({ item, min, max }) => {
        inventory[item] = (inventory[item] || 0) + randInt(min, max);
      });
      playSound('mobDeath');
      onDeath(this);
    }
  }
}

// Gère la collection de mobs vivants + la liste plate de hitboxes utilisée par
// le raycast d'attaque. `makeCtx` construit le ctx d'un Mob (voir plus haut) et
// reçoit le mob à sa mort pour que l'appelant puisse le retirer de `mobs`.
export function createMobSystem({
  scene,
  mobAssets,
  collidesAtBox,
  getGroundHeight,
  getHeight,
  inventory,
  playSound,
  onPlayerHurt,
  spawnHalf,
  seaLevel,
  onMobDeath,
}) {
  const mobs = [];
  let mobHitboxes = [];

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
      inventory,
      playSound,
      onPlayerHurt,
      onDeath(mob) {
        const idx = mobs.indexOf(mob);
        if (idx >= 0) mobs.splice(idx, 1);
        refreshMobHitboxes();
        onMobDeath();
      },
    };
  }

  function spawnMobs() {
    const half = spawnHalf;
    const counts = { pig: 20, cow: 14, zombie: 14, chicken: 16 };
    Object.entries(counts).forEach(([type, n]) => {
      for (let i = 0; i < n; i++) {
        const x = Math.floor((Math.random() * 2 - 1) * half);
        const z = Math.floor((Math.random() * 2 - 1) * half);
        if (getHeight(x, z) < seaLevel) continue; // pas de mobs dans les lacs
        mobs.push(new Mob(type, x, z, makeCtx()));
      }
    });
    refreshMobHitboxes();
  }

  function update(dt, playerPos) {
    mobs.forEach((m) => m.update(dt, playerPos));
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
