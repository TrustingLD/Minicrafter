import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  resolveHorizontalMove,
  resolveVerticalPhysics,
  tryJump,
  resolveFlyingVertical,
} from '../src/world/physics.js';

function makePlayer(overrides = {}) {
  return {
    pos: { x: 0, y: 10, z: 0 },
    velY: 0,
    onGround: false,
    radius: 0.3,
    height: 1.7,
    speed: 5,
    jumpForce: 7,
    ...overrides,
  };
}

const NEVER_COLLIDES = () => false;

test('resolveHorizontalMove: does nothing when there is no input', () => {
  const player = makePlayer();
  resolveHorizontalMove(player, 0, 0, 0, 5, 0.1, false, NEVER_COLLIDES);
  assert.equal(player.pos.x, 0);
  assert.equal(player.pos.z, 0);
});

test('resolveHorizontalMove: moving forward (yaw 0) advances -z, in open space', () => {
  const player = makePlayer();
  resolveHorizontalMove(player, 0, -1, 0, 5, 0.1, false, NEVER_COLLIDES);
  assert.ok(player.pos.z < 0);
  assert.equal(player.pos.x, 0);
});

test('resolveHorizontalMove: a wall stops the player from crossing it', () => {
  const player = makePlayer({ pos: { x: 0, y: 10, z: 0 } });
  // mur infini à x >= 1 : bloque tout mouvement qui amènerait le joueur au-delà
  const wallAtX1 = (x) => x + player.radius > 1;
  resolveHorizontalMove(player, 1, 0, 0, 5, 1, false, wallAtX1); // grand pas, foncerait bien au-delà de x=1 sans mur
  assert.ok(player.pos.x <= 1 - player.radius + 1e-9);
  assert.ok(player.pos.x === 0); // le pas complet est rejeté (pas de résolution partielle), il reste immobile
});

test('resolveHorizontalMove: diagonal input is normalized (no speed boost moving diagonally)', () => {
  const straight = makePlayer();
  resolveHorizontalMove(straight, 0, -1, 0, 5, 0.1, false, NEVER_COLLIDES);
  const diagonal = makePlayer();
  resolveHorizontalMove(diagonal, 1, -1, 0, 5, 0.1, false, NEVER_COLLIDES);
  const straightDist = Math.hypot(straight.pos.x, straight.pos.z);
  const diagonalDist = Math.hypot(diagonal.pos.x, diagonal.pos.z);
  assert.ok(Math.abs(straightDist - diagonalDist) < 1e-9);
});

test('resolveHorizontalMove: crouching at a ledge refuses to step into empty air below', () => {
  const player = makePlayer({ onGround: true });
  // solide seulement sous z=0 (le "bord") ; au-delà (z<0), plus rien sous les pieds
  const ledgeAtZ0 = (x, y, z, radius, height) => {
    if (height === 0.15) return z >= 0; // sonde "y a-t-il du sol ?" (canStand)
    return false; // jamais de collision horizontale directe
  };
  resolveHorizontalMove(player, 0, -1, 0, 5, 1, true, ledgeAtZ0); // accroupi, avance vers le bord
  assert.equal(player.pos.z, 0); // refusé : pas de sol de l'autre côté
});

test('resolveHorizontalMove: NOT crouching walks off the same ledge normally', () => {
  const player = makePlayer({ onGround: true });
  const ledgeAtZ0 = (x, y, z, radius, height) => {
    if (height === 0.15) return z >= 0;
    return false;
  };
  resolveHorizontalMove(player, 0, -1, 0, 5, 1, false, ledgeAtZ0); // debout, pas accroupi
  assert.ok(player.pos.z < 0); // marche dans le vide, comme avant Phase 11bis/22
});

test('resolveVerticalPhysics: falling in open space decreases y and clears onGround', () => {
  const player = makePlayer({ onGround: true });
  resolveVerticalPhysics(player, 0.1, NEVER_COLLIDES);
  assert.ok(player.pos.y < 10);
  assert.equal(player.onGround, false);
});

test('resolveVerticalPhysics: hitting the floor sets onGround and reports landed once', () => {
  const player = makePlayer({ pos: { x: 0, y: 10, z: 0 }, velY: -5, onGround: false });
  const floorAtY9 = (x, y) => y < 9; // solide sous y=9
  const first = resolveVerticalPhysics(player, 0.5, floorAtY9); // grand pas -> traverserait le sol
  assert.equal(player.onGround, true);
  assert.equal(player.velY, 0);
  assert.equal(first.landed, true);
  const second = resolveVerticalPhysics(player, 0.1, floorAtY9);
  assert.equal(second.landed, false); // déjà au sol : pas un nouvel atterrissage
});

test('resolveVerticalPhysics: a gravityScale < 1 falls slower (buoyancy, Phase 16 swimming)', () => {
  const normal = makePlayer({ onGround: false });
  resolveVerticalPhysics(normal, 0.5, NEVER_COLLIDES, 1);
  const buoyant = makePlayer({ onGround: false });
  resolveVerticalPhysics(buoyant, 0.5, NEVER_COLLIDES, 0.3);
  assert.ok(buoyant.pos.y > normal.pos.y); // tombe moins vite -> reste plus haut
});

test('resolveVerticalPhysics: fallDistance accumulates while falling and is reported on landing', () => {
  const player = makePlayer({ pos: { x: 0, y: 10, z: 0 }, velY: 0, onGround: true });
  // sol seulement sous y=4 : le joueur chute de 10 à ~4, soit ~6 blocs
  const floorAtY4 = (x, y) => y < 4;
  let result;
  // onGround initial -> false pour déclencher la chute (comme si le sol se dérobait)
  player.onGround = false;
  for (let i = 0; i < 200 && !player.onGround; i++) {
    result = resolveVerticalPhysics(player, 0.05, floorAtY4);
  }
  assert.equal(result.landed, true);
  assert.ok(result.fallDistance > 5 && result.fallDistance < 7);
});

test('resolveVerticalPhysics: fallDistance resets to 0 after being reported, and while grounded', () => {
  const player = makePlayer({ pos: { x: 0, y: 5, z: 0 }, velY: -1, onGround: false });
  const floorAtY4 = (x, y) => y < 4;
  let result;
  for (let i = 0; i < 200 && !player.onGround; i++) {
    result = resolveVerticalPhysics(player, 0.05, floorAtY4);
  }
  assert.equal(result.landed, true);
  const again = resolveVerticalPhysics(player, 0.1, floorAtY4);
  assert.equal(again.fallDistance, 0); // toujours au sol : rien à signaler
});

test('tryJump: only works when on the ground, and clears onGround', () => {
  const grounded = makePlayer({ onGround: true, jumpForce: 7 });
  assert.equal(tryJump(grounded), true);
  assert.equal(grounded.velY, 7);
  assert.equal(grounded.onGround, false);

  const airborne = makePlayer({ onGround: false });
  assert.equal(tryJump(airborne), false);
  assert.equal(airborne.velY, 0);
});

test('resolveFlyingVertical: moves up/down freely and ignores gravity entirely', () => {
  const player = makePlayer({ velY: -100, onGround: false });
  resolveFlyingVertical(player, 0.1, 1, NEVER_COLLIDES);
  assert.ok(player.pos.y > 10);
  assert.equal(player.velY, 0); // le vol coupe la gravité net, pas de vélocité résiduelle
});

test('resolveFlyingVertical: still blocked by collision (a ceiling stops ascent)', () => {
  const player = makePlayer({ pos: { x: 0, y: 10, z: 0 } });
  const ceilingAtY10 = (x, y) => y > 10;
  resolveFlyingVertical(player, 1, 1, ceilingAtY10); // grand pas vers le haut
  assert.equal(player.pos.y, 10); // rejeté par le plafond
});

test('resolveFlyingVertical: no flySpeedMultiplier set behaves as x1 (backward compatible)', () => {
  const player = makePlayer({ pos: { x: 0, y: 10, z: 0 } }); // pas de flySpeedMultiplier
  resolveFlyingVertical(player, 1, 1, NEVER_COLLIDES);
  assert.equal(player.pos.y, 15); // y0 + speed(5) * dt(1) * x1
});

test('resolveFlyingVertical: /speedfly x2 doubles vertical distance covered', () => {
  const player = makePlayer({ pos: { x: 0, y: 10, z: 0 }, flySpeedMultiplier: 2 });
  resolveFlyingVertical(player, 1, 1, NEVER_COLLIDES);
  assert.equal(player.pos.y, 20); // y0 + speed(5) * dt(1) * x2
});
