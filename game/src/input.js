// Solmar Heat — input: keyboard and mouse state, one object the
// whole game reads. Keys are tracked by their `code` so WASD and
// the arrow keys both work.
SH.keys = {};
SH.mouse = { x: 0, y: 0, down: false, clicked: false };
SH.keyPressed = {}; // edge-triggered: true for one frame after a press

SH.initInput = function (canvas) {
  window.addEventListener('keydown', function (e) {
    if (!SH.keys[e.code]) SH.keyPressed[e.code] = true;
    SH.keys[e.code] = true;
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].indexOf(e.code) >= 0) {
      e.preventDefault();
    }
  });
  window.addEventListener('keyup', function (e) { SH.keys[e.code] = false; });
  window.addEventListener('blur', function () { SH.keys = {}; });
  canvas.addEventListener('mousemove', function (e) {
    var r = canvas.getBoundingClientRect();
    SH.mouse.x = (e.clientX - r.left) * (canvas.width / r.width);
    SH.mouse.y = (e.clientY - r.top) * (canvas.height / r.height);
  });
  canvas.addEventListener('mousedown', function (e) {
    SH.mouse.down = true; SH.mouse.clicked = true;
    var r = canvas.getBoundingClientRect();
    SH.mouse.x = (e.clientX - r.left) * (canvas.width / r.width);
    SH.mouse.y = (e.clientY - r.top) * (canvas.height / r.height);
  });
  window.addEventListener('mouseup', function () { SH.mouse.down = false; });
};

SH.down = function () {
  for (var i = 0; i < arguments.length; i++) {
    if (SH.keys[arguments[i]]) return true;
  }
  return false;
};

SH.pressed = function (code) {
  return !!SH.keyPressed[code];
};

// Call once per frame, after the game has read the edge triggers.
SH.endFrameInput = function () {
  SH.keyPressed = {};
  SH.mouse.clicked = false;
};
