// SOLMAR HEAT — input.js
// Keyboard + mouse state, plus the edge-triggered "pressed this frame"
// helpers the game loop consumes. WASD/arrows move, Shift sprints,
// E enters/steals a car, mouse aims, click shoots, Space is the handbrake,
// P/Esc pauses, M mutes, R restarts after wasted/busted.

export function createInput(canvas) {
  const keys = new Set();
  const pressed = new Set();
  const mouse = { x: 0, y: 0, down: false, clicked: false, wheel: 0 };

  function keyName(e) {
    // Lowercase everything: 'Enter', 'ArrowUp', 'Shift' and ' ' all land in
    // the same namespace the game checks ('enter', 'arrowup', 'shift', ' ').
    return e.key.toLowerCase();
  }

  window.addEventListener('keydown', (e) => {
    const k = keyName(e);
    if ([' ', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright'].includes(k)) {
      e.preventDefault();
    }
    if (!keys.has(k)) pressed.add(k);
    keys.add(k);
  });
  window.addEventListener('keyup', (e) => keys.delete(keyName(e)));
  window.addEventListener('blur', () => keys.clear());

  canvas.addEventListener('mousemove', (e) => {
    const r = canvas.getBoundingClientRect();
    mouse.x = (e.clientX - r.left) * (canvas.width / r.width);
    mouse.y = (e.clientY - r.top) * (canvas.height / r.height);
  });
  canvas.addEventListener('mousedown', (e) => {
    if (e.button === 0) {
      mouse.down = true;
      mouse.clicked = true;
    }
  });
  window.addEventListener('mouseup', (e) => {
    if (e.button === 0) mouse.down = false;
  });
  canvas.addEventListener('contextmenu', (e) => e.preventDefault());

  return {
    keys,
    mouse,
    down(...names) {
      return names.some((n) => keys.has(n));
    },
    // True only on the frame the key went down; consumed by the game loop.
    wasPressed(name) {
      return pressed.has(name);
    },
    axisX() {
      return (keys.has('d') || keys.has('arrowright') ? 1 : 0) -
        (keys.has('a') || keys.has('arrowleft') ? 1 : 0);
    },
    axisY() {
      return (keys.has('s') || keys.has('arrowdown') ? 1 : 0) -
        (keys.has('w') || keys.has('arrowup') ? 1 : 0);
    },
    endFrame() {
      pressed.clear();
      mouse.clicked = false;
      mouse.wheel = 0;
    },
  };
}
