# IMPLEMENTATION PLAN – Increase World Depth and Generate Real Underground Cave Systems

## Goal

Modify the terrain generation so that:

1. The world depth becomes **60 blocks** instead of the current depth.
2. The caves become real underground cave networks.
3. Caves are no longer simple 3×3 holes.
4. Cave systems behave like an anthill:
   - long horizontal tunnels
   - tunnels going down
   - tunnels going back up
   - multiple intersections
   - underground rooms
   - irregular shapes
5. Cave generation must be fully deterministic.
6. Same seed + same chunk = exactly the same caves.

## Files to Modify

### `src/world/chunk.js`
- Increase the vertical world size (`CHUNK_Y` or equivalent).
- Add approximately 60 more underground blocks.
- Ensure all arrays using `CHUNK_Y` resize automatically.
- Do not hardcode dimensions elsewhere.

### `src/world/generator.js`
Most of the implementation happens here.

## Step 1 — Increase Terrain Depth
Extend the underground so that the solid terrain reaches about **60 blocks below the surface** while keeping the surface unchanged.

## Step 2 — Move Bedrock Down
Move bedrock to the new world bottom and keep it 2–3 blocks thick.

## Step 3 — Move Ore Generation
Shift ore distribution deeper while preserving rarity.

## Step 4 — Remove Current Cave Algorithm
Remove the current noise threshold carving (`noiseCave`, `noiseCaveDetail`) and replace it with a tunnel-based cave generator.

## Step 5 — Create a Cave Graph Generator
Create `generateCaveNetwork(chunkX, chunkZ, seed)`.

Requirements:
- Deterministic
- Never use `Math.random()`
- Use existing hash/noise functions

## Step 6 — Generate Cave Entrances
Generate 0–4 cave systems per chunk.
Start them 15–25 blocks below the surface.

## Step 7 — Generate Tunnel Paths
Each tunnel stores:
- position
- direction
- radius
- length

Advance one block at a time.

## Step 8 — Tunnel Movement
Slightly rotate the direction every few blocks.
Allow:
- left
- right
- up
- down
- straight

Keep vertical angles moderate.

## Step 9 — Branches
Every 20–40 blocks, optionally create a branch.
Maximum recursion depth: 4.

## Step 10 — Horizontal Preference
Approximate probabilities:
- Horizontal: 70%
- Down: 15%
- Up: 15%

## Step 11 — Variable Radius
Continuously vary the radius (2–4 blocks).
Avoid perfect cylinders.

## Step 12 — Rooms
Occasionally create irregular spherical rooms.
Radius: 5–10 blocks.

## Step 13 — Connect Rooms
Every room must connect to at least two tunnels.

## Step 14 — Carving
Carve circular tunnels using squared distance instead of cubes.

## Step 15 — Wall Noise
Deform tunnel walls using `noiseCaveDetail`.

Example:
`radius += noise * 0.7`

## Step 16 — Chunk Borders
Generate tunnels in world coordinates.
Carve only the current chunk.
Ensure seamless caves across chunk borders.

## Step 17 — Determinism
Never use `Math.random()`.

Only use deterministic hash/noise.

## Step 18 — Cave Density
Target approximately 15–25% empty underground space.

## Step 19 — Protect the Surface
Keep at least 4 blocks of roof except at cave entrances.

## Step 20 — Lava
Allow lava only near the bottom (~15 blocks above bedrock).

## Step 21 — Water
Only flood caves naturally intersecting lakes or oceans.

## Step 22 — Performance
Generate only the current chunk.
Only process cave segments intersecting the chunk.

## Step 23 — Helper Functions
Create:
- `generateCaveNetwork()`
- `generateTunnel()`
- `generateBranch()`
- `carveTunnel()`
- `carveRoom()`
- `computeTunnelRadius()`
- `rotateDirection()`
- `intersectsChunk()`

## Step 24 — Testing
Verify:
- 60-block underground
- Bedrock at new bottom
- Surface unchanged
- Ores still generate correctly
- Seamless chunk transitions
- Natural branches
- Vertical and horizontal tunnels
- Rooms
- Deterministic generation
- No chunk seams
- Good performance

# Expected Result

The underground should resemble modern voxel sandbox caves:
- Long interconnected tunnels
- Multiple branches
- Large underground chambers
- Vertical shafts
- Horizontal galleries
- Irregular natural shapes
- Cave systems spanning multiple chunks
- Approximately 60 blocks of explorable underground beneath the surface.
