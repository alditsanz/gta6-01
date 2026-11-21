// input.js — keyboard + mouse state. One shared object the game
// loop polls; attach() is browser-only and guarded for Node tests.

export const keys = {};
export const mouse = { x: 0, y: 0, down: false, clicked: false };
const pressed = {};

export function attachInput(canvas) {
  if (typeof window === 'undefined') return;
  window.addEventListener('keydown', (e) => {
    if (!keys[e.code]) pressed[e.code] = true;
    keys[e.code] = true;
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(e.code)) e.preventDefault();
  });
  window.addEventListener('keyup', (e) => { keys[e.code] = false; });
  canvas.addEventListener('mousemove', (e) => {
    const r = canvas.getBoundingClientRect();
    mouse.x = (e.clientX - r.left) * (canvas.width / r.width);
    mouse.y = (e.clientY - r.top) * (canvas.height / r.height);
  });
  canvas.addEventListener('mousedown', () => { mouse.down = true; mouse.clicked = true; });
  window.addEventListener('mouseup', () => { mouse.down = false; });
}

// True only on the frame a key goes down (edge trigger).
export function pressedOnce(code) { return !!pressed[code]; }
export function endFrame() {
  for (const k of Object.keys(pressed)) delete pressed[k];
  mouse.clicked = false;
}
export function down(...codes) { return codes.some(c => keys[c]); }
