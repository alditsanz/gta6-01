// input.js — keyboard + mouse state for the game.
// Keys are stored by code (KeyW, ArrowUp, ...) with edge detection so a
// single press can trigger steal / fare / pause exactly once.

export class Input {
  constructor() {
    this.keys = new Set();
    this.pressed = new Set();
    this.mouseX = 0;
    this.mouseY = 0;
    this.mouseDown = false;
    this.clicked = false;
    this._target = null;
    this._onKeyDown = (e) => {
      if (!this.keys.has(e.code)) this.pressed.add(e.code);
      this.keys.add(e.code);
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(e.code)) e.preventDefault();
    };
    this._onKeyUp = (e) => { this.keys.delete(e.code); };
    this._onMouseMove = (e) => {
      const r = this._target && this._target.getBoundingClientRect ? this._target.getBoundingClientRect() : null;
      this.mouseX = r ? e.clientX - r.left : e.clientX;
      this.mouseY = r ? e.clientY - r.top : e.clientY;
    };
    this._onMouseDown = () => { this.mouseDown = true; this.clicked = true; };
    this._onMouseUp = () => { this.mouseDown = false; };
  }

  attach(target, win) {
    this._target = target;
    win.addEventListener('keydown', this._onKeyDown);
    win.addEventListener('keyup', this._onKeyUp);
    target.addEventListener('mousemove', this._onMouseMove);
    target.addEventListener('mousedown', this._onMouseDown);
    win.addEventListener('mouseup', this._onMouseUp);
  }

  detach(win) {
    win.removeEventListener('keydown', this._onKeyDown);
    win.removeEventListener('keyup', this._onKeyUp);
    if (this._target) {
      this._target.removeEventListener('mousemove', this._onMouseMove);
      this._target.removeEventListener('mousedown', this._onMouseDown);
    }
    win.removeEventListener('mouseup', this._onMouseUp);
  }

  down(...codes) { return codes.some((c) => this.keys.has(c)); }
  justPressed(...codes) { return codes.some((c) => this.pressed.has(c)); }

  moveAxis() {
    let x = 0, y = 0;
    if (this.down('KeyA', 'ArrowLeft')) x -= 1;
    if (this.down('KeyD', 'ArrowRight')) x += 1;
    if (this.down('KeyW', 'ArrowUp')) y -= 1;
    if (this.down('KeyS', 'ArrowDown')) y += 1;
    return { x, y };
  }

  endFrame() { this.pressed.clear(); this.clicked = false; }
}
