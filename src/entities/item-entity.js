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
import { TEX_SIZE } from '../render/textures.js';

const ITEM_SCALE = 0.28;
// Aspiration façon "item magnet" (retour utilisateur) : au lieu d'un ramassage
// instantané dès l'entrée dans un rayon fixe, l'item est d'abord ATTIRÉ vers le
// joueur (MAGNET_RADIUS, "1 bloc de distance MAX"), puis réellement absorbé une fois
// tout près (ABSORB_RADIUS) -- c'est ce trajet visible qui EST la "petite animation
// d'aspiration" demandée, pas un effet séparé à ajouter par-dessus.
const MAGNET_RADIUS = 1.0; // "1 bloc de distance MAX" : distance à partir de laquelle l'item se met à voler vers le joueur
const MAGNET_VERTICAL_RANGE = 1.6; // tolérance verticale généreuse (~hauteur du joueur) : ne doit PAS réduire la portée horizontale (cf. bug ci-dessous)
const MAGNET_DURATION = 0.15; // s : le trajet magnet_radius -> joueur doit être bouclé dans CE temps-là (retour utilisateur)
// vitesse constante (pas de rampe progressive) dérivée de la contrainte ci-dessus :
// au pire cas (item accroché tout juste sous MAGNET_RADIUS), le franchir prend
// MAGNET_RADIUS / MAGNET_SPEED = MAGNET_DURATION secondes, pile la contrainte demandée.
const MAGNET_SPEED = MAGNET_RADIUS / MAGNET_DURATION; // = 20 unités/s
const ABSORB_RADIUS = 0.35; // distance à laquelle l'item est effectivement ramassé (fin de l'aspiration)
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
  // Épaisseur des items "2D" (retour utilisateur) : un simple PlaneGeometry disparaît
  // complètement vu de profil (une carte à plat, invisible tranche sur tranche). Un
  // fin BoxGeometry donne un semblant de volume, comme les items extrudés de Minecraft.
  // "2 pixels" au sens texture (TEX_SIZE=32px de large pour l'icône) -> 2/32 d'unité.
  const ICON_THICKNESS = 2 / TEX_SIZE;
  const iconGeometry = new THREE.BoxGeometry(1, 1, ICON_THICKNESS);

  function materialFor(item) {
    if (blockAssets.stairsMaterials[item]) return blockAssets.stairsMaterials[item]; // matériau simple (pas un tableau) : cf. geometryFor
    if (blockAssets.materials[item]) return blockAssets.materials[item]; // array de 6 (comme un Mesh multi-matériaux)
    // sinon on retombe sur la même icône que la hotbar/l'inventaire (blockAssets.iconCanvas) :
    // une seule source de vérité pour "à quoi ressemble cet objet"
    const iconImg = blockAssets.iconCanvas(item);
    if (iconImg) {
      const t = new THREE.CanvasTexture(iconImg);
      t.magFilter = THREE.NearestFilter;
      t.minFilter = THREE.NearestFilter;
      const face = new THREE.MeshLambertMaterial({ map: t, transparent: true, side: THREE.DoubleSide });
      // BoxGeometry groupe ses faces dans l'ordre [+x,-x,+y,-y,+z,-z] (même convention
      // que blockAssets.geometry, cf. render/block-assets.js). +z/-z portent l'icône
      // recto-verso ; les 4 tranches (+x,-x,+y,-y) réutilisent la MÊME texture, juste
      // très étirée sur leur largeur minuscule -- un liseré de couleur cohérent avec
      // l'icône plutôt qu'une teinte arbitraire, sans avoir à générer une texture de
      // tranche séparée pour chaque item.
      return [face, face, face, face, face, face];
    }
    return new THREE.MeshLambertMaterial({ color: 0xdfc27b }); // même teinte que le placeholder du bâton en UI
  }

  function geometryFor(item) {
    // escaliers : vraie géométrie en L (cf. render/block-assets.js buildStairsGeometry)
    // plutôt que le cube générique -- pour matcher visuellement le vrai bloc posé.
    if (blockAssets.stairsGeometry && blockAssets.stairsMaterials[item]) return blockAssets.stairsGeometry;
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

      // Aspiration vers le joueur (cf. constantes ci-dessus) : dans MAGNET_RADIUS,
      // l'item est tiré directement (sans passer par la physique gravité/collision
      // normale ci-dessus, ni le test de collision x/z ci-dessous) -- exactement comme
      // dans Minecraft, un item aspiré traverse librement les petits obstacles plutôt
      // que de rester coincé au dernier moment. En dehors du rayon, mouvement inchangé.
      let magnetPull = false;
      if (e.age > PICKUP_DELAY) {
        const px = playerPos.x,
          py = playerPos.y + 0.9,
          pz = playerPos.z;
        const dx = px - e.pos.x,
          dy = py - e.pos.y,
          dz = pz - e.pos.z;
        // BUG corrigé (retour utilisateur : "je n'arrive pas à aspirer à 1 bloc") :
        // mesurer la distance en 3D (dx,dy,dz) pénalisait le rayon horizontal, car le
        // décalage vertical fixe (+0.9, vers la poitrine du joueur) s'ajoutait TOUJOURS
        // à l'écart, même pour un item posé au sol juste à côté du joueur -- à 1 bloc
        // horizontal pile, la distance 3D dépassait déjà MAGNET_RADIUS=1.0
        // (sqrt(1² + 0.9²) ≈ 1.35), donc l'aspiration ne se déclenchait quasiment
        // jamais. Fix : la PORTÉE (déclenchement du magnet) se juge sur la distance
        // HORIZONTALE seule (distH), avec une tolérance verticale large et séparée
        // (MAGNET_VERTICAL_RANGE) pour ne filtrer que les items à un autre étage.
        const distH = Math.sqrt(dx * dx + dz * dz);
        const dist = Math.sqrt(dx * dx + dy * dy + dz * dz); // distance 3D réelle, utilisée seulement pour le déplacement/l'absorption
        if (distH < MAGNET_RADIUS && Math.abs(dy) < MAGNET_VERTICAL_RANGE) {
          magnetPull = true;
          if (dist < ABSORB_RADIUS) {
            const taken = pickup(e.item, e.count);
            if (taken > 0) {
              e.count -= taken;
              if (e.count <= 0) {
                playSound('pickup');
                despawn(e);
                continue;
              }
            }
          } else {
            // vitesse constante (MAGNET_SPEED, pas de rampe) dérivée de MAGNET_DURATION
            // ci-dessus ; le pas est borné à `dist` pour ne jamais dépasser le joueur
            // en un seul frame (MAGNET_SPEED est volontairement élevée pour boucler le
            // trajet en 0,1s, donc speed*dt peut largement dépasser la distance
            // restante dès qu'on approche de ABSORB_RADIUS).
            const step = Math.min(MAGNET_SPEED * dt, dist);
            e.pos.x += (dx / dist) * step;
            e.pos.y += (dy / dist) * step;
            e.pos.z += (dz / dist) * step;
          }
        }
      }

      if (!magnetPull) {
        const nx = e.pos.x + e.velX * dt;
        const nz = e.pos.z + e.velZ * dt;
        if (!collidesAtBox(nx, e.pos.y, e.pos.z, e.radius, e.height)) e.pos.x = nx;
        else e.velX = 0;
        if (!collidesAtBox(e.pos.x, e.pos.y, nz, e.radius, e.height)) e.pos.z = nz;
        else e.velZ = 0;
      }

      const pool = pools.get(e.item);
      if (pool) {
        // pendant l'aspiration : pas de bob (l'item ne "flotte" plus, il fonce vers le
        // joueur) et rotation accélérée -- lisible comme "en train de se faire aspirer"
        // plutôt qu'un item qui continue de flotter tranquillement en glissant au sol.
        const bob = magnetPull ? 0 : Math.sin(e.age * 3 + e.bobPhase) * 0.06;
        const spin = magnetPull ? 10 : 1.4;
        dummy.position.set(e.pos.x, e.pos.y + e.height * 0.5 + bob, e.pos.z);
        dummy.rotation.set(0, e.age * spin + e.bobPhase, 0);
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
