# Minicrafter — Architecture

> Ce document décrit l'état du code après les phases 10–20 et 22 de `PLAN.md`.
> Il est censé pouvoir être écrit (ou réécrit) par la personne qui apprend sur ce
> projet — s'il est faux ou incompréhensible, c'est que le code est trop compliqué,
> pas que la doc est mal écrite.

## Principe général

Le jeu tourne dans le navigateur, sans étape de build : `index.html` charge
`src/main.js` comme module ES natif, qui importe tout le reste. Pas de bundler,
pas de `npm run build` — `git push` suffit à déployer (GitHub Pages sert les
fichiers tels quels).

Chaque système du jeu suit la même règle : **séparer l'état pur du rendu**. Un
fichier qui ne touche ni au DOM ni à Three.js est testable avec `node --test`, sans
navigateur. C'est le fil rouge de tout le projet.

## Carte des dossiers

```
src/
├── main.js          wiring uniquement : construit tout, lance la boucle animate()
├── core/             utilitaires transverses, sans dépendance au reste du jeu
│   ├── events.js      bus pub/sub (l'UI s'abonne, le jeu émet)
│   ├── math.js        bruit 2D/3D, hash déterministe, rng
│   ├── raycast.js      DDA voxel — sert au viseur ET à la ligne de vue des mobs
│   └── commands.js    parseur de commandes chat (/give, /tp...), pur
├── data/              pure donnée, jamais de logique
│   ├── blocks.js       BLOCK_TYPES (id, hardness, texture, drops, liquid...)
│   ├── items.js        ITEM_NAMES, RECIPES, FOOD, TOOL_CATEGORY
│   ├── mobs.js         MOBS (stats + modèle en boîtes)
│   ├── recipes.js      SMELTING, FUELS (fourneau)
│   └── commands.js     table des commandes chat (nom -> arité + aide)
├── world/             tout ce qui décrit le monde voxel
│   ├── chunk.js         Uint8Array + index math                    [PUR]
│   ├── generator.js     terrain, biomes, océans/rivières, grottes  [PUR]
│   ├── biomes.js        température/humidité -> biome              [PUR]
│   ├── light.js         BFS de lumière de bloc                     [PUR]
│   ├── fluid.js         file active d'écoulement eau/lave          [PUR]
│   ├── physics.js       mouvement/gravité/collision du joueur      [PUR]
│   ├── block-entities.js état + horloge des fourneaux
│   ├── world.js          chunk map, streaming, diffs, remesh, collision
│   ├── clouds.js         nuages voxel
│   └── sky.js            cycle jour/nuit, soleil/lune/étoiles
├── render/            Uint8Array -> BufferGeometry, aucune logique de jeu
│   ├── textures.js      canvas procéduraux (zéro asset externe)
│   ├── block-assets.js  matériaux + icônes hotbar/inventaire
│   ├── atlas.js         atlas de texture + table d'UV
│   └── mesher.js         chunk -> géométrie (opaque + liquide séparée)  [PUR]
├── entities/          "choses dans le monde qui ne sont pas des blocs"
│   ├── entity.js         base commune (gravité + collision)        [PUR-ish]
│   ├── inventory.js      slots, addItem/removeItem/moveSlot        [PUR]
│   ├── item-entity.js    items au sol (drops), pool InstancedMesh
│   ├── particles.js      particules de cassage, même pool par type
│   ├── model.js, limb.js construction de modèles en boîtes
│   ├── mob.js             IA (errance/chasse/ligne de vue), tonte
│   ├── boat-physics.js    règles du bateau, tic fixe 20 Hz          [PUR]
│   ├── boat.js            bateaux : modèle, tics, coups, passager
│   └── player.js          caméra, avatar 3e personne, main/objet tenu
├── ui/                DOM only, aucune logique de jeu
│   ├── hud.js, hotbar.js, health.js, hunger.js, craft.js, furnace.js,
│   │   chat.js, touch.js, style.css
├── audio/             sfx.js (Web Audio synthétisé), music.js
└── worker/            chunk-worker.js — génération+meshing hors-thread,
                        CORRECT et TESTÉ mais pas câblé (cf. son en-tête)
```

## Le flux d'une frame

`main.js` — `animate()`, appelée par `requestAnimationFrame` :

1. Ciel, nuages, textures d'eau/lave animées.
2. `worldApi.update(pos, dt)` : charge/décharge les chunks proches, avance la file
   d'écoulement des liquides (Phase 16).
3. Lumière des torches proches (pool de 8 `PointLight`, recalculé 2x/s).
4. Particules, feedback de pose.
5. Si aucun menu n'est ouvert : lecture des entrées, faim/soif/noyade, physique
   (`world/physics.js`), mobs, items au sol.
6. HUD (position, bloc visé), cassage progressif.
7. `renderer.render(scene, camera)`.

## Le monde : chunks, pas une grille infinie en mémoire

`world/chunk.js` définit un chunk comme un `Uint8Array` de `16×64×16` = 16384
octets — un id de bloc par octet, `0` = air. `world/world.js` garde une `Map` de
chunks chargés (clé `"cx,cz"`), streamés autour du joueur : chargés dans un rayon
(`renderDistance`), déchargés au-delà. Les modifications du joueur sont stockées à
part (`diffs`, dans `localStorage`) et réappliquées au rechargement — le chunk
lui-même n'est jamais sauvegardé, il est régénéré (déterministe) puis rejoué.

## Eau et lave sont des blocs (Phase 16)

Avant la Phase 16, l'eau et la lave vivaient dans des listes à part
(`waterCells`/`lavaCells`), dessinées comme des `InstancedMesh` séparés du chunk.
Ça cassait le culling de face (un mur de terre à côté d'un lac dessinait quand même
sa face cachée) et empêchait tout écoulement.

Depuis la Phase 16 : eau et lave sont des `BLOCK_TYPES` normaux (`liquid: true,
solid: false`), écrites directement dans le `Uint8Array` du chunk par le
générateur. `render/mesher.js` a deux passes : `meshChunk` (blocs opaques, culling
contre "opaque OU non chargé", jamais contre un liquide) et `meshLiquid` (une passe
par liquide, face émise seulement contre de l'air ou un AUTRE liquide). `world/
fluid.js` gère l'écoulement : une file ACTIVE de cellules à réévaluer (jamais un
balayage du monde), alimentée quand un bloc devient de l'air à côté d'un liquide.

## Lumière (Phase 13)

`world/light.js` fait un BFS classique sur un `Uint8Array` de niveaux 0-15 par
chunk : `propagate()` étale la lumière depuis des sources (torches, lave, ciel
ouvert), `removeLight()` éteint une source puis "resparkle" depuis les cellules
encore éclairées par une AUTRE source trouvées à la frontière de la zone éteinte —
c'est la partie difficile, testée explicitement (`test/light.test.js`). Le mesher
écrit ce niveau comme une couleur par sommet (`vertexColors: true`), zéro appel de
rendu supplémentaire.

Limite assumée (v1) : le BFS s'arrête aux bords du chunk, pas de repropagation
inter-chunks. Documenté dans `world/light.js` et `PLAN.md`.

## Biomes, océans, rivières (Phase 17)

`world/biomes.js` ajoute deux champs de bruit (température, humidité) échantillonnés
par colonne, comme `getHeight` l'est déjà. `generator.js` compose TROIS bruits de
plus pour façonner le relief : `mountainMaskAt` (déjà là avant), `oceanCarve`
(continentalness, pousse une grande zone sous le niveau de la mer) et `riverCarve`
(bruit "ridged", carve un canal étroit). Tout est une fonction continue de `(x, z)`
mélangée par `lerp`, donc jamais de falaise nette à une frontière — c'est la seule
façon dont un monde infini généré à la volée peut rester cohérent entre deux chunks
sans coordination.

**Non fait, volontairement** (cf. `PLAN.md` Phase 17.1 et le risque documenté) :
`CHUNK_Y` reste à 64 et `SEA_LEVEL` à 4. Les faire passer à 128/40 demanderait de
retuner presque toutes les constantes du générateur (grottes, minerais, arbres,
neige) pour un monde 2x plus haut — un travail d'équilibrage itératif, pas un
changement de code, hors budget de cette session.

## Inventaire à slots (Phase 10)

`entities/inventory.js` est un tableau de 36 emplacements (9 hotbar + 27 sac à
dos), pas un dictionnaire `{item: count}`. `addItem`/`removeItem`/`moveSlot` sont
pures et testées en détail (remplissage de stacks partiels avant d'ouvrir un
nouveau slot, fusion capée à `MAX_STACK`, etc.). Casser un bloc ne remplit plus
l'inventaire directement : `entities/item-entity.js` fait apparaître les drops au
sol (un `InstancedMesh` PAR TYPE D'ITEM, jamais un `Mesh` par item — la même leçon
de perf que les particules de cassage et les mares d'eau/lave).

## Pack de textures 16x16 (Phase 37)

`render/textures-select.js` choisit entre les textures procédurales de base
(`render/textures.js`) et un pack `render/textures-16.js` : une vraie grille de 16x16
cases par face (même technique que `texBoat` : palette de couleurs + 16 lignes de 16
caractères, cf. `pixelTex`), obtenue en réduisant chaque texture de base et en
regroupant ses couleurs (k-means, ~10 teintes). `render/atlas.js` (l'atlas de blocs du
mesher) et `render/block-assets.js` passent tous les deux par ce sélecteur au lieu
d'importer `textures.js` directement, pour que le réglage s'applique partout d'un coup.

Ne couvre que les 49 FACES DE BLOC du monde (celles listées dans `atlas.js`) ; outils,
nourriture, mobs et états on/off (redstone, leviers...) restent sur la texture de base
dans les deux modes. Le réglage (`localStorage`, menu Options -> Textures) est lu une
seule fois au chargement de la page : le changer recharge la page plutôt que de
reconstruire l'atlas et tous les chunks déjà maillés à chaud.

`tools/gen-pixel16.mjs` régénère `textures-16.js` (nécessite `npm install --no-save
canvas`, seule dépendance de ce script -- pas du jeu).

## Le bateau (Phase 36)

Deux fichiers, séparés comme le joueur (`world/physics.js`) et le rendu :

- `entities/boat-physics.js` : PURE (aucun import), donc testée sous `node --test`
  (`test/boat.test.js`). Elle porte les règles du vrai jeu à l'identique : tic fixe
  de 20 Hz, vitesse en blocs/tic, friction 0.9 sur l'eau / 0.6 à terre / 0.98 sur la
  glace, poussée d'Archimède (le bas du bateau flotte 0.366 sous la surface), virage
  qui dérive, coule s'il est entièrement sous l'eau (le passager est éjecté après 60
  tics), se brise en tombant de plus de 3 blocs. Un bateau a `y` = le BAS de sa boîte.
- `entities/boat.js` : le système (`createBoatSystem`) — modèle 3D (planches du jeu,
  masque d'eau qui n'écrit que la profondeur pour que la surface n'apparaisse pas
  « dans » la coque), simulation interpolée entre deux tics (rendu à la fréquence de
  l'écran), coups (5 à mains nues, 1 à l'épée), passager.

Côté `main.js` seul le joueur change : assis, il n'a plus de marche/gravité/saut, sa
position est accrochée à la position INTERPOLÉE du bateau à chaque frame, son regard
tourne avec le bateau (±105° max) et `updateVisuals` reçoit `ride` pour l'asseoir. Les
bateaux ne sont pas sauvegardés (comme les mobs et les objets au sol) et restent dans
l'overworld. L'objet est un item 2D (`toolTextures` + `iconCanvas`), non empilable
(`ITEM_MAX_STACK` dans `entities/inventory.js`, appliqué partout où des piles fusionnent).

## Ce que le worker (Phase 20) fait et ne fait pas

`src/worker/chunk-worker.js` existe, est correct, et est vérifié par test
(`test/chunk-worker.test.js` compare sa sortie à l'appel synchrone direct). Il
n'est **pas branché** dans `world/world.js` : le compteur FPS n'a jamais montré le
problème qu'il résout pendant cette session (60 FPS stable, y compris pendant les
Phases 16/17). Le brancher en vrai demanderait de rendre le cycle de vie d'un chunk
asynchrone dans `world.js` — un chantier à part, à faire le jour où le FPS le
réclame, pas avant (cf. le principe du plan : mesurer avant d'optimiser).

## Tests

`node --test` couvre tous les modules PURS listés ci-dessus (plus de 90 tests).
Rien qui touche à Three.js ou au DOM n'est testé automatiquement — c'est un choix
délibéré (cf. `PLAN.md` §1 principe 4), pas un oubli.
