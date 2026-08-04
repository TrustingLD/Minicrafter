// Particules de cassage (Phase 19) : "game feel" bon marché — 8-12 petits cubes
// texturés comme le bloc cassé, gravité, 0.6s de vie. Même leçon de perf que les
// items au sol (Phase 10, entities/item-entity.js) : UN InstancedMesh PAR TYPE DE
// BLOC, jamais un THREE.Mesh par particule (miner une veine entière ferait sinon
// des centaines de meshes pour un effet purement décoratif).

import * as THREE from 'three';

const POOL_CAPACITY = 32; // par type de bloc — largement au-dessus d'une salve (8-12)
const GRAVITY = 9;

export function createParticleSystem({ scene, blockAssets }) {
  const pools = new Map(); // blockType -> { mesh, free: number[] }
  const particles = []; // { type, slot, pos, vel, age, life }
  const dummy = new THREE.Object3D();

  function ensurePool(type) {
    let pool = pools.get(type);
    if (pool) return pool;
    const material = blockAssets.materials[type] || blockAssets.materials.stone;
    const mesh = new THREE.InstancedMesh(blockAssets.geometry, material, POOL_CAPACITY);
    mesh.count = 0;
    scene.add(mesh);
    pool = { mesh, free: Array.from({ length: POOL_CAPACITY }, (_, i) => POOL_CAPACITY - 1 - i) };
    pools.set(type, pool);
    return pool;
  }

  function burst(x, y, z, type, count = 10) {
    const pool = ensurePool(type);
    for (let i = 0; i < count && pool.free.length > 0; i++) {
      const slot = pool.free.pop();
      pool.mesh.count = Math.max(pool.mesh.count, slot + 1);
      particles.push({
        type,
        slot,
        pos: new THREE.Vector3(
          x + (Math.random() - 0.5) * 0.5,
          y + (Math.random() - 0.5) * 0.5,
          z + (Math.random() - 0.5) * 0.5,
        ),
        vel: new THREE.Vector3(
          (Math.random() - 0.5) * 2.5,
          Math.random() * 2.5 + 1,
          (Math.random() - 0.5) * 2.5,
        ),
        age: 0,
        life: 0.4 + Math.random() * 0.2,
      });
    }
  }

  function update(dt) {
    for (let i = particles.length - 1; i >= 0; i--) {
      const p = particles[i];
      p.age += dt;
      const pool = pools.get(p.type);
      if (p.age >= p.life) {
        pool.free.push(p.slot);
        dummy.scale.set(0, 0, 0);
        dummy.updateMatrix();
        pool.mesh.setMatrixAt(p.slot, dummy.matrix);
        pool.mesh.instanceMatrix.needsUpdate = true;
        particles.splice(i, 1);
        continue;
      }
      p.vel.y -= GRAVITY * dt;
      p.pos.addScaledVector(p.vel, dt);
      const scale = 0.12 * (1 - p.age / p.life);
      dummy.position.copy(p.pos);
      dummy.scale.setScalar(scale);
      dummy.updateMatrix();
      pool.mesh.setMatrixAt(p.slot, dummy.matrix);
      pool.mesh.instanceMatrix.needsUpdate = true;
    }
  }

  return { burst, update };
}
