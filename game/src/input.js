// input.js — keyboard + mouse state for the game.
// One job: track which keys are held, which were pressed this frame,
// and where the mouse points (in canvas pixels). main.js reads it.

export function createInput(canvas) {
  const held = new Set();
  const pressed = new Set();
  const mouse = { x: 0, y: 0, down: false, clicked: false };

  window.addEventListener('keydown', (e) => {
    if (!e.repeat) pressed.add(e.code);
    held.add(e.code);
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(e.code)) {
      e.preventDefault();
    }
  });
  window.addEventListener('keyup', (e) => held.delete(e.code));
  window.addEventListener('blur', () => { held.clear(); mouse.down = false; });

  canvas.addEventListener('mousemove', (e) => {
    const r = canvas.getBoundingClientRect();
    mouse.x = (e.clientX - r.left) * (canvas.width / r.width);
    mouse.y = (e.clientY - r.top) * (canvas.height / r.height);
  });
  canvas.addEventListener('mousedown', () => { mouse.down = true; mouse.clicked = true; });
  window.addEventListener('mouseup', () => { mouse.down = false; });

  return {
    mouse,
    down: (code) => held.has(code),
    hit: (code) => pressed.has(code),
    // Called once per frame after the game has read the edges.
    endFrame() { pressed.clear(); mouse.clicked = false; },
  };
}

// Convenience: is any of these key codes held?
export function anyDown(input, codes) {
  return codes.some((c) => input.down(c));
}
