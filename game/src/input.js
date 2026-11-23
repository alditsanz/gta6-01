// Solmar Heat — raw input state. Keys are tracked as held + tapped
// (edge) sets; the mouse is kept in canvas coordinates for aiming.

export function createInput(canvas) {
  const input = {
    keys: new Set(),
    pressed: new Set(),
    mouseX: 0,
    mouseY: 0,
    mouseDown: false,
    clicked: false,
  };

  window.addEventListener('keydown', (ev) => {
    if (!ev.repeat) input.pressed.add(ev.code);
    input.keys.add(ev.code);
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(ev.code)) {
      ev.preventDefault();
    }
  });
  window.addEventListener('keyup', (ev) => {
    input.keys.delete(ev.code);
  });
  window.addEventListener('blur', () => {
    input.keys.clear();
    input.mouseDown = false;
  });
  canvas.addEventListener('mousemove', (ev) => {
    const rect = canvas.getBoundingClientRect();
    input.mouseX = ((ev.clientX - rect.left) / rect.width) * canvas.width;
    input.mouseY = ((ev.clientY - rect.top) / rect.height) * canvas.height;
  });
  canvas.addEventListener('mousedown', () => {
    input.mouseDown = true;
    input.clicked = true;
  });
  window.addEventListener('mouseup', () => {
    input.mouseDown = false;
  });

  return input;
}

export function held(input, ...codes) {
  return codes.some((code) => input.keys.has(code));
}

export function tapped(input, ...codes) {
  return codes.some((code) => input.pressed.has(code));
}
