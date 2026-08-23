// Worker de chunk (Phase 20) : génération + meshing HORS thread principal. Possible
// uniquement parce que generator.js/mesher.js sont PURS (aucun import DOM/THREE) —
// exactement la raison d'être de cette séparation depuis les phases 4/5.
//
// PAS câblé dans world/world.js (volontairement, cf. PLAN.md Phase 20 : "Do NOT do
// this before the FPS counter shows the problem"). Le compteur FPS est resté à 60
// pendant toute la session, y compris après les Phases 16/17 (eau/lave en vrais
// blocs, biomes, océans/rivières) qui étaient censées être ce qui finirait par
// forcer cette phase. Le brancher en direct demanderait de rendre tout le cycle de
// vie d'un chunk asynchrone (pending/loading/ready) dans world.js — un chantier à
// part entière, hors budget de cette session. Ce module est correct et VÉRIFIÉ
// (cf. test/chunk-worker.test.js : sortie identique au chemin synchrone), prêt à
// être branché le jour où le compteur FPS le réclame vraiment.

import { generateChunk } from '../world/generator.js';
import { meshChunk, meshLiquid } from '../render/mesher.js';
import { LIQUID_IDS, BLOCK_ID } from '../data/blocks.js';

// coeur du worker, exporté séparément de `self.onmessage` pour rester testable
// depuis node (aucun `self`/`postMessage` là-dedans).
export function buildChunkResult(cx, cz, uvByBlockId) {
  const { data } = generateChunk(cx, cz);
  const opaque = meshChunk(data, uvByBlockId, undefined, LIQUID_IDS);
  // topOnly=true pour l'eau (cf. mesher.js meshLiquid) : pas de faces latérales,
  // donc pas de bordure visible entre deux chunks d'eau voisins.
  const water = meshLiquid(data, BLOCK_ID.water, LIQUID_IDS, undefined, true);
  const lava = meshLiquid(data, BLOCK_ID.lava, LIQUID_IDS);
  return { data, opaque, water, lava };
}

// Transferables (§1bis.3 du PLAN) : chaque ArrayBuffer produit ici change de
// propriétaire via postMessage(buf, [buf]) plutôt que d'être copié — gratuit,
// aucune des deux threads n'en a plus besoin après le transfert. PAS de
// SharedArrayBuffer : ça demanderait les en-têtes COOP/COEP que GitHub Pages ne sert pas.
export function collectTransferables(result) {
  const list = [result.data.buffer];
  for (const part of [result.opaque, result.water, result.lava]) {
    list.push(
      part.positions.buffer,
      part.normals.buffer,
      part.uvs.buffer,
      part.colors.buffer,
      part.indices.buffer,
    );
  }
  return list;
}

// self n'existe pas quand ce fichier est importé depuis node --test (pas de worker
// context) -- le garde-fou évite un ReferenceError et garde buildChunkResult testable.
if (typeof self !== 'undefined' && typeof self.postMessage === 'function') {
  let uvByBlockId = null;
  self.onmessage = (e) => {
    const msg = e.data;
    if (msg.type === 'init') {
      uvByBlockId = msg.uvByBlockId;
      return;
    }
    if (msg.type === 'generate') {
      const result = buildChunkResult(msg.cx, msg.cz, uvByBlockId);
      // lib DOM résout `self` sur la surcharge Window.postMessage(message, targetOrigin)
      // ici, pas Worker.postMessage(message, transfer[]) -- ambiguïté connue des fichiers
      // isomorphes worker/DOM ; le comportement RÉEL en Worker est bien le second.
      /** @type {any} */ (self).postMessage(
        { type: 'chunk', requestId: msg.requestId, cx: msg.cx, cz: msg.cz, result },
        collectTransferables(result),
      );
    }
  };
}
