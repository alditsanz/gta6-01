// Solmar Heat — input.js
// Keyboard + mouse state. Everything is polled: `keys` for held keys,
// `pressed` for one-frame edges (cleared by the main loop each frame),
// and the mouse position in screen space for aiming.

export function createInput(canvas) {
  const input = {
    keys: new Set(), pressed: new Set(),
    mouseX: 0, mouseY: 0, mouseDown: false, clicked: false,
  };
  window.addEventListener('keydown', (e) => {
    if (!e.repeat) input.pressed.add(e.code);
    input.keys.add(e.code);
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(e.code)) e.preventDefault();
  });
  window.addEventListener('keyup', (e) => input.keys.delete(e.code));
  window.addEventListener('blur', () => { input.keys.clear(); input.mouseDown = false; });
  canvas.addEventListener('mousemove', (e) => {
    const r = canvas.getBoundingClientRect();
    input.mouseX = ((e.clientX - r.left) / r.width) * canvas.width;
    input.mouseY = ((e.clientY - r.top) / r.height) * canvas.height;
  });
  canvas.addEventListener('mousedown', () => { input.mouseDown = true; input.clicked = true; });
  window.addEventListener('mouseup', () => { input.mouseDown = false; });
  return input;
}

export function held(input, ...codes) {
  return codes.some((c) => input.keys.has(c));
}

export function tapped(input, ...codes) {
  return codes.some((c) => input.pressed.has(c));
}
