// Solmar Heat — input.js
// Keyboard and mouse state, kept separate from the game logic so the
// logic test can drive the game with a fake input object instead of a
// real keyboard. The browser wires real events into this same shape.

export function createInput() {
  return {
    keys: new Set(), // currently held key codes, lower-cased
    pressed: new Set(), // keys pressed since the last frame (edge-triggered)
    mouseX: 0,
    mouseY: 0,
    mouseDown: false,
    mouseClicked: false, // set on mousedown, cleared after the frame reads it
  };
}

// Attach real browser listeners to an input object. Safe to call only in
// the browser; the logic test never calls it.
export function attachInput(input, element) {
  const target = element || (typeof window !== 'undefined' ? window : null);
  if (!target || !target.addEventListener) return;
  target.addEventListener('keydown', (e) => {
    const k = e.key.length === 1 ? e.key.toLowerCase() : e.key;
    if (!input.keys.has(k)) input.pressed.add(k);
    input.keys.add(k);
    if ([' ', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)) {
      e.preventDefault();
    }
  });
  target.addEventListener('keyup', (e) => {
    const k = e.key.length === 1 ? e.key.toLowerCase() : e.key;
    input.keys.delete(k);
  });
  target.addEventListener('blur', () => {
    input.keys.clear();
  });
  target.addEventListener('mousemove', (e) => {
    const rect = element && element.getBoundingClientRect ? element.getBoundingClientRect() : { left: 0, top: 0 };
    input.mouseX = e.clientX - rect.left;
    input.mouseY = e.clientY - rect.top;
  });
  target.addEventListener('mousedown', (e) => {
    input.mouseDown = true;
    input.mouseClicked = true;
    const rect = element && element.getBoundingClientRect ? element.getBoundingClientRect() : { left: 0, top: 0 };
    input.mouseX = e.clientX - rect.left;
    input.mouseY = e.clientY - rect.top;
  });
  target.addEventListener('mouseup', () => {
    input.mouseDown = false;
  });
}

// Per-frame housekeeping: edge-triggered sets live for exactly one frame.
export function endFrameInput(input) {
  input.pressed.clear();
  input.mouseClicked = false;
}

// Convenience readers the game logic uses.
export function keyDown(input, ...names) {
  return names.some((n) => input.keys.has(n));
}
export function keyPressed(input, ...names) {
  return names.some((n) => input.pressed.has(n));
}
