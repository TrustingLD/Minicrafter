# Minicrafter — Scaling & Maintainability Plan

> Goal: grow the game **and** turn it into a teaching vehicle for the building blocks of
> programming. Every phase is one weekend session, ships something playable, and names the
> concept it teaches.

---

## 0. Where we are today

| Fact | Value |
|---|---|
| Files | `index.html` (1564 lines, 65 KB), `luft-mini.mp3` (6.5 MB), `README.md`, `LICENSE` |
| Code layout | One `<script>` tag, all globals, no modules |
| Engine | Three.js **r128** from CDN (2021, pre-ESM) |
| World | `150 × 150` columns, `WORLD_HEIGHT 60`, fully generated at boot |
| World storage | `world = {}` plain object, key `"x,y,z"` string |
| Rendering | One `InstancedMesh` per block type, `MAX_INSTANCES = 55000` |
| Build step | None. Deployed as static files (GitHub Pages, `.nojekyll`) |
| Tests | None |

### What is actually good and must be kept

- Procedural canvas textures — zero asset pipeline, fully hackable, very teachable.
- `InstancedMesh` + swap-remove in `removeBlockMesh` — genuinely the right idea.
- `shouldRender()` interior-culling — correct instinct.
- Web Audio synthesised SFX — no files, no loading, no CORS.
- Data-ish registries already exist: `BLOCK_TYPES`, `RECIPES`, `HOTBAR`, `ITEM_NAMES`.

### The three walls we will hit

1. **55 000 instance cap.** A `1000 × 1000` world (TODO line 9) has ~1 000 000 surface
   columns. It is ~20× over the cap and ~450× over the current world's memory. Not a tuning
   problem — an architecture problem.
2. **Everything is a global in one scope.** Two people cannot edit this file without
   conflicts, and nothing can be tested in isolation.
3. **No server.** Multiplayer (TODO line 20) is not a client feature.

---

## 1. Principles

1. **The game is never broken.** Every step ends with a working `index.html`. No "big rewrite"
   branch that lives for three weeks.
2. **No build step.** Native ES modules + an import map. `npx serve` and go. A bundler is a
   whole extra topic and it buys us nothing here.
3. **Data over code.** Adding a chicken should mean adding an object to a data file, not a new
   `if (type === 'chicken')` branch. This is the single biggest maintainability lever.
4. **Pure logic separated from Three.js.** Anything that does not touch the GPU (noise,
   inventory, crafting, chunk math, physics) lives in a file that imports nothing. Those files
   get tests.
5. **One concept per phase.** The refactor *is* the curriculum.

---

## 1bis. Deployment constraint: GitHub Pages

The site ships from `TrustingLD/Minicrafter` → **`https://trustingld.github.io/Minicrafter/`**.
That is a *project* page, so the site lives under a **sub-path**, not at the domain root.

Nothing in this plan is blocked by Pages. But five constraints follow, and three of them start
biting the moment Phase 1 turns one file into thirty.

### 1bis.1 🔴 All paths must be relative — never root-absolute

Because of the `/Minicrafter/` sub-path, `/src/main.js` resolves to
`trustingld.github.io/src/main.js` → **404**. Every path must be `./` or `../`.

```html
<!-- ✅ works locally AND on Pages -->
<script type="importmap">
{ "imports": { "three": "./vendor/three.module.js" } }
</script>
<script type="module" src="./src/main.js"></script>

<!-- ❌ 404 on Pages, works locally -->
<script type="module" src="/src/main.js"></script>
```

Same for `new Worker(...)` (Phase 5) and `new Audio('luft-mini.mp3')`. Safest form for
anything resolved at runtime: `new URL('./worker.js', import.meta.url)` — resolves against the
module's own location, correct at any sub-path.

**Guard:** serve locally under a sub-path too, so dev matches prod:
`"dev": "npx serve -l 3000 .."` from inside the folder, then open
`localhost:3000/Minicrafter/`. Cheap, catches this class of bug on day one.

### 1bis.2 🔴 Pages is case-sensitive, Windows is not

Pages runs on Linux. `import { BLOCKS } from './data/Blocks.js'` with a file actually named
`blocks.js` **works on his Windows machine and 404s in production**. With ~30 new files this
is the single most likely way to ship a white screen.

**Rule:** every file and folder is `lowercase-with-dashes.js`. No exceptions, no capitals.
Phase 7's CI adds a check for it.

### 1bis.3 🟡 No custom HTTP headers — ever

Pages serves what it wants; we cannot set headers. Consequences:

- **No `SharedArrayBuffer`.** It requires `Cross-Origin-Opener-Policy` +
  `Cross-Origin-Embedder-Policy` headers. So Phase 5's worker **must** use transferable
  `ArrayBuffer`s (`postMessage(buf, [buf])`). The plan already said transferables — now it is
  forced, not preferred. Fine: transferables are zero-copy anyway.
- **No cache-control tuning.** Pages caches aggressively (~10 min CDN). If a stale module
  bites during a demo, hard-reload, or bump a query string: `./src/main.js?v=3`.

### 1bis.4 🟢 No build step is now a *requirement*, not just a preference

A bundler on Pages means a GitHub Actions workflow, a build artifact, and a deploy step
between "commit" and "it's live". With plain ES modules, **deploy = `git push`**. For a kid
learning the loop, that immediacy is worth a lot. Principle #2 was already right; Pages makes
it structural.

Keep `.nojekyll` (already present). Without it Jekyll silently drops any file or folder
starting with `_`.

### 1bis.5 🔴 Phase 8: Pages cannot host the multiplayer server

Static host. No Node process. So:

- **Client** stays on Pages. **Server** goes to Fly.io / Render free tier.
- The page is HTTPS, so the socket **must be `wss://`, not `ws://`** — browsers block mixed
  content outright. Free tiers give TLS, so this is configuration, not cost.
- Server needs permissive CORS / origin allow-list for `https://trustingld.github.io`.
- Single-player must keep working with the server down. Network is an add-on, never a
  dependency.

This is a genuinely good lesson: *static hosting vs. dynamic hosting*, discovered by hitting
the wall rather than being told.

### 1bis.6 Also fine, no action needed

HTTPS is automatic → Pointer Lock, Fullscreen, and Phase 6's Wake Lock all work. Module
workers are same-origin once Three.js is vendored (another reason to vendor rather than CDN).
Repo limits: 1 GB site, 100 GB/month bandwidth — `luft-mini.mp3` at 6.5 MB is a non-issue.

---

## 2. Target architecture

```
Minicrafter/
├── index.html              # ~40 lines: DOM shell + import map. No logic.
├── package.json            # scripts only: dev, test, format
├── vendor/
│   └── three.module.js     # pinned, vendored (offline-safe, no CDN outage)
├── src/
│   ├── main.js             # wiring only: build systems, start loop
│   ├── core/
│   │   ├── loop.js         # fixed-timestep update + interpolated render
│   │   ├── events.js       # tiny pub/sub bus (~25 lines)
│   │   ├── input.js        # keyboard/mouse/touch -> named actions
│   │   └── math.js         # rng, noise, clamp, lerp        [PURE]
│   ├── data/               # ← ALL game content lives here
│   │   ├── blocks.js       # id, hardness, tool, drops, texture, solid, liquid
│   │   ├── items.js        # tools, food, materials
│   │   ├── recipes.js
│   │   └── mobs.js         # speed, hp, hitbox, ai, body model, drops
│   ├── world/
│   │   ├── chunk.js        # Uint8Array storage + index math   [PURE]
│   │   ├── world.js        # chunk map, get/set block, streaming
│   │   ├── generator.js    # terrain, caves, ores, trees       [PURE]
│   │   └── physics.js      # AABB collision, gravity, swim     [PURE]
│   ├── render/
│   │   ├── textures.js     # the existing procedural canvases
│   │   ├── atlas.js        # bake textures into one atlas + UV table
│   │   ├── mesher.js       # chunk voxels -> BufferGeometry    [PURE-ish]
│   │   ├── scene.js        # camera, lights, sun, sky, fog
│   │   └── effects.js      # break animation, particles
│   ├── entities/
│   │   ├── entity.js       # shared base: pos, vel, hitbox, tick
│   │   ├── mob.js          # generic, driven by data/mobs.js
│   │   ├── player.js
│   │   └── model.js        # box-model builder from data
│   ├── ui/
│   │   ├── hud.js          # fps, position, target
│   │   ├── hotbar.js
│   │   ├── health.js
│   │   ├── craft.js
│   │   ├── chat.js
│   │   └── touch.js        # mobile controls
│   ├── audio/
│   │   ├── sfx.js
│   │   └── music.js
│   └── net/                # phase 8 only
│       ├── client.js
│       └── protocol.js     # shared with server               [PURE]
├── server/                 # phase 8 only
│   ├── server.js
│   └── package.json
├── test/
│   └── *.test.js           # node --test, zero dependencies
├── docs/
│   ├── ARCHITECTURE.md
│   └── LESSONS.md          # one page per concept, written by lil bro
└── PLAN.md                 # this file
```

**Rule of thumb for him:** if a file needs `import * as THREE`, it cannot be unit-tested — so
keep those files thin and push the thinking into the pure ones.

---

## 3. Bugs found while reading the code (root causes, not guesses)

### 3.1 Blocks are rendered half a block off — TODO line 18

`addBlockMesh()` sets `dummyObj.position.set(x, y, z)`. A `BoxGeometry(1,1,1)` is centred on
its origin, so the block visually occupies `[x-0.5, x+0.5]`.
But `collidesAtBox()` and `isSolid()` use `Math.floor(...)`, i.e. they treat the block as
occupying `[x, x+1]`.

**Every block is drawn 0.5 off from its own collision box, on all three axes.** This is also
why breaking/placing feels misaligned.

Fix: `dummyObj.position.set(x + 0.5, y + 0.5, z + 0.5)` (and the same for the water mesh and
the raycast hit → block conversion). One-line class of fix, huge feel improvement. Do it
first, in isolation, so the change is obvious.

### 3.2 Zombie face is on the back of the head — TODO line 1

`buildMobMesh()` puts the face texture at material index 5 = the **−Z** face.
`Mob.update()` does `moveAngle = Math.atan2(dx, dz)` then `group.rotation.y = moveAngle`.
With that convention, local forward is **+Z**. So the face is on the back.

Fix: put the face on index 4 (+Z), or keep index 5 and use
`Math.atan2(dx, dz) + Math.PI`. Prefer fixing the material index — the rotation convention is
used by the walk animation too.

### 3.3 Mobs sink into the ground — TODO line 19

`this.pos` is the mob's **feet**, and the group origin is the feet, but the spawn uses
`getGroundHeight(x,z)` which returns the *block* height — combined with 3.1's half-block
offset, mobs float or sink by 0.5. Fixing 3.1 fixes most of this; the rest is the vertical
collision resolution snapping `velY = 0` without correcting `pos.y` to the surface.

---

## 4. Phases

Difficulty for lil bro: 🟢 he can do it alone · 🟡 pair on it · 🔴 you drive, he watches & asks

---

### Phase 0 — Toolbelt (½ weekend)
**Concept: a project is more than a file.**

- `git` branch-per-feature workflow; commit messages that say *why*.
- `package.json` with `"dev": "npx serve -l 3000 .."` (served from the parent so the URL is
  `localhost:3000/Minicrafter/` — matches the Pages sub-path, see §1bis.1) and
  `"test": "node --test test/"`.
- Why `file://` breaks ES modules (CORS + module resolution) → what a static server is.
- Agree the **lowercase-only filename rule** (§1bis.2) *before* Phase 1 creates 30 files.
- Move `TODO` → GitHub Issues, one issue per line, labelled `bug` / `feature` / `hard`.
  Teaches issue tracking and makes "what do we do today" a 5-second decision.
- Add `.editorconfig` + Prettier. Formatting is not a debate.

**Ships:** nothing visible. That is the lesson — infrastructure day.

---

### Phase 1 — Split the file (1 weekend) 🔴
**Concept: modules, imports/exports, dependency direction.**

Pure mechanical extraction. **No behaviour changes at all** — this is the rule.

1. `index.html` → shell + import map + `<script type="module" src="src/main.js">`.
2. Vendor Three.js: download `three.module.js` (r160+) into `vendor/`, add import map:
   ```html
   <script type="importmap">
   { "imports": { "three": "./vendor/three.module.js" } }
   </script>
   ```
   Upgrading r128 → r160 costs: `Geometry` is gone (already unused), `outputEncoding` →
   `outputColorSpace`, `THREE.sRGBEncoding` → `THREE.SRGBColorSpace`. Small.
3. Cut in this order (leaves first, so nothing is ever broken for long):
   `textures.js` → `math.js` → `blocks.js` → `generator.js` → `sfx.js` → `ui/*` →
   `entities/*` → `world.js` → `main.js`.
4. Make the dependency graph a **DAG**. `data/` imports nothing. `world/` imports `data/` and
   `core/math`. `ui/` never imports `world/` directly — it listens on the event bus.

**Teach:** draw the import graph on paper before touching code. Circular imports are the
first real design constraint he will meet.

**Acceptance:** game plays identically; `index.html` under 60 lines.

---

### Phase 2 — Data-driven content (1 weekend) 🟡
**Concept: data vs. code. The most valuable idea in the whole plan.**

Today, adding a mob means editing `buildMobMesh`, the `Mob` constructor's three ternaries,
and `spawnMobs`. After this phase it means one object literal.

```js
// src/data/mobs.js
export const MOBS = {
  chicken: {
    name: 'Poulet',
    speed: 1.3, health: 3,
    hitbox: { radius: 0.28, height: 0.6 },
    ai: 'wander',                    // 'wander' | 'hostile'
    drops: [{ item: 'meat', min: 1, max: 2 }],
    model: {                         // box model, replaces buildMobMesh branches
      body: { size: [0.4, 0.4, 0.5], at: [0, 0.42, 0],   tex: 'chickenBody' },
      head: { size: [0.3, 0.3, 0.3], at: [0, 0.75, 0.28], tex: 'chickenHead', face: '+z' },
      beak: { size: [0.1, 0.1, 0.15], at: [0, 0.72, 0.48], tex: 'beak' },
      legs: { count: 2, size: [0.08, 0.3, 0.08], at: [[-0.1,0.3,0],[0.1,0.3,0]], tex: 'beak' },
    },
  },
};
```

Same treatment for:
- `data/blocks.js` — `{ id, textures, solid, liquid, hardness, tool, drops, opaque }`.
  `hardness` + `tool` replaces the hardcoded `TOOL_FOR_BLOCK` map and gives us real break
  timings (needed for the break animation in Phase 3).
- `data/items.js`, `data/recipes.js` — `HOTBAR` and `NON_PLACEABLE` become derived, not
  hand-maintained.

**Payoff, delivered same weekend:**
- ✅ TODO 8 — chicken (now ~20 lines of data)
- ✅ TODO 1 — faces via the model's `face: '+z'` field, fixed once for every mob
- ✅ Fix 3.1 (half-block offset) and 3.3 (mobs on the ground)

**Teach:** "when you find yourself writing the same `if` in three places, you wanted a table."

---

### Phase 3 — Easy wins & game feel (1 weekend) 🟢
**Concept: the event bus. UI reacts, it does not poll.**

Add `core/events.js` (~25 lines: `on`, `off`, `emit`). Game logic emits
`player:damaged`, `block:broken`, `item:crafted`. UI subscribes. Now UI files never import
world state, and the whole `updateHealthUI()`-called-from-`Mob.update()` tangle dies.

Then knock out the small TODOs — perfect solo tasks for him, each one PR-sized:

| TODO | Task | Diff |
|---|---|---|
| 6 | FPS counter top-left (rolling average, not instantaneous) | 🟢 |
| 5 | Hearts instead of squares (`clip-path` on the existing `.heart`) | 🟢 |
| 10 | Visible sun billboard + move `DirectionalLight` with it | 🟢 |
| 4 | Zoom on `C` — animate `camera.fov` 75 → 25, `updateProjectionMatrix()` | 🟢 |
| 13 | Crouch on `Shift` — lower eye height, no fall off edges | 🟡 |
| 11 | Sprint on double-tap `Z` — input layer tracks tap timing | 🟡 |
| 7 | Chat on `T` — DOM input, release pointer lock, `chat:message` event | 🟡 |
| 2 | World border — invisible wall + red fog/particle plane at the edge | 🟢 |
| 15 | Held item **in** the hand — parent `heldItemMesh` to the hand bone | 🟡 |
| 16 | Break animation — 10-stage crack overlay, driven by `hardness` | 🟡 |
| 17 | 6-block reach in 1st **and** 3rd person — raycast from the *camera*, but clamp the range from the *player*, not the camera | 🟡 |
| 12 | Water: slower movement + animated UV scroll on the water material | 🟡 |

**Teach:** each of these is a branch, a commit, a "does it still work?", a merge. Repetition
of the git loop is the point.

---

### Phase 4a — Chunks (1–2 weekends) 🔴
**Concept: data structures determine what is possible. This is computer science.**

The headline change. Replace `world = {}` (string keys, one JS object entry per block —
roughly 100 bytes/block) with:

```js
// src/world/chunk.js — PURE, fully unit-tested
export const CHUNK_X = 16, CHUNK_Y = 128, CHUNK_Z = 16;
export const idx = (x, y, z) => (y * CHUNK_Z + z) * CHUNK_X + x;  // 1 byte per block
```

- `Uint8Array(16 * 128 * 16)` = 32 KB per chunk, flat, cache-friendly.
- `world.js` holds `Map<"cx,cz", Chunk>`; generates chunks on demand around the player,
  unloads beyond render distance, keeps a small LRU of player-modified chunks.
- Rendering: keep the existing `InstancedMesh` approach but **one set per chunk**, sized to
  the chunk's actual visible-block count. The 55 000 global cap disappears.
- Player edits saved to `localStorage` as a diff (`chunkKey -> {index: blockId}`), not the
  whole world.

**Numbers to show him** (this is the lesson — make him compute it before coding):

| | Today | After |
|---|---|---|
| Bytes per block | ~100 (object entry + string key) | 1 |
| 1000×1000 world in RAM | ~10 GB → impossible | 32 KB × loaded chunks only |
| Chunks loaded at distance 8 | — | 17×17 = 289 → ~9 MB |

**Ships:** ✅ TODO 9 — the 1000×1000 world, actually infinite if we want it.

**Teach:** flat arrays vs. hash maps, index math, memory as a real budget, the idea that you
can *predict* whether something will work before writing it.

---

### Phase 4b — Caves, ores, and a real generator (1 weekend) 🟡
**Concept: 3D noise, and why the pure/impure split just paid off.**

Chunks make this natural — the generator is now `(cx, cz) -> Uint8Array`, a pure function.

- 3D noise for caves: carve where `noise3D(x, y, z) > threshold`, with the threshold rising
  near the surface so caves stay underground.
- Ore veins by depth band, from `data/blocks.js`:
  ```js
  coal:    { minY: 5,  maxY: 60, rarity: 0.020, veinSize: 8 },
  iron:    { minY: 3,  maxY: 40, rarity: 0.010, veinSize: 5 },
  gold:    { minY: 2,  maxY: 22, rarity: 0.004, veinSize: 4 },
  diamond: { minY: 1,  maxY: 14, rarity: 0.002, veinSize: 3 },
  ```
- Bedrock floor at y=0 so caves have a bottom.
- New recipes: stone tools, iron tools, torches. Torches need block-light propagation — a
  flood-fill BFS. **Excellent** algorithms lesson, but it is its own weekend; defer if tired.

**Ships:** ✅ TODO 3 — caves + ores.

**Teach:** unit tests on the generator. Same seed → same chunk, every time. He will *feel*
why pure functions matter when he can test terrain without opening a browser.

---

### Phase 5 — Performance: atlas, mesher, worker (1–2 weekends) 🔴
**Concept: profiling. Measure, then fix. Never guess.**

Do this **only** after Phase 4 makes the game slow — the whole point is that he sees the
problem first, in the FPS counter he built in Phase 3.

1. **Texture atlas** (`render/atlas.js`): bake all block textures into one 512×512 canvas,
   keep a `{ blockId: [u0,v0,u1,v1] }` table. Enables one material for all opaque terrain.
2. **Chunk mesher** (`render/mesher.js`): chunk `Uint8Array` → one `BufferGeometry` of only
   the visible faces. ~289 draw calls instead of ~1200. Pure function, testable: feed it a
   3×3×3 array, assert the face count.
3. **Web Worker**: run generation + meshing off the main thread, post back a transferable
   `ArrayBuffer`. No more stutter when new chunks load.
4. Frustum culling per chunk (re-enable it — it is currently disabled globally), plus fog to
   hide the load boundary.

**Teach:** Chrome DevTools performance tab, `stats.js`, the difference between CPU-bound and
GPU-bound, why `postMessage` copies and how transferables avoid it.

---

### Phase 6 — Mobile (1 weekend) 🟡
**Concept: your program runs on hardware you do not control.**

- `ui/touch.js`: left virtual joystick = move, right half drag = look, tap = break,
  long-press = place. Buttons for jump / inventory.
- `input.js` was already action-based since Phase 1 — touch just becomes another producer of
  the same actions. **Nothing else in the game changes.** Show him that. That is what a good
  abstraction buys.
- Adaptive quality: `devicePixelRatio` clamp, shorter render distance, disable shadows,
  smaller atlas on low-memory devices.
- Viewport meta, fullscreen API, `touch-action: none`, wake lock.

**Ships:** ✅ TODO 21 — playable on a phone.

---

### Phase 7 — Tests, types, CI (1 weekend) 🟡
**Concept: making sure it still works, without playing it.**

- `node --test` on the pure modules: `chunk.js` index math, `generator.js` determinism,
  `physics.js` AABB, recipes, inventory. Target the *logic*, never the rendering.
- `// @ts-check` + JSDoc types + a `tsconfig.json` with `checkJs: true`, **`noEmit`**. Full
  editor type-checking, zero build step. This is the sweet spot for this project.
- GitHub Actions: run tests + Prettier check on every PR. Seeing a red ❌ on his own PR is a
  better teacher than any lecture.
- Add two Pages-specific CI guards (cheap, catch the white-screen bugs from §1bis):
  - **filename case** — fail if any path under `src/` contains an uppercase letter;
  - **absolute paths** — fail on any `from '/` or `src="/` in `src/` or `index.html`.
- `docs/ARCHITECTURE.md` — he writes it. If he cannot explain the structure, it is too complex.

---

### Phase 8 — Multiplayer (2–3 weekends) 🔴
**Concept: there is another computer, and it lies to you.**

The biggest jump. First real distributed system.

**Server** (`server/`, Node + `ws`, ~250 lines):
- Owns the world seed and the block-diff map. Authoritative on blocks, trusting on movement
  (anti-cheat is out of scope — say so explicitly, it is a good scoping lesson).
- 20 Hz tick, broadcasts player snapshots.
- Deploy free on Fly.io / Render. **GitHub Pages cannot host it** — that alone teaches static
  vs. dynamic hosting.

**Protocol** (`src/net/protocol.js`, shared by client and server):
```
C→S: join{name} · move{x,y,z,yaw,pitch} · setBlock{x,y,z,id} · chat{text} · hit{entityId}
S→C: welcome{id,seed,players} · state{[{id,x,y,z,yaw}]} · blockChanged{...} · chat{...}
     · playerJoined/playerLeft
```
Start with JSON (readable in DevTools = debuggable by a kid). Move to binary only if it
actually lags — and then it is a *measured* decision.

**Client:** remote players reuse the existing `entities/model.js` box model. Interpolate
remote positions ~100 ms in the past — that is what makes it feel smooth. Local player is
predicted, never interpolated.

**Ships:** ✅ TODO 20 — play together.

**Teach:** client/server, serialisation, latency, why "just send everything every frame" does
not work, and why the server must not trust the client.

---

### Phase 9 — Backlog / stretch
Only when everything above is stable.

- Day/night cycle (the Phase 3 sun already moves — just add colour ramps + night mobs).
- Torches + light propagation, if deferred from 4b.
- Inventory drag & drop, 3×3 crafting grid with shaped recipes.
- Furnace + smelting (iron ore → ingot). Needs a tick-based block-entity system.
- Biomes: temperature/humidity noise selects a biome, biome selects blocks + mob spawns.
- Structures: villages, dungeons.
- Save/load to a file the player can share.

---

## 5. TODO coverage map

| TODO line | Item | Phase |
|---|---|---|
| 1 | Zombie/cow/pig faces | 2 (root cause §3.2) |
| 2 | World border | 3 |
| 3 | Caves + ores | 4b |
| 4 | Zoom on `C` | 3 |
| 5 | Heart-shaped health bar | 3 |
| 6 | FPS display | 3 |
| 7 | Chat on `T` | 3 |
| 8 | Chicken | 2 |
| 9 | 1000×1000 world | 4a |
| 10 | Sun | 3 |
| 11 | Sprint (double-tap `Z`) | 3 |
| 12 | Water: slow + flowing | 3 |
| 13 | Crouch on `Shift` | 3 |
| 15 | Item held in the hand | 3 |
| 16 | Block-breaking animation | 3 |
| 17 | 6-block reach, 1st & 3rd person | 3 |
| 18 | Block visual offset | 2 (root cause §3.1) |
| 19 | Mobs touching the ground | 2 (root cause §3.3) |
| 20 | Multiplayer | 8 |
| 21 | Mobile browser | 6 |

---

## 6. Explicitly NOT doing

Saying no is part of design. Each of these costs more than it returns here:

- **Bundler** (Vite/webpack/Rollup) — native ES modules are enough; a build step is a whole
  topic that hides the code from him.
- **TypeScript with a compile step** — JSDoc + `checkJs` gives ~90% of the benefit at 0% of
  the friction.
- **A framework for the UI** (React/Vue) — the HUD is ~10 DOM elements.
- **An ECS** — tempting, but overkill at 4 entity types, and it obscures the plain
  object-oriented modelling he should learn first.
- **Anti-cheat / netcode rollback** — scope creep on a weekend project.
- **Git LFS for `luft-mini.mp3`** — 6.5 MB is annoying but fine; revisit only if more audio
  lands. Worth *mentioning* to him as a thing that exists.

---

## 7. Risks

| Risk | Mitigation |
|---|---|
| Phase 1 refactor drags and the game stays broken for weeks | Extract leaf modules first, commit after each one, never more than one file in flight |
| Phase 4a (chunks) is genuinely hard and demoralising | Do it *after* Phase 3's easy wins so momentum is high; you drive, he narrates |
| Three.js r128 → r160 breaks something subtle | Do the upgrade alone in its own commit, before splitting files, so `git bisect` has one suspect |
| Multiplayer server costs money / dies | Free tier + it is optional; single-player must never depend on the network |
| Interest fades | Every phase ships something *visible* except Phase 0 and 1 — keep those two short |
| Works locally, white screen on Pages (path case / absolute paths) | Lowercase-only filenames, relative paths only, dev server on a sub-path, CI guards — §1bis.1–2 |
| Stale module cached by the Pages CDN mid-demo | Hard reload, or bump `?v=N` on the entry script — §1bis.3 |

---

## 8. Suggested order of the first three sessions

1. **Session 1** — Phase 0 (tooling, issues) + fix §3.1 the half-block offset. Small, and the
   game immediately feels better. Momentum.
2. **Session 2** — Phase 1 (split into modules). Hard, unglamorous; frame it as "we are
   building the workbench".
3. **Session 3** — Phase 2 (data-driven) → chicken + faces ship the same day. This is where he
   sees the payoff of session 2 and gets it.

---

*Plan written in English; happy to produce a French version for lil bro — the code comments
and the TODO are already in French.*
