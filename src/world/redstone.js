// Redstone (Phase 22) : simulation de circuit façon vrai Minecraft, au-dessus
// d'un monde qui ne stocke qu'un id de bloc par cellule (pas de métadonnées,
// cf. world/chunk.js) -- tout l'état "vivant" (qui est actuellement une
// source, le minuteur d'un répéteur/bouton...) vit donc ICI, en mémoire, pas
// dans le Uint8Array du chunk. Les diffs (world/world.js) persistent bien
// l'id de chaque bloc (donc un circuit reste visuellement intact après un
// rechargement de chunk), mais PAS ces minuteurs -- un répéteur en cours de
// délai retombe simplement à "pas de retard en cours" après un rechargement
// de page, il se resynchronise tout seul au tic suivant. Assumé, comme les
// autres simplifications déjà documentées dans ce projet (cf. torches/
// PointLight au chargement, PLAN.md).
//
// Modèle de propagation (simplifié par rapport au vrai jeu, documenté ici
// plutôt que caché) :
//  - Chaque source (levier/bouton allumés, torche allumée, bloc de redstone,
//    sortie d'un répéteur allumé) émet un niveau 15.
//  - Le FIL (poussière) perd 1 niveau par bloc traversé, jusqu'à 0 -- comme
//    le vrai jeu, jusqu'à 15 blocs de portée.
//  - Un bloc plein "conducteur" (cf. isRedstoneConductor) touché par une
//    source ou par du fil devient lui-même porteur de CE niveau (sans perte
//    supplémentaire, comme le vrai jeu) et le relaie à ses AUTRES faces --
//    mais seulement vers d'autres composants de redstone (fil, torche,
//    répéteur, lampe, piston, porte), jamais vers un AUTRE bloc plein
//    ordinaire (sinon un levier illuminerait toute une montagne de pierre).
//    C'est la différence entre "puissance faible/forte" du vrai jeu,
//    fusionnée ici en une seule règle plus simple.
//  - Les torches et les répéteurs ont un délai d'1 tic avant de changer d'état
//    (c'est ce qui rend les horloges/oscillateurs possibles, comme dans le
//    vrai jeu) ; le fil, les lampes, les pistons et les portes réagissent
//    instantanément.
//  - Non modélisé (limite assumée) : distinction puissance faible/forte fine,
//    comparateurs, pistons collants, câblage vertical du fil (il ne grimpe
//    pas tout seul le long d'un escalier de blocs).

import { BLOCK_TYPES } from '../data/blocks.js';

export const MAX_POWER = 15;
export const REPEATER_DELAY = 0.3; // s avant qu'un répéteur ne (dé)verrouille sa sortie
export const BUTTON_TIME = 1.0; // s avant qu'un bouton pressé ne revienne tout seul à OFF
const TICK_RATE = 0.1; // 10 Hz -- assez rapide pour rester réactif, assez lent pour rester lisible

export const FACINGS = ['north', 'south', 'east', 'west'];
export function facingDelta(facing) {
  switch (facing) {
    case 'north':
      return [0, 0, -1];
    case 'south':
      return [0, 0, 1];
    case 'east':
      return [1, 0, 0];
    case 'west':
      return [-1, 0, 0];
    default:
      return [0, 0, 0];
  }
}
const NEI6 = [
  [1, 0, 0],
  [-1, 0, 0],
  [0, 1, 0],
  [0, -1, 0],
  [0, 0, 1],
  [0, 0, -1],
];

export function isWireName(name) {
  return typeof name === 'string' && name.startsWith('redstone_wire_');
}
export function wirePowerFromName(name) {
  return isWireName(name) ? parseInt(name.slice('redstone_wire_'.length), 10) : 0;
}
export function wireNameForPower(p) {
  return `redstone_wire_${Math.max(0, Math.min(MAX_POWER, p))}`;
}

// bloc plein "ordinaire" (pierre, terre, bois...) qui relaie un signal touché
// sur une face vers ses autres faces -- cf. le grand commentaire en tête de
// fichier. Un bloc à `shape` réduite (torche, fil, répéteur...) n'est jamais
// un conducteur (il PORTE son propre sens), ni un liquide/bloc transparent/
// bloc explicitement marqué `nonConductor` (lampe, piston, bloc de redstone).
function isRedstoneConductor(name) {
  if (!name) return false;
  const b = BLOCK_TYPES[name];
  if (!b) return false;
  if (b.solid === false) return false;
  if (b.liquid) return false;
  if (b.shape) return false;
  if (b.transparent) return false;
  if (b.nonConductor) return false;
  return true;
}

// un bloc "posé au sol" (fil/torche/levier/bouton/répéteur) a besoin d'un
// support plein en dessous, sinon il se détache tout seul (cf. step()).
function hasSolidSupport(supportName) {
  if (!supportName) return false;
  const b = BLOCK_TYPES[supportName];
  return !!b && b.solid !== false && !b.liquid;
}

function isRedstoneComponentName(name) {
  if (!name) return false;
  return (
    isWireName(name) ||
    name === 'redstone_torch_off' ||
    name === 'redstone_torch_on' ||
    name === 'lever_off' ||
    name === 'lever_on' ||
    name === 'button_off' ||
    name === 'button_on' ||
    name === 'redstone_lamp_off' ||
    name === 'redstone_lamp_on' ||
    name === 'redstone_block' ||
    name.startsWith('repeater_') ||
    name.startsWith('piston_base_') ||
    name.startsWith('door_bottom_') ||
    name.startsWith('door_top_')
  );
}

// tout ce qui peut être un "nœud" suivi par le système : source, transmetteur
// ou consommateur. C'est la fonction que main.js appelle pour savoir s'il
// faut notifier ce système d'un bloc posé/cassé.
export function isRedstoneRelevant(name) {
  return isRedstoneComponentName(name);
}

export function createRedstoneSystem({ getBlock, setBlock, spawnDrop, toggleDoor }) {
  // "x,y,z" -> { x, y, z } -- positions déjà rencontrées (posées ou observées)
  // qui méritent d'être réévaluées à chaque tic. On n'y ajoute QUE ce que
  // main.js nous signale explicitement (placement/casse/bascule) -- pas de
  // scan du monde, cf. commentaire en tête de fichier sur la limite que ça implique.
  const nodes = new Map();
  const repeaterTimers = new Map(); // "x,y,z" -> { target: 'on'|'off', remaining }
  const buttonTimers = new Map(); // "x,y,z" -> remaining (s)

  const key = (x, y, z) => `${x},${y},${z}`;

  function notify(x, y, z, present = true) {
    const k = key(x, y, z);
    if (present) nodes.set(k, { x, y, z });
    else {
      nodes.delete(k);
      repeaterTimers.delete(k);
      buttonTimers.delete(k);
    }
  }

  // ---------- calcul du niveau de puissance de chaque cellule ----------
  // Retourne { power, conductorPower } : deux Map "x,y,z" -> niveau (0..15).
  // `power` couvre le fil et les composants de redstone eux-mêmes ;
  // `conductorPower` couvre les blocs pleins ordinaires touchés en chemin.
  function computePowerMap() {
    const power = new Map();
    const conductorPower = new Map();
    const visited = new Map();
    const queue = [];
    let processed = 0;

    function push(x, y, z, level) {
      if (level <= 0) return;
      queue.push({ x, y, z, level });
    }

    for (const n of nodes.values()) {
      const name = getBlock(n.x, n.y, n.z);
      if (name === 'lever_on' || name === 'button_on' || name === 'redstone_block') {
        push(n.x, n.y, n.z, MAX_POWER);
      } else if (name === 'redstone_torch_on') {
        push(n.x, n.y, n.z, MAX_POWER);
      } else if (name && name.startsWith('repeater_') && name.endsWith('_on')) {
        // Sa cellule de sortie (`facing`) est poussée dans la file comme une
        // source normale (relaie vers fil/conducteurs devant lui). Sa PROPRE
        // cellule est enregistrée directement dans `power` (pas via la file) :
        // ça permet à un consommateur qui le touche directement (lampe/piston
        // collé à sa sortie) de le détecter, SANS le laisser relayer vers les
        // 4 autres faces via la boucle générique plus bas -- un répéteur ne
        // doit alimenter que ce qu'il a devant lui, jamais sur les côtés/
        // l'arrière (simplification : un consommateur collé à un AUTRE côté
        // que la sortie le détectera aussi ici, ce que le vrai jeu ne fait
        // pas -- accepté pour rester simple, cf. tête de fichier).
        const facing = name.split('_')[1];
        const [dx, dy, dz] = facingDelta(facing);
        power.set(key(n.x, n.y, n.z), MAX_POWER);
        push(n.x + dx, n.y + dy, n.z + dz, MAX_POWER);
      }
    }

    // BFS "plus fort d'abord" (comme la vraie poussière de redstone : un
    // niveau plus élevé écrase toujours un passage antérieur plus faible).
    // Nombre de sources/composants toujours petit (circuit du joueur, pas le
    // monde entier) -- un scan linéaire du meilleur candidat à chaque pop
    // reste largement assez rapide, pas besoin d'un tas de priorité ici.
    //
    // Règle de décroissance (cf. tête de fichier) : chaque saut FIL -> FIL
    // coûte 1 niveau ; un bloc plein "conducteur" touché par du fil/une source
    // devient porteur du MÊME niveau (aucune perte, comme le vrai jeu), mais
    // EN RESSORTIR vers du fil coûte de nouveau 1 niveau -- c'est ce qui
    // borne la propagation (sinon un chemin qui alterne fil/bloc/fil/bloc
    // sans jamais 2 fils consécutifs ne perdrait JAMAIS de niveau).
    while (queue.length > 0 && processed < 6000) {
      let bi = 0;
      for (let i = 1; i < queue.length; i++) if (queue[i].level > queue[bi].level) bi = i;
      const { x, y, z, level } = queue.splice(bi, 1)[0];
      processed++;
      const k = key(x, y, z);
      if ((visited.get(k) || 0) >= level) continue;
      visited.set(k, level);
      const name = getBlock(x, y, z);

      if (isRedstoneConductor(name)) {
        conductorPower.set(k, Math.max(conductorPower.get(k) || 0, level));
        for (const [dx, dy, dz] of NEI6) {
          const nx = x + dx,
            ny = y + dy,
            nz = z + dz;
          const nname = getBlock(nx, ny, nz);
          if (isWireName(nname)) push(nx, ny, nz, level - 1);
          // NB : on n'enregistre PAS ici les composants (lampe/torche/porte/
          // piston/répéteur) découverts comme voisins d'un conducteur -- leur
          // propre lecture ("suis-je alimenté ?") se fait en lisant directement
          // CE bloc conducteur (conductorPower) au moment voulu (cf. torche :
          // lit le support ; lampe/piston/porte : lisent leurs 6 voisins). Les
          // enregistrer eux-mêmes dans `power` les ferait ensuite passer pour
          // des ÉMETTEURS aux yeux d'un TROISIÈME voisin qui les checkerait à
          // son tour (ex : une lampe collée à une torche ÉTEINTE mais dont le
          // support est alimenté croirait alors, à tort, que la torche émet).
        }
        continue;
      }

      if (isWireName(name) || isRedstoneComponentName(name)) {
        power.set(k, Math.max(power.get(k) || 0, level));
      }
      // seul le fil et les VRAIES sources radiantes (levier/bouton allumés,
      // torche allumée, bloc de redstone) relaient vers leurs 6 voisins -- un
      // composant "passif" juste touché en passant (lampe, porte, piston,
      // répéteur, torche éteinte...) LIT son niveau ci-dessus mais ne le
      // relaie jamais lui-même (sans quoi une lampe alimentée alimenterait à
      // son tour ses propres voisins, ce que le vrai jeu ne fait pas non plus).
      const isRadiatingSource =
        name === 'lever_on' || name === 'button_on' || name === 'redstone_torch_on' || name === 'redstone_block';
      if (!isWireName(name) && !isRadiatingSource) continue;
      for (const [dx, dy, dz] of NEI6) {
        // Une torche allumée ne doit JAMAIS alimenter le bloc sur lequel elle
        // est posée (en dessous) : sinon elle se lirait elle-même comme
        // "support alimenté" au tic suivant -> elle s'éteindrait, se
        // rallumerait, s'éteindrait... une oscillation infinie causée par
        // elle-même plutôt que par un vrai circuit. Le vrai jeu évite ça en
        // ne comptant jamais la torche comme une source de puissance pour SA
        // PROPRE lecture d'inversion -- ici, le plus simple est de ne
        // simplement jamais relayer vers le bas depuis une torche.
        if (name === 'redstone_torch_on' && dx === 0 && dy === -1 && dz === 0) continue;
        const nx = x + dx,
          ny = y + dy,
          nz = z + dz;
        const nname = getBlock(nx, ny, nz);
        if (!nname) continue;
        if (isRedstoneConductor(nname)) push(nx, ny, nz, level); // bloc touché : pas de perte
        else if (isWireName(nname)) push(nx, ny, nz, isWireName(name) ? level - 1 : level);
        // même remarque que dans la branche conducteur ci-dessus : un
        // composant simplement touché ici (lampe/torche/porte/piston/
        // répéteur) n'est PAS enregistré comme émetteur -- sa propre lecture
        // se fait via ses voisins au moment voulu, pas via cette relève.
      }
    }
    return { power, conductorPower };
  }

  // niveau perçu par une cellule (fil/composant direct, ou conducteur touché) --
  // pratique pour lire "cette case est-elle alimentée ?" indépendamment de
  // savoir si c'est un bloc plein ou du fil.
  function levelAt(power, conductorPower, x, y, z) {
    const k = key(x, y, z);
    return Math.max(power.get(k) || 0, conductorPower.get(k) || 0);
  }

  // une des 6 faces voisines porte-t-elle un signal ? (lampe/piston/porte)
  function anyNeighborPowered(power, conductorPower, x, y, z) {
    for (const [dx, dy, dz] of NEI6) {
      if (levelAt(power, conductorPower, x + dx, y + dy, z + dz) > 0) return true;
    }
    return false;
  }

  // ---------- poussée du piston (simplifiée : pas collant, 1 seul bloc) ----------
  function isPushable(name) {
    if (!name) return false;
    const b = BLOCK_TYPES[name];
    if (!b) return false;
    if (b.unbreakable) return false;
    if (b.liquid) return false;
    if (b.isFurnace || b.isChest) return false; // pas de bloc-entité déplacé (perte d'inventaire)
    if (name.startsWith('piston_')) return false;
    if (name.startsWith('door_')) return false; // 2 cellules liées, hors scope simplifié
    if (b.shape) return false; // torche/fil/répéteur... -- laissés en place (comme le vrai jeu casse le fil poussé)
    return true;
  }

  function extendPiston(x, y, z, facing) {
    const [dx, dy, dz] = facingDelta(facing);
    const frontX = x + dx,
      frontY = y + dy,
      frontZ = z + dz;
    const frontName = getBlock(frontX, frontY, frontZ);
    if (frontName) {
      if (!isPushable(frontName)) return; // bloqué, comme dans le vrai jeu
      const beyondX = frontX + dx,
        beyondY = frontY + dy,
        beyondZ = frontZ + dz;
      if (getBlock(beyondX, beyondY, beyondZ)) return; // rien où pousser
      setBlock(beyondX, beyondY, beyondZ, frontName);
    }
    setBlock(frontX, frontY, frontZ, `piston_head_${facing}`);
  }
  function retractPiston(x, y, z, facing) {
    const [dx, dy, dz] = facingDelta(facing);
    const frontX = x + dx,
      frontY = y + dy,
      frontZ = z + dz;
    if (getBlock(frontX, frontY, frontZ) === `piston_head_${facing}`) {
      setBlock(frontX, frontY, frontZ, null); // non collant : ne récupère pas le bloc poussé
    }
  }

  // ---------- un tic de simulation ----------
  function step(dt) {
    if (nodes.size === 0) return;
    const { power, conductorPower } = computePowerMap();
    const changes = []; // { x, y, z, type } (type=null -> casse + drop l'item)

    for (const n of Array.from(nodes.values())) {
      const { x, y, z } = n;
      const name = getBlock(x, y, z);
      if (!name) {
        notify(x, y, z, false);
        continue;
      }
      const k = key(x, y, z);

      if (isWireName(name)) {
        if (!hasSolidSupport(getBlock(x, y - 1, z))) {
          changes.push({ x, y, z, type: null, dropItem: 'redstone' });
          continue;
        }
        const wanted = wireNameForPower(power.get(k) || 0);
        if (wanted !== name) changes.push({ x, y, z, type: wanted });
        continue;
      }

      if (name === 'redstone_torch_off' || name === 'redstone_torch_on') {
        if (!hasSolidSupport(getBlock(x, y - 1, z))) {
          changes.push({ x, y, z, type: null, dropItem: 'redstone_torch' });
          continue;
        }
        // inversion : allumée quand son support N'EST PAS alimenté (porte NON)
        const supportPowered = levelAt(power, conductorPower, x, y - 1, z) > 0;
        const wanted = supportPowered ? 'redstone_torch_off' : 'redstone_torch_on';
        if (wanted !== name) changes.push({ x, y, z, type: wanted });
        continue;
      }

      if (name === 'lever_off' || name === 'lever_on') {
        if (!hasSolidSupport(getBlock(x, y - 1, z))) changes.push({ x, y, z, type: null, dropItem: 'lever' });
        continue; // sinon : piloté uniquement par le clic droit (main.js)
      }

      if (name === 'button_off' || name === 'button_on') {
        if (!hasSolidSupport(getBlock(x, y - 1, z))) changes.push({ x, y, z, type: null, dropItem: 'button' });
        continue; // le retour à OFF est géré par buttonTimers plus bas
      }

      if (name === 'redstone_lamp_off' || name === 'redstone_lamp_on') {
        const wanted = anyNeighborPowered(power, conductorPower, x, y, z)
          ? 'redstone_lamp_on'
          : 'redstone_lamp_off';
        if (wanted !== name) changes.push({ x, y, z, type: wanted });
        continue;
      }

      if (name.startsWith('repeater_')) {
        if (!hasSolidSupport(getBlock(x, y - 1, z))) {
          changes.push({ x, y, z, type: null, dropItem: 'repeater' });
          continue;
        }
        const parts = name.split('_'); // ['repeater', facing, 'off'|'on']
        const facing = parts[1];
        const state = parts[2];
        const [bdx, bdy, bdz] = facingDelta(facing);
        const inputPowered = levelAt(power, conductorPower, x - bdx, y - bdy, z - bdz) > 0;
        const desired = inputPowered ? 'on' : 'off';
        const timer = repeaterTimers.get(k);
        if (!timer || timer.target !== desired) {
          repeaterTimers.set(k, { target: desired, remaining: REPEATER_DELAY });
        } else {
          timer.remaining -= dt;
          if (timer.remaining <= 0) {
            repeaterTimers.delete(k);
            if (desired !== state) changes.push({ x, y, z, type: `repeater_${facing}_${desired}` });
          }
        }
        continue;
      }

      if (name.startsWith('piston_base_')) {
        const facing = name.split('_')[2];
        const powered = anyNeighborPowered(power, conductorPower, x, y, z);
        const [dx, dy, dz] = facingDelta(facing);
        const extended = getBlock(x + dx, y + dy, z + dz) === `piston_head_${facing}`;
        if (powered && !extended) extendPiston(x, y, z, facing);
        else if (!powered && extended) retractPiston(x, y, z, facing);
        continue;
      }

      if (name.startsWith('door_bottom_') || name.startsWith('door_top_')) {
        // les 2 moitiés sont notifiées séparément (cf. tryPlaceDoor, main.js) --
        // ne piloter QUE depuis la moitié du bas évite de basculer 2 fois.
        if (!name.startsWith('door_bottom_')) continue;
        const powered =
          anyNeighborPowered(power, conductorPower, x, y, z) ||
          anyNeighborPowered(power, conductorPower, x, y + 1, z);
        const isOpen = name.includes('_open');
        if (powered !== isOpen) toggleDoor(x, y, z, name);
        continue;
      }
    }

    for (const c of changes) {
      if (c.type === null) {
        if (spawnDrop) spawnDrop(c.x, c.y, c.z, c.dropItem);
        setBlock(c.x, c.y, c.z, null);
        notify(c.x, c.y, c.z, false);
      } else {
        setBlock(c.x, c.y, c.z, c.type);
      }
    }

    // minuteur des boutons : revient tout seul à OFF, comme dans le vrai jeu
    for (const [k, remaining] of Array.from(buttonTimers.entries())) {
      const left = remaining - dt;
      if (left <= 0) {
        buttonTimers.delete(k);
        const [bx, by, bz] = k.split(',').map(Number);
        if (getBlock(bx, by, bz) === 'button_on') setBlock(bx, by, bz, 'button_off');
      } else buttonTimers.set(k, left);
    }
  }

  let accum = 0;
  function update(dt) {
    accum += dt;
    // plafond : si le jeu a lagué, on ne rattrape jamais plus de quelques
    // tics d'un coup (évite une rafale de calculs après un onglet en pause).
    let guard = 8;
    while (accum >= TICK_RATE && guard-- > 0) {
      accum -= TICK_RATE;
      step(TICK_RATE);
    }
  }

  // pressée par main.js au clic droit sur un bouton : passe à ON et arme le
  // minuteur de relâchement automatique.
  function pressButton(x, y, z) {
    buttonTimers.set(key(x, y, z), BUTTON_TIME);
  }

  return { notify, update, pressButton, FACINGS };
}
