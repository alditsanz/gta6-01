// input.js — keyboard + mouse state, edge-triggered presses, and the aim point.

const Keys = {
  down: {},
  pressed: {}, // edge: true only on the frame the key went down
  mouseX: 640,
  mouseY: 360,
  mouseDown: false,
  mouseClicked: false,
};

function keyName(e) {
  const k = e.key.length === 1 ? e.key.toLowerCase() : e.key;
  if (k === ' ') return 'space';
  if (k === 'ArrowUp') return 'up';
  if (k === 'ArrowDown') return 'down';
  if (k === 'ArrowLeft') return 'left';
  if (k === 'ArrowRight') return 'right';
  if (k === 'Shift') return 'shift';
  if (k === 'Escape') return 'escape';
  return k;
}

function installInput(canvas) {
  if (typeof window === 'undefined') return;
  window.addEventListener('keydown', (e) => {
    const k = keyName(e);
    if (['up', 'down', 'left', 'right', 'space'].includes(k)) e.preventDefault();
    if (!Keys.down[k]) Keys.pressed[k] = true;
    Keys.down[k] = true;
  });
  window.addEventListener('keyup', (e) => { Keys.down[e.key.length === 1 ? e.key.toLowerCase() : keyName(e)] = false; });
  canvas.addEventListener('mousemove', (e) => {
    const r = canvas.getBoundingClientRect();
    Keys.mouseX = e.clientX - r.left;
    Keys.mouseY = e.clientY - r.top;
  });
  canvas.addEventListener('mousedown', (e) => {
    if (e.button === 0) { Keys.mouseDown = true; Keys.mouseClicked = true; }
  });
  window.addEventListener('mouseup', () => { Keys.mouseDown = false; });
}

function endFrameInput() {
  Keys.pressed = {};
  Keys.mouseClicked = false;
}

// Movement axes from WASD / arrows: -1..1 on each axis.
function moveAxes() {
  let x = 0, y = 0;
  if (Keys.down.a || Keys.down.left) x -= 1;
  if (Keys.down.d || Keys.down.right) x += 1;
  if (Keys.down.w || Keys.down.up) y -= 1;
  if (Keys.down.s || Keys.down.down) y += 1;
  return { x, y };
}

// Aim angle from the player (screen space) toward the mouse.
function aimAngle(screenX, screenY) {
  return Math.atan2(Keys.mouseY - screenY, Keys.mouseX - screenX);
}
