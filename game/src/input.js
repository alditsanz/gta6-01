// input.js — keyboard and mouse state for Solmar Heat.
// One object owns every key and the mouse; gameplay reads it through the
// helpers below instead of touching DOM events directly, so a headless
// screenshot run can drive the same code path with scripted input.

export class Input {
  constructor(canvas) {
    this.canvas = canvas;
    this.keys = new Set();
    this.pressed = new Set(); // keys hit since the last frame was consumed
    this.mouse = { x: 0, y: 0, down: false, clicked: false, rightDown: false };
    this._onKeyDown = (e) => {
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(e.code)) e.preventDefault();
      if (!e.repeat) this.pressed.add(e.code);
      this.keys.add(e.code);
    };
    this._onKeyUp = (e) => this.keys.delete(e.code);
    this._onMouseMove = (e) => {
      const r = this.canvas.getBoundingClientRect();
      this.mouse.x = e.clientX - r.left;
      this.mouse.y = e.clientY - r.top;
    };
    this._onMouseDown = (e) => {
      const r = this.canvas.getBoundingClientRect();
      this.mouse.x = e.clientX - r.left;
      this.mouse.y = e.clientY - r.top;
      if (e.button === 0) { this.mouse.down = true; this.mouse.clicked = true; }
      if (e.button === 2) this.mouse.rightDown = true;
    };
    this._onMouseUp = (e) => {
      if (e.button === 0) this.mouse.down = false;
      if (e.button === 2) this.mouse.rightDown = false;
    };
    this._onBlur = () => { this.keys.clear(); this.mouse.down = false; };
    this._onContext = (e) => e.preventDefault();
  }

  attach() {
    window.addEventListener('keydown', this._onKeyDown);
    window.addEventListener('keyup', this._onKeyUp);
    window.addEventListener('blur', this._onBlur);
    this.canvas.addEventListener('mousemove', this._onMouseMove);
    this.canvas.addEventListener('mousedown', this._onMouseDown);
    window.addEventListener('mouseup', this._onMouseUp);
    this.canvas.addEventListener('contextmenu', this._onContext);
  }

  // Held right now?
  down(code) { return this.keys.has(code); }

  // Hit since the last endFrame()? Edge-triggered, for menus and actions.
  hit(code) { return this.pressed.has(code); }

  // Any of these codes held? Handy for WASD + arrows doing the same job.
  any(...codes) { return codes.some((c) => this.keys.has(c)); }

  // Mouse click edge since the last endFrame(), with canvas coordinates.
  click() {
    if (!this.mouse.clicked) return null;
    return { x: this.mouse.x, y: this.mouse.y };
  }

  // Call once per frame after the game has read the input.
  endFrame() {
    this.pressed.clear();
    this.mouse.clicked = false;
  }
}
