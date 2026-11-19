// Input: createInput(canvas) tracks held and pressed keys, mouse-look, wheel, fire and aim. `pressed` is the per-frame edge.
// Keyboard and mouse. Pointer lock gives mouse-look; the rest is a small state bag the game
// reads once per frame. Keys are tracked as held and as "pressed this frame" edges.

const BLOCK_DEFAULT = new Set(['Space', 'KeyW', 'KeyA', 'KeyS', 'KeyD', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Tab']);

export function createInput(canvas) {
  const held = new Set();
  const edges = new Set();
  let mouseDX = 0;
  let mouseDY = 0;
  let wheel = 0;
  let fireDown = false;
  let aimDown = false;
  let fireEdge = false;

  window.addEventListener('keydown', (event) => {
    if (BLOCK_DEFAULT.has(event.code)) event.preventDefault();
    if (!event.repeat) edges.add(event.code);
    held.add(event.code);
  });
  window.addEventListener('keyup', (event) => {
    held.delete(event.code);
  });
  window.addEventListener('blur', () => {
    held.clear();
    fireDown = false;
    aimDown = false;
  });
  window.addEventListener('mousemove', (event) => {
    if (document.pointerLockElement !== canvas) return;
    mouseDX += event.movementX;
    mouseDY += event.movementY;
  });
  canvas.addEventListener('mousedown', (event) => {
    if (document.pointerLockElement !== canvas) {
      if (event.button === 0) canvas.requestPointerLock?.()?.catch(() => {});
      return;
    }
    if (event.button === 0) {
      fireDown = true;
      fireEdge = true;
    }
    if (event.button === 2) aimDown = true;
  });
  window.addEventListener('mouseup', (event) => {
    if (event.button === 0) fireDown = false;
    if (event.button === 2) aimDown = false;
  });
  window.addEventListener('wheel', (event) => {
    if (document.pointerLockElement === canvas) {
      wheel += Math.sign(event.deltaY);
      event.preventDefault();
    }
  }, { passive: false });
  window.addEventListener('contextmenu', (event) => event.preventDefault());

  return {
    get locked() { return document.pointerLockElement === canvas; },
    lock() { canvas.requestPointerLock?.()?.catch(() => {}); },
    down(code) { return held.has(code); },
    pressed(code) { return edges.has(code); },
    get fireDown() { return fireDown; },
    get aimDown() { return aimDown; },
    takeFire() {
      const fired = fireEdge;
      fireEdge = false;
      return fired;
    },
    takeMouse() {
      const d = { x: mouseDX, y: mouseDY, wheel };
      mouseDX = 0;
      mouseDY = 0;
      wheel = 0;
      return d;
    },
    endFrame() { edges.clear(); },
  };
}
