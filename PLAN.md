# Minicrafter — Scaling & Maintainability Plan

> Goal: grow the game **and** turn it into a teaching vehicle for the building blocks of
> programming. Every phase is one weekend session, ships something playable, and names the
> concept it teaches.
>
> **Status of this document:** rewritten on **3 August** against the real state of the repo
> (branch `vibe`, commit `d6ac24d`). Phases 0–6 are **done**. Phase 7 is partial. Everything
> still open is detailed in **§6, Phases 10–21**.
>
> **Update — 4 August:** Phases 10, 11, 12, 13, 14, 15, 18, 19, 22, 16, 17, 20, and 7bis are
> **done**, tested (`node --test` — 90 passing), type-checked (`npm run typecheck`, clean),
> and verified live in-browser (chat commands, inventory, torches, furnace, sheep, water flow,
> biomes — no console errors across an extended session). Phase 21 (multiplayer) was excluded
> per instruction and remains open. Two deliberate, documented scope cuts inside the phases
> above:
>
> - **Phase 17.1 (deeper terrain, `CHUNK_Y` 64→128, `SEA_LEVEL` 4→40) was NOT done.** It is a
>   constants-retuning exercise (caves, ore bands, snow level, tree limits all need
>   rebalancing for a 2x-taller world) that needs iterative playtesting to get right, not a
>   mechanical code change — too risky to rush blind this late in the session. Biomes, oceans,
>   and rivers (17.2/17.3) **are** done, layered on the existing `CHUNK_Y=64`/`SEA_LEVEL=4`
>   budget.
> - **Phase 20 (chunk worker) is built and verified correct** (`src/worker/chunk-worker.js`,
>   `test/chunk-worker.test.js`) but **not wired into `world/world.js`**, exactly per this
>   plan's own instruction: "Do not do this before the FPS counter shows the problem." FPS
>   stayed at 60 through the entire session, including after 16/17. Wiring it in requires
>   making the chunk lifecycle in `world.js` asynchronous — a separate, scoped task for
>   whenever the FPS counter actually asks for it.
>
> See `docs/ARCHITECTURE.md` and `docs/LESSONS.md` for what was built and why.

---

## 0. Where we are today (measured, not remembered)

| Fact        | Value                                                                                |
| ----------- | ------------------------------------------------------------------------------------ |
| Code layout | 28 ES modules under `src/`, `index.html` is a 56-line shell                          |
| Total JS    | ~4 500 lines (biggest file: `main.js`, 787 — wiring only)                            |
| Engine      | Three.js, vendored in `vendor/` (no CDN)                                             |
| World       | Chunked. `CHUNK_X/Z = 16`, `CHUNK_Y = 64`, `Uint8Array` (1 byte/block)               |
| World size  | `WORLD_SIZE = 1000`, streamed around the player, `renderDistance` 6 (4 on touch)     |
| Rendering   | Texture atlas + per-chunk `BufferGeometry` mesher (`render/mesher.js`)               |
| Persistence | Player edits saved to `localStorage` as per-chunk diffs                              |
| Build step  | None. Native ES modules + import map. Deploy = `git push`                            |
| Tests       | `node --test` — **12 passing** (`chunk`, `generator`, `mesher`, `smoke`)             |
| Perf        | `PERF_PLAN.md` phases 1–3 applied (the 60→7 FPS bug is fixed); phase 4 (worker) open |

### What is good and must be kept

- Procedural canvas textures — zero asset pipeline, fully hackable, very teachable.
- The pure/impure split actually held: `chunk.js`, `generator.js`, `mesher.js`, `math.js` are
  testable without a browser, and they _are_ tested.
- Data registries are real: `data/blocks.js`, `data/items.js`, `data/mobs.js`. Adding a mob is
  ~20 lines of data (that is how `chicken` was added).
- `voxelRaycast` (DDA) instead of `Raycaster.intersectObjects` on chunk meshes — O(reach),
  not O(loaded chunks). This was the single biggest FPS fix.
- Event bus (`core/events.js`) — UI subscribes, game logic never calls `render()` directly.
- Web Audio synthesised SFX — no files, no loading, no CORS.

### The walls still ahead

1. **Inventory is a flat `{ item: count }` dictionary**, not slots. Ground-item drops (TODO)
   need an entity system that does not exist yet. This is the biggest single piece of open work.
2. **Water and lava are not blocks.** They live in side-lists (`waterCells`, `lavaCells`) and
   are drawn as separate `InstancedMesh`es. Flowing water, oceans, and water/solid face culling
   all require moving fluids **into** the chunk `Uint8Array`.
3. **No lighting model.** Torches need block-light propagation (a BFS over the chunk grid) —
   an entire subsystem, not a new block.
4. **No server.** Multiplayer is not a client feature.

---

## 1. Principles (unchanged — they held up)

1. **The game is never broken.** Every step ends with a working `index.html`.
2. **No build step.** Native ES modules + an import map. `npm run dev` and go.
3. **Data over code.** Adding a sheep should mean adding an object to `data/mobs.js`.
4. **Pure logic separated from Three.js.** Anything that does not touch the GPU lives in a file
   that imports nothing and gets tests.
5. **One concept per phase.** The refactor _is_ the curriculum.

---

## 1bis. Deployment constraint: GitHub Pages

The site ships from `TrustingLD/Minicrafter` → **`https://trustingld.github.io/Minicrafter/`** —
a _project_ page, so it lives under a **sub-path**, not at the domain root.

### 1bis.1 🔴 All paths relative — never root-absolute

`/src/main.js` resolves to `trustingld.github.io/src/main.js` → **404**. Every path is `./` or
`../`. For anything resolved at runtime (workers, audio): `new URL('./w.js', import.meta.url)`.
**Guard:** `npm run dev` serves from the parent (`serve -l 3000 ..`) so the local URL is
`localhost:3000/Minicrafter/` — dev matches prod. Already configured in `package.json`.

### 1bis.2 🔴 Pages is case-sensitive, Windows is not

`import './data/Blocks.js'` with a file named `blocks.js` works locally and 404s in production.
**Rule:** every file and folder is `lowercase-with-dashes.js`. No exceptions. Currently
respected across all 28 modules — Phase 7's CI must lock it in.

### 1bis.3 🟡 No custom HTTP headers — ever

- **No `SharedArrayBuffer`** (needs COOP/COEP headers). Phase 20's worker **must** use
  transferable `ArrayBuffer`s (`postMessage(buf, [buf])`). Zero-copy anyway, so no loss.
- **No cache-control tuning.** Pages caches ~10 min. Stale module mid-demo → hard reload, or
  bump `./src/main.js?v=N`.

### 1bis.4 🟢 No build step is a _requirement_, not a preference

A bundler means an Actions workflow between "commit" and "it's live". With plain ES modules,
**deploy = `git push`**. Keep `.nojekyll` (present) or Jekyll drops `_`-prefixed paths.

### 1bis.5 🔴 Phase 21: Pages cannot host the multiplayer server

Static host, no Node process. Client stays on Pages, server goes to Fly.io / Render free tier.
The page is HTTPS so the socket **must be `wss://`** (mixed content is blocked outright).
Single-player must keep working with the server down.

### 1bis.6 Fine, no action needed

HTTPS is automatic → Pointer Lock, Fullscreen, Wake Lock all work (all three already in use).
Repo limits: 1 GB site, 100 GB/month. Audio is ~16 MB across two tracks — fine, but see §8.

---

## 2. Architecture as it actually exists

```
Minicrafter/
├── index.html              # 56 lines: DOM shell + import map. No logic. ✅
├── package.json            # dev, test, format, format:check ✅
├── vendor/three.module.js  # pinned, vendored ✅
├── src/
│   ├── main.js             # wiring + main loop (787 l — see Phase 22, it is drifting)
│   ├── core/
│   │   ├── events.js       # pub/sub bus ✅
│   │   ├── math.js         # noise 2D/3D, hash2/hash3, rng          [PURE] ✅
│   │   └── raycast.js      # voxel DDA                              [PURE] ✅
│   ├── data/
│   │   ├── blocks.js       # id, hardness, tool, textures, veins ✅
│   │   ├── items.js        # ITEM_NAMES, TOOL_CATEGORY, RECIPES ✅
│   │   └── mobs.js         # pig, cow, zombie, chicken ✅
│   ├── world/
│   │   ├── chunk.js        # Uint8Array + index math                [PURE] ✅ tested
│   │   ├── world.js        # chunk map, streaming, diffs, collision ✅
│   │   ├── generator.js    # terrain, lakes, caves, ores, trees, lava [PURE] ✅ tested
│   │   ├── clouds.js       # tiled voxel clouds ✅
│   │   └── sky.js          # day/night, sun, moon, stars ✅
│   ├── render/
│   │   ├── textures.js     # procedural canvases ✅
│   │   ├── block-assets.js # materials + hotbar icons ✅
│   │   ├── atlas.js        # texture atlas + UV table ✅
│   │   └── mesher.js       # chunk → BufferGeometry            [PURE] ✅ tested
│   ├── entities/
│   │   ├── model.js, limb.js  # box-model builder from data ✅
│   │   ├── mob.js          # generic mob, data-driven ✅
│   │   └── player.js       # camera, hand, held item, 1st/3rd person ✅
│   ├── ui/
│   │   ├── hotbar.js, health.js, craft.js, chat.js, touch.js, style.css ✅
│   └── audio/sfx.js, music.js ✅
├── test/chunk|generator|mesher|smoke.test.js   # 12 passing ✅
├── PERF_PLAN.md            # FPS diagnosis + fix plan (1–3 done, 4 open)
└── PLAN.md                 # this file
```

**Still missing from the target tree** (each is created by a phase below):

| Missing                                                               | Created by          |
| --------------------------------------------------------------------- | ------------------- |
| `world/physics.js` (pure AABB, extracted from `world.js` + `main.js`) | Phase 22            |
| `entities/entity.js` + `entities/item-entity.js` (ground drops)       | Phase 10            |
| `world/light.js` (block-light BFS)                                    | Phase 13            |
| `world/fluid.js` (water propagation)                                  | Phase 16            |
| `world/biomes.js`                                                     | Phase 17            |
| `data/commands.js` + chat command parser                              | Phase 15            |
| `ui/hud.js` (FPS/pos/target, currently inline in `main.js`)           | Phase 22            |
| `worker/chunk-worker.js`                                              | Phase 20            |
| `net/` + `server/`                                                    | Phase 21            |
| `docs/ARCHITECTURE.md`, `docs/LESSONS.md`                             | Phase 7 (remainder) |

---

## 3. What is DONE ✅

Phases 0–6 of the original plan shipped. Concretely, verifiable in the code today:

| Area                                                                                                              | Evidence                                  |
| ----------------------------------------------------------------------------------------------------------------- | ----------------------------------------- |
| Tooling, Prettier, `.editorconfig`, `CONTRIBUTING.md`                                                             | repo root                                 |
| File split into 28 modules, no globals                                                                            | `src/**`                                  |
| Three.js vendored, import map                                                                                     | `index.html`, `vendor/`                   |
| Data-driven blocks / items / mobs                                                                                 | `data/*.js`                               |
| Event bus                                                                                                         | `core/events.js`, used by hotbar + health |
| Chunked world, `Uint8Array`, streaming, unload, localStorage diffs                                                | `world/world.js`                          |
| Caves (3D noise, 2 octaves), ore veins by depth band, bedrock floor                                               | `world/generator.js`                      |
| Lakes (dedicated low-freq carve mask), animated water                                                             | `generator.js`, `world.js`                |
| **Lava** — pools in deep caves only, unlit material, damage tick                                                  | `generator.js:76`, `main.js:646`          |
| **Day/night cycle** — sky colour ramp, dusk, sun **and** moon sprites, **stars**, moving lights                   | `world/sky.js`                            |
| **Clouds** — voxel slabs, infinite tiling pattern, slow drift                                                     | `world/clouds.js`                         |
| Texture atlas + chunk mesher (interior faces culled)                                                              | `render/atlas.js`, `render/mesher.js`     |
| **Held item in the hand** — axe/block parented to the hand pivot, swings                                          | `entities/player.js:77-111`               |
| Break animation — 10-stage crack overlay on the targeted block, driven by `hardness`                              | `main.js:87`, `main.js:748`               |
| Hearts health bar, hotbar, craft panel, FPS/pos/target HUD                                                        | `ui/*`                                    |
| Zoom (C), sprint (double-tap W), crouch (Shift), 3rd person (F5), chat box (T)                                    | `main.js`                                 |
| Mobile: touch joystick, look-drag, break/place/jump/inventory buttons, adaptive quality                           | `ui/touch.js`                             |
| Music (2 tracks) + synthesised SFX                                                                                | `audio/*`                                 |
| **FPS fix** — `getBlock` never generates, mobs frozen far away, DDA raycast, per-chunk mesh disposal, load budget | `PERF_PLAN.md` §1–3, all applied          |
| Tests + `npm test` green                                                                                          | `test/`, 12 passing                       |

---

## 4. Partially done ⚠️ — finish these, do not restart them

| Item                     | What exists                                                              | What is missing                                                                                                                                    |
| ------------------------ | ------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Perfect caves**        | 3D noise + detail octave, surface threshold ramp so entrances can appear | No lighting inside (pitch black without torches → Phase 13), no cave-specific structures, no ravines. Re-tune **after** torches exist, not before. |
| **Break animation**      | 10 crack stages                                                          | No particles, no block "shake", no pitch-shifted progress sound. → Phase 19                                                                        |
| **Chat**                 | Input box on T, 6 messages, auto-fade                                    | No scrollback history, no ↑/↓ recall, no `/` commands. → Phase 15                                                                                  |
| **Mob spawning**         | 58 mobs spawned once in a ±40 block box, frozen beyond 56 blocks         | No spawning around the player as he explores, no despawn, no day/night rules. → Phase 12                                                           |
| **Tests / CI** (Phase 7) | `node --test`, 12 tests, Prettier scripts                                | No GitHub Actions, no `@ts-check`/`checkJs`, no filename-case guard, no `docs/`. → Phase 7bis                                                      |

---

## 5. What is NOT done ❌ (the current TODO, verbatim → phase)

| TODO line                                          | Item                            | Status              | Phase |
| -------------------------------------------------- | ------------------------------- | ------------------- | ----- |
| Océan / rivière                                    | ❌ only lakes exist             | 17                  |
| Terrain plus profond                               | ❌ `CHUNK_Y = 64`               | 17                  |
| Inventaire = 9 slots + drop au sol + ramassage     | ❌ inventory is `{item: count}` | **10**              |
| Hache/bloc tenu dans la main                       | ✅ **done**                     | —                   |
| Meilleur cycle jour/nuit (étoiles, lune/soleil)    | ✅ **done**                     | —                   |
| Meilleure animation de cassage                     | ⚠️ cracks only                  | 19                  |
| Multijoueur                                        | ❌                              | 21                  |
| Grotte parfaite                                    | ⚠️ needs light first            | 13 → re-tune        |
| Nouveau mob : sheep                                | ❌                              | 18                  |
| Barre de bouffe                                    | ❌                              | 11                  |
| Problème de FPS                                    | ✅ **fixed** (PERF_PLAN 1–3)    | 20 for extra margin |
| Monstres attaquent à travers les blocs             | ❌ no line-of-sight test        | 12                  |
| Torches                                            | ❌                              | 13                  |
| Biomes                                             | ❌                              | 17                  |
| Four                                               | ❌                              | 14                  |
| Spawn des mobs hors zone initiale                  | ❌ one-shot spawn only          | 12                  |
| Historique de chat + commandes `/`                 | ❌                              | **15**              |
| L'eau doit couler + pas de face entre eau et terre | ❌ water is not a block         | **16**              |
| Noyade : 15 s sous l'eau → ½ cœur/s                | ❌                              | 11                  |
| Nuages en blocs entiers, avec la génération        | ✅ **done**                     | —                   |
| Lave                                               | ✅ **done**                     | —                   |

---

## 6. Remaining phases — detailed

Difficulty: 🟢 he can do it alone · 🟡 pair on it · 🔴 you drive, he watches & asks

Order matters. **10 → 11 → 12 → 15** are independent and cheap-ish. **13 → 14** unlock content.
**16 → 17** are the deep world rework and should come after the inventory system is stable.

---

### Phase 10 — Slot inventory + ground item drops 🔴 (1–2 weekends)

**Concept: entities. A thing in the world that is not a block.**

The single most requested TODO item, and the one that unblocks Phases 11, 14, 18.

**10.1 — Slots instead of a dictionary.** `inventory` becomes an array of 9 (hotbar) + 27
(backpack) slots:

```js
// src/entities/inventory.js — PURE, unit-tested
// slot = null | { item: 'stone', count: 34 }
export const HOTBAR_SLOTS = 9, BACKPACK_SLOTS = 27, MAX_STACK = 64;
export function addItem(slots, item, count)   // fills partial stacks first, then empties;
                                              // returns the leftover that did not fit
export function removeItem(slots, item, count)
export function countOf(slots, item)
export function moveSlot(slots, from, to)     // for drag & drop later
```

Tests: fill 9 stacks of 64, assert the 65th `addItem` returns leftover 1; assert partial-stack
merge before empty-slot use. **Write the tests first** — this is a perfect first TDD exercise.

**10.2 — The item entity.** New `src/entities/entity.js` (shared base: `pos`, `vel`, `onGround`,
`tick(dt)`, gravity + `collidesAtBox`, reusing the exact code the mob already has — extract it,
do not copy it) and `src/entities/item-entity.js`:

- visual: a small cube (0.25 scale) using the existing block atlas material, or the tool sprite
  for items; spin on Y, bob on a sine.
- physics: spawn with a small random `vel`, gravity, land on the ground.
- pickup: within 1.2 blocks of the player and older than 0.5 s → `addItem`, play `pickup` sound,
  `bus.emit('inventory:changed')`. Merge with a nearby identical entity to avoid 200 cubes.
- despawn after 5 minutes.
- **All item entities share ONE `InstancedMesh`**, like the mobs' hitboxes — not one `Mesh`
  each. This is the perf lesson of the phase.

**10.3 — Wire the drops.** `breakBlockAt()` stops doing `inventory[type]++` and instead calls
`itemSystem.spawn(x + 0.5, y + 0.5, z + 0.5, drops)`. `Mob.hit()` death drops likewise. Add
`drops: [{ item, min, max }]` to `data/blocks.js` (grass → dirt, stone → stone, leaves → nothing
usually + rare sapling), so the drop table is **data**, not an `if`.

**10.4 — UI.** `ui/hotbar.js` renders slots (icon + count) instead of the fixed `HOTBAR` array.
`ui/craft.js`'s inventory grid renders the 27 backpack slots. Slot 0–8 selection by digit keys
and wheel stays exactly as-is.

**Risk:** this touches `main.js`, `hotbar.js`, `craft.js`, `mob.js` at once. Do 10.1 + its tests
in one commit (nothing else changes — keep a thin adapter so the old dictionary API still works),
then 10.2 alone (spawn drops that nobody picks up yet — visible progress), then 10.3, then 10.4.

**Teach:** the difference between _state_ (inventory data, pure, testable) and _representation_
(the mesh). And that "extract the shared base class" beats "copy the mob's gravity code".

---

### Phase 11 — Hunger, food, and drowning 🟡 (1 weekend)

**Concept: timers and resources over time.**

Depends on Phase 10 (eating consumes an item from a slot).

- `ui/hunger.js` — 10 drumsticks, same shape as `ui/health.js`, listening on `player:hunger`.
- `player.hunger` 0–20. Drains on a budget: sprinting −0.05/s, jumping −0.1, mining −0.005/block,
  idle −0.005/s. At 0 → −½ heart every 4 s. Above 18 → regenerate ½ heart every 4 s (costs hunger).
- Eating: right-click while holding `meat` / `cooked_meat` / `milk` → consume one, `+N` hunger,
  1.6 s eating animation on the hand (reuse `triggerHandSwing`'s pivot). Data-driven:
  `data/items.js` gets `food: { hunger: 3, saturationTime: 1.6 }`.
- **Drowning (TODO):** `player.breath` = 15 s, refilled instantly out of water. Head submerged →
  drain; at 0, −½ heart every second, `hurt` sound, bubble icons over the hotbar.
  `isUnderwater()` already exists in `main.js:568` — but it is an _analytic_ check against
  `getHeight` and `SEA_LEVEL`, so it will be wrong the moment Phase 16 makes water a real block.
  Implement it now on the current check, and re-point it at `getBlock(...) === 'water'` in
  Phase 16. Note this in a comment so the coupling is not a surprise.

**Ships:** hunger bar, eating, drowning damage.
**Teach:** rates vs. events. Hunger is `-= rate * dt`, damage is a tick with a cooldown — the
same two shapes appear in the lava damage code already written.

---

### Phase 12 — Mob AI: line of sight, spawning, despawning 🟡 (1 weekend)

**Concept: reusing an algorithm you already wrote (the DDA raycast).**

**12.1 — Stop attacking through walls (TODO).** `entities/mob.js:113` chases and hits whenever
`distToPlayer < 9` / `< 1.1`, with no visibility test. Add, in `mob.js`:

```js
// voxelRaycast already exists (core/raycast.js) and costs O(distance) — reuse it.
function canSee(getBlock, from, to) {
  const dir = to.clone().sub(from);
  const dist = dir.length();
  dir.normalize();
  const hit = voxelRaycast(getBlock, from, dir, dist);
  return !hit; // no solid block between the mob's eyes and the player's chest
}
```

Call it **only** when the mob is within aggro range and at most every 0.25 s (cache the result on
the mob) — not every frame for every mob. Eyes = `pos.y + height * 0.9`, target = player chest.
Lose aggro after 3 s without line of sight.

**12.2 — Spawn around the player (TODO).** Replace the one-shot `spawnMobs()` (±40 blocks at
boot) with a periodic pass, every 4 s:

- pick a random loaded chunk within `renderDistance`, at least 24 blocks from the player;
- find a surface `y` via `getGroundHeight`, require air above and a solid, non-liquid floor;
- passive mobs (pig/cow/chicken/sheep) only in daylight; hostile (zombie) only when
  `skyApi.isNight()` (expose that from `world/sky.js` — the cycle already computes it) or below
  y=12 in a cave with no sky access;
- **caps**: max 40 mobs total, max 6 per chunk, refuse to spawn if the cap is hit;
- despawn any mob further than 80 blocks (instant) or further than 56 for over 60 s.
  This also fixes the current boot cost — 58 mobs are created before the first frame.

**12.3 — Keep the freeze.** `MOB_ACTIVE_RADIUS` freezing (from `PERF_PLAN` §1.5) stays. Spawning
must never un-freeze more than the cap allows: measure with the FPS counter before and after.

**Teach:** an algorithm written for one purpose (block picking) solving a completely different
problem (mob vision) for free. That is what "pure function in its own file" buys.

---

### Phase 13 — Torches and block light 🔴 (1–2 weekends)

**Concept: BFS, a real algorithm, with a real payoff you can see in the dark.**

The most valuable computer-science lesson left in the plan. Do it after Phase 12, before caves
are re-tuned.

- `data/blocks.js`: `torch` block — `emitsLight: 14`, `solid: false`, `hardness: 0.1`. Recipe in
  `data/items.js`: `stick 1 + coal_ore 1 → torch 4`.
- `src/world/light.js` — **PURE**, unit-tested:
  ```js
  // lightmap: a second Uint8Array(CHUNK_VOLUME) per chunk, 0..15
  export function propagate(chunkData, lightData, sources)  // BFS queue, −1 per block travelled
  export function removeLight(chunkData, lightData, x, y, z) // the harder half: re-flood after
                                                             // a torch is broken
  ```
  Tests: one torch in an empty 3×3×3 → centre 14, neighbours 13; a wall blocks propagation;
  removing the torch returns the map to 0. **Cross-chunk light** is the trap — v1 stops at chunk
  borders (light stops at the seam, visibly), v2 re-meshes the 4 neighbours after propagation.
  Ship v1 first and let him _see_ the seam; that makes v2 obvious rather than abstract.
- Rendering: the mesher already writes a `uv` attribute per face — add a per-vertex `color`
  attribute (`vertexColors: true` on the atlas material) set from the light value. Zero extra
  draw calls, one extra buffer. Ambient light drops in caves so the effect is visible.
- Torch itself: a small cross-quad or thin box + a flickering `PointLight` **only for the nearest
  ~8 torches** (a `PointLight` per torch will kill the frame rate — that limit is the lesson).
- Sunlight: v1 = "any block with open sky above is light 15", computed in the generator per
  column. Good enough, and cheap.

**Then re-tune the caves** (the "grotte parfaite" TODO): with light, dark = dangerous = readable,
and the cave threshold can be loosened without turning the world into a black maze.

---

### Phase 14 — Furnace and smelting 🟡 (1 weekend)

**Concept: block entities — a block with state and a clock.**

Depends on Phase 10 (slots) and Phase 13 (coal is worth something).

- `furnace` block in `data/blocks.js` (recipe: 8 stone). Two textures: idle and lit
  (`textures.js` gets a `furnaceFrontLit`), swapped by the block-entity state.
- `src/world/block-entities.js`: a `Map<"x,y,z", state>` per world, ticked at 4 Hz (not 60), and
  **persisted in the same `localStorage` diff structure** already used for blocks — otherwise a
  furnace loses its contents on chunk unload, which is a genuinely confusing bug for a player.
- `data/recipes.js` gains `SMELTING = { iron_ore: 'iron_ingot', meat: 'cooked_meat', sand: 'glass' }`
  and `FUELS = { coal_ore: 8, planks: 1.5, stick: 0.5 }` (seconds of burn).
- UI: right-click a furnace opens a 3-slot panel (input / fuel / output) + a progress arrow and a
  flame gauge. Reuse `ui/craft.js`'s panel shell; drag & drop can wait, click-to-move is fine.
- New items: `iron_ingot`, `cooked_meat` (more hunger than raw — ties into Phase 11), and the
  stone/iron tool recipes that already exist in `ITEM_NAMES` but have no path to being crafted.

**Teach:** state that lives in the world and advances on its own, even when you are not looking
at it. First encounter with "the simulation has a tick rate different from the frame rate".

---

### Phase 15 — Chat history and `/` commands 🟢 (1 weekend, he can drive)

**Concept: parsing text, and a command table instead of a chain of `if`s.**

`ui/chat.js` today keeps 6 messages, fades them out, and forgets everything.

- **History:** keep a `messages[]` array (cap 100). Open (T) → show the last 20 in a scrollable
  panel; closed → only the last 6, fading, as today. `↑`/`↓` in the input recall previously sent
  lines (a second array, `sentHistory`, cap 50, index reset on send).
- **Commands** — `src/data/commands.js`, a table, not a switch:
  ```js
  export const COMMANDS = {
    fly: { args: [], help: '/fly — bascule le mode vol' },
    give: { args: ['item', 'count?'], help: '/give <item> [n] — ajoute un item' },
    tp: { args: ['x', 'y', 'z'], help: '/tp <x> <y> <z>' },
    time: { args: ['value'], help: '/time <day|night|0-1>' },
    heal: { args: [], help: '/heal — remplit la vie' },
    help: { args: [], help: '/help — liste les commandes' },
  };
  ```
  A parser in `src/core/commands.js` (**PURE**, tested): splits the line, validates arity,
  returns `{ name, args }` or `{ error }`. `main.js` holds the _handlers_ (the only part that
  touches game state) in one object keyed by the same names — so an unknown command is caught by
  the table, never by a missing `else`.
- `/give` autocompletes against `ITEM_NAMES` keys and reports `Item inconnu : xyz` with the
  closest match (Levenshtein is overkill — a `startsWith` filter is plenty and teachable).
- `/fly`: `player.flying` — gravity off, Space up, Shift down, no fall damage. Confine the change
  to the movement block in `main.js`; it must survive Phase 22's HUD/loop extraction.
- Every command echoes a confirmation line into the chat log. Errors in red.

**Teach:** a lookup table beats a switch; validation is separate from execution; and pure parsing
means he can test `/give stone 64` without opening the browser.

---

### Phase 16 — Water as a real block: face culling + flow 🔴 (2 weekends)

**Concept: the data structure decides what is possible — again.**

Two TODO items ("l'eau doit couler", "pas de texture sur les côtés quand elle est dans la terre")
are both symptoms of the same cause: **water is not stored in the chunk array**, it is a side-list
of `waterCells` drawn as scaled cubes (`world.js:113`). A cube does not know its neighbours, so
every lake face is drawn, including the ones buried in dirt.

**16.1 — Move water into `data`.** `water` becomes block id 14 in `data/blocks.js` with
`liquid: true, solid: false, opaque: false, levels: 8`. `generateChunk` writes it into
`data[idx(...)]` instead of pushing to `waterCells`. Same for lava (id 15) — do both, the code is
identical and lava currently has the same buried-face problem.

**16.2 — Teach the mesher about liquids.** `render/mesher.js` gets a second pass:

- opaque geometry as today, but a face is now culled if the neighbour is opaque **or**… careful:
  a solid block facing water must still draw its face.
- a **separate** liquid geometry (own material: transparent, animated UV offset — the existing
  `waterTexture` scroll keeps working) where a water face is emitted **only** if the neighbour is
  air or a different liquid. Water↔water: culled. Water↔dirt: culled. **This is exactly the TODO
  item**, and it falls out for free once water is a block.
- surface water is rendered at `y + 0.875` (not a full cube) so the shoreline reads correctly.
  Add a mesher test: a 3×3×3 of water inside stone emits **zero** liquid faces.

**16.3 — Flow.** `src/world/fluid.js`, **PURE**, tested. Cellular automaton, ticked at 5 Hz over
a queue of _active_ cells only (never a full-world scan):

- a water block with level `L > 1` spreads to air neighbours at level `L−1`;
- straight down always spreads at full level (falling water);
- level 1 does not spread; source blocks (level 8) never deplete;
- breaking a block adjacent to water enqueues that cell → the water flows into the hole. That
  moment is the payoff of the whole phase — make sure it is the first thing he tests.
- cap the queue per tick (e.g. 256 cells) so a broken dam cannot freeze the frame.
- Cross-chunk flow: enqueue into the neighbour chunk's queue; if it is unloaded, drop it (water
  stops at the world edge of loaded terrain — acceptable, and worth saying out loud).

**16.4 — Consequences to fix in the same phase:** `isUnderwater()` in `main.js` becomes
`getBlock(...) === 'water'` (Phase 11's drowning starts working properly), swimming physics
(buoyancy, slower fall, jump = swim up), and `collidesAtBox` must keep treating liquids as
non-solid.

**Teach:** cellular automata; why an "active set" beats scanning everything; and the payoff of a
good data structure showing up as _two features at once_.

---

### Phase 17 — Oceans, rivers, biomes, deeper terrain 🔴 (2–3 weekends)

**Concept: composing noise fields. The generator is a pure function of (x, z) — prove it.**

Do this **after** Phase 16: oceans made of the old fake water would just be very large versions
of the wrong thing.

**17.1 — Deeper terrain first (it is the enabler).** `CHUNK_Y` 64 → 128, `SEA_LEVEL` 4 → 40,
mountains up to ~110, bedrock at 0, caves through the whole column. Memory per chunk goes 16 KB →
32 KB (still nothing), but generation cost roughly doubles — **measure it with the FPS counter
before and after**, and expect this to be the phase that finally forces Phase 20 (the worker).
Everything that hardcodes a height must be found and fixed: `CLOUD_Y`, `SNOW_LEVEL`, spawn
height, `getHeight`'s `Math.min(58, …)` clamp, the mob spawn floor, and the generator tests.

**17.2 — Biomes.** `src/world/biomes.js`, **PURE**:

```js
// two extra low-frequency noise fields, sampled per column
temperature(x, z) ∈ [0,1] ; humidity(x, z) ∈ [0,1]
→ biome = { plains, forest, desert, snowy, mountains, swamp, ocean }
// each biome is DATA: { surface, subsurface, treeChance, treeType, mobs, grassTint, fogColor }
```

Blending is the hard part: pick the biome per column, but **interpolate the height contribution**
between neighbouring biomes over ~16 blocks, or every border becomes a cliff. New blocks needed:
`sand`, `sandstone`, `cactus`, `dead_bush`, `ice`. Biome also drives the Phase 12 spawn table —
sheep in plains, nothing in the ocean.

**17.3 — Oceans and rivers.** Continentalness is a _third_ low-frequency noise field: below a
threshold the terrain floor is pushed under `SEA_LEVEL` over a wide area → ocean, with a sand
shelf near the coast. Rivers are a separate trick: take a _ridged_ noise field
(`1 - |noise|`), and where it is within ε of its maximum, carve a narrow channel down to
`SEA_LEVEL − 2`. That gives connected, winding rivers that cross chunk borders correctly **for
free**, because it is still a pure function of `(x, z)` — no cross-chunk coordination.

**Test:** determinism per chunk is already tested; add a test that a river column is under sea
level in **both** chunks that share it (this is the bug this design avoids — make it visible).

**Teach:** layered noise as composition of simple functions; why "pure function of world
coordinates" makes infinite, seamless, restartable worlds possible at all.

---

### Phase 18 — Sheep (and the payoff of data-driven mobs) 🟢 (half weekend)

**Concept: proof that Phase 2 worked.**

Should be ~30 lines of data in `data/mobs.js` plus two textures:

```js
sheep: {
  name: 'Mouton', speed: 1.0, health: 4, hitbox: { radius: 0.42, height: 1.2 },
  ai: 'wander', drops: [{ item: 'wool', min: 1, max: 1 }, { item: 'meat', min: 1, max: 2 }],
  model: { parts: [ /* body woolSkin, head sheepFace */ ], limbs: [ /* 4 legs */ ] },
}
```

Plus: `wool` item + block (`data/blocks.js`, dyeable later), shearing (right-click with any
sword/shears → drops 1–3 wool, mob turns to a "sheared" texture and regrows after 60 s — the
first mob with _state_), and wool → bed later if he wants a spawn point.

**If it takes more than one afternoon, the data-driven design has a leak — find it and fix the
leak instead of special-casing the sheep.** That is the actual lesson of this phase.

---

### Phase 19 — Break animation, polish pass 🟢 (half weekend)

**Concept: game feel is made of small, cheap things.**

The crack overlay exists. Add, each one a separate commit:

- **Particles:** 8–12 tiny cubes with the broken block's texture, spawned at the block, random
  velocity, gravity, 0.6 s life. One shared `InstancedMesh` for all particles (same lesson as
  Phase 10's item entities).
- **Block wobble:** scale the targeted block's crack overlay by `1 + 0.02 * sin(progress * 40)`.
- **Progress sound:** the `break` SFX pitched up with `breakProgress / total` — a repeated soft
  tick while mining, then the full sound on break.
- **Placement feedback:** brief scale-up on the newly placed block.
- Hurt: red screen vignette flash on `player:health` decrease.

**Teach:** the difference between "it works" and "it feels good" is usually about 40 lines.

---

### Phase 20 — Perf margin: the chunk worker 🟡 (1 weekend)

**Concept: the main thread is not the only thread. Measure first.**

`PERF_PLAN.md` phase 4, still open — and Phase 17.1 (deeper terrain) is what will make it
necessary. **Do not do this before the FPS counter shows the problem.**

- `src/worker/chunk-worker.js` imports `generator.js` + `mesher.js` (both pure — that is why this
  is even possible) and returns transferable `ArrayBuffer`s.
- Instantiate with `new Worker(new URL('./worker/chunk-worker.js', import.meta.url), { type: 'module' })`
  — relative to the module, correct under the Pages sub-path (§1bis.1).
- **Transferables, not `SharedArrayBuffer`** (§1bis.3): `postMessage(buf, [buf])`.
- The main thread only uploads the geometry to the GPU. Keep a fallback path that generates
  synchronously if `Worker` construction fails, so the game never depends on it.
- Also re-enable per-chunk frustum culling and verify with `renderer.info.render.calls`.

**Teach:** DevTools performance tab, CPU-bound vs GPU-bound, why `postMessage` copies by default.

---

### Phase 21 — Multiplayer 🔴 (2–3 weekends)

**Concept: there is another computer, and it lies to you.**

Unchanged from the original plan, and still last. Now that the world is chunked and edits are
already stored as diffs, the server's job is much clearer than it was.

**Server** (`server/`, Node + `ws`, ~250 lines): owns the seed and the block-diff map,
authoritative on blocks, trusting on movement (anti-cheat explicitly out of scope). 20 Hz tick.
Deployed on Fly.io / Render — **Pages cannot host it** (§1bis.5).

**Protocol** (`src/net/protocol.js`, shared, **PURE**, tested):

```
C→S: join{name} · move{x,y,z,yaw,pitch} · setBlock{x,y,z,id} · chat{text} · hit{entityId}
S→C: welcome{id,seed,players} · state{[{id,x,y,z,yaw}]} · blockChanged{...} · chat{...}
     · playerJoined/playerLeft
```

JSON first (readable in DevTools = debuggable by a kid). Binary only if measurements demand it.

**Client:** remote players reuse `entities/model.js`. Interpolate remote positions ~100 ms in the
past. The local player is predicted, never interpolated. The chat from Phase 15 becomes the
network chat almost for free — `bus.emit('chat:message')` already exists as the seam.

---

### Phase 22 — Keeping `main.js` honest 🟡 (half weekend, do it between other phases)

**Concept: a file that grows without limit is a design smell.**

`main.js` is 787 lines and is now doing input, HUD, break logic, movement physics, and the loop.
It was supposed to be wiring only. Before Phase 16 lands, extract:

- `src/core/loop.js` — the `animate()` skeleton, fixed-timestep update + render.
- `src/core/input.js` — keys/mouse/touch → named actions (`move`, `jump`, `primary`, `sprint`…).
  Touch is already a second producer of the same actions; make that structural instead of a
  convention.
- `src/ui/hud.js` — FPS, position, target, hint.
- `src/world/physics.js` — the player's move/gravity/collision resolution, **PURE** given a
  `collidesAtBox` function. Then it gets tests: does the player stop at a wall, does crouch
  prevent walking off an edge.
- `src/game/break.js` — the progressive-break state machine.

Target: `main.js` back under 250 lines, and every extraction is behaviour-preserving with the
game working after each commit.

---

### Phase 7bis — The rest of Phase 7 (tests, types, CI) 🟡 (1 weekend)

Started but unfinished:

- `@ts-check` + JSDoc types + `tsconfig.json` with `checkJs: true`, `noEmit: true`. Editor-level
  type checking, zero build step.
- GitHub Actions on every push: `npm test` + `npm run format:check` + the two Pages guards —
  **fail on any uppercase letter in a path under `src/`**, and **fail on any `from '/` or `src="/`**
  (§1bis.1–2). These two catch the white-screen-in-production class of bug.
- `docs/ARCHITECTURE.md` — _he_ writes it. If he cannot explain the structure, it is too complex.
- `docs/LESSONS.md` — one page per concept, also his.

---

## 7. Suggested order

Grouped so that each block ships something visible and unblocks the next:

1. **Phase 10** (slots + ground drops) — biggest single win, unblocks 11/14/18.
2. **Phase 15** (chat history + `/` commands) — 🟢, he can drive it, and `/give` + `/tp` make
   testing every later phase far faster. Arguably do this _first_, as a tooling investment.
3. **Phase 11** (hunger + drowning) and **Phase 12** (line of sight + spawning) — independent.
4. **Phase 13** (torches + light BFS) → then re-tune the caves.
5. **Phase 14** (furnace) and **Phase 18** (sheep) — content, cheap now.
6. **Phase 19** (break polish) — a rest-day phase between two hard ones.
7. **Phase 22** (re-split `main.js`) — before the world rework, not after.
8. **Phase 16** (water as a block: culling + flow) → **Phase 17** (deep terrain, biomes, oceans,
   rivers) → **Phase 20** (worker, when 17 makes it necessary).
9. **Phase 7bis** (CI/types) — slot it in whenever a phase ends early.
10. **Phase 21** (multiplayer) — last.

---

## 8. Explicitly NOT doing

Saying no is part of design.

- **Bundler** (Vite/webpack) — native ES modules are enough; a build step hides the code.
- **TypeScript with a compile step** — JSDoc + `checkJs` gives ~90% of the benefit at 0% friction.
- **A UI framework** — the HUD is ~12 DOM elements.
- **An ECS** — tempting at Phase 10, but overkill at ~6 entity types, and it obscures the plain
  object modelling he should learn first. A shared `Entity` base is the right size.
- **Anti-cheat / rollback netcode** — scope creep.
- **Infinite world in Y** — `CHUNK_Y = 128` after Phase 17 is plenty; sub-chunks (16³ sections)
  are the "real" answer and are not worth the complexity here.
- **Git LFS for the audio** — ~16 MB across two mp3s is annoying but fine. Worth _mentioning_ as
  a thing that exists. If a third track lands, revisit.

---

## 9. Risks

| Risk                                                                                | Mitigation                                                                                      |
| ----------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------- |
| Phase 10 touches inventory, hotbar, craft, mobs at once and stays broken for a week | Four separate commits (10.1 pure + adapter → 10.2 → 10.3 → 10.4); the game runs after each      |
| Phase 16 (water as a block) breaks lakes, swimming, and drowning simultaneously     | Do it right after Phase 22's `physics.js` extraction, so swimming has tests before it changes   |
| Phase 17.1 (`CHUNK_Y` 64→128) tanks the FPS                                         | Expected. Measure, then do Phase 20. Do not pre-optimise                                        |
| Phase 13's light BFS is a big algorithm to hold in your head                        | Ship v1 that stops at chunk borders, _see_ the seam, then fix it. Two commits, two lessons      |
| Works locally, white screen on Pages (path case, absolute path)                     | Lowercase-only filenames, relative paths only, dev server on the sub-path, Phase 7bis CI guards |
| Stale module cached by the Pages CDN mid-demo                                       | Hard reload, or bump `?v=N` on the entry script                                                 |
| Interest fades during the two 🔴 world phases (16/17)                               | Sandwich them between 🟢 phases (19 before, 18 after), and keep `/give` + `/tp` handy           |
| `main.js` keeps growing and becomes the new single-file problem                     | Phase 22, scheduled _before_ the world rework rather than "someday"                             |

---

_Plan written in English; the code comments and the TODO are in French. A French version for
lil bro is easy to produce on request._
