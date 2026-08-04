// Items au sol (Phase 10) : ce que droppe un bloc cassé ou un mob tué, avant
// ramassage. Physique = Entity (gravité + collision, cf. entity.js) + une petite
// pop-vélocité horizontale qui se freine au sol.
//
// Perf (le point de la phase) : PAS un THREE.Mesh par item — avec un joueur qui
// casse une forêt entière ça ferait vite des centaines de meshes, chacun un appel de
// rendu. Un InstancedMesh PAR TYPE D'ITEM (partagé par toutes les instances de ce
// type, comme waterMesh/lavaMesh dans world.js) : casser 50 blocs de pierre = 1 seul
// appel de rendu pour les 50 cubes qui traînent au sol.

import * as THREE from 'three';
import { Entity } from './entity.js';

const ITEM_SCALE = 0.28;
const PICKUP_RADIUS = 1.2;
const PICKUP_DELAY = 0.5; // s avant qu'un item fraîchement lâché soit ramassable
const DESPAWN_TIME = 300; // 5 min
const MERGE_RADIUS = 0.6; // fusionne les items identiques proches pour éviter 200 cubes
const GROUND_FRICTION = 6; // /s, freine vx/vz une fois au sol
const POOL_CAPACITY = 64; // par type d'item — largement au-dessus de ce qu'un joueur peut faire apparaître d'un coup

class ItemEntityInstance extends Entity {
  constructor(x, y, z, item, count, collidesAtBox) {
    super(x, y, z, { radius: 0.18, height: ITEM_SCALE, collidesAtBox });
    this.item = item;
    this.count = count;
    this.age = 0;
    this.velY = 3 + Math.random() * 1.5;
    this.velX = (Math.random() - 0.5) * 2.5;
    this.velZ = (Math.random() - 0.5) * 2.5;
    this.bobPhase = Math.random() * Math.PI * 2;
    this.slotIndex = -1; // emplacement occupé dans l'InstancedMesh de son pool
  }
}

export function createItemEntitySystem({ scene, blockAssets, collidesAtBox, playSound }) {
  const entities = [];
  const pools = new Map(); // item -> { mesh, free: number[] }
  const dummy = new THREE.Object3D();
  const iconGeometry = new THREE.PlaneGeometry(1, 1);

  function materialFor(item) {
    if (blockAssets.materials[item]) return blockAssets.materials[item]; // array de 6 (comme un Mesh multi-matériaux)
    // sinon on retombe sur la même icône que la hotbar/l'inventaire (blockAssets.iconCanvas) :
    // une seule source de vérité pour "à quoi ressemble cet objet"
    const iconImg = blockAssets.iconCanvas(item);
    if (iconImg) {
      const t = new THREE.CanvasTexture(iconImg);
      t.magFilter = THREE.NearestFilter;
      t.minFilter = THREE.NearestFilter;
      return new THREE.MeshLambertMaterial({ map: t, transparent: true, side: THREE.DoubleSide });
    }
    return new THREE.MeshLambertMaterial({ color: 0xdfc27b }); // même teinte que le placeholder du bâton en UI
  }

  function geometryFor(item) {
    return blockAssets.materials[item] ? blockAssets.geometry : iconGeometry;
  }

  function ensurePool(item) {
    let pool = pools.get(item);
    if (pool) return pool;
    const mesh = new THREE.InstancedMesh(geometryFor(item), materialFor(item), POOL_CAPACITY);
    mesh.count = 0;
    // Fix : le mesh lui-même reste à l'origine (0,0,0), seules les instances bougent
    // via leur propre matrice (setMatrixAt plus bas). Or Three.js ne calcule la
    // boundingSphere d'un InstancedMesh QU'UNE FOIS (au premier passage de frustum
    // culling), jamais recalculée ensuite -- même quand les items tombent/rebondissent
    // ou que d'autres apparaissent ailleurs. Cette sphère devient donc vite obsolète
    // et le moteur finit par éliminer des items pourtant bien dans le champ de vision
    // (invisibles malgré eux). Un pool fait au plus POOL_CAPACITY=64 items : désactiver
    // le frustum culling ne coûte rien de mesurable et règle le problème définitivement.
    mesh.frustumCulled = false;
    scene.add(mesh);
    pool = { mesh, free: Array.from({ length: POOL_CAPACITY }, (_, i) => POOL_CAPACITY - 1 - i) };
    pools.set(item, pool);
    return pool;
  }

  // fusionne dans une entité identique déjà posée à proximité plutôt que d'empiler
  // les cubes un par un (ramasser 60 pierres cassées à la suite ne doit pas créer
  // 60 entités qui rivalisent toutes pour le même slot de pool)
  function findMergeTarget(x, y, z, item) {
    for (const e of entities) {
      if (e.item !== item || e.count >= 6400) continue;
      if (e.pos.distanceTo({ x, y, z }) < MERGE_RADIUS) return e;
    }
    return null;
  }

  function spawn(x, y, z, item, count) {
    const target = findMergeTarget(x, y, z, item);
    if (target) {
      target.count += count;
      return target;
    }
    const pool = ensurePool(item);
    if (pool.free.length === 0) return null; // pool saturé (très improbable) : le drop est silencieusement perdu
    const slot = pool.free.pop();
    const e = new ItemEntityInstance(x, y, z, item, count, collidesAtBox);
    e.slotIndex = slot;
    pool.mesh.count = Math.max(pool.mesh.count, slot + 1);
    entities.push(e);
    return e;
  }

  function despawn(e) {
    e.alive = false;
    const pool = pools.get(e.item);
    if (pool) {
      pool.free.push(e.slotIndex);
      dummy.scale.set(0, 0, 0);
      dummy.updateMatrix();
      pool.mesh.setMatrixAt(e.slotIndex, dummy.matrix);
      pool.mesh.instanceMatrix.needsUpdate = true;
    }
    const i = entities.indexOf(e);
    if (i >= 0) entities.splice(i, 1);
  }

  // appelée chaque frame : physique + bob/spin + ramassage + despawn. `pickup(item,
  // count)` doit renvoyer la quantité effectivement absorbée (l'inventaire peut être
  // plein) — ce qui n'est pas absorbé reste au sol.
  function update(dt, playerPos, pickup) {
    for (let i = entities.length - 1; i >= 0; i--) {
      const e = entities[i];
      e.age += dt;
      if (e.age > DESPAWN_TIME) {
        despawn(e);
        continue;
      }

      e.applyGravity(dt);
      if (e.onGround) {
        const f = Math.max(0, 1 - GROUND_FRICTION * dt);
        e.velX *= f;
        e.velZ *= f;
      }
      const nx = e.pos.x + e.velX * dt;
      const nz = e.pos.z + e.velZ * dt;
      if (!collidesAtBox(nx, e.pos.y, e.pos.z, e.radius, e.height)) e.pos.x = nx;
      else e.velX = 0;
      if (!collidesAtBox(e.pos.x, e.pos.y, nz, e.radius, e.height)) e.pos.z = nz;
      else e.velZ = 0;

      if (e.age > PICKUP_DELAY) {
        const dx = playerPos.x - e.pos.x,
          dy = playerPos.y + 0.9 - e.pos.y,
          dz = playerPos.z - e.pos.z;
        if (dx * dx + dy * dy + dz * dz < PICKUP_RADIUS * PICKUP_RADIUS) {
          const taken = pickup(e.item, e.count);
          if (taken > 0) {
            e.count -= taken;
            if (e.count <= 0) {
              playSound('pickup');
              despawn(e);
              continue;
            }
          }
        }
      }

      const pool = pools.get(e.item);
      if (pool) {
        const bob = Math.sin(e.age * 3 + e.bobPhase) * 0.06;
        dummy.position.set(e.pos.x, e.pos.y + e.height * 0.5 + bob, e.pos.z);
        dummy.rotation.set(0, e.age * 1.4 + e.bobPhase, 0);
        dummy.scale.setScalar(ITEM_SCALE);
        dummy.updateMatrix();
        pool.mesh.setMatrixAt(e.slotIndex, dummy.matrix);
        pool.mesh.instanceMatrix.needsUpdate = true;
      }
    }
  }

  return {
    spawn,
    update,
    get entities() {
      return entities;
    },
  };
}
