// Solmar Heat — input: keyboard + mouse state, shared by every system.
// Keys are tracked by their code so WASD and arrows both work.

const Input = {
  keys: {},
  mouseX: 0,
  mouseY: 0,
  mouseDown: false,
  clicked: false,      // consumed by the game loop each frame
  pressed: {},         // edge-triggered keys, consumed each frame
  anyKey: false,

  init(canvas) {
    window.addEventListener('keydown', (e) => {
      if (!this.keys[e.code]) this.pressed[e.code] = true;
      this.keys[e.code] = true;
      this.anyKey = true;
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(e.code)) {
        e.preventDefault();
      }
    });
    window.addEventListener('keyup', (e) => { this.keys[e.code] = false; });
    canvas.addEventListener('mousemove', (e) => {
      const r = canvas.getBoundingClientRect();
      this.mouseX = e.clientX - r.left;
      this.mouseY = e.clientY - r.top;
    });
    canvas.addEventListener('mousedown', (e) => {
      const r = canvas.getBoundingClientRect();
      this.mouseX = e.clientX - r.left;
      this.mouseY = e.clientY - r.top;
      if (e.button === 0) { this.mouseDown = true; this.clicked = true; }
    });
    window.addEventListener('mouseup', (e) => {
      if (e.button === 0) this.mouseDown = false;
    });
    window.addEventListener('blur', () => { this.keys = {}; this.mouseDown = false; });
  },

  down(code) { return !!this.keys[code]; },
  // Edge trigger: true only on the frame the key went down.
  hit(code) { return !!this.pressed[code]; },

  get up() { return this.down('KeyW') || this.down('ArrowUp'); },
  get dn() { return this.down('KeyS') || this.down('ArrowDown'); },
  get lf() { return this.down('KeyA') || this.down('ArrowLeft'); },
  get rt() { return this.down('KeyD') || this.down('ArrowRight'); },
  get sprint() { return this.down('ShiftLeft') || this.down('ShiftRight'); },
  get brake() { return this.down('Space'); },

  endFrame() {
    this.pressed = {};
    this.clicked = false;
  },
};
