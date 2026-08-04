// Contrôles tactiles (Phase 6) : un mobile n'a ni clavier ni souris, donc on fabrique
// les mêmes actions autrement — joystick virtuel pour l'axe de déplacement, glisser
// sur l'écran pour viser (mousemove ne se déclenche jamais sans pointer lock, qui
// n'existe pas sur tactile), boutons pour sauter/inventaire/miner/poser. Le reste du
// jeu ne change pas : le tactile n'est qu'un nouveau producteur des actions déjà
// utilisées par WASD/souris — c'est ce que le plan appelle "input déjà orienté action".
//
// Écart volontaire avec le PLAN : "tap = casser, appui long = poser" (gestes ambigus à
// distinguer de façon fiable dans la même zone que le regard) est remplacé par deux
// boutons dédiés (⛏ maintenir = casser, ▦ tap = poser). Plus robuste pour un enfant
// sur un vrai téléphone, et ça n'ajoute qu'un bouton par rapport au plan (saut +
// inventaire) au lieu de deux.

export function isTouchDevice() {
  return 'ontouchstart' in window || navigator.maxTouchPoints > 0;
}

const JOY_RADIUS = 45;
const LOOK_SENSITIVITY = 0.0032;

export function createTouchUI({
  onMove,
  onLook,
  onBreakStart,
  onBreakEnd,
  onPlace,
  onJump,
  onInventory,
}) {
  const root = document.createElement('div');
  root.id = 'touchControls';
  root.innerHTML = `
    <div id="tcLookZone"></div>
    <div id="tcJoystickBase"><div id="tcJoystickStick"></div></div>
    <div id="tcButtons">
      <button id="tcInventory" class="tcBtn" type="button">🎒</button>
      <button id="tcJump" class="tcBtn" type="button">⤒</button>
      <button id="tcPlace" class="tcBtn" type="button">▦</button>
      <button id="tcMine" class="tcBtn tcBtnBig" type="button">⛏</button>
    </div>
  `;
  document.body.appendChild(root);

  const joyBase = /** @type {HTMLElement} */ (root.querySelector('#tcJoystickBase'));
  const joyStick = /** @type {HTMLElement} */ (root.querySelector('#tcJoystickStick'));
  const lookZone = /** @type {HTMLElement} */ (root.querySelector('#tcLookZone'));

  let joyTouchId = null;
  let joyCenter = { x: 0, y: 0 };
  let lookTouchId = null;
  let lastLookPos = { x: 0, y: 0 };

  function joyStart(id, x, y) {
    joyTouchId = id;
    const rect = joyBase.getBoundingClientRect();
    joyCenter = { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
    joyMove(x, y);
  }
  function joyMove(x, y) {
    let dx = x - joyCenter.x,
      dy = y - joyCenter.y;
    const dist = Math.hypot(dx, dy);
    if (dist > JOY_RADIUS) {
      dx = (dx / dist) * JOY_RADIUS;
      dy = (dy / dist) * JOY_RADIUS;
    }
    joyStick.style.transform = `translate(${dx}px, ${dy}px)`;
    onMove(dx / JOY_RADIUS, dy / JOY_RADIUS);
  }
  function joyEnd() {
    joyTouchId = null;
    joyStick.style.transform = 'translate(0, 0)';
    onMove(0, 0);
  }

  joyBase.addEventListener(
    'touchstart',
    /** @param {TouchEvent} e */ (e) => {
      e.preventDefault();
      const t = e.changedTouches[0];
      joyStart(t.identifier, t.clientX, t.clientY);
    },
    { passive: false },
  );

  lookZone.addEventListener(
    'touchstart',
    /** @param {TouchEvent} e */ (e) => {
      e.preventDefault();
      const t = e.changedTouches[0];
      lookTouchId = t.identifier;
      lastLookPos = { x: t.clientX, y: t.clientY };
    },
    { passive: false },
  );

  // un seul écouteur global : le doigt qui déplace le joystick ou vise sort souvent
  // du petit élément où le geste a commencé, il faut suivre le touchmove sur la fenêtre
  window.addEventListener(
    'touchmove',
    (e) => {
      for (const t of e.changedTouches) {
        if (t.identifier === joyTouchId) {
          e.preventDefault();
          joyMove(t.clientX, t.clientY);
        } else if (t.identifier === lookTouchId) {
          e.preventDefault();
          const dx = t.clientX - lastLookPos.x,
            dy = t.clientY - lastLookPos.y;
          lastLookPos = { x: t.clientX, y: t.clientY };
          onLook(dx * LOOK_SENSITIVITY, dy * LOOK_SENSITIVITY);
        }
      }
    },
    { passive: false },
  );
  function releaseTouch(e) {
    for (const t of e.changedTouches) {
      if (t.identifier === joyTouchId) joyEnd();
      if (t.identifier === lookTouchId) lookTouchId = null;
    }
  }
  window.addEventListener('touchend', releaseTouch);
  window.addEventListener('touchcancel', releaseTouch);

  function bindHold(btn, start, end) {
    btn.addEventListener(
      'touchstart',
      (e) => {
        e.preventDefault();
        start();
      },
      { passive: false },
    );
    btn.addEventListener(
      'touchend',
      (e) => {
        e.preventDefault();
        end();
      },
      { passive: false },
    );
    btn.addEventListener('touchcancel', end);
  }
  bindHold(root.querySelector('#tcMine'), onBreakStart, onBreakEnd);
  bindHold(
    root.querySelector('#tcJump'),
    () => onJump(true),
    () => onJump(false),
  );
  root.querySelector('#tcPlace').addEventListener(
    'touchstart',
    (e) => {
      e.preventDefault();
      onPlace();
    },
    { passive: false },
  );
  root.querySelector('#tcInventory').addEventListener(
    'touchstart',
    (e) => {
      e.preventDefault();
      onInventory();
    },
    { passive: false },
  );

  // désactivée pendant le craft/chat (E, T) : la zone de visée/joystick ne doit pas
  // voler les touches destinées au panneau (défilement de l'inventaire, etc.)
  function setActive(active) {
    root.style.pointerEvents = active ? 'auto' : 'none';
  }

  return { root, setActive };
}
