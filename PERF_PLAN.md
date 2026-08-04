# Plan de correction : chute de FPS en exploration (60 → 7 FPS)

> Document destiné à un modèle d'implémentation. Suivre les phases **dans l'ordre**.
> La Phase 1 seule doit ramener le jeu à ~60 FPS. Les phases 2-4 sont des marges
> supplémentaires. Après chaque phase : `npm test` doit passer, puis test manuel.

---

## 0. Diagnostic (déjà fait, ne pas re-chercher)

### Symptôme

- Au spawn : ~60 FPS.
- Dès que le joueur s'éloigne à ~100 blocs de l'origine : 7-10 FPS, de façon permanente.

### ⚠️ Ce ne sont PAS les nouveaux chunks

Le réflexe naturel est d'accuser les chunks nouvellement générés autour du joueur.
**Mesuré : c'est faux.** Les chunks régénérés en boucle sont ceux **du spawn**, restés
derrière le joueur. Le joueur peut être à 260 blocs de l'origine, ce sont les chunks
`-4..3` qui sont recréés 33 fois par frame.

### Mesures (relevées dans le jeu réel, instrumentation temporaire de `ensureChunk`)

Coût unitaire (Node, V8) :

```
generateChunk() : ~7.2 ms / chunk
meshChunk()     : ~4.1 ms / chunk
------------------------------------
total           : ~11.3 ms / chunk (hors BufferGeometry + upload GPU)
```

Coût réel par frame, en régime établi, en fonction de la distance au spawn
(58 mobs vivants, `renderDistance = 6`) :

| Position joueur | ms / frame |     FPS | **générations de chunk / frame** |
| --------------: | ---------: | ------: | -------------------------------: |
|          (0, 0) |        4.2 |    ~240 |                            **0** |
|        (48, 48) |       17.5 |      57 |                              4.0 |
|        (72, 72) |       34.5 |      29 |                              9.0 |
|        (88, 88) |       71.6 |      14 |                             19.2 |
|      (104, 104) |      103.9 | **9.6** |                             28.3 |
|      (130, 130) |      103.8 |     9.6 |                             30.2 |
|      (180, 180) |      116.6 |     8.6 |                             33.0 |
|      (260, 260) |      126.4 | **7.9** |                             35.7 |

Le nombre de générations sature à ~35 — soit **exactement** le nombre de chunks
distincts occupés par les 58 mobs (mesuré : 33 chunks, tous dans l'intervalle
`cx, cz ∈ [-4, 3]`, c.-à-d. autour du spawn). Le FPS plancher mesuré (7.9) correspond
au chiffre rapporté par le joueur (« 10 fps ou même 7 »).

### Preuve A/B décisive

Au **même endroit** (100, 100), même monde, même seed, en retirant puis en remettant
**les mêmes** objets mob dans la boucle `update` :

|                                    | ms / frame |      FPS | générations / frame |
| ---------------------------------- | ---------: | -------: | ------------------: |
| mobs retirés de la boucle `update` |    **2.4** |      420 |               **0** |
| les mêmes mobs remis               |   **89.4** | **11.2** |            **24.3** |

**×37 de ralentissement, imputable à 100 % à la boucle de mise à jour des mobs.**
Les générations tombent à zéro dès que les mobs ne sont plus simulés : les nouveaux
chunks autour du joueur ne coûtent rien une fois le disque de rendu rempli.

### Cause racine (le vrai bug — 95 % du problème)

**Les mobs, restés près du spawn, régénèrent en boucle les chunks déchargés, à chaque frame.**

Chaîne exacte :

1. `mobSystem.spawnMobs()` (`src/main.js:237`) crée **~58 mobs** dans un carré de ±40
   blocs autour de l'origine (`MOB_SPAWN_HALF = 40` ; mesuré : ils dérivent ensuite
   jusqu'à ~56 blocs en errant). Ils ne meurent jamais, ne se dé-spawnent jamais, et
   sont `update()`és **à chaque frame** (`src/entities/mob.js:236`).
2. Chaque `Mob.update()` appelle `collidesAtBox()` 3 à 5 fois
   (`src/entities/mob.js:77`, `:84`, `:137`, `:144`).
3. `collidesAtBox` → `isSolid` → **`getBlock`** (`src/world/world.js:212-219`).
4. **`getBlock` appelle `ensureChunk(cx, cz)`** (`src/world/world.js:215`). Si le chunk
   n'est pas chargé, `ensureChunk` fait une **génération + un meshing + un `scene.add()`
   complets, de façon synchrone**.
5. Quand le joueur est à (100, 100), il est dans le chunk (6, 6). `UNLOAD_DISTANCE = 8`,
   donc les chunks du spawn (dx=-6, dz=-6 → d² = 72 > 64) sont **déchargés**.

Ordre des opérations dans `animate()` :

| Ligne `src/main.js`               | Effet                                          |
| --------------------------------- | ---------------------------------------------- |
| 661 `worldApi.update(player.pos)` | **décharge** les ~35 chunks contenant des mobs |
| 759 `mobSystem.update(...)`       | les mobs les **régénèrent tous**, un par un    |
| 824 `renderer.render(...)`        | ils sont rendus (ils sont dans la scène !)     |
| frame suivante                    | rebelote                                       |

Compteurs relevés en jeu après ~630 frames à (100, 100) : **8 400 générations de chunk
pour 8 249 déchargements**. Un monde sain en produit quelques centaines au total.

Coût mesuré : ~35 chunks × ~3 ms (le navigateur est plus rapide que le bench Node sur
ce chemin) = **~125 ms par frame → 7,9 FPS**. Plus l'allocation / libération de 35
`BufferGeometry` + jusqu'à 70 `InstancedMesh` **par frame**.

**Pourquoi le seuil tombe pile vers 100 blocs :** les mobs occupent les chunks
`cx ∈ [-4, 3]`. Le chunk mob le plus éloigné (`cx = -4`) sort du rayon de déchargement
quand `pcx − (−4) > UNLOAD_DISTANCE = 8`, donc quand `pcx ≥ 5`, soit **x ≥ 80 blocs**.
Puis le nombre de chunks mobs largués — et donc le coût — croît continûment jusqu'à
saturer vers `x ≈ 150` (tous les chunks mobs déchargés). D'où la courbe du tableau
ci-dessus : dégradation progressive à partir de ~80, effondrement complet vers ~100-130.

C'est aussi pourquoi c'est parfaitement fluide au spawn : les chunks des mobs sont
alors dans le rayon chargé, `ensureChunk` est un simple `Map.get`, et le coût est nul.

### Causes secondaires (réelles, mais mineures à côté)

- **B.** `unloadChunk` ne fait jamais `.dispose()` sur les `InstancedMesh` eau/lave
  (`src/world/world.js:205-206`) → fuite de buffers GPU qui grossit à l'exploration.
- **C.** Le budget de chargement est vérifié **après** avoir chargé un chunk
  (`src/world/world.js:304-308`) : on paie donc toujours ≥1 chunk complet (~11-15 ms)
  sur la frame, soit un plafond de ~55 FPS en déplacement continu.
- **D.** `update()` reconstruit chaque frame la liste de 169 candidats **et** fait
  `Array.from(chunks.values())` sur ~113 chunks (`src/world/world.js:289-314`), même
  quand le joueur n'a pas changé de chunk.
- **E.** La boucle de minerais de `generateChunk` fait ~132 000 appels `hash3` par chunk
  (4 minerais × 256 colonnes × ~129 niveaux Y), y compris dans l'air au-dessus du
  terrain (`src/world/generator.js:138-163`). C'est la majorité des 7,2 ms.
- **F.** En 3e personne (F5), `cameraRaycaster.intersectObjects(instancedMeshList)`
  (`src/entities/player.js:169`) teste triangle par triangle **tous** les ~113 meshes
  de chunks, chaque frame — exactement le bug déjà corrigé pour le viseur bloc
  (cf. commentaire `src/main.js:380-386`), mais oublié ici.
- **G.** `raycaster.intersectObjects(mobSystem.mobHitboxes)` teste les ~380 parties de
  corps des 64 mobs, y compris ceux à 200 blocs (`src/main.js:443`).

---

## Phase 1 — Corriger le bug principal (obligatoire)

### 1.1 — `getBlock` ne doit **plus jamais** générer de chunk

Fichier : `src/world/world.js`

Remplacer `getBlock` (lignes 212-219) par :

```js
// Lecture PURE : ne génère jamais de chunk (c'était la cause de la chute de FPS
// en exploration — cf. PERF_PLAN.md §0). Trois retours distincts :
//   - une string  : le nom du bloc
//   - null        : de l'air (ou hors du monde en Y), chunk connu
//   - undefined   : chunk NON CHARGÉ, contenu inconnu
function getBlock(x, y, z) {
  if (y < 0 || y >= CHUNK_Y) return null;
  const [cx, cz] = worldToChunk(x, z);
  const record = chunks.get(chunkKey(cx, cz));
  if (!record) return undefined; // inconnu != air
  const [lx, lz] = worldToLocal(x, z);
  const id = record.data[idx(lx, y, lz)];
  return id ? BLOCK_BY_ID[id] : null;
}
```

> `undefined` est falsy comme `null`, donc **tous** les appelants existants
> (`src/main.js:407`, `:509`, `:526`, `:770`, `:797` et `src/ui/craft.js:10`)
> continuent de fonctionner sans modification. Ne rien changer chez eux.

### 1.2 — `isSolid` traite l'inconnu comme plein

Remplacer `isSolid` (lignes 236-238) par :

```js
// Un chunk non chargé est traité comme PLEIN, pas comme de l'air : sinon toute
// entité située hors de la zone chargée tomberait à travers le monde. Le joueur
// n'atteint jamais ces coordonnées (les chunks se chargent bien avant lui), et un
// mob gelé loin du joueur n'a pas besoin d'une collision exacte.
function isSolid(x, y, z) {
  const t = getBlock(x, y, z);
  if (t === undefined) return true;
  return !!t;
}
```

### 1.3 — `setBlock` garde le droit de charger

`setBlock` (ligne 221) appelle déjà `ensureChunk` : **le laisser tel quel**. Le joueur
ne peut poser/casser qu'à ≤6 blocs, donc le chunk est toujours déjà chargé ; l'appel
est un simple `Map.get` en pratique.

### 1.4 — `getGroundHeight` doit avoir un repli

Remplacer `getGroundHeight` (lignes 269-271) par :

```js
// Si le chunk n'est pas chargé, getBlock renvoie `undefined` partout et le scan
// retournerait 1 (= le joueur/mob apparaîtrait sous terre). On retombe alors sur
// la hauteur de terrain analytique du bruit, qui ne demande aucun chunk.
function getGroundHeight(x, z) {
  const [cx, cz] = worldToChunk(x, z);
  if (!chunks.has(chunkKey(cx, cz))) return getHeight(Math.round(x), Math.round(z)) + 1;
  return computeGroundHeight(getBlock, x, z);
}
```

Ajouter `getHeight` à l'import depuis `./generator.js` en haut du fichier (ligne 15-20) :

```js
import {
  generateChunk,
  getGroundHeight as computeGroundHeight,
  getHeight,
  SEA_LEVEL,
  WORLD_BORDER,
} from './generator.js';
```

### 1.5 — Geler les mobs loin du joueur

Fichier : `src/entities/mob.js`

Ajouter près de `MOB_STEP_HEIGHT` (ligne 38) :

```js
// Rayon (en blocs) au-delà duquel un mob n'est plus simulé du tout. Doit rester
// STRICTEMENT inférieur au rayon de chunks chargés (RENDER_DISTANCE * 16 = 96 blocs
// sur desktop, 64 sur mobile) : un mob simulé hors zone chargée ne verrait que des
// blocs "inconnus" et n'aurait de toute façon aucune collision utile.
const MOB_ACTIVE_RADIUS = 56;
const MOB_ACTIVE_RADIUS_SQ = MOB_ACTIVE_RADIUS * MOB_ACTIVE_RADIUS;
```

Remplacer `update` dans `createMobSystem` (lignes 235-237) par :

```js
function update(dt, playerPos) {
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
```

### 1.6 — Ne pas raycaster les mobs lointains

Fichier : `src/main.js`, fonction `getTargetedMob` (ligne 439-446).

`raycaster.far` vaut 6, mais Three teste quand même la bounding sphere des ~380
parties de corps. Filtrer sur la visibilité posée en 1.5 :

```js
function getTargetedMob() {
  aimRaycast();
  // seuls les mobs actifs (donc visibles, cf. MOB_ACTIVE_RADIUS dans mob.js) sont
  // testés : inutile de faire tester 380 hitboxes à Three pour une portée de 6 blocs.
  const targets = mobSystem.mobHitboxes.filter((p) => p.parent && p.parent.visible);
  if (targets.length === 0) return null;
  const intersects = raycaster.intersectObjects(targets);
  if (intersects.length === 0) return null;
  return { mob: intersects[0].object.userData.mob, dist: intersects[0].distance };
}
```

> Attention : les parties de corps sont enfants du `group` du mob (via `buildBoxModel`).
> Si `p.parent` n'est pas directement le `group` (par ex. un pivot de membre), remonter
> avec `p.userData.mob.group.visible` à la place — c'est plus sûr :
> `const targets = mobSystem.mobHitboxes.filter((p) => p.userData.mob?.group.visible);`
> **Utiliser cette seconde version.**

### 1.7 — Vérification de la Phase 1

1. `npm test` → tout doit passer.
2. `npm run dev`, ouvrir le jeu, marcher jusqu'à (150, 150).
3. Le compteur FPS (coin de l'écran) doit rester **≥ 55**.
4. Revenir au spawn : les mobs doivent être toujours là, vivants, et se remettre à
   bouger en s'approchant.
5. Vérifier qu'aucun mob ne traverse le sol.

**Si le FPS est bon ici, le bug est réglé.** Les phases suivantes sont du confort.

---

## Phase 2 — Fuites et gaspillage par frame

### 2.1 — Libérer les `InstancedMesh` au déchargement

Fichier : `src/world/world.js`, `unloadChunk` (lignes 198-210).

```js
if (record.waterMesh) {
  scene.remove(record.waterMesh);
  record.waterMesh.dispose(); // libère le buffer instanceMatrix côté GPU
  record.waterMesh = null;
}
if (record.lavaMesh) {
  scene.remove(record.lavaMesh);
  record.lavaMesh.dispose();
  record.lavaMesh = null;
}
```

> `InstancedMesh.dispose()` ne touche NI la géométrie NI le matériau (tous deux
> partagés entre chunks) — il ne libère que le buffer d'instances. C'est exactement
> ce qu'on veut ici.

### 2.2 — Budget de chargement vérifié AVANT chaque chunk

Fichier : `src/world/world.js`. Remplacer la boucle de chargement (lignes 302-308) par :

```js
const start = performance.now();
let loaded = 0;
for (const c of candidates) {
  if (loaded >= MAX_CHUNKS_PER_FRAME) break;
  // budget testé AVANT : l'ancienne version chargeait toujours au moins un chunk
  // (~11-15 ms) avant de regarder l'heure, ce qui plafonnait la frame à ~55 FPS
  // en déplacement continu. On garde le tout premier chunk inconditionnel pour
  // ne jamais stagner (sinon on peut ne rien charger indéfiniment).
  if (loaded > 0 && performance.now() - start > CHUNK_LOAD_BUDGET_MS) break;
  ensureChunk(c.cx, c.cz);
  loaded++;
}
```

Et abaisser les constantes (lignes 33-34) :

```js
const CHUNK_LOAD_BUDGET_MS = 8;
const MAX_CHUNKS_PER_FRAME = 2;
```

### 2.3 — Ne recalculer la liste des chunks qu'au changement de chunk

Toujours dans `src/world/world.js`. Remplacer entièrement `update` (lignes 287-315) :

```js
// File de chargement persistante : la liste des chunks manquants et le scan de
// déchargement ne dépendent QUE du chunk où se trouve le joueur. Les recalculer à
// chaque frame (169 candidats + Array.from sur ~113 chunks) était du pur gaspillage
// à 60 Hz alors que le joueur ne change de chunk que toutes les ~3 secondes.
let lastPcx = null;
let lastPcz = null;
let loadQueue = [];

function rebuildLoadQueue(pcx, pcz) {
  loadQueue.length = 0;
  for (let dx = -RENDER_DISTANCE; dx <= RENDER_DISTANCE; dx++) {
    for (let dz = -RENDER_DISTANCE; dz <= RENDER_DISTANCE; dz++) {
      const d2 = dx * dx + dz * dz;
      if (d2 > RENDER_DISTANCE * RENDER_DISTANCE) continue;
      const cx = pcx + dx;
      const cz = pcz + dz;
      if (Math.abs(cx * CHUNK_X) > WORLD_BORDER + CHUNK_X) continue;
      if (Math.abs(cz * CHUNK_Z) > WORLD_BORDER + CHUNK_Z) continue;
      if (!chunks.has(chunkKey(cx, cz))) loadQueue.push({ cx, cz, d2 });
    }
  }
  loadQueue.sort((a, b) => a.d2 - b.d2);
}

function unloadFar(pcx, pcz) {
  for (const record of chunks.values()) {
    const dx = record.cx - pcx;
    const dz = record.cz - pcz;
    if (dx * dx + dz * dz > UNLOAD_DISTANCE * UNLOAD_DISTANCE) unloadChunk(record);
  }
}

function update(playerPos) {
  const [pcx, pcz] = worldToChunk(playerPos.x, playerPos.z);
  if (pcx !== lastPcx || pcz !== lastPcz) {
    lastPcx = pcx;
    lastPcz = pcz;
    rebuildLoadQueue(pcx, pcz);
    unloadFar(pcx, pcz);
  }
  if (loadQueue.length === 0) return;

  const start = performance.now();
  let loaded = 0;
  while (loadQueue.length > 0 && loaded < MAX_CHUNKS_PER_FRAME) {
    if (loaded > 0 && performance.now() - start > CHUNK_LOAD_BUDGET_MS) break;
    const c = loadQueue.shift();
    if (!chunks.has(chunkKey(c.cx, c.cz))) ensureChunk(c.cx, c.cz);
    loaded++;
  }
}
```

> ⚠️ `unloadChunk` fait `chunks.delete(...)`. Itérer sur `chunks.values()` **tout en**
> supprimant est légal pour une `Map` JS (l'entrée supprimée est simplement sautée) —
> c'est pourquoi le `Array.from` d'origine n'est plus nécessaire. Ne pas le remettre.

> ⚠️ Cette version supprime le remplacement de la boucle de la §2.2 (elle est intégrée
> ici). Appliquer §2.2 **ou** §2.3, pas les deux séparément — §2.3 est la version finale.

### 2.4 — Occlusion caméra 3e personne : DDA au lieu du raycast triangle

Créer `src/core/raycast.js` en y **déplaçant** la fonction `voxelRaycast` actuellement
dans `src/main.js` (lignes 387-433), en la rendant paramétrable par un `getBlock` :

```js
// DDA voxel : avance bloc par bloc le long d'un rayon. Coût O(portée en blocs), donc
// indépendant du nombre de chunks chargés — contrairement à
// Raycaster.intersectObjects(chunkMeshList) qui teste chaque triangle de chaque chunk.
export function voxelRaycast(getBlock, origin, dir, maxDist) {
  // ... corps identique à src/main.js:387-433, en remplaçant
  //     worldApi.getBlock(x, y, z)  par  getBlock(x, y, z)
}
```

Puis :

- `src/main.js` : importer `voxelRaycast` depuis `./core/raycast.js`, supprimer la
  copie locale, et appeler `voxelRaycast(worldApi.getBlock, rayEye, rayDir, raycaster.far)`
  dans `getTargetedBlock` (ligne 437).
- `src/entities/player.js` :
  - remplacer le paramètre `instancedMeshList` par `getBlock` dans la signature de
    `createPlayer` (ligne 14) ;
  - supprimer `cameraRaycaster` (ligne 119) ;
  - remplacer le bloc `thirdPerson` (lignes 163-172) par :

```js
    if (thirdPerson) {
      const eyePos = camRayOrigin.set(player.pos.x, player.pos.y + player.height, player.pos.z);
      camForward.set(0, 0, -1).applyEuler(new THREE.Euler(pitch, yaw, 0, 'YXZ'));
      let dist = thirdPersonDistance;
      // DDA voxel plutôt qu'un raycast triangle contre les ~113 meshes de chunks :
      // même correctif que celui déjà appliqué au viseur bloc (cf. core/raycast.js).
      const back = camForward.clone().negate();
      const hit = voxelRaycast(getBlock, eyePos, back, thirdPersonDistance);
      if (hit) dist = Math.max(0.6, hit.dist - 0.3);
      const camPos = eyePos.clone().addScaledVector(camForward, -dist);
      camera.position.copy(camPos);
    } else {
```

- `src/main.js:187` : remplacer `instancedMeshList: worldApi.chunkMeshList,` par
  `getBlock: worldApi.getBlock,`.
- `src/world/world.js` : `chunkMeshList` n'a alors **plus aucun consommateur**.
  Supprimer la constante (ligne 94), le `push` (ligne 181), le `indexOf`/`splice`
  (lignes 201-202) et l'export (ligne 325). Vérifier avec
  `grep -rn "chunkMeshList\|instancedMeshList" src/` qu'il ne reste rien.

### 2.5 — Vérification de la Phase 2

- `npm test`.
- Marcher 2-3 minutes en ligne droite : le FPS ne doit pas décroître avec le temps
  (test de la fuite GPU). Surveiller `performance.memory` ou l'onglet Memory du navigateur.
- Appuyer sur F5 (3e personne) et se coller à un mur : la caméra doit toujours se
  rapprocher au lieu de traverser le décor, sans perte de FPS.

---

## Phase 3 — Réduire le coût brut d'un chunk (7,2 ms → ~3 ms)

### 3.1 — Boucle de minerais : sortir tôt (le gros gain)

Fichier : `src/world/generator.js`, boucle §2 (lignes 138-163).

Aujourd'hui, la boucle appelle `hash3` pour chaque (colonne × niveau Y × minerai),
même dans l'air au-dessus du terrain — ~132 000 appels par chunk, dont ~80 % inutiles.
Un minerai ne peut de toute façon remplacer QUE de la pierre déjà posée.

Ajouter en haut de la fonction `generateChunk` :

```js
const STONE = BLOCK_ID.stone;
```

Puis, dans la boucle `for (let wy = ore.minY; ...)`, insérer en **première** ligne :

```js
          // sortie précoce : un test de tableau typé coûte ~50x moins qu'un hash3, et
          // la grande majorité des cellules de la bande de profondeur est de l'air
          // (au-dessus du terrain) ou déjà creusée par une caverne.
          if (data[idx(lx, wy, lz)] !== STONE) continue;
          if (hash3(wx, wy, wz, ore.id) >= ore.rarity / ore.veinSize) continue;
```

> **Effet de bord assumé, à mentionner dans le commit** : le monde généré n'est plus
> strictement identique à l'ancien. Les rares veines dont le _centre_ tombait dans
> l'air/la terre ne sont plus semées (leurs blocs de bordure en pierre disparaissent).
> Aucun risque de corruption : les diffs sauvegardés sont indexés par position, pas
> par contenu, et `applySavedDiffs` s'applique après. Le rendu visuel est équivalent.

Remplacer aussi `data[idx(tlx, ty, tlz)] === BLOCK_ID.stone` par `=== STONE` dans la
boucle de peinture (ligne 158), et hoister `const rarityPerBlock = ore.rarity / ore.veinSize;`
hors des boucles.

### 3.2 — Mesher : sauter les tranches Y vides

Fichier : `src/render/mesher.js`.

Le terrain moyen culmine vers y≈8-15 alors que `CHUNK_Y = 64` : les 3/4 supérieurs
d'un chunk sont de l'air pur, parcourus deux fois pour rien.

Calculer une fois la hauteur maximale non-vide, et borner les deux passes :

```js
export function meshChunk(data, uvByBlockId) {
  // hauteur du plus haut bloc non-vide du chunk : au-dessus, tout est de l'air, il est
  // inutile de balayer les tranches. Un chunk de plaine n'utilise que ~15 des 64 niveaux.
  let maxY = -1;
  for (let i = data.length - 1; i >= 0; i--) {
    if (data[i]) {
      maxY = Math.floor(i / (CHUNK_X * CHUNK_Z));
      break;
    }
  }
  if (maxY < 0) {
    // chunk entièrement vide (ne devrait pas arriver, mais évite d'allouer pour rien)
    return {
      positions: new Float32Array(0),
      normals: new Float32Array(0),
      uvs: new Float32Array(0),
      indices: new Uint16Array(0),
    };
  }
  const yLimit = Math.min(CHUNK_Y - 1, maxY + 1); // +1 : les faces du dessus du bloc le plus haut

  // ... puis dans les DEUX passes, remplacer
  //     for (let y = 0; y < CHUNK_Y; y++)
  // par
  //     for (let y = 0; y <= yLimit; y++)
```

> `idx(lx, ly, lz) = (ly * CHUNK_Z + lz) * CHUNK_X + lx`, donc l'index plat est
> Y-majeur : `Math.floor(i / (CHUNK_X * CHUNK_Z))` donne bien le Y. Ne pas changer
> l'ordre des boucles imbriquées (`x → y → z`) : `test/mesher.test.js` en dépend
> potentiellement pour l'ordre des sommets.
>
> La fonction `get()` interne **doit garder** son test complet sur `CHUNK_Y`, pas sur
> `yLimit` — sinon les faces du haut ne seraient pas générées correctement.

### 3.3 — Vérification de la Phase 3

- `npm test` — en particulier `test/generator.test.js` et `test/mesher.test.js`.
  Si un test asserte un nombre exact de blocs de minerai, il faudra l'ajuster : le
  changer pour asserter un _intervalle_ (`> 0` et `< un plafond`) plutôt qu'une valeur
  exacte, en documentant pourquoi dans le test.
- Re-mesurer :

```bash
node --input-type=module -e "import { generateChunk } from './src/world/generator.js'; import { meshChunk } from './src/render/mesher.js'; const uv={}; for(let i=1;i<20;i++) uv[i]={top:[0,0,1,1],bottom:[0,0,1,1],side:[0,0,1,1]}; let t0=performance.now(),g; for(let i=0;i<20;i++) g=generateChunk(10+i,10); console.log('gen', ((performance.now()-t0)/20).toFixed(2), 'ms'); t0=performance.now(); for(let i=0;i<20;i++) meshChunk(g.data, uv); console.log('mesh', ((performance.now()-t0)/20).toFixed(2), 'ms');"
```

Objectif : gen < 3,5 ms, mesh < 2 ms.

---

## Phase 4 — (Optionnel) Web Worker

Uniquement si, après les phases 1-3, un micro-stutter reste visible au franchissement
de chunk. C'est le point laissé de côté dans `PLAN.md` §Phase 5.3.

Principe : `generateChunk` et `meshChunk` sont **purs** (aucun import Three.js, aucun
accès DOM) — ils sont déplaçables tels quels dans un worker.

1. `src/world/chunk-worker.js` : `onmessage` reçoit `{cx, cz, uvByBlockId}`, appelle
   `generateChunk` puis `meshChunk`, et `postMessage` le résultat en transférant les
   `ArrayBuffer` (`positions.buffer`, `normals.buffer`, `uvs.buffer`, `indices.buffer`,
   `data.buffer`) via la liste de transfert — zéro copie.
2. `ensureChunk` devient asynchrone : il pose un placeholder dans `chunks`
   (`{ pending: true }`), envoie la requête, et construit le `THREE.Mesh` à la réponse.
3. Conséquence à gérer : `applySavedDiffs` doit être appliqué **côté worker** (passer
   `diffs[key]` dans le message) sinon le mesh renvoyé ignorerait les modifications du
   joueur.
4. `setBlock` sur un chunk `pending` doit être mis en file d'attente et rejoué à l'arrivée.

Ne **pas** entreprendre cette phase avant d'avoir mesuré que les phases 1-3 ne suffisent pas.

---

## Récapitulatif des fichiers touchés

| Fichier                  | Phase | Nature                                                                                                 |
| ------------------------ | ----- | ------------------------------------------------------------------------------------------------------ |
| `src/world/world.js`     | 1, 2  | `getBlock` pur, `isSolid`, `getGroundHeight`, dispose, file de chargement, suppression `chunkMeshList` |
| `src/entities/mob.js`    | 1     | gel des mobs hors rayon actif                                                                          |
| `src/main.js`            | 1, 2  | filtre hitboxes, import `voxelRaycast`, câblage `getBlock` du joueur                                   |
| `src/core/raycast.js`    | 2     | **nouveau** — `voxelRaycast` partagé                                                                   |
| `src/entities/player.js` | 2     | DDA au lieu du raycast triangle en 3e personne                                                         |
| `src/world/generator.js` | 3     | sortie précoce de la boucle de minerais                                                                |
| `src/render/mesher.js`   | 3     | bornage des tranches Y vides                                                                           |

## Ordre de commit suggéré

1. `perf(world): stop generating chunks from getBlock, freeze distant mobs` (Phase 1)
2. `perf(world): dispose instanced meshes, rebuild chunk queue only on chunk change` (Phase 2.1-2.3)
3. `perf(player): voxel DDA for third-person camera occlusion` (Phase 2.4)
4. `perf(gen): early-out on non-stone in ore pass, skip empty Y slices when meshing` (Phase 3)
