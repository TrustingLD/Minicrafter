# Minicrafter — Ce que chaque phase enseigne

> Une page par concept, dans l'ordre où le code les rencontre. Chaque section pointe
> vers le fichier où le concept est le plus visible — va lire le code à côté du texte,
> pas l'un à la place de l'autre.

## État vs représentation (Phase 10 — `entities/inventory.js`)

L'inventaire est un tableau de données brutes (`{item, count}` ou `null`), qui ne
sait rien de Three.js. Le rendu (`ui/hotbar.js`) le LIT pour dessiner des `<div>`,
mais ne le modifie jamais directement. Cette séparation permet de tester
`addItem`/`removeItem` avec `node --test`, sans navigateur — et c'est pour ça que
ces fonctions n'ont jamais de bug une fois les tests écrits en premier.

La leçon jumelle : "extraire la classe de base" (`entities/entity.js`) bat "copier
le code de gravité du mob". Item-entity.js et mob.js partagent EXACTEMENT la même
physique verticale parce qu'elle vit à un seul endroit.

## Tables au lieu de `if`/`switch` (Phase 15 — `core/commands.js`, `data/commands.js`)

Une commande = une entrée dans un objet (`{ args, help }`), pas une branche dans un
`if`. Ajouter `/heal` n'a touché ni le parseur ni la boucle d'événements — juste la
table. Le parseur (`parseCommand`) ne connaît RIEN du jeu ; il valide juste "ce nom
existe, cette arité est bonne" et renvoie `{ error }` ou `{ name, args }`. Les
handlers (dans `main.js`) sont la SEULE partie qui touche à l'état du jeu — testable
séparément du parseur, qui lui n'a besoin d'aucun navigateur pour être testé.

## Rate vs event (Phase 11 — la faim, `main.js`)

Deux formes reviennent partout dans un jeu de survie : un **taux** (`-= rate * dt`,
la faim qui descend en continu) et un **event à cooldown** (un tic de dégâts toutes
les 4s, pas à chaque frame). La lave (déjà là avant) suit la même deuxième forme.
Une fois qu'on voit que "dégâts de lave" et "famine" sont le MÊME patron, ajouter la
noyade ne demande pas de réfléchir à une nouvelle mécanique, juste de la réutiliser.

## Réutiliser un algorithme pour autre chose (Phase 12 — `core/raycast.js`)

`voxelRaycast` (DDA) a été écrit pour "quel bloc vise le joueur ?". Il répond
exactement aussi bien à "le zombie voit-il le joueur, ou y a-t-il un mur entre les
deux ?" (`entities/mob.js`, `canSeeTarget`). Rien n'a été réécrit — un algorithme
correctement isolé dans son propre fichier PUR se réutilise gratuitement pour un
problème qui n'a l'air d'avoir aucun rapport au premier abord.

## BFS : un vrai algorithme, un vrai résultat visible (Phase 13 — `world/light.js`)

Propager la lumière d'une torche est un BFS classique (file, on avance d'un niveau
à chaque saut, on s'arrête à 0). La partie difficile n'est pas de L'ALLUMER — c'est
de bien l'ÉTEINDRE : casser une torche ne peut pas juste écrire des zéros, il faut
retirer tout ce qui ne tenait SA lumière que d'elle, puis "resparkle" depuis les
cellules encore alimentées par une autre source. `test/light.test.js` a un test
dédié à ce cas précis (deux torches, on en casse une, l'autre doit continuer
d'éclairer) — c'est le test qui a trouvé le vrai bug de cette phase (une condition
`>` au lieu de `>=` qui empêchait le rallumage).

## Simulation à son propre tic (Phase 14 — `world/block-entities.js`)

Un fourneau avance MÊME QUAND le joueur ne regarde pas — c'est la première fois que
le jeu a un état qui vit dans le monde et progresse tout seul, à son propre rythme
(4 Hz), indépendant du framerate. `tickFurnace` est une fonction pure : donne-lui un
état et un `dt`, elle te rend le nouvel état — testable sans jamais ouvrir le jeu
(`test/block-entities.test.js`).

## Cellulaire actif, pas un balayage (Phase 16 — `world/fluid.js`)

Un automate cellulaire naïf reteste TOUT le monde à chaque tic. `stepFluidQueue`
ne reteste QUE les cellules ajoutées à une file active — un bloc cassé à côté d'une
mare y ajoute ses voisins liquides, et seuls ceux-là (et ce qu'ils engendrent) sont
réévalués. Un lac entier au repos ne coûte rien tant que personne n'y touche. C'est
le même principe que le chargement de chunks (Phase 4a) : ne fais le travail que là
où quelque chose a VRAIMENT changé.

La deuxième leçon de cette phase : une bonne structure de donnée résout deux
problèmes à la fois. Une fois que l'eau est un vrai bloc du chunk (au lieu d'une
liste à part), le culling de face ET l'écoulement en découlent — aucun des deux
n'a demandé de "code spécial pour l'eau", juste la structure de donnée qu'il fallait.

## Composer des champs de bruit (Phase 17 — `world/generator.js`, `world/biomes.js`)

`getHeight(x, z)` est une fonction PURE des coordonnées — pas d'état, pas de
mémoire d'un chunk à l'autre. Ça veut dire qu'on peut ajouter un champ de bruit de
plus (montagnes, lacs, océans, rivières...) et les MÉLANGER (addition, `lerp`) sans
jamais avoir à coordonner deux chunks voisins : la même formule, évaluée à la même
coordonnée, donne toujours le même résultat, où qu'on la calcule. C'est ce qui rend
un monde infini, streamé, redémarrable, possible du tout.

## Un pool partagé bat un objet par instance (Phases 10, 19 — `entities/item-entity.js`, `entities/particles.js`)

Un `THREE.Mesh` par item au sol, ou par particule de cassage, ferait des centaines
d'appels de rendu dès qu'on mine un peu. Un seul `InstancedMesh` PAR TYPE (pas par
instance) fait le même travail visuel en un seul appel de rendu, quel que soit le
nombre d'items/particules actifs (jusqu'à la capacité du pool). C'est la même leçon
que l'eau/la lave (Phase 4c) et l'atlas de texture (Phase 5) : grouper par TYPE,
pas par INSTANCE.

## Mesurer avant d'optimiser (Phase 20 — `src/worker/chunk-worker.js`)

Le worker existe, est correct, testé — et n'est PAS branché dans le jeu. Le
compteur FPS n'a jamais montré le problème qu'il résout. Écrire l'infrastructure
"au cas où" sans mesurer d'abord est exactement le genre de travail que le plan dit
explicitement de ne PAS faire. Le fichier est prêt ; le brancher est un TODO
explicite, pas un oubli — et le jour où il le faudra, ce sera visible dans le
compteur FPS avant d'être visible dans le code.
